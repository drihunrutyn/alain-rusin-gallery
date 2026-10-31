import { useState } from "react";
import { UploadCloud } from "lucide-react";
import { client } from "../lib/api";
import { ErrorMessage } from "./gallery-ui";
export async function optimizeImage(file: File): Promise<Blob> {
  const image = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const scale = Math.min(1, 2000 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas недоступен в этом браузере");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob?.type === "image/webp"
            ? resolve(blob)
            : reject(new Error("Браузер не поддерживает WebP")),
        "image/webp",
        0.8,
      ),
    );
  } finally {
    image.close();
  }
}
export function ImageUpload({
  value,
  onChange,
  type = "artworks",
}: {
  value: string;
  onChange: (url: string) => void;
  type?: "artworks" | "content" | "rooms";
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function upload(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 20000000) {
      setError("Нужен JPG, PNG или WebP до 20 МБ");
      return;
    }
    setPending(true);
    setError("");
    try {
      const optimized = await optimizeImage(file);
      const result = await client.management.upload({
        filename: file.name.replace(/\.[^.]+$/, "") + ".webp",
        contentType: "image/webp",
        size: optimized.size,
        type,
      });
      const response = await fetch(result.url, {
        method: "PUT",
        body: optimized,
        headers: { "Content-Type": "image/webp", "x-amz-acl": "public-read" },
      });
      if (!response.ok) throw new Error("Не удалось загрузить изображение");
      onChange(result.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="upload-control">
      <label
        className="upload-zone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!pending) void upload(e.dataTransfer.files[0]);
        }}
      >
        {value ? <img src={value} alt="Выбранное изображение" /> : <UploadCloud size={32} />}
        <span>{pending ? "Загрузка…" : "Перетащите фото или выберите файл"}</span>
        <input
          aria-label="Загрузить изображение"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={pending}
          onChange={(e) => void upload(e.target.files?.[0])}
        />
      </label>
      <label>
        Ссылка на изображение
        <input
          aria-label="Ссылка на изображение"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://…"
        />
      </label>
      {error && <ErrorMessage message={error} />}
    </div>
  );
}
