import { useState } from "react";
import { Download, LoaderCircle } from "lucide-react";
import { client } from "../lib/api";
import { ErrorMessage } from "./gallery-ui";

export function PdfButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    setPending(true);
    setError("");
    try {
      const [works, profile, { createCatalog }] = await Promise.all([
        client.gallery.artworks(),
        client.gallery.profile(),
        import("./catalog-document"),
      ]);
      const blob = await createCatalog(
        works.filter((a) => a.status === "available"),
        profile,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Alain-Rusin-${new Date().getFullYear()}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать PDF-каталог");
    } finally {
      setPending(false);
    }
  }
  return (
    <div>
      <button className="button" onClick={download} disabled={pending}>
        {pending ? <LoaderCircle className="spin" size={17} /> : <Download size={16} />}{" "}
        {pending ? "Подготовка каталога…" : "Получить кураторский PDF-каталог"}
      </button>
      {error && <ErrorMessage message={error} />}
    </div>
  );
}
