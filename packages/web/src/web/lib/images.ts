const base=(import.meta.env.VITE_IMAGE_BASE_URL ?? "").replace(/\/$/, "");
export function imageUrl(path: string) {
  return path.startsWith("/images/") && base ? base+path : path;
}