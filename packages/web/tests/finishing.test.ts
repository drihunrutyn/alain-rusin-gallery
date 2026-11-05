import { expect, test } from "bun:test";
import { resolveEmbed } from "../src/shared/embed";
import { snapshotHash } from "../scripts/public-snapshot";
import type { PublicSnapshot } from "../src/shared/public-data";
import { privacyText } from "../src/shared/privacy";

test("YouTube formats share a safe player and automatic cover", () => {
  for (const url of ["https://youtube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ", "https://youtube.com/shorts/dQw4w9WgXcQ", "https://youtube.com/embed/dQw4w9WgXcQ"]) expect(resolveEmbed(url)).toMatchObject({ type: "iframe", src: "https://www.youtube.com/embed/dQw4w9WgXcQ", autoCover: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" });
});
test("VK owner sign and legacy video_ext URLs are preserved", () => {
  for (const host of ["vk.com", "vkvideo.ru"]) expect(resolveEmbed(`https://${host}/video-30015658_456242764`).src).toBe("https://vk.com/video_ext.php?oid=-30015658&id=456242764");
  expect(resolveEmbed("https://vk.com/video123_456").src).toBe("https://vk.com/video_ext.php?oid=123&id=456");
  expect(resolveEmbed("https://vk.com/video_ext.php?oid=-30015658&id=456242764").type).toBe("iframe");
});
test("Drive, Rutube, Vimeo and OK use supported players", () => {
  expect(resolveEmbed("https://drive.google.com/file/d/abc_DEF-123/view?usp=sharing")).toEqual({ type: "iframe", src: "https://drive.google.com/file/d/abc_DEF-123/preview", provider: "Google Drive", autoCover: "https://drive.google.com/thumbnail?id=abc_DEF-123&sz=w1600" });
  expect(resolveEmbed("https://rutube.ru/video/abcd1234/").src).toBe("https://rutube.ru/play/embed/abcd1234");
  expect(resolveEmbed("https://vimeo.com/123456").src).toBe("https://player.vimeo.com/video/123456");
  expect(resolveEmbed("https://ok.ru/video/123456").src).toBe("https://ok.ru/videoembed/123456");
});
test("direct files and unknown platform fallbacks reject unsafe schemes/host spoofing", () => {
  for (const ext of ["mp4", "webm", "mov"]) expect(resolveEmbed(`https://example.org/test.${ext}?token=123`).type).toBe("video");
  expect(resolveEmbed("https://example.org/watch/1")).toMatchObject({ type: "link", src: "https://example.org/watch/1" });
  for (const url of ["javascript:alert(1)", "data:text/html,test", "ftp://example.org/x", "https://user:password@example.org/"]) expect(resolveEmbed(url).src).toBe("");
  expect(resolveEmbed("https://youtube.com.evil.example/watch?v=dQw4w9WgXc").type).toBe("link");
});
test("snapshot hash ignores timestamp but reacts to catalog and series changes", () => {
  const data: PublicSnapshot = { artworks: [], content: [], rooms: [], series: [], profile: { email: "test@example.org", city: "City" }, builtAt: "one" };
  expect(snapshotHash(data)).toBe(snapshotHash({ ...data, builtAt: "two" }));
  expect(snapshotHash(data)).not.toBe(snapshotHash({ ...data, profile: { ...data.profile, city: "Other" } }));
});
test("workflow has four Moscow windows, no PAT, and saves cache only after successful deployment", async () => {
  const yaml = await Bun.file(new URL("../../../.github/workflows/deploy-pages.yml", import.meta.url)).text();
  expect(yaml).toContain('cron: "0 7,10,13,16 * * *"');
  expect(yaml).toContain("workflow_dispatch: {}");
  expect(yaml).toContain("push: { branches: [main] }");
  expect(yaml).toContain("permissions: { contents: read, pages: write, id-token: write }");
  expect(yaml).toContain("actions/cache/restore@v4");
  expect(yaml).toContain("restore-keys: storefront-published-");
  expect(yaml).toContain('if [ "$previous" = "$SNAPSHOT_KEY" ]');
  expect(yaml).toContain("steps.compare.outputs.changed");
  expect(yaml.indexOf("actions/cache/save@v4")).toBeGreaterThan(yaml.indexOf("actions/deploy-pages@v4"));
  expect(yaml).toContain("git rev-parse HEAD^{tree}");
  expect(yaml).toContain("if: needs.build.outputs.changed == 'true'");
  expect(yaml.match(/secrets\.\w+/g)).toEqual(["secrets.DATABASE_URL", "secrets.DATABASE_AUTH_TOKEN"]);
  expect(yaml).not.toMatch(/secrets\.(?:PAT|GITHUB_\w*TOKEN)/);
});
test("privacy contains every supplied section and effective date", () => {
  expect(privacyText).toStartWith("Политика обработки персональных данных\nСайт: https://drihunrutyn.github.io/alain-rusin-gallery/");
  for (let i = 1; i <= 10; i++) expect(privacyText).toContain(`\n${i}. `);
  expect(privacyText).toContain("5 ноября 2026 года.");
  expect(privacyText).not.toContain("должен быть предоставлен");
});
