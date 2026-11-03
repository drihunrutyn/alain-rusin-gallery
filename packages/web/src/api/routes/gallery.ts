import { z } from "zod";
import { base } from "../__core/app";
import { db } from "../database";
import * as tables from "../database/schema";
import { throttle } from "../lib/security";
export const gallery = {
  subscribe: base
    .input(z.object({ email: z.string().trim().email().max(250), consent: z.literal(true) }))
    .handler(async ({ input, context }) => {
      throttle(context.headers, "subscribe", 10);
      await db
        .insert(tables.subscribers)
        .values({ email: input.email.toLowerCase() })
        .onConflictDoNothing();
      return { success: true };
    }),
  view: base
    .input(
      z.object({
        route: z.string().startsWith("/").max(500),
        artworkId: z.string().uuid().optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      throttle(context.headers, "view", 250);
      if (!input.route.startsWith("/admin")) await db.insert(tables.pageViews).values(input);
      return { success: true };
    }),
};
