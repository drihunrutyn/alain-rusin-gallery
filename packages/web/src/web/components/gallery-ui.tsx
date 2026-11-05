import { Link, useLocation } from "wouter";
import { ArrowUpRight, ArrowRight, Menu, X, Check, LoaderCircle } from "lucide-react";
import { useEffect, useState, useRef, type FormEvent, type ReactNode } from "react";
import { statuses, contacts, money, award } from "../../shared/gallery";
import { useSeries } from "../public-data";
import { client } from "../lib/api";
import { adminSiteUrl, assetUrl, requestLinks } from "../lib/site";

export type Artwork = import("../../shared/gallery").ArtworkData;
export const IconArrow = ({ diagonal = false }: { diagonal?: boolean }) =>
  diagonal ? <ArrowUpRight size={16} /> : <ArrowRight size={16} />;
export function Loading() {
  return (
    <output className="loading">
      <LoaderCircle className="spin" size={20} /> Загрузка…
    </output>
  );
}
export function ErrorMessage({ message }: { message: string }) {
  return (
    <p className="form-error" role="alert">
      {message}
    </p>
  );
}
export function Header() {
  const [open, setOpen] = useState(false);
  const [path] = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [path]);
  const links = [
    ["/gallery", "Каталог"],
    ["/about", "О художнике"],
    ["/media", "Выставки и пресса"],
    ["/b2b", "Для профессионалов"],
  ];
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link to="/" className="brand" aria-label="Alain Rusin — главная">
          <img src={assetUrl("/images/logo.png")}  alt="Alain Rusin" />
        </Link>
        <nav className={open ? "nav open" : "nav"} aria-label="Основная навигация">
          {links.map(([href, label]) => (
            <Link key={href} to={href} className={path === href ? "active" : ""}>
              {label}
            </Link>
          ))}
          <a href="#contacts">Контакты</a>
        </nav>
        <a
          className="header-contact"
          href="https://t.me/alain_rusin"
          target="_blank"
          rel="noreferrer"
          aria-label="Написать в Telegram"
        >
          <ArrowUpRight size={20} />
        </a>
        <button
          className="menu-toggle"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Закрыть меню" : "Открыть меню"}
          aria-expanded={open}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  );
}
export function Footer() {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setState("pending");
    try {
      await client.gallery.subscribe({ email, consent: true });
      setState("success");
    } catch (err) {
      setState(err instanceof Error ? err.message : "Не удалось подписаться");
    }
  }
  return (
    <footer id="contacts" className="site-footer">
      <div className="container footer-grid">
        <div>
          <Link to="/" className="brand footer-brand">
            <img src={assetUrl("/images/logo.png")}  alt="Alain Rusin" loading="lazy" />
          </Link>
          <p className="muted">
            Алексей Русин (Alain Rusin)
            <br />
            Санкт-Петербург
          </p>
        </div>
        <div>
          <p className="eyebrow">Контакты</p>
          <div className="contact-links">
            {contacts.map((c) => (
              <a href={c.href} key={c.label} target="_blank" rel="noreferrer">
                {c.label}
                <ArrowUpRight size={14} />
              </a>
            ))}
          </div>
        </div>
        <form onSubmit={submit} className="subscribe">
          <label className="eyebrow" htmlFor="subscribe-email">
            Подписаться на новые работы
          </label>
          {state === "success" ? (
            <p className="success">
              <Check size={16} /> Вы подписаны
            </p>
          ) : (
            <>
              <div className="email-line">
                <input
                  aria-label="Email"
                  id="subscribe-email"
                  type="email"
                  placeholder="Ваш email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <button
                  aria-label="Подписаться на новые работы"
                  disabled={!consent || state === "pending"}
                >
                  {state === "pending" ? (
                    <LoaderCircle className="spin" size={18} />
                  ) : (
                    <ArrowRight size={20} />
                  )}
                </button>
              </div>
              <label className="consent">
                <input
                  aria-label="Согласен на обработку персональных данных"
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  required
                />
                <span>
                  Согласен на обработку <Link to="/privacy">персональных данных</Link>
                </span>
              </label>
              {state && state !== "pending" && <ErrorMessage message={state} />}
            </>
          )}
        </form>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} Alain Rusin</span>
        <Link to="/privacy">Персональные данные</Link>
        <a href={`${adminSiteUrl}/admin/login`}>
          Личный кабинет <ArrowUpRight size={12} />
        </a>
      </div>
    </footer>
  );
}
export function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
    </>
  );
}
export function ArtworkCard({ item }: { item: Artwork }) {
  const series = useSeries().data;
  return (
    <Link to={`/artwork/${item.id}`} className="artwork-card">
      <div className="artwork-image">
        <img src={assetUrl(item.imageUrl)} alt={item.title} loading="lazy" />
        <span className={`status ${item.status}`}>
          {statuses[item.status as keyof typeof statuses]}
        </span>
        <span className="image-arrow">
          <ArrowUpRight size={20} />
        </span>
      </div>
      <div className="artwork-meta">
        <span className="eyebrow">
          {series.find((s) => s.slug === item.series)?.title} · {item.year}
        </span>
        <h3>{item.title}</h3>
        <div className="artwork-bottom">
          <span>{item.dimensions}</span>
          <span>{money(item.price)}</span>
        </div>
      </div>
    </Link>
  );
}
export function ArchiveBanner() {
  return (
    <section className="container archive-block">
      <a
        href="https://artchive.ru/alain_rusin"
        target="_blank"
        rel="noreferrer"
        className="archive-banner"
        aria-label="Полный архив работ и выставок — на Артхиве"
      >
        <img
          src={assetUrl("/images/artchive-cta.jpg")}
          alt="Полный архив работ и выставок. 40+ работ, статьи и хроника выставок — на Артхиве."
          loading="lazy"
        />
        <span className="archive-icon">
          <ArrowUpRight size={28} />
        </span>
      </a>
    </section>
  );
}
export function AwardLine() {
  return (
    <div className="award-line container">
      <span className="award-symbol">✦</span>
      <p>{award}</p>
      <span className="award-year">2025 / 2026</span>
    </div>
  );
}
export function RequestForm({
  artwork,
  action = "Запросить работу",
  onClose,
}: {
  artwork?: Artwork;
  action?: string;
  onClose?: () => void;
}) {
  const [state, setState] = useState("");
  const [consent, setConsent] = useState(false);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!consent) return;
    const data = new FormData(e.currentTarget);
    const links = requestLinks(artwork?.title || "", artwork?.dimensions || "", String(data.get("contact") || ""), String(data.get("name") || ""), `${action}\n${String(data.get("message") || "")}`);
    const button = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (button?.value === "vk") window.open(links.vk, "_blank", "noopener,noreferrer");
    else window.location.href = links.mail;
    setState("Ссылка открыта. Отправьте сообщение в почтовом приложении или VK — сайт не отправляет и не сохраняет заявку.");
  }
  return (
    <div className="request-panel">
      {onClose && (
        <button className="close-button" onClick={onClose} aria-label="Закрыть форму">
          <X />
        </button>
      )}
      <span className="eyebrow">Алексей Русин · Санкт-Петербург</span>
      <h2>{action}</h2>
      {artwork && <p className="muted">{artwork.title}</p>}
        <form onSubmit={submit}>
          <label>
            Ваше имя
            <input
              aria-label="Ваше имя"
              name="name"
              required
              minLength={2}
              maxLength={150}
              autoComplete="name"
            />
          </label>
          <label>
            Телефон, email или Telegram
            <input
              aria-label="Телефон, email или Telegram"
              name="contact"
              required
              minLength={5}
              maxLength={200}
              autoComplete="email"
            />
          </label>
          <label>
            Сообщение
            <textarea aria-label="Сообщение" name="message" rows={3} maxLength={5000} />
          </label>
          <input
            className="honeypot"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
          />
          <label className="consent">
            <input
              aria-label="Согласен(на) на обработку персональных данных в целях ответа на мою заявку"
              type="checkbox"
              required
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              Согласен(на) на обработку персональных данных в целях ответа на мою заявку. <Link to="/privacy">Политика обработки персональных данных</Link>
            </span>
          </label>
          {state && <output className="muted">{state}</output>}
          <p className="muted small">Выберите способ связи. Сообщение нужно отправить самостоятельно.</p>
          <div className="form-actions">
            <button type="submit" name="channel" value="mail" className="button filled" disabled={!consent}>Почта <ArrowUpRight size={16} /></button>
            <button type="submit" name="channel" value="vk" className="button" disabled={!consent}>ВКонтакте <ArrowUpRight size={16} /></button>
          </div>
        </form>
    </div>
  );
}
export function RequestModal({
  artwork,
  action,
  onClose,
}: {
  artwork?: Artwork;
  action: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const last = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.querySelector<HTMLElement>(".request-panel input")?.focus();
    return () => {
      document.body.style.overflow = old;
      last?.focus();
    };
  }, [onClose]);
  return (
    <dialog ref={dialog} className="request-dialog" aria-label={action} onCancel={onClose}>
      <RequestForm artwork={artwork} action={action} onClose={onClose} />
    </dialog>
  );
}
