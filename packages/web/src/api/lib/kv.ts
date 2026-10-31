type Key = (string | number)[];
interface Entry<T> {
  key: Key;
  value: T | null;
  versionstamp: string | null;
}
interface Atomic {
  check(...checks: { key: Key; versionstamp: string | null }[]): Atomic;
  set(key: Key, value: unknown, options?: { expireIn?: number }): Atomic;
  delete(key: Key): Atomic;
  commit(): Promise<{ ok: boolean }>;
}
export interface KV {
  get<T>(key: Key): Promise<Entry<T>>;
  set(key: Key, value: unknown, options?: { expireIn?: number }): Promise<unknown>;
  delete(key: Key): Promise<unknown>;
  list<T>(selector: { prefix: Key }): AsyncIterable<Entry<T>>;
  atomic(): Atomic;
}
export interface DenoRuntime {
  openKv(path?: string): Promise<KV>;
  open(
    path: string | URL,
    options: { read: boolean },
  ): Promise<{ readable: ReadableStream<Uint8Array> }>;
  readTextFile(path: string | URL): Promise<string>;
  serve(handler: (request: Request) => Response | Promise<Response>): unknown;
  cron(name: string, schedule: string, handler: () => Promise<void>): unknown;
}
export const deno = (globalThis as unknown as { Deno?: DenoRuntime }).Deno;
let connection: Promise<KV> | undefined;
export function getKv(): Promise<KV> {
  if (!connection) {
    if (deno)
      connection = deno.openKv(
        process.env.DENO_DEPLOY ? undefined : (process.env.DENO_KV_URL ?? ":memory:"),
      );
    else if (process.env.NODE_ENV !== "production") connection = Promise.resolve(memoryKv());
    else throw new Error("Production sessions and metrics require Deno KV");
  }
  return connection;
}
// Volatile Runable development adapter only; never a production database or local file.
function memoryKv(): KV {
  const data = new Map<
    string,
    { key: Key; value: unknown; versionstamp: string; expires: number }
  >();
  const get = async <T>(key: Key): Promise<Entry<T>> => {
    const id = JSON.stringify(key),
      row = data.get(id);
    if (row && row.expires <= Date.now()) data.delete(id);
    const current = data.get(id);
    return {
      key,
      value: (current?.value as T) ?? null,
      versionstamp: current?.versionstamp ?? null,
    };
  };
  const set = async (key: Key, value: unknown, options?: { expireIn?: number }) => {
    data.set(JSON.stringify(key), {
      key,
      value,
      versionstamp: crypto.randomUUID(),
      expires: options?.expireIn ? Date.now() + options.expireIn : Infinity,
    });
  };
  return {
    get,
    set,
    delete: async (key) => {
      data.delete(JSON.stringify(key));
    },
    async *list<T>({ prefix }: { prefix: Key }) {
      for (const row of data.values())
        if (prefix.every((x, i) => row.key[i] === x)) {
          const current = await get<T>(row.key);
          if (current.value !== null) yield current;
        }
    },
    atomic() {
      const checks: { key: Key; versionstamp: string | null }[] = [];
      const mutations: (() => Promise<unknown>)[] = [];
      const op: Atomic = {
        check(...c) {
          checks.push(...c);
          return op;
        },
        set(key, value, options) {
          mutations.push(() => set(key, value, options));
          return op;
        },
        delete(key) {
          mutations.push(async () => {
            data.delete(JSON.stringify(key));
          });
          return op;
        },
        async commit() {
          for (const c of checks)
            if ((await get(c.key)).versionstamp !== c.versionstamp) return { ok: false };
          for (const m of mutations) await m();
          return { ok: true };
        },
      };
      return op;
    },
  };
}
export async function increment(key: Key, expireIn?: number) {
  const kv = await getKv();
  for (let i = 0; i < 20; i++) {
    const entry = await kv.get<number>(key);
    const count = (entry.value ?? 0) + 1;
    if (
      (
        await kv
          .atomic()
          .check(entry)
          .set(key, count, expireIn ? { expireIn } : undefined)
          .commit()
      ).ok
    )
      return count;
  }
  throw new Error("KV counter contention; retry request");
}
export async function recordView(
  input: { route: string; artworkId?: string; viewedAt?: string },
  legacyId?: string,
) {
  const kv = await getKv();
  const day = (input.viewedAt ?? new Date().toISOString()).slice(0, 10);
  const keys: Key[] = [["metrics", "day", day]];
  if (input.artworkId) keys.push(["metrics", "artwork", input.artworkId]);
  for (let i = 0; i < 20; i++) {
    const entries = await Promise.all(keys.map((key) => kv.get<number>(key)));
    const marker = legacyId ? await kv.get<boolean>(["metrics-import", legacyId]) : undefined;
    if (marker?.value) return;
    const op = kv.atomic().check(...entries);
    for (const e of entries) op.set(e.key, (e.value ?? 0) + 1);
    if (marker) op.check(marker).set(marker.key, true);
    if ((await op.commit()).ok) return;
  }
  throw new Error("KV metric contention");
}
export async function metricSnapshot() {
  const kv = await getKv(),
    days: Record<string, number> = {},
    artworks: Record<string, number> = {};
  for await (const e of kv.list<number>({ prefix: ["metrics", "day"] }))
    days[String(e.key[2])] = e.value ?? 0;
  for await (const e of kv.list<number>({ prefix: ["metrics", "artwork"] }))
    artworks[String(e.key[2])] = e.value ?? 0;
  return { days, artworks };
}
