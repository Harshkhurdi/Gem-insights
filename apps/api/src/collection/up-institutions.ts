import { load } from "cheerio";
import { publicLink, isNoticeAttachment } from "./links";
import { SourceDefinition } from "./registry";
import { NorthernEntry } from "./northern-links";
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
export function upInstitutionEntries(
  html: string,
  source: SourceDefinition,
  pageUrl: string,
): NorthernEntry[] {
  const $ = load(html);
  if (source.adapter === "raebareli") {
    if (!/Raebareli/i.test($("title").text()))
      throw new Error("Expected AIIMS Raebareli procurement page missing");
    const cards = $(".card-body").filter((_, e) => !!$(e).find("h4").length);
    if (!cards.length)
      throw new Error(
        "Raebareli procurement cards missing; layout changed or access blocked",
      );
    return cards.toArray().map((card) => {
      const header = clean($(card).find("h4").text());
      const match = header.match(
        /(?:Ref\.\/Adv\. Number:|Tender id:)\s*(.+)$/i,
      );
      if (!match)
        throw new Error("Raebareli card lacks a labelled tender reference");
      const paragraphs = $(card)
        .children("p")
        .toArray()
        .map((p) => clean($(p).clone().find("b").remove().end().text()))
        .filter(Boolean);
      const title = paragraphs.join(" — ");
      if (!title)
        throw new Error("Raebareli card lacks a procurement description");
      const links = $(card)
        .find("a[href]")
        .toArray()
        .map((a) => publicLink($(a).attr("href"), pageUrl))
        .filter((u): u is string => !!u);
      const documents = [
        ...new Set(
          links.filter(
            (u) =>
              new URL(u).origin === new URL(source.url).origin &&
              /^\/(?:tender|quotation|pac)-file-download\/\d+$/.test(
                new URL(u).pathname,
              ),
          ),
        ),
      ];
      // The publisher's extensionless download routes return the original PDF.
      // They remain review links; the listing scan does not fetch their content.
      const dates = clean($(card).find(".item7-card-desc").text());
      return {
        title,
        reference: clean(match[1]),
        url: documents[0] || source.url,
        documents,
        publishedText: dates.match(
          /Date of Publishing:\s*(\d{2}-\d{2}-\d{4})/i,
        )?.[1],
        closingText: dates.match(
          /Date of Closing:\s*(\d{2}-\d{2}-\d{4})/i,
        )?.[1],
      };
    });
  }
  const table = $("table.display").filter(
    (_, t) =>
      $(t)
        .find("thead th")
        .toArray()
        .map((h) => clean($(h).text()))
        .join(" ") === "Title Start Date End Date",
  );
  if (table.length !== 1)
    throw new Error(
      "Expected Gorakhpur procurement table missing or ambiguous",
    );
  const rows = table.find("tbody > tr");
  if (!rows.length)
    throw new Error("Gorakhpur table has no explicit procurement rows");
  return rows.toArray().map((row) => {
    const cells = $(row).children("td"),
      title =
        clean(cells.eq(0).find("h4").text()) ||
        clean(cells.eq(0).find("a[href]").first().text());
    if (
      cells.length !== 3 ||
      title.length < 8 ||
      /^(download|view(?: pdf)?|pdf)$/i.test(title)
    )
      throw new Error("Gorakhpur procurement row changed or lacks its title");
    const documents = [
      ...new Set(
        cells
          .eq(0)
          .find("a[href]")
          .toArray()
          .map((a) => publicLink($(a).attr("href"), pageUrl))
          .filter((u): u is string => !!u && isNoticeAttachment(u)),
      ),
    ];
    // Generic Start/End dates are not asserted as original publication/closing.
    // Hidden sort keys beside them must never become quantities or references.
    return { title, url: documents[0] || source.url, documents };
  });
}
