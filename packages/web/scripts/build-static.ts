import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "vite";
import { inArray, desc } from "drizzle-orm";
import { artworkInput, contentInput } from "../src/shared/gallery";
import { routeMetadata } from "../src/shared/metadata";
import type { PublicSnapshot } from "../src/shared/public-data";

const root = path.resolve(import.meta.dirname, "../../..");
const web = path.join(root, "packages/web");
const out = path.join(root, "out");
const staging = path.join(root, ".build");
const serverBuild = path.join(web, ".build/ssr");
const base = process.env.PAGES_BASE_PATH || "/alain-rusin-gallery/";
if (!/^\/(?:[A-Za-z0-9._-]+\/)*$/.test(base)) throw new Error("PAGES_BASE_PATH must start and end with / and contain safe path segments");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required: static build reads the live catalog, never substitutes seed data");
const site = (process.env.PUBLIC_SITE_URL || "https://drihunrutyn.github.io/alain-rusin-gallery").replace(/\/$/, "");
if (new URL(site).protocol !== "https:") throw new Error("PUBLIC_SITE_URL must use HTTPS");
process.env.PAGES_BASE_PATH = base;
process.env.PUBLIC_SITE_URL = site;

// This module is imported only by the build process, never by browser code.
const { db } = await import("../src/api/database");
const t = await import("../src/api/database/schema");
const [artworks, content, rooms, profileRows] = await Promise.all([
  db.select().from(t.artworks).orderBy(desc(t.artworks.createdAt)),
  db.select().from(t.content).orderBy(desc(t.content.createdAt)),
  db.select().from(t.rooms),
  // Fetch only the public keys. Session versions and password hashes are never selected.
  db.select({ key: t.adminSettings.key, value: t.adminSettings.value }).from(t.adminSettings).where(inArray(t.adminSettings.key, ["email", "city"])),
]);
function publicImage(value: string) {
  if (!value) return;
  if (value.startsWith("/images/") && !value.split("/").includes("..")) return;
  if (value.startsWith("https://") && !new URL(value).pathname.startsWith("/api/")) return;
  throw new Error("Image must be a direct HTTPS storage URL or /images/ asset (no API proxy)");
}
const profile = Object.fromEntries(profileRows.map(r => [r.key, r.value]));
const snapshot: PublicSnapshot = {
  artworks: artworks.map(a => { publicImage(a.imageUrl); return { ...artworkInput.parse(a), id: a.id, createdAt: a.createdAt }; }),
  content: content.map(c => { publicImage(c.imageUrl); return { ...contentInput.parse(c), id: c.id, createdAt: c.createdAt }; }),
  rooms: rooms.map(r => { publicImage(r.imageUrl); return { id: r.id, imageUrl: r.imageUrl, createdAt: r.createdAt }; }),
  profile: { email: profile.email || "telnov.aleosch@yandex.ru", city: profile.city || "Санкт-Петербург" },
  builtAt: new Date().toISOString(),
};
await mkdir(staging, { recursive: true });
await writeFile(path.join(staging, "snapshot.json"), JSON.stringify(snapshot).replace(/</g, "\\u003c"));
// Do not destroy the previous successful out until the database snapshot validates.
await rm(out, { recursive: true, force: true });
await build({ root: web, configFile: path.join(web, "vite.config.ts"), mode: "static", build: { outDir: out, emptyOutDir: true } });
await build({ root: web, configFile: path.join(web, "vite.config.ts"), mode: "static", build: {
  ssr: path.join(web, "src/web/static-render.tsx"), outDir: serverBuild, emptyOutDir: true,
  rollupOptions: { output: { entryFileNames: "render.mjs" } },
} });
const { render } = await import(pathToFileURL(path.join(serverBuild, "render.mjs")).href);
const template = await readFile(path.join(out, "index.html"), "utf8");
const escape = (v: string) => v.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const routes = [...Object.keys(routeMetadata), ...snapshot.artworks.map(a => `/artwork/${a.id}`)];
const canonical = (route: string) => site + (route === "/" ? "/" : route + "/");
for (const route of [...routes, "/404"]) {
  const a = snapshot.artworks.find(a => route === `/artwork/${a.id}`);
  const meta = a ? { title: a.title + " — Alain Rusin", description: a.description } : routeMetadata[route] || { title: "Этот зал временно на реставрации — Alain Rusin", description: "Страница не найдена" };
  const jsonLd = a ? { "@context": "https://schema.org", "@type": "VisualArtwork", name: a.title, description: a.description, image: a.imageUrl.startsWith("/") ? new URL(base + a.imageUrl.slice(1), site).href : a.imageUrl, artMedium: a.technique, artist: { "@type": "Person", name: "Алексей Русин" }, url: canonical(route) } : route === "/about" ? { "@context": "https://schema.org", "@type": "Person", name: "Алексей Русин", alternateName: "Alain Rusin", url: site } : undefined;
  const extra = `<link rel="canonical" href="${escape(canonical(route))}"><meta property="og:title" content="${escape(meta.title)}"><meta property="og:description" content="${escape(meta.description)}"><meta property="og:url" content="${escape(canonical(route))}"><meta property="og:type" content="website">${route === "/404" ? '<meta name="robots" content="noindex">' : ""}${jsonLd ? `<script type="application/ld+json" id="page-jsonld">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>` : ""}`;
  const html = template.replace(/<title>.*?<\/title>/, `<title>${escape(meta.title)}</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${escape(meta.description)}">`)
    .replace(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${escape(a ? (a.imageUrl.startsWith('/') ? new URL(base + a.imageUrl.slice(1), site).href : a.imageUrl) : new URL(base + 'images/og.jpg', site).href)}">`)
    .replace('</head>', extra + '</head>')
    .replace('<div id="root"></div>', `<div id="root">${render(route)}</div>`);
  const file = route === "/404" ? path.join(out, "404.html") : path.join(out, route.slice(1), "index.html");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, html);
}
await writeFile(path.join(out, ".nojekyll"), "");
await writeFile(path.join(out, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: ${base}admin\nSitemap: ${site}/sitemap.xml\n`);
await writeFile(path.join(out, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map(r => `<url><loc>${escape(canonical(r))}</loc></url>`).join("")}</urlset>`);
console.log(`Static storefront ready: ${routes.length} prerendered public routes in ${out}. Admin not exported.`);