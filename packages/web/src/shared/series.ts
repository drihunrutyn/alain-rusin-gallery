import { z } from "zod";
import { isPublicImagePath } from "./images";

export const seriesInput = z.object({
  id: z.number().int().positive().optional(),
  slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:[_-][a-z0-9]+)*$/, "Slug: латинские строчные буквы, цифры, _ или -"),
  title: z.string().trim().min(1).max(300),
  description: z.string().max(10000).default(""),
  coverUrl: z.string().max(2000).default("").refine(v => !v || isPublicImagePath(v), "Нужен JPG по пути /images/…"),
  sortOrder: z.number().int().min(0).max(100000).default(0),
  archived: z.boolean().default(false),
});
export type SeriesData = z.infer<typeof seriesInput> & { id: number; createdAt: number };
export const visibleSeries = (rows: SeriesData[]) => rows.filter(s => !s.archived).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
export const catalogOrder = <T extends { series: string }>(works: T[], rows: SeriesData[]) => visibleSeries(rows).flatMap(s => works.filter(a => a.series === s.slug));
