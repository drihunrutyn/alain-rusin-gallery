import { useState, type FormEvent } from "react";
import { Link, Redirect, useLocation, useSearch } from "wouter";
import {
  LayoutDashboard,
  Image,
  Inbox,
  FileText,
  Settings,
  LogOut,
  Plus,
  Pencil,
  Trash2,
  Check,
  ArrowUpRight,
  Eye,
  LockKeyhole,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { client } from "../lib/api";
import {
  useMe,
  useAdminWorks,
  useAdminSeries,
  useAdminContent,
  useAdminRequests,
  useAdminStats,
  useAdminSettings,
  useAdminRooms,
  useSubscribers,
} from "../queries/gallery";
import {
  statuses,
  contentTypes,
  artworkInput,
  contentInput,
  money,
} from "../../shared/gallery";
import { Loading, ErrorMessage, type Artwork } from "../components/gallery-ui";
import { ImageUpload } from "../components/upload";
import { EmbeddedMedia } from "../components/embedded-media";
import { SeriesAdmin } from "./series-admin";
import { PdfButton } from "../components/pdf-catalog";
import { publicSiteUrl } from "../lib/site";
import { requestStatuses, normalizedRequestStatus } from "../../shared/requests";
function AdminPdfButton() {
  return <PdfButton loadData={async () => {
    const [artworks, profile, series] = await Promise.all([client.management.artworks(), client.management.profile(), client.management.series()]);
    return { artworks, profile, series };
  }} />;
}
function savedNotice() { return "Изменения сохранены. Витрина обновляется в 10:00, 13:00, 16:00 и 19:00 по Москве. Срочное обновление: GitHub Actions → Deploy static storefront → Run workflow."; }


type MediaItem = Awaited<ReturnType<typeof client.management.content>>[number];
type Request = Awaited<ReturnType<typeof client.management.requests>>[number];
const formObject = (form: HTMLFormElement) => Object.fromEntries(new FormData(form));
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Не удалось сохранить изменения";
export function AdminLogin() {
  const me = useMe();
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [, navigate] = useLocation();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError("");
    const data = formObject(e.currentTarget);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: data.login, password: data.password }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      await qc.invalidateQueries();
      navigate("/admin");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setPending(false);
    }
  }
  if (me.isLoading) return <Loading />;
  if (me.data) return <Redirect to="/admin" />;
  return (
    <main className="login-screen">
      <a href={publicSiteUrl} className="brand">
        <img src="/images/logo.png" alt="Alain Rusin" />
      </a>
      <div className="login-panel">
        <LockKeyhole size={23} />
        <span className="eyebrow">Alain Rusin</span>
        <h1>Личный кабинет</h1>
        <form onSubmit={submit}>
          <label>
            Логин
            <input aria-label="Логин" name="login" autoComplete="username" required />
          </label>
          <label>
            Пароль
            <input
              aria-label="Пароль"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          {error && <ErrorMessage message={error} />}
          <button className="button filled" disabled={pending}>
            {pending ? "Вход…" : "Войти"}
            <ArrowUpRight size={16} />
          </button>
        </form>
      </div>
      <a href={publicSiteUrl} className="text-link">
        Вернуться на сайт
      </a>
    </main>
  );
}
export function Admin() {
  const me = useMe();
  const [path] = useLocation();
  const qc = useQueryClient();
  const section = path.split("/")[2] || "dashboard";
  const search = useSearch();
  const contentType = (new URLSearchParams(search).get("type") ||
    "interview") as keyof typeof contentTypes;
  const nav = [
    ["/admin", "Дашборд", LayoutDashboard],
    ["/admin/artworks", "Работы", Image],
    ["/admin/series", "Серии", Image],
    ["/admin/requests", "Заявки", Inbox],
    ...Object.entries(contentTypes).map(([type, title]) => [
      "/admin/content?type=" + type,
      title,
      FileText,
    ]),
    ["/admin/settings", "Настройки", Settings],
  ] as const;
  if (me.isLoading) return <Loading />;
  if (!me.data) return <Redirect to="/admin/login" />;
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <a href={publicSiteUrl} className="brand">
          <img src="/images/logo.png" alt="Alain Rusin" />
        </a>
        <p className="eyebrow">Личный кабинет</p>
        <nav aria-label="Управление сайтом">
          {nav.map(([href, title, Icon]) => (
            <Link
              key={String(href)}
              to={String(href)}
              className={
                href === (section === "content" ? "/admin/content?type=" + contentType : path)
                  ? "active"
                  : ""
              }
            >
              <Icon size={17} />
              {String(title)}
            </Link>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <a href={publicSiteUrl} className="text-link">
            Открыть сайт
            <ArrowUpRight size={15} />
          </a>
          <button
            className="text-link"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              qc.clear();
              window.location.href = "/admin/login";
            }}
          >
            <LogOut size={16} /> Выйти
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <div className="admin-topbar">
          <span>Алексей Русин · Alain Rusin</span>
          <span className="admin-secure">
            <LockKeyhole size={13} /> {me.data.login}
          </span>
        </div>
        {section === "dashboard" ? (
          <Dashboard />
        ) : section === "artworks" ? (
          <ArtworksAdmin />
        ) : section === "series" ? (
          <SeriesAdmin />
        ) : section === "requests" ? (
          <RequestsAdmin />
        ) : section === "content" ? (
          <ContentAdmin type={contentType in contentTypes ? contentType : "interview"} />
        ) : section === "settings" ? (
          <SettingsAdmin />
        ) : (
          <Redirect to="/admin" />
        )}
      </main>
    </div>
  );
}
function Chart({ data, title }: { data: { label: string; count: number }[]; title: string }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="chart-card">
      <h3>{title}</h3>
      <svg viewBox="0 0 520 170" aria-label={title}>
        <title>{title}</title>
        {data.map((d, i) => (
          <g key={d.label}>
            <rect
              x={(i * 500) / data.length + 10}
              y={140 - (d.count / max) * 110}
              width={Math.max(4, 500 / data.length - 8)}
              height={Math.max(1, (d.count / max) * 110)}
              fill="#B8996F"
            >
              <title>
                {d.label}: {d.count}
              </title>
            </rect>
            {data.length < 10 && (
              <>
                <text x={(i * 500) / data.length + 12} y={158} fill="#A6A29B" fontSize="10">
                  {d.label.slice(5)}
                </text>
                <text
                  x={(i * 500) / data.length + 12}
                  y={130 - (d.count / max) * 110}
                  fill="#EDEAE4"
                  fontSize="10"
                >
                  {d.count}
                </text>
              </>
            )}
          </g>
        ))}
        <line x1="0" y1="141" x2="520" y2="141" stroke="#2A2A2A" />
      </svg>
    </div>
  );
}
function Dashboard() {
  const stats = useAdminStats(true);
  const qc = useQueryClient();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function process(id: string) {
    setBusy(id);
    try {
      await client.management.processRequest({ id, status: "in_progress" });
      await qc.invalidateQueries();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  }
  if (stats.isLoading) return <Loading />;
  if (stats.error || !stats.data) return <ErrorMessage message="Не удалось загрузить метрики" />;
  const s = stats.data;
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow">Личный кабинет</span>
          <h1>Дашборд</h1>
        </div>
        <AdminPdfButton />
      </div>
      <div className="stats-grid">
        {([
          ["Работ в наличии", s.available, Image],
          ["Новые заявки", s.newRequests, Inbox],
          ["Просмотры за 30 дней", s.views30, Eye],
        ] as const).map(([label, value, Icon]) => (
          <div className="stat-card" key={String(label)}>
            <div>
              <span>{String(label)}</span>
              <Icon size={19} />
            </div>
            <strong>{String(value)}</strong>
          </div>
        ))}
      </div>
      <div className="charts-grid">
        <Chart data={s.months} title="Заявки по месяцам" />
        <Chart data={s.days} title="Просмотры по дням" />
      </div>
      <div className="dashboard-lists">
        <section className="admin-card">
          <h3>Топ-5 работ по просмотрам</h3>
          {s.top.map((a) => (
            <a className="top-artwork" key={a.id} href={`${publicSiteUrl}/artwork/${a.id}/`}>
              <span>{a.title}</span>
              <span>{a.views}</span>
            </a>
          ))}
        </section>
        <section className="admin-card">
          <h3>Последние заявки</h3>
          {!s.recent.length && <p className="muted">Заявок пока нет</p>}
          {s.recent.map((r) => (
            <div className="request-row" key={r.id}>
              <div>
                <strong>{r.clientName}</strong>
                <p>{r.artworkTitle || r.message.split("\n")[0]}</p>
              </div>
              {r.status === "new" ? (
                <button
                  className="small-button"
                  disabled={busy === r.id}
                  onClick={() => void process(r.id)}
                >
                  Обработана
                </button>
              ) : (
                <Check size={16} />
              )}
            </div>
          ))}
        </section>
      </div>
      {error && <ErrorMessage message={error} />}
    </>
  );
}
function ArtworksAdmin() {
  const data = useAdminWorks(true);
  const series = useAdminSeries().data || [];
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Artwork | "new" | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  async function remove(id: string) {
    if (!window.confirm("Удалить работу из каталога?")) return;
    setBusy(id);
    try {
      await client.management.deleteArtwork({ id });
      setError(savedNotice());
      await qc.invalidateQueries();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  }
  async function featured(a: Artwork) {
    setBusy(a.id);
    const key = data.data;
    qc.setQueryData(
      data.queryKey,
      data.data?.map((w) => (w.id === a.id ? { ...w, isFeatured: !w.isFeatured } : w)),
    );
    try {
      await client.management.saveArtwork(artworkInput.parse({ ...a, isFeatured: !a.isFeatured }));
      setError(savedNotice());
      await qc.invalidateQueries();
    } catch (e) {
      qc.setQueryData(data.queryKey, key);
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <div className="admin-page-heading">
        <h1>Работы</h1>
        <button className="button" onClick={() => setEdit("new")}>
          <Plus size={16} />
          Добавить работу
        </button>
      </div>
      {error && <ErrorMessage message={error} />}{" "}
      {edit ? (
        <ArtworkEditor
          artwork={edit === "new" ? undefined : edit}
          onClose={() => setEdit(null)}
          onSaved={async () => {
            setEdit(null);
            setError(savedNotice());
            await qc.invalidateQueries();
          }}
        />
      ) : data.isLoading ? (
        <Loading />
      ) : data.error ? (
        <ErrorMessage message="Не удалось загрузить работы" />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Работа</th>
                <th>Серия</th>
                <th>Цена</th>
                <th>Статус</th>
                <th>На главной</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {data.data?.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div className="table-art">
                      <img src={a.imageUrl} alt={a.title} />
                      <span>
                        {a.title}
                        <small>
                          {a.year} · {a.dimensions}
                        </small>
                      </span>
                    </div>
                  </td>
                  <td>{series.find((s) => s.slug === a.series)?.title}</td>
                  <td>{money(a.price)}</td>
                  <td>{statuses[a.status as keyof typeof statuses]}</td>
                  <td>
                    <input
                      type="checkbox"
                      checked={a.isFeatured}
                      onChange={() => void featured(a)}
                      disabled={busy === a.id}
                      aria-label={`${a.title} — на главной`}
                    />
                  </td>
                  <td>
                    <div className="table-actions">
                      <button aria-label={`Редактировать ${a.title}`} onClick={() => setEdit(a)}>
                        <Pencil size={16} />
                      </button>
                      <button
                        aria-label={`Удалить ${a.title}`}
                        disabled={busy === a.id}
                        onClick={() => void remove(a.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
function ArtworkEditor({
  artwork,
  onClose,
  onSaved,
}: {
  artwork?: Artwork;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [imageUrl, setImageUrl] = useState(artwork?.imageUrl ?? "");
  const seriesQuery = useAdminSeries();
  const series = (seriesQuery.data || []).filter(s => !s.archived || s.slug === artwork?.series);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = formObject(e.currentTarget);
    setPending(true);
    setError("");
    try {
      await client.management.saveArtwork(
        artworkInput.parse({
          ...d,
          id: artwork?.id,
          price: Number(d.price),
          year: Number(d.year),
          isFeatured: d.isFeatured === "on",
          imageUrl,
        }),
      );
      await onSaved();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setPending(false);
    }
  }
  return (
    <form className="admin-editor" onSubmit={submit}>
      <h2>{artwork ? "Редактировать работу" : "Добавить работу"}</h2>
      <div className="editor-grid">
        <div className="editor-fields">
          <label>
            Название
            <input aria-label="Название" name="title" defaultValue={artwork?.title} required />
          </label>
          <div className="two-cols">
            <label>
              Серия
              <select aria-label="Серия" name="series" defaultValue={artwork?.series}>
                {series.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.title}{s.archived ? " (архив)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Год
              <input
                    aria-label="Год"
                name="year"
                type="number"
                min="1900"
                max="2100"
                defaultValue={artwork?.year ?? 2026}
                required
              />
            </label>
          </div>
          <label>
            Техника
            <input aria-label="Техника" name="technique" defaultValue={artwork?.technique} />
          </label>
          <div className="two-cols">
            <label>
              Размеры
              <input aria-label="Размеры" name="dimensions" defaultValue={artwork?.dimensions} />
            </label>
            <label>
              Цена, ₽
              <input
                aria-label="Цена, ₽"
                name="price"
                type="number"
                min="0"
                step="1"
                defaultValue={artwork?.price ?? 0}
              />
            </label>
          </div>
          <label>
            Оформление
            <input aria-label="Оформление" name="framing" defaultValue={artwork?.framing} />
          </label>
          <label>
            Статус
            <select aria-label="Статус" name="status" defaultValue={artwork?.status ?? "available"}>
              {Object.entries(statuses).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Описание
            <textarea
              aria-label="Описание"
              name="description"
              rows={4}
              defaultValue={artwork?.description}
            />
          </label>
          <label className="consent">
            <input
              aria-label="Показывать на главной"
              name="isFeatured"
              type="checkbox"
              defaultChecked={artwork?.isFeatured}
            />
            <span>Показывать на главной</span>
          </label>
        </div>
        <ImageUpload value={imageUrl} onChange={setImageUrl} />
      </div>
      {error && <ErrorMessage message={error} />}
      <div className="form-actions">
        <button className="button filled" disabled={pending || !imageUrl || seriesQuery.isLoading || !series.length}>
          {pending ? "Сохранение…" : "Сохранить"}
        </button>
        <button type="button" className="button" onClick={onClose}>
          Отмена
        </button>
      </div>
    </form>
  );
}
function contactHref(contact: string) {
  if (contact.startsWith("@")) return "https://t.me/" + contact.slice(1);
  if (contact.includes("@")) return "mailto:" + contact;
  if (contact.startsWith("https://t.me/")) return contact;
  return "tel:" + contact.replace(/[^+\d]/g, "");
}
function RequestsAdmin() {
  const data = useAdminRequests(true);
  const subscriptions = useSubscribers(true);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const qc = useQueryClient();
  const works = useAdminWorks(true);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState("");
  async function process(r: Request, status: keyof typeof requestStatuses) {
    setBusy(r.id); setError("");
    try { await client.management.processRequest({ id: r.id, status }); await qc.invalidateQueries(); }
    catch (e) { setError(errorText(e)); } finally { setBusy(""); }
  }
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy("create"); setError(""); setNotice("");
    const d = formObject(e.currentTarget);
    try {
      await client.management.createRequest({ clientName: String(d.clientName), clientContact: String(d.clientContact), artworkId: String(d.artworkId), status: String(d.status) as keyof typeof requestStatuses });
      setAdding(false); setNotice("Заявка добавлена"); await qc.invalidateQueries();
    } catch (e) { setError(errorText(e)); } finally { setBusy(""); }
  }
  return (
    <>
      <div className="admin-page-heading">
        <h1>Заявки</h1>
        <button className="button" onClick={() => { setAdding(!adding); setError(""); }}><Plus size={16} />Добавить заявку вручную</button>
      </div>
      {notice && <output>{notice}</output>}
      {adding && <form className="admin-editor editor-fields" onSubmit={create}>
        <h2>Добавить заявку вручную</h2>
        <label>Имя клиента<input name="clientName" aria-label="Имя клиента" required maxLength={150} /></label>
        <label>Контакт<input name="clientContact" aria-label="Контакт" required maxLength={200} /></label>
        <label>Название картины<select name="artworkId" aria-label="Название картины" required defaultValue="" disabled={works.isLoading || !!works.error}>
          <option value="" disabled>Выберите картину</option>
          {works.data?.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
        </select></label>
        {works.error && <ErrorMessage message="Не удалось загрузить список картин" />}
        {!works.isLoading && !works.data?.length && <p className="muted">Сначала добавьте картину в каталог.</p>}
        <label>Статус<select name="status" aria-label="Статус заявки" defaultValue="new">{Object.entries(requestStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <div className="form-actions"><button className="button filled" disabled={busy === "create" || !works.data?.length}>{busy === "create" ? "Сохранение…" : "Добавить заявку"}</button><button type="button" className="button" onClick={() => setAdding(false)}>Отмена</button></div>
      </form>}
      <div className="tabs">
        {[
          ["", "Все заявки"],
          ...Object.entries(requestStatuses),
        ].map(([key, title]) => (
          <button
            key={key}
            className={filter === key ? "active" : ""}
            onClick={() => setFilter(key)}
          >
            {title}
          </button>
        ))}
      </div>
      {error && <ErrorMessage message={error} />}{" "}
      {data.isLoading ? (
        <Loading />
      ) : data.error ? (
        <ErrorMessage message="Не удалось загрузить заявки" />
      ) : (
        <div className="requests-list">
          {data.data
            ?.filter((r) => !filter || normalizedRequestStatus(r.status) === filter)
            .map((r) => (
              <article className="request-card" key={r.id}>
                <div>
                  <span className="eyebrow">
                    {new Date(r.createdAt).toLocaleDateString("ru-RU")} ·{" "}
                    {requestStatuses[normalizedRequestStatus(r.status)]}
                  </span>
                  <h3>{r.clientName}</h3>
                  <a className="text-link" href={contactHref(r.clientContact)}>
                    {r.clientContact}
                    <ArrowUpRight size={14} />
                  </a>
                  {r.artworkTitle && <p>{r.artworkTitle}</p>}
                  <p className="muted">{r.message}</p>
                </div>
                <label>Статус<select aria-label={`Статус заявки ${r.clientName}`} disabled={busy === r.id} value={normalizedRequestStatus(r.status)} onChange={e => void process(r, e.target.value as keyof typeof requestStatuses)}>
                  {Object.entries(requestStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select></label>
              </article>
            ))}
          {!data.data?.filter((r) => !filter || normalizedRequestStatus(r.status) === filter).length && (
            <p className="empty-state">Заявок пока нет</p>
          )}
        </div>
      )}
      <section className="admin-card">
        <h3>Подписчики на новые работы</h3>
        {subscriptions.isLoading ? (
          <Loading />
        ) : subscriptions.data?.length ? (
          subscriptions.data.map((s) => (
            <p key={s.id}>
              <a href={`mailto:${s.email}`}>{s.email}</a>
              <span className="muted small">
                {" "}
                · {new Date(s.createdAt).toLocaleDateString("ru-RU")}
              </span>
            </p>
          ))
        ) : (
          <p className="muted">Подписчиков пока нет</p>
        )}
      </section>
    </>
  );
}
function ContentAdmin({ type }: { type: keyof typeof contentTypes }) {
  const data = useAdminContent(true);
  const qc = useQueryClient();
  const [edit, setEdit] = useState<MediaItem | "new" | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  async function remove(id: string) {
    if (!window.confirm("Удалить публикацию?")) return;
    setBusy(id);
    try {
      await client.management.deleteContent({ id });
      setError(savedNotice());
      await qc.invalidateQueries();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <div className="admin-page-heading">
        <h1>{contentTypes[type]}</h1>
        <button className="button" onClick={() => setEdit("new")}>
          <Plus size={16} />
          Добавить
        </button>
      </div>
      {error && <ErrorMessage message={error} />}{" "}
      {edit ? (
        <ContentEditor
          item={edit === "new" ? undefined : edit}
          type={type}
          onClose={() => setEdit(null)}
          onSaved={async () => {
            setEdit(null);
            setError(savedNotice());
            await qc.invalidateQueries();
          }}
        />
      ) : data.isLoading ? (
        <Loading />
      ) : data.error ? (
        <ErrorMessage message="Не удалось загрузить контент" />
      ) : (
        <div className="admin-card">
          {data.data
            ?.filter((c) => c.type === type)
            .map((c) => (
              <div className="content-admin-row" key={c.id}>
                <div>
                  <h3>{c.title}</h3>
                  <p className="muted small">{c.eventDate || c.link}</p>
                </div>
                <div className="table-actions">
                  <button aria-label="Редактировать публикацию" onClick={() => setEdit(c)}>
                    <Pencil size={17} />
                  </button>
                  <button
                    aria-label="Удалить публикацию"
                    disabled={busy === c.id}
                    onClick={() => void remove(c.id)}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            ))}
          {!data.data?.some((c) => c.type === type) && <p className="muted">Публикаций пока нет</p>}
        </div>
      )}
    </>
  );
}
function ContentEditor({
  item,
  type,
  onClose,
  onSaved,
}: {
  item?: MediaItem;
  type: keyof typeof contentTypes;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [imageUrl, setImageUrl] = useState(item?.imageUrl || "");
  const [videoUrl, setVideoUrl] = useState(item?.embedUrl || "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = formObject(e.currentTarget);
    setPending(true);
    try {
      await client.management.saveContent(contentInput.parse({ ...d, id: item?.id, imageUrl }));
      await onSaved();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setPending(false);
    }
  }
  return (
    <form className="admin-editor" onSubmit={submit}>
      <div className="editor-grid">
        <div className="editor-fields">
          <label>
            Тип
            <select aria-label="Тип" name="type" defaultValue={item?.type ?? type}>
              {Object.entries(contentTypes).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Заголовок
            <input aria-label="Заголовок" name="title" defaultValue={item?.title} required />
          </label>
          <label>
            Описание
            <textarea
              aria-label="Описание"
              name="description"
              rows={4}
              defaultValue={item?.description}
            />
          </label>
          <label>
            Ссылка
            <input aria-label="Ссылка" name="link" type="url" defaultValue={item?.link} />
          </label>
          <label>
            Ссылка на видео
            <input aria-label="Ссылка на видео" name="embedUrl" type="url" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} />
            <small className="muted">
              Вставьте исходную ссылку на любую платформу или видеофайл. В базе сохраняется исходный URL.
            </small>
          </label>
          {videoUrl && <EmbeddedMedia url={videoUrl} title={item?.title || "Превью видео"} cover={imageUrl} />}
          <div className="two-cols">
            <label>
              Локация
              <input aria-label="Локация" name="location" defaultValue={item?.location} />
            </label>
            <label>
              Дата
              <input
                aria-label="Дата"
                name="eventDate"
                type="date"
                defaultValue={item?.eventDate}
              />
            </label>
          </div>
        </div>
        <ImageUpload type="content" value={imageUrl} onChange={setImageUrl} />
      </div>
      {error && <ErrorMessage message={error} />}
      <div className="form-actions">
        <button className="button filled" disabled={pending}>
          {pending ? "Сохранение…" : "Сохранить"}
        </button>
        <button type="button" className="button" onClick={onClose}>
          Отмена
        </button>
      </div>
    </form>
  );
}
function SettingsAdmin() {
  const data = useAdminSettings(true);
  const rooms = useAdminRooms();
  const qc = useQueryClient();
  const [roomUrl, setRoomUrl] = useState("");
  const [state, setState] = useState("");
  const [pending, setPending] = useState(false);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = formObject(e.currentTarget);
    setPending(true);
    try {
      await client.management.saveSettings({ email: String(d.email), city: String(d.city) });
      await qc.invalidateQueries();
      setState(savedNotice());
    } catch (err) {
      setState(errorText(err));
    } finally {
      setPending(false);
    }
  }
  async function password(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = formObject(e.currentTarget);
    setPending(true);
    try {
      await client.management.password({
        currentPassword: String(d.currentPassword),
        newPassword: String(d.newPassword),
      });
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/admin/login";
    } catch (err) {
      setState(errorText(err));
    } finally {
      setPending(false);
    }
  }
  if (data.isLoading) return <Loading />;
  if (data.error || !data.data) return <ErrorMessage message="Не удалось загрузить настройки" />;
  return (
    <>
      <div className="admin-page-heading">
        <h1>Настройки</h1>
      </div>
      {state && <output className="form-status">{state}</output>}
      <div className="settings-grid">
        <form className="admin-card editor-fields" onSubmit={save}>
          <h3>Реквизиты для PDF</h3>
          <label>
            Email
            <input aria-label="Email" name="email" type="email" defaultValue={data.data.email} />
          </label>
          <label>
            Город
            <input aria-label="Город" name="city" defaultValue={data.data.city} required />
          </label>
          <button className="button" disabled={pending}>
            Сохранить
          </button>
          <AdminPdfButton />
        </form>
        <form className="admin-card editor-fields" onSubmit={password}>
          <h3>Смена пароля</h3>
          <label>
            Текущий пароль
            <input
              aria-label="Текущий пароль"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <label>
            Новый пароль
            <input
              aria-label="Новый пароль"
              name="newPassword"
              type="password"
              minLength={12}
              autoComplete="new-password"
              required
            />
          </label>
          <p className="muted small">
            Не менее 12 символов. После смены все сессии будут завершены.
          </p>
          <button className="button" disabled={pending}>
            Сменить пароль
          </button>
        </form>
      </div>
      <section className="admin-card">
        <h3>Фоны интерьеров</h3>
        <ImageUpload type="rooms" value={roomUrl} onChange={setRoomUrl} />
        <button
          className="button"
          disabled={!roomUrl || pending}
          onClick={async () => {
            setPending(true);
            try {
              await client.management.saveRoom({ imageUrl: roomUrl });
              setState(savedNotice());
              setRoomUrl("");
              await qc.invalidateQueries();
            } catch (err) {
              setState(errorText(err));
            } finally {
              setPending(false);
            }
          }}
        >
          Добавить интерьер
        </button>
        <div className="rooms-admin">
          {rooms.data?.map((r) => (
            <div key={r.id}>
              <img src={r.imageUrl} alt="Интерьер" />
              <button
                className="small-button"
                onClick={async () => {
                  if (window.confirm("Удалить фон интерьера?")) {
                    try {
                      await client.management.deleteRoom({ id: r.id });
                      setState(savedNotice());
                      await qc.invalidateQueries();
                    } catch (err) {
                      setState(errorText(err));
                    }
                  }
                }}
              >
                Удалить
              </button>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
