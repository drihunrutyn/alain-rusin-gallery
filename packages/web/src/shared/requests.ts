import { z } from "zod";
export const requestStatuses = { new: "Новая", in_progress: "В работе", sold: "Продано", cancelled: "Отменено" } as const;
export const requestStatus = z.enum(["new", "in_progress", "sold", "cancelled"]);
export const manualRequestInput = z.object({
  clientName: z.string().trim().min(1).max(150),
  clientContact: z.string().trim().min(1).max(200),
  artworkId: z.string().uuid(),
  status: requestStatus.default("new"),
});
export function normalizedRequestStatus(value: string): keyof typeof requestStatuses {
  return value === "processed" ? "in_progress" : requestStatus.safeParse(value).success ? value as keyof typeof requestStatuses : "new";
}
