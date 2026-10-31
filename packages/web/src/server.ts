import { routeMetadata } from "./shared/metadata";
import { staticStream, indexHtml } from "./static-files";

const escape = (v: string) =>
  v.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path.startsWith("/api/")) {
        if (path === "/api/health") return Response.json({ status: "ok" });
        const { default: app } = await import("./api");
        return app.fetch(request);
      }
      const base = (process.env.WEBSITE_URL || url.origin).replace(/\/$/, "");
      if (path === "/robots.txt")
        return new Response(
          `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api\nSitemap: ${base}/sitemap.xml\n`,
          { headers: { "Content-Type": "text/plain" } },
        );
      if (path === "/sitemap.xml") {
        const { db } = await import("./api/database/client");
        const { artworks } = await import("./api/database/schema");
        const rows = await db.select().from(artworks);
        const routes = [...Object.keys(routeMetadata), ...rows.map((a) => `/artwork/${a.id}`)];
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map((r) => `<url><loc>${escape(base + r)}</loc></url>`).join("")}</urlset>`,
          { headers: { "Content-Type": "application/xml" } },
        );
      }
      if (path.startsWith("/admin") && path !== "/admin/login") {
        const { session } = await import("./api/lib/security");
        if (!(await session(request.headers)))
          return new Response(null, {
            status: 302,
            headers: { Location: "/admin/login", "Cache-Control": "no-store" },
          });
      }
      const clean = decodeURIComponent(path).replace(/^\/+/, "");
      if (clean.split("/").includes("..") || clean.includes("\\") || clean.includes("\0"))
        return new Response("Not found", { status: 404 });
      if (clean && /\.[a-z0-9]+$/i.test(clean)) {
        const response = await staticStream(clean, request.method === "HEAD");
        return response ?? new Response("Not found", { status: 404 });
      }
      let meta = routeMetadata[path];
      let jsonLd: Record<string, unknown> | undefined;
      let status = 200;
      if (path.startsWith("/artwork/")) {
        const { db } = await import("./api/database/client");
        const { artworks } = await import("./api/database/schema");
        const { eq } = await import("drizzle-orm");
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
      let html = await indexHtml();
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
    } catch (error) {
      console.error("Request handler failed:", error instanceof Error ? error.name : "UnknownError");
      return new Response("Service temporarily unavailable", { status: 503 });
    }
  },
};
