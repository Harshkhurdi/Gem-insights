import { load } from "cheerio";
import { publicLink, isNoticeAttachment } from "./links";
import { NorthernEntry } from "./northern-links";
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
// AIIMS Bhopal publishes every procurement category on one large page whose
// sections are bold headings followed by tables. Medical-relevant sections are
// collected; engineering (civil/electrical works) and vendor-debarment lists
// stay out of requested-demand collection.
const BHOPAL_SECTIONS = [
  "Manual Tender",
  "E-Tenders (Medical College)",
  "E-Tenders (Hospital)",
  "Expression of Interest",
  "Medical College Quotation",
  "Hospital Quotation",
] as const;
const HEADING =
  /^(?:Manual Tender|E-Tenders.*|Expression of Interest|.*Quotation|HLL TENDERS)$/i;
// Publication/closing labels are explicit on this publisher; guard against
// placeholder epochs sometimes rendered beside portal references.
const isRealDate = (v: string | null) => !!v && v >= "2000-01-01";
export function bhopalEntries(html: string, pageUrl: string): NorthernEntry[] {
  const $ = load(html);
  const sections = new Map<string, any>();
  let current: string | null = null;
  for (const el of $("strong,b,.card-header,table").toArray()) {
    const tag = ((el as any).tagName || (el as any).name || "").toLowerCase();
    if (tag !== "table") {
      const t = clean($(el).text());
      if (HEADING.test(t) && t.length < 60) current = t;
    } else if (current) {
      sections.set(current, $(el));
      current = null;
    }
  }
  const missing = BHOPAL_SECTIONS.filter((s) => !sections.has(s));
  if (missing.length)
    throw new Error(
      `AIIMS Bhopal section(s) missing: ${missing.join(", ")}; layout changed or access blocked`,
    );
  const listingDateText = (v: string) => {
    const s = clean(v);
    return /^(?:\d{1,2}[- ][A-Za-z]{3}[ -]\d{4}|\d{4}-\d{2}-\d{2})/.test(s)
      ? s
      : null;
  };
  const entries: NorthernEntry[] = [];
  for (const section of BHOPAL_SECTIONS) {
    const table = sections.get(section)!;
    const rows = table.find("tr");
    if (!rows.length)
      throw new Error(`AIIMS Bhopal ${section} table has no rows`);
    const headers = rows
      .first()
      .children("td,th")
      .toArray()
      .map((c: any) => clean($(c).text()));
    const at = (label: RegExp) =>
      headers.findIndex((h: string) => label.test(h));
    const serial =
        at(/^T\.?No\.?$/i) >= 0 ? at(/^T\.?No\.?$/i) : at(/^S\.?No\.?$/i),
      ref =
        at(/Tender ID|EOI ID|NIQ Id/i) >= 0
          ? at(/Tender ID|EOI ID|NIQ Id/i)
          : -1,
      title = at(/(?:Tender|NIQ) Title/i),
      published = at(/Published/i),
      closing = at(/Closing/i),
      corrigendum = at(/Corrigendum/i),
      download = at(/Download/i);
    if (serial < 0 || title < 0 || published < 0 || closing < 0 || download < 0)
      throw new Error(
        `AIIMS Bhopal ${section} columns changed; expected labelled title, published, closing and download columns`,
      );
    rows.each((ri: number, row: any) => {
      if (ri === 0) return;
      const cells = $(row).children("td");
      if (!cells.length) return;
      const heading = clean(
        cells.eq(title).clone().find("a").remove().end().text(),
      );
      if (!heading || /^(?:download|view|apply|corrigendum)$/i.test(heading))
        return;
      const links = (indexes: number[]) => [
        ...new Set(
          indexes.flatMap((i) =>
            i < 0
              ? []
              : cells
                  .eq(i)
                  .find("a[href]")
                  .toArray()
                  .map((a) => publicLink($(a).attr("href"), pageUrl))
                  .filter((u): u is string => !!u && isNoticeAttachment(u)),
          ),
        ),
      ];
      const documents = links([download, corrigendum, title]);
      const reference =
        ref >= 0 ? clean(cells.eq(ref).text()).replace(/\s*\/\s*/g, "/") : "";
      entries.push({
        title: heading,
        reference:
          reference && !/^(?:-|nil|na)$/i.test(reference) ? reference : null,
        url: documents[0] || pageUrl,
        documents,
        publishedText: listingDateText(cells.eq(published).text()) || undefined,
        closingText: listingDateText(cells.eq(closing).text()) || undefined,
      });
    });
  }
  if (!entries.length)
    throw new Error(
      "AIIMS Bhopal tables yielded no records; collection not marked successful",
    );
  return entries;
}
export const bhopalRealDate = isRealDate;
