// RFC4180 quoting; one row per stable tender line. No implicit numeric conversion.
export function parseCSV(s: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"') {
      if (quoted && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (c === "," || c === "\n")) {
      row.push(cell.replace(/\r$/, ""));
      cell = "";
      if (c === "\n") {
        if (row.some(Boolean)) rows.push(row);
        row = [];
      }
    } else cell += c;
  }
  if (quoted) throw new Error("Unclosed CSV quoted field");
  row.push(cell.replace(/\r$/, ""));
  if (row.some(Boolean)) rows.push(row);
  const headers = rows.shift()?.map((v) => v.replace(/^\uFEFF/, ""));
  if (!headers || new Set(headers).size !== headers.length)
    throw new Error("CSV needs unique headers");
  return rows.map((r, i) => {
    if (r.length !== headers.length)
      throw new Error(
        `CSV row ${i + 2} has ${r.length} cells; expected ${headers.length}`,
      );
    return Object.fromEntries(headers.map((h, k) => [h, r[k]]));
  });
}
export function csvToTenders(s: string) {
  const rows = parseCSV(s);
  const bids = new Map<string, any>();
  for (const r of rows) {
    const base = {
      sourcePortal: r.sourcePortal || "gem",
      bidNumber: r.bidNumber,
      title: r.title,
      sourceUrl: r.sourceUrl,
      publishedAt: r.publishedAt || null,
      closesAt: r.closesAt || null,
      status: r.status || "unknown",
      estimatedValue: r.estimatedValue || null,
      buyer: {
        key: r.buyerKey,
        name: r.buyerName,
        state: r.buyerState || null,
        district: r.buyerDistrict || null,
      },
    };
    const identity = base.sourcePortal + ":" + r.bidNumber;
    let t = bids.get(identity);
    if (!t) {
      t = { ...base, items: [] };
      bids.set(identity, t);
    } else {
      const { items, ...existing } = t;
      if (JSON.stringify(existing) !== JSON.stringify(base))
        throw new Error(`Conflicting tender metadata for ${r.bidNumber}`);
    }
    t.items.push({
      key: r.itemKey,
      name: r.itemName,
      quantity: r.quantity || null,
      unit: r.unit || "unknown",
      estimatedValue: r.lineEstimatedValue || null,
      evidence: r.itemEvidence,
      destinations: r.destinations ? JSON.parse(r.destinations) : [],
    });
  }
  return [...bids.values()];
}
export function exportCSV(
  rows: Record<string, unknown>[],
  metadata: Record<string, unknown>,
) {
  const cell = (v: unknown) => {
    let s =
      v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const head = Object.keys(rows[0] || {});
  return (
    Object.entries(metadata)
      .map(([k, v]) => [cell("# " + k), cell(v)].join(","))
      .join("\r\n") +
    "\r\n" +
    head.map(cell).join(",") +
    "\r\n" +
    rows.map((r) => head.map((k) => cell(r[k])).join(",")).join("\r\n")
  );
}
