export function publicLink(href: string | undefined, base: string) {
  if (!href) return null;
  try {
    const u = new URL(href, base);
    return /^https?:$/.test(u.protocol) && !u.username && !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}
