const encode = new TextEncoder();
const iterations = 600000;
const hex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
export async function same(a: string, b: string) {
  const [left, right] = await Promise.all(
    [a, b].map((s) => crypto.subtle.digest("SHA-256", encode.encode(s))),
  );
  const x = new Uint8Array(left),
    y = new Uint8Array(right);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!;
  return diff === 0;
}
async function derive(password: string, nonce: string, rounds: number) {
  const pepper = process.env.PASSWORD_SALT;
  if (!pepper || pepper.length < 32)
    throw new Error("PASSWORD_SALT must contain at least 32 characters");
  const material = await crypto.subtle.importKey("raw", encode.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  return hex(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt: encode.encode(pepper + ":" + nonce),
        iterations: rounds,
      },
      material,
      256,
    ),
  );
}
export async function hashPassword(password: string) {
  const nonce = hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  return `pbkdf2-sha256$${iterations}$${nonce}$${await derive(password, nonce, iterations)}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [algorithm, rounds, nonce, hash] = stored.split("$");
  const count = Number(rounds);
  if (algorithm !== "pbkdf2-sha256" || !nonce || !hash || count < 600000 || count > 1000000)
    return false;
  return same(await derive(password, nonce, count), hash);
}
export async function verifyInitialPassword(password: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const nonce = "initial-artist-account";
  const [a, b] = await Promise.all([
    derive(password, nonce, iterations),
    derive(expected, nonce, iterations),
  ]);
  return same(a, b);
}
