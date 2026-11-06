import { assetUrl } from "../lib/site";
import { useEffect, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { ArrowUpRight, SlidersHorizontal, X } from "lucide-react";
import { aboutText, statuses, contentTypes, money } from "../../shared/gallery";
import { privacyText } from "../../shared/privacy";
import { useArtworks, useArtwork, useMedia, useSeries } from "../public-data";
import { EmbeddedMedia } from "../components/embedded-media";
import {
  ArtworkCard,
  ArchiveBanner,
  ErrorMessage,
  Loading,
  RequestModal,
  RequestForm,
} from "../components/gallery-ui";
import { RoomSimulator } from "../components/room-simulator";
import { PdfButton } from "../components/pdf-catalog";

export function Gallery() {
  const works = useArtworks();
  const series = useSeries().data;
  const [path] = useLocation();
  const [selected, setSelected] = useState("");
  const [technique, setTechnique] = useState("");
  const [status, setStatus] = useState("");
  const [filters, setFilters] = useState(false);
  useEffect(() => {
    setSelected(new URLSearchParams(window.location.search).get("series") || "");
  }, [path]);
  const filtered =
    works.data?.filter(
      (a) =>
        (!selected || a.series === selected) &&
        (!technique || a.technique.includes(technique)) &&
        (!status || a.status === status),
    ) ?? [];
  return (
    <>
      <section className="container page-head">
        <span className="eyebrow">Алексей Русин · Alain Rusin</span>
        <h1>
          Каталог <em>работ</em>
        </h1>
        <p className="page-intro">
          Диалог между строгой графикой и эмоциональной стихией живописи.
        </p>
      </section>
      <section className="container gallery-section">
        <div className="catalog-toolbar">
          <div className="tabs" role="tablist" aria-label="Серия">
            <button
              className={!selected ? "active" : ""}
              onClick={() => setSelected("")}
              role="tab"
              aria-selected={!selected}
            >
              Все работы
            </button>
            {series.map((s) => (
              <button
                role="tab"
                aria-selected={selected === s.slug}
                key={s.slug}
                className={selected === s.slug ? "active" : ""}
                onClick={() => setSelected(s.slug)}
              >
                {s.title}
              </button>
            ))}
          </div>
          <button
            className="text-link filter-button"
            onClick={() => setFilters(!filters)}
            aria-expanded={filters}
          >
            <SlidersHorizontal size={15} /> Фильтры
          </button>
        </div>
        {filters && (
          <div className="filter-panel">
            <label>
              Техника
              <select value={technique} onChange={(e) => setTechnique(e.target.value)}>
                <option value="">Все техники</option>
                <option>Сухая пастель</option>
                <option>Акрил</option>
                <option>Смешанная техника</option>
              </select>
            </label>
            <label>
              Статус
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Все статусы</option>
                {Object.entries(statuses).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="text-link"
              onClick={() => {
                setStatus("");
                setTechnique("");
                setSelected("");
              }}
            >
              Сбросить <X size={13} />
            </button>
          </div>
        )}
        <p className="catalog-count">
          {filtered.length} {filtered.length === 1 ? "работа" : "работы"}
        </p>
        {works.isLoading ? (
          <Loading />
        ) : works.error ? (
          <ErrorMessage message="Не удалось загрузить каталог" />
        ) : filtered.length ? (
          <div className="artwork-grid">
            {filtered.map((a) => (
              <ArtworkCard key={a.id} item={a} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            Работы не найдены.{" "}
            <button
              className="text-link"
              onClick={() => {
                setSelected("");
                setTechnique("");
                setStatus("");
              }}
            >
              Сбросить фильтры
            </button>
          </div>
        )}
      </section>
      <ArchiveBanner />
    </>
  );
}
export function ArtworkPage() {
  const { id = "" } = useParams<{ id: string }>();
  const work = useArtwork(id);
  const series = useSeries().data;
  const [modal, setModal] = useState("");
  const [room, setRoom] = useState(false);
  if (work.isLoading) return <Loading />;
  if (work.error || !work.data) return <NotFound />;
  const a = work.data;
  const s = series.find((s) => s.slug === a.series);
  return (
    <>
      <section className="container artwork-detail">
        <Link to="/gallery" className="breadcrumb">
          Каталог / {s?.title}
        </Link>
        <div className="detail-grid">
          <div className="detail-image">
            <img src={assetUrl(a.imageUrl)} alt={a.title} />
          </div>
          <div className="detail-copy">
            <span className="eyebrow">
              {s?.title} · {a.year}
            </span>
            <h1>{a.title}</h1>
            <span className={`status inline ${a.status}`}>
              {statuses[a.status as keyof typeof statuses]}
            </span>
            <p className="detail-description">{a.description}</p>
            <dl>
              {[
                ["Техника", a.technique],
                ["Размеры", a.dimensions],
                ["Оформление", a.framing],
                ["Год", a.year],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <p className="detail-price">{money(a.price)}</p>
            <button className="button filled" onClick={() => setModal("Запросить работу")}>
              Запросить работу <ArrowUpRight size={16} />
            </button>
            <button className="button" onClick={() => setRoom(!room)}>
              Примерить в интерьер <ArrowUpRight size={16} />
            </button>
          </div>
        </div>
        {room && <RoomSimulator artwork={a} onRequest={() => setModal("Запросить работу")} />}
      </section>
      <ArchiveBanner />
      {modal && <RequestModal artwork={a} action={modal} onClose={() => setModal("")} />}
    </>
  );
}
export function About() {
  const [modal, setModal] = useState(false);
  return (
    <>
      <section className="container page-head">
        <span className="eyebrow">О художнике</span>
        <h1>
          Алексей Русин
          <br />
          <em>Alain Rusin</em>
        </h1>
      </section>
      <section className="container about-grid">
        <div className="about-photo">
          <img src={assetUrl("/images/artist-portrait.jpg")}  alt="Алексей Русин" />
        </div>
        <div className="prose">
          {aboutText.split(/(?<=\.) /).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <a
            href="https://www.behance.net/liveeasier"
            target="_blank"
            rel="noreferrer"
            className="text-link"
          >
            Дизайн-портфолио на Behance <ArrowUpRight size={16} />
          </a>
          <button className="button" onClick={() => setModal(true)}>
            Пригласить на просмотр <ArrowUpRight size={16} />
          </button>
        </div>
      </section>
      <ArchiveBanner />
      {modal && <RequestModal action="Пригласить на просмотр" onClose={() => setModal(false)} />}
    </>
  );
}
export function Media() {
  const data = useMedia();
  const [tab, setTab] = useState<keyof typeof contentTypes>("interview");
  return (
    <>
      <section className="container page-head">
        <span className="eyebrow">Алексей Русин · Alain Rusin</span>
        <h1>
          Выставки <em>и пресса</em>
        </h1>
      </section>
      <section className="container media-section">
        <div className="tabs" role="tablist">
          {Object.entries(contentTypes).map(([key, label]) => (
            <button
              role="tab"
              aria-selected={tab === key}
              className={tab === key ? "active" : ""}
              key={key}
              onClick={() => setTab(key as keyof typeof contentTypes)}
            >
              {label}
            </button>
          ))}
        </div>
        {data.isLoading ? (
          <Loading />
        ) : data.error ? (
          <ErrorMessage message="Контент временно недоступен" />
        ) : (
          <div className="media-list">
            {data.data
              ?.filter((c) => c.type === tab)
              .map((c) => (
                <article key={c.id} className="media-card">
                  {c.embedUrl ? <EmbeddedMedia url={c.embedUrl} title={c.title} cover={c.coverUrl} /> : c.coverUrl ? <img src={assetUrl(c.coverUrl)} alt={c.title} loading="lazy" /> : <div className="media-cover-placeholder"><span>ALAIN RUSIN</span><p>{c.title}</p></div>}
                  <div>
                    <span className="eyebrow">
                      {contentTypes[tab]}
                      {c.eventDate && ` · ${c.eventDate}`}
                    </span>
                    <h2>{c.title}</h2>
                    {c.description && <p>{c.description}</p>}
                    {c.location && <p className="muted">{c.location}</p>}
                    {c.link && (
                      <a href={c.link} className="text-link" target="_blank" rel="noreferrer">
                        {tab === "interview" ? "Смотреть интервью" : "Открыть публикацию"}
                        <ArrowUpRight size={16} />
                      </a>
                    )}
                  </div>
                </article>
              ))}
            {!data.data?.some((c) => c.type === tab) && (
              <p className="empty-state">В этом разделе пока нет публикаций.</p>
            )}
          </div>
        )}
      </section>
      <ArchiveBanner />
    </>
  );
}
export function B2B() {
  const [action, setAction] = useState("");
  return (
    <>
      <section className="container page-head">
        <span className="eyebrow">Для профессионалов</span>
        <h1>
          Галереям
          <br />
          <em>и дизайнерам</em>
        </h1>
      </section>
      <section className="container b2b-section">
        <div className="b2b-list">
          {[
            [
              "Галереям и кураторам",
              "выставочные проекты и актуальный кураторский каталог.",
              "Обсудить заказ",
            ],
            [
              "Дизайнерам интерьеров",
              "подбор работы в проект, арт-объекты на заказ и примерка в интерьер.",
              "Обсудить заказ",
            ],
            [
              "Коллекционерам",
              "приватные просмотры в мастерской в Санкт-Петербурге.",
              "Пригласить на просмотр",
            ],
          ].map(([title, text, button], i) => (
            <article key={title}>
              <span className="eyebrow">0{i + 1}</span>
              <div>
                <h2>{title}</h2>
                <p>
                  {title} — {text}
                </p>
                <button className="text-link" onClick={() => setAction(button)}>
                  {button}
                  <ArrowUpRight size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
        <div className="pdf-panel">
          <span className="eyebrow">Alain Rusin</span>
          <h2>
            Каталог <em>работ</em>
          </h2>
          <img src={assetUrl("/images/seeds/aquatika.jpg")}  alt="Акватика" loading="lazy" />
          <PdfButton />
        </div>
      </section>
      <section className="container section">
        <RequestForm action="Обсудить заказ" />
      </section>
      <ArchiveBanner />
      {action && <RequestModal action={action} onClose={() => setAction("")} />}
    </>
  );
}
export function Privacy() {
  const [title, ...lines] = privacyText.split("\n");
  return (
    <section className="container page-head privacy">
      <h1>{title}</h1>
      <div className="privacy-text">
        {lines.filter(Boolean).map((line, i) => /^\d+\. /.test(line) ? <h2 key={i}>{line}</h2> : <p key={i}>{line}</p>)}
      </div>
    </section>
  );
}
export function NotFound() {
  return (
    <section className="container not-found">
      <span className="eyebrow">404 / Alain Rusin</span>
      <h1>
        Этот зал временно
        <br />
        <em>на реставрации.</em>
      </h1>
      <p>Работа, которую вы ищете, — в другом разделе коллекции.</p>
      <Link to="/gallery" className="button">
        Вернуться в каталог <ArrowUpRight size={16} />
      </Link>
    </section>
  );
}
