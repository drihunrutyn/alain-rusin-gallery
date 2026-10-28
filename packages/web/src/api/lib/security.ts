import { SignJWT, jwtVerify } from "jose";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { db } from "../database";
import { adminSettings } from "../database/schema";
import { base } from "../__core/app";
import { timingSafeEqual, createHash } from "node:crypto";

export const cookieName = "rusin_session";
const key = () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Секрет сессии не настроен" });
  return new TextEncoder().encode(secret);
};
export async function settings() {
  const rows = await db.select().from(adminSettings);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
export async function setSetting(k: string, value: string) {
  await db
    .insert(adminSettings)
    .values({ key: k, value })
    .onConflictDoUpdate({ target: adminSettings.key, set: { value } });
}
export function same(a: string, b: string) {
  return timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );
}
export async function validPassword(login: string, password: string) {
  if (!process.env.ADMIN_LOGIN || !process.env.ADMIN_PASSWORD) return false;
  const [override] = await db
    .select()
    .from(adminSettings)
    .where(eq(adminSettings.key, "password_hash"));
  return (
    same(login, process.env.ADMIN_LOGIN) &&
    (override
      ? Bun.password.verify(password, override.value)
      : same(password, process.env.ADMIN_PASSWORD))
  );
}
export async function makeSession() {
  const cfg = await settings();
  return new SignJWT({ admin: true, version: cfg.session_version ?? "0" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("artist")
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key());
}
export async function session(headers: Headers) {
  const token = headers
    .get("cookie")
    ?.split(";")
    .find((c) => c.trim().startsWith(cookieName + "="))
    ?.split("=")
    .slice(1)
    .join("=");
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    const cfg = await settings();
    return payload.admin && payload.version === (cfg.session_version ?? "0")
      ? { login: process.env.ADMIN_LOGIN ?? "" }
      : null;
  } catch {
    return null;
  }
}
export const admin = base.use(async ({ context, next }) => {
  if (!(await session(context.headers)))
    throw new ORPCError("UNAUTHORIZED", { message: "Войдите в личный кабинет" });
  const origin = context.headers.get("origin");
  const allowed = [process.env.WEBSITE_URL, process.env.RUNABLE_URL].filter(Boolean);
  if (process.env.NODE_ENV === "production" && origin && !allowed.some((url) => url === origin))
    throw new ORPCError("FORBIDDEN");
  return next();
});
const hits = new Map<string, { count: number; until: number }>();
export function throttle(headers: Headers, kind: string, limit = 20) {
  const ip =
    headers.get("cf-connecting-ip") || headers.get("x-forwarded-for")?.split(",")[0] || "local";
  const id = kind + ":" + ip;
  const now = Date.now();
  const old = hits.get(id);
  const row = old && old.until > now ? old : { count: 0, until: now + 600000 };
  if (++row.count > limit)
    throw new ORPCError("TOO_MANY_REQUESTS", {
      message: "Слишком много запросов. Попробуйте позже.",
    });
  hits.set(id, row);
  if (hits.size > 5000) for (const [k, v] of hits) if (v.until < now) hits.delete(k);
}
