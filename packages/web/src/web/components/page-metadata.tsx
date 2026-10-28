import { useEffect } from "react";
import { useLocation } from "wouter";
import { routeMetadata } from "../../shared/metadata";
import { client } from "../lib/api";

export function PageMetadata() {
  const [path] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    const meta = routeMetadata[path];
    document.title =
      meta?.title || (path.startsWith("/admin") ? "Личный кабинет — Alain Rusin" : "Alain Rusin");
    let description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!description) {
      description = document.createElement("meta");
      description.name = "description";
      document.head.appendChild(description);
    }
    description.content = meta?.description || "Алексей Русин (Alain Rusin)";
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = window.location.origin + path;
    const id = path.startsWith("/artwork/") ? path.split("/")[2] : undefined;
    if (!path.startsWith("/admin"))
      void client.gallery.view({ route: path, artworkId: id }).catch(() => {});
    if (id)
      void client.gallery
        .artwork({ id })
        .then((a) => {
          if (window.location.pathname === path) {
            document.title = a.title + " — Alain Rusin";
            description!.content = a.description;
          }
        })
        .catch(() => {
          document.title = "Работа не найдена — Alain Rusin";
        });
  }, [path]);
  return null;
}
