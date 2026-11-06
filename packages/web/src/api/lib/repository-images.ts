import sharp from "sharp";
import { createHash } from "node:crypto";
import { MAX_JPEG_BYTES, MAX_IMAGE_EDGE } from "../../shared/images";
import { resolveEmbed } from "../../shared/embed";

const repo = "drihunrutyn/alain-rusin-gallery";
export async function validateJpeg(bytes: Uint8Array) {
  if (!bytes.length || bytes.length > MAX_JPEG_BYTES) throw new Error("Нужен JPG до 900 КБ");
  const meta = await sharp(bytes, { limitInputPixels: MAX_IMAGE_EDGE ** 2 }).metadata();
  if (meta.format !== "jpeg" || !meta.width || !meta.height || Math.max(meta.width, meta.height) > MAX_IMAGE_EDGE)
    throw new Error("Нужен настоящий JPG размером до 2000 px");
}

export async function commitJpeg(bytes: Uint8Array, prefix = String(Date.now())) {
  await validateJpeg(bytes);
  const token = process.env.UPLOAD_GITHUB_TOKEN;
  if (!token) throw new Error("UPLOAD_GITHUB_TOKEN не настроен на сервере");
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  const name = `${prefix.replace(/[^A-Za-z0-9_-]/g, "-")}-${hash}.jpg`;
  const path = `public/images/uploads/${name}`;
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" };
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
      method: "PUT", headers, signal: AbortSignal.timeout(30000),
      body: JSON.stringify({ message: `feat: publish JPG ${name}`, content: Buffer.from(bytes).toString("base64"), branch: "main" }),
    });
    if (response.ok) return `/images/uploads/${name}`;
    if ([409, 422].includes(response.status)) {
      // Retries are idempotent: an existing byte-identical file is already published.
      const existing = await fetch(`https://api.github.com/repos/${repo}/contents/${path}?ref=main`, { headers, signal: AbortSignal.timeout(15000) });
      if (existing.ok) {
        const data = await existing.json() as { content?: string };
        if (data.content && Buffer.from(data.content, "base64").equals(Buffer.from(bytes))) return `/images/uploads/${name}`;
        throw new Error("Конфликт имени изображения в GitHub");
      }
      continue;
    }
    throw new Error(`GitHub не принял изображение (HTTP ${response.status})`);
  }
  throw new Error("GitHub занят параллельным коммитом. Повторите загрузку.");
}

async function coverBytes(url: string) {
  // Only server-generated provider URLs; constrain redirects too (no user-controlled SSRF).
  const allowed = (s: string) => {
    const u = new URL(s);
    return u.protocol === "https:" && !u.username && !u.password && !u.port &&
      (u.hostname === "i.ytimg.com" || u.hostname === "drive.google.com" || /(^|\.)googleusercontent\.com$/.test(u.hostname));
  };
  for (let i = 0; i < 5; i++) {
    if (!allowed(url)) throw new Error("Недопустимый хост обложки");
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15000) });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Пустое перенаправление");
      url = new URL(location, url).href;
      continue;
    }
    if (!response.ok || !response.body) throw new Error(`Обложка: HTTP ${response.status}`);
    const chunks: Uint8Array[] = []; let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > 8 * 1024 * 1024) throw new Error("Обложка слишком большая");
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
  throw new Error("Слишком много перенаправлений обложки");
}

export async function automaticCover(id: string, url: string): Promise<string> {
  const media = resolveEmbed(url);
  if (!media.autoCover || !["YouTube", "Google Drive"].includes(media.provider)) return "";
  try {
    const source = await coverBytes(media.autoCover);
    let edge = MAX_IMAGE_EDGE;
    for (let i = 0; i < 8; i++) {
      const jpg = await sharp(source, { limitInputPixels: 40000000 }).rotate().flatten({ background: "#ffffff" })
        .resize(edge, edge, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
      if (jpg.length <= MAX_JPEG_BYTES) return await commitJpeg(jpg, `cover-${id}`);
      edge = Math.floor(edge * 0.8);
    }
    throw new Error("Не удалось уложить обложку в 900 КБ");
  } catch (error) {
    // Saving content is not blocked by a missing/private provider thumbnail.
    console.warn("Auto cover unavailable", id, error instanceof Error ? error.message : "download error");
    return "";
  }
}