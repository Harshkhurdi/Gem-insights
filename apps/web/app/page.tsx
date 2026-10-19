"use client";
import DocumentAdmin from "./components/document-admin";
import { EvaluationMetrics } from "./components/corpus-admin";
import React, { useEffect, useMemo, useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ThemeProvider,
  createTheme,
  Button,
  TextField,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  Chip,
  Alert,
  CircularProgress,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import {
  LayoutDashboard,
  Stethoscope,
  Boxes,
  MapPinned,
  Building2,
  ChartNoAxesCombined,
  Files,
  Layers3,
  Database,
  Settings,
  ArrowUpRight,
  ChevronRight,
  Search,
  Download,
  ArrowLeft,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Menu,
  Activity,
  Info,
  Check,
  Clock,
} from "lucide-react";
import { geoMercator, geoPath } from "d3-geo";
import { csvToTenders, exportCSV } from "../../../packages/core/csv";
const theme = createTheme({
  palette: { primary: { main: "#2858b8" }, background: { default: "#f5f7fa" } },
  typography: {
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    button: { textTransform: "none", fontWeight: 600 },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiTextField: { defaultProps: { size: "small" } },
    MuiButton: { defaultProps: { disableElevation: true } },
  },
});
const qc = new QueryClient({
  defaultOptions: { queries: { staleTime: 15000, retry: 1 } },
});
async function api(path: string, options?: RequestInit) {
  const res = await fetch("/api/" + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const body = await res.json();
  if (!res.ok)
    throw new Error(
      body.details
        ? body.error +
            ": " +
            body.details
              .map((x: any) => x.path.join(".") + " " + x.message)
              .join("; ")
        : body.error || "Request failed",
    );
  return body;
}
const number = (n: any) =>
  n == null
    ? "Unknown"
    : new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(
        Number(n),
      );
const money = (n: any) =>
  n == null
    ? "Unknown"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(Number(n));
const date = (d: any) =>
  d
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeZone: "Asia/Kolkata",
      }).format(new Date(d))
    : "Unknown";
const timestamp = (d: any) =>
  d
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kolkata",
      }).format(new Date(d)) + " IST"
    : "No successful update";
const units = (q: any) =>
  q
    ? Object.entries(q)
        .map(([u, v]) => `${number(v)} ${u}`)
        .join(" · ")
    : "Unknown";
const nav = [
  ["Overview", LayoutDashboard],
  ["Medical Equipment", Stethoscope],
  ["Product Intelligence", Boxes],
  ["Geographic Intelligence", MapPinned],
  ["Buyer Intelligence", Building2],
  ["Demand Trends", ChartNoAxesCombined],
  ["Tender Explorer", Files],
  ["Categories", Layers3],
  ["Data Coverage", Database],
  ["Administration", Settings],
] as const;
const descriptions: Record<string, string> = {
  Overview: "A clearer view of government procurement demand.",
  "Medical Equipment": "Explore equipment families and the demand behind them.",
  "Product Intelligence": "Find the products institutions are requesting.",
  "Geographic Intelligence":
    "Follow demand from states to the institutions behind it.",
  "Buyer Intelligence": "Understand who creates demand, and what they request.",
  "Demand Trends": "Observe procurement activity across time.",
  "Tender Explorer": "Inspect the original notices behind every number.",
  Categories: "A growing taxonomy, built for broader intelligence.",
  "Data Coverage": "Know what the dataset can — and cannot — tell you.",
  Administration: "Manage authorized data, classification and collection.",
};
function Panel({
  title,
  sub,
  action,
  children,
  className = "",
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={"panel " + className}>
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
function Empty({
  text = "No matching records. Adjust the filters or import an authorized dataset.",
}: {
  text?: string;
}) {
  return (
    <div className="empty">
      <Database size={26} />
      <p>{text}</p>
    </div>
  );
}
function Table({
  heads,
  children,
}: {
  heads: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {heads.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function Bars({ rows, onClick }: { rows: any[]; onClick?: (r: any) => void }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return rows.length ? (
    <div className="bars">
      {rows.reduce((sum: number, r: any) => sum + r.value, 0) < 25 && (
        <Alert severity="warning">
          Very small observed sample. Collected tender appearances do not
          establish national demand.
        </Alert>
      )}
      {rows.slice(0, 6).map((r, i) => (
        <button
          key={r.label}
          className="bar-row"
          onClick={() => onClick?.(r)}
          aria-label={`${r.label}: ${r.value} tenders`}
        >
          <span className="bar-label">
            <b>{String(i + 1).padStart(2, "0")}</b>
            {r.label}
          </span>
          <span className="bar-track">
            <span style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <strong>{number(r.value)}</strong>
          <ChevronRight size={14} />
        </button>
      ))}
    </div>
  ) : (
    <Empty />
  );
}
function HistoryChart({
  rows,
  onSelect,
  metric = "tenders",
  unit = "units",
}: {
  rows: any[];
  onSelect?: (r: any) => void;
  metric?: string;
  unit?: string;
}) {
  const series = useMemo(() => {
    const periods = [...new Set(rows.map((r) => r.period))].sort() as string[];
    const names = [...new Set(rows.map((r) => r.product_name))] as string[];
    return {
      periods,
      names,
      points: names.map((name) => ({
        name,
        values: periods.map((p) => {
          const r = rows.find((r) => r.period === p && r.product_name === name);
          return r
            ? metric === "tenders"
              ? r.tenders
              : (r.quantities?.[unit] ?? null)
            : null;
        }),
      })),
    };
  }, [rows, metric, unit]);
  const max = Math.max(
    1,
    ...series.points.flatMap((p) => p.values.map((v) => Number(v) || 0)),
  );
  const colors = ["#2858b8", "#239a87", "#bc8741", "#8364b7", "#c16177"];
  if (!rows.length)
    return (
      <Empty text="No publication-dated records for this period. No trend has been inferred." />
    );
  const x = (i: number) =>
    64 + (i / Math.max(1, series.periods.length - 1)) * 650;
  const y = (v: number) => 200 - (v / max) * 160;
  return (
    <div className="history">
      {rows.reduce((sum: number, r: any) => sum + r.tenders, 0) < 25 && (
        <Alert severity="warning">
          Very small observed sample (fewer than 25 product-tender appearances).
          This chart cannot establish national demand or a reliable market
          trend.
        </Alert>
      )}
      <svg
        viewBox="0 0 770 250"
        role="img"
        aria-label={`${metric === "tenders" ? "Tender count" : unit} by publication period; missing periods have no plotted observations`}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line
              x1="64"
              y1={y(max * t)}
              x2="725"
              y2={y(max * t)}
              stroke="#e8edf4"
            />
            <text
              x="49"
              y={y(max * t) + 4}
              textAnchor="end"
              fontSize="11"
              fill="#7d8899"
            >
              {number(max * t)}
            </text>
          </g>
        ))}
        {series.points.map((s, k) => (
          <g key={s.name}>
            {s.values.map((v, i) =>
              v != null ? (
                <g key={i}>
                  {i > 0 && s.values[i - 1] != null && (
                    <line
                      x1={x(i - 1)}
                      y1={y(Number(s.values[i - 1]))}
                      x2={x(i)}
                      y2={y(Number(v))}
                      stroke={colors[k % 5]}
                      strokeWidth="2.5"
                    />
                  )}
                  <circle
                    cx={x(i)}
                    cy={y(Number(v))}
                    r="5"
                    fill={colors[k % 5]}
                    tabIndex={0}
                    role="button"
                    onClick={() =>
                      onSelect?.({ period: series.periods[i], product: s.name })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        onSelect?.({
                          period: series.periods[i],
                          product: s.name,
                        });
                    }}
                  >
                    <title>
                      {s.name}: {number(v)}{" "}
                      {metric === "tenders" ? "tenders" : unit} ·{" "}
                      {series.periods[i]}
                    </title>
                  </circle>
                </g>
              ) : null,
            )}
          </g>
        ))}
        {series.periods
          .filter(
            (_, i) =>
              i % Math.max(1, Math.ceil(series.periods.length / 8)) === 0,
          )
          .map((p) => (
            <text
              key={p}
              x={x(series.periods.indexOf(p))}
              y="229"
              textAnchor="middle"
              fontSize="11"
              fill="#7d8899"
            >
              {p}
            </text>
          ))}
      </svg>
      <div className="legend">
        {series.names.map((n, i) => (
          <span key={n}>
            <i style={{ background: colors[i % 5] }} />
            {n}
          </span>
        ))}
      </div>
      <p className="fine">
        Publication dates · Gaps are unobserved, not zero demand.{" "}
        {metric === "units" ? "Quantities are shown in " + unit + "." : ""}
      </p>
    </div>
  );
}
function IndiaMap({
  rows,
  selected,
  onSelect,
  metric,
}: {
  rows: any[];
  selected: string;
  onSelect: (s: string) => void;
  metric: string;
}) {
  const [geo, setGeo] = useState<any>(null),
    [error, setError] = useState("");
  const [hover, setHover] = useState("");
  useEffect(() => {
    const ac = new AbortController();
    async function load() {
      try {
        let r = await fetch("/india-states.geojson", { signal: ac.signal });
        if (!r.ok)
          r = await fetch(
            "https://pub-0429b8e3b5a946e69ea007df844a6f1c.r2.dev/admin/states/LGD_States.geojson",
            { signal: ac.signal },
          );
        if (!r.ok) throw new Error("Boundary file unavailable");
        const j = await r.json();
        if (j.type !== "FeatureCollection" || j.features.length !== 36)
          throw new Error("Expected a verified 36-state boundary file");
        setGeo(j);
      } catch (e) {
        if (!ac.signal.aborted)
          setError(
            "State boundary file unavailable. Use the complete state table below; download the licensed map asset during setup.",
          );
      }
    }
    load();
    return () => ac.abort();
  }, []);
  const path = useMemo(
    () =>
      geo
        ? geoPath(
            geoMercator().fitExtent(
              [
                [20, 10],
                [620, 450],
              ],
              geo,
            ),
          )
        : null,
    [geo],
  );
  const name = (f: any) => {
    const p = f.properties;
    return (
      p.stname ||
      p.ST_NM ||
      p.state_name ||
      p.shapeName ||
      p.name ||
      p.State_Name ||
      ""
    );
  };
  const value = (s: string) => {
    const row = rows.find((r) => r.state?.toLowerCase() === s.toLowerCase());
    return row
      ? metric === "tenders"
        ? row.tenders
        : row.quantities?.units
      : null;
  };
  const max = Math.max(
    1,
    ...rows.map(
      (r) =>
        Number(metric === "tenders" ? r.tenders : r.quantities?.units) || 0,
    ),
  );
  return (
    <div className="map">
      <div className="map-key">
        <span>
          <i />
          No observation
        </span>
        <span>
          <i className="observed" />
          {metric === "tenders" ? "More tenders" : "More units"}
        </span>
      </div>
      {error ? (
        <Alert severity="info">{error}</Alert>
      ) : !path ? (
        <div className="empty">
          <CircularProgress size={22} />
          <p>Loading licensed India boundaries…</p>
        </div>
      ) : (
        <svg
          viewBox="0 0 640 465"
          role="group"
          aria-label="India state demand map"
        >
          {geo.features.map((f: any, i: number) => {
            const n = name(f),
              v = value(n);
            return (
              <path
                key={i}
                d={path(f) || ""}
                fill={
                  v == null
                    ? "#e8ecf1"
                    : `hsl(220 55% ${80 - (Number(v) / max) * 38}%)`
                }
                stroke={selected === n ? "#142f5f" : "#fff"}
                strokeWidth={selected === n ? 2 : 0.7}
                tabIndex={0}
                role="button"
                aria-label={`${n}: ${v == null ? "no observations" : number(v) + " " + metric}`}
                onMouseEnter={() => setHover(n)}
                onFocus={() => setHover(n)}
                onClick={() => onSelect(n)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(n);
                  }
                }}
              >
                <title>
                  {n}: {v == null ? "No observation" : number(v) + " " + metric}
                </title>
              </path>
            );
          })}
        </svg>
      )}
      <div className="map-caption">
        <strong>{hover || selected || "Select a state to explore"}</strong>
        <span>
          {hover
            ? `${value(hover) == null ? "No observation" : number(value(hover)) + " " + metric}`
            : "Map and table share the same filters"}
        </span>
      </div>
      <p className="fine">
        LGD state boundaries, 2024 snapshot via{" "}
        <a
          href="https://bharatlas.com/view/gb_adm1"
          target="_blank"
          rel="noreferrer"
        >
          bharatlas
        </a>{" "}
        · CC0 / CC BY 4.0 · Administrative reference.
      </p>
    </div>
  );
}
function Dashboard() {
  const client = useQueryClient();
  const [view, setView] = useState("Overview"),
    [mobile, setMobile] = useState(false);
  const [f, setF] = useState<Record<string, string>>({ basis: "buyer" }),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [detail, setDetail] = useState<string | null>(null),
    [compare, setCompare] = useState<string[]>([]),
    [metric, setMetric] = useState("tenders"),
    [trendMetric, setTrendMetric] = useState("tenders"),
    [trendUnit, setTrendUnit] = useState("units"),
    [compareStates, setCompareStates] = useState<string[]>([]);
  const change = (key: string, value: string) => {
    setF((old) => ({ ...old, [key]: value }));
    setPage(1);
  };
  const params = useMemo(
    () =>
      new URLSearchParams(
        Object.entries({ ...f, q: search }).filter(([, v]) => v),
      ).toString(),
    [f, search],
  );
  const tax = useQuery({
    queryKey: ["taxonomy"],
    queryFn: () => api("taxonomy"),
  });
  const coverage = useQuery({
    queryKey: ["coverage"],
    queryFn: () => api("coverage"),
    refetchInterval: 10000,
  });
  const stats = useQuery({
    queryKey: ["overview", params],
    queryFn: () => api("overview?" + params),
  });
  const products = useQuery({
    queryKey: ["products", params],
    queryFn: () => api("products?" + params),
  });
  const states = useQuery({
    queryKey: ["states", params],
    queryFn: () => api("geography/states?" + params),
  });
  const buyers = useQuery({
    queryKey: ["buyers", params],
    queryFn: () => api("buyers?" + params),
  });
  const cats = useQuery({
    queryKey: ["categories", params],
    queryFn: () => api("categories?" + params),
  });
  const history = useQuery({
    queryKey: ["trends", params, compare],
    queryFn: () =>
      api(
        "trends?" +
          params +
          (compare.length ? "&products=" + compare.join(",") : ""),
      ),
  });
  const growth = useQuery({
    queryKey: ["growth", params],
    queryFn: () => api("growth?" + params),
  });
  const tenders = useQuery({
    queryKey: ["tenders", params, page],
    queryFn: () => api("tenders?" + params + "&page=" + page),
  });
  const districts = useQuery({
    queryKey: ["districts", params],
    queryFn: () => api("geography/districts?" + params),
  });
  const tender = useQuery({
    queryKey: ["tender", detail],
    queryFn: () => api("tenders/" + detail),
    enabled: !!detail,
  });
  const stateComparisons = useQuery({
    queryKey: ["state-comparisons", params, compareStates],
    queryFn: () =>
      Promise.all(
        compareStates.map((s) => {
          const p = new URLSearchParams(params);
          p.set("state", s);
          return api(
            "geography/states/" + encodeURIComponent(s) + "?" + p,
          ).then((data) => ({ state: s, ...data }));
        }),
      ),
    enabled: compareStates.length > 0,
  });
  const go = (v: string) => {
    setView(v);
    setMobile(false);
  };
  const drill = (key: string, value: string, v = "Tender Explorer") => {
    change(key, value);
    go(v);
  };
  const exportRows = (rows: any[], name: string) => {
    const data = exportCSV(rows, {
      filters: params,
      collectedAt: coverage.data?.total.checked || "unknown",
      exportedAt: new Date().toISOString(),
      source: "GeM notices / authorized imports",
      coverage: "Partial; national denominator unknown",
      definitions:
        "Tender counts are distinct bids; quantities are requested units by unit; values are explicit estimates, not awards; unknowns remain blank.",
    });
    const url = URL.createObjectURL(
      new Blob([data], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = name + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  const productTable = (
    <>
      {products.data?.length ? (
        <Table
          heads={[
            "Product / family",
            "Tenders",
            "Requested quantity",
            "Buyers",
            "Top buyer state",
            "Known line value",
            "",
          ]}
        >
          {products.data.map((p: any) => (
            <tr key={p.product_id}>
              <td>
                <button
                  className="text-link"
                  onClick={() =>
                    drill("product", p.product_id, "Product Intelligence")
                  }
                >
                  {p.product_name}
                </button>
                <small>{p.category}</small>
              </td>
              <td className="numeric">
                <button
                  className="text-link"
                  onClick={() => drill("product", p.product_id)}
                >
                  {number(p.tenders)}
                </button>
              </td>
              <td>
                {units(p.quantities)}
                {p.missing_quantity_lines > 0 && (
                  <small>
                    {p.missing_quantity_lines} lines with unknown quantities
                  </small>
                )}
              </td>
              <td>{number(p.buyers)}</td>
              <td>{p.top_buyer_state || "Unknown"}</td>
              <td>
                {money(p.known_value)}
                <small>
                  {p.valued_lines} / {p.lines} lines valued
                </small>
              </td>
              <td>
                <button
                  className="icon-button"
                  aria-label={"View " + p.product_name + " tenders"}
                  onClick={() => drill("product", p.product_id)}
                >
                  <ArrowUpRight size={16} />
                </button>
              </td>
            </tr>
          ))}
        </Table>
      ) : (
        <Empty />
      )}
    </>
  );
  const tenderTable = (
    <>
      {tenders.data?.data.length ? (
        <>
          <Table
            heads={[
              "Bid / original title",
              "Buyer / state",
              "Publication",
              "Requested items",
              "Estimate",
              "Status",
            ]}
          >
            {tenders.data.data.map((t: any) => (
              <tr key={t.id}>
                <td>
                  <button className="text-link" onClick={() => setDetail(t.id)}>
                    {t.bid_number}
                  </button>
                  <small className="wide-text">{t.title}</small>
                </td>
                <td>
                  {t.buyer_name}
                  <small>{t.buyer_state || "Unknown buyer location"}</small>
                </td>
                <td>{date(t.published_at)}</td>
                <td>
                  {t.items.map((i: any) => (
                    <small key={i.id}>
                      {i.name} · {number(i.quantity)} {i.unit}
                    </small>
                  ))}
                </td>
                <td>{money(t.tender_value)}</td>
                <td>
                  <span className={"status " + t.status}>{t.status}</span>
                </td>
              </tr>
            ))}
          </Table>
          <div className="pagination">
            <span>
              {tenders.data.total} unique tenders · page {page}
            </span>
            <Button disabled={page === 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button
              disabled={page * 25 >= tenders.data.total}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </>
      ) : (
        <Empty />
      )}
    </>
  );
  const stateTable = (
    <Table
      heads={[
        "State / union territory",
        "Tenders",
        "Requested quantity",
        "Buyers",
        "",
      ]}
    >
      {(tax.data?.states || []).map((s: string) => {
        const r = states.data?.find((r: any) => r.state === s);
        return (
          <tr key={s} className={f.state === s ? "selected-row" : ""}>
            <td>
              <button
                className="text-link"
                onClick={() => drill("state", s, "Geographic Intelligence")}
              >
                {s}
              </button>
            </td>
            <td>{r ? number(r.tenders) : "No observation"}</td>
            <td>{r ? units(r.quantities) : "—"}</td>
            <td>{r ? number(r.buyers) : "—"}</td>
            <td>
              <button
                className="icon-button"
                aria-label={"View " + s + " tenders"}
                onClick={() => drill("state", s)}
              >
                <ChevronRight size={15} />
              </button>
            </td>
          </tr>
        );
      })}
    </Table>
  );
  const buyerTable = (
    <>
      {buyers.data?.length ? (
        <Table
          heads={[
            "Organization",
            "Buyer state",
            "Tenders",
            "Products",
            "Known tender value",
          ]}
        >
          {buyers.data.map((b: any) => (
            <tr key={b.id}>
              <td>
                <button
                  className="text-link"
                  onClick={() => drill("buyer", b.id, "Buyer Intelligence")}
                >
                  {b.name}
                </button>
              </td>
              <td>{b.state || "Unknown"}</td>
              <td>
                <button
                  className="text-link"
                  onClick={() => drill("buyer", b.id)}
                >
                  {b.tenders}
                </button>
              </td>
              <td>{b.products}</td>
              <td>{money(b.known_value)}</td>
            </tr>
          ))}
        </Table>
      ) : (
        <Empty />
      )}
    </>
  );
  const last = coverage.data?.total.checked;
  const err = [stats, products, states, buyers, history, tenders].find(
    (q) => q.error,
  )?.error;
  return (
    <ThemeProvider theme={theme}>
      <div className="app">
        <aside className={mobile ? "sidebar open" : "sidebar"}>
          <a className="brand" href="/" aria-label="GeM Intelligence home">
            <span className="brand-mark">
              <Activity size={21} />
            </span>
            <span>
              GeM<span className="brand-light">Intelligence</span>
              <small>PROCUREMENT INSIGHTS</small>
            </span>
          </a>
          <div className="workspace">
            <span className="workspace-icon">M</span>
            <div>
              Medical equipment<small>All-India intelligence</small>
            </div>
            <ChevronRight size={13} />
          </div>
          <div className="nav-label">WORKSPACE</div>
          <nav>
            {nav.map(([name, Icon], i) => (
              <button
                key={name}
                className={view === name ? "nav-item active" : "nav-item"}
                onClick={() => go(name)}
              >
                <Icon size={18} />
                <span>{name}</span>
                {i === 0 && <span className="nav-dot" />}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="source-badge">
              <span className="amber-dot" />
              <strong>Partial coverage</strong>
              <small>Source access not verified</small>
            </div>
            <p>
              Independent research platform.
              <br />
              Not affiliated with GeM.
            </p>
            <div className="profile">
              <span>HK</span>
              <div>
                Research workspace<small>Medical equipment · India</small>
              </div>
            </div>
          </div>
        </aside>
        <div className="main">
          <header className="topbar">
            <button
              className="mobile-menu icon-button"
              aria-label="Toggle navigation"
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={21} />
            </button>
            <div className="breadcrumb">
              Workspace <ChevronRight size={13} />
              <strong>{view}</strong>
            </div>
            <div className="top-actions">
              <span className="live-label">
                <span className="amber-dot" />
                Import-based dataset
              </span>
              <button
                className="icon-button"
                aria-label="Refresh dashboard"
                onClick={() => client.invalidateQueries()}
              >
                <RefreshCw size={17} />
              </button>
              <span className="avatar">HK</span>
            </div>
          </header>
          <main>
            <div className="page-heading">
              <div>
                <div className="eyebrow">
                  GOVERNMENT PROCUREMENT INTELLIGENCE
                </div>
                <h1>
                  {view === "Overview" ? "Demand, in perspective." : view}
                </h1>
                <p>{descriptions[view]}</p>
              </div>
              <Button
                variant="outlined"
                startIcon={<Download size={16} />}
                onClick={() =>
                  exportRows(
                    view === "Tender Explorer"
                      ? tenders.data?.data || []
                      : view === "Buyer Intelligence"
                        ? buyers.data || []
                        : view === "Geographic Intelligence"
                          ? states.data || []
                          : view === "Demand Trends"
                            ? history.data || []
                            : products.data || [],
                    "gem-" + view.toLowerCase().replaceAll(" ", "-"),
                  )
                }
              >
                Export view
              </Button>
            </div>
            <div className="coverage-strip">
              <ShieldCheck size={17} />
              <p>
                <strong>Know your coverage.</strong> Figures describe collected
                notices, not the entire GeM market. Requested procurement is not
                completed sales.
              </p>
              <button onClick={() => go("Data Coverage")}>
                View coverage <ArrowUpRight size={14} />
              </button>
            </div>
            {err && (
              <Alert
                severity="error"
                action={
                  <Button onClick={() => client.invalidateQueries()}>
                    Retry
                  </Button>
                }
              >
                {err.message}
              </Alert>
            )}
            {!["Administration", "Data Coverage", "Categories"].includes(
              view,
            ) && (
              <div className="filters">
                <TextField
                  select
                  label="Location basis"
                  value={f.basis}
                  onChange={(e) => change("basis", e.target.value)}
                >
                  <MenuItem value="buyer">Buyer location</MenuItem>
                  <MenuItem value="delivery">Confirmed delivery</MenuItem>
                </TextField>
                <TextField
                  select
                  label="State / UT"
                  value={f.state || ""}
                  onChange={(e) => {
                    change("state", e.target.value);
                    change("district", "");
                  }}
                >
                  <MenuItem value="">All India</MenuItem>
                  {tax.data?.states.map((s: string) => (
                    <MenuItem key={s} value={s}>
                      {s}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Product"
                  value={f.product || ""}
                  onChange={(e) => change("product", e.target.value)}
                >
                  <MenuItem value="">All products</MenuItem>
                  {tax.data?.products.map((p: any) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Category"
                  value={f.category || ""}
                  onChange={(e) => change("category", e.target.value)}
                >
                  <MenuItem value="">All categories</MenuItem>
                  {tax.data?.categories
                    .filter((c: any) => c.parent_id === "medical")
                    .map((c: any) => (
                      <MenuItem key={c.id} value={c.id}>
                        {c.name}
                      </MenuItem>
                    ))}
                </TextField>
                <TextField
                  select
                  label="GeM acquisition source"
                  value={f.source || ""}
                  onChange={(e) => change("source", e.target.value)}
                >
                  <MenuItem value="">All GeM records</MenuItem>
                  {coverage.data?.sources.map((s: any) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Published from"
                  type="date"
                  slotProps={{ inputLabel: { shrink: true } }}
                  value={f.from || ""}
                  onChange={(e) => change("from", e.target.value)}
                />
                <TextField
                  label="Published to"
                  type="date"
                  slotProps={{ inputLabel: { shrink: true } }}
                  value={f.to || ""}
                  onChange={(e) => change("to", e.target.value)}
                />
                <Button
                  onClick={() => {
                    setF({ basis: "buyer" });
                    setSearch("");
                    setCompare([]);
                    setPage(1);
                  }}
                >
                  Reset
                </Button>
              </div>
            )}
            {stats.isLoading && (
              <div className="loading">
                <CircularProgress size={24} />
                <span>Querying procurement records…</span>
              </div>
            )}
            {view === "Overview" && (
              <>
                <div className="section-meta">
                  <span>
                    <i className="blue-dot" />
                    COLLECTED DATASET
                  </span>
                  <small>Last checked: {timestamp(last)}</small>
                </div>
                <div className="kpis">
                  {[
                    {
                      label: "Unique tenders",
                      value: stats.data?.tenders,
                      sub: "All collected categories",
                      click: () => go("Tender Explorer"),
                      icon: Files,
                    },
                    {
                      label: "Equipment tenders",
                      value: stats.data?.medical_tenders,
                      sub: "Distinct medical equipment bids",
                      click: () => go("Medical Equipment"),
                      icon: Stethoscope,
                    },
                    {
                      label: "Equipment products",
                      value: stats.data?.products,
                      sub: "Normalized product families",
                      click: () => go("Product Intelligence"),
                      icon: Boxes,
                    },
                    {
                      label: "Active buyers",
                      value: stats.data?.buyers,
                      sub: "Institutions in selected records",
                      click: () => go("Buyer Intelligence"),
                      icon: Building2,
                    },
                    {
                      label: "Known tender value",
                      value: money(stats.data?.known_value),
                      sub: `${stats.data?.valued_tenders || 0} of ${stats.data?.tenders || 0} tenders valued`,
                      click: () => go("Tender Explorer"),
                      icon: ChartNoAxesCombined,
                    },
                  ].map((k) => (
                    <button className="kpi" key={k.label} onClick={k.click}>
                      <div>
                        <span>{k.label}</span>
                        <k.icon size={17} />
                      </div>
                      <strong>
                        {typeof k.value === "number"
                          ? number(k.value)
                          : (k.value ?? "—")}
                      </strong>
                      <small>{k.sub}</small>
                    </button>
                  ))}
                </div>
                <div className="grid-two">
                  <Panel
                    title="Most requested equipment"
                    sub="Ranked by unique tender count"
                    action={
                      <button
                        className="panel-link"
                        onClick={() => go("Product Intelligence")}
                      >
                        Explore products <ArrowUpRight size={14} />
                      </button>
                    }
                  >
                    <Bars
                      rows={(products.data || []).map((p: any) => ({
                        label: p.product_name,
                        value: p.tenders,
                        id: p.product_id,
                      }))}
                      onClick={(r) =>
                        drill("product", r.id, "Product Intelligence")
                      }
                    />
                  </Panel>
                  <Panel
                    title="Where demand originates"
                    sub={
                      f.basis === "buyer"
                        ? "Buyer location · distinct equipment tenders"
                        : "Confirmed delivery locations · distinct equipment tenders"
                    }
                    action={
                      <button
                        className="panel-link"
                        onClick={() => go("Geographic Intelligence")}
                      >
                        View geography <ArrowUpRight size={14} />
                      </button>
                    }
                  >
                    <Bars
                      rows={(states.data || []).map((s: any) => ({
                        label: s.state || "Unknown location",
                        value: s.tenders,
                      }))}
                      onClick={(r) =>
                        r.label !== "Unknown location" &&
                        drill("state", r.label, "Geographic Intelligence")
                      }
                    />
                  </Panel>
                </div>
                <Panel
                  title="Demand over time"
                  sub="Observed equipment notices by publication month"
                  action={<span className="pill">Publication date</span>}
                >
                  <HistoryChart
                    rows={history.data || []}
                    onSelect={(r) => {
                      const p = tax.data?.products.find(
                        (p: any) => p.name === r.product,
                      );
                      if (p) drill("product", p.id);
                    }}
                  />
                </Panel>
                <Panel
                  title="Product demand rankings"
                  sub="Tender frequency and equipment quantity are different measures"
                  action={
                    <Button
                      size="small"
                      onClick={() => go("Product Intelligence")}
                    >
                      All products <ChevronRight size={14} />
                    </Button>
                  }
                >
                  {productTable}
                </Panel>
                <div className="grid-two">
                  <Panel
                    title="Category demand"
                    sub="A multi-product tender can appear in more than one category"
                  >
                    <Bars
                      rows={(cats.data || [])
                        .filter((c: any) => c.tenders > 0)
                        .map((c: any) => ({
                          label: c.name,
                          value: c.tenders,
                          id: c.id,
                        }))}
                      onClick={(r) =>
                        drill("category", r.id, "Medical Equipment")
                      }
                    />
                  </Panel>
                  <Panel
                    title="Emerging demand"
                    sub="Equal-period comparison with a sample-size guardrail"
                  >
                    <div className="insight-note">
                      <ChartNoAxesCombined size={23} />
                      <h3>
                        {growth.data?.products.some(
                          (p: any) => p.growth.percent != null,
                        )
                          ? "Observed changes are available"
                          : "More history, stronger signals."}
                      </h3>
                      <p>
                        {growth.data?.products.some(
                          (p: any) => p.growth.percent != null,
                        )
                          ? "Review period comparisons in Demand Trends. Source coverage has not been verified as comparable."
                          : "At least five tenders in each comparison period are required. Collection gaps and changing coverage can affect apparent growth."}
                      </p>
                      <Button onClick={() => go("Demand Trends")}>
                        Explore demand history <ArrowUpRight size={15} />
                      </Button>
                    </div>
                  </Panel>
                </div>
                <Panel
                  title="Most active institutions"
                  sub="Equipment procurement notices within this dataset"
                >
                  {buyerTable}
                </Panel>
              </>
            )}
            {(view === "Medical Equipment" || view === "Categories") && (
              <>
                <div className="category-grid">
                  {cats.data?.map((c: any) => (
                    <button
                      className="category-card"
                      key={c.id}
                      onClick={() =>
                        drill("category", c.id, "Product Intelligence")
                      }
                    >
                      <Stethoscope size={23} />
                      <ArrowUpRight className="corner" size={17} />
                      <h3>{c.name}</h3>
                      <strong>
                        {number(c.tenders)} <small>unique tenders</small>
                      </strong>
                      <div>
                        {c.products} products · {c.buyers} buyers
                      </div>
                    </button>
                  ))}
                </div>
                {view === "Categories" && (
                  <Panel
                    title="Expand beyond medical equipment"
                    sub="Collect broadly. Classify deeply."
                  >
                    <div className="padded">
                      <p>
                        All imports retain original tenders across categories.
                        Medical equipment has a detailed product dictionary;
                        other procurement sectors remain inactive until their
                        classification and metric definitions are implemented.
                      </p>
                      <div className="tag-list">
                        {tax.data?.categories
                          .filter((c: any) => c.parent_id === "procurement")
                          .map((c: any) => (
                            <Chip
                              key={c.id}
                              label={
                                c.name + (c.active ? " · Active" : " · Planned")
                              }
                              variant={c.active ? "filled" : "outlined"}
                            />
                          ))}
                      </div>
                    </div>
                  </Panel>
                )}
                {view === "Medical Equipment" && (
                  <Panel
                    title="Equipment demand"
                    sub="Quantities stay separated by their reported unit"
                  >
                    {productTable}
                  </Panel>
                )}
              </>
            )}
            {view === "Product Intelligence" && (
              <>
                <div className="view-tools">
                  <TextField
                    label="Search products and tender text"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <Search size={17} style={{ marginRight: 8 }} />
                        ),
                      },
                    }}
                  />
                  <TextField
                    select
                    label="Rank by"
                    value={f.sort || "tenders"}
                    onChange={(e) => change("sort", e.target.value)}
                  >
                    {[
                      ["tenders", "Tender frequency"],
                      ["units", "Requested units (units only)"],
                      ["buyers", "Unique buyers"],
                      ["value", "Known line value"],
                      ["product", "Product name"],
                    ].map(([v, l]) => (
                      <MenuItem key={v} value={v}>
                        {l}
                      </MenuItem>
                    ))}
                  </TextField>
                </div>
                <Panel
                  title={
                    f.product
                      ? tax.data?.products.find((p: any) => p.id === f.product)
                          ?.name || "Product demand"
                      : "Product demand rankings"
                  }
                  sub="Unknown quantities and values remain unknown. Known line value uses explicit line estimates only."
                >
                  {productTable}
                </Panel>
                {f.product && (
                  <>
                    <div className="grid-two">
                      <Panel
                        title="Geographic distribution"
                        sub="Distinct tenders by selected location basis"
                      >
                        <Bars
                          rows={(states.data || []).map((s: any) => ({
                            label: s.state || "Unknown",
                            value: s.tenders,
                          }))}
                          onClick={(r) =>
                            drill("state", r.label, "Geographic Intelligence")
                          }
                        />
                      </Panel>
                      <Panel title="Publication history">
                        <HistoryChart rows={history.data || []} />
                      </Panel>
                    </div>
                    <Panel title="Institutions requesting this equipment">
                      {buyerTable}
                    </Panel>
                    <Panel title="Supporting source tenders">
                      {tenderTable}
                    </Panel>
                  </>
                )}
              </>
            )}
            {view === "Geographic Intelligence" && (
              <>
                <div className="view-tools">
                  <TextField
                    select
                    label="Map metric"
                    value={metric}
                    onChange={(e) => setMetric(e.target.value)}
                  >
                    <MenuItem value="tenders">Unique tenders</MenuItem>
                    <MenuItem value="units" disabled={!f.product}>
                      Requested units · select a product
                    </MenuItem>
                  </TextField>
                  {f.basis === "delivery" && (
                    <p className="fine">
                      Only confirmed destinations. Unknown allocations are not
                      distributed between states.
                    </p>
                  )}
                </div>
                <div className="geography-grid">
                  <Panel
                    title={
                      f.product
                        ? `${tax.data?.products.find((p: any) => p.id === f.product)?.name || "Product"} demand`
                        : "Equipment demand across India"
                    }
                    sub={`${metric === "tenders" ? "Unique equipment tenders" : "Requested equipment units"} · ${f.basis === "buyer" ? "buyer" : "confirmed delivery"} location`}
                  >
                    <IndiaMap
                      rows={states.data || []}
                      selected={f.state || ""}
                      onSelect={(s) => change("state", s)}
                      metric={metric}
                    />
                  </Panel>
                  <Panel
                    title={f.state || "State intelligence"}
                    sub="Choose a state on the map or in the filters"
                  >
                    <div className="padded">
                      <span className="eyebrow">SELECTED REGION</span>
                      <h2 className="state-title">{f.state || "All India"}</h2>
                      <p>
                        Explore institutions, districts and the individual
                        notices behind regional demand.
                      </p>
                      <div className="stat-pair">
                        <div>
                          <strong>
                            {number(
                              (states.data || []).reduce(
                                (n: number, r: any) => n + r.tenders,
                                0,
                              ),
                            )}
                          </strong>
                          <small>State tender appearances*</small>
                        </div>
                        <div>
                          <strong>{number(buyers.data?.length || 0)}</strong>
                          <small>Unique buyers</small>
                        </div>
                      </div>
                      <p className="fine">
                        * A multi-destination tender may appear in multiple
                        states.
                      </p>
                      {f.state && (
                        <Button
                          variant="contained"
                          onClick={() => go("Tender Explorer")}
                        >
                          Inspect supporting tenders <ArrowUpRight size={16} />
                        </Button>
                      )}
                    </div>
                    <div className="padded">
                      <TextField
                        select
                        fullWidth
                        label="District"
                        value={f.district || ""}
                        onChange={(e) => change("district", e.target.value)}
                      >
                        <MenuItem value="">All districts</MenuItem>
                        {[
                          ...new Set(
                            (districts.data || [])
                              .map((r: any) => r.district)
                              .filter(Boolean),
                          ),
                        ].map((d: any) => (
                          <MenuItem key={d} value={d}>
                            {d}
                          </MenuItem>
                        ))}
                      </TextField>
                    </div>
                  </Panel>
                </div>
                <Panel
                  title="Compare regions"
                  sub="Select up to four states. Each comparison uses the same product and date filters."
                >
                  <div className="padded compare-options">
                    {[
                      "Punjab",
                      "Haryana",
                      "Maharashtra",
                      "Karnataka",
                      ...(f.state &&
                      ![
                        "Punjab",
                        "Haryana",
                        "Maharashtra",
                        "Karnataka",
                      ].includes(f.state)
                        ? [f.state]
                        : []),
                    ].map((s) => (
                      <FormControlLabel
                        key={s}
                        control={
                          <Checkbox
                            checked={compareStates.includes(s)}
                            disabled={
                              !compareStates.includes(s) &&
                              compareStates.length >= 4
                            }
                            onChange={() =>
                              setCompareStates((old) =>
                                old.includes(s)
                                  ? old.filter((x) => x !== s)
                                  : [...old, s],
                              )
                            }
                          />
                        }
                        label={s}
                      />
                    ))}
                  </div>
                  {stateComparisons.data && (
                    <Table
                      heads={[
                        "State",
                        "Tenders",
                        "Requested quantities",
                        "Buyers",
                      ]}
                    >
                      {stateComparisons.data.map((d: any) => (
                        <tr key={d.state}>
                          <td>{d.state}</td>
                          <td>
                            {d.states[0]
                              ? number(d.states[0].tenders)
                              : "No observation"}
                          </td>
                          <td>{units(d.states[0]?.quantities)}</td>
                          <td>{d.buyers.length}</td>
                        </tr>
                      ))}
                    </Table>
                  )}
                </Panel>
                <Panel
                  title="All states and union territories"
                  sub="Accessible map alternative. No observation is distinct from zero market demand."
                >
                  {stateTable}
                </Panel>
                {f.state && (
                  <>
                    <Panel title="Organizations behind this demand">
                      {buyerTable}
                    </Panel>
                    <Panel title="Source tenders">{tenderTable}</Panel>
                  </>
                )}
              </>
            )}
            {view === "Buyer Intelligence" && (
              <>
                <Panel
                  title="Government buying organizations"
                  sub="Institution identities are matched by explicit source keys, not fuzzy names."
                >
                  {buyerTable}
                </Panel>
                {f.buyer && (
                  <>
                    <Panel title="Product specialization">{productTable}</Panel>
                    <Panel title="Repeat procurement activity">
                      <HistoryChart rows={history.data || []} />
                    </Panel>
                    <Panel title="Buyer tender history">{tenderTable}</Panel>
                  </>
                )}
              </>
            )}
            {view === "Demand Trends" && (
              <>
                <Panel
                  title="Compare product demand"
                  sub="Choose up to five products; quantities remain separated from tender frequency."
                >
                  <div className="padded compare-options">
                    {tax.data?.products.map((p: any) => (
                      <Chip
                        key={p.id}
                        label={p.name}
                        color={compare.includes(p.id) ? "primary" : "default"}
                        variant={compare.includes(p.id) ? "filled" : "outlined"}
                        onClick={() =>
                          setCompare((old) =>
                            old.includes(p.id)
                              ? old.filter((x) => x !== p.id)
                              : old.length < 5
                                ? [...old, p.id]
                                : old,
                          )
                        }
                      />
                    ))}
                  </div>
                  <div className="padded view-tools">
                    <TextField
                      select
                      label="Publication interval"
                      value={f.bucket || "month"}
                      onChange={(e) => change("bucket", e.target.value)}
                    >
                      {[
                        "day",
                        "week",
                        "month",
                        "quarter",
                        "financial_year",
                      ].map((b) => (
                        <MenuItem key={b} value={b}>
                          {b.replace("_", " ")}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      select
                      label="Measure"
                      value={trendMetric}
                      onChange={(e) => setTrendMetric(e.target.value)}
                    >
                      <MenuItem value="tenders">Unique tenders</MenuItem>
                      <MenuItem value="units">Requested quantity</MenuItem>
                    </TextField>
                    {trendMetric === "units" && (
                      <TextField
                        label="Quantity unit"
                        value={trendUnit}
                        onChange={(e) => setTrendUnit(e.target.value)}
                      />
                    )}
                  </div>
                  <HistoryChart
                    rows={history.data || []}
                    metric={trendMetric}
                    unit={trendUnit}
                  />
                </Panel>
                <Panel
                  title="Comparable-period observations"
                  sub={`Current ${growth.data?.periods.current.join(" to ") || "—"} · Previous ${growth.data?.periods.previous.join(" to ") || "—"}`}
                >
                  <Alert severity="info">
                    Collection coverage is not verified as comparable. These
                    changes describe the observed dataset and cannot establish
                    national market growth.
                  </Alert>
                  <Table
                    heads={[
                      "Equipment",
                      "Current tenders",
                      "Previous tenders",
                      "Observed change",
                    ]}
                  >
                    {growth.data?.products.map((p: any) => (
                      <tr key={p.product_id}>
                        <td>
                          <button
                            className="text-link"
                            onClick={() => drill("product", p.product_id)}
                          >
                            {p.product_name}
                          </button>
                        </td>
                        <td>{p.tenders}</td>
                        <td>{p.previous_tenders}</td>
                        <td>
                          {p.growth.percent == null
                            ? p.growth.label
                            : p.growth.percent + "%"}
                        </td>
                      </tr>
                    ))}
                  </Table>
                </Panel>
              </>
            )}
            {view === "Tender Explorer" && (
              <>
                <div className="view-tools">
                  <TextField
                    label="Bid, equipment or institution"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                  />
                  <TextField
                    select
                    label="Tender status"
                    value={f.status || ""}
                    onChange={(e) => change("status", e.target.value)}
                  >
                    <MenuItem value="">All non-cancelled notices</MenuItem>
                    {["open", "closed", "cancelled", "awarded", "unknown"].map(
                      (s) => (
                        <MenuItem key={s} value={s}>
                          {s}
                        </MenuItem>
                      ),
                    )}
                  </TextField>
                  <TextField
                    select
                    label="Buyer organization"
                    value={f.buyer || ""}
                    onChange={(e) => change("buyer", e.target.value)}
                  >
                    <MenuItem value="">All buyers</MenuItem>
                    {buyers.data?.map((b: any) => (
                      <MenuItem key={b.id} value={b.id}>
                        {b.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </div>
                <Panel
                  title="Tender explorer"
                  sub="One row per unique bid. Closing date is never used as publication date."
                  action={
                    <Chip
                      size="small"
                      label={(tenders.data?.total || 0) + " records"}
                    />
                  }
                >
                  {tenderTable}
                </Panel>
                <p className="fine">
                  Export view downloads the current filtered page; change pages
                  to export another 25 records. Product and region exports
                  include all returned aggregate rows.
                </p>
              </>
            )}
            {view === "Data Coverage" && <Coverage data={coverage.data} />}
            {view === "Administration" && (
              <Admin
                taxonomy={tax.data}
                onChange={() => client.invalidateQueries()}
                coverage={coverage.data}
              />
            )}
            <footer>
              <span>
                GeM Intelligence <i> / </i> Source-backed procurement research
              </span>
              <span>Last checked {timestamp(last)}</span>
            </footer>
          </main>
        </div>
      </div>
      <Dialog
        open={!!detail}
        onClose={() => setDetail(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          <div className="dialog-heading">
            Tender source record
            <Button onClick={() => setDetail(null)}>Close</Button>
          </div>
        </DialogTitle>
        <DialogContent>
          {tender.isLoading ? (
            <CircularProgress />
          ) : tender.error ? (
            <Alert severity="error">{tender.error.message}</Alert>
          ) : (
            tender.data && (
              <div className="tender-detail">
                <span className="eyebrow">{tender.data.bid_number}</span>
                <h2>{tender.data.title}</h2>
                <p>
                  {tender.data.buyer_name} ·{" "}
                  {tender.data.buyer_state || "Unknown buyer state"}
                </p>
                <div className="detail-meta">
                  <span>
                    Published <b>{date(tender.data.published_at)}</b>
                  </span>
                  <span>
                    Closes <b>{timestamp(tender.data.closes_at)}</b>
                  </span>
                  <span>
                    Estimate <b>{money(tender.data.estimated_value)}</b>
                  </span>
                  <span>
                    Source status <b>{tender.data.status}</b>
                  </span>
                </div>
                <Button
                  component="a"
                  href={tender.data.source_url}
                  target="_blank"
                  rel="noreferrer"
                  startIcon={<ExternalLink size={16} />}
                >
                  Open original source
                </Button>
                {tender.data.items.map((i: any) => (
                  <div className="item-detail" key={i.id}>
                    <h3>{i.original_name}</h3>
                    <p>
                      {number(i.quantity)} {i.unit} ·{" "}
                      {i.product_name || "Unclassified / excluded"} · Confidence{" "}
                      {number(Number(i.confidence) * 100)}%
                    </p>
                    <blockquote>{i.evidence}</blockquote>
                    <p className="fine">{i.classification_reason}</p>
                    {i.destinations.map((d: any) => (
                      <p className="fine" key={d.id}>
                        {d.state} / {d.district || "Unknown district"} ·{" "}
                        {d.confirmed
                          ? "Confirmed destination"
                          : "Inferred location (excluded from delivery demand)"}{" "}
                        · {number(d.quantity)} allocated units
                        <br />
                        {d.evidence}
                      </p>
                    ))}
                  </div>
                ))}
                <h3>Source documents</h3>
                {tender.data.documents.map((d: any) => (
                  <p key={d.id}>
                    <a href={d.url} target="_blank" rel="noreferrer">
                      {d.label} ↗
                    </a>
                  </p>
                ))}
                <h3>Audit history</h3>
                <p>
                  {tender.data.versions.length} source versions · First
                  discovered {timestamp(tender.data.first_seen)} · Last checked{" "}
                  {timestamp(tender.data.last_checked)}
                </p>
                {tender.data.corrections.map((c: any, i: number) => (
                  <p key={i}>
                    {date(c.created_at)}: {c.reason}
                  </p>
                ))}
                <Alert severity="info">
                  A closed notice does not establish that a purchase or award
                  occurred. This record preserves the source observation.
                </Alert>
              </div>
            )
          )}
        </DialogContent>
      </Dialog>
    </ThemeProvider>
  );
}
function Coverage({ data }: { data: any }) {
  if (!data) return <CircularProgress size={22} />;
  return (
    <>
      {data.dataQuality && (
        <Panel
          title="Document processing and data quality"
          sub="Our stored GeM dataset; national publication totals are unknown."
        >
          <Alert severity="warning">
            {data.dataQuality.warning}{" "}
            {data.total.tenders < 25
              ? "Very small sample: demand rankings and trends are descriptive only."
              : "Coverage completeness remains unverified."}
          </Alert>
          <div className="stat-pair">
            {Object.entries(data.dataQuality.documents).map(
              ([key, value]: any) => (
                <div key={key}>
                  <strong>{value}</strong>
                  <small>Documents: {key.replaceAll("_", " ")}</small>
                </div>
              ),
            )}
          </div>
          <Table
            heads={["Completeness measure", "Known / denominator", "Percent"]}
          >
            {Object.entries(data.dataQuality.percentages).map(
              ([key, v]: any) => (
                <tr key={key}>
                  <td>{key.replace(/([A-Z])/g, " $1")}</td>
                  <td>
                    {v.known} / {v.total}
                  </td>
                  <td>
                    {v.percent === null
                      ? "Not yet measured"
                      : v.percent.toFixed(1) + "%"}
                  </td>
                </tr>
              ),
            )}
          </Table>
          <EvaluationMetrics report={data.dataQuality.evaluation} />
          {Object.entries(data.dataQuality.breakdowns).map(
            ([key, rows]: any) => (
              <details key={key}>
                <summary>Collected coverage by {key}</summary>
                <Table heads={[key, "Stored tenders"]}>
                  {rows.map((r: any, i: number) => (
                    <tr key={i}>
                      <td>
                        {r.name ||
                          r.state ||
                          r.month ||
                          "Unknown / unclassified"}
                      </td>
                      <td>{r.tenders}</td>
                    </tr>
                  ))}
                </Table>
              </details>
            ),
          )}
        </Panel>
      )}
      <div className="kpis">
        <div className="kpi">
          <span>Dataset coverage</span>
          <strong>Partial</strong>
          <small>National completeness unknown</small>
        </div>
        <div className="kpi">
          <span>Stored tenders</span>
          <strong>{number(data.total.tenders)}</strong>
          <small>Historical records retained</small>
        </div>
        <div className="kpi">
          <span>Manual review</span>
          <strong>{number(data.quality.needs_review)}</strong>
          <small>Unresolved classifications</small>
        </div>
        <div className="kpi">
          <span>Missing delivery</span>
          <strong>{number(data.quality.missing_delivery)}</strong>
          <small>Equipment lines without confirmed destinations</small>
        </div>
      </div>
      <Panel
        title="Source access and coverage"
        sub="No all-India completeness claim is made."
      >
        <Table
          heads={["Source", "Access mode", "Coverage", "Last success", "Notes"]}
        >
          {data.sources.map((s: any) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td>
                <span
                  className={
                    "status " + (s.mode === "blocked" ? "unknown" : "open")
                  }
                >
                  {s.mode}
                </span>
              </td>
              <td>{s.coverage}</td>
              <td>{timestamp(s.last_success)}</td>
              <td>{s.access_notes}</td>
            </tr>
          ))}
        </Table>
      </Panel>
      <Panel
        title="Collection history"
        sub="Discovered, changed, unchanged and rejected counts are tracked separately."
      >
        {data.runs.length ? (
          <Table
            heads={[
              "Run started",
              "Status",
              "Discovered",
              "Inserted / updated",
              "Unchanged",
              "Rejected / error",
            ]}
          >
            {data.runs.map((r: any) => (
              <tr key={r.id}>
                <td>
                  {timestamp(r.started_at)}
                  <small>{r.provenance}</small>
                </td>
                <td>{r.status}</td>
                <td>{r.discovered}</td>
                <td>
                  {r.inserted} / {r.updated}
                </td>
                <td>{r.unchanged}</td>
                <td>
                  {r.rejected}
                  <small>{r.error}</small>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty text="No imports or collections have run yet." />
        )}
      </Panel>
      <Panel title="How to interpret these figures">
        <div className="definition-grid">
          <div>
            <h3>Tenders ≠ equipment units</h3>
            <p>
              One multi-item bid counts once in the total and may contribute to
              several product families. Unit quantities are grouped by their
              reported unit.
            </p>
          </div>
          <div>
            <h3>Buyer ≠ delivery location</h3>
            <p>
              Delivery views include confirmed destinations only. Missing
              allocations stay unallocated; buyer location is never silently
              substituted.
            </p>
          </div>
          <div>
            <h3>Notice ≠ completed sale</h3>
            <p>
              Estimated values come directly from source data. Unknown values
              remain unknown. Closure does not prove a purchase.
            </p>
          </div>
          <div>
            <h3>Observations ≠ national growth</h3>
            <p>
              Changing collection coverage can cause apparent trends. Unknown
              publication dates are excluded from time series.
            </p>
          </div>
        </div>
      </Panel>
    </>
  );
}
function Admin({
  taxonomy,
  onChange,
  coverage,
}: {
  taxonomy: any;
  onChange: () => void;
  coverage: any;
}) {
  const auth = useQuery({ queryKey: ["auth"], queryFn: () => api("auth") });
  const [key, setKey] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [raw, setRaw] = useState(""),
    [provenance, setProvenance] = useState(""),
    [authorized, setAuthorized] = useState(false),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState(""),
    [ruleProduct, setRuleProduct] = useState(""),
    [ruleAliases, setRuleAliases] = useState(""),
    [categoryName, setCategoryName] = useState(""),
    [categoryParent, setCategoryParent] = useState("medical"),
    [newProductName, setNewProductName] = useState(""),
    [newProductCategory, setNewProductCategory] = useState("critical-care");
  const review = useQuery({
    queryKey: ["review", auth.data?.authenticated],
    queryFn: () => api("admin/review"),
    enabled: !!auth.data?.authenticated,
  });
  async function action(fn: () => Promise<any>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await fn();
      setMessage(
        r.jobId
          ? "Queued. Keep the background worker running; inspect job status below."
          : "Saved successfully.",
      );
      onChange();
      await auth.refetch();
      await review.refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {error && <Alert severity="error">{error}</Alert>}
      {message && <Alert severity="success">{message}</Alert>}
      {!auth.data?.authenticated ? (
        <Panel
          title="Administrator sign-in"
          sub="Imports and corrections require an administrator session."
        >
          <form
            className="admin-login"
            onSubmit={(e) => {
              e.preventDefault();
              action(() =>
                api("auth/login", {
                  method: "POST",
                  body: JSON.stringify({ key }),
                }),
              ).then(() => setKey(""));
            }}
          >
            <TextField
              label="Administrator key"
              type="password"
              autoComplete="current-password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              required
              fullWidth
            />
            <Button type="submit" variant="contained" disabled={busy}>
              Sign in
            </Button>
            {auth.data && !auth.data.configured && (
              <Alert severity="info">
                Set ADMIN_KEY to at least 24 characters in the server
                environment before signing in.
              </Alert>
            )}
          </form>
        </Panel>
      ) : (
        <>
          <DocumentAdmin taxonomy={taxonomy} onChange={onChange} />
          <div className="view-tools">
            <Chip
              icon={<Check size={15} />}
              label="Administrator session"
              color="success"
            />
            <Button
              onClick={() =>
                action(() => api("auth/logout", { method: "POST" }))
              }
            >
              Sign out
            </Button>
            <Button
              onClick={() =>
                action(() => api("admin/ingestion/run", { method: "POST" }))
              }
              disabled={busy}
            >
              Run authorized synchronization
            </Button>
          </div>
          <Panel
            title="Import an authorized dataset"
            sub="CSV or JSON · up to 1,000 complete bids / 5 MB per job. Every line needs a stable key and source evidence."
          >
            <div className="padded admin-form">
              <input
                type="file"
                accept=".json,.csv"
                aria-label="Choose tender JSON or CSV file"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 5e6) {
                    setError("File exceeds 5 MB");
                    return;
                  }
                  try {
                    const s = await file.text();
                    if (file.name.endsWith(".csv"))
                      setRaw(
                        JSON.stringify({ records: csvToTenders(s) }, null, 2),
                      );
                    else {
                      const j = JSON.parse(s);
                      setRaw(
                        JSON.stringify(
                          Array.isArray(j) ? { records: j } : j,
                          null,
                          2,
                        ),
                      );
                      if (j.provenance) setProvenance(j.provenance);
                    }
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              />
              <TextField
                label="Source / authorization notes"
                value={provenance}
                onChange={(e) => setProvenance(e.target.value)}
                fullWidth
              />
              <TextField
                label="Complete JSON dataset"
                multiline
                minRows={8}
                maxRows={18}
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                fullWidth
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={authorized}
                    onChange={(e) => setAuthorized(e.target.checked)}
                  />
                }
                label="I am authorized to import this dataset and have preserved original source references."
              />
              <Button
                variant="contained"
                disabled={busy || !authorized || !raw || provenance.length < 10}
                onClick={() =>
                  action(() => {
                    const j = JSON.parse(raw);
                    return api("admin/import", {
                      method: "POST",
                      body: JSON.stringify({
                        records: j.records || j,
                        provenance,
                        authorized: true,
                      }),
                    });
                  })
                }
              >
                Validate and queue import
              </Button>
            </div>
          </Panel>
          <Panel
            title="Classification review"
            sub="Manual corrections remain attached to the stable bid and line keys across future synchronization."
          >
            {review.data?.length ? (
              <div className="padded">
                <TextField
                  label="Correction reason"
                  fullWidth
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                {review.data.map((r: any) => (
                  <div className="review-row" key={r.id}>
                    <div>
                      <strong>{r.original_name}</strong>
                      <small>
                        {r.bid_number} · {r.classification_reason}
                      </small>
                    </div>
                    <TextField
                      select
                      label="Correct product"
                      defaultValue=""
                      disabled={busy || reason.length < 5}
                      onChange={(e) =>
                        action(() =>
                          api("admin/classifications/" + r.id + "/correct", {
                            method: "POST",
                            body: JSON.stringify({
                              productId:
                                e.target.value === "exclude"
                                  ? null
                                  : e.target.value,
                              reason,
                            }),
                          }),
                        )
                      }
                    >
                      <MenuItem value="" disabled>
                        Select
                      </MenuItem>
                      <MenuItem value="exclude">
                        Exclude from equipment
                      </MenuItem>
                      {taxonomy?.products.map((p: any) => (
                        <MenuItem key={p.id} value={p.id}>
                          {p.name}
                        </MenuItem>
                      ))}
                    </TextField>
                  </div>
                ))}
              </div>
            ) : (
              <Empty text="No unresolved classifications in the first 100 review records." />
            )}
          </Panel>
          <Panel
            title="Taxonomy and classification rules"
            sub="Aliases are literal phrase matches. Reclassify to apply rules to existing records."
          >
            <div className="padded admin-form">
              <div className="view-tools">
                <TextField
                  select
                  label="Product"
                  value={ruleProduct}
                  onChange={(e) => {
                    setRuleProduct(e.target.value);
                    setRuleAliases(
                      taxonomy.products
                        .find((p: any) => p.id === e.target.value)
                        .aliases.join("\n"),
                    );
                  }}
                >
                  {taxonomy?.products.map((p: any) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="One alias per line"
                  multiline
                  minRows={3}
                  value={ruleAliases}
                  onChange={(e) => setRuleAliases(e.target.value)}
                />
                <Button
                  disabled={!ruleProduct || busy}
                  onClick={() =>
                    action(() =>
                      api("admin/products/" + ruleProduct, {
                        method: "PATCH",
                        body: JSON.stringify({
                          aliases: ruleAliases
                            .split("\n")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        }),
                      }),
                    )
                  }
                >
                  Save aliases
                </Button>
                <Button
                  disabled={busy}
                  onClick={() =>
                    action(() => api("admin/reclassify", { method: "POST" }))
                  }
                >
                  Reclassify existing lines
                </Button>
              </div>
              <div className="view-tools">
                <TextField
                  label="New category name"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                />
                <TextField
                  select
                  label="Parent category"
                  value={categoryParent}
                  onChange={(e) => setCategoryParent(e.target.value)}
                >
                  {taxonomy?.categories.map((c: any) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name}
                    </MenuItem>
                  ))}
                </TextField>
                <Button
                  disabled={!categoryName || busy}
                  onClick={() =>
                    action(() =>
                      api("admin/categories", {
                        method: "POST",
                        body: JSON.stringify({
                          id: categoryName
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, "-"),
                          name: categoryName,
                          parentId: categoryParent,
                          active: true,
                        }),
                      }),
                    )
                  }
                >
                  Add category
                </Button>
              </div>
              <div className="view-tools">
                <TextField
                  label="New product family"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                />
                <TextField
                  select
                  label="Product category"
                  value={newProductCategory}
                  onChange={(e) => setNewProductCategory(e.target.value)}
                >
                  {taxonomy?.categories
                    .filter((c: any) => c.parent_id === "medical")
                    .map((c: any) => (
                      <MenuItem key={c.id} value={c.id}>
                        {c.name}
                      </MenuItem>
                    ))}
                </TextField>
                <Button
                  disabled={!newProductName || busy}
                  onClick={() =>
                    action(() =>
                      api("admin/products", {
                        method: "POST",
                        body: JSON.stringify({
                          id: newProductName
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, "-"),
                          name: newProductName,
                          categoryId: newProductCategory,
                          aliases: [newProductName.toLowerCase()],
                        }),
                      }),
                    )
                  }
                >
                  Add product
                </Button>
              </div>
            </div>
          </Panel>
          <Panel
            title="Background jobs"
            sub="CSV/feed jobs retry up to three times. Retry PDFs through document review or reupload."
          >
            {coverage?.jobs?.length ? (
              <Table
                heads={[
                  "Created",
                  "Kind",
                  "Status",
                  "Attempts",
                  "Last error",
                  "",
                ]}
              >
                {coverage.jobs.map((j: any) => (
                  <tr key={j.id}>
                    <td>{timestamp(j.created_at)}</td>
                    <td>{j.kind}</td>
                    <td>{j.status}</td>
                    <td>{j.attempts}</td>
                    <td>{j.last_error || "—"}</td>
                    <td>
                      {j.status === "failed" && j.kind !== "pdf" && (
                        <Button
                          disabled={busy}
                          onClick={() =>
                            action(() =>
                              api("admin/jobs/" + j.id + "/retry", {
                                method: "POST",
                              }),
                            )
                          }
                        >
                          Retry
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </Table>
            ) : (
              <Empty text="No queued jobs." />
            )}
          </Panel>
        </>
      )}
    </>
  );
}
export default function Page() {
  return (
    <QueryClientProvider client={qc}>
      <Dashboard />
    </QueryClientProvider>
  );
}
