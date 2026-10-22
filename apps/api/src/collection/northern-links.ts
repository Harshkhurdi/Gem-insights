import { load } from "cheerio";
import { publicLink, isNoticeAttachment } from "./links";
import { SourceDefinition } from "./registry";
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
export interface NorthernEntry {
  title: string;
  url: string;
  documents: string[];
  reference?: string | null;
  closingText?: string;
}
export function northernLinks(
  html: string,
  source: SourceDefinition,
  pageUrl: string,
): NorthernEntry[] {
  const $ = load(html);
  if (source.adapter === "nhm-ladakh") {
    const marquee = $(".social-links marquee");
    if (!/NHM.*Ladakh/i.test($("title").text()) || !marquee.length)
      throw new Error("Expected NHM Ladakh public notice marquee missing");
    const links = marquee
      .find("a[href]")
      .toArray()
      .flatMap((a) => {
        const title = clean($(a).text()),
          url = publicLink($(a).attr("href"), pageUrl);
        return url &&
          isNoticeAttachment(url) &&
          /\btenders?\b|\bquotation\b|\brequest\s+for\s+proposal\b/i.test(
            title,
          ) &&
          !/\brecruitment\b|\binterview\b|\bcandidates?\b/i.test(title)
          ? [{ title, url, documents: [url] }]
          : [];
      });
    if (!links.length)
      throw new Error(
        "NHM Ladakh procurement links missing; layout may have changed",
      );
    return links;
  }
  const form = $("form[name=adminForm]");
  if (
    !form.length ||
    !/Article Title/.test(form.find(".sectiontableheader").text())
  )
    throw new Error("Expected SKIMS procurement article table missing");
  const category = new URL(source.url).pathname.replace(/\.html$/, "/");
  const links = form
    .find("tr.sectiontableentry1,tr.sectiontableentry2")
    .toArray()
    .map((row) => {
      const cells = $(row).children("td"),
        a = cells.eq(1).find("a[href]").first(),
        title = clean(a.text()),
        url = publicLink(a.attr("href"), pageUrl);
      if (
        cells.length !== 3 ||
        !title ||
        !url ||
        new URL(url).origin !== new URL(source.url).origin ||
        !new URL(url).pathname.startsWith(category)
      )
        throw new Error(
          "SKIMS article row changed or lacks an official category link",
        );
      // The third column is Hits. It is neither a publication date nor quantity.
      return { title, url, documents: [] as string[] };
    });
  if (!links.length)
    throw new Error("SKIMS procurement table yielded no articles");
  return links;
}
