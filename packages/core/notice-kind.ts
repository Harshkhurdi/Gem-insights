export const NOTICE_KINDS = [
  "procurement",
  "amendment",
  "cancellation",
  "award",
  "disposal",
  "purchase_report",
  "reference",
  "unknown",
] as const;
export type NoticeKind = (typeof NOTICE_KINDS)[number];
export const NON_DEMAND_NOTICE_KINDS = [
  "cancellation",
  "award",
  "disposal",
  "purchase_report",
  "reference",
] as const;
export const noticeKindLabels: Record<NoticeKind, string> = {
  procurement: "Procurement request",
  amendment: "Amendment / clarification",
  cancellation: "Cancellation / withdrawal",
  award: "Contract award / order",
  disposal: "Disposal / auction",
  purchase_report: "Purchase report",
  reference: "Procurement guidance / forms",
  unknown: "Type unconfirmed",
};
export function noticeKind(title: string): NoticeKind {
  const s = title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  if (/\b(?:cancellation|cancelled|canceled|withdrawal)\b/.test(s))
    return "cancellation";
  // Pending purchases are not completed reports; explicit awards and auctions
  // still take precedence over this wording.
  const pendingPurchase = /\b(?:to be|being) (?:procured|purchased)\b/.test(s);
  if (
    !pendingPurchase &&
    /\b(?:list|statement|report|details)\b.{0,140}\b(?:equipments?|items?|medicines?|machiner(?:y|ies))\b.{0,50}\b(?:procured|purchased)\b/.test(
      s,
    )
  )
    return "purchase_report";
  if (
    !pendingPurchase &&
    /\b(?:procured for the period|procured during|list of equipments? procure in)\b/.test(
      s,
    )
  )
    return "purchase_report";
  if (
    /\b(?:proformas? for requisition|procurement manual|standard bidding documents)\b/.test(
      s,
    )
  )
    return "reference";
  if (
    /\b(?:award of contract|contract award|awarded contract|award notice|notification of award|letter of award|purchase order|supply order)\b/.test(
      s,
    )
  )
    return "award";
  if (
    /\b(?:e auction|eauction|auction (?:of|notice)|sale of (?:used|old|scrap|surplus)|disposal of (?:obsolete|unserviceable|condemned|scrap|used|old|surplus)|condemnation of)\b/.test(
      s,
    )
  )
    return "disposal";
  if (
    /\b(?:corrigendum|corrigenda|addendum|addenda|amendment|clarification|pre bid|extension of|date extended)\b/.test(
      s,
    )
  )
    return "amendment";
  if (
    pendingPurchase ||
    /\b(?:tenders?|quotations?|notice inviting|inviting|eoi|expression of interest|request for proposal|rfp|rate (?:inquiry|enquiry)|procurement|supply of|purchase of)\b/.test(
      s,
    )
  )
    return "procurement";
  return "unknown";
}
