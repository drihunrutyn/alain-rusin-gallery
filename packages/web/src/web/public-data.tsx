import { createContext, useContext } from "react";
import type { PublicSnapshot } from "../shared/public-data";
import { visibleSeries } from "../shared/series";
const empty: PublicSnapshot = { artworks: [], series: [], content: [], rooms: [], profile: { email: "telnov.aleosch@yandex.ru", city: "Санкт-Петербург" }, builtAt: "" };
export const PublicDataContext = createContext<PublicSnapshot>(empty);
export const usePublicData = () => useContext(PublicDataContext);
const result = <T,>(data: T) => ({ data, isLoading: false, error: null });
export const useSeries = () => result(visibleSeries(usePublicData().series));
export const useArtworks = () => {
  const data = usePublicData();
  const active = new Set(visibleSeries(data.series).map(s => s.slug));
  return result(data.artworks.filter(a => active.has(a.series)));
};
export const useArtwork = (id: string) => result(usePublicData().artworks.find(a => a.id === id));
export const useMedia = () => result(usePublicData().content);
export const useRooms = () => result(usePublicData().rooms);
