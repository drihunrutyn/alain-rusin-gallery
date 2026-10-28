import app from "./api";
import { db } from "./api/database";
import { artworks } from "./api/database/schema";
import { eq } from "drizzle-orm";
import { session } from "./api/lib/security";
import { routeMetadata } from "./shared/metadata";

const dist = `${import.meta.dirname}/../dist`;
const escape = (v: string) =>
  v.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path.startsWith("/api/")) {
        if (path.startsWith("/api/admin/") && !(await session(request.headers)))
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        return app.fetch(request);
      }
      const base = (process.env.WEBSITE_URL || url.origin).replace(/\/$/, "");
      if (path === "/robots.txt")
        return new Response(
          `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api\nSitemap: ${base}/sitemap.xml\n`,
          { headers: { "Content-Type": "text/plain" } },
        );
      if (path === "/sitemap.xml") {
        const rows = await db.select().from(artworks);
        const routes = [...Object.keys(routeMetadata), ...rows.map((a) => `/artwork/${a.id}`)];
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map((r) => `<url><loc>${escape(base + r)}</loc></url>`).join("")}</urlset>`,
          { headers: { "Content-Type": "application/xml" } },
        );
      }
      if (path.startsWith("/admin") && path !== "/admin/login" && !(await session(request.headers)))
        return new Response(null, {
          status: 302,
          headers: { Location: "/admin/login", "Cache-Control": "no-store" },
        });
      const clean = decodeURIComponent(path).replace(/^\/+/, "");
      if (clean.split("/").includes("..")) return new Response("Not found", { status: 404 });
      const file = Bun.file(`${dist}/${clean}`);
      if (clean && (await file.exists()))
        return new Response(file, {
          headers: {
            "Cache-Control": path.startsWith("/assets/")
              ? "public, max-age=31536000, immutable"
              : "public, max-age=3600",
          },
        });
      const index = Bun.file(`${dist}/index.html`);
      if (!(await index.exists())) return new Response("Build output not found", { status: 503 });
      let meta = routeMetadata[path];
      let jsonLd: Record<string, unknown> | undefined;
      let status = 200;
      if (path.startsWith("/artwork/")) {
        const [a] = await db
          .select()
          .from(artworks)
          .where(eq(artworks.id, path.split("/")[2] ?? ""));
        if (a) {
          meta = { title: a.title + " — Alain Rusin", description: a.description };
          jsonLd = {
            "@context": "https://schema.org",
            "@type": "VisualArtwork",
            name: a.title,
            description: a.description,
            image: a.imageUrl.startsWith("/") ? base + a.imageUrl : a.imageUrl,
            artMedium: a.technique,
            dateCreated: String(a.year),
            artist: { "@type": "Person", name: "Алексей Русин", alternateName: "Alain Rusin" },
            url: base + path,
          };
        } else status = 404;
      }
      if (path === "/about")
        jsonLd = {
          "@context": "https://schema.org",
          "@type": "Person",
          name: "Алексей Русин",
          alternateName: "Alain Rusin",
          url: base,
          jobTitle: "Художник и средовой дизайнер",
          sameAs: [
            "https://t.me/alain_rusin",
            "https://vk.com/alain_rusin",
            "https://www.behance.net/liveeasier",
            "https://artchive.ru/alain_rusin",
          ],
        };
      if (!meta && !path.startsWith("/admin")) status = 404;
      meta ??= {
        title: path.startsWith("/admin")
          ? "Личный кабинет — Alain Rusin"
          : "Этот зал временно на реставрации — Alain Rusin",
        description: "Алексей Русин (Alain Rusin)",
      };
      let html = await index.text();
      html = html
        .replace(/<title>.*?<\/title>/, `<title>${escape(meta.title)}</title>`)
        .replace(
          /<meta name="description"[^>]*>/,
          `<meta name="description" content="${escape(meta.description)}">`,
        )
        .replace(
          /<meta property="og:image"[^>]*>/,
          `<meta property="og:image" content="${escape(base)}/images/og.jpg">`,
        );
      const extra = `<link rel="canonical" href="${escape(base + path)}"><meta property="og:title" content="${escape(meta.title)}"><meta property="og:description" content="${escape(meta.description)}"><meta property="og:url" content="${escape(base + path)}"><meta property="og:type" content="website">${path.startsWith("/admin") ? '<meta name="robots" content="noindex,nofollow">' : ""}${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>` : ""}`;
      return new Response(html.replace("</head>", extra + "</head>"), {
        status,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "strict-origin-when-cross-origin",
        },
      });
    } catch {
      return new Response("Service temporarily unavailable", { status: 503 });
    }
  },
});
console.log(`Web server listening on port ${server.port}`);
