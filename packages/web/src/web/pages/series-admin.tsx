import { useEffect, useRef, useState, type FormEvent } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { client } from "../lib/api";
import { useAdminSeries } from "../queries/gallery";
import { seriesInput } from "../../shared/series";
import { ImageUpload } from "../components/upload";
import { Loading, ErrorMessage } from "../components/gallery-ui";

type Series = Awaited<ReturnType<typeof client.management.series>>[number];
const message = (e: unknown) => e instanceof Error ? e.message : "Не удалось сохранить серию";
const notice = "Изменения сохранены. Витрина и PDF обновятся после следующей сборки (10:00, 13:00, 16:00, 19:00 по Москве). Срочно: GitHub Actions → Run workflow.";

export function SeriesAdmin() {
  const query = useAdminSeries();
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Series | "new" | null>(null);
  const [remove, setRemove] = useState<Series | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  async function done() { await qc.invalidateQueries(); setStatus(notice); setError(""); }
  async function deletion(s: Series, action: "delete" | "archive" | "transfer" = "delete", targetId?: number) {
    setPending(true); setError("");
    try { await client.management.deleteSeries({ id: s.id, action, targetId }); setRemove(null); await done(); }
    catch (e) { setError(message(e)); await qc.invalidateQueries(); }
    finally { setPending(false); }
  }
  async function archive(s: Series) {
    setPending(true); setError("");
    try { await client.management.saveSeries(seriesInput.parse({ ...s, archived: !s.archived })); await done(); }
    catch (e) { setError(message(e)); } finally { setPending(false); }
  }
  return <>
    <div className="admin-page-heading"><h1>Серии</h1><button className="button" onClick={() => setEdit("new")} disabled={pending}><Plus size={16} />Добавить серию</button></div>
    {status && <output className="muted">{status}</output>}
    {error && !remove && <ErrorMessage message={error} />}
    {edit ? <SeriesEditor key={typeof edit === "string" ? "new" : edit.id} series={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} onSaved={async () => { setEdit(null); await done(); }} /> : query.isLoading ? <Loading /> : query.error ? <ErrorMessage message="Не удалось загрузить серии" /> : <div className="table-wrap"><table>
      <thead><tr><th>Порядок</th><th>Серия</th><th>Slug</th><th>Работ</th><th>Архив</th><th>Действия</th></tr></thead>
      <tbody>{query.data?.map(s => <tr key={s.id}>
        <td>{s.sortOrder}</td><td>{s.title}</td><td>{s.slug}</td><td>{s.artworkCount}</td>
        <td><input type="checkbox" checked={s.archived} disabled={pending} aria-label={`Архивировать ${s.title}`} onChange={() => void archive(s)} /></td>
        <td><div className="table-actions"><button aria-label={`Редактировать серию ${s.title}`} onClick={() => setEdit(s)} disabled={pending}><Pencil size={16} /></button><button aria-label={`Удалить серию ${s.title}`} disabled={pending} onClick={() => { setError(""); if (s.artworkCount > 0) setRemove(s); else void deletion(s); }}><Trash2 size={16} /></button></div></td>
      </tr>)}</tbody>
    </table></div>}
    {remove && <SeriesDeleteDialog series={remove} options={(query.data || []).filter(s => s.id !== remove.id && !s.archived)} pending={pending} error={error} onClose={() => { if (!pending) { setRemove(null); setError(""); } }} onDelete={(action, id) => deletion(remove, action, id)} />}
  </>;
}
function SeriesEditor({ series, onClose, onSaved }: { series?: Series; onClose: () => void; onSaved: () => Promise<void> }) {
  const [coverUrl, setCoverUrl] = useState(series?.coverUrl || "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const values = Object.fromEntries(new FormData(e.currentTarget));
    setPending(true); setError("");
    try { await client.management.saveSeries(seriesInput.parse({ ...values, id: series?.id, slug: series?.slug || values.slug, coverUrl, sortOrder: Number(values.sortOrder), archived: values.archived === "on" })); await onSaved(); }
    catch (e) { setError(message(e)); } finally { setPending(false); }
  }
  return <form className="admin-editor" onSubmit={submit}>
    <h2>{series ? "Редактировать серию" : "Добавить серию"}</h2><div className="editor-grid"><div className="editor-fields">
      <label>Slug<input aria-label="Slug серии" name="slug" defaultValue={series?.slug} readOnly={!!series} required pattern="[a-z0-9]+([_-][a-z0-9]+)*" maxLength={100} /><small className="muted">Не меняется после создания: адреса остаются стабильными.</small></label>
      <label>Название<input aria-label="Название серии" name="title" defaultValue={series?.title} required maxLength={300} /></label>
      <label>Описание<textarea aria-label="Описание серии" name="description" defaultValue={series?.description} maxLength={10000} rows={4} /></label>
      <label>Порядок<input aria-label="Порядок серии" name="sortOrder" type="number" min={0} max={100000} defaultValue={series?.sortOrder || 0} required /></label>
      <label className="consent"><input aria-label="Архивировать серию" type="checkbox" name="archived" defaultChecked={series?.archived} />Архивировать серию</label>
    </div><ImageUpload type="content" value={coverUrl} onChange={setCoverUrl} /></div>
    {error && <ErrorMessage message={error} />}<div className="form-actions"><button className="button filled" disabled={pending}>{pending ? "Сохранение…" : "Сохранить серию"}</button><button type="button" className="button" disabled={pending} onClick={onClose}>Отмена</button></div>
  </form>;
}
function SeriesDeleteDialog({ series, options, pending, error, onClose, onDelete }: { series: Series; options: Series[]; pending: boolean; error: string; onClose: () => void; onDelete: (action: "archive" | "transfer", id?: number) => Promise<void> }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [target, setTarget] = useState("");
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="request-dialog" aria-labelledby="series-delete-title" onCancel={e => { e.preventDefault(); onClose(); }}><div className="request-panel">
    <h2 id="series-delete-title">В серии «{series.title}» — {series.artworkCount} работ</h2>
    <p>Удаление запрещено, пока серия содержит картины. Перенос сохранит сами работы и их адреса. Архивирование скроет серию из витрины и PDF.</p>
    <label>Перенести работы в<select aria-label="Серия для переноса" value={target} onChange={e => setTarget(e.target.value)} disabled={pending}><option value="">Выберите серию</option>{options.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
    {error && <ErrorMessage message={error} />}<div className="form-actions">
      <button className="button" disabled={pending || !target} onClick={() => void onDelete("transfer", Number(target))}>Перенести {series.artworkCount} работ и удалить серию</button>
      <button className="button" disabled={pending} onClick={() => void onDelete("archive")}>Архивировать серию</button>
      <button className="text-link" disabled={pending} onClick={onClose}>Отмена</button>
    </div>
  </div></dialog>;
}
