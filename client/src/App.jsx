import React, { useMemo, useState, useEffect } from "react";
import SourcesModal from "./SourcesModal";

/** ----------------------
 * Small utilities
 * --------------------- */
const fmtPct = (v) => (v === null || v === undefined ? "—" : `${Math.round(v * 100)}%`);
const fmtNum = (v) => (v === null || v === undefined ? "—" : (Math.round(v * 100) / 100).toFixed(2));
const clamp01 = (x) => (Number.isFinite(x) ? (x < 0 ? 0 : x > 1 ? 1 : x) : 0);
const LS_KEY_LAST_RUN = "ta:lastRun:v2";

/** ----------------------------------------------------------------
 * Top Movers Table
 * ---------------------------------------------------------------- */
function TopMoversTable({ rows, loading, onOpenSources }) {
  const [sort, setSort] = useState({ key: "heat", dir: "desc" });

  const sorted = useMemo(() => {
    if (!rows?.length) return [];
    const { key, dir } = sort;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[key] ?? 0;
      const bv = b[key] ?? 0;
      if (av === bv) return 0;
      return dir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    return copy;
  }, [rows, sort]);

  const changeSort = (key) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
  };

  return (
    <div className="card">
      <div className="card__title">Top Movers (themes)</div>
      <div className="card__body">
        {loading && (
          <div className="tbl tbl--loading">
            <div className="skeleton skeleton--row" />
            <div className="skeleton skeleton--row" />
            <div className="skeleton skeleton--row" />
          </div>
        )}

        {!loading && (!rows || rows.length === 0) && (
          <div className="tbl tbl--empty">
            <div className="empty">No results yet. Try “brand + product + niche”, then Run research.</div>
          </div>
        )}

        {!loading && rows && rows.length > 0 && (
          <div className="tbl tbl--dense">
            <div className="tbl__row tbl__head">
              <button className="tbl__cell tbl__headcell" onClick={() => changeSort("theme")}>Theme</button>
              <button className="tbl__cell tbl__headcell tbl__cell--num" onClick={() => changeSort("heat")}>Heat</button>
              <button className="tbl__cell tbl__headcell tbl__cell--num" onClick={() => changeSort("momentum")}>Momentum</button>
              <button className="tbl__cell tbl__headcell tbl__cell--num" onClick={() => changeSort("forecast")}>Forecast (2w)</button>
              <button className="tbl__cell tbl__headcell tbl__cell--num" onClick={() => changeSort("confidence")}>Confidence</button>
              <div className="tbl__cell tbl__headcell">A/W/A</div>
              <div className="tbl__cell tbl__headcell tbl__cell--action">Sources</div>
            </div>

            {sorted.map((r) => (
              <div key={r.theme} className="tbl__row">
                <div className="tbl__cell">{r.theme}</div>
                <div className="tbl__cell tbl__cell--num">{fmtNum(r.heat)}</div>
                <div className="tbl__cell tbl__cell--num">{fmtNum(r.momentum)}</div>
                <div className="tbl__cell tbl__cell--num">{fmtPct(r.forecast)}</div>
                <div className="tbl__cell tbl__cell--num">{fmtPct(r.confidence)}</div>
                <div className="tbl__cell"><span className="badge">{r.awa ?? "Aware"}</span></div>
                <div className="tbl__cell tbl__cell--action">
                  <button className="btn btn--ghost" onClick={() => onOpenSources?.(r)}>View</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** --------------------
 * Leaders (compact)
 * ------------------- */
function LeadersPanel({ items, loading }) {
  return (
    <div className="card">
      <div className="card__title">Leaders (ranked)</div>
      <div className="card__body">
        {loading && (
          <>
            <div className="skeleton skeleton--row" />
            <div className="skeleton skeleton--row" />
          </>
        )}
        {!loading && (!items || items.length === 0) && <div className="empty">—</div>}
        {!loading && items && items.length > 0 && (
          <div className="tbl tbl--dense">
            <div className="tbl__row tbl__head" style={{ gridTemplateColumns: "1.1fr .9fr .7fr .7fr" }}>
              <div className="tbl__cell tbl__headcell">Theme</div>
              <div className="tbl__cell tbl__headcell">Provider</div>
              <div className="tbl__cell tbl__headcell tbl__cell--num">Authority Avg</div>
              <div className="tbl__cell tbl__headcell tbl__cell--num">Eng</div>
            </div>
            {items.map((x, i) => (
              <div key={`${x.entity}-${i}`} className="tbl__row" style={{ gridTemplateColumns: "1.1fr .9fr .7fr .7fr" }}>
                <div className="tbl__cell">{x.entity}</div>
                <div className="tbl__cell">{x.provider}</div>
                <div className="tbl__cell tbl__cell--num">{fmtPct(x.avgAuth ?? 0.9)}</div>
                <div className="tbl__cell tbl__cell--num">{fmtPct(x.avgEng ?? 0)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** -------------------------
 * Why this matters panel
 * ------------------------ */
function WhyPanel({ bullets, loading, onRegenerate }) {
  return (
    <div className="card">
      <div className="card__title">Why this matters</div>
      <div className="card__body">
        {loading && (
          <>
            <div className="skeleton skeleton--row" />
            <div className="skeleton skeleton--row" />
          </>
        )}
        {!loading && (!bullets || bullets.length === 0) && <div className="empty">—</div>}
        {!loading && bullets && bullets.length > 0 && (
          <>
            <ul className="list">
              {bullets.map((b, i) => (
                <li key={i} className="list__item">
                  <span>• {b}</span>
                </li>
              ))}
            </ul>
            <div className="caption">
              Generated with AI.{" "}
              <button className="btn btn--ghost" style={{ height: 28, padding: "0 10px", marginLeft: 8 }} onClick={onRegenerate}>
                Regenerate
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** =========================================================
 * MAIN APP
 * ======================================================== */
export default function App() {
  const [region, setRegion] = useState("Nordics");
  const [kwInput, setKwInput] = useState("");
  const [keywords, setKeywords] = useState(["trenchcoat", "loafers", "quiet luxury"]);
  const [loadingRun, setLoadingRun] = useState(false);

  // panels
  const [topRows, setTopRows] = useState([]);          // enriched rows with citations
  const [leaders, setLeaders] = useState([]);
  const [bullets, setBullets] = useState([]);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [loadingLeaders, setLoadingLeaders] = useState(false);

  // telemetry
  const [sampleSize, setSampleSize] = useState(0);
  const [lastRunAt, setLastRunAt] = useState(null);

  // sources modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTheme, setModalTheme] = useState("");
  const [modalCitations, setModalCitations] = useState([]);

  // "What's rising"
  const [rising, setRising] = useState([]);

  const addKw = () => {
    const val = kwInput.trim();
    if (!val) return;
    if (!keywords.includes(val)) setKeywords((ks) => [...ks, val]);
    setKwInput("");
  };
  const removeKw = (k) => setKeywords((ks) => ks.filter((x) => x !== k));

  // Try to hydrate last run telemetry on load
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY_LAST_RUN);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.at) setLastRunAt(parsed.at);
    } catch {}
  }, []);

  /** Mapping tolerant to the backend’s shape, preserving citations if present */
  const mapRunToRows = (runData) => {
    if (!runData) return [];

    // new shape preferred: data: [{ entity, heat, momentum, forecast, confidence, awa, link, citations }]
    if (Array.isArray(runData.data)) {
      return runData.data.map((d) => ({
        theme: d.entity ?? d.theme,
        heat: clamp01(d.heat ?? d.avgScore ?? 0),
        momentum: Number.isFinite(d.momentum) ? d.momentum : 0,
        forecast: clamp01(
          typeof d.forecast === "number" ? d.forecast : (d.forecastPct ?? 0)
        ),
        confidence: clamp01(
          typeof d.confidence === "number" ? d.confidence : (d.confidencePct ?? 0)
        ),
        awa: d.awa ?? "Aware",
        link: d.link ?? (d.entity ? `https://www.youtube.com/results?search_query=${encodeURIComponent(d.entity)}` : "#"),
        citations: Array.isArray(d.citations) ? d.citations : [],
      }));
    }

    // legacy: entities: [{ entity, avgScore, avgAuth, link, citations? }]
    if (Array.isArray(runData.entities)) {
      return runData.entities.map((e) => ({
        theme: e.entity,
        heat: clamp01(e.avgScore ?? e.agg?.engagement ?? 0),
        momentum: 0,
        forecast: 0.3,
        confidence: clamp01(e.avgAuth ?? e.agg?.authority ?? 0.9),
        awa: "Aware",
        link: e.link ?? `https://www.youtube.com/results?search_query=${encodeURIComponent(e.entity)}`,
        citations: Array.isArray(e.citations) ? e.citations : [],
      }));
    }
    return [];
  };

  // Leaders
  async function fetchLeaders() {
    try {
      setLoadingLeaders(true);
      const res = await fetch(`/api/themes/top?region=${encodeURIComponent(region)}&limit=10`);
      if (!res.ok) throw new Error("leaders fetch failed");
      const json = await res.json();
      setLeaders(json?.data ?? []);
    } catch (e) {
      console.warn("leaders error:", e);
      setLeaders([]);
    } finally {
      setLoadingLeaders(false);
    }
  }

  // Insight
  async function fetchInsight(rowsArg) {
    const src = Array.isArray(rowsArg) ? rowsArg : topRows;
    const entities = (src || []).slice(0, 5).map((r) => ({
      entity: String(r.theme || "").trim(),
      agg: { engagement: clamp01(r.heat), authority: clamp01(r.confidence ?? 0) },
    })).filter((e) => e.entity && (e.agg.engagement > 0 || e.agg.authority > 0));

    if (entities.length === 0) {
      setBullets([]);
      return;
    }

    try {
      setLoadingInsight(true);
      const res = await fetch("/api/insight", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ region, entities }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        console.warn("insight error", res.status, t);
        setBullets([]);
        return;
      }
      const json = await res.json();
      setBullets(Array.isArray(json?.bullets) ? json.bullets : []);
    } catch (e) {
      console.warn("insight request failed", e);
      setBullets([]);
    } finally {
      setLoadingInsight(false);
    }
  }

  // Compute “What’s rising” from last run → current run (heat/momentum deltas)
  function computeRising(prevRows, currRows) {
    if (!Array.isArray(prevRows) || !Array.isArray(currRows)) return [];
    const prevMap = new Map(prevRows.map((r) => [r.theme, r]));
    const deltas = currRows.map((r) => {
      const before = prevMap.get(r.theme);
      const dHeat = (r.heat ?? 0) - (before?.heat ?? 0);
      const dMom = (r.momentum ?? 0) - (before?.momentum ?? 0);
      const score = dHeat * 0.7 + dMom * 0.3;
      return { theme: r.theme, dHeat, dMom, score };
    }).filter((x) => x.dHeat > 0 || x.dMom > 0);
    deltas.sort((a, b) => b.score - a.score);
    return deltas.slice(0, 5);
  }

  async function runResearch() {
    setLoadingRun(true);
    setTopRows([]);
    setBullets([]);
    setLeaders([]);
    setRising([]);
    setSampleSize(0);

    let prevRows = [];
    try {
      const rawPrev = localStorage.getItem(LS_KEY_LAST_RUN);
      if (rawPrev) {
        const parsed = JSON.parse(rawPrev);
        if (Array.isArray(parsed?.rows)) prevRows = parsed.rows;
      }
    } catch {}

    try {
      const res = await fetch("/api/research/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ region, keywords }),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`run failed ${res.status}: ${t || res.statusText}`);
      }

      const json = await res.json();
      const rows = mapRunToRows(json);

      // Normalize numbers and ensure citations array
      const normalized = rows.map((r) => ({
        ...r,
        heat: Number.isFinite(r.heat) ? r.heat : 0,
        momentum: Number.isFinite(r.momentum) ? r.momentum : 0,
        forecast: Number.isFinite(r.forecast) ? r.forecast : 0,
        confidence: Number.isFinite(r.confidence) ? r.confidence : 0,
        citations: Array.isArray(r.citations) ? r.citations : [],
      }));

      setTopRows(normalized);
      setSampleSize(Number(json?.totalSignals ?? 0));
      const nowIso = new Date().toISOString();
      setLastRunAt(nowIso);

      // Persist current run for next delta calc
      try {
        localStorage.setItem(LS_KEY_LAST_RUN, JSON.stringify({ at: nowIso, rows: normalized }));
      } catch {}

      // Rising
      const risingNow = computeRising(prevRows, normalized);
      setRising(risingNow);

      // Parallel follow-ups
      fetchLeaders();
      fetchInsight(normalized);
    } catch (e) {
      console.error("run error", e);
    } finally {
      setLoadingRun(false);
    }
  }

  // open sources modal for a row
  function handleOpenSources(row) {
    setModalTheme(row.theme);
    setModalCitations(row.citations ?? []);
    setModalOpen(true);
  }

  return (
    <div className="app">
      {/* Header / toolbar */}
      <div className="toolbar">
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 0.2 }}>AI Trend Dashboard</div>

        <select className="input" value={region} onChange={(e) => setRegion(e.target.value)}>
          <option>Nordics</option>
          <option>US</option>
          <option>UK</option>
          <option>France</option>
          <option>Global</option>
        </select>

        <button className="btn" onClick={runResearch} disabled={loadingRun}>
          {loadingRun ? "Running…" : "Run research"}
        </button>

        <div className="toolbar__right">
          <div className="stat">
            <div className="stat__label">Keywords</div>
            <div className="stat__value">{keywords.length}</div>
          </div>
          <div className="stat">
            <div className="stat__label">Signals (last run)</div>
            <div className="stat__value">{sampleSize}</div>
          </div>
          <div className="stat">
            <div className="stat__label">Last run</div>
            <div className="stat__value">{lastRunAt ? new Date(lastRunAt).toLocaleTimeString() : "—"}</div>
          </div>
        </div>
      </div>

      {/* Keyword tokens */}
      <div className="tokens card">
        {keywords.map((k) => (
          <span key={k} className="badge" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            {k}
            <button className="icon-btn" style={{ width: 22, height: 22, fontSize: 12 }} onClick={() => removeKw(k)} aria-label={`Remove ${k}`}>×</button>
          </span>
        ))}
        <input
          className="input"
          style={{ minWidth: 160 }}
          placeholder="Add keyword…"
          value={kwInput}
          onChange={(e) => setKwInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addKw(); }}
        />
        <button className="btn btn--ghost" onClick={addKw}>Add</button>
      </div>

      {/* Panels */}
      <div className="panel-grid">
        <TopMoversTable rows={topRows} loading={loadingRun} onOpenSources={handleOpenSources} />
        <LeadersPanel items={leaders} loading={loadingLeaders} />

        {/* What's rising */}
        <div className="card" style={{ gridColumn: "1 / -1" }}>
          <div className="card__title">What’s rising</div>
          <div className="card__body">
            {rising.length === 0 ? (
              <div className="empty">—</div>
            ) : (
              <div className="tbl tbl--dense">
                <div className="tbl__row tbl__head" style={{ gridTemplateColumns: "1fr .6fr .6fr .6fr" }}>
                  <div className="tbl__cell tbl__headcell">Theme</div>
                  <div className="tbl__cell tbl__headcell tbl__cell--num">Δ Heat</div>
                  <div className="tbl__cell tbl__headcell tbl__cell--num">Δ Momentum</div>
                  <div className="tbl__cell tbl__headcell tbl__cell--num">Score</div>
                </div>
                {rising.map((x) => (
                  <div key={x.theme} className="tbl__row" style={{ gridTemplateColumns: "1fr .6fr .6fr .6fr" }}>
                    <div className="tbl__cell">{x.theme}</div>
                    <div className="tbl__cell tbl__cell--num">{fmtNum(x.dHeat)}</div>
                    <div className="tbl__cell tbl__cell--num">{fmtNum(x.dMom)}</div>
                    <div className="tbl__cell tbl__cell--num">{fmtNum(x.score)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <WhyPanel bullets={bullets} loading={loadingInsight} onRegenerate={() => fetchInsight()} />
      </div>

      {/* Footer */}
      <div style={{ color: "var(--muted)", textAlign: "center", marginTop: 28 }}>
        Built with ♥ — data from YouTube, GDELT & Google Trends (more sources coming).
      </div>

      {/* Sources drawer */}
      <SourcesModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        theme={modalTheme}
        citations={modalCitations}
      />
    </div>
  );
}
