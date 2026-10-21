import { load } from "cheerio";
import { publicLink, isNoticeAttachment } from "./links";
import {
  digest,
  classify,
  Rule,
  stateName,
} from "../../../../packages/core/domain";
import { taxonomy } from "../../../../packages/core/taxonomy";
import { SourceDefinition } from "./registry";
import {
  tableMatches,
  gmchNoticeLinks,
  kmsclNoticeLinks,
} from "./institution-parsers";
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
    /\b(medical|hospital|surgical|diagnostic|laboratory|healthcare|equipment|analy[sz]er|incubator|dialysis|ophthalmic|dental|cbct|tomography|laser|psychiatr\w*|orthop\w*|patholog\w*|nephro\w*|physio\w*|oncolog\w*|cardio\w*|neurolog\w*|elisa|assay|reagents?|consumables?|pharma\w*|medicines?|drugs?|sutures?|catheters?|endotracheal|nasogastric|gauze|haemo\w*|hemo\w*|microbiolog\w*|biochem\w*|immuno\w*|prosthe\w*|implants?|endoscop\w*|gastro\w*|otolaryng\w*|urolog\w*|anaesthe\w*|anesthe\w*)\b/i.test(
      title,
    );
  return {
    medical,
    products,
    reason: c.productId
      ? "Equipment candidate from listing title; verify original line items and quantities"
      : medical
        ? "Possible clinical procurement from listing title; verify medical scope and original item evidence"
        : c.reason,
  };
}
export { publicLink } from "./links";
export function pageAllowed(url: string, source: SourceDefinition) {
  const u = new URL(url),
    base = new URL(source.url);
  return (
    u.origin === base.origin &&
    (source.adapter !== "rishikesh" ||
      u.searchParams.get("page_id") === base.searchParams.get("page_id")) &&
    (u.pathname === base.pathname ||
      (source.adapter === "hll" &&
        /^\/tender\/index\/p\/\d+\/?$/.test(u.pathname))) &&
    !u.username &&
    !u.password
  );
}
export function noticeKey(
  source: SourceDefinition,
  reference: string | null,
  url: string,
  title?: string,
) {
  // CPPP uses rotating link tokens, but its tender ID is stable. Other sources
  // can reuse a file/reference number for several different notice documents.
  if (source.adapter === "cppp" && reference) return reference;
  // Missing historical links lead to the listing; titles distinguish its rows.
  if (source.adapter === "rishikesh" && url === source.url && title)
    url += "#" + digest(title);
  return reference ? reference + "#" + digest(url).slice(0, 20) : digest(url);
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
      return tableMatches(headers, source.adapter);
    })
    .first();
  if (source.adapter === "gmch-notices" || source.adapter === "kmscl") {
    const links =
      source.adapter === "kmscl"
        ? kmsclNoticeLinks(html, pageUrl)
        : gmchNoticeLinks(html, pageUrl).map((n) => ({
            ...n,
            documents: [n.url],
          }));
    if (!links.length)
      throw new Error(
        "Procurement content yielded no document links; layout may have changed",
      );
    return {
      notices: [
        ...new Map(
          links
            .map(({ title, url, documents }) => ({
              key: noticeKey(source, null, url),
              bidNumber: null,
              portal: source.portal,
              title: title.slice(0, 2000),
              url,
              documents,
              publishedAt: null,
              closingDate: null,
              buyer: source.buyerName || source.name,
              state: source.states[0] || null,
              ...noticeClassification(title, classificationRules),
            }))
            .map((n) => [n.key, n]),
        ).values(),
      ],
      next: null,
    };
  }
  if (!table.length)
    throw new Error(
      "Expected tender table missing; layout changed or access blocked",
    );
  table.find("tr").each((_, row) => {
    if ($(row).closest("table")[0] !== table[0]) return;
    const cells = $(row).children("td");
    if (!cells.length) return;
    let title = "",
      ref = "",
      publishedAt: string | null = null,
      closingDate: string | null = null,
      buyer: string | null = null,
      explicitState: string | null =
        source.states.length === 1 ? source.states[0] : null;
    let primary: string | null = null;
    if (source.adapter === "raipur" && cells.length >= 6) {
      ref = clean(cells.eq(1).text());
      title = clean(cells.eq(2).text());
      publishedAt = listingDate(cells.eq(3).text());
      closingDate = listingDate(cells.eq(4).text());
      buyer = source.buyerName || source.name;
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
      if (/State Name/.test(clean(table.find("th").text()))) {
        try {
          explicitState = stateName(clean(cells.eq(5).text()));
        } catch {
          explicitState = null;
        }
      } else buyer = clean(cells.eq(5).text()) || null;
      primary = publicLink(
        cells.eq(4).find("a[href]").first().attr("href"),
        pageUrl,
      );
    }
    if (source.adapter === "bilaspur" && cells.length >= 8) {
      ref = clean(cells.eq(1).text());
      title = clean(cells.eq(2).text());
      // "Start Date" is not evidence of the actual publication date.
      closingDate =
        listingDate(cells.eq(6).text()) || listingDate(cells.eq(5).text());
      buyer = source.buyerName || source.name;
      primary = publicLink(
        cells.eq(7).find("a[href]").first().attr("href"),
        pageUrl,
      );
    } else if (source.adapter === "hll" && cells.length >= 4) {
      title = clean(cells.eq(1).text());
      ref = clean(cells.eq(2).text());
      buyer = source.name;
      primary = publicLink(
        cells.eq(1).find("a[href]").first().attr("href"),
        pageUrl,
      );
    } else if (source.adapter === "gmch" && cells.length >= 4) {
      title = clean(cells.eq(1).text());
      closingDate = listingDate(cells.eq(3).text());
      buyer = source.name;
      primary = publicLink(
        cells.eq(2).find("a[href]").first().attr("href"),
        pageUrl,
      );
    } else if (source.adapter === "rishikesh" && cells.length >= 5) {
      ref = clean(cells.eq(0).text());
      title = clean(cells.eq(1).text());
      closingDate = listingDate(cells.eq(3).text());
      buyer = source.buyerName || source.name;
      // Quotation downloads can be in Related Links instead of the title cell.
      // Preserve a listing row even when its historical original link is broken.
      primary =
        cells
          .find("a[href]")
          .toArray()
          .map((a) => publicLink($(a).attr("href"), pageUrl))
          .find(
            (u) =>
              !!u &&
              (new URL(u).hostname === new URL(source.url).hostname ||
                new URL(u).hostname.endsWith(".aiimsrishikesh.edu.in")),
          ) || null;
      if (!primary && title) {
        primary = source.url;
      }
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
          .filter(
            (u): u is string =>
              !!u &&
              (isNoticeAttachment(u) ||
                (source.adapter === "rishikesh" &&
                  new URL(u).hostname.includes("."))),
          ),
      ),
    ];
    notices.push({
      key: noticeKey(source, gem || ref || null, primary, title.slice(0, 2000)),
      bidNumber: gem || ref || null,
      portal: gem ? "gem" : source.portal,
      title: title.slice(0, 2000),
      url: primary,
      documents,
      publishedAt,
      closingDate,
      buyer,
      state: explicitState,
      ...noticeClassification(title, classificationRules),
    });
  });
  if (
    !notices.length &&
    !/(?:no (?:records|tenders|data)\s*(?:found|available)|currently (?:tenders?|tender archives) are not available)/i.test(
      table.text(),
    )
  )
    throw new Error(
      "Tender table yielded no records; collection not marked successful",
    );
  const nextAnchor = $("a[href]")
    .filter(
      (_, a) =>
        /^(next\s*(?:[›»>]|page)?|[›»])$/i.test(clean($(a).text())) ||
        $(a).attr("rel") === "next" ||
        $(a).parent().hasClass("pager__item--next"),
    )
    .first();
  const next = publicLink(nextAnchor.attr("href"), pageUrl);
  if (nextAnchor.length && (!next || !pageAllowed(next, source)))
    throw new Error("Unsupported pagination link; collection incomplete");
  if (next && pageAllowed(next, source) && next === pageUrl)
    throw new Error("Non-advancing pagination link; collection incomplete");
  return {
    notices: [...new Map(notices.map((n) => [n.key, n])).values()],
    next: next && pageAllowed(next, source) && next !== pageUrl ? next : null,
  };
}
