import { useEffect } from "react";
import { useLocation } from "wouter";
import { routeMetadata } from "../../shared/metadata";
import { usePublicData } from "../public-data";
import { assetUrl, publicSiteUrl } from "../lib/site";
import { client } from "../lib/api";
export function PageMetadata() {
  const [path] = useLocation();
  const data = usePublicData();
  useEffect(() => {
    window.scrollTo(0, 0);
    const id = path.startsWith("/artwork/") ? path.split("/")[2] : undefined;
    const artwork = id ? data.artworks.find(a => a.id === id) : undefined;
    const meta = artwork ? { title: artwork.title + " — Alain Rusin", description: artwork.description } : routeMetadata[path];
    document.title = meta?.title || (path.startsWith("/admin") ? "Личный кабинет — Alain Rusin" : "Работа не найдена — Alain Rusin");
    for (const [selector, value] of [
      ['meta[name="description"]', meta?.description || "Алексей Русин (Alain Rusin)"],
      ['meta[property="og:title"]', document.title],
      ['meta[property="og:description"]', meta?.description || "Алексей Русин (Alain Rusin)"],
      ['meta[property="og:url"]', publicSiteUrl + (path === "/" ? "/" : path + "/")],
    ]) {
      const element = document.querySelector<HTMLMetaElement>(selector);
      if (element) element.content = value;
    }
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) canonical.href = publicSiteUrl + (path === "/" ? "/" : path + "/");
    const image = document.querySelector<HTMLMetaElement>('meta[property="og:image"]');
    if (image) image.content = artwork ? new URL(assetUrl(artwork.imageUrl), publicSiteUrl).href : new URL(assetUrl("/images/og.jpg"), publicSiteUrl).href;
    document.querySelector('#page-jsonld')?.remove();
    const schema = artwork ? {
      "@context": "https://schema.org", "@type": "VisualArtwork", name: artwork.title,
      description: artwork.description, image: new URL(assetUrl(artwork.imageUrl), publicSiteUrl).href,
      artMedium: artwork.technique, artist: { "@type": "Person", name: "Алексей Русин" },
      url: canonical?.href,
    } : path === "/about" ? {
      "@context": "https://schema.org", "@type": "Person", name: "Алексей Русин", alternateName: "Alain Rusin", url: publicSiteUrl,
    } : undefined;
    if (schema) {
      const script = document.createElement("script");
      script.id = "page-jsonld";
      script.type = "application/ld+json";
      script.textContent = JSON.stringify(schema).replace(/</g, "\\u003c");
      document.head.append(script);
    }
    // Non-catalog write only. Failure must never prevent static pages rendering.
    if (!path.startsWith("/admin") && (!id || artwork))
      void client.gallery.view({ route: path, artworkId: id }).catch(() => {});
  }, [path, data]);
  return null;
}
