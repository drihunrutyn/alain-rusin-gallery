import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { db } from "../database/client";
import * as t from "../database/schema";
import { admin, settings, setSetting, validPassword, revokeAllSessions } from "../lib/security";
import { hashPassword } from "../lib/password";
import { metricSnapshot } from "../lib/kv";
import { artworkInput, contentInput } from "../../shared/gallery";

const itemId = z.object({ id: z.string().uuid() });
function safeUrl(value: string, embed = false) {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") throw new Error();
    if (
      embed &&
      !["vk.com", "www.youtube.com", "www.youtube-nocookie.com", "player.vimeo.com"].includes(
        url.hostname,
      )
    )
      throw new Error();
    return url.toString();
  } catch {
    throw new ORPCError("BAD_REQUEST", { message: "Нужна безопасная HTTPS-ссылка" });
  }
}
function videoEmbed(value: string) {
  const match = value.match(/video(-?\d+)_(\d+)/);
  return match
    ? `https://vk.com/video_ext.php?oid=${match[1]}&id=${match[2]}`
    : safeUrl(value, true);
}
export const management = {
  artworks: admin.handler(() => db.select().from(t.artworks).orderBy(desc(t.artworks.createdAt))),
  saveArtwork: admin.input(artworkInput).handler(async ({ input }) => {
    const { id, ...data } = input;
    if (id) {
      const [row] = await db.update(t.artworks).set(data).where(eq(t.artworks.id, id)).returning();
      if (!row) throw new ORPCError("NOT_FOUND");
      return row;
    }
    const [row] = await db.insert(t.artworks).values(data).returning();
    return row!;
  }),
  deleteArtwork: admin.input(itemId).handler(async ({ input }) => {
    await db.delete(t.artworks).where(eq(t.artworks.id, input.id));
    return { success: true };
  }),
  content: admin.handler(() => db.select().from(t.content).orderBy(desc(t.content.createdAt))),
  saveContent: admin.input(contentInput).handler(async ({ input }) => {
    const { id, ...data } = input;
    data.link = safeUrl(data.link);
    data.embedUrl = videoEmbed(data.embedUrl);
    data.imageUrl = data.imageUrl ? safeUrl(data.imageUrl) : "";
    if (id) {
      const [row] = await db.update(t.content).set(data).where(eq(t.content.id, id)).returning();
      return row!;
    }
    const [row] = await db.insert(t.content).values(data).returning();
    return row!;
  }),
  deleteContent: admin.input(itemId).handler(async ({ input }) => {
    await db.delete(t.content).where(eq(t.content.id, input.id));
    return { success: true };
  }),
  requests: admin.handler(() => db.select().from(t.requests).orderBy(desc(t.requests.createdAt))),
  processRequest: admin
    .input(z.object({ id: z.string().uuid(), status: z.enum(["new", "processed"]) }))
    .handler(async ({ input }) => {
      await db.update(t.requests).set({ status: input.status }).where(eq(t.requests.id, input.id));
      return { success: true };
    }),
  stats: admin.handler(async () => {
    const [works, requests, views, subscriptions] = await Promise.all([
      db.select().from(t.artworks),
      db.select().from(t.requests).orderBy(desc(t.requests.createdAt)),
      metricSnapshot(),
      db.select().from(t.subscribers),
    ]);
    const now = new Date();
    const days = Array.from({ length: 30 }, (_, i) => {
      const key = new Date(now.getTime() - (29 - i) * 86400000).toISOString().slice(0, 10);
      return { label: key, count: views.days[key] ?? 0 };
    });
    const months = Array.from({ length: 6 }, (_, i) => {
      const key = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 1))
        .toISOString()
        .slice(0, 7);
      return { label: key, count: requests.filter((r) => r.createdAt.startsWith(key)).length };
    });
    const top = works
      .map((a) => ({
        id: a.id,
        title: a.title,
        views: views.artworks[a.id] ?? 0,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);
    return {
      available: works.filter((a) => a.status === "available").length,
      newRequests: requests.filter((r) => r.status === "new").length,
      views30: days.reduce((sum, day) => sum + day.count, 0),
      subscribers: subscriptions.length,
      days,
      months,
      top,
      recent: requests.slice(0, 6),
    };
  }),
  settings: admin.handler(async () => {
    const s = await settings();
    return {
      email: s.email ?? "",
      city: s.city ?? "Санкт-Петербург",
      telegramConfigured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    };
  }),
  saveSettings: admin
    .input(
      z.object({
        email: z.union([z.literal(""), z.string().email()]),
        city: z.string().min(1).max(100),
      }),
    )
    .handler(async ({ input }) => {
      await setSetting("email", input.email);
      await setSetting("city", input.city);
      return { success: true };
    }),
  password: admin
    .input(
      z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(12).max(300) }),
    )
    .handler(async ({ input }) => {
      if (!(await validPassword(process.env.ADMIN_LOGIN ?? "", input.currentPassword)))
        throw new ORPCError("BAD_REQUEST", { message: "Текущий пароль неверен" });
      await setSetting("password_hash", await hashPassword(input.newPassword));
      await revokeAllSessions(crypto.randomUUID());
      return { success: true };
    }),
  upload: admin
    .input(
      z.object({
        filename: z.string().max(200),
        contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
        size: z.number().max(20000000),
        type: z.enum(["artworks", "content", "rooms"]),
      }),
    )
    .handler(async ({ input }) => {
      const s3 = new S3Client({
        region: "auto",
        endpoint: process.env.S3_ENDPOINT,
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID!,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
        },
      });
      const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[
        input.contentType
      ];
      const key = `${input.type}/${crypto.randomUUID()}.${ext}`;
      const url = await getSignedUrl(
        s3,
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: key,
          ContentType: input.contentType,
          ACL: "public-read",
        }),
        { expiresIn: 600, signableHeaders: new Set(["x-amz-acl"]) },
      );
      return { url, key, publicUrl: `https://${process.env.S3_BUCKET}.t3.tigrisfiles.io/${key}` };
    }),
  saveRoom: admin.input(z.object({ imageUrl: z.string().url() })).handler(async ({ input }) => {
    const [r] = await db
      .insert(t.rooms)
      .values({ imageUrl: safeUrl(input.imageUrl) })
      .returning();
    return r!;
  }),
  deleteRoom: admin.input(itemId).handler(async ({ input }) => {
    await db.delete(t.rooms).where(eq(t.rooms.id, input.id));
    return { success: true };
  }),
  subscribers: admin.handler(() =>
    db.select().from(t.subscribers).orderBy(desc(t.subscribers.createdAt)),
  ),
};
