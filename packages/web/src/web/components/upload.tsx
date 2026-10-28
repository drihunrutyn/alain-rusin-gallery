import { useState } from "react";
import { UploadCloud } from "lucide-react";
import { client } from "../lib/api";
import { ErrorMessage } from "./gallery-ui";
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
      const result = await client.management.upload({
        filename: file.name,
        contentType: file.type as "image/jpeg" | "image/png" | "image/webp",
        size: file.size,
        type,
      });
      const response = await fetch(result.url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type, "x-amz-acl": "public-read" },
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
