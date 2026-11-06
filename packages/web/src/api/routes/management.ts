import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "../database";
import * as t from "../database/schema";
import { admin, settings, setSetting, validPassword } from "../lib/security";
import { artworkInput, contentInput } from "../../shared/gallery";
import { manualRequestInput, requestStatus } from "../../shared/requests";
import { series as seriesManagement } from "./series";
import { resolveEmbed } from "../../shared/embed";
import { automaticCover } from "../lib/repository-images";
import { upload as repositoryUpload } from "./upload";
import { imageInput } from "../../shared/images";
import { storeRepositoryImage } from "../lib/remote-image-import";

const itemId = z.object({ id: z.string().uuid() });
function safeUrl(value: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error();
    return url.toString();
  } catch {
    throw new ORPCError("BAD_REQUEST", { message: "Нужна безопасная HTTPS-ссылка" });
  }
}
export const management = {
  ...seriesManagement,
  rooms: admin.handler(() => db.select().from(t.rooms)),
  profile: admin.handler(async () => { const s = await settings(); return { email: s.email || "telnov.aleosch@yandex.ru", city: s.city || "Санкт-Петербург" }; }),
  artworks: admin.handler(async () => {
    const rows = await db.select().from(t.artworks).orderBy(desc(t.artworks.createdAt));
    return rows.map(a => ({ ...artworkInput.parse(a), id: a.id, createdAt: a.createdAt }));
  }),
  saveArtwork: admin.input(artworkInput).handler(async ({ input }) => {
    input.imageUrl = await storeRepositoryImage(input.imageUrl, `artwork-${input.id || crypto.randomUUID()}`);
    return db.transaction(async tx => {
    const { id, ...data } = input;
    const [s] = await tx.select().from(t.series).where(eq(t.series.slug, data.series));
    if (!s) throw new ORPCError("BAD_REQUEST", { message: "Выберите существующую серию" });
    if (s.archived) {
      const [old] = id ? await tx.select().from(t.artworks).where(eq(t.artworks.id, id)) : [];
      if (!old || old.series !== s.slug) throw new ORPCError("BAD_REQUEST", { message: "Нельзя добавлять работы в архивную серию" });
    }
    if (id) {
      const [row] = await tx.update(t.artworks).set(data).where(eq(t.artworks.id, id)).returning();
      if (!row) throw new ORPCError("NOT_FOUND");
      return row;
    }
    const [row] = await tx.insert(t.artworks).values(data).returning();
    return row!;
    });
  }),
  deleteArtwork: admin.input(itemId).handler(async ({ input }) => {
    await db.delete(t.artworks).where(eq(t.artworks.id, input.id));
    return { success: true };
  }),
  content: admin.handler(() => db.select().from(t.content).orderBy(desc(t.content.createdAt))),
  saveContent: admin.input(contentInput).handler(async ({ input }) => {
    const { id, ...data } = input;
    const recordId = id || crypto.randomUUID();
    data.link = safeUrl(data.link);
    if (data.embedUrl && !resolveEmbed(data.embedUrl).src) throw new ORPCError("BAD_REQUEST", { message: "Нужна корректная HTTP(S)-ссылка на видео" });
    data.imageUrl = await storeRepositoryImage(data.imageUrl, `content-${recordId}`);
    data.coverUrl = await storeRepositoryImage(data.coverUrl, `cover-${recordId}`);
    // Store the original URL, not the provider's player URL.
    if (!data.coverUrl) {
      const videoUrl = data.embedUrl || data.link;
      data.coverUrl = resolveEmbed(videoUrl).autoCover ? await automaticCover(recordId, videoUrl) : data.imageUrl;
    }
    if (id) {
      const [row] = await db.update(t.content).set(data).where(eq(t.content.id, id)).returning();
      if (!row) throw new ORPCError("NOT_FOUND");
      return row;
    }
    const [row] = await db.insert(t.content).values({ ...data, id: recordId }).returning();
    return row!;
  }),
  deleteContent: admin.input(itemId).handler(async ({ input }) => {
    await db.delete(t.content).where(eq(t.content.id, input.id));
    return { success: true };
  }),
  requests: admin.handler(() => db.select().from(t.requests).orderBy(desc(t.requests.createdAt))),
  createRequest: admin.input(manualRequestInput).handler(async ({ input }) => {
    const [artwork] = await db.select().from(t.artworks).where(eq(t.artworks.id, input.artworkId));
    if (!artwork) throw new ORPCError("NOT_FOUND", { message: "Работа больше не существует. Обновите список." });
    const [row] = await db.insert(t.requests).values({ ...input, artworkTitle: artwork.title, message: "Добавлена вручную из почты/VK" }).returning();
    return row!;
  }),
  processRequest: admin
    .input(z.object({ id: z.string().uuid(), status: requestStatus }))
    .handler(async ({ input }) => {
      const [row] = await db.update(t.requests).set({ status: input.status }).where(eq(t.requests.id, input.id)).returning();
      if (!row) throw new ORPCError("NOT_FOUND");
      return { success: true };
    }),
  stats: admin.handler(async () => {
    const [works, requests, views, subscriptions] = await Promise.all([
      db.select().from(t.artworks),
      db.select().from(t.requests).orderBy(desc(t.requests.createdAt)),
      db.select().from(t.pageViews),
      db.select().from(t.subscribers),
    ]);
    const now = new Date();
    const cutoff = new Date(now.getTime() - 30 * 86400000).toISOString();
    const days = Array.from({ length: 30 }, (_, i) => {
      const key = new Date(now.getTime() - (29 - i) * 86400000).toISOString().slice(0, 10);
      return { label: key, count: views.filter((v) => v.viewedAt.startsWith(key)).length };
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
        views: views.filter((v) => v.artworkId === a.id).length,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);
    return {
      available: works.filter((a) => a.status === "available").length,
      newRequests: requests.filter((r) => r.status === "new").length,
      views30: views.filter((v) => v.viewedAt >= cutoff).length,
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
      await setSetting(
        "password_hash",
        await Bun.password.hash(input.newPassword, { algorithm: "argon2id" }),
      );
      await setSetting("session_version", crypto.randomUUID());
      return { success: true };
    }),
  upload: repositoryUpload,
  saveRoom: admin.input(z.object({ imageUrl: imageInput.refine(Boolean) })).handler(async ({ input }) => {
    const [r] = await db
      .insert(t.rooms)
      .values({ imageUrl: await storeRepositoryImage(input.imageUrl, `room-${crypto.randomUUID()}`) })
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
