// Reconstruct horizontal text rows from local PDF.js glyph positions.
// This is a conservative text-table aid, not image/table structure recognition.
export function reconstructRows(items) {
  const rows = [];
  for (const item of items) {
    if (typeof item.str !== "string" || !item.str.trim() || !item.transform)
      continue;
    const x = item.transform[4],
      y = item.transform[5];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    let row = rows.find((r) => Math.abs(r.y - y) <= 3);
    if (!row) {
      row = { y, tokens: [] };
      rows.push(row);
    }
    row.tokens.push({ x, end: x + Math.abs(item.width || 0), text: item.str });
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) => {
      const cells = [];
      let text = "",
        end = null;
      for (const token of row.tokens.sort((a, b) => a.x - b.x)) {
        if (end !== null && token.x - end > 14) {
          if (text.trim()) cells.push(text.trim());
          text = "";
        }
        text += (text ? " " : "") + token.text;
        end = token.end;
      }
      if (text.trim()) cells.push(text.trim());
      return { cells };
    });
}
