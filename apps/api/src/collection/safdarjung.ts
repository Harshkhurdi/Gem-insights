import { load } from "cheerio";
import { publicLink, isNoticeAttachment } from "./links";
import { SourceDefinition } from "./registry";
import { NorthernEntry } from "./northern-links";
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
export function safdarjungEntries(
  html: string,
  source: SourceDefinition,
  pageUrl: string,
): NorthernEntry[] {
  const $ = load(html);
  if (!/Safdarjung/i.test($("title").text()))
    throw new Error("Expected Safdarjung procurement page missing");
  const table = $("table").filter((_, t) => {
    const heads = $(t)
      .find("thead th")
      .toArray()
      .map((h) => clean($(h).text()).split(" / ")[0]);
    return (
      heads.length === 4 &&
      heads[0] === "Sr. No." &&
      heads[1] === "Title" &&
      heads[2] === "Date" &&
      heads[3] === "Download"
    );
  });
  if (table.length !== 1)
    throw new Error(
      "Expected Safdarjung procurement table missing or ambiguous",
    );
  const rows = table.find("tbody > tr");
  if (!rows.length)
    throw new Error("Safdarjung list has no explicit notice rows");
  // Only the published complete table is supported. An added HTTP pager needs
  // explicit validation rather than silently truncating a newly paginated site.
  if ($("nav.pager, .pager__items").length)
    throw new Error("Safdarjung pagination changed; collection incomplete");
  return rows.toArray().map((row) => {
    const cells = $(row).children("td"),
      title = clean(cells.eq(1).text());
    if (cells.length !== 4 || !title)
      throw new Error("Safdarjung row changed or lacks a title");
    const documents = [
      ...new Set(
        cells
          .eq(3)
          .find("a[href]")
          .toArray()
          .map((a) => publicLink($(a).attr("href"), pageUrl))
          .filter((u): u is string => !!u && isNoticeAttachment(u)),
      ),
    ];
    // A generic Date heading is not evidence of original publication/closing.
    const reference = title
      .match(/\bGEM\s*[-/]\s*\d{4}\s*[-/]\s*[BR]\s*[-/]\s*\d+\b/i)?.[0]
      .replace(/\s/g, "")
      .replace(/-/g, "/")
      .toUpperCase();
    return { title, url: documents[0] || source.url, documents, reference };
  });
}
