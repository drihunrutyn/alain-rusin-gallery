import { afterEach, expect, test } from "bun:test";
import { requestRebuild } from "../src/api/lib/rebuild";

const originalFetch = globalThis.fetch;
const token = process.env.GITHUB_REBUILD_TOKEN;
const hook = process.env.NEXT_PUBLIC_BUILD_HOOK_URL;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (token === undefined) delete process.env.GITHUB_REBUILD_TOKEN; else process.env.GITHUB_REBUILD_TOKEN = token;
  if (hook === undefined) delete process.env.NEXT_PUBLIC_BUILD_HOOK_URL; else process.env.NEXT_PUBLIC_BUILD_HOOK_URL = hook;
});
test("missing dispatch configuration warns without requesting anything", async () => {
  delete process.env.GITHUB_REBUILD_TOKEN;
  delete process.env.NEXT_PUBLIC_BUILD_HOOK_URL;
  globalThis.fetch = (() => { throw new Error("unexpected network request"); }) as typeof fetch;
  expect((await requestRebuild()).queued).toBe(false);
});
test("accepted dispatch uses server token and main ref", async () => {
  process.env.GITHUB_REBUILD_TOKEN = "test-only-token";
  let calls = 0;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls++;
    expect(String(url)).toBe("https://api.github.com/repos/drihunrutyn/alain-rusin-gallery/actions/workflows/deploy.yml/dispatches");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer test-only-token");
    expect(JSON.parse(String(init?.body))).toEqual({ ref: "main" });
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  expect((await requestRebuild()).queued).toBe(true);
  expect(calls).toBe(1);
});
test("failed dispatch and network errors return warnings, not success", async () => {
  process.env.GITHUB_REBUILD_TOKEN = "test-only-token";
  globalThis.fetch = (async () => new Response(null, { status: 403 })) as typeof fetch;
  expect(await requestRebuild()).toMatchObject({ queued: false });
  expect((await requestRebuild()).message).toContain("403");
  globalThis.fetch = (async () => { throw new Error("offline"); }) as typeof fetch;
  expect((await requestRebuild()).queued).toBe(false);
});
test("insecure fallback hooks are not called", async () => {
  delete process.env.GITHUB_REBUILD_TOKEN;
  process.env.NEXT_PUBLIC_BUILD_HOOK_URL = "http://example.test";
  globalThis.fetch = (() => { throw new Error("unexpected network request"); }) as typeof fetch;
  expect((await requestRebuild()).queued).toBe(false);
});