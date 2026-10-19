// These PDFs are generated solely for isolated tests. They are not real tenders.
export function makePdf(pages: string[]) {
  const objects: string[] = [];
  const add = (s: string) => {
    objects.push(s);
    return objects.length;
  };
  add("<< /Type /Catalog /Pages 2 0 R >>");
  add("");
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const ids: number[] = [];
  for (const text of pages) {
    const operations = [
      "BT /F1 10 Tf 14 TL 40 790 Td",
      ...text
        .split("\n")
        .map(
          (s, i) => `${i ? "T* " : ""}(${s.replace(/([\\()])/g, "\\$1")}) Tj`,
        ),
      "ET",
    ].join("\n");
    const content = add(
      `<< /Length ${Buffer.byteLength(operations)} >>\nstream\n${operations}\nendstream`,
    );
    ids.push(
      add(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`,
      ),
    );
  }
  objects[1] = `<< /Type /Pages /Count ${ids.length} /Kids [${ids.map((id) => id + " 0 R").join(" ")}] >>`;
  let output = "%PDF-1.7\n";
  const offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(output));
    output += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(output);
  output +=
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets
      .slice(1)
      .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
      .join("") +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(output);
}
export function sampleText({
  bid = "GEM/2026/B/8800001",
  product = "Patient monitor",
  quantity = "12",
  extra = "",
} = {}) {
  return `SYNTHETIC TEST ONLY - NOT A REAL TENDER\nBid Number: ${bid}\nDated: 01-10-2026\nBid End Date/Time: 30-10-2026 15:00:00\nTender Title: SYNTHETIC TEST equipment procurement\nOrganisation Name: Synthetic Medical College\nOffice Name: Test Office\nDepartment Name: Department of Test Medicine\nBuyer State: Punjab\nBuyer District: Mohali\nTotal Quantity: ${quantity}\nItem Category: ${product}\nGeMARPTS Searched Result\nDesktop Computer, High End Laptop, Syringe Pump\n${product} ( ${quantity} pieces )\nTechnical Specifications\nSpecification Name: TEST SPECIFICATION ONLY\nPower: 230V\nConsignees/Reporting Officer and Quantity\nDelivery State: Punjab; District: Mohali; Quantity: ${quantity}\nBuyer Added Bid Specific Terms and Conditions\n${extra}`;
}
