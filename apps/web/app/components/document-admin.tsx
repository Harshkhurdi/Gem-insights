"use client";
import DraftFields from "./draft-fields";
import CorpusAdmin, { CorpusAnnotation } from "./corpus-admin";
import SourcePreview from "./source-preview";
import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Checkbox,
  FormControlLabel,
  TextField,
  MenuItem,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  Chip,
} from "@mui/material";
async function api(path: string, body?: unknown) {
  const r = await fetch("/api/admin/documents" + path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "Document request failed");
  return j;
}
function uploadFile(
  file: File,
  batchId: string,
  sourceUrl: string,
  reprocess: boolean,
  progress: (n: number) => void,
) {
  return new Promise<any>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/documents/upload");
    xhr.timeout = 90000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) progress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onerror = () =>
      reject(new Error("Upload interrupted; inspect status before retrying"));
    xhr.ontimeout = () =>
      reject(new Error("Upload timed out; inspect status before retrying"));
    xhr.onload = () => {
      try {
        const j = JSON.parse(xhr.responseText);
        xhr.status < 300
          ? resolve(j)
          : reject(new Error(j.error || "Upload rejected"));
      } catch {
        reject(new Error("Unexpected upload response"));
      }
    };
    const data = new FormData();
    data.append("batchId", batchId);
    data.append("file", file);
    if (sourceUrl) data.append("sourceUrl", sourceUrl);
    data.append("reprocess", String(reprocess));
    xhr.send(data);
  });
}
export default function DocumentAdmin({
  taxonomy,
  onChange,
}: {
  taxonomy: any;
  onChange: () => void;
}) {
  const client = useQueryClient();
  const [files, setFiles] = useState<File[]>([]),
    [sourceName, setSourceName] = useState(""),
    [provenance, setProvenance] = useState(""),
    [permission, setPermission] = useState(""),
    [authorized, setAuthorized] = useState(false),
    [evidenceAllowed, setEvidenceAllowed] = useState(false),
    [retain, setRetain] = useState(false),
    [ocr, setOcr] = useState(false),
    [reprocess, setReprocess] = useState(false),
    [urls, setUrls] = useState<Record<string, string>>({}),
    [progress, setProgress] = useState<
      Record<string, { percent: number; status: string }>
    >({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1),
    [sourcePage, setSourcePage] = useState(1),
    [batchId, setBatchId] = useState(""),
    [selected, setSelected] = useState<any>(null),
    [record, setRecord] = useState(""),
    [reason, setReason] = useState(""),
    [overrides, setOverrides] = useState<Record<string, string | null>>({}),
    [complete, setComplete] = useState(false),
    [allPages, setAllPages] = useState(false);
  const docs = useQuery({
    queryKey: ["documents", status, page, batchId],
    queryFn: () =>
      api(
        "?" +
          new URLSearchParams({
            ...(status ? { status } : {}),
            page: String(page),
            ...(batchId ? { batchId } : {}),
          }),
      ),
    refetchInterval: 3000,
  });
  const batches = useQuery({
    queryKey: ["document-batches"],
    queryFn: () => api("/batches"),
    refetchInterval: 3000,
  });
  async function refresh() {
    await client.invalidateQueries({ queryKey: ["documents"] });
    await client.invalidateQueries({ queryKey: ["document-batches"] });
    onChange();
  }
  async function open(id: string) {
    setError("");
    try {
      const d = await api("/" + id);
      setSelected(d);
      setSourcePage(1);
      setRecord(JSON.stringify(d.draft?.record || {}, null, 2));
      setOverrides(d.draft?.manual_classifications || {});
      setReason("");
      setComplete(false);
      setAllPages(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function upload() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (
        !files.length ||
        files.length > 500 ||
        files.reduce((s, f) => s + f.size, 0) > 2 * 1024 ** 3
      )
        throw new Error("Choose 1–500 PDFs, at most 2 GiB per batch");
      const batch = await api("/batches", {
        sourcePortal: "gem",
        sourceName,
        provenance,
        permissionNotes: permission,
        authorizedProcessing: authorized,
        retainContent: retain,
        retainEvidence: evidenceAllowed,
        allowOcr: ocr,
        maxFiles: 500,
      });
      setBatchId(batch.id);
      setPage(1);
      for (let index = 0; index < files.length; index++) {
        const file = files[index],
          key = String(index);
        if (file.size > 15 * 1024 * 1024) {
          setProgress((p) => ({
            ...p,
            [key]: { percent: 0, status: "Rejected: exceeds 15 MiB" },
          }));
          continue;
        }
        try {
          const r = await uploadFile(
            file,
            batch.id,
            urls[key] || "",
            reprocess,
            (n) =>
              setProgress((p) => ({
                ...p,
                [key]: { percent: n, status: "Uploading" },
              })),
          );
          setProgress((p) => ({
            ...p,
            [key]: {
              percent: 100,
              status: r.duplicate
                ? "Duplicate: existing " + r.status
                : "Queued for local processing",
            },
          }));
        } catch (e) {
          setProgress((p) => ({
            ...p,
            [key]: { percent: 0, status: (e as Error).message },
          }));
        }
      }
      setMessage(
        "Batch upload finished. Each file succeeds or fails independently; processing status is listed below.",
      );
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function review(action: string) {
    setBusy(true);
    setError("");
    try {
      const parsed = JSON.parse(record);
      await api("/" + selected.id + "/review/" + action, {
        version: selected.draft.version,
        record: parsed,
        classifications: overrides,
        reason,
        completeSnapshot: complete,
        reviewedAllPages: allPages,
        expectedTenderHash: selected.current?.current_hash || null,
      });
      setMessage(
        action === "approve"
          ? "Approved and imported transactionally. Dashboard metrics now include the reviewed record."
          : action === "stage"
            ? "Complete snapshot staged for batch approval. It remains outside analytics until batch approval."
            : "Review saved. Drafts are excluded from demand analytics.",
      );
      setSelected(null);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  let parsed: any = null;
  try {
    const candidate = JSON.parse(record);
    if (
      candidate &&
      typeof candidate === "object" &&
      !Array.isArray(candidate) &&
      candidate.buyer &&
      typeof candidate.buyer === "object" &&
      Array.isArray(candidate.items) &&
      candidate.items.every((i: any) => i && typeof i === "object")
    )
      parsed = candidate;
  } catch {}
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Authorized PDF ingestion and review</h2>
          <p>
            Local processing only. Drafts enter analytics only after explicit
            administrator approval.
          </p>
        </div>
        <Chip label="GeM documents only" size="small" />
      </div>
      <div className="padded document-admin">
        {error && <Alert severity="error">{error}</Alert>}
        {message && <Alert severity="success">{message}</Alert>}
        <div className="view-tools">
          <TextField
            label="Source institution / portal"
            value={sourceName}
            onChange={(e) => setSourceName(e.target.value)}
          />
          <TextField
            label="Batch provenance"
            value={provenance}
            onChange={(e) => setProvenance(e.target.value)}
          />
        </div>
        <TextField
          fullWidth
          multiline
          label="Processing, extraction and retention permission reference"
          value={permission}
          onChange={(e) => setPermission(e.target.value)}
        />
        <div className="document-permissions">
          <FormControlLabel
            control={
              <Checkbox
                checked={authorized}
                onChange={(e) => setAuthorized(e.target.checked)}
              />
            }
            label="I have permission to process these PDFs locally."
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={evidenceAllowed}
                onChange={(e) => setEvidenceAllowed(e.target.checked)}
              />
            }
            label="I may retain structured fields and minimal evidence quotes."
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={retain}
                onChange={(e) => setRetain(e.target.checked)}
              />
            }
            label="Permission also permits retaining original PDF contents and full extracted text."
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={ocr}
                onChange={(e) => setOcr(e.target.checked)}
              />
            }
            label="Use optional local OCR on unreadable pages (requires Poppler and Tesseract)."
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={reprocess}
                onChange={(e) => setReprocess(e.target.checked)}
              />
            }
            label="Reprocess identical documents only if previously failed or OCR-needed."
          />
        </div>
        <Alert severity="info">
          When content retention is off, temporary PDF bytes are deleted after
          processing; full page text is not retained. Review the original file
          you supplied using the preserved page references. Abandoned temporary
          uploads expire after 24 hours while the worker is running.
        </Alert>
        <input
          type="file"
          multiple
          accept="application/pdf,.pdf"
          aria-label="Authorized GeM tender PDFs"
          disabled={busy}
          onChange={(e) => {
            setFiles(Array.from(e.target.files || []));
            setProgress({});
            setUrls({});
          }}
        />
        <p className="fine">
          Up to 500 PDFs / 2 GiB per batch, uploaded one file at a time. Each
          PDF: 15 MiB, 80 pages. OCR: at most 10 pages. No document URL is
          fetched automatically.
        </p>
        {files.map((file, index) => (
          <div className="upload-file" key={index}>
            <strong>{file.name}</strong>
            <span>{(file.size / 1048576).toFixed(2)} MiB</span>
            <TextField
              size="small"
              fullWidth
              label="Original authorized source URL (optional at upload; required at approval)"
              value={urls[String(index)] || ""}
              onChange={(e) =>
                setUrls((v) => ({ ...v, [index]: e.target.value }))
              }
            />
            {progress[String(index)] && (
              <>
                <LinearProgress
                  variant="determinate"
                  value={progress[String(index)].percent}
                />
                <small>{progress[String(index)].status}</small>
              </>
            )}
          </div>
        ))}
        <Button
          variant="contained"
          disabled={
            busy ||
            !files.length ||
            !authorized ||
            !evidenceAllowed ||
            permission.length < 10 ||
            provenance.length < 10 ||
            sourceName.length < 3
          }
          onClick={upload}
        >
          Upload and process locally
        </Button>
        <hr />
        <CorpusAdmin open={open} />
        <TextField
          select
          label="Batch / processing progress"
          value={batchId}
          onChange={(e) => {
            setBatchId(e.target.value);
            setPage(1);
          }}
        >
          <MenuItem value="">All batches</MenuItem>
          {batches.data?.map((b: any) => (
            <MenuItem key={b.id} value={b.id}>
              {b.source_name} · {b.documents - b.pending}/{b.documents}{" "}
              processed or terminal · {b.failed} need attention · {b.approved}{" "}
              approved · {b.ready} staged ·{" "}
              {new Date(b.created_at).toLocaleString()}
            </MenuItem>
          ))}
        </TextField>
        {batchId && (
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const r = await api("/batches/" + batchId + "/approve", {});
                setMessage(
                  `${r.approved}/${r.attempted} staged documents approved. ${r.outcomes
                    .filter((o: any) => o.status !== "approved")
                    .map((o: any) => o.id + ": " + o.error)
                    .join("; ")}`,
                );
                await refresh();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Approve individually reviewed, staged documents in batch
          </Button>
        )}
        <div className="stat-pair">
          <div>
            <strong>{docs.data?.summary.approved_tenders || 0}</strong>
            <small>Unique approved tenders</small>
          </div>
          <div>
            <strong>{docs.data?.summary.documents || 0}</strong>
            <small>Document identities</small>
          </div>
          <div>
            <strong>{docs.data?.summary.buyer_states?.length || 0}</strong>
            <small>Actual approved buyer states</small>
          </div>
        </div>
        <p className="fine">
          Approved buyer states:{" "}
          {docs.data?.summary.buyer_states?.join(", ") || "None yet"}. This is
          collected coverage, not nationwide completeness.
        </p>
        <TextField
          select
          label="Processing status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <MenuItem value="">All statuses</MenuItem>
          {[
            "queued",
            "extracting",
            "review",
            "needs_ocr",
            "failed",
            "deferred",
            "rejected",
            "approved",
            "cancelled",
          ].map((s) => (
            <MenuItem key={s} value={s}>
              {s.replaceAll("_", " ")}
            </MenuItem>
          ))}
        </TextField>
        {docs.error && <Alert severity="error">{docs.error.message}</Alert>}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {[
                  "Document / source",
                  "Processing",
                  "Pages",
                  "Review / errors",
                  "Actions",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {docs.data?.data.map((d: any) => (
                <tr key={d.id}>
                  <td>
                    {d.filename}
                    <small>{d.source_name}</small>
                    <small>SHA-256 {d.sha256.slice(0, 16)}…</small>
                  </td>
                  <td>
                    <Chip label={d.status.replaceAll("_", " ")} size="small" />
                    <small>{d.extraction_method || "Awaiting worker"}</small>
                    {d.approval_ready && (
                      <small>Reviewed and staged for batch approval</small>
                    )}
                  </td>
                  <td>{d.pages ?? "Unknown"}</td>
                  <td>
                    {d.error ||
                      `${d.warnings?.length || 0} extraction warnings`}
                    <small>
                      {d.retain_content
                        ? "Content retention permitted"
                        : "Metadata / permitted evidence only"}
                    </small>
                  </td>
                  <td>
                    <Button size="small" onClick={() => open(d.id)}>
                      Inspect / review
                    </Button>
                    {d.status === "queued" && (
                      <Button
                        size="small"
                        disabled={busy}
                        onClick={async () => {
                          try {
                            await api("/" + d.id + "/cancel", {});
                            await refresh();
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        Cancel queued document
                      </Button>
                    )}
                    {["failed", "needs_ocr"].includes(d.status) &&
                      d.content_present && (
                        <Button
                          size="small"
                          disabled={busy}
                          onClick={async () => {
                            setError("");
                            try {
                              await api("/" + d.id + "/retry", {
                                allowOcr: ocr,
                              });
                              await refresh();
                            } catch (e) {
                              setError((e as Error).message);
                            }
                          }}
                        >
                          Retry {ocr ? "with OCR" : ""}
                        </Button>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!docs.data?.data.length && (
          <p>No uploaded documents match this view.</p>
        )}
        <div className="pagination">
          <span>
            {docs.data?.total || 0} documents · page {page}
          </span>
          <Button disabled={page === 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <Button
            disabled={page * 30 >= (docs.data?.total || 0)}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
      <Dialog
        open={!!selected}
        onClose={() => !busy && setSelected(null)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          Review extracted tender{" "}
          <Button onClick={() => setSelected(null)}>Close</Button>
        </DialogTitle>
        <DialogContent>
          {selected && (
            <div className="document-review">
              {error && <Alert severity="error">{error}</Alert>}
              <p>
                <strong>{selected.filename}</strong> · SHA-256 {selected.sha256}{" "}
                · Parser {selected.draft?.parser_version || "Not extracted"}
              </p>
              <p>
                Source: {selected.source_name} · Rights:{" "}
                {selected.permission_notes}
              </p>
              {selected.retain_content && selected.content_present ? (
                <Button
                  component="a"
                  href={"/api/admin/documents/" + selected.id + "/file"}
                >
                  Download retained original PDF for page review
                </Button>
              ) : (
                <Alert severity="info">
                  Original PDF contents are not retained. Refer to the
                  authorized original on your device using the page references
                  below.
                </Alert>
              )}
              {selected.error && (
                <Alert severity="warning">{selected.error}</Alert>
              )}
              {selected.draft?.warnings.map((w: string, i: number) => (
                <Alert severity="warning" key={i}>
                  {w}
                </Alert>
              ))}
              {selected.draft && (
                <>
                  <div className="draft-grid">
                    <SourcePreview
                      document={selected}
                      page={sourcePage}
                      setPage={setSourcePage}
                    />
                    <div>
                      <h3>
                        Structured draft · version {selected.draft.version}
                      </h3>
                      <p className="fine">
                        Edit extracted fields. Null means unknown. Preserve
                        stable item keys across amendments. Unknown quantities
                        may remain null; missing identity or source fields block
                        approval.
                      </p>
                      <DraftFields
                        record={parsed || {}}
                        setRecord={(r) => setRecord(JSON.stringify(r, null, 2))}
                        states={taxonomy?.states || []}
                      />
                      <details>
                        <summary>
                          Advanced record and stable source identities
                        </summary>
                        <TextField
                          fullWidth
                          multiline
                          minRows={20}
                          maxRows={35}
                          label="Editable complete tender record (JSON)"
                          value={record}
                          onChange={(e) => setRecord(e.target.value)}
                        />
                      </details>
                      {!parsed && (
                        <Alert severity="error">
                          Use a record object with a buyer object and an items
                          array. Correct invalid JSON in the advanced editor.
                        </Alert>
                      )}
                      <h3>Product classification review</h3>
                      {parsed?.items?.map((item: any, index: number) => (
                        <div className="review-row" key={index}>
                          <div>
                            <strong>{item.name || "Unnamed item"}</strong>
                            <small>Stable key: {item.key}</small>
                            <small>
                              {item.quantity ?? "Unknown quantity"}{" "}
                              {item.unit || "unknown unit"} ·{" "}
                              {selected.draft.classifications[item.key]
                                ?.reason ||
                                "Administrator-added line: classify or leave for review"}
                            </small>
                          </div>
                          <TextField
                            select
                            label="Manual classification override"
                            value={
                              Object.hasOwn(overrides, item.key)
                                ? (overrides[item.key] ?? "exclude")
                                : "automatic"
                            }
                            onChange={(e) =>
                              setOverrides((v) => {
                                const next = { ...v };
                                if (e.target.value === "automatic")
                                  delete next[item.key];
                                else
                                  next[item.key] =
                                    e.target.value === "exclude"
                                      ? null
                                      : e.target.value;
                                return next;
                              })
                            }
                          >
                            <MenuItem value="automatic">
                              Use rules / preserve existing correction
                            </MenuItem>
                            <MenuItem value="exclude">
                              Exclude equipment demand
                            </MenuItem>
                            {taxonomy?.products.map((p: any) => (
                              <MenuItem key={p.id} value={p.id}>
                                {p.name}
                              </MenuItem>
                            ))}
                          </TextField>
                        </div>
                      ))}
                      {selected.current && (
                        <details>
                          <summary>
                            Existing production snapshot · compare stable keys
                            and all line items
                          </summary>
                          <pre>
                            {JSON.stringify(selected.current.raw, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                    <div className="review-evidence">
                      <h3>Evidence and original pages</h3>
                      {Object.entries(selected.draft.evidence).map(
                        ([field, entries]: any) => (
                          <details key={field} open>
                            <summary>{field}</summary>
                            {entries.map((e: any, i: number) => (
                              <blockquote key={i}>
                                <small>
                                  <Button
                                    size="small"
                                    onClick={() => setSourcePage(e.page)}
                                  >
                                    Page {e.page}
                                  </Button>{" "}
                                  · {e.method} · heuristic confidence{" "}
                                  {Math.round(e.confidence * 100)}%
                                </small>
                                <br />
                                {e.quote}
                              </blockquote>
                            ))}
                          </details>
                        ),
                      )}
                      {selected.pages.map((p: any) => (
                        <details key={p.page_number}>
                          <summary>
                            Page {p.page_number} · {p.method} ·{" "}
                            {p.readable ? "Readable" : "Needs source review"} ·{" "}
                            {p.character_count} characters
                          </summary>
                          <pre>
                            {p.text_content ||
                              "Full page text not retained under the upload permission."}
                          </pre>
                        </details>
                      ))}
                    </div>
                  </div>
                  <TextField
                    fullWidth
                    label="Review / correction reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={allPages}
                        onChange={(e) => setAllPages(e.target.checked)}
                      />
                    }
                    label="I reviewed every original page, including unreadable pages, and verified the extracted evidence."
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={complete}
                        onChange={(e) => setComplete(e.target.checked)}
                      />
                    }
                    label="This is a complete current tender snapshot, not a partial amendment; source identity, all line items, quantities and location claims were checked."
                  />
                  <div className="view-tools">
                    <Button
                      disabled={
                        busy ||
                        reason.length < 5 ||
                        selected.status === "approved" ||
                        !parsed
                      }
                      onClick={() => review("save")}
                    >
                      Save draft corrections
                    </Button>
                    <Button
                      disabled={
                        busy ||
                        reason.length < 5 ||
                        selected.status === "approved" ||
                        !parsed
                      }
                      onClick={() => review("defer")}
                    >
                      Defer
                    </Button>
                    <Button
                      color="error"
                      disabled={
                        busy ||
                        reason.length < 5 ||
                        selected.status === "approved" ||
                        !parsed
                      }
                      onClick={() => review("reject")}
                    >
                      Reject
                    </Button>
                    <Button
                      disabled={
                        busy ||
                        reason.length < 5 ||
                        !complete ||
                        !allPages ||
                        !parsed ||
                        selected.status === "approved"
                      }
                      onClick={() => review("stage")}
                    >
                      Stage checked snapshot for batch approval
                    </Button>
                    <Button
                      variant="contained"
                      disabled={
                        busy ||
                        reason.length < 5 ||
                        !complete ||
                        !allPages ||
                        !parsed ||
                        selected.status === "approved"
                      }
                      onClick={() => review("approve")}
                    >
                      Approve complete snapshot and import
                    </Button>
                  </div>
                </>
              )}
              {!selected.draft && (
                <SourcePreview
                  document={selected}
                  page={sourcePage}
                  setPage={setSourcePage}
                />
              )}
              <CorpusAnnotation document={selected} taxonomy={taxonomy} />
              <h3>Review audit</h3>
              {selected.reviews.map((r: any, i: number) => (
                <p key={i}>
                  {r.action} · draft {r.draft_version} · {r.reason}
                </p>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
