import { build } from "vite";
await build({
  configFile: false,
  root: new URL("..",import.meta.url).pathname,
  logLevel: "info",
  ssr: { noExternal: true },
  build: {
    ssr: "src/deploy-entry.ts",
    outDir: "dist-edge",
    target: "esnext",
    minify: true,
    rollupOptions: {
      output: {entryFileNames:"server.js",chunkFileNames:"chunks/[name]-[hash].js"}
    }
  }
});