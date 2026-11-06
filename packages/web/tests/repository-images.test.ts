import { afterEach, expect, spyOn, test } from "bun:test";
import sharp from "sharp";
import { validateJpeg, commitJpeg, automaticCover } from "../src/api/lib/repository-images";
import { isPublicImagePath, pagesImageUrl, MAX_JPEG_BYTES } from "../src/shared/images";
import { resolveEmbed } from "../src/shared/embed";

let mock: ReturnType<typeof spyOn> | undefined;
const originalToken = process.env.UPLOAD_GITHUB_TOKEN;
afterEach(() => {
  mock?.mockRestore(); mock = undefined;
  if (originalToken === undefined) delete process.env.UPLOAD_GITHUB_TOKEN;
  else process.env.UPLOAD_GITHUB_TOKEN = originalToken;
});
const jpeg = () => sharp({ create: { width: 16, height: 12, channels: 3, background: "#aabbcc" } }).jpeg({ quality: 80 }).toBuffer();

test("repository path rejects external hosts, traversal and non-JPG", () => {
  for (const bad of ["https://host/image.jpg", "//host/images/x.jpg", "/images/../x.jpg", "/images/%2e%2e/x.jpg", "/images/x.webp", "/images/x.png", "/images/x.jpg?q=1"])
    expect(isPublicImagePath(bad)).toBe(false);
  expect(pagesImageUrl("/images/uploads/test-123.jpg")).toBe("https://drihunrutyn.github.io/alain-rusin-gallery/images/uploads/test-123.jpg");
});
test("server inspects real format, bytes and dimensions", async () => {
  await validateJpeg(await jpeg());
  await expect(validateJpeg(Buffer.alloc(MAX_JPEG_BYTES + 1))).rejects.toThrow();
  await expect(validateJpeg(await sharp({ create: { width: 16, height: 12, channels: 3, background: "white" } }).png().toBuffer())).rejects.toThrow();
  await expect(validateJpeg(await sharp({ create: { width: 2001, height: 1, channels: 3, background: "white" } }).jpeg().toBuffer())).rejects.toThrow();
});
test("Contents API commits bytes to main and returns only relative path", async () => {
  process.env.UPLOAD_GITHUB_TOKEN = "unit-test-token";
  const bytes = await jpeg();
  mock = spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
    expect(String(url)).toContain("/contents/packages/web/public/images/uploads/test-");
    expect(init?.method).toBe("PUT");
    const body = JSON.parse(String(init?.body));
    expect(body.branch).toBe("main");
    expect(Buffer.from(body.content, "base64")).toEqual(bytes);
    return Response.json({ commit: { sha: "mock" } }, { status: 201 });
  });
  expect(await commitJpeg(bytes, "test")).toMatch(/^\/images\/uploads\/test-[a-f0-9]{16}\.jpg$/);
  expect(mock).toHaveBeenCalledTimes(1);
});
test("YouTube and Drive covers are fetched only by backend and committed as JPG", async () => {
  process.env.UPLOAD_GITHUB_TOKEN = "unit-test-token";
  const bytes = await jpeg(); let downloads = 0; let commits = 0;
  mock = spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
    if (String(url).startsWith("https://api.github.com/")) {
      commits++; expect(init?.method).toBe("PUT");
      return Response.json({}, { status: 201 });
    }
    expect(["i.ytimg.com", "drive.google.com"]).toContain(new URL(String(url)).hostname);
    downloads++; return new Response(bytes, { headers: { "Content-Type": "image/jpeg" } });
  });
  for (const url of ["https://youtu.be/dQw4w9WgXcQ", "https://drive.google.com/open?id=test_id"])
    expect(await automaticCover("test-id", url)).toMatch(/^\/images\/uploads\/cover-test-id-/);
  expect(downloads).toBe(2); expect(commits).toBe(2);
  expect(resolveEmbed("https://drive.google.com/open?id=test_id").src).toBe("https://drive.google.com/file/d/test_id/preview");
});
test("missing private cover and forbidden redirects leave cover empty", async () => {
  process.env.UPLOAD_GITHUB_TOKEN = "unit-test-token";
  mock = spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 403 }));
  expect(await automaticCover("test-id", "https://youtu.be/dQw4w9WgXcQ")).toBe("");
  mock.mockResolvedValue(new Response(null, { status: 302, headers: { Location: "https://127.0.0.1/private" } }));
  expect(await automaticCover("test-id", "https://drive.google.com/file/d/test_id/view")).toBe("");
});
test("VK and unknown provider do not trigger external thumbnail requests", async () => {
  mock = spyOn(globalThis, "fetch").mockRejectedValue(new Error("unexpected network"));
  expect(await automaticCover("test-id", "https://vk.com/video-1_2")).toBe("");
  expect(await automaticCover("test-id", "https://example.org/video")).toBe("");
  expect(mock).not.toHaveBeenCalled();
});