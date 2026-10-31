import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { z } from "zod";
import {
  cookieName,
  validPassword,
  makeSession,
  throttle,
  session,
  revokeSession,
} from "./lib/security";

export const authRoutes = new Hono();
authRoutes.post("/login", async (c) => {
  try {
    await throttle(c.req.raw.headers, "login", 8);
    const input = z
      .object({ login: z.string().max(150), password: z.string().max(500) })
      .safeParse(await c.req.json());
    if (!input.success || !(await validPassword(input.data.login, input.data.password)))
      return c.json({ error: "Неверный логин или пароль" }, 401);
    const origin = c.req.header("origin");
    if (process.env.NODE_ENV === "production" && origin && origin !== process.env.WEBSITE_URL)
      return c.json({ error: "Недопустимый источник запроса" }, 403);
    setCookie(c, cookieName, await makeSession(), {
      httpOnly: true,
      secure: c.req.url.startsWith("https:") || c.req.header("x-forwarded-proto") === "https",
      sameSite: "Lax",
      path: "/",
      maxAge: 604800,
    });
    return c.json({ success: true }, 200);
  } catch {
    return c.json({ error: "Вход временно недоступен. Попробуйте позже." }, 429);
  }
});
authRoutes.get("/me", async (c) => {
  const user = await session(c.req.raw.headers);
  return user ? c.json(user, 200) : c.json({ error: "Войдите в личный кабинет" }, 401);
});
authRoutes.post("/logout", async (c) => {
  const origin = c.req.header("origin");
  if (process.env.NODE_ENV === "production" && origin && origin !== process.env.WEBSITE_URL)
    return c.json({ error: "Недопустимый источник запроса" }, 403);
  await revokeSession(c.req.raw.headers);
  deleteCookie(c, cookieName, { path: "/" });
  return c.json({ success: true }, 200);
});
