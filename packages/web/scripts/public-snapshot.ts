import { inArray, desc, asc, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { artworkInput, contentInput } from "../src/shared/gallery";
import { isPublicImagePath } from "../src/shared/images";
import { seriesInput } from "../src/shared/series";
import type { PublicSnapshot } from "../src/shared/public-data";

function publicImage(value: string) {
  if (value && !isPublicImagePath(value)) throw new Error("Public images must be repository JPG paths /images/…");
}
export function snapshotHash(snapshot: PublicSnapshot) {
  const { builtAt: _, ...data } = snapshot;
  return createHash("sha256").update(JSON.stringify(data)).digest("hex");
}
export async function readPublicSnapshot(): Promise<PublicSnapshot> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required; never substitute seed data");
  const { db } = await import("../src/api/database");
  const t = await import("../src/api/database/schema");
  const [works, media, rooms, series, profileRows] = await Promise.all([
    db.select().from(t.artworks).orderBy(desc(t.artworks.createdAt), asc(t.artworks.id)),
    db.select().from(t.content).orderBy(desc(t.content.createdAt), asc(t.content.id)),
    db.select().from(t.rooms).orderBy(asc(t.rooms.id)),
    db.select().from(t.series).where(eq(t.series.archived, false)).orderBy(asc(t.series.sortOrder), asc(t.series.id)),
    db.select({ key: t.adminSettings.key, value: t.adminSettings.value }).from(t.adminSettings).where(inArray(t.adminSettings.key, ["email", "city"])).orderBy(asc(t.adminSettings.key)),
  ]);
  const profile = Object.fromEntries(profileRows.map(r => [r.key, r.value]));
  const active = new Set(series.map(s => s.slug));
  return {
    artworks: works.filter(a => active.has(a.series)).map(a => { publicImage(a.imageUrl); return { ...artworkInput.parse(a), id: a.id, createdAt: a.createdAt }; }),
    content: media.map(c => { publicImage(c.imageUrl); publicImage(c.coverUrl); return { ...contentInput.parse(c), id: c.id, createdAt: c.createdAt }; }),
    rooms: rooms.map(r => { publicImage(r.imageUrl); return r; }),
    series: series.map(s => { publicImage(s.coverUrl || ""); return { ...seriesInput.parse({ ...s, description: s.description || "", coverUrl: s.coverUrl || "" }), id: s.id, createdAt: s.createdAt }; }),
    profile: { email: profile.email || "telnov.aleosch@yandex.ru", city: profile.city || "Санкт-Петербург" },
    builtAt: new Date().toISOString(),
  };
}
