import { useEffect, useState } from "react";
import { UploadCloud } from "lucide-react";
import { ErrorMessage } from "./gallery-ui";
import { optimizeJpeg } from "../lib/optimize-image";
import { isPublicImagePath, pagesImageUrl } from "../../shared/images";
export function ImageUpload({
  value,
  onChange,
  type: _type = "artworks",
}: {
  value: string;
  onChange: (url: string) => void;
  type?: "artworks" | "content" | "rooms";
}) {
  const [preview, setPreview] = useState<{ path: string; url: string } | null>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);
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
      const jpg = await optimizeJpeg(file);
      const response = await fetch("/api/admin/upload", { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: jpg });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось сохранить изображение");
      setPreview({ path: result.path, url: URL.createObjectURL(jpg) });
      onChange(result.path);
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
        {(preview?.path === value || isPublicImagePath(value)) ? <img src={preview?.path === value ? preview.url : pagesImageUrl(value)} alt="Выбранное изображение" /> : <UploadCloud size={32} />}
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
          placeholder="/images/….jpg или HTTPS-ссылка для импорта"
        />
      </label>
      <small className="muted">JPG до 900 КБ, до 2000 px. На витрине и в PDF — после ближайшей сборки.</small>
      {error && <ErrorMessage message={error} />}
    </div>
  );
}
