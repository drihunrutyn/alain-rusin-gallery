import { storeRepositoryImage } from "../lib/remote-image-import";
import { z } from "zod";
import { asc, eq, sql } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "../database";
import * as t from "../database/schema";
import { admin } from "../lib/security";
import { seriesInput } from "../../shared/series";

export const series = {
  series: admin.handler(async () => {
    const rows = await db.select({ id: t.series.id, slug: t.series.slug, title: t.series.title, description: t.series.description, coverUrl: t.series.coverUrl, sortOrder: t.series.sortOrder, archived: t.series.archived, createdAt: t.series.createdAt, artworkCount: sql<number>`count(${t.artworks.id})` }).from(t.series).leftJoin(t.artworks, eq(t.series.slug, t.artworks.series)).groupBy(t.series.id).orderBy(asc(t.series.sortOrder), asc(t.series.id));
    return rows.map(s => ({ ...s, description: s.description || "", coverUrl: s.coverUrl || "", artworkCount: Number(s.artworkCount) }));
  }),
  saveSeries: admin.input(seriesInput).handler(async ({ input }) => {
    input.coverUrl = await storeRepositoryImage(input.coverUrl, `series-${input.id || input.slug}`);
    return db.transaction(async tx => {
    const { id, ...data } = input;
    const [existing] = await tx.select().from(t.series).where(eq(t.series.slug, data.slug));
    if (id) {
      const [row] = await tx.select().from(t.series).where(eq(t.series.id, id));
      if (!row) throw new ORPCError("NOT_FOUND");
      if (row.slug !== data.slug) throw new ORPCError("BAD_REQUEST", { message: "Slug серии нельзя изменять после создания" });
      const [updated] = await tx.update(t.series).set(data).where(eq(t.series.id, id)).returning();
      return updated!;
    }
    if (existing) throw new ORPCError("CONFLICT", { message: "Серия с таким slug уже существует" });
    const [row] = await tx.insert(t.series).values(data).returning();
    return row!;
    });
  }),
  deleteSeries: admin.input(z.object({ id: z.number().int().positive(), action: z.enum(["delete", "archive", "transfer"]).default("delete"), targetId: z.number().int().positive().optional() })).handler(async ({ input }) => db.transaction(async tx => {
    const [row] = await tx.select().from(t.series).where(eq(t.series.id, input.id));
    if (!row) throw new ORPCError("NOT_FOUND");
    const [count] = await tx.select({ count: sql<number>`count(*)` }).from(t.artworks).where(eq(t.artworks.series, row.slug));
    const n = Number(count?.count || 0);
    if (input.action === "archive") {
      await tx.update(t.series).set({ archived: true }).where(eq(t.series.id, row.id));
      return { success: true, transferred: 0, archived: true };
    }
    if (input.action === "transfer") {
      if (!input.targetId || input.targetId === input.id) throw new ORPCError("BAD_REQUEST", { message: "Выберите другую серию" });
      const [target] = await tx.select().from(t.series).where(eq(t.series.id, input.targetId));
      if (!target || target.archived) throw new ORPCError("BAD_REQUEST", { message: "Нужна существующая неархивная серия" });
      await tx.update(t.artworks).set({ series: target.slug }).where(eq(t.artworks.series, row.slug));
    } else if (n > 0) throw new ORPCError("CONFLICT", { message: `В серии ${n} работ. Перенесите работы или архивируйте серию.` });
    await tx.delete(t.series).where(eq(t.series.id, row.id));
    return { success: true, transferred: input.action === "transfer" ? n : 0, archived: false };
  })),
};
