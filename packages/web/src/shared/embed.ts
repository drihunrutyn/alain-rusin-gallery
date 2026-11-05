export interface EmbedResult {
  type: "iframe" | "video" | "link";
  src: string;
  provider: string;
  autoCover?: string;
}

// Only http(s) URLs can become links; untrusted schemes never reach href/src.
export function resolveEmbed(value: string): EmbedResult {
  const fallback = (src = ""): EmbedResult => ({ type: "link", src, provider: "external" });
  let u: URL;
  try { u = new URL(value.trim()); } catch { return fallback(); }
  if (!["https:", "http:"].includes(u.protocol) || u.username || u.password) return fallback();
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const p = u.pathname;
  let id: string | undefined;
  if (["youtube.com", "m.youtube.com", "youtube-nocookie.com", "youtu.be"].includes(host)) {
    id = host === "youtu.be" ? p.split("/")[1] : u.searchParams.get("v") || p.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1];
    if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return { type: "iframe", src: `https://www.youtube.com/embed/${id}`, provider: "YouTube", autoCover: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
  }
  if (["vk.com", "m.vk.com", "vkvideo.ru"].includes(host)) {
    const m = p.match(/^\/video(-?\d+)_(\d+)\/?$/);
    const oid = m?.[1] || (p === "/video_ext.php" ? u.searchParams.get("oid") : null);
    const vid = m?.[2] || (p === "/video_ext.php" ? u.searchParams.get("id") : null);
    if (oid && vid && /^-?\d+$/.test(oid) && /^\d+$/.test(vid)) return { type: "iframe", src: `https://vk.com/video_ext.php?oid=${oid}&id=${vid}`, provider: "ВКонтакте" };
  }
  if (host === "drive.google.com") {
    id = p.match(/^\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1];
    if (id) return { type: "iframe", src: `https://drive.google.com/file/d/${id}/preview`, provider: "Google Drive", autoCover: `https://drive.google.com/thumbnail?id=${id}&sz=w1600` };
  }
  if (host === "rutube.ru") {
    id = p.match(/^\/(?:video|play\/embed)\/([a-zA-Z0-9_-]+)/)?.[1];
    if (id) return { type: "iframe", src: `https://rutube.ru/play/embed/${id}`, provider: "Rutube" };
  }
  if (["vimeo.com", "player.vimeo.com"].includes(host)) {
    id = p.match(/^\/(?:video\/)?(\d+)\/?$/)?.[1];
    if (id) return { type: "iframe", src: `https://player.vimeo.com/video/${id}`, provider: "Vimeo" };
  }
  if (host === "ok.ru") {
    id = p.match(/^\/(?:video|videoembed)\/(\d+)\/?$/)?.[1];
    if (id) return { type: "iframe", src: `https://ok.ru/videoembed/${id}`, provider: "Одноклассники" };
  }
  if (/\.(mp4|webm|mov)$/i.test(p)) return { type: "video", src: u.href, provider: "file" };
  return fallback(u.href);
}
