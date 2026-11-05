import { afterAll, beforeAll, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { AppRouterClient } from "../src/api";
import { readPublicSnapshot } from "../scripts/public-snapshot";
import { catalogOrder } from "../src/shared/series";

let folder: string;
let app: typeof import("../src/api").default;
let cookie: string;
let admin: AppRouterClient;
let anonymous: AppRouterClient;
const artworkId = "00000000-0000-4000-8000-000000000001";
const original = { url: process.env.DATABASE_URL, auth: process.env.DATABASE_AUTH_TOKEN, secret: process.env.AUTH_SECRET, login: process.env.ADMIN_LOGIN, node: process.env.NODE_ENV, website: process.env.WEBSITE_URL };
beforeAll(async () => {
  folder = await mkdtemp(tmpdir() + "/rusin-test-");
  process.env.DATABASE_URL = "file:" + folder + "/test.db";
  delete process.env.DATABASE_AUTH_TOKEN;
  process.env.AUTH_SECRET = "test-only-secret-32-characters-long-do-not-deploy";
  process.env.ADMIN_LOGIN = "test-admin";
  process.env.NODE_ENV = "production";
  process.env.WEBSITE_URL = "https://admin.example.test";
  const db = new Database(folder + "/test.db");
  db.exec(`CREATE TABLE admin_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE artworks (id TEXT PRIMARY KEY, title TEXT NOT NULL, series TEXT NOT NULL, technique TEXT NOT NULL DEFAULT '', year INTEGER NOT NULL DEFAULT 2025, dimensions TEXT NOT NULL DEFAULT '', framing TEXT NOT NULL DEFAULT '', price REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'available', description TEXT NOT NULL DEFAULT '', image_url TEXT NOT NULL, is_featured INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
    CREATE TABLE requests (id TEXT PRIMARY KEY, client_name TEXT NOT NULL, client_contact TEXT NOT NULL, artwork_id TEXT REFERENCES artworks(id) ON DELETE SET NULL, artwork_title TEXT NOT NULL DEFAULT '', message TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'new', created_at TEXT NOT NULL);`);
  db.exec(`CREATE TABLE content (id TEXT PRIMARY KEY, type TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', link TEXT NOT NULL DEFAULT '', embed_url TEXT NOT NULL DEFAULT '', image_url TEXT NOT NULL DEFAULT '', location TEXT NOT NULL DEFAULT '', event_date TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
    CREATE TABLE rooms (id TEXT PRIMARY KEY, image_url TEXT NOT NULL, created_at TEXT NOT NULL);`);
  const migration = await Bun.file(new URL("../drizzle/0001_series.sql", import.meta.url)).text();
  db.exec(migration);
  db.exec(migration);
  expect(db.query("SELECT count(*) AS n FROM series").get()).toMatchObject({ n: 4 });
  db.query("INSERT INTO artworks(id,title,series,image_url,created_at) VALUES(?,?,?,?,?)").run(artworkId, "Работа из базы", "aquatica", "/images/seeds/aquatika.jpg", "2026-11-02T00:00:00.000Z");
  db.close();
  app = (await import("../src/api")).default;
  const { makeSession } = await import("../src/api/lib/security");
  cookie = "rusin_session=" + await makeSession();
  function client(headers: Record<string, string> = {}) {
    return createORPCClient<AppRouterClient>(new RPCLink({ url: "https://admin.example.test/api/rpc", headers, fetch: (input, init) => app.fetch(new Request(input, init)) }));
  }
  anonymous = client();
  admin = client({ Cookie: cookie, Origin: "https://admin.example.test" });
});
afterAll(async () => {
  for (const [key, v] of Object.entries({ DATABASE_URL: original.url, DATABASE_AUTH_TOKEN: original.auth, AUTH_SECRET: original.secret, ADMIN_LOGIN: original.login, NODE_ENV: original.node, WEBSITE_URL: original.website })) {
    if (v === undefined) delete process.env[key]; else process.env[key] = v;
  }
  if (folder) await rm(folder, { recursive: true, force: true });
});
test("manual creation is forbidden without an admin session", async () => {
  expect(anonymous.management.createRequest({ clientName: "Клиент", clientContact: "email", artworkId })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
});
test("authenticated create stores artwork title from database and all four statuses", async () => {
  for (const status of ["new", "in_progress", "sold", "cancelled"] as const) {
    const row = await admin.management.createRequest({ clientName: "Клиент", clientContact: "client@example.org", artworkId, status });
    expect(row.artworkTitle).toBe("Работа из базы");
    expect(row.status).toBe(status);
    await admin.management.processRequest({ id: row.id, status: "in_progress" });
    expect((await admin.management.requests()).find(r => r.id === row.id)?.status).toBe("in_progress");
  }
});
test("missing artwork and missing request are rejected", async () => {
  await expect(admin.management.createRequest({ clientName: "Клиент", clientContact: "client", artworkId: "00000000-0000-4000-8000-000000000099", status: "new" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(admin.management.processRequest({ id: "00000000-0000-4000-8000-000000000099", status: "sold" })).rejects.toMatchObject({ code: "NOT_FOUND" });
});
test("admin mutations reject a foreign browser origin", async () => {
  const foreign = createORPCClient<AppRouterClient>(new RPCLink({ url: "https://admin.example.test/api/rpc", headers: { Cookie: cookie, Origin: "https://foreign.example.test" }, fetch: (input, init) => app.fetch(new Request(input, init)) }));
  await expect(foreign.management.createRequest({ clientName: "Клиент", clientContact: "client", artworkId, status: "new" })).rejects.toMatchObject({ code: "FORBIDDEN" });
});
test("old public catalog and request endpoints are gone", async () => {
  for (const route of ["artworks", "artwork", "content", "rooms", "profile", "request"]) {
    const r = await app.fetch(new Request(`https://admin.example.test/api/rpc/gallery/${route}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ json: {} }) }));
    expect(r.status).toBe(404);
  }
});
test("series CRUD, immutable slug, integrity, transfer and archive are transactional", async () => {
  await expect(anonymous.management.series()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  const seeded = await admin.management.series();
  expect(seeded.map(s => s.slug)).toEqual(["aquatica", "quiet_life", "iris_flowers", "northern_palmyra"]);
  expect(seeded[0]?.artworkCount).toBe(1);
  const s = await admin.management.saveSeries({ slug: "qa_new", title: "Новая серия", sortOrder: 5, coverUrl: "https://example.org/cover.jpg" });
  await expect(admin.management.saveSeries({ slug: "qa_new", title: "Дубликат" })).rejects.toMatchObject({ code: "CONFLICT" });
  await expect(admin.management.saveSeries({ ...s, slug: "different", description: s.description || "", coverUrl: s.coverUrl || "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  const renamed = await admin.management.saveSeries({ ...s, title: "Переименована", description: s.description || "", coverUrl: s.coverUrl || "" });
  expect(renamed.slug).toBe("qa_new");
  await expect(admin.management.saveArtwork({ title: "Неизвестная серия", series: "missing", imageUrl: "/images/seeds/aquatika.jpg" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  const work = await admin.management.saveArtwork({ title: "Проверочная работа", series: "qa_new", imageUrl: "/images/seeds/aquatika.jpg" });
  let snapshot = await readPublicSnapshot();
  expect(snapshot.series.find(row => row.slug === "qa_new")?.title).toBe("Переименована");
  expect(catalogOrder(snapshot.artworks, snapshot.series).some(a => a.id === work.id)).toBe(true);
  await expect(admin.management.deleteSeries({ id: s.id })).rejects.toMatchObject({ code: "CONFLICT" });
  expect((await admin.management.artworks()).find(a => a.id === work.id)?.series).toBe("qa_new");
  await admin.management.deleteSeries({ id: s.id, action: "archive" });
  snapshot = await readPublicSnapshot();
  expect(snapshot.series.some(row => row.slug === "qa_new")).toBe(false);
  expect(catalogOrder(snapshot.artworks, snapshot.series).some(a => a.id === work.id)).toBe(false);
  await expect(admin.management.saveArtwork({ title: "Архив", series: "qa_new", imageUrl: "/images/seeds/aquatika.jpg" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  await admin.management.deleteSeries({ id: s.id, action: "transfer", targetId: seeded[1]!.id });
  expect((await admin.management.artworks()).find(a => a.id === work.id)).toMatchObject({ id: work.id, series: "quiet_life" });
  expect((await admin.management.series()).some(row => row.id === s.id)).toBe(false);
  const empty = await admin.management.saveSeries({ slug: "qa_empty", title: "Пустая" });
  await admin.management.deleteSeries({ id: empty.id });
  expect((await admin.management.series()).some(row => row.id === empty.id)).toBe(false);
});
test("content stores original arbitrary HTTP(S) URLs and external covers without migration", async () => {
  const url = "https://youtu.be/dQw4w9WgXc?t=42";
  const c = await admin.management.saveContent({ type: "interview", title: "QA", embedUrl: url, imageUrl: "https://example.org/cover.jpg" });
  expect(c.embedUrl).toBe(url);
  expect(c.imageUrl).toBe("https://example.org/cover.jpg");
  const drive = await admin.management.saveContent({ type: "interview", title: "Drive", embedUrl: "https://drive.google.com/file/d/test_drive_id/view" });
  expect(drive.embedUrl).toBe("https://drive.google.com/file/d/test_drive_id/view");
  await expect(admin.management.saveContent({ type: "interview", title: "XSS", embedUrl: "javascript:alert(1)" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  const legacy = await admin.management.saveContent({ type: "interview", title: "VK", embedUrl: "https://vk.com/video_ext.php?oid=-30015658&id=456242764" });
  expect(legacy.embedUrl).toBe("https://vk.com/video_ext.php?oid=-30015658&id=456242764");
  const unknown = await admin.management.saveContent({ type: "interview", title: "Other", embedUrl: "https://example.org/watch/123" });
  expect(unknown.embedUrl).toBe("https://example.org/watch/123");
});
test("public snapshot excludes secrets and personal tables; publish endpoint does not exist", async () => {
  const { db } = await import("../src/api/database");
  const { adminSettings } = await import("../src/api/database/schema");
  await db.insert(adminSettings).values({ key: "password_hash", value: "NEVER_EXPORT_THIS" });
  const snapshot = await readPublicSnapshot();
  expect(JSON.stringify(snapshot)).not.toContain("NEVER_EXPORT_THIS");
  expect(Object.keys(snapshot).sort()).toEqual(["artworks", "builtAt", "content", "profile", "rooms", "series"]);
  const r = await app.fetch(new Request("https://admin.example.test/api/rpc/management/rebuild", { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: '{"json":{}}' }));
  expect(r.status).toBe(404);
});