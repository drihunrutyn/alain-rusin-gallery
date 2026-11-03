export const publicSiteUrl = (import.meta.env.VITE_PUBLIC_SITE_URL || "https://drihunrutyn.github.io/alain-rusin-gallery").replace(/\/$/, "");
export const adminSiteUrl = (import.meta.env.VITE_ADMIN_SITE_URL || "https://alain-rusin.onrender.com").replace(/\/$/, "");
export const routerBase = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
export function assetUrl(value: string) {
  if (!value.startsWith("/") || value.startsWith("//") || (routerBase && value.startsWith(routerBase + "/"))) return value;
  return routerBase + value;
}
export function requestLinks(title: string, dimensions: string, contact: string, name = "", message = "") {
  const text = title
    ? `Здравствуйте, Алексей! Меня интересует картина "${title}" (${dimensions}). Мой контакт: ${contact}`
    : `Здравствуйте, Алексей! Мой контакт: ${contact}`;
  const body = text + (name ? `\nИмя: ${name}` : "") + (message ? `\n${message}` : "");
  return {
    mail: `mailto:telnov.aleosch@yandex.ru?subject=${encodeURIComponent(title ? `Заявка на картину: ${title}` : "Запрос — Alain Rusin")}&body=${encodeURIComponent(body)}`,
    vk: `https://vk.me/alain_rusin?text=${encodeURIComponent(body)}`,
  };
}
