import { useQuery } from "@tanstack/react-query";
import { orpc } from "../lib/api";
export function useArtworks() {
  return useQuery(orpc.gallery.artworks.queryOptions({ staleTime: 15000 }));
}
export function useSeries() {
  const query = useQuery(orpc.gallery.series.queryOptions());
  return { ...query, data: query.data || [] };
}
export function useArtwork(id: string) {
  return useQuery(orpc.gallery.artwork.queryOptions({ input: { id }, retry: false }));
}
export function useMedia() {
  return useQuery(orpc.gallery.content.queryOptions());
}
export function useRooms() {
  return useQuery(orpc.gallery.rooms.queryOptions());
}
export function useProfile() {
  return useQuery(orpc.gallery.profile.queryOptions());
}
export function useMe() {
  return useQuery(orpc.gallery.me.queryOptions({ retry: false, staleTime: 10000 }));
}
export function useAdminWorks(enabled: boolean) {
  const options = orpc.management.artworks.queryOptions({ enabled });
  return { ...useQuery(options), queryKey: options.queryKey };
}
export function useAdminSeries(enabled = true) {
  return useQuery(orpc.management.series.queryOptions({ enabled }));
}
export function useAdminContent(enabled: boolean) {
  return useQuery(orpc.management.content.queryOptions({ enabled }));
}
export function useAdminRequests(enabled: boolean) {
  return useQuery(orpc.management.requests.queryOptions({ enabled }));
}
export function useAdminStats(enabled: boolean) {
  return useQuery(orpc.management.stats.queryOptions({ enabled }));
}
export function useAdminSettings(enabled: boolean) {
  return useQuery(orpc.management.settings.queryOptions({ enabled }));
}
export function useSubscribers(enabled: boolean) {
  return useQuery(orpc.management.subscribers.queryOptions({ enabled }));
}
