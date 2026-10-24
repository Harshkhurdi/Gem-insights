import { load } from "cheerio";
import { SourceDefinition } from "./registry";
import { publicLink, isNoticeAttachment } from "./links";
export const clean = (v: string) => v.replace(/\s+/g, " ").trim();
export function tableMatches(
  headers: string,
  adapter: SourceDefinition["adapter"],
) {
  switch (adapter) {
    case "jammu":
      return (
        /Upload Date/.test(headers) &&
        /Title/.test(headers) &&
        /Download/.test(headers)
      );
    case "kgmu":
      return (
        /Sr\. No\./.test(headers) &&
        /Notice No\./.test(headers) &&
        /Tenders/.test(headers) &&
        /Submission Date/.test(headers)
      );
    case "kcgmc":
      return (
        /Title/.test(headers) &&
        /Opening Date/.test(headers) &&
        /Closing Date/.test(headers) &&
        /DETAILS/.test(headers)
      );
    case "s3waas":
      return (
        /Title/.test(headers) &&
        /Description/.test(headers) &&
        /Start Date/.test(headers) &&
        /End Date/.test(headers) &&
        /File/.test(headers)
      );
    case "bhubaneswar":
      return (
        /Title/.test(headers) &&
        /Publishing Date/.test(headers) &&
        /Closing Date/.test(headers) &&
        /Download/.test(headers) &&
        /Corrigendum/.test(headers) &&
        /Cancellation/.test(headers) &&
        /Award of Contract/.test(headers)
      );
    case "rmsc":
      return (
        /Name/.test(headers) &&
        /Description/.test(headers) &&
        /Files/.test(headers) &&
        /Upload Date/.test(headers)
      );
    case "upums":
      return (
        /Title/.test(headers) &&
        /Published Date/.test(headers) &&
        /Details/.test(headers)
      );
    case "aiims-delhi":
      return (
        /Title/.test(headers) &&
        /Closing/.test(headers) &&
        /Date of Publishing|Opening Date/.test(headers)
      );
    case "bathinda":
      return (
        /Tender Ref\./.test(headers) &&
        /Start Date/.test(headers) &&
        /End Date/.test(headers) &&
        /Related Links/.test(headers)
      );
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
    case "rishikesh":
      return (
        /(?:Tender|Quotation) Reference/.test(headers) &&
        /Download (?:Tender|Quotation) Document/.test(headers) &&
        /Start Date/.test(headers) &&
        /Last Date/.test(headers)
      );
    case "jodhpur":
      return (
        /Tender Reference/.test(headers) &&
        /Tender Subject/.test(headers) &&
        /Start Date/.test(headers) &&
        /End Date/.test(headers)
      );
    case "sgpgims":
      return (
        /S\.?\s*No\.?/.test(headers) &&
        /Description/.test(headers) &&
        /View \/ Download/.test(headers)
      );
    case "phsc":
      return (
        /BID No/.test(headers) &&
        /End Date/.test(headers) &&
        /Subject of Tender/.test(headers)
      );
    case "gmscl":
      return (
        /Sr\.?\s*No\.?/i.test(headers) &&
        /Tender No\./.test(headers) &&
        /Description/.test(headers) &&
        /Tender Category/.test(headers) &&
        /Closing Date/.test(headers)
      );
    case "tnmsc":
      return (
        /Ref\. Code/.test(headers) &&
        /Ref\. No\./.test(headers) &&
        /Date Of Publish/i.test(headers) &&
        /Documents/i.test(headers)
      );
    case "mangalagiri":
      return (
        /Sl No\.?/.test(headers) &&
        /Tender ID/.test(headers) &&
        /Publish Date/.test(headers) &&
        /Corrigendum/.test(headers)
      );
    case "bibinagar":
      return (
        /S\.?\s*NO/i.test(headers) &&
        /Tender Reference/.test(headers) &&
        /Tender Title/.test(headers) &&
        /Start Date/.test(headers) &&
        /End Date/.test(headers)
      );
    case "jipmer":
      return (
        /S\.?\s*No\.?/i.test(headers) &&
        /Title/.test(headers) &&
        /Date of Release/.test(headers) &&
        /Last Date/.test(headers)
      );
    case "cgmscl":
      return (
        /S\.?\s*No\.?/.test(headers) &&
        /Tender Ref\./.test(headers) &&
        /Attachments/i.test(headers)
      );
    case "hmscl":
      return (
        /Tender \/ Reference/.test(headers) &&
        /Important Dates/.test(headers) &&
        /Corrigendum/.test(headers)
      );
    default:
      return false;
  }
}
export function kmsclNoticeLinks(html: string, pageUrl: string) {
  const $ = load(html),
    main = $("main#main").first();
  if (!main.length || !/^Notices$/i.test(clean(main.find("h1").first().text())))
    throw new Error("Expected KMSCL notices content missing");
  const rows = main
    .find(".list-box")
    .toArray()
    .flatMap((box) => {
      const title = clean($(box).find(".media1 p").text());
      const documents = [
        ...new Set(
          $(box)
            .find("a[href]")
            .toArray()
            .map((a) => publicLink($(a).attr("href"), pageUrl))
            .filter((u): u is string => !!u && isNoticeAttachment(u)),
        ),
      ];
      if (!title || !documents.length)
        throw new Error(
          "KMSCL notice lacks a title or attachment; layout may have changed",
        );
      return [{ title, url: documents[0], documents }];
    });
  if (!rows.length)
    throw new Error(
      "KMSCL notices yielded no records; layout may have changed",
    );
  return rows;
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
