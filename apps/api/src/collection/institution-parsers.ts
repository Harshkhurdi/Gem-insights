import { load } from "cheerio";
import { SourceDefinition } from "./registry";
import { publicLink } from "./links";
export const clean = (v: string) => v.replace(/\s+/g, " ").trim();
export function tableMatches(
  headers: string,
  adapter: SourceDefinition["adapter"],
) {
  switch (adapter) {
    case "raipur":
      return (
        /Tender[.\s]*No\.?/i.test(headers) && /Publishing Date/i.test(headers)
      );
    case "icmr":
      return /Title/.test(headers) && /Last Date/.test(headers);
    case "cppp":
      return (
        /Title\/Ref.No./.test(headers) &&
        /Organisation Name|State Name/.test(headers)
      );
    case "bilaspur":
      return (
        /Reference No/.test(headers) &&
        /Related Document/.test(headers) &&
        /Extend Date/.test(headers)
      );
    case "hll":
      return (
        /Title/.test(headers) &&
        /Ref. No./.test(headers) &&
        /Department/.test(headers)
      );
    case "gmch":
      return (
        /Tender Related Notices/.test(headers) &&
        /Last Date of Submission/.test(headers)
      );
    default:
      return false;
  }
}
// This source has a document-link list rather than a structured tender table.
// Limit selection to its main content; header/footer PDFs are not notices.
export function gmchNoticeLinks(html: string, pageUrl: string) {
  const $ = load(html),
    main = $("main .region-content, main").first();
  if (
    !main.length ||
    !/proprietary|quotations|expression of interest/i.test(main.text())
  )
    throw new Error("Expected GMCH procurement content missing");
  return main
    .find("a[href]")
    .toArray()
    .flatMap((a) => {
      const url = publicLink($(a).attr("href"), pageUrl),
        title = clean($(a).text());
      return url && /\.pdf(?:[?#]|$)/i.test(url) && title.length >= 10
        ? [{ url, title }]
        : [];
    });
}
