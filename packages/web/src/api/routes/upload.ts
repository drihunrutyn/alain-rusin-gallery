import { ORPCError } from "@orpc/server";
import { Hono } from "hono";
import { z } from "zod";
import { admin, session, throttle } from "../lib/security";
import { commitJpeg, validateJpeg } from "../lib/repository-images";
import { MAX_JPEG_BYTES } from "../../shared/images";

export const upload = admin.input(z.object({
  jpegBase64: z.string().min(1).max(Math.ceil(MAX_JPEG_BYTES / 3) * 4),
})).handler(async ({ input }) => {
  const bytes = Buffer.from(input.jpegBase64, "base64");
  try {
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input.jpegBase64)) throw new Error("Некорректный JPG");
    await validateJpeg(bytes);
  } catch (error) { throw new ORPCError("BAD_REQUEST", { message: error instanceof Error ? error.message : "Некорректный JPG" }); }
  try { return { publicUrl: await commitJpeg(bytes) }; }
  catch (error) { throw new ORPCError("INTERNAL_SERVER_ERROR", { message: error instanceof Error ? error.message : "Ошибка GitHub" }); }
});

// Compatibility endpoint requested by the CMS contract. Shares authentication and validator.
export const uploadRoutes = new Hono().post("/upload", async c => {
  if (!(await session(c.req.raw.headers))) return c.json({ error: "Unauthorized" }, 401);
  const origin = c.req.header("origin");
  if (origin && ![process.env.WEBSITE_URL, process.env.RUNABLE_URL, new URL(c.req.url).origin].includes(origin))
    return c.json({ error: "Forbidden" }, 403);
  const length = Number(c.req.header("content-length") || 0);
  if (length > MAX_JPEG_BYTES + 16384) return c.json({ error: "Нужен JPG до 900 КБ" }, 413);
  try {
    throttle(c.req.raw.headers, "image-upload", 30);
    // Bound request bytes even when Content-Length is absent or incorrect.
    const chunks: Uint8Array[] = []; let size = 0;
    if (!c.req.raw.body) return c.json({ error: "Нужен JPG" }, 400);
    for await (const chunk of c.req.raw.body) {
      size += chunk.length;
      if (size > MAX_JPEG_BYTES + 16384) return c.json({ error: "Нужен JPG до 900 КБ" }, 413);
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);
    let bytes: Uint8Array = body;
    if (c.req.header("content-type")?.startsWith("multipart/form-data")) {
      const form = await new Response(body, { headers: { "Content-Type": c.req.header("content-type")! } }).formData();
      const file = form.get("file");
      if (!(file instanceof File) || file.type !== "image/jpeg") return c.json({ error: "Нужен JPG" }, 400);
      bytes = new Uint8Array(await file.arrayBuffer());
    } else if (c.req.header("content-type") !== "image/jpeg") return c.json({ error: "Нужен JPG" }, 400);
    const path = await commitJpeg(bytes);
    return c.json({ path, publicUrl: path }, 201);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Ошибка загрузки" }, 400);
  }
});