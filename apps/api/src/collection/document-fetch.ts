import { randomUUID, createHash } from "node:crypto";
import { DataSource } from "typeorm";
import { getSource } from "./registry";
import { Documents, MAX_PDF_BYTES } from "../documents/service";

export function allowedNoticeDocument(url: string, sourceId: string) {
  const u = new URL(url),
    source = new URL(getSource(sourceId).url);
  return (
    u.protocol === "https:" &&
    u.origin === source.origin &&
    !u.username &&
    !u.password &&
    /\.pdf$/i.test(u.pathname) &&
    !u.search &&
    !u.hash
  );
}
export async function downloadNoticePdf(url: string): Promise<Buffer> {
  const r = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(30000),
    headers: {
      Accept: "application/pdf",
      "User-Agent":
        "GemInsights/0.3 (public procurement document; local processing)",
    },
  });
  if (!r.ok) throw new Error(`Document returned HTTP ${r.status}`);
  if (!r.body) throw new Error("Document response is empty");
  const reader = r.body.getReader(),
    chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.length;
      if (bytes > MAX_PDF_BYTES)
        throw new Error("Document exceeds 15 MiB limit");
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel();
  }
  const buffer = Buffer.concat(chunks);
  if (!buffer.subarray(0, 5).equals(Buffer.from("%PDF-")))
    throw new Error("Source did not return a genuine PDF");
  return buffer;
}
export class NoticeDocuments {
  constructor(
    private db: DataSource,
    private download = downloadNoticePdf,
    private documents = new Documents(db),
  ) {}
  private async selected(
    noticeId: string,
    expectedHash: string,
    documentIndex: number,
  ) {
    const n = (
      await this.db.query("SELECT * FROM discovered_notice WHERE id=$1", [
        noticeId,
      ])
    )[0];
    if (!n || n.current_hash !== expectedHash)
      throw new Error("Notice changed or not found; reload before extraction");
    if (n.source_portal !== "gem")
      throw new Error(
        "Automatic structured extraction currently supports GeM-format PDFs only; use source review for native formats",
      );
    const url = n.documents[documentIndex];
    if (!url || !allowedNoticeDocument(url, n.source_id))
      throw new Error(
        "Choose an HTTPS PDF linked on the collected source's own official host",
      );
    return { n, url };
  }
  async queue(noticeId: string, expectedHash: string, documentIndex: number) {
    const { url } = await this.selected(noticeId, expectedHash, documentIndex);
    const existing = (
      await this.db.query(
        "SELECT d.id,d.status FROM notice_document_link l JOIN upload_document d ON d.id=l.document_id WHERE l.notice_id=$1 AND l.source_url=$2 AND l.notice_hash=$3",
        [noticeId, url, expectedHash],
      )
    )[0];
    if (
      existing &&
      !["failed", "needs_ocr", "cancelled"].includes(existing.status)
    )
      return { documentId: existing.id, status: existing.status };
    const rows = await this.db.query(
      "INSERT INTO job(id,kind,payload) VALUES($1,'notice-pdf',$2) ON CONFLICT DO NOTHING RETURNING id",
      [randomUUID(), JSON.stringify({ noticeId, expectedHash, documentIndex })],
    );
    return {
      jobId: rows[0]?.id || null,
      status: rows.length ? "queued" : "already_pending",
    };
  }
  async process(payload: {
    noticeId: string;
    expectedHash: string;
    documentIndex: number;
  }) {
    const { n, url } = await this.selected(
      payload.noticeId,
      payload.expectedHash,
      payload.documentIndex,
    );
    const bytes = await this.download(url);
    // Recheck after the network read before queuing extraction against this notice.
    await this.selected(
      payload.noticeId,
      payload.expectedHash,
      payload.documentIndex,
    );
    const old = (
      await this.db.query(
        "SELECT d.status FROM upload_document d WHERE d.sha256=$1",
        [createHash("sha256").update(bytes).digest("hex")],
      )
    )[0];
    const batch = await this.documents.createBatch({
      sourcePortal: "gem",
      sourceName: getSource(n.source_id).name,
      provenance: `Public original PDF linked by collected notice ${n.id}; ${url}`,
      permissionNotes:
        "Operator requested local processing of the publicly linked original procurement document. No external AI or republication.",
      authorizedProcessing: true,
      retainContent: false,
      retainEvidence: true,
      allowOcr: false,
      maxFiles: 1,
    });
    const document = await this.documents.upload(
      batch.id,
      {
        buffer: bytes,
        originalname: "collected-original.pdf",
        mimetype: "application/pdf",
      },
      url,
      !!old && ["failed", "needs_ocr", "cancelled"].includes(old.status),
    );
    await this.db.query(
      "INSERT INTO notice_document_link(notice_id,source_url,document_id,notice_hash) VALUES($1,$2,$3,$4) ON CONFLICT(notice_id,source_url) DO UPDATE SET document_id=EXCLUDED.document_id,notice_hash=EXCLUDED.notice_hash,created_at=now()",
      [n.id, url, document.id, n.current_hash],
    );
    return { documentId: document.id, status: document.status };
  }
}
