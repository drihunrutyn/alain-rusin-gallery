import { createClient } from "@libsql/client/http";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const url = (process.env.DATABASE_URL ?? "").replace(/^libsql:/, "https:");
if (!url.startsWith("https://")) throw new Error("DATABASE_URL must point to external Turso HTTPS");
export const db = drizzle(createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN }), {
  schema,
});
