import { z } from "zod";
import { eq, desc, asc } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { base } from "../__core/app";
import { db } from "../database";
import * as tables from "../database/schema";
import { session, settings, throttle } from "../lib/security";
import { artworkInput } from "../../shared/gallery";

export const gallery = {
  series: base.handler(async () => (await db.select().from(tables.series).where(eq(tables.series.archived, false)).orderBy(asc(tables.series.sortOrder), asc(tables.series.id))).map(s => ({ ...s, description: s.description || "", coverUrl: s.coverUrl || "" }))),
  artworks: base.handler(async () => {
    const active = await db.select({ slug: tables.series.slug }).from(tables.series).where(eq(tables.series.archived, false));
    const slugs = new Set(active.map(s => s.slug));
    return (await db.select().from(tables.artworks).orderBy(desc(tables.artworks.createdAt))).filter(a => slugs.has(a.series)).map(a => ({ ...artworkInput.parse(a), id: a.id, createdAt: a.createdAt }));
  }),
  artwork: base.input(z.object({ id: z.string().uuid() })).handler(async ({ input }) => {
    const [item] = await db.select().from(tables.artworks).where(eq(tables.artworks.id, input.id));
    if (!item) throw new ORPCError("NOT_FOUND", { message: "Работа не найдена" });
    return { ...artworkInput.parse(item), id: item.id, createdAt: item.createdAt };
  }),
  content: base.handler(() =>
    db.select().from(tables.content).orderBy(desc(tables.content.createdAt)),
  ),
  rooms: base.handler(() => db.select().from(tables.rooms)),
  profile: base.handler(async () => {
    const s = await settings();
    return { email: s.email ?? "", city: s.city ?? "Санкт-Петербург" };
  }),
  me: base.handler(({ context }) => session(context.headers)),
  request: base
    .input(
      z.object({
        clientName: z.string().trim().min(2).max(150),
        clientContact: z.string().trim().min(5).max(200),
        artworkId: z.string().uuid().optional(),
        message: z.string().max(5000).default(""),
        consent: z.literal(true),
        website: z.string().max(0).default(""),
      }),
    )
    .handler(async ({ input, context }) => {
      throttle(context.headers, "request", 10);
      let title = "";
      if (input.artworkId) {
        const [a] = await db
          .select()
          .from(tables.artworks)
          .where(eq(tables.artworks.id, input.artworkId));
        if (!a) throw new ORPCError("NOT_FOUND");
        title = a.title;
      }
      const [record] = await db
        .insert(tables.requests)
        .values({
          clientName: input.clientName,
          clientContact: input.clientContact,
          message: input.message,
          artworkId: input.artworkId,
          artworkTitle: title,
        })
        .returning();
      let notification = "not_configured";
      if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
        try {
          const res = await fetch(
            `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: process.env.TELEGRAM_CHAT_ID,
                text: `Новая заявка\n${input.clientName}\n${input.clientContact}\n${title || "Без выбора работы"}\n${input.message}`,
              }),
              signal: AbortSignal.timeout(8000),
            },
          );
          notification = res.ok ? "sent" : "failed";
        } catch {
          notification = "failed";
        }
      }
      return { id: record!.id, notification };
    }),
  subscribe: base
    .input(z.object({ email: z.string().trim().email().max(250), consent: z.literal(true) }))
    .handler(async ({ input, context }) => {
      throttle(context.headers, "subscribe", 10);
      await db
        .insert(tables.subscribers)
        .values({ email: input.email.toLowerCase() })
        .onConflictDoNothing();
      return { success: true };
    }),
  view: base
    .input(
      z.object({
        route: z.string().startsWith("/").max(500),
        artworkId: z.string().uuid().optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      throttle(context.headers, "view", 250);
      if (!input.route.startsWith("/admin")) await db.insert(tables.pageViews).values(input);
      return { success: true };
    }),
};
