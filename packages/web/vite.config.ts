import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import path from "path";
import runableAnalyticsPlugin from "./vite/__plugins/runable-analytics-plugin";
import honoDevPlugin from "./vite/__plugins/hono-dev-plugin";
import assetOptimizerPlugin from "./vite/__plugins/asset-optimizer-plugin";
import ports from "../../__ports.cjs";
import { readFileSync } from "node:fs";

const root = path.resolve(__dirname, "../..");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, "");
  Object.assign(process.env, env);
  const isStatic = mode === "static";
  const base = isStatic ? (process.env.PAGES_BASE_PATH || "/alain-rusin-gallery/") : "/";

  return {
    base,
    define: {
      "import.meta.env.VITE_API_ORIGIN": JSON.stringify(isStatic ? (process.env.ADMIN_SITE_URL || "https://alain-rusin.onrender.com") : ""),
      "import.meta.env.VITE_PUBLIC_SITE_URL": JSON.stringify(process.env.PUBLIC_SITE_URL || "https://drihunrutyn.github.io/alain-rusin-gallery"),
      "import.meta.env.VITE_ADMIN_SITE_URL": JSON.stringify(process.env.ADMIN_SITE_URL || "https://alain-rusin.onrender.com"),
    },
    // All env files live at the repo root — keep Vite's own env loading there too,
    // so packages/web/.env* files can never shadow the root .env.
    envDir: root,
    plugins: [
      ...(!isStatic ? [honoDevPlugin()] : []),
      ...(isStatic ? [{
        name: "static-gallery-snapshot",
        resolveId(id: string) { if (id === "virtual:gallery-snapshot") return "\0gallery-snapshot"; },
        load(id: string) {
          if (id === "\0gallery-snapshot") return `export default ${readFileSync(path.join(root, ".build/snapshot.json"), "utf8")};`;
        },
        transformIndexHtml: { order: "pre" as const, handler(html: string) { return html.replace('/src/web/main.tsx', '/src/web/static-main.tsx'); } },
      }, {
        name: "static-analytics-base-path",
        transformIndexHtml: { order: "post" as const, handler(html: string) { return html.replace('src="/runable.js"', `src="${base}runable.js"`); } },
      }] : []),
      react(),
      runableAnalyticsPlugin(),
      tailwind(),
      assetOptimizerPlugin(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src/web"),
      },
    },
    server: {
      port: ports.website,
      strictPort: true,
      allowedHosts: true,
      hmr: { overlay: false },
      cors: false,
    },
  };
});
