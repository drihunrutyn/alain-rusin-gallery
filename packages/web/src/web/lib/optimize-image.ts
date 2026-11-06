import { MAX_JPEG_BYTES, MAX_IMAGE_EDGE } from "../../shared/images";

export async function optimizeJpeg(file: File): Promise<Blob> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 20000000)
    throw new Error("Нужен JPG, PNG или WebP до 20 МБ");
  const image = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    let edge = MAX_IMAGE_EDGE;
    for (let attempt = 0; attempt < 10; attempt++) {
      const scale = Math.min(1, edge / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Браузер не поддерживает обработку изображений");
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Не удалось создать JPG")), "image/jpeg", 0.8));
      if (blob.size <= MAX_JPEG_BYTES) return blob;
      edge = Math.floor(edge * 0.8);
    }
    throw new Error("Не удалось уменьшить изображение до 900 КБ");
  } finally { image.close(); }
}

export function blobBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Не удалось прочитать JPG"));
    reader.onload = () => resolve(String(reader.result).split(",")[1]!);
    reader.readAsDataURL(blob);
  });
}