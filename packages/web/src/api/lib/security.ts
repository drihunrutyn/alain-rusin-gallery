import { SignJWT, jwtVerify } from "jose";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { db } from "../database/client";
import { adminSettings } from "../database/schema";
import { base } from "../__core/app";
import { same, verifyPassword, verifyInitialPassword } from "./password";
import { getKv, increment } from "./kv";

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
export { same } from "./password";
export async function validPassword(login: string, password: string) {
  if (!process.env.ADMIN_LOGIN || !process.env.ADMIN_PASSWORD) return false;
  if (!(await same(login, process.env.ADMIN_LOGIN))) return false;
  const [override] = await db
    .select()
    .from(adminSettings)
    .where(eq(adminSettings.key, "password_hash"));
  return (
    (await same(login, process.env.ADMIN_LOGIN)) &&
    (override ? verifyPassword(password, override.value) : verifyInitialPassword(password))
  );
}
export async function makeSession() {
  const cfg = await settings();
  const kv = await getKv();
  const version = cfg.session_version ?? "0";
  const jti = crypto.randomUUID();
  await kv.set(["auth", "version"], version);
  await kv.set(["session", jti], { version }, { expireIn: 604800000 });
  return new SignJWT({ admin: true, version })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(jti)
    .setIssuer("alain-rusin")
    .setAudience("artist-cms")
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
    const { payload } = await jwtVerify(token, key(), {
      algorithms: ["HS256"],
      issuer: "alain-rusin",
      audience: "artist-cms",
    });
    if (!payload.jti) return null;
    const kv = await getKv();
    const [stored, version] = await Promise.all([
      kv.get<{ version: string }>(["session", payload.jti]),
      kv.get<string>(["auth", "version"]),
    ]);
    return payload.admin &&
      stored.value?.version === payload.version &&
      payload.version === version.value
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
export async function revokeSession(headers: Headers) {
  const token = headers
    .get("cookie")
    ?.split(";")
    .find((c) => c.trim().startsWith(cookieName + "="))
    ?.split("=")
    .slice(1)
    .join("=");
  if (!token) return;
  try {
    const { payload } = await jwtVerify(token, key(), {
      algorithms: ["HS256"],
      issuer: "alain-rusin",
      audience: "artist-cms",
    });
    if (payload.jti) await (await getKv()).delete(["session", payload.jti]);
  } catch {
    /* Expired or invalid cookies are cleared by caller. */
  }
}
export async function revokeAllSessions(version: string) {
  await setSetting("session_version", version);
  await (await getKv()).set(["auth", "version"], version);
}
export async function throttle(headers: Headers, kind: string, limit = 20) {
  const ip =
    headers.get("cf-connecting-ip") || headers.get("x-forwarded-for")?.split(",")[0] || "local";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  const identity = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  const count = await increment(
    ["throttle", kind, identity, Math.floor(Date.now() / 600000)],
    1200000,
  );
  if (count > limit)
    throw new ORPCError("TOO_MANY_REQUESTS", {
      message: "Слишком много запросов. Попробуйте позже.",
    });
}
