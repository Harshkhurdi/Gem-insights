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
// Retain BOQs and native tender attachments for review, without attempting to
// extract non-PDF formats through the GeM PDF parser.
export function isNoticeAttachment(url: string) {
  return /\.(?:pdf|docx?|xlsx?|zip)(?:[?#]|$)/i.test(url);
}
