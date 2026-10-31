import { deno, getKv } from "./api/lib/kv";

export async function sendWeeklyDigest() {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) return;
  if (process.env.DENO_DEPLOY && process.env.DENO_TIMELINE !== "production") return;
  const { db } = await import("./api/database/client");
  const { requests } = await import("./api/database/schema");
  const { gte } = await import("drizzle-orm");
  const now = new Date(),
    day = now.toISOString().slice(0, 10);
  const kv = await getKv();
  if ((await kv.get<boolean>(["telegram-digest", day])).value) return;
  const rows = await db
    .select()
    .from(requests)
    .where(gte(requests.createdAt, new Date(now.getTime() - 7 * 86400000).toISOString()));
  const text =
    `Alain Rusin — заявки за неделю\nВсего: ${rows.length}\nНовых: ${rows.filter((r) => r.status === "new").length}\n\n${rows
      .slice(-12)
      .map((r) => `${r.clientName} · ${r.artworkTitle || "Без выбора работы"} · ${r.status}`)
      .join("\n")}\n\nКабинет: ${process.env.WEBSITE_URL}/admin/requests`.slice(0, 4000);
  const response = await fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text }),
      signal: AbortSignal.timeout(10000),
    },
  );
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error("Telegram digest delivery failed");
  await kv.set(["telegram-digest", day], true, { expireIn: 14 * 86400000 });
}
// Registered at module scope. No credentials means a safe no-op, not a scheduler dependency.
if (deno) deno.cron("weekly-requests-digest", "0 6 * * 1", sendWeeklyDigest);
