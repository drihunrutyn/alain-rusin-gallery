import { useQuery } from "@tanstack/react-query";
import { orpc } from "../lib/api";
export function useMe() {
  return useQuery(orpc.auth.me.queryOptions({ retry: false, staleTime: 10000 }));
}
export function useAdminWorks(enabled: boolean) {
  const options = orpc.management.artworks.queryOptions({ enabled });
  return { ...useQuery(options), queryKey: options.queryKey };
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

export function useAdminRooms() {
  return useQuery(orpc.management.rooms.queryOptions());
}
