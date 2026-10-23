import { load } from "cheerio";
import { publicLink, isNoticeAttachment } from "./links";
import {
  digest,
  classify,
  equipmentAliasMatches,
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
import { jkmsclEntries } from "./jkmscl";
import { upInstitutionEntries } from "./up-institutions";
import { NorthernEntry, northernLinks } from "./northern-links";
import { bhopalEntries, bhopalRealDate } from "./central-institutions";
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
  source?: SourceDefinition,
) {
  const c = classify(title, classificationRules);
  const products = classificationRules
    .filter((r) => classify(title, [r]).productId)
    .map((r) => r.id)
    .sort();
  const titleMedical =
    !!equipmentAliasMatches(title, classificationRules).length ||
    /\b(medical|hospital|surgical|diagnostic|mri|laboratory|healthcare|equipments?|analy[sz]er|incubator|dialysis|ophthalmic|ophthalmolog\w*|gyn[ae]*colog\w*|pa?ediatric\w*|pulmonolog\w*|dental|cbct|tomography|laser|psychiatr\w*|orthop\w*|patholog\w*|nephro\w*|physio\w*|oncolog\w*|cardio\w*|neurolog\w*|elisa|assay|reagents?|consumables?|pharma\w*|medicines?|drugs?|sutures?|catheters?|endotracheal|nasogastric|gauze|haemo\w*|hemo\w*|microbiolog\w*|biochem\w*|immuno\w*|prosthe\w*|implants?|endoscop\w*|gastro\w*|otolaryng\w*|urolog\w*|anaesthe\w*|anesthe\w*)\b/i.test(
      title,
    ) ||
    /\b(pacemakers?|dysphagia|infusion|syringes?|needles?|gloves?|dressings?|neonat\w*|echocardi\w*|laparoscop\w*|surger\w*|injections?|chemotherap\w*|intra[- ]?ocular|platelet\w*|patient\s+care|blood\s+(?:collection|bank)|pulse\s+oximet\w*|molecular\s+biology|scrub\s+suits?|(?:ot|operating\s+theatre)\s+(?:towels?|tables?|lights?))\b/i.test(
      title,
    );
  // Specific clinical supply/research terms can establish a provisional
  // medical signal without claiming an equipment purchase or item quantity.
  const clinicalSupply =
    /\b(?:parenteral nutrition|cholecalciferol|sterili[sz]ation containers?|(?:dna|rna|nucleic acid|ngs) sequencing|nucleic acid (?:isolation|extraction)|genotyp\w*|autopsy instruments?)\b/i.test(
      title,
    ) || /\binj(?:\.|\s)\s*[a-z]/i.test(title);
  return {
    medical:
      titleMedical || clinicalSupply || source?.clinicalCategory === true,
    products,
    reason: c.productId
      ? "Equipment candidate from listing title; verify original line items and quantities"
      : titleMedical || clinicalSupply
        ? "Possible clinical procurement from listing title; verify medical scope and original item evidence"
        : source?.clinicalCategory
          ? "Clinical notice from the official drug/surgical tender category; original items and quantities require review"
          : c.reason,
  };
}
export { publicLink } from "./links";
export function pageAllowed(url: string, source: SourceDefinition) {
  const u = new URL(url),
    base = new URL(source.url);
  return (
    u.origin === base.origin &&
    (!["aiims-delhi", "skims"].includes(source.adapter || "") ||
      ([...u.searchParams.keys()].every((k) => k === "start") &&
        (!u.searchParams.has("start") ||
          (u.searchParams.getAll("start").length === 1 &&
            /^\d+$/.test(u.searchParams.get("start")!))))) &&
    (source.adapter !== "raebareli" ||
      ([...u.searchParams.keys()].every((k) => k === "page") &&
        (!u.searchParams.has("page") ||
          (u.searchParams.getAll("page").length === 1 &&
            /^[1-9]\d*$/.test(u.searchParams.get("page")!))))) &&
    (source.adapter !== "jodhpur" ||
      ([...u.searchParams.keys()].every(
        (k) =>
          k === "page" ||
          (k === "search" && u.searchParams.get("search") === ""),
      ) &&
        (!u.searchParams.has("search") || u.searchParams.has("page")) &&
        (!u.searchParams.has("page") ||
          (u.searchParams.getAll("page").length === 1 &&
            /^[1-9]\d*$/.test(u.searchParams.get("page")!))))) &&
    (source.adapter !== "phsc" ||
      ([...u.searchParams.keys()].every((k) => k === "page") &&
        (!u.searchParams.has("page") ||
          (u.searchParams.getAll("page").length === 1 &&
            /^\d+$/.test(u.searchParams.get("page")!))))) &&
    (source.adapter !== "bathinda" || u.search === base.search) &&
    (![
      "rmsc",
      "upums",
      "bhubaneswar",
      "jammu",
      "jkmscl",
      "nhm-ladakh",
      "kgmu",
      "kcgmc",
      "s3waas",
      "gorakhpur",
      "sgpgims",
      "hmscl",
    ].includes(source.adapter || "") ||
      u.search === base.search) &&
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
  // This publisher reuses some PDF URLs for unrelated tender titles. Preserve
  // each row's title context instead of silently dropping one at collection.
  if (
    ["jammu", "jkmscl", "gorakhpur"].includes(source.adapter || "") &&
    title
  ) {
    const identity = digest(url + "#" + title);
    return reference ? reference + "#" + identity.slice(0, 20) : identity;
  }
  // Missing historical links lead to the listing; titles distinguish its rows.
  if (
    [
      "rishikesh",
      "bathinda",
      "rmsc",
      "upums",
      "bhubaneswar",
      "jammu",
      "kgmu",
      "kcgmc",
      "s3waas",
      "raebareli",
      "jodhpur",
      "sgpgims",
      "phsc",
      "hmscl",
      "bhopal",
      "cgmscl",
    ].includes(source.adapter || "") &&
    url === source.url &&
    title
  )
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
  if (
    [
      "skims",
      "nhm-ladakh",
      "jkmscl",
      "raebareli",
      "gorakhpur",
      "bhopal",
    ].includes(source.adapter || "")
  ) {
    const entries: NorthernEntry[] =
      source.adapter === "bhopal"
        ? bhopalEntries(html, pageUrl)
        : ["raebareli", "gorakhpur"].includes(source.adapter || "")
          ? upInstitutionEntries(html, source, pageUrl)
          : source.adapter === "jkmscl"
            ? jkmsclEntries(html, pageUrl)
            : northernLinks(html, source, pageUrl);
    const notices = entries.map((entry) => {
      const title = entry.title.slice(0, 2000),
        { url, documents } = entry;
      const gem = [entry.reference, title]
        .filter(Boolean)
        .join(" ")
        .match(/GEM\s*\/\s*\d{4}\s*\/\s*[BR]\s*\/\s*\d+/i)?.[0]
        .replace(/\s/g, "")
        .toUpperCase();
      const reference =
        gem ||
        entry.reference ||
        title.match(/\b\d{4}_[A-Za-z0-9]+_\d+(?:_\d+)?\b/)?.[0] ||
        null;
      // Bhopal renders placeholder epoch dates beside portal references; an
      // implausible date is not a publication or closing claim.
      const entryDate = (text?: string | null) => {
        const d = text ? listingDate(text) : null;
        return source.adapter === "bhopal" && !bhopalRealDate(d) ? null : d;
      };
      return {
        key: noticeKey(source, reference, url, title),
        bidNumber: reference,
        portal: gem ? ("gem" as const) : source.portal,
        title: title.slice(0, 2000),
        url,
        documents,
        publishedAt: entryDate(entry.publishedText),
        closingDate: entryDate(entry.closingText),
        buyer: source.buyerName || source.name,
        state: source.states[0] || null,
        ...noticeClassification(title, classificationRules, source),
      };
    });
    return {
      notices: [...new Map(notices.map((n) => [n.key, n])).values()],
      next: ["skims", "raebareli"].includes(source.adapter || "")
        ? listingNext($, source, pageUrl)
        : null,
    };
  }
  if (
    source.adapter === "s3waas" &&
    /^(?:Past )?Tenders$/.test(clean($("h1").first().text())) &&
    clean($("#no-results-message").text()) ===
      "Sorry, no notice matched this category."
  )
    return { notices: [], next: null };
  const notices: Notice[] = [];
  const table = $("table")
    .filter((_, el) => {
      const headers = clean(
        ["kgmu", "kcgmc"].includes(source.adapter || "")
          ? $(el).find("tr").first().children("td,th").text()
          : $(el).find("th").text(),
      );
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
              ...noticeClassification(title, classificationRules, source),
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
    if (
      ["kgmu", "kcgmc"].includes(source.adapter || "") &&
      /Sr\. No\./.test(clean(cells.eq(0).text()))
    )
      return;
    if (source.adapter === "jammu") {
      if (cells.length !== 3)
        throw new Error("AIIMS Jammu row changed; expected three columns");
      title =
        clean(cells.eq(1).clone().find("a").remove().end().text()) ||
        clean(cells.eq(1).text());
      buyer = source.buyerName || source.name;
      primary =
        cells
          .eq(2)
          .find("a[href]")
          .toArray()
          .map((a) => publicLink($(a).attr("href"), pageUrl))
          .find((u) => !!u && isNoticeAttachment(u)) || source.url;
      // Upload dates are not verified original publication dates.
      ref = title.match(/\b\d{4}_[A-Za-z0-9]+_\d+(?:_\d+)?\b/)?.[0] || "";
    } else if (source.adapter === "kgmu") {
      if (cells.length !== 4)
        throw new Error("KGMU row changed; expected four columns");
      ref = clean(cells.eq(1).text());
      if (/^(?:-|nil|na)?$/i.test(ref)) ref = "";
      title = clean(cells.eq(2).text());
      buyer = source.name;
      primary =
        cells
          .eq(2)
          .find("a[href]")
          .toArray()
          .map((a) => publicLink($(a).attr("href"), pageUrl))
          .find((u) => !!u && isNoticeAttachment(u)) || source.url;
      const submission = clean(cells.eq(3).text()).split(/\s+to\s+/i);
      closingDate = listingDate(submission.at(-1) || "");
    } else if (source.adapter === "kcgmc") {
      if (cells.length !== 5)
        throw new Error("KCGMC row changed; expected five columns");
      title = clean(cells.eq(1).text());
      buyer = source.buyerName || source.name;
      closingDate = listingDate(cells.eq(3).text());
      primary =
        publicLink(cells.eq(4).find("a[href]").first().attr("href"), pageUrl) ||
        source.url;
      if (
        primary !== source.url &&
        new URL(primary).origin !== new URL(source.url).origin
      )
        throw new Error("KCGMC original is not on its official host");
      ref = title.match(/\b\d{4}_[A-Za-z0-9]+_\d+(?:_\d+)?\b/)?.[0] || "";
    } else if (source.adapter === "s3waas") {
      if (cells.length !== 6)
        throw new Error(
          "Health department tender row changed; expected six columns",
        );
      const name = clean(cells.eq(1).text()),
        description = clean(cells.eq(2).text());
      title =
        name + (description && description !== name ? " — " + description : "");
      buyer = source.name;
      primary =
        cells
          .eq(5)
          .find("a[href]")
          .toArray()
          .map((a) => publicLink($(a).attr("href"), pageUrl))
          .find((u) => !!u && isNoticeAttachment(u)) || source.url;
      // Generic Start/End notice dates are not asserted as bid dates.
      ref = title.match(/\b\d{4}_[A-Za-z0-9]+_\d+(?:_\d+)?\b/)?.[0] || "";
    } else if (source.adapter === "bhubaneswar") {
      if (cells.length !== 8) {
        if (
          cells.length === 1 &&
          /no (?:records|tenders|data)/i.test(cells.text())
        )
          return;
        throw new Error(
          "AIIMS Bhubaneswar tender row changed; expected eight columns",
        );
      }
      title = clean(cells.eq(1).text());
      publishedAt = listingDate(cells.eq(2).text());
      closingDate = listingDate(cells.eq(3).text());
      buyer = source.buyerName || source.name;
      // The original column establishes identity. Later cancellation, award or
      // corrigendum links stay as evidence and must not replace that identity.
      primary =
        cells
          .eq(4)
          .find("a[href]")
          .toArray()
          .map((a) => publicLink($(a).attr("href"), pageUrl))
          .find((u) => !!u && isNoticeAttachment(u)) || source.url;
      // Historical rows can have an original document but no title. Keep
      // that evidence with an explicit missing-title label, without guessing
      // a clinical category from the institution or the PDF filename.
      if (!title && primary !== source.url)
        title = "Untitled procurement notice (source title missing)";
      ref = title.match(/\b\d{4}_[A-Za-z0-9]+_\d+(?:_\d+)?\b/)?.[0] || "";
    } else if (source.adapter === "rmsc" && cells.length >= 6) {
      const name = clean(cells.eq(0).text()),
        description = clean(cells.eq(3).text());
      title =
        name + (description && description !== name ? " — " + description : "");
      // Generic From/To fields and bulk Upload Date timestamps are not proof
      // of the original publication date or the submission deadline.
      buyer = source.buyerName || source.name;
      const article = publicLink(
        cells.eq(0).find("a[href]").first().attr("href"),
        pageUrl,
      );
      primary =
        article && new URL(article).pathname !== new URL(source.url).pathname
          ? article
          : cells
              .eq(4)
              .find("a[href]")
              .toArray()
              .map((a) => publicLink($(a).attr("href"), pageUrl))
              .find((u) => !!u && isNoticeAttachment(u)) || source.url;
      ref = title.match(/\b\d{4}_[A-Za-z0-9]+_\d+(?:_\d+)?\b/)?.[0] || "";
    } else if (source.adapter === "upums" && cells.length >= 4) {
      title = clean(cells.eq(1).text());
      publishedAt = listingDate(cells.eq(2).text());
      buyer = source.buyerName || source.name;
      primary =
        cells
          .eq(3)
          .find("a[href]")
          .toArray()
          .map((a) => publicLink($(a).attr("href"), pageUrl))
          .find((u) => !!u && isNoticeAttachment(u)) || source.url;
      ref = title.match(/\b\d{4}_[A-Za-z0-9]+_\d+(?:_\d+)?\b/)?.[0] || "";
    } else if (source.adapter === "aiims-delhi" && cells.length >= 4) {
      const current = /Date of Publishing/.test(clean(table.find("th").text()));
      const titleCell = cells.eq(current ? 2 : 1);
      title = clean(titleCell.text());
      // Public EHS notices can contain patient names/IDs; retain procurement
      // wording without copying those identifiers into the research dataset.
      title = title
        .replace(
          /\bfor\s+EHS\s+beneficiar(?:y|ies)\b.*?(?=\bunder\s+PAC\b|$)/i,
          "for an EHS beneficiary ",
        )
        .trim();
      ref = title.match(/\b\d{4}_[A-Za-z0-9]+_\d+(?:_\d+)?\b/)?.[0] || "";
      publishedAt = current ? listingDate(cells.eq(3).text()) : null;
      closingDate = listingDate(cells.eq(current ? 4 : 3).text());
      buyer = source.buyerName || source.name;
      primary = publicLink(
        titleCell.find("a[href]").first().attr("href"),
        pageUrl,
      );
      if (!primary || new URL(primary).origin !== new URL(source.url).origin)
        throw new Error(
          "AIIMS Delhi tender lacks an official detail link; layout may have changed",
        );
    } else if (source.adapter === "bathinda" && cells.length >= 6) {
      ref = clean(cells.eq(1).text());
      title = clean(cells.eq(2).text());
      closingDate = listingDate(cells.eq(4).text());
      buyer = source.buyerName || source.name;
      const links = cells
        .eq(5)
        .find("a[href]")
        .toArray()
        .map((a) => ({
          url: publicLink($(a).attr("href"), pageUrl),
          label: clean($(a).text()),
        }))
        .filter((a) => a.url && isNoticeAttachment(a.url));
      // Originals often follow several newly added corrigenda. Do not make a
      // newly inserted amendment replace the source identity of a native bid.
      primary =
        links.find(
          (a) =>
            !/corrigendum|amendment|extension|clarification/i.test(a.label),
        )?.url ||
        links[0]?.url ||
        source.url;
    } else if (source.adapter === "raipur" && cells.length >= 6) {
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
    } else if (source.adapter === "jodhpur") {
      if (cells.length !== 5)
        throw new Error("AIIMS Jodhpur row changed; expected five columns");
      ref = clean(cells.eq(0).text());
      title = clean(cells.eq(1).clone().find("a").remove().end().text());
      // Generic Start/End listing dates are not asserted as original
      // publication; End is retained only as a listed closing claim.
      closingDate = listingDate(cells.eq(3).text());
      buyer = source.buyerName || source.name;
      primary =
        cells
          .eq(1)
          .find("a[href]")
          .toArray()
          .map((a) => publicLink($(a).attr("href"), pageUrl))
          .find((u) => !!u && isNoticeAttachment(u)) || source.url;
    } else if (source.adapter === "sgpgims") {
      if (cells.length !== 3)
        throw new Error("SGPGIMS row changed; expected three columns");
      title = clean(cells.eq(1).text());
      ref = "";
      buyer = source.buyerName || source.name;
      primary =
        cells
          .eq(2)
          .find("a[href]")
          .toArray()
          .map((a) => publicLink($(a).attr("href"), pageUrl))
          .find((u) => !!u && isNoticeAttachment(u)) || source.url;
    } else if (source.adapter === "phsc") {
      if (cells.length !== 5)
        throw new Error("PHSC row changed; expected five columns");
      // Current and archived tables order their columns differently; follow the
      // published header order instead of fixed positions.
      const headerTexts = table
        .find("th")
        .toArray()
        .map((th) => clean($(th).text()));
      const at = (label: RegExp) => headerTexts.findIndex((h) => label.test(h));
      const bid = at(/BID No/),
        end = at(/End Date/),
        subject = at(/Subject of Tender/);
      if (bid < 0 || end < 0 || subject < 0)
        throw new Error("PHSC columns changed; reference or subject missing");
      // Native BID numbers are published with inconsistent inner spacing. The
      // meaningful subject is the linked phrase; trailing format/size chrome
      // after it is publisher interface detail, not notice content.
      ref = clean(cells.eq(bid).text()).replace(/\s*\/\s*/g, "/");
      const subjectCell = cells.eq(subject);
      title =
        clean(subjectCell.find("a[href]").first().text()) ||
        clean(subjectCell.clone().find("a").remove().end().text()).replace(
          /\s*\(\s*Format\s*:[^)]*\)\s*$/i,
          "",
        );
      // Generic Start/End listing dates are not asserted as publication.
      closingDate = listingDate(cells.eq(end).text());
      buyer = source.buyerName || source.name;
      primary =
        cells
          .eq(subject)
          .find("a[href]")
          .toArray()
          .map((a) => publicLink($(a).attr("href"), pageUrl))
          .find((u) => !!u && isNoticeAttachment(u)) || source.url;
    } else if (source.adapter === "cgmscl") {
      if (cells.length !== 4)
        throw new Error("CGMSCL row changed; expected four columns");
      // The reference text is the labelled span; the second column is only a
      // new-item icon and never carries procurement facts.
      title = clean(cells.eq(2).text());
      buyer = source.buyerName || source.name;
      const detail = $(row)
        .attr("onclick")
        ?.match(/AttachmentList\.aspx\?a=\d+/)?.[0];
      primary = detail ? publicLink(detail, pageUrl) || source.url : source.url;
      if (primary !== source.url && !primary.includes("AttachmentList.aspx"))
        throw new Error(
          "CGMSCL detail link is not its official attachment list",
        );
      // This publisher prints GeM bid numbers without separator slashes
      // ("GEM 2026 B 8053870"). Normalize separators of the publisher's own
      // rendering; never construct a reference that is not printed.
      const gemNoSlash = title.match(
        /GEM\s*\/?\s*(\d{4})\s*\/?\s*([BR])\s*\/?\s*(\d{4,})/i,
      );
      ref = gemNoSlash
        ? `GEM/${gemNoSlash[1]}/${gemNoSlash[2].toUpperCase()}/${gemNoSlash[3]}`
        : (title.match(/\b\d{2,4}\/[A-Z]{2,}\/[A-Z0-9\/-]+/)?.[0] ?? "");
    } else if (source.adapter === "hmscl") {
      // The publisher's explicit empty state spans the table in one cell.
      if (
        cells.length === 1 &&
        /no published tenders/i.test(clean(cells.text()))
      )
        return;
      if (cells.length !== 7)
        throw new Error("HMSCL row changed; expected seven columns");
      ref = clean(cells.eq(1).text());
      title = clean(cells.eq(2).text());
      buyer = source.buyerName || source.name;
      // Important Dates is free text without a parseable explicit layout; no
      // bid date is invented from it.
      primary =
        cells
          .eq(5)
          .find("a[href]")
          .toArray()
          .map((a) => publicLink($(a).attr("href"), pageUrl))
          .find((u) => !!u && isNoticeAttachment(u)) ||
        cells
          .eq(6)
          .find("a[href]")
          .toArray()
          .map((a) => publicLink($(a).attr("href"), pageUrl))
          .find((u) => !!u && isNoticeAttachment(u)) ||
        source.url;
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
                (source.adapter === "kcgmc" &&
                  new URL(u).origin === new URL(source.url).origin &&
                  /^\/Tender\/ShowPDF\/\d+$/.test(new URL(u).pathname)) ||
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
      ...noticeClassification(title, classificationRules, source),
    });
  });
  if (
    !notices.length &&
    !/(?:no (?:records|tenders|data)\s*(?:found|available)|no published tenders|currently (?:tenders?|tender archives) are not available)/i.test(
      table.text(),
    )
  )
    throw new Error(
      "Tender table yielded no records; collection not marked successful",
    );
  const next = listingNext($, source, pageUrl);
  return {
    notices: [...new Map(notices.map((n) => [n.key, n])).values()],
    next: next && pageAllowed(next, source) && next !== pageUrl ? next : null,
  };
}

function listingNext(
  $: ReturnType<typeof load>,
  source: SourceDefinition,
  pageUrl: string,
) {
  const nextAnchor = $(
    source.adapter === "skims" ? "form[name=adminForm] a[href]" : "a[href]",
  )
    .filter(
      (_, a) =>
        /^(next\s*(?:[›»>]|page)?|[›»])$/i.test(clean($(a).text())) ||
        $(a).attr("rel") === "next" ||
        $(a).parent().hasClass("pager__item--next"),
    )
    .filter(
      (_, a) =>
        !(
          source.adapter === "raebareli" &&
          $(a).parent().attr("aria-disabled") === "true" &&
          $(a).attr("aria-hidden") === "true"
        ),
    )
    .first();
  const next = publicLink(nextAnchor.attr("href"), pageUrl);
  if (nextAnchor.length && (!next || !pageAllowed(next, source)))
    throw new Error("Unsupported pagination link; collection incomplete");
  if (next && pageAllowed(next, source) && next === pageUrl)
    throw new Error("Non-advancing pagination link; collection incomplete");
  if (
    next &&
    ["aiims-delhi", "skims"].includes(source.adapter || "") &&
    Number(new URL(next).searchParams.get("start") || 0) <=
      Number(new URL(pageUrl).searchParams.get("start") || 0)
  )
    throw new Error("Non-advancing archive offset; collection incomplete");
  if (
    next &&
    source.adapter === "raebareli" &&
    Number(new URL(next).searchParams.get("page") || 1) <=
      Number(new URL(pageUrl).searchParams.get("page") || 1)
  )
    throw new Error("Non-advancing Raebareli page; collection incomplete");
  if (
    next &&
    source.adapter === "jodhpur" &&
    Number(new URL(next).searchParams.get("page") || 1) <=
      Number(new URL(pageUrl).searchParams.get("page") || 1)
  )
    throw new Error("Non-advancing Jodhpur page; collection incomplete");
  if (
    next &&
    source.adapter === "phsc" &&
    Number(new URL(next).searchParams.get("page") || 0) <=
      Number(new URL(pageUrl).searchParams.get("page") || 0)
  )
    throw new Error("Non-advancing PHSC page; collection incomplete");
  return next;
}
