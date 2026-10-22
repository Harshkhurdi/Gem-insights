import { load } from "cheerio";
import { publicLink, isNoticeAttachment } from "./links";
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
export interface JkmsclEntry {
  title: string;
  url: string;
  documents: string[];
  reference: string | null;
  closingText: string;
}
export function jkmsclEntries(html: string, pageUrl: string): JkmsclEntry[] {
  const $ = load(html),
    tables = $("table");
  const main = tables
    .filter(
      (_, t) =>
        /ENIT no/.test($(t).find("th").text()) &&
        /Closing Date/.test($(t).find("th").text()),
    )
    .first();
  if (!main.length) throw new Error("Expected JKMSCL tender table missing");
  const entries: JkmsclEntry[] = [];
  const carry: Record<string, { value: any; remaining: number }> = {};
  const documents = (cell: any) => [
    ...new Set(
      $(cell)
        .find("a[href]")
        .toArray()
        .map((a) => publicLink($(a).attr("href"), pageUrl))
        .filter((u): u is string => !!u && isNoticeAttachment(u)),
    ),
  ];
  const remember = (name: string, cell: any) => {
    const span = Number($(cell).attr("rowspan") || 1);
    // Malformed legacy HTML must not invent inherited references or dates.
    carry[name] = {
      value: cell,
      remaining:
        Number.isInteger(span) && span >= 1 && span <= 1000 ? span - 1 : 0,
    };
  };
  main.find("tr").each((_, row) => {
    if ($(row).closest("table")[0] !== main[0]) return;
    const inherited: Record<string, any> = {};
    for (const [name, span] of Object.entries(carry))
      if (span.remaining > 0) {
        inherited[name] = span.value;
        span.remaining--;
      }
    const cells = $(row).children("td");
    if (!cells.length) return;
    if (cells.toArray().some((c) => Number($(c).attr("colspan") || 1) > 1)) {
      for (const name of Object.keys(carry)) delete carry[name];
      return;
    }
    let referenceCell = inherited.reference,
      dateCell = inherited.date,
      linkCell = inherited.link,
      typeCell: any,
      titleCell: any;
    // This publisher uses complete six-cell group rows and two/three/four-cell
    // continuation rows. Read type/title from the actual cells so malformed
    // legacy rowspan counts cannot shift a date into a title or bid reference.
    if (cells.length === 6) {
      referenceCell = cells[1];
      typeCell = cells[2];
      titleCell = cells[3];
      dateCell = cells[4];
      linkCell = cells[5];
      remember("reference", referenceCell);
      remember("date", dateCell);
      remember("link", linkCell);
    } else if ([2, 3, 4].includes(cells.length)) {
      typeCell = cells[0];
      titleCell = cells[1];
      if (cells.length === 4) {
        dateCell = cells[2];
        linkCell = cells[3];
        remember("date", dateCell);
        remember("link", linkCell);
      } else if (cells.length === 3) {
        linkCell = cells[2];
        remember("link", linkCell);
      }
    } else throw new Error("JKMSCL tender row has an unsupported layout");
    const type = clean($(typeCell).text()),
      description = clean($(titleCell).text()),
      docs = documents(linkCell);
    if (!description && !docs.length) return;
    const title =
      (type ? type + " — " : "") +
      (description || "Untitled procurement notice (source title missing)");
    const reference = clean($(referenceCell).text());
    entries.push({
      title,
      url: docs[0] || pageUrl,
      documents: docs,
      reference:
        reference && !/^(?:-|nil|na)$/i.test(reference) ? reference : null,
      closingText: dateCell ? clean($(dateCell).text()) : "",
    });
  });
  // The same published page has an older archive of one-row linked tables.
  // Restrict to these procurement links rather than header/footer documents.
  tables.not(main).each((_, table) => {
    const rows = $(table).find("tr");
    if (rows.length !== 1) return;
    const cells = rows.first().children("td");
    if (cells.length !== 2) return;
    const docs = documents(cells.eq(1)),
      title = clean(cells.eq(1).text());
    if (!docs.length || title.length < 8) return;
    entries.push({
      title,
      url: docs[0],
      documents: docs,
      reference: null,
      closingText: "",
    });
  });
  if (!entries.length) throw new Error("JKMSCL tender list yielded no records");
  return entries;
}
