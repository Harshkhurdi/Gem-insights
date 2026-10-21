import { load } from "cheerio";
import { digest, classify, Rule } from "../../../../packages/core/domain";
import { taxonomy } from "../../../../packages/core/taxonomy";
import { SourceDefinition } from "./registry";
export interface Notice {
  key: string;
  bidNumber: string | null;
  portal: "gem" | "cppp" | "state" | "institution";
  title: string;
  url: string;
  documents: string[];
  publishedAt: string | null;
  closingDate: string | null;
  buyer: string | null;
  state: string | null;
  medical: boolean;
  products: string[];
  reason: string;
}
const rules = Object.values(taxonomy)
  .flat()
  .map(([id, name, aliases]) => ({ id, name, aliases, category_id: "" }));
const clean = (v: string) => v.replace(/\s+/g, " ").trim();
export function listingDate(v: string): string | null {
  const s = clean(v);
  let y: number, m: number, d: number;
  const numeric = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})(?:\s|$)/);
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s|$)/);
  const named = s.match(
    /^(?:(\d{1,2})[- ]([A-Za-z]+)[- ](\d{4})|([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4}))(?:\s|$)/,
  );
  if (numeric) [, d, m, y] = numeric.map(Number);
  else if (iso) [, y, m, d] = iso.map(Number);
  else if (named) {
    d = Number(named[1] || named[5]);
    y = Number(named[3] || named[6]);
    m =
      [
        "jan",
        "feb",
        "mar",
        "apr",
        "may",
        "jun",
        "jul",
        "aug",
        "sep",
        "oct",
        "nov",
        "dec",
      ].indexOf((named[2] || named[4]).slice(0, 3).toLowerCase()) + 1;
  } else return null;
  const date = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return m > 0 &&
    Number.isFinite(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date
    ? date
    : null;
}
export function noticeClassification(
  title: string,
  classificationRules: Rule[] = rules,
) {
  const c = classify(title, classificationRules);
  const products = classificationRules
    .filter((r) => classify(title, [r]).productId)
    .map((r) => r.id);
  const medical =
    !!products.length ||
    /\b(medical|hospital|surgical|diagnostic|laboratory|healthcare|equipment|analy[sz]er|incubator|dialysis|ophthalmic|dental)\b/i.test(
      title,
    );
  return {
    medical,
    products,
    reason: c.productId
      ? "Equipment candidate from listing title; verify original line items and quantities"
      : c.reason,
  };
}
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
export function pageAllowed(url: string, source: SourceDefinition) {
  const u = new URL(url),
    base = new URL(source.url);
  return (
    u.origin === base.origin &&
    u.pathname === base.pathname &&
    !u.username &&
    !u.password
  );
}
export function parseListing(
  html: string,
  source: SourceDefinition,
  pageUrl = source.url,
  classificationRules: Rule[] = rules,
): { notices: Notice[]; next: string | null } {
  const $ = load(html);
  if (/captcha|access denied|verify you are human/i.test($("title").text()))
    throw new Error("Source access challenge; assisted import required");
  const notices: Notice[] = [];
  const table = $("table")
    .filter((_, el) => {
      const headers = clean($(el).find("th").text());
      return source.adapter === "raipur"
        ? /Tender.No./i.test(headers) && /Publishing Date/.test(headers)
        : source.adapter === "icmr"
          ? /Title/.test(headers) && /Last Date/.test(headers)
          : /Title\/Ref.No./.test(headers) && /Organisation Name/.test(headers);
    })
    .first();
  if (!table.length)
    throw new Error(
      "Expected tender table missing; layout changed or access blocked",
    );
  table.find("tr").each((_, row) => {
    const cells = $(row).children("td");
    if (!cells.length) return;
    let title = "",
      ref = "",
      publishedAt: string | null = null,
      closingDate: string | null = null,
      buyer: string | null = null;
    let primary: string | null = null;
    if (source.adapter === "raipur" && cells.length >= 6) {
      ref = clean(cells.eq(1).text());
      title = clean(cells.eq(2).text());
      publishedAt = listingDate(cells.eq(3).text());
      closingDate = listingDate(cells.eq(4).text());
      buyer = source.name;
      primary = publicLink(
        cells.eq(5).find("a[href]").first().attr("href"),
        pageUrl,
      );
    } else if (source.adapter === "icmr" && cells.length >= 4) {
      title = clean(cells.eq(1).text());
      closingDate = listingDate(cells.eq(3).text());
      primary = publicLink(
        cells.eq(2).find("a[href]").first().attr("href"),
        pageUrl,
      );
    } else if (source.adapter === "cppp" && cells.length >= 6) {
      title = clean(cells.eq(4).find("a").first().text());
      ref =
        clean(cells.eq(4).text()).match(
          /(\d{4}_[A-Za-z0-9]+_\d+(?:_\d+)?)(?:\s*)$/,
        )?.[1] || "";
      publishedAt = listingDate(cells.eq(1).text());
      closingDate = listingDate(cells.eq(2).text());
      buyer = clean(cells.eq(5).text()) || null;
      primary = publicLink(
        cells.eq(4).find("a[href]").first().attr("href"),
        pageUrl,
      );
    }
    if (!title || !primary) return;
    const gem = (ref + " " + title)
      .match(/GEM\s*\/\s*\d{4}\s*\/\s*[BR]\s*\/\s*\d+/i)?.[0]
      .replace(/\s/g, "")
      .toUpperCase();
    const documents = [
      ...new Set(
        cells
          .find("a[href]")
          .toArray()
          .map((a) => publicLink($(a).attr("href"), pageUrl))
          .filter((u): u is string => !!u && /\.pdf(?:[?#]|$)/i.test(u)),
      ),
    ];
    notices.push({
      key:
        source.adapter === "icmr"
          ? digest(primary)
          : gem || ref || digest(primary),
      bidNumber: gem || ref || null,
      portal: gem ? "gem" : source.portal,
      title: title.slice(0, 2000),
      url: primary,
      documents,
      publishedAt,
      closingDate,
      buyer,
      state: source.states.length === 1 ? source.states[0] : null,
      ...noticeClassification(title, classificationRules),
    });
  });
  if (
    !notices.length &&
    !/no (?:records|tenders|data)\s*(?:found|available)/i.test(table.text())
  )
    throw new Error(
      "Tender table yielded no records; collection not marked successful",
    );
  const nextAnchor = $("a[href]")
    .filter(
      (_, a) =>
        /^(next\s*(?:[›»>]|page)?|[›»])$/i.test(clean($(a).text())) ||
        $(a).attr("rel") === "next",
    )
    .first();
  const next = publicLink(nextAnchor.attr("href"), pageUrl);
  if (next && pageAllowed(next, source) && next === pageUrl)
    throw new Error("Non-advancing pagination link; collection incomplete");
  return {
    notices: [...new Map(notices.map((n) => [n.key, n])).values()],
    next: next && pageAllowed(next, source) && next !== pageUrl ? next : null,
  };
}
