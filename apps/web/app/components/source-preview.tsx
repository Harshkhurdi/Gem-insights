"use client";
import { useEffect, useRef, useState } from "react";
import { Alert, Button, TextField } from "@mui/material";
export default function SourcePreview({
  document,
  page,
  setPage,
}: {
  document: any;
  page: number;
  setPage: (n: number) => void;
}) {
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null),
    [pdf, setPdf] = useState<any>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let active = true;
    setBytes(null);
    setPdf(null);
    setError("");
    if (document.retain_content && document.content_present)
      fetch("/api/admin/documents/" + document.id + "/file")
        .then(async (r) => {
          if (!r.ok) throw new Error("Retained PDF could not be opened");
          const data = await r.arrayBuffer();
          if (active) setBytes(data);
        })
        .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [document.id, document.retain_content, document.content_present]);
  useEffect(() => {
    if (!bytes) return;
    let active = true,
      task: any;
    setLoading(true);
    setError("");
    import("pdfjs-dist/legacy/build/pdf.mjs")
      .then(async (lib) => {
        if (!active) return;
        lib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        task = lib.getDocument({
          data: new Uint8Array(bytes.slice(0)),
          enableXfa: false,
          useWorkerFetch: false,
          useSystemFonts: true,
          maxImageSize: 5000000,
        });
        const loaded = await task.promise;
        if (loaded.numPages > 80)
          throw new Error("Preview exceeds 80-page limit");
        if (active) {
          setPdf(loaded);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setError("Local PDF preview: " + e.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
      task?.destroy();
    };
  }, [bytes]);
  useEffect(() => {
    if (!pdf || !canvas.current) return;
    let active = true,
      render: any;
    pdf
      .getPage(Math.min(page, pdf.numPages))
      .then((p: any) => {
        if (!active || !canvas.current) return;
        const base = p.getViewport({ scale: 1 }),
          view = p.getViewport({
            scale: Math.min(1.5, 1000 / base.width, 1800 / base.height),
          });
        const target = canvas.current;
        target.width = Math.ceil(view.width);
        target.height = Math.ceil(view.height);
        render = p.render({
          canvasContext: target.getContext("2d"),
          canvas: target,
          viewport: view,
        });
        return render.promise;
      })
      .catch((e: any) => {
        if (active && e.name !== "RenderingCancelledException")
          setError("Page rendering failed: " + e.message);
      });
    return () => {
      active = false;
      render?.cancel();
    };
  }, [pdf, page]);
  async function local(file?: File) {
    if (!file) return;
    try {
      if (file.size > 15 * 1024 * 1024)
        throw new Error("Choose the original PDF (up to 15 MiB)");
      const data = await file.arrayBuffer();
      const hash = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", data)),
      )
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("");
      if (hash !== document.sha256)
        throw new Error(
          "Checksum does not match this document. Choose the exact original.",
        );
      setBytes(data);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const count = pdf?.numPages || document.pages?.length || 80;
  return (
    <aside className="source-preview">
      <h3>Original PDF · local renderer</h3>
      {error && <Alert severity="warning">{error}</Alert>}
      {!document.retain_content && (
        <>
          <p className="fine">
            Select the original for local viewing only. It is checksum-checked
            and stays in this browser; retention permission is unchanged.
          </p>
          <input
            type="file"
            accept="application/pdf,.pdf"
            aria-label="View original locally without retention"
            onChange={(e) => local(e.target.files?.[0])}
          />
        </>
      )}
      <div className="view-tools">
        <Button disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Previous page
        </Button>
        <TextField
          size="small"
          type="number"
          label="Source page"
          value={page}
          onChange={(e) =>
            setPage(Math.min(count, Math.max(1, Number(e.target.value) || 1)))
          }
        />
        <Button disabled={page >= count} onClick={() => setPage(page + 1)}>
          Next page
        </Button>
      </div>
      {loading && <p>Rendering original locally…</p>}
      {pdf ? (
        <canvas
          ref={canvas}
          role="img"
          aria-label={"Original PDF page " + page + " of " + pdf.numPages}
        />
      ) : (
        !loading && (
          <Alert severity="info">
            Choose the authorized original if its contents were not retained.
            PDF preview is local; no source URL is fetched.
          </Alert>
        )
      )}
      <p className="fine">
        PDF.js renders source bytes locally. Evidence and text alternatives
        appear below the fields.
      </p>
    </aside>
  );
}
