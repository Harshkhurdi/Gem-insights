// Isolated, bounded local PDF/OCR process. No URLs or network requests are used.
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
const run = promisify(execFile);
const [input, output, ocrFlag] = process.argv.slice(2);
try {
  const data = new Uint8Array(await fs.readFile(input));
  const task = getDocument({
    data,
    standardFontDataUrl:
      path.resolve("node_modules/pdfjs-dist/standard_fonts") + path.sep,
    useSystemFonts: false,
    disableFontFace: true,
    isEvalSupported: false,
    enableXfa: false,
    useWorkerFetch: false,
    maxImageSize: 5000000,
  });
  const pdf = await task.promise;
  if (pdf.numPages > 80)
    throw new Error("PDF exceeds 80-page processing limit");
  const pages = [];
  let total = 0,
    ocrPages = 0;
  for (let n = 1; n <= pdf.numPages; n++) {
    const p = await pdf.getPage(n);
    const content = await p.getTextContent();
    const lines = [];
    let current = "",
      lastY = null;
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = Math.round(item.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 3) {
        if (current.trim()) lines.push(current.trim());
        current = "";
      }
      current += (current ? " " : "") + item.str;
      if (item.hasEOL) {
        lines.push(current.trim());
        current = "";
        lastY = null;
      } else lastY = y;
    }
    if (current.trim()) lines.push(current.trim());
    let text = lines.join("\n"),
      method = "embedded";
    let readable = (text.match(/[a-z0-9]/gi) || []).length >= 40;
    if (!readable && ocrFlag === "true") {
      if (++ocrPages > 10)
        throw new Error("Optional OCR is limited to 10 pages per document");
      const prefix = path.join(
        path.dirname(output),
        path.basename(output) + ".page-" + n,
      );
      try {
        await run(
          process.env.PDFTOPPM_BIN || "pdftoppm",
          [
            "-f",
            String(n),
            "-l",
            String(n),
            "-r",
            "120",
            "-scale-to",
            "2200",
            "-singlefile",
            "-png",
            input,
            prefix,
          ],
          { timeout: 30000, maxBuffer: 100000 },
        );
        const r = await run(
          process.env.TESSERACT_BIN || "tesseract",
          [
            prefix + ".png",
            "stdout",
            "-l",
            process.env.OCR_LANGUAGES || "eng",
            "--psm",
            "6",
          ],
          { timeout: 30000, maxBuffer: 300000 },
        );
        text = r.stdout;
        method = "tesseract";
        readable = (text.match(/[a-z0-9]/gi) || []).length >= 40;
      } finally {
        await fs.rm(prefix + ".png", { force: true });
      }
    }
    if (text.length > 60000)
      throw new Error("Page exceeds 60,000-character extraction limit");
    total += text.length;
    if (total > 500000)
      throw new Error("PDF exceeds 500,000-character extraction limit");
    pages.push({ page: n, text, method, readable });
    p.cleanup();
  }
  await task.destroy();
  await fs.writeFile(output, JSON.stringify({ pages }), { mode: 0o600 });
  console.log(JSON.stringify({ pages: pages.length, status: "extracted" }));
} catch (e) {
  console.error(
    e.code === "ENOENT"
      ? "Local OCR tools are missing. Install Poppler and Tesseract or disable OCR."
      : e.message,
  );
  process.exitCode = 1;
}
