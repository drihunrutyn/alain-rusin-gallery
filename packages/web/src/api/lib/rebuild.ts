// Server-only: never expose dispatch credentials via VITE_ or NEXT_PUBLIC_ variables.
export async function requestRebuild() {
  const token = process.env.GITHUB_REBUILD_TOKEN;
  const hook = process.env.NEXT_PUBLIC_BUILD_HOOK_URL;
  if (!token && !hook) return { queued: false, message: "Изменения сохранены. Автопересборка не настроена: запустите Deploy static storefront в GitHub Actions." };
  try {
    let response: Response;
    if (token) {
      response = await fetch("https://api.github.com/repos/drihunrutyn/alain-rusin-gallery/actions/workflows/deploy.yml/dispatches", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
        body: JSON.stringify({ ref: "main" }), signal: AbortSignal.timeout(10000),
      });
    } else {
      const url = new URL(hook!);
      if (url.protocol !== "https:" || url.username || url.password) throw new Error();
      response = await fetch(url, { method: "POST", signal: AbortSignal.timeout(10000), redirect: "error" });
    }
    if (!response.ok) return { queued: false, message: `Изменения сохранены, но пересборка не запущена (HTTP ${response.status}). Запустите workflow вручную.` };
    return { queued: true, message: "Изменения сохранены. Запрос пересборки принят; публикация появится после успешного workflow." };
  } catch {
    return { queued: false, message: "Изменения сохранены. Сервис пересборки недоступен; запустите workflow вручную." };
  }
}
