import { Link } from "wouter";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { series, aboutText } from "../../shared/gallery";
import { useArtworks } from "../queries/gallery";
import { imageUrl } from "../lib/images";
import {
  ArtworkCard,
  AwardLine,
  ArchiveBanner,
  Loading,
  ErrorMessage,
} from "../components/gallery-ui";

export default function Home() {
  const works = useArtworks();
  return (
    <>
      <section className="hero container">
        <div className="hero-copy">
          <div className="hero-label">
            <span className="line" /> Алексей Русин · Alain Rusin
          </div>
          <h1>
            АБСТРАКТНЫЙ
            <br />
            <span>РЕАЛИЗМ.</span>
          </h1>
          <h2>
            Диалог между строгой графикой
            <br className="desktop-break" /> и эмоциональной стихией живописи.
          </h2>
          <p>Где предмет узнаваем, но передан через призму света и внутреннего чувства формы.</p>
          <div className="hero-actions">
            <Link to="/gallery" className="button filled">
              Смотреть коллекцию <ArrowUpRight size={16} />
            </Link>
            <Link to="/b2b" className="text-link">
              Галереям и дизайнерам <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>
        <div className="hero-art">
          <img
            src={imageUrl("/images/hero-art.jpg")}
            alt="Тихая жизнь, Северная Пальмира, Цветы Ириды — триптих Алексея Русина"
            fetchPriority="high"
          />
          <div className="hero-art-caption">
            <span>Тихая жизнь</span>
            <span>Северная Пальмира</span>
            <span>Цветы Ириды</span>
          </div>
          <span className="hero-side-label">ALAIN RUSIN — САНКТ-ПЕТЕРБУРГ</span>
        </div>
        <a className="scroll-cue" href="#series">
          <span>Коллекция</span>
          <ArrowRight size={14} />
        </a>
      </section>
      <AwardLine />
      <section id="series" className="container section series-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Коллекция / 01</span>
            <h2>
              Коллекция <em>работ</em>
            </h2>
          </div>
          <Link to="/gallery" className="text-link">
            Каталог <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="series-grid">
          {series.map((s) => (
            <Link to={`/gallery?series=${s.id}`} key={s.id} className="series-card">
              <div className={`series-image ${s.id}`}>
                <img src={imageUrl(s.image)} alt={s.title} loading="lazy" />
                <span className="series-number">{s.number}</span>
              </div>
              <div className="series-title">
                <h3>{s.title}</h3>
                <ArrowUpRight size={19} />
              </div>
              <p>{s.description}</p>
              <span className="series-view">
                Смотреть серию <ArrowRight size={13} />
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section className="container section featured-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Каталог / 02</span>
            <h2>
              Работы <em>в наличии</em>
            </h2>
          </div>
          <Link to="/gallery" className="text-link">
            Смотреть коллекцию <ArrowUpRight size={16} />
          </Link>
        </div>
        {works.isLoading ? (
          <Loading />
        ) : works.error ? (
          <ErrorMessage message="Каталог временно недоступен" />
        ) : (
          <div className="artwork-grid">
            {works.data
              ?.filter((a) => a.isFeatured && a.status === "available")
              .slice(0, 4)
              .map((a) => (
                <ArtworkCard item={a} key={a.id} />
              ))}
          </div>
        )}
      </section>
      <section className="container artist-section section">
        <div className="artist-image">
          <img src={imageUrl("/images/artist-portrait.jpg")} alt="Алексей Русин (Alain Rusin)" loading="lazy" />
        </div>
        <div className="artist-copy">
          <span className="eyebrow">О художнике / 03</span>
          <h2>
            Алексей Русин
            <br />
            <em>Alain Rusin</em>
          </h2>
          <p>{aboutText.split(" Мой путь")[0]}</p>
          <p>
            Мой путь — постоянный диалог двух миров: точного языка графики и эмоциональной стихии
            живописи.
          </p>
          <Link to="/about" className="text-link">
            О художнике <ArrowUpRight size={16} />
          </Link>
        </div>
      </section>
      <ArchiveBanner />
    </>
  );
}
