"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  TextField,
} from "@mui/material";
import DraftFields from "./draft-fields";
async function api(path: string, body?: any) {
  const r = await fetch("/api/admin/documents" + path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "Evaluation request failed");
  return j;
}
const pct = (n: number | null) =>
  n === null || n === undefined
    ? "Not yet measured"
    : (100 * n).toFixed(1) + "%";
export function EvaluationMetrics({ report }: { report: any }) {
  if (!report) return <p>Not yet measured</p>;
  return (
    <>
      <Alert severity={report.documentsEvaluated >= 50 ? "info" : "warning"}>
        {report.status} · {report.documentsEvaluated} approved real documents /
        target 50. Synthetic annotations excluded:{" "}
        {report.excludedSyntheticDocuments}. Selected corpus results do not
        establish nationwide accuracy.
      </Alert>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {[
                "Metric / field",
                "Sample",
                "Precision",
                "Recall",
                "F1",
                "Exact match",
                "Missing / truth fields",
                "Correction rate",
              ].map((s) => (
                <th key={s}>{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(report.fields).map(([field, m]: any) => (
              <tr key={field}>
                <td>{field}</td>
                <td>{m.evaluated} non-null comparisons</td>
                <td>
                  {pct(m.precision)} (n={m.tp + m.fp})
                </td>
                <td>
                  {pct(m.recall)} (n={m.tp + m.fn})
                </td>
                <td>{pct(m.f1)}</td>
                <td>{pct(m.exactMatchAccuracy)}</td>
                <td>
                  {m.missing} / {m.truthPresent}
                </td>
                <td>{pct(m.humanCorrectionRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Line items: matched {report.lineItemMatching.matched} /{" "}
        {report.lineItemMatching.predicted} predicted /{" "}
        {report.lineItemMatching.expected} expected. Precision{" "}
        {pct(report.lineItemMatching.precision)}, recall{" "}
        {pct(report.lineItemMatching.recall)}, F1{" "}
        {pct(report.lineItemMatching.f1)}.
      </p>
      <p>
        Processing: {report.processing.successfullyProcessed}/
        {report.processing.recordedAttempts} recorded attempts had complete
        readable extractions ({pct(report.processing.successRate)}). Average{" "}
        {report.processing.averageProcessingMs === null
          ? "Not yet measured"
          : Math.round(report.processing.averageProcessingMs) + " ms"}
        , {report.processing.timedDocuments} timed documents;{" "}
        {report.processing.unrecorded} unrecorded legacy attempts.
        Classification false positives: {report.classification.falsePositives}/
        {report.classification.negativeOpportunities} negative opportunities (
        {pct(report.classification.falsePositiveRate)}).
      </p>
      <p className="fine">
        Report generated{" "}
        {report.generatedAt
          ? new Date(report.generatedAt).toLocaleString()
          : "now"}
        . Saved runs pin annotation versions; rerun after corrections.
      </p>
      <p className="fine">{report.caveat}</p>
    </>
  );
}
export default function CorpusAdmin({ open }: { open: (id: string) => void }) {
  const [page, setPage] = useState(1),
    [report, setReport] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const corpus = useQuery({
    queryKey: ["corpus", page],
    queryFn: () => api("/corpus?page=" + page),
    refetchInterval: 5000,
  });
  const latest = useQuery({
    queryKey: ["evaluation"],
    queryFn: () => api("/evaluation"),
  });
  const shown = report || latest.data;
  async function run() {
    setBusy(true);
    try {
      setReport(await api("/evaluation/run", {}));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="corpus-admin">
      <summary>
        Real-document evaluation corpus · target 50 authorized originals
      </summary>
      <p>
        Enroll documents from Inspect / review. Ground-truth approval is
        separate from production import. Include failed, scanned, ambiguous and
        negative examples.
      </p>
      {error && <Alert severity="error">{error}</Alert>}
      <Button disabled={busy} onClick={run}>
        Run and save evaluation
      </Button>
      <EvaluationMetrics report={shown} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Document</th>
              <th>Annotations</th>
              <th>Original / synthetic</th>
              <th>Tags</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {corpus.data?.data.map((c: any) => (
              <tr key={c.document_id}>
                <td>
                  {c.filename}
                  <small>Processing: {c.processing_status}</small>
                </td>
                <td>
                  {c.status} · v{c.version}
                </td>
                <td>
                  {c.real_original
                    ? "Attested real original"
                    : "Synthetic — excluded"}
                </td>
                <td>{c.tags.join(", ")}</td>
                <td>
                  <Button onClick={() => open(c.document_id)}>
                    Inspect ground truth
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <Button disabled={page === 1} onClick={() => setPage(page - 1)}>
          Previous
        </Button>
        <span>
          {corpus.data?.total || 0} enrolled · page {page}
        </span>
        <Button
          disabled={page * 30 >= (corpus.data?.total || 0)}
          onClick={() => setPage(page + 1)}
        >
          Next
        </Button>
      </div>
      {shown?.corpusTags && (
        <details>
          <summary>Representativeness checklist</summary>
          {shown.corpusTags.map((t: any) => (
            <p key={t.tag}>
              {t.tag}: {t.approvedRealDocuments} approved originals
            </p>
          ))}
        </details>
      )}
      {shown?.documents?.map((d: any) => (
        <details key={d.documentId}>
          <summary>
            {d.documentId} · {d.errors.length} errors · {d.processingStatus}
          </summary>
          <Button onClick={() => open(d.documentId)}>
            Inspect original and annotation
          </Button>
          <pre>{JSON.stringify(d, null, 2)}</pre>
        </details>
      ))}
      {shown?.frequentFailures?.length > 0 && (
        <details>
          <summary>Frequent failures</summary>
          <pre>{JSON.stringify(shown.frequentFailures, null, 2)}</pre>
        </details>
      )}
    </details>
  );
}
export function CorpusAnnotation({
  document,
  taxonomy,
}: {
  document: any;
  taxonomy: any;
}) {
  const [c, setC] = useState<any>(null),
    [record, setRecord] = useState<any>(null),
    [categories, setCategories] = useState<Record<string, string | null>>({}),
    [matches, setMatches] = useState<Record<string, string | null>>({}),
    [real, setReal] = useState(false),
    [reviewed, setReviewed] = useState(false),
    [reason, setReason] = useState(""),
    [tags, setTags] = useState<string[]>([]),
    [causes, setCauses] = useState<string[]>([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const tagOptions = [
    "patient-monitors",
    "ventilators",
    "ultrasound",
    "anaesthesia",
    "infusion-pumps",
    "syringe-pumps",
    "icu-beds",
    "x-ray",
    "surgical-lights",
    "laboratory",
    "text-pdf",
    "scanned",
    "multi-page",
    "multi-product",
    "multi-destination",
    "bilingual",
    "complex-table",
    "amendment",
    "missing-quantity",
    "negative-example",
  ];
  async function load() {
    const data = await api("/" + document.id + "/corpus");
    setC(data);
    if (data) {
      setRecord(data.record);
      setCategories(data.classifications);
      setMatches(data.line_matches);
      setTags(data.tags);
      setCauses(data.error_causes);
      setReviewed(false);
    }
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [document.id]);
  async function action(action: string) {
    setBusy(true);
    setError("");
    try {
      if (action === "enroll")
        await api("/" + document.id + "/corpus/enroll", {
          realOriginal: real,
          reason,
        });
      else {
        const keys = record.items.map((i: any) => i.key);
        await api("/" + document.id + "/corpus/" + action, {
          version: c.version,
          record,
          classifications: Object.fromEntries(
            keys.map((k: string) => [k, categories[k] ?? null]),
          ),
          lineMatches: Object.fromEntries(
            keys.map((k: string) => [k, matches[k] ?? null]),
          ),
          originalReviewed: reviewed,
          reason,
          tags,
          errorCauses: causes,
        });
      }
      await load();
      setMessage(
        action === "approve"
          ? "Ground truth approved for evaluation only. Procurement statistics are unchanged."
          : "Corpus annotation saved.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="corpus-annotation">
      <summary>
        Independent corpus annotation and ground truth{" "}
        {c ? "· " + c.status : "· not enrolled"}
      </summary>
      {error && <Alert severity="error">{error}</Alert>}
      {message && <Alert severity="success">{message}</Alert>}
      <Alert severity="info">
        This editor never imports procurement records. Compare every original
        page and explicitly match each real product to a frozen extracted item.
        Deleted predictions count as false positives; added unmatched products
        count as missing items.
      </Alert>
      {!c ? (
        <>
          <FormControlLabel
            control={
              <Checkbox
                checked={real}
                onChange={(e) => setReal(e.target.checked)}
              />
            }
            label="This is an authorized real original tender PDF, not a synthetic fixture."
          />
          <TextField
            fullWidth
            label="Enrollment purpose / selection and permission reference"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button
            disabled={busy || reason.length < 10}
            onClick={() => action("enroll")}
          >
            Enroll{" "}
            {real ? "real original" : "synthetic test (excluded from accuracy)"}
          </Button>
        </>
      ) : (
        <>
          <p>
            {c.real_original
              ? "Operator-attested real original"
              : "Synthetic case — excluded from real accuracy"}{" "}
            · annotation v{c.version} · frozen observation{" "}
            {c.observation_id || "No extraction: failed input"}
          </p>
          <DraftFields
            record={record}
            setRecord={setRecord}
            states={taxonomy?.states || []}
          />
          {record?.items.map((item: any) => (
            <div className="review-row" key={item.key}>
              <strong>{item.name}</strong>
              <TextField
                select
                label="Ground-truth product family"
                value={categories[item.key] ?? "excluded"}
                onChange={(e) =>
                  setCategories((v) => ({
                    ...v,
                    [item.key]:
                      e.target.value === "excluded" ? null : e.target.value,
                  }))
                }
              >
                <MenuItem value="excluded">
                  Excluded / unrelated / service
                </MenuItem>
                {taxonomy?.products.map((p: any) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Matching parser line (one-to-one)"
                value={matches[item.key] ?? "missing"}
                onChange={(e) =>
                  setMatches((v) => ({
                    ...v,
                    [item.key]:
                      e.target.value === "missing" ? null : e.target.value,
                  }))
                }
              >
                <MenuItem value="missing">No matching extracted line</MenuItem>
                {c.automatic?.items.map((p: any) => (
                  <MenuItem key={p.key} value={p.key}>
                    {p.name} · {p.key}
                  </MenuItem>
                ))}
              </TextField>
            </div>
          ))}
          <p>Corpus diversity tags</p>
          {tagOptions.map((t) => (
            <FormControlLabel
              key={t}
              control={
                <Checkbox
                  checked={tags.includes(t)}
                  onChange={(e) =>
                    setTags((v) =>
                      e.target.checked ? [...v, t] : v.filter((s) => s !== t),
                    )
                  }
                />
              }
              label={t}
            />
          ))}
          <p>Reviewer-confirmed error causes (do not infer OCR causation)</p>
          {[
            "ocr",
            "table-layout",
            "metadata",
            "classification",
            "missing-source-field",
            "parser",
            "other",
          ].map((t) => (
            <FormControlLabel
              key={t}
              control={
                <Checkbox
                  checked={causes.includes(t)}
                  onChange={(e) =>
                    setCauses((v) =>
                      e.target.checked ? [...v, t] : v.filter((s) => s !== t),
                    )
                  }
                />
              }
              label={t}
            />
          ))}
          <TextField
            fullWidth
            label="Ground-truth review / correction reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
              />
            }
            label="I independently checked every original page, ground-truth field, category and line match, including absent values."
          />
          <Button
            disabled={busy || reason.length < 10}
            onClick={() => action("save")}
          >
            Save annotation draft
          </Button>
          <Button
            disabled={busy || !reviewed || reason.length < 10}
            onClick={() => action("approve")}
          >
            Approve ground truth only
          </Button>
          <details>
            <summary>Complete annotation history</summary>
            <pre>{JSON.stringify(c.history, null, 2)}</pre>
          </details>
        </>
      )}
    </details>
  );
}
