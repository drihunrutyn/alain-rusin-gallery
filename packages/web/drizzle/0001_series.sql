-- Additive, idempotent migration. No artworks/requests/subscribers are seeded or reset.
CREATE TABLE IF NOT EXISTS series (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO series (slug, title, description, cover_url, sort_order) VALUES
('aquatica', 'Акватика', 'Морские этюды сухой пастелью: физика света на гребне волны.', '/images/seeds/aquatika.jpg', 1),
('quiet_life', 'Тихая жизнь', 'Не мёртвая натура, а живой собеседник: тишина предметов, наполненная светом.', '/images/seeds/quiet-life.jpg', 2),
('iris_flowers', 'Цветы Ириды', 'Не изображение цветка, а его внутреннее сияние.', '/images/seeds/iris-flowers.jpg', 3),
('northern_palmyra', 'Северная Пальмира', 'Ведуты Петербурга взглядом средового дизайнера.', '/images/seeds/northern-palmyra.jpg', 4)
ON CONFLICT(slug) DO NOTHING;
