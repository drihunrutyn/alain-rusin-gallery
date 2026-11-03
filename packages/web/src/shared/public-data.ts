import type { ArtworkData, ContentData } from "./gallery";
export interface PublicSnapshot {
  artworks: ArtworkData[];
  content: ContentData[];
  rooms: { id: string; imageUrl: string; createdAt: string }[];
  profile: { email: string; city: string };
  builtAt: string;
}
