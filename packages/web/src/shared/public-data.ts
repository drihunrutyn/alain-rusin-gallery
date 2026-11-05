import type { ArtworkData, ContentData } from "./gallery";
import type { SeriesData } from "./series";
export interface PublicSnapshot {
  artworks: ArtworkData[];
  series: SeriesData[];
  content: ContentData[];
  rooms: { id: string; imageUrl: string; createdAt: string }[];
  profile: { email: string; city: string };
  builtAt: string;
}
