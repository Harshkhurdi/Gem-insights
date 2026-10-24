"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  TextField,
} from "@mui/material";
import { exportCSV } from "../../../../packages/core/csv";
async function api(path: string, body?: unknown, method = "POST") {
  const r = await fetch(
    "/api/" + path,
    body === undefined
      ? {}
      : {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const value = await r.json();
  if (!r.ok)
    throw new Error(
      value.details
        ? value.error +
            ": " +
            value.details
              .map((d: any) => d.path.join(".") + " " + d.message)
              .join("; ")
        : value.error || "Request failed",
    );
  return value;
}
const date = (v: string | null) =>
  v
    ? new Date(v).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })
    : "Unknown";
const timestamp = (v: string | null) =>
  v
    ? new Date(v).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST"
    : "Not collected";
export default function CollectionView() {
  const qc = useQueryClient();
  const summary = useQuery({
    queryKey: ["collection"],
    queryFn: () => api("collection"),
    refetchInterval: 10000,
  });
  const auth = useQuery({ queryKey: ["auth"], queryFn: () => api("auth") });
  const [search, setSearch] = useState(""),
    [source, setSource] = useState(""),
    [state, setState] = useState(""),
    [medical, setMedical] = useState("true"),
    [status, setStatus] = useState(""),
    [product, setProduct] = useState("");
  const [page, setPage] = useState(1),
    [selected, setSelected] = useState<any>(null),
    [raw, setRaw] = useState(""),
    [reason, setReason] = useState(""),
    [checked, setChecked] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const params = new URLSearchParams({
    page: String(page),
    ...(search ? { search } : {}),
    ...(source ? { source } : {}),
    ...(state ? { state } : {}),
    ...(medical ? { medical } : {}),
    ...(status ? { status } : {}),
    ...(product ? { product } : {}),
  });
  const notices = useQuery({
    queryKey: ["collection-notices", params.toString()],
    queryFn: () => api("collection/notices?" + params),
    refetchInterval: 10000,
  });
  async function action(fn: () => Promise<any>, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await fn();
      setMessage(
        result?.queued === 0
          ? "Sources are already queued or paused."
          : success,
      );
      await qc.invalidateQueries();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function review(id: string) {
    await action(async () => {
      const detail = await api("admin/collection/notices/" + id),
        n = detail.notice;
      setSelected(detail);
      setChecked(false);
      setReason("");
      setRaw(
        JSON.stringify(
          (detail.currentTender
            ? { ...detail.currentTender.raw, sourceUrl: n.source_url }
            : null) || {
            sourcePortal: n.source_portal,
            bidNumber: n.bid_number || "",
            title: n.title,
            sourceUrl: n.source_url,
            publishedAt: n.published_at?.slice(0, 10) || null,
            closesAt: null,
            status: "unknown",
            buyer: {
              key: "",
              name: n.buyer_name || "",
              state: n.buyer_state || null,
            },
            documents: n.documents.map((url: string) => ({
              url,
              label: "Original source document",
            })),
            items: [
              {
                key: "1",
                name: "",
                quantity: null,
                unit: "unknown",
                evidence: "",
                destinations: [],
              },
            ],
          },
          null,
          2,
        ),
      );
    }, "Review opened. Check the original source before approving.");
  }
  async function refreshExtraction() {
    if (!selected) return;
    await action(
      async () =>
        setSelected(
          await api("admin/collection/notices/" + selected.notice.id),
        ),
      "Extraction status refreshed. Review every source page before approval.",
    );
  }
  function useExtraction(document: any) {
    setError("");
    if (selected.currentTender) {
      setError(
        "This tender already exists. Compare the extracted fields with the complete current record and reconcile amendments before approval.",
      );
      return;
    }
    const draft = document.draft_record;
    if (
      document.notice_hash !== selected.notice.current_hash ||
      !draft ||
      draft.bidNumber !== selected.notice.bid_number
    ) {
      setError(
        "The extracted identity does not match the current notice. Review the original manually.",
      );
      return;
    }
    const record = {
      ...draft,
      sourcePortal: selected.notice.source_portal,
      sourceUrl: selected.notice.source_url,
      documents: selected.notice.documents.map((url: string) => ({
        url,
        label: "Original or amendment document",
      })),
    };
    setRaw(JSON.stringify(record, null, 2));
    setChecked(false);
    setMessage(
      "Extracted draft loaded. It is provisional; verify quantities, buyer identity and all amendments before approval.",
    );
  }
  function exportPage() {
    const rows = (notices.data?.rows || []).map((n: any) => ({
      source: n.source_name,
      portal: n.source_portal,
      reference: n.bid_number,
      title: n.title,
      url: n.source_url,
      published: n.published_at,
      closingDate: n.closing_date,
      buyer: n.buyer_name,
      state: n.buyer_state,
      candidate: n.medical_candidate,
      review: n.review_status,
      documents: n.documents.join(" "),
    }));
    const blob = new Blob(
      [
        exportCSV(rows, {
          source: "Public listing discoveries",
          scope: "Current filtered page, up to 25 notices",
          filters: params.toString(),
          warning:
            "Title candidates are not verified item demand; duplicates may exist across sources",
          exportedAt: new Date().toISOString(),
        }),
      ],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "tender-discoveries.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  const [showAssistedSources, setShowAssistedSources] = useState(false);
  const data = summary.data;
  return (
    <div className="collection-view">
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Nationwide tender collection</h2>
            <p>
              Collected notices appear in the main insights immediately. Extract
              and review original documents to add item quantities and values.
            </p>
          </div>
        </div>
        <div className="padded">
          <div className="collection-counters">
            {[
              ["Discovered notices", data?.counts.notices],
              [
                "Medical / equipment candidates",
                data?.counts.medical_candidates,
              ],
              ["Item review outstanding", data?.counts.pending],
              ["Item review completed", data?.counts.approved],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <strong>{value ?? "—"}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <Alert severity="info">
            Collection is partial. Registered sources cover all 36 states and
            UTs; automated collection currently supports{" "}
            {data?.sources.filter((s: any) => s.adapter).length || 0} public
            listings. Listing candidates may include services, consumables and
            unrelated equipment. National completeness is unknown.
          </Alert>
          {data?.collectionRegion && data.collectionRegion !== "all" && (
            <p className="fine">
              Bulk collection prioritizes the {data.collectionRegion} region and
              national sources. Other regional sources remain available
              individually.
            </p>
          )}
          <div className="view-tools">
            {auth.data?.authenticated ? (
              <Button
                variant="contained"
                disabled={busy}
                onClick={() =>
                  action(
                    () => api("admin/collection/run", {}),
                    "Collection queued. Keep the API and background worker running; results update automatically.",
                  )
                }
              >
                Start collection
              </Button>
            ) : (
              <p>
                Sign in through Administration to start collection and review
                discoveries.
              </p>
            )}
            <Button
              onClick={() => qc.invalidateQueries({ queryKey: ["collection"] })}
            >
              Refresh status
            </Button>
            <Button disabled={!notices.data?.rows.length} onClick={exportPage}>
              Export current page
            </Button>
          </div>
          {message && <Alert severity="success">{message}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
        </div>
      </section>
      {summary.isError && (
        <Alert severity="error">{summary.error.message}</Alert>
      )}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Discovered tenders</h2>
            <p>
              Broad discovery keeps unknown products available for review. These
              counts do not add unverified quantities to demand analytics.
            </p>
          </div>
        </div>
        <div className="padded collection-filters">
          <TextField
            label="Search title or reference"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <TextField
            select
            label="Source"
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setPage(1);
            }}
          >
            <MenuItem value="">All sources</MenuItem>
            {data?.sources.map((s: any) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Buyer state"
            value={state}
            onChange={(e) => {
              setState(e.target.value);
              setPage(1);
            }}
          >
            <MenuItem value="">All / unknown</MenuItem>
            {data?.states.map((s: any) => (
              <MenuItem key={s.state} value={s.state}>
                {s.state}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Scope"
            value={medical}
            onChange={(e) => {
              setMedical(e.target.value);
              setPage(1);
            }}
          >
            <MenuItem value="true">Medical / equipment candidates</MenuItem>
            <MenuItem value="">All collected notices</MenuItem>
            <MenuItem value="false">Other notices</MenuItem>
          </TextField>
          <TextField
            select
            label="Review"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <MenuItem value="">Any review status</MenuItem>
            {["pending", "approved", "dismissed"].map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Equipment candidate"
            value={product}
            onChange={(e) => {
              setProduct(e.target.value);
              setPage(1);
            }}
          >
            <MenuItem value="">All equipment</MenuItem>
            {data?.products.map((p: any) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name} ({p.notices} notices)
              </MenuItem>
            ))}
          </TextField>
        </div>
        {notices.isError && (
          <Alert severity="error">{notices.error.message}</Alert>
        )}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {[
                  "Official notice",
                  "Buyer / state",
                  "Dates",
                  "Review",
                  "",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {notices.data?.rows.map((n: any) => (
                <tr key={n.id}>
                  <td>
                    <a
                      href={n.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {n.title}
                    </a>
                    <small>
                      {n.bid_number || "No published reference"} ·{" "}
                      {n.source_name}
                    </small>
                    <small>{n.classification_reason}</small>
                    <small>
                      {n.documents.length} linked original / corrigendum
                      documents
                    </small>
                  </td>
                  <td>
                    {n.buyer_name || "Verify buyer institute"}
                    <small>{n.buyer_state || "State unknown"}</small>
                  </td>
                  <td>
                    Published: {date(n.published_at)}
                    <small>
                      Closing date: {date(n.closing_date)} (time unverified)
                    </small>
                    <small>Last seen: {timestamp(n.last_seen)}</small>
                  </td>
                  <td>
                    <Chip
                      size="small"
                      label={n.review_status}
                      color={
                        n.review_status === "approved" ? "success" : "default"
                      }
                    />
                    {n.tender_id && n.review_status !== "approved" && (
                      <small>Previously imported; source changed</small>
                    )}
                  </td>
                  <td>
                    {auth.data?.authenticated && (
                      <Button disabled={busy} onClick={() => review(n.id)}>
                        Review
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!notices.isLoading && !notices.data?.rows.length && (
          <p className="padded">
            No matching discoveries yet. Start collection or adjust filters.
          </p>
        )}
        <div className="view-tools padded">
          <Button disabled={page === 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span>
            Page {page} · {notices.data?.total ?? 0} matching notices
          </span>
          <Button
            disabled={page * 25 >= (notices.data?.total || 0)}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      </section>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Source coverage and scheduling</h2>
            <p>
              A registered portal is a collection target. Only sources with a
              tested adapter run automatically.
            </p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {[
                  "Source",
                  "Collection",
                  "Notices / candidates",
                  "Last success / error",
                  "",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.sources
                .filter((s: any) => s.adapter || showAssistedSources)
                .map((s: any) => (
                  <tr key={s.id}>
                    <td>
                      <a
                        href={s.listing_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {s.name}
                      </a>
                      <small>{s.access_notes}</small>
                    </td>
                    <td>
                      {s.adapter
                        ? s.enabled
                          ? `Automatic · every ${s.interval_minutes} min`
                          : "Paused"
                        : "Assisted import"}
                      <small>
                        {s.checkpoint ? "Pagination checkpoint saved" : ""}
                      </small>
                    </td>
                    <td>
                      {s.notices} / {s.medical_candidates}
                    </td>
                    <td>
                      {s.last_success
                        ? timestamp(s.last_success)
                        : s.last_attempt
                          ? "Last attempt: " + timestamp(s.last_attempt)
                          : "Not collected"}
                      <small>{s.last_error}</small>
                    </td>
                    <td>
                      {s.adapter && auth.data?.authenticated && (
                        <>
                          <Button
                            disabled={busy || !s.enabled}
                            onClick={() =>
                              action(
                                () =>
                                  api("admin/collection/run", {
                                    sourceId: s.id,
                                  }),
                                "Source queued.",
                              )
                            }
                          >
                            Collect
                          </Button>
                          <Button
                            disabled={busy}
                            onClick={() =>
                              action(
                                () =>
                                  api(
                                    "admin/collection/sources/" + s.id,
                                    {
                                      enabled: !s.enabled,
                                      intervalMinutes: s.interval_minutes,
                                    },
                                    "PATCH",
                                  ),
                                "Schedule updated.",
                              )
                            }
                          >
                            {s.enabled ? "Pause" : "Enable"}
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
      <Button onClick={() => setShowAssistedSources(!showAssistedSources)}>
        {showAssistedSources
          ? "Hide assisted sources"
          : `Show assisted sources (${data?.sources.filter((s: any) => !s.adapter).length || 0})`}
      </Button>
      <details className="panel padded">
        <summary>Coverage across all 36 states and UTs</summary>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>State / UT</th>
                <th>Registered targets</th>
                <th>State-specific automatic sources</th>
                <th>Source-recorded buyer notices</th>
              </tr>
            </thead>
            <tbody>
              {data?.states.map((s: any) => (
                <tr key={s.state}>
                  <td>{s.state}</td>
                  <td>{s.registered}</td>
                  <td>{s.automated}</td>
                  <td>{s.notices}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Central listings can contain buyers from many states. Unknown buyer
          locations remain unknown. Registered target URLs still need individual
          validation before adapters are enabled.
        </p>
      </details>
      <Dialog
        open={!!selected}
        onClose={() => !busy && setSelected(null)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>Review original tender and complete snapshot</DialogTitle>
        <DialogContent>
          {selected && (
            <div className="collection-review">
              <div>
                <h3>{selected.notice.title}</h3>
                <a
                  href={selected.notice.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open official notice
                </a>
                {selected.notice.documents.map((url: string, i: number) => (
                  <p key={url}>
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      Document {i + 1}
                    </a>
                    {selected.notice.source_portal === "gem" &&
                      /^https:\/\/.*\.pdf$/i.test(url) && (
                        <Button
                          disabled={busy}
                          onClick={() =>
                            action(
                              () =>
                                api(
                                  "admin/collection/notices/" +
                                    selected.notice.id +
                                    "/extract",
                                  {
                                    expectedHash: selected.notice.current_hash,
                                    documentIndex: i,
                                  },
                                ),
                              "Local PDF download and extraction queued. Keep the worker running, then refresh extraction status.",
                            )
                          }
                        >
                          Extract PDF locally
                        </Button>
                      )}
                  </p>
                ))}
                {selected.notice.source_portal === "gem" && (
                  <Button disabled={busy} onClick={refreshExtraction}>
                    Refresh extraction status
                  </Button>
                )}
                {selected.extractedDocuments?.map((d: any) => (
                  <div key={d.document_id} className="padded">
                    <Chip size="small" label={d.status} />
                    {d.error && <Alert severity="error">{d.error}</Alert>}
                    {d.warnings?.map((w: string, i: number) => (
                      <Alert severity="warning" key={i}>
                        {w}
                      </Alert>
                    ))}
                    {d.draft_record && (
                      <>
                        <details>
                          <summary>
                            Inspect extracted equipment and quantities
                          </summary>
                          <pre className="collection-draft-preview">
                            {JSON.stringify(d.draft_record, null, 2)}
                          </pre>
                        </details>
                        <Button
                          disabled={busy || !!selected.currentTender}
                          onClick={() => useExtraction(d)}
                        >
                          Use extracted draft for review
                        </Button>
                      </>
                    )}
                  </div>
                ))}
                <Alert severity="info">
                  Enter every equipment line with its stable key, original name
                  and page evidence. Keep unknown quantities, prices and
                  destinations unknown. A closing date without a time is not a
                  verified deadline.
                </Alert>
                {selected.currentTender && (
                  <Alert severity="warning">
                    This tender already exists. The complete current record is
                    loaded below; approval replaces that snapshot. Preserve all
                    lines and document amendments.
                  </Alert>
                )}
              </div>
              <div className="admin-form">
                {message && <Alert severity="info">{message}</Alert>}
                <TextField
                  label="Complete reviewed tender JSON"
                  multiline
                  minRows={16}
                  maxRows={28}
                  fullWidth
                  value={raw}
                  onChange={(e) => setRaw(e.target.value)}
                  slotProps={{ htmlInput: { spellCheck: false } }}
                />
                <TextField
                  label="Review / exclusion reason"
                  fullWidth
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={checked}
                      onChange={(e) => setChecked(e.target.checked)}
                    />
                  }
                  label="I checked the original documents and this is the complete current tender snapshot."
                />
                <Button
                  variant="contained"
                  disabled={
                    busy ||
                    !checked ||
                    reason.trim().length < 10 ||
                    selected.notice.review_status === "approved"
                  }
                  onClick={() =>
                    action(async () => {
                      const result = await api(
                        "admin/collection/notices/" +
                          selected.notice.id +
                          "/approve",
                        {
                          expectedHash: selected.notice.current_hash,
                          expectedTenderHash:
                            selected.currentTender?.current_hash || null,
                          record: JSON.parse(raw),
                          reason,
                          reviewedOriginal: true,
                          completeSnapshot: true,
                        },
                      );
                      setSelected(null);
                      return result;
                    }, "Reviewed tender imported into product, geographic and demand analytics.")
                  }
                >
                  Approve into demand analytics
                </Button>
                <Button
                  disabled={
                    busy ||
                    reason.trim().length < 5 ||
                    selected.notice.review_status === "approved"
                  }
                  onClick={() =>
                    action(async () => {
                      await api(
                        "admin/collection/notices/" +
                          selected.notice.id +
                          "/dismiss",
                        { expectedHash: selected.notice.current_hash, reason },
                      );
                      setSelected(null);
                    }, "Notice dismissed with review reason. Original discovery retained.")
                  }
                >
                  Dismiss from review
                </Button>
                {error && <Alert severity="error">{error}</Alert>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
