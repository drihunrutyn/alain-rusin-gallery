import { expect, test } from "bun:test";
import sharp from "sharp";
import { downloadImage, jpegImage, storeRepositoryImage } from "../src/api/lib/remote-image-import";
import { imageInput, MAX_JPEG_BYTES } from "../src/shared/images";

test("import input accepts HTTPS sources but rendering paths remain local", () => {
  expect(imageInput.parse("https://example.org/image.webp")).toContain("https://");
  for (const value of ["http://example.org/x.jpg", "//example.org/x.jpg", "/images/x.webp", "/images/../x.jpg"])
    expect(imageInput.safeParse(value).success).toBe(false);
});

test("remote import blocks private DNS addresses and unsafe protocols", async () => {
  for (const value of ["https://127.0.0.1/x", "https://169.254.169.254/x", "https://localhost/x", "http://example.org/x", "https://user:password@example.org/x", "https://example.org:8443/x"])
    await expect(downloadImage(value)).rejects.toThrow();
});

test("conversion produces a bounded JPG and preserves relative references", async () => {
  const png = await sharp({ create: { width: 2500, height: 1200, channels: 4, background: "#b8996f" } }).png().toBuffer();
  const jpg = await jpegImage(png);
  const metadata = await sharp(jpg).metadata();
  expect(metadata.format).toBe("jpeg");
  expect(metadata.width).toBeLessThanOrEqual(2000);
  expect(jpg.length).toBeLessThanOrEqual(MAX_JPEG_BYTES);
  expect(await storeRepositoryImage("/images/seeds/aquatika.jpg", "test")).toBe("/images/seeds/aquatika.jpg");
  expect(await storeRepositoryImage("", "test")).toBe("");
});