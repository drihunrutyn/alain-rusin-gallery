import { z } from "zod";
export const MAX_JPEG_BYTES = 900 * 1024;
export const MAX_IMAGE_EDGE = 2000;

// No external hosts, traversal, encoded segments, query strings or protocol-relative URLs.
export function isPublicImagePath(value: string): boolean {
  return /^\/images\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.jpg$/.test(value)
    && !value.split("/").some(part => part === "." || part === "..");
}

export function pagesImageUrl(value: string, site = "https://drihunrutyn.github.io/alain-rusin-gallery"): string {
  if (!isPublicImagePath(value)) throw new Error("Изображение должно быть JPG по пути /images/…");
  return site.replace(/\/$/, "") + value;
}

// External sources are accepted only for server-side import, never for storage/rendering.
export const imageInput = z.string().max(2000).refine(v => !v || isPublicImagePath(v) || v.startsWith("https://"), "Нужен JPG из репозитория или HTTPS-ссылка для импорта");
