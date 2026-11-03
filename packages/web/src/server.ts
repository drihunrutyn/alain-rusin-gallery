import app from "./api";
import { session } from "./api/lib/security";

const dist = `${import.meta.dirname}/../dist`;
const publicSite = (process.env.PUBLIC_SITE_URL || "https://drihunrutyn.github.io/alain-rusin-gallery").replace(/\/$/, "");
const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path.startsWith("/api/")) return app.fetch(request);
      const isAdmin = path === "/admin" || path.startsWith("/admin/");
      if (isAdmin && path !== "/admin/login" && !(await session(request.headers)))
        return new Response(null, { status: 302, headers: { Location: "/admin/login", "Cache-Control": "no-store" } });
      if (path === "/robots.txt") return new Response("User-agent: *\nDisallow: /\n", { headers: { "Content-Type": "text/plain" } });
      const clean = decodeURIComponent(path).replace(/^\/+/, "");
      if (clean.split("/").includes("..") || clean.includes("\\")) return new Response("Not found", { status: 404 });
      const file = Bun.file(`${dist}/${clean}`);
      // Assets are shared, but never expose admin index.html without route/session checks.
      if (clean && clean !== "index.html" && !isAdmin && await file.exists())
        return new Response(file, { headers: { "Cache-Control": path.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "public, max-age=3600" } });
      if (!isAdmin) {
        // Temporary redirect so rollback and future domain changes are possible.
        return new Response(null, { status: 302, headers: { Location: publicSite + (path === "/" || path === "/index.html" ? "/" : path) + url.search + url.hash, "Cache-Control": "no-store" } });
      }
      const index = Bun.file(`${dist}/index.html`);
      if (!(await index.exists())) return new Response("Build output not found", { status: 503 });
      const html = (await index.text()).replace(/<title>.*?<\/title>/, "<title>Личный кабинет — Alain Rusin</title>").replace("</head>", '<meta name="robots" content="noindex,nofollow"></head>');
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin" } });
    } catch {
      return new Response("Service temporarily unavailable", { status: 503 });
    }
  },
});
console.log(`Admin server listening on port ${server.port}`);