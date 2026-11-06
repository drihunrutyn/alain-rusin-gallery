/* oxlint-disable jsx-a11y/media-has-caption -- Original third-party files do not supply caption tracks; do not fabricate subtitles. */
import { isPublicImagePath } from "../../shared/images";
import { resolveEmbed } from "../../shared/embed";
import { assetUrl } from "../lib/site";

export function EmbeddedMedia({ url, title, cover = "" }: { url: string; title: string; cover?: string }) {
  const media = resolveEmbed(url);
  const image = isPublicImagePath(cover) ? cover : "";
  return <div className="embedded-media">
    {!image && <div className="media-cover-placeholder"><span>{media.provider === "external" ? "ALAIN RUSIN" : media.provider}</span><p>{title}</p></div>}
    {image && <img src={assetUrl(image)} alt={title} loading="lazy" onError={e => { e.currentTarget.style.display = "none"; }} />}
    {media.type === "iframe" ? <iframe src={media.src} title={title || media.provider} loading="lazy" allowFullScreen allow="autoplay; encrypted-media; fullscreen; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" style={{ width: "100%", aspectRatio: "16 / 9", border: 0 }} /> : media.type === "video" ? <video aria-label={title || "Видео"} src={media.src} poster={image ? assetUrl(image) : undefined} controls preload="metadata" style={{ width: "100%", aspectRatio: "16 / 9" }} /> : media.src ? <a className="text-link" href={media.src} target="_blank" rel="noopener noreferrer">Смотреть на платформе</a> : url ? <p className="muted">Введите корректную HTTP(S)-ссылку на видео.</p> : null}
  </div>;
}
