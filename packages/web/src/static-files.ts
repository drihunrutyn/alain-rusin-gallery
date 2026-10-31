import { deno } from "./api/lib/kv";
const root = new URL("../dist/", import.meta.url);
const types: Record<string, string> = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
  ttf: "font/ttf",
  woff2: "font/woff2",
  ico: "image/x-icon",
};
let html: Promise<string> | undefined;
export function indexHtml() {
  if (!html)
    html = deno
      ? deno.readTextFile(new URL("index.html", root))
      : import("node:fs/promises").then((fs) => fs.readFile(new URL("index.html", root), "utf8"));
  return html;
}
export async function staticStream(path: string, head = false): Promise<Response | null> {
  const url = new URL(path, root);
  if (!url.href.startsWith(root.href)) return null;
  try {
    let stream: ReadableStream<Uint8Array>;
    if (deno) stream = (await deno.open(url, { read: true })).readable;
    else {
      const fs = await import("node:fs/promises");
      await fs.access(url);
      const [{ createReadStream }, { Readable }] = await Promise.all([
        import("node:fs"),
        import("node:stream"),
      ]);
      stream = Readable.toWeb(createReadStream(url)) as ReadableStream<Uint8Array>;
    }
    if (head) await stream.cancel();
    return new Response(head ? null : stream, {
      headers: {
        "Content-Type": types[path.split(".").pop() ?? ""] ?? "application/octet-stream",
        "Cache-Control": path.startsWith("assets/")
          ? "public,max-age=31536000,immutable"
          : "public,max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return null;
  }
}
