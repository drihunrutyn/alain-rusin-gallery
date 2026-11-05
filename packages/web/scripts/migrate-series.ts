import { createClient } from "@libsql/client";
import { readFile } from "node:fs/promises";

if (!process.env.DATABASE_URL || (!process.env.DATABASE_URL.startsWith("file:") && !process.env.DATABASE_MIGRATION_AUTH_TOKEN)) throw new Error("Migration requires DATABASE_URL and DATABASE_MIGRATION_AUTH_TOKEN");
const client = createClient({ url: process.env.DATABASE_URL, authToken: process.env.DATABASE_MIGRATION_AUTH_TOKEN });
const sql = await readFile(new URL("../drizzle/0001_series.sql", import.meta.url), "utf8");
const tx = await client.transaction("write");
try {
  for (const statement of sql.split(";").map(s => s.trim()).filter(Boolean)) await tx.execute(statement);
  const unknown = await tx.execute("SELECT DISTINCT a.series FROM artworks a LEFT JOIN series s ON s.slug = a.series WHERE s.id IS NULL");
  if (unknown.rows.length) throw new Error("Existing artwork has unknown series; review before migration");
  await tx.commit();
  console.log("Additive series migration committed; artworks/requests/subscribers unchanged.");
} catch (e) { await tx.rollback(); throw e; } finally { client.close(); }
