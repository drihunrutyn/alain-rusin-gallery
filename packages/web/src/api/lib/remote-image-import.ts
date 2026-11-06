import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request } from "node:https";
import sharp from "sharp";
import { ORPCError } from "@orpc/server";
import { MAX_JPEG_BYTES, isPublicImagePath } from "../../shared/images";
import { commitJpeg } from "./repository-images";
function publicAddress(address: string) {
  if (isIP(address) === 6) return /^[23][0-9a-f]{3}:/i.test(address);
  const [a, b] = address.split(".").map(Number);
  return isIP(address) === 4 && a !== 0 && a !== 10 && a !== 127 && a! < 224 && !(a === 169 && b === 254) && !(a === 172 && b! >= 16 && b! <= 31) && !(a === 192 && b === 168) && !(a === 100 && b! >= 64 && b! <= 127) && !(a === 198 && (b === 18 || b === 19));
}
// Pin the validated DNS address in the TLS request, including every redirect.
// No user-supplied cookies/authorization, local addresses, or unbounded bodies.
export async function downloadImage(value: string, redirects = 0): Promise<Buffer> {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") || redirects > 4) throw new Error("Нужна публичная HTTPS-ссылка на изображение");
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(x => !publicAddress(x.address))) throw new Error("Локальные и служебные адреса запрещены");
  const chosen = addresses.find(x => x.family === 4) || addresses[0]!;
  return new Promise((resolve, reject) => {
    const req = request(url, { headers: { "User-Agent": "Alain-Rusin-Image-Import/1.0", Accept: "image/*" }, lookup: (_hostname, options, cb) => { const callback = cb as unknown as (error: null, address: string | { address: string; family: number }[], family?: number) => void; callback(null, options.all ? [chosen] : chosen.address, chosen.family); } }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode || 0) && res.headers.location) {
        res.resume(); downloadImage(new URL(res.headers.location, url).href, redirects + 1).then(resolve, reject); return;
      }
      if (res.statusCode !== 200) { res.resume(); reject(new Error(`Изображение: HTTP ${res.statusCode}`)); return; }
      const chunks: Buffer[] = []; let length = 0;
      res.on("data", (chunk: Buffer) => { length += chunk.length; if (length > 20 * 1024 * 1024) res.destroy(new Error("Изображение больше 20 МБ")); else chunks.push(chunk); });
      res.on("end", () => resolve(Buffer.concat(chunks))); res.on("error", reject);
    });
    const timeout = setTimeout(() => req.destroy(new Error("Загрузка изображения: таймаут")), 20000);
    req.on("close", () => clearTimeout(timeout)); req.on("error", reject); req.end();
  });
}
export async function jpegImage(bytes: Uint8Array): Promise<Buffer> {
  // Keep quality 80; reduce dimensions further only if the byte cap requires it.
  for (let size = 2000; size >= 500; size = Math.floor(size * 0.8)) {
    const result = await sharp(bytes, { limitInputPixels: 50000000 }).rotate().flatten({ background: "#ffffff" }).resize(size, size, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
    if (result.length <= MAX_JPEG_BYTES) return result;
  }
  throw new Error("Не удалось уменьшить JPG до 900 КБ");
}
export async function storeRepositoryImage(value: string, prefix: string): Promise<string> {
  if (!value || isPublicImagePath(value)) return value;
  try { return await commitJpeg(await jpegImage(await downloadImage(value)), prefix); }
  catch (error) { throw new ORPCError("BAD_REQUEST", { message: error instanceof Error ? error.message : "Не удалось импортировать изображение" }); }
}
