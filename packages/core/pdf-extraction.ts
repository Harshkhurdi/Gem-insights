import { createHash } from "node:crypto";
import { classify, Rule, STATES, unitName } from "./domain";
export const PARSER_VERSION = "gem-pdf-3";
export interface ExtractedPage {
  page: number;
  text: string;
  method: "embedded" | "tesseract";
  readable: boolean;
  rows?: { cells: string[] }[];
}
export interface FieldEvidence {
  page: number;
  quote: string;
  method: string;
  confidence: number;
}
export interface ExtractionDraft {
  record: any;
  evidence: Record<string, FieldEvidence[]>;
  classifications: Record<string, ReturnType<typeof classify>>;
  warnings: string[];
  parserVersion: string;
}
const clean = (s: string) =>
  s
    .normalize("NFKC")
    .replace(/[०-९]/g, (d) => String("०१२३४५६७८९".indexOf(d)))
    .replace(/\u0000/g, "")
    .replace(/[\t ]+/g, " ")
    .trim();
const normalized = (s: string) =>
  s
    .toLowerCase()
    .replace(/\((?:v|q)\d+\)/gi, "")
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, " ")
    .trim();
export function stableItemKey(name: string) {
  return (
    "gem-item-" +
    createHash("sha256").update(normalized(name)).digest("hex").slice(0, 20)
  );
}
function decimal(s: string) {
  const v = s.replace(/,/g, "").trim();
  return /^\d{1,14}(?:\.\d{1,4})?$/.test(v) ? v : null;
}
function dateValue(s: string, timestamp = false) {
  const m = s.match(
    /(\d{2})[-/](\d{2})[-/](\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (!m) return null;
  const d = `${m[3]}-${m[2]}-${m[1]}`;
  if (isNaN(Date.parse(d)) || new Date(d).toISOString().slice(0, 10) !== d)
    return null;
  if (!timestamp) return d;
  if (!m[4] || Number(m[4]) > 23 || Number(m[5]) > 59 || Number(m[6] || 0) > 59)
    return null;
  return `${d}T${m[4]}:${m[5]}:${m[6] || "00"}+05:30`;
}
export function extractTender(
  pages: ExtractedPage[],
  sourceUrl: string | null,
  rules: Rule[],
): ExtractionDraft {
  const evidence: ExtractionDraft["evidence"] = {},
    warnings: string[] = [];
  const lines = pages
    .flatMap((p) =>
      p.text
        .split(/\r?\n/)
        .map((text) => ({ text: clean(text), page: p.page, method: p.method })),
    )
    .filter((l) => l.text);
  const add = (
    field: string,
    l: (typeof lines)[number],
    quote = l.text,
    confidence = 0.85,
  ) => {
    (evidence[field] ||= []).push({
      page: l.page,
      quote: quote.slice(0, 900),
      method: l.method,
      confidence:
        l.method === "tesseract" ? Math.min(0.6, confidence) : confidence,
    });
  };
  function field(path: string, pattern: RegExp) {
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].text.match(pattern);
      if (!m) continue;
      let value = clean(m[1] || "");
      if (!value && lines[i + 1]?.page === lines[i].page)
        value = lines[i + 1].text.replace(/^[:\s]+/, "");
      if (value) {
        add(path, lines[i], lines[i].text + " " + (m[1] ? "" : value));
        return value;
      }
    }
    return null;
  }
  const bidText = field(
    "bidNumber",
    /(?:Bid (?:Number|No\.?)|बोली (?:संख्या|क्रमांक))[\s:.-]*(.*)$/i,
  );
  const bidNumber =
    bidText
      ?.match(/GEM\s*\/\s*\d{4}\s*\/\s*[BR]\s*\/\s*\d+/i)?.[0]
      .replace(/\s/g, "")
      .toUpperCase() || null;
  const pub =
    field("publishedAt", /(?:^|\/)\s*(?:Dated|दिनांक)\s*[:\s]*(.*)$/i) ||
    field(
      "publishedAt",
      /(?:Publication Date|Bid Start Date(?:\/Time)?)\s*[:\s]*(.*)$/i,
    );
  const closing = field(
    "closesAt",
    /(?:Bid End Date(?:\/Time)?|बोली समाप्ति दिनांक)\s*[:\s]*(.*)$/i,
  );
  const category = field(
    "items",
    /(?:Item Category|वस्तु श्रेणी)\s*[:\s]*(.*)$/i,
  );
  let explicitTitle = field(
    "title",
    /(?:Tender Title|Bid Title|Subject|निविदा शीर्षक)\s*[:\s]+(.*)$/i,
  );
  const placeholderCategory =
    !!category &&
    /^(?:global\s*tender\s*category|custom\s*bid|boq)(?:\s*\(q\d+\))?$/i.test(
      category,
    );
  const globalTitleIndex = lines.findIndex((l) =>
    /Global Tender Title/i.test(l.text),
  );
  if (globalTitleIndex >= 0) {
    const label = lines[globalTitleIndex],
      inline = label.text
        .match(/Global Tender Title\s*[:\s]*(.*)$/i)?.[1]
        ?.trim();
    const parts: string[] = [];
    const indices: number[] = [globalTitleIndex];
    const fragment = (v: string) =>
      /^[A-Za-z][A-Za-z0-9 (),&+.-]{3,240}$/.test(v) &&
      !/^(?:GlobalTenderCategory|Technical Specifications|Total Quantity|Minimum Average|Bid Details|Item Category)/i.test(
        v,
      );
    if (inline) parts.push(inline);
    else if (
      placeholderCategory &&
      globalTitleIndex >= 2 &&
      /Item Category/.test(lines[globalTitleIndex - 2].text) &&
      fragment(lines[globalTitleIndex - 1].text) &&
      lines[globalTitleIndex - 1].page === label.page
    ) {
      parts.push(lines[globalTitleIndex - 1].text);
      indices.unshift(globalTitleIndex - 1);
    }
    const next = lines[globalTitleIndex + 1];
    if (next && next.page === label.page && fragment(next.text)) {
      parts.push(next.text);
      indices.push(globalTitleIndex + 1);
    }
    if (parts.length) {
      explicitTitle = clean(parts.join(" "));
      evidence.title = [];
      for (const index of indices) add("title", lines[index]);
    }
  }
  if (placeholderCategory)
    warnings.push(
      "Generic global/custom tender category ignored as an equipment line. Read the original BOQ/attachments to establish every item and quantity.",
    );
  const organization = field(
      "buyer.name",
      /(?:(?:Organisation|Organization|Buyer Institution) Name|संगठन का नाम)\s*[:\s]*(.*)$/i,
    ),
    office = field("buyer.office", /Office Name\s*[:\s]*(.*)$/i);
  const buyerName = organization
    ? office && !organization.toLowerCase().includes(office.toLowerCase())
      ? organization + ", " + office
      : organization
    : null;
  const stateText = field(
    "buyer.state",
    /(?:Buyer State|Ministry\/State Name)\s*[:\s]*(.*)$/i,
  );
  const buyerState =
    STATES.find((s) => s.toLowerCase() === stateText?.toLowerCase()) || null;
  const buyerDistrict = field(
    "buyer.district",
    /Buyer District\s*[:\s]*(.*)$/i,
  );
  const total = field("totalQuantity", /Total Quantity\s*[:\s]*(.*)$/i);
  const money = field(
    "estimatedValue",
    /Estimated (?:Bid|Tender) Value(?:\s*\(INR\))?\s*[:\s]*(.*)$/i,
  );
  const items: any[] = [];
  const seen = new Map<string, string | null>();
  const itemHeads: Array<{
    index: number;
    name: string;
    quantity: string | null;
    unit: string;
    sourceIndices?: number[];
    fromTotal?: boolean;
  }> = [];
  // Only explicitly labelled quantity columns/fields are procurement quantities.
  // Numbers in technical specifications never form a requested line by themselves.
  let table = false,
    pending: { name: string; index: number } | null = null;
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i].text;
    if (
      /(?:Item Description|Product Name|वस्तु विवरण).*(?:Quantity|मात्रा)/i.test(
        text,
      )
    ) {
      if (!table) pending = null;
      table = true;
      continue;
    }
    if (
      /^(?:Technical Specifications|Specifications?|Specification Name|Consignees|Delivery Destination|Buyer Added|Additional Terms|GeMARPTS)/i.test(
        text,
      )
    ) {
      table = false;
      pending = null;
    }
    const explicit = text.match(
      /^(.{3,240}?)\s*(?:[—–|:-]\s*)?(?:Quantity|Qty\.?|मात्रा)\s*[:=]\s*([\d,]+(?:\.\d+)?)(?:\s*(pieces?|units?|nos?\.?|numbers?|sets?|kits?|each|नग))?\s*$/i,
    );
    if (
      explicit &&
      !/^(?:Total|Allocated|Delivery|Consignee|Specification)|\b(?:supporting|concentration|capacity|resolution)\b/i.test(
        explicit[1],
      )
    )
      itemHeads.push({
        index: i,
        name: clean(explicit[1].replace(/[—–|:\-\s]+$/, "")),
        quantity: decimal(explicit[2]),
        unit: explicit[3] ? unitName(explicit[3]) : "unknown",
      });
    if (!table) continue;
    // A numbered row may continue on the next line/page. Repeated headers and
    // page numbers are ignored; arbitrary prose is never attached as a number.
    if (/^(?:Page\s+)?\d+\s*(?:\/|of)\s*\d+$/i.test(text)) continue;
    const row = text
      .replace(/\s*\|\s*/g, " ")
      .match(
        /^\d+[.)]?\s+(.{3,240}?)\s+([\d,]+(?:\.\d+)?)(?:\s+(pieces?|units?|nos?\.?|numbers?|sets?|kits?|each|नग))?\s*$/i,
      );
    if (row) {
      itemHeads.push({
        index: i,
        name: clean(row[1]),
        quantity: decimal(row[2]),
        unit: row[3] ? unitName(row[3]) : "unknown",
      });
      pending = null;
      continue;
    }
    const start = text.match(/^\d+[.)]?\s+([^\d].{2,240})$/);
    if (start) {
      pending = { name: start[1], index: i };
      continue;
    }
    if (pending) {
      const tail = text
        .replace(/\s*\|\s*/g, " ")
        .match(
          /^(?:(.{2,200}?)\s+)?([\d,]+(?:\.\d+)?)\s*(pieces?|units?|nos?\.?|numbers?|sets?|kits?|each|नग)\s*$/i,
        );
      if (tail) {
        itemHeads.push({
          index: pending.index,
          sourceIndices: [pending.index, i],
          name: clean(pending.name + " " + (tail[1] || "")),
          quantity: decimal(tail[2]),
          unit: unitName(tail[3]),
        });
        add("tableRow", lines[i]);
        pending = null;
      } else if (!/:|\d/.test(text) && pending.name.length + text.length < 240)
        pending.name += " " + text;
      else pending = null;
    }
  }
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].text.match(
      /^(.{3,240}?)\s*\(\s*([\d,]+(?:\.\d+)?)\s*(pieces?|units?|nos?\.?|numbers?|sets?|kits?|each)\s*\)\s*$/i,
    );
    if (m)
      itemHeads.push({
        index: i,
        name: clean(m[1]),
        quantity: decimal(m[2]),
        unit: unitName(m[3]),
      });
  }
  // Positioned cells allow Quantity/Unit columns in different orders. Only an
  // explicit description+quantity header activates this mode; not spec tables.
  let columns: { name: number; quantity: number; unit: number } | null = null;
  let carry: { name: string; index: number } | null = null;
  for (const p of pages)
    for (const row of p.rows || []) {
      const cells = row.cells.map(clean),
        joined = cells.join(" ");
      const name = cells.findIndex((s) =>
        /^(?:Item Description|Item Name|Product Name|Product Description|Item|Description|वस्तु विवरण)$/i.test(
          s,
        ),
      );
      const quantity = cells.findIndex((s) =>
        /^(?:Quantity|Quantity Required|Qty\.?|मात्रा)$/i.test(s),
      );
      if (name >= 0 && quantity >= 0) {
        columns = {
          name,
          quantity,
          unit: cells.findIndex((s) => /^(?:Unit|UOM|इकाई)$/i.test(s)),
        };
        continue;
      }
      if (
        /^(?:Technical Specifications|Specifications?|Specification Name|Consignees|Buyer Added|Additional Terms|GeMARPTS)/i.test(
          joined,
        )
      ) {
        columns = null;
        carry = null;
        continue;
      }
      if (!columns || /^(?:Page\s+)?\d+\s*(?:\/|of)\s*\d+$/i.test(joined))
        continue;
      const product = cells[columns.name] || "",
        q = decimal(cells[columns.quantity] || "");
      if (!product || /^[\d,.]+$/.test(product)) continue;
      if (q === null) {
        if (!/:|\d/.test(product))
          carry = {
            name: product,
            index: lines.findIndex(
              (l) => l.page === p.page && l.text === clean(joined),
            ),
          };
        continue;
      }
      const itemName = carry ? carry.name + " " + product : product;
      const index = lines.findIndex(
        (l) => l.page === p.page && l.text === clean(joined),
      );
      if (index < 0) continue;
      // Prefer the positioned interpretation of this source row over whitespace parsing.
      for (let h = itemHeads.length - 1; h >= 0; h--)
        if (itemHeads[h].index === index) itemHeads.splice(h, 1);
      itemHeads.push({
        index,
        sourceIndices:
          carry && carry.index >= 0 ? [carry.index, index] : [index],
        name: itemName,
        quantity: q,
        unit:
          columns.unit >= 0 && cells[columns.unit]
            ? unitName(cells[columns.unit])
            : "unknown",
      });
      carry = null;
    }
  itemHeads.sort((a, b) => a.index - b.index);
  if (!itemHeads.length && category && !placeholderCategory) {
    const value = total?.match(
      /^([\d,.]+)\s*(pieces?|units?|nos?\.?|sets?|kits?)?\b/i,
    );
    const multi = /;|,(?!\s*\d)|\s+and\s+/i.test(category);
    itemHeads.push({
      index: Math.max(
        0,
        lines.findIndex((l) => l.text.includes(category)),
      ),
      name: category,
      fromTotal: true,
      quantity: multi ? null : decimal(value?.[1] || ""),
      unit: value?.[2] ? unitName(value[2]) : "unknown",
    });
    if (multi)
      warnings.push(
        "Item category may contain several products. Split and verify every requested line; the bid total has not been assigned to each product.",
      );
  }
  for (let h = 0; h < itemHeads.length; h++) {
    const head = itemHeads[h];
    const key = stableItemKey(head.name);
    if (seen.has(key)) {
      warnings.push(
        `Repeated product heading: ${head.name}. Verify whether repeated text or distinct source rows; split stable keys if necessary.`,
      );
      if (seen.get(key) === head.quantity) continue;
    }
    seen.set(key, head.quantity);
    const finalKey = items.some((i) => i.key === key)
      ? key + "-" + (items.filter((i) => i.name === head.name).length + 1)
      : key;
    const end =
      h + 1 < itemHeads.length ? itemHeads[h + 1].index : lines.length;
    const section = lines.slice(head.index + 1, end);
    const consigneeIndex = section.findIndex((l) =>
      /Consignees|Delivery Destination|Consignee State/i.test(l.text),
    );
    const specLines = section
      .slice(
        0,
        consigneeIndex < 0 ? Math.min(50, section.length) : consigneeIndex,
      )
      .filter((l) => !/^\d+\s*\/\s*\d+$/.test(l.text));
    const item = {
      key: finalKey,
      name: head.name,
      quantity: head.quantity,
      unit: head.unit,
      estimatedValue: null,
      specifications: specLines.some((l) =>
        /Technical Specifications|Specification Name/i.test(l.text),
      )
        ? specLines
            .map((l) => l.text)
            .join("\n")
            .slice(0, 4000)
        : null,
      evidence: (head.sourceIndices || [head.index])
        .map(
          (index) =>
            `p. ${lines[index]?.page || 1}: ${lines[index]?.text || head.name}`,
        )
        .join("; ")
        .slice(0, 1800),
      destinations: [] as any[],
    };
    for (const index of head.sourceIndices || [head.index]) {
      add("items." + finalKey, lines[index]);
      for (const f of [
        "name",
        ...(head.quantity === null ? [] : ["quantity"]),
        ...(head.unit === "unknown" ? [] : ["unit"]),
      ])
        add("items." + finalKey + "." + f, lines[index]);
    }
    if (head.fromTotal && evidence.totalQuantity) {
      // Category/total fallback: the quantity is supported by the explicit total,
      // not by a category label that happens to contain digits.
      if (head.quantity !== null)
        evidence["items." + finalKey + ".quantity"] = [
          ...evidence.totalQuantity,
        ];
      if (head.unit !== "unknown")
        evidence["items." + finalKey + ".unit"] = [...evidence.totalQuantity];
    }
    if (item.specifications)
      add(
        "items." + finalKey + ".specifications",
        specLines[0] || lines[head.index],
        item.specifications,
      );
    if (consigneeIndex >= 0) {
      const delivery = section.slice(consigneeIndex);
      const stop = delivery.findIndex((l) =>
        /Buyer Added|Special terms|Additional Terms/i.test(l.text),
      );
      const scoped = stop >= 0 ? delivery.slice(0, stop) : delivery;
      for (let n = 0; n < scoped.length; n++) {
        const m = scoped[n].text.match(
          /(?:Delivery Destination|Consignee State|Delivery State)\s*:\s*([^;]+)/i,
        );
        if (!m) continue;
        const state = STATES.find(
          (s) => s.toLowerCase() === m[1].trim().toLowerCase(),
        );
        if (!state) {
          warnings.push(
            "Unrecognized explicit delivery state; no geographic allocation made.",
          );
          continue;
        }
        const next = scoped
          .slice(n, Math.min(n + 4, scoped.length))
          .map((l) => l.text)
          .join(" ");
        const district = next
          .match(
            /(?:Delivery District|District)\s*:\s*([^;\n]+?)(?=\s+(?:Quantity|Allocated)|;|$)/i,
          )?.[1]
          ?.trim();
        const q = next.match(
          /(?:Allocated Quantity|Quantity)\s*:\s*([\d,.]+)/i,
        )?.[1];
        item.destinations.push({
          state,
          ...(district ? { district } : {}),
          confirmed: true,
          quantity: q ? decimal(q) : null,
          evidence: `p. ${scoped[n].page}: ${next}`.slice(0, 1800),
        });
        add("items." + finalKey + ".destinations", scoped[n], next, 0.75);
      }
    }
    items.push(item);
  }
  if (!items.length)
    warnings.push(
      "No reliable requested-item heading found. Add reviewed line items before approval.",
    );
  if (!explicitTitle && category)
    warnings.push(
      "No explicit tender title found; item-category wording is a title suggestion and requires review.",
    );
  if (!sourceUrl)
    warnings.push(
      "Original source URL is missing. Add an authorized source reference before approval.",
    );
  if (!buyerName) warnings.push("Buyer institution is missing.");
  if (!buyerState)
    warnings.push(
      "Buyer state is unknown; no state has been inferred from an office or postcode.",
    );
  if (!pub || !dateValue(pub))
    warnings.push(
      "Publication date is unknown; closure is not a publication-date substitute.",
    );
  if (pages.some((p) => !p.readable))
    warnings.push(
      "Unreadable pages remain. OCR or source inspection is required; acknowledge only after reviewing the original pages.",
    );
  if (
    lines.some((l) =>
      /^(?:Corrigendum|Amendment|Date Extension)\b/i.test(l.text),
    )
  )
    warnings.push(
      "Amendment/extension notice detected: this may be a partial record. Assemble a complete current tender snapshot before approving.",
    );
  const record = {
    bidNumber,
    title: explicitTitle || category || null,
    sourceUrl,
    publishedAt: pub ? dateValue(pub) : null,
    closesAt: closing ? dateValue(closing, true) : null,
    status: "unknown",
    buyer: {
      key: buyerName
        ? "gem-buyer-" +
          createHash("sha256")
            .update(normalized(buyerName))
            .digest("hex")
            .slice(0, 20)
        : null,
      name: buyerName,
      state: buyerState,
      district: buyerDistrict,
      department: field("buyer.department", /Department Name\s*[:\s]*(.*)$/i),
      ministry: field("buyer.ministry", /Ministry\/State Name\s*[:\s]*(.*)$/i),
    },
    estimatedValue: money
      ? decimal(money.replace(/^(?:INR|Rs\.?|₹)\s*/i, ""))
      : null,
    items,
  };
  return {
    record,
    evidence,
    classifications: Object.fromEntries(
      items.map((i) => [i.key, classify(i.name, rules)]),
    ),
    warnings: [...new Set(warnings)],
    parserVersion: PARSER_VERSION,
  };
}
