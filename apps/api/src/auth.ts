import { createHash, createHmac, timingSafeEqual } from "node:crypto";
const hash = (s: string) => createHash("sha256").update(s).digest();
export function configured() {
  return !!process.env.ADMIN_KEY && process.env.ADMIN_KEY.length >= 24;
}
export function validKey(s: string) {
  return configured() && timingSafeEqual(hash(s), hash(process.env.ADMIN_KEY!));
}
export function session() {
  const expires = String(Date.now() + 8 * 3600000);
  return (
    expires +
    "." +
    createHmac("sha256", process.env.ADMIN_KEY!).update(expires).digest("hex")
  );
}
export function authenticated(cookie?: string) {
  if (!configured()) return false;
  const v = cookie
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("gem_session="))
    ?.slice(12);
  if (!v) return false;
  const [expiry, sig] = v.split(".");
  if (!/^\d+$/.test(expiry) || Number(expiry) < Date.now() || !sig)
    return false;
  return timingSafeEqual(
    hash(sig),
    hash(
      createHmac("sha256", process.env.ADMIN_KEY!).update(expiry).digest("hex"),
    ),
  );
}
