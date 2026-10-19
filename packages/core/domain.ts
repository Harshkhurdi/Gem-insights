import { z } from "zod";
import { createHash } from "node:crypto";
export const STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];
const aliases: Record<string, string> = {
  orissa: "Odisha",
  pondicherry: "Puducherry",
  "nct of delhi": "Delhi",
  "new delhi": "Delhi",
  "jammu & kashmir": "Jammu and Kashmir",
  uttaranchal: "Uttarakhand",
  "andaman & nicobar islands": "Andaman and Nicobar Islands",
};
export function stateName(v?: string | null): string | null {
  if (!v?.trim()) return null;
  const k = v.trim().toLowerCase();
  const found = STATES.find((s) => s.toLowerCase() === k) || aliases[k];
  if (!found) throw new Error(`Unrecognized Indian state: ${v}`);
  return found;
}
const text = z.string().trim().min(1).max(2000);
const decimal = z
  .union([
    z.string().regex(/^\d{1,14}(\.\d{1,4})?$/),
    z.number().nonnegative().finite().max(1e14),
  ])
  .transform(String)
  .refine(
    (s) => /^\d{1,14}(\.\d{1,4})?$/.test(s),
    "Quantity exceeds supported decimal precision",
  );
const money = z
  .union([
    z.string().regex(/^\d{1,16}(\.\d{1,2})?$/),
    z.number().nonnegative().finite().max(1e16),
  ])
  .transform(String)
  .refine(
    (s) => /^\d{1,16}(\.\d{1,2})?$/.test(s),
    "Money must have at most two decimal places",
  );
const date = z
  .string()
  .refine(
    (s) =>
      /^\d{4}-\d{2}-\d{2}$/.test(s) &&
      !isNaN(Date.parse(s)) &&
      new Date(s).toISOString().slice(0, 10) === s,
    "Use an ISO publication date",
  );
const instant = z.string().datetime({ offset: true });
const link = z
  .string()
  .url()
  .refine(
    (s) => ["https:", "http:"].includes(new URL(s).protocol),
    "Use HTTP(S) source links",
  );
export const destinationSchema = z
  .object({
    state: text,
    district: text.optional(),
    city: text.optional(),
    confirmed: z.boolean(),
    quantity: decimal.nullish(),
    evidence: text,
  })
  .strict();
export const itemSchema = z
  .object({
    key: z.string().trim().min(1).max(150),
    name: text,
    specifications: z.string().max(20000).nullish(),
    quantity: decimal.nullish(),
    unit: z.string().trim().min(1).max(50).default("unknown"),
    estimatedValue: money.nullish(),
    evidence: text,
    destinations: z.array(destinationSchema).max(100).default([]),
  })
  .strict();
export const tenderSchema = z
  .object({
    bidNumber: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^GEM\/\d{4}\/[BR]\/\d+$/),
    title: text,
    sourceUrl: link,
    publishedAt: date.nullish(),
    closesAt: instant.nullish(),
    revisionAt: instant.nullish(),
    status: z
      .enum(["open", "closed", "cancelled", "awarded", "unknown"])
      .default("unknown"),
    buyer: z
      .object({
        key: text,
        name: text,
        state: text.nullish(),
        district: text.nullish(),
        department: text.nullish(),
        ministry: text.nullish(),
        type: text.nullish(),
      })
      .strict(),
    estimatedValue: money.nullish(),
    emd: money.nullish(),
    description: z.string().max(100000).default(""),
    documents: z
      .array(
        z.object({
          url: link,
          label: text,
          sha256: z
            .string()
            .regex(/^[a-f0-9]{64}$/)
            .optional(),
        }),
      )
      .max(100)
      .default([]),
    relatedBidNumber: z
      .string()
      .regex(/^GEM\/\d{4}\/[BR]\/\d+$/)
      .optional(),
    items: z.array(itemSchema).min(1).max(1000),
  })
  .strict();
export type TenderInput = z.infer<typeof tenderSchema>;
export function unitName(u: string) {
  const k = u.trim().toLowerCase();
  return /^(pcs?|pieces?|nos?\.?|numbers?|units?|each)$/.test(k) ? "units" : k;
}
function scaled(s: string) {
  const [a, b = ""] = s.split(".");
  return BigInt(a) * 10000n + BigInt(b.padEnd(4, "0"));
}
export function validateTender(input: unknown): TenderInput {
  const t = tenderSchema.parse(input);
  stateName(t.buyer.state);
  const keys = new Set<string>();
  for (const i of t.items) {
    if (keys.has(i.key)) throw new Error("Duplicate line key within bid");
    keys.add(i.key);
    i.unit = unitName(i.unit);
    let allocated = 0n;
    for (const d of i.destinations) {
      d.state = stateName(d.state)!;
      if (d.quantity != null) allocated += scaled(d.quantity);
    }
    if (i.quantity != null && allocated > scaled(i.quantity))
      throw new Error("Destination allocation exceeds line quantity");
  }
  return t;
}
function canonical(v: any): any {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object")
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, canonical(v[k])]),
    );
  return v;
}
export function digest(v: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(canonical(v)))
    .digest("hex");
}
export interface Rule {
  id: string;
  name: string;
  category_id: string;
  aliases: string[];
}
const excluded =
  /\b(repair(?:s|ing)?|maintenance|amc|cmc|civil works?|construction|renovation|consumables?|reagents?|pharmaceuticals?|accessories|spares?|probes?|circuits?|tubing|syringes|cables?|sensors?|batteries|parts|refill)\b/i;
export function classify(name: string, rules: Rule[]) {
  const n = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (excluded.test(n.split(/\b(?:with|including|along with)\b/)[0]))
    return {
      productId: null,
      confidence: 1,
      reason:
        "Service, construction, accessory or consumable; excluded from equipment demand",
      review: false,
    };
  const matches = rules.flatMap((r) =>
    r.aliases.flatMap((alias) => {
      const phrase = alias
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
      if (!phrase) return [];
      const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return [...n.matchAll(new RegExp(`\\b${escaped}\\b`, "g"))].map((m) => ({
        rule: r,
        start: m.index!,
        end: m.index! + m[0].length,
      }));
    }),
  );
  const distinct = matches.filter(
    (m) =>
      !matches.some(
        (other) =>
          other.rule.id !== m.rule.id &&
          other.start <= m.start &&
          other.end >= m.end &&
          other.end - other.start > m.end - m.start,
      ),
  );
  const hits = [...new Map(distinct.map((m) => [m.rule.id, m.rule])).values()];
  if (hits.length === 1)
    return {
      productId: hits[0].id,
      confidence: 0.9,
      reason: "Matched equipment alias in line description",
      review: false,
    };
  return {
    productId: null,
    confidence: 0,
    reason: hits.length
      ? "Ambiguous multiple products; split line or review"
      : "No supported equipment alias",
    review: true,
  };
}
export function growth(current: number, previous: number) {
  return previous >= 5 && current >= 5
    ? {
        percent: Math.round(((current - previous) / previous) * 1000) / 10,
        label: "Change in observed dataset; coverage not verified",
      }
    : {
        percent: null,
        label:
          previous === 0
            ? "No baseline"
            : "Insufficient sample (at least 5 tenders per period)",
      };
}
export function csvCell(v: unknown) {
  const s = v == null ? "" : String(v);
  return '"' + (/^[=+\-@\t\r]/.test(s) ? "'" + s : s).replace(/"/g, '""') + '"';
}
