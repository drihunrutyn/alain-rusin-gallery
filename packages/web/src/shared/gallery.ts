import { z } from "zod";

export const statuses = {
  available: "В наличии",
  reserved: "Зарезервирована",
  sold: "Продана",
  private: "Частная коллекция",
};
export const contentTypes = {
  interview: "Интервью",
  article: "Мои статьи",
  press: "СМИ обо мне",
  exhibition: "Выставки",
};
export const award =
  "Алексей Русин (Alain Rusin) • Лауреат архитектурной премии «Золотой Трезини» 2025 (серебро/золото, Эрмитаж) • Номинант 2026";
export const aboutText =
  "Алексей Русин (Alain Rusin) — художник и средовой дизайнер, Санкт-Петербург. Мой путь — постоянный диалог двух миров: точного языка графики и эмоциональной стихии живописи. Пройдя через глубокое изучение реализма, я пришёл к собственной манере — абстрактному реализму: предмет узнаваем, но пропущен через призму личного впечатления, игры света и внутреннего чувства формы. Мои проводники — Николай Фешин и французские импрессионисты. Лауреат архитектурной премии «Золотой Трезини» 2025 (серебро/золото, Эрмитаж), номинант 2026, член Национального союза пастелистов (2026).";
export const contacts = [
  { label: "Telegram", detail: "@alain_rusin", href: "https://t.me/alain_rusin" },
  { label: "ВКонтакте", detail: "alain_rusin", href: "https://vk.com/alain_rusin" },
  { label: "WhatsApp", detail: "+7 924 713-17-04", href: "https://wa.me/79247131704" },
  { label: "Behance", detail: "liveeasier", href: "https://www.behance.net/liveeasier" },
  { label: "Artchive", detail: "alain_rusin", href: "https://artchive.ru/alain_rusin" },
];
export const artworkInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(300),
  series: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:[_-][a-z0-9]+)*$/),
  technique: z.string().max(500).default(""),
  year: z.number().int().min(1900).max(2100).default(2025),
  dimensions: z.string().max(100).default(""),
  framing: z.string().max(500).default(""),
  price: z.number().min(0).max(100000000).default(0),
  status: z.enum(["available", "reserved", "sold", "private"]).default("available"),
  description: z.string().max(10000).default(""),
  imageUrl: z
    .string()
    .min(1)
    .max(2000)
    .refine(
      (v) => v.startsWith("/images/") || v.startsWith("https://"),
      "Нужна HTTPS-ссылка или путь /images/",
    ),
  isFeatured: z.boolean().default(false),
});
export const contentInput = z.object({
  id: z.string().uuid().optional(),
  type: z.enum(["interview", "article", "press", "exhibition"]),
  title: z.string().trim().min(1).max(300),
  description: z.string().max(10000).default(""),
  link: z.string().max(2000).default(""),
  embedUrl: z.string().max(2000).default(""),
  imageUrl: z.string().max(2000).default(""),
  location: z.string().max(300).default(""),
  eventDate: z.string().max(100).default(""),
});
export type ArtworkData = z.infer<typeof artworkInput> & { id: string; createdAt: string };
export type ContentData = z.infer<typeof contentInput> & { id: string; createdAt: string };
export const money = (price: number) =>
  price ? new Intl.NumberFormat("ru-RU").format(price) + " ₽" : "Стоимость по запросу";
export const seedArtworks = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    title: "Шёпот прибоя в сумерках",
    series: "aquatica",
    technique: "Сухая пастель, мел, бумага Pastelmat",
    year: 2025,
    dimensions: "30×40 см",
    framing: "дубовая рама лёгкой патины",
    price: 18000,
    imageUrl: "/images/seeds/aquatika.jpg",
    description:
      "Исследование физики света на гребне волны: пастель передаёт не форму воды, а её дыхание и температуру в час заката.",
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    title: "Полуденный кофе и тени",
    series: "quiet_life",
    technique: "Акрил, фактурная паста, холст на подрамнике",
    year: 2025,
    dimensions: "40×50 см",
    framing: "рама Certa, итальянская патина, бронза",
    price: 25000,
    imageUrl: "/images/seeds/quiet-life.jpg",
    description:
      "Предмет как живой собеседник: бытовая сцена, наполненная теплом и драматургией света в традиции французских импрессионистов.",
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    title: "Ирис. Индиго и золото",
    series: "iris_flowers",
    technique: "Сухая пастель, цветной карандаш, тонированная крафтовая бумага",
    year: 2025,
    dimensions: "30×40 см",
    framing: "паспарту, стекло с УФ-защитой",
    price: 15000,
    imageUrl: "/images/seeds/iris-flowers.jpg",
    description:
      "Портрет цветка на границе фотореализма и абстракции: внутреннее сияние лепестка важнее ботанической точности.",
  },
  {
    id: "00000000-0000-4000-8000-000000000004",
    title: "Отражение в канале Грибоедова",
    series: "northern_palmyra",
    technique: "Смешанная техника, акрил и пастель, холст",
    year: 2025,
    dimensions: "40×50 см",
    framing: "сдержанный современный багет",
    price: 22000,
    imageUrl: "/images/seeds/northern-palmyra.jpg",
    description:
      "Серебряный свет Невы и геометрия гранита, пропущенные через взгляд средового дизайнера.",
  },
].map((item) => artworkInput.parse({ ...item, status: "available", isFeatured: true }));
export const seedContent = [
  {
    id: "00000000-0000-4000-8000-000000000011",
    type: "interview",
    title: "Видео-интервью: о синтезе дизайна и живописи",
    embedUrl: "https://vk.com/video_ext.php?oid=-30015658&id=456242764",
    link: "https://vkvideo.ru/video-30015658_456242764",
  },
  {
    id: "00000000-0000-4000-8000-000000000012",
    type: "article",
    title: "Авторская статья на Артхиве",
    link: "https://artchive.ru/alain_rusin/stories/31862",
  },
  {
    id: "00000000-0000-4000-8000-000000000013",
    type: "press",
    title: "СМИ обо мне: публикация о творческом пути",
    link: "https://bst.bratsk.ru/news/50656",
  },
].map((item) => contentInput.parse(item));
