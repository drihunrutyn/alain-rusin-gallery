import { db } from "../src/api/database";
import { artworks, content } from "../src/api/database/schema";
import { seedArtworks, seedContent } from "../src/shared/gallery";
for (const item of seedArtworks) await db.insert(artworks).values(item).onConflictDoNothing();
for (const item of seedContent) await db.insert(content).values(item).onConflictDoNothing();
console.log("Начальные работы и контент добавлены без перезаписи существующих записей.");