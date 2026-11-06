import { useEffect, useState } from "react";
import { UploadCloud } from "lucide-react";
import { client } from "../lib/api";
import { ErrorMessage } from "./gallery-ui";
import { optimizeJpeg, blobBase64 } from "../lib/optimize-image";
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
  const [preview, setPreview] = useState("");
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
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
      const result = await client.management.upload({ jpegBase64: await blobBase64(jpg) });
      setPreview(URL.createObjectURL(jpg));
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
        {(preview || isPublicImagePath(value)) ? <img src={preview || pagesImageUrl(value)} alt="Выбранное изображение" /> : <UploadCloud size={32} />}
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
          placeholder="/images/uploads/….jpg"
        />
      </label>
      <small className="muted">JPG до 900 КБ, до 2000 px. На витрине и в PDF — после ближайшей сборки.</small>
      {error && <ErrorMessage message={error} />}
    </div>
  );
}
