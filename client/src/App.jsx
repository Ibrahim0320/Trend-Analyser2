import React, { useMemo, useState } from "react";

/** ----------------------
 * Small utilities
 * --------------------- */
const fmtPct = (v) => (v === null || v === undefined ? "—" : `${Math.round(v * 100)}%`);
const fmtNum = (v) => (v === null || v === undefined ? "—" : (Math.round(v * 100) / 100).toFixed(2));

/** ----------------------------------------------------------------
 * Top Movers Table (sortable, loading & empty states built-in)
 * ---------------------------------------------------------------- */
function TopMoversTable({ rows, loading, onLink }) {
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
        {/* Loading */}
        {loading && (
          <div className="tbl tbl--loading">
            <div className="skeleton skeleton--row" />
            <div className="skeleton skeleton--row" />
            <div className="skeleton skeleton--row" />
          </div>
        )}

        {/* Empty */}
        {!loading && (!rows || rows.length === 0) && (
          <div className="tbl tbl--empty">
            <div className="empty">No results yet. Try “brand + product + niche”, then Run research.</div>
          </div>
        )}

        {/* Ready */}
        {!loading && rows && rows.length > 0 && (
          <div className="tbl tbl--dense">
            <div className="tbl__row tbl__head">
              <button className="tbl__cell tbl__headcell" onClick={() => changeSort("theme")}>Theme</button>
              <button className="tbl__cell tbl__headcell tbl__cell--num" onClick={() => changeSort("heat")}>Heat</button>
              <button className="tbl__cell tbl__headcell tbl__cell--num" onClick={() => changeSort("momentum")}>Momentum</button>
              <button className="tbl__cell tbl__headcell tbl__cell--num" onClick={() => changeSort("forecast")}>Forecast (2w)</button>
              <button className="tbl__cell tbl__headcell tbl__cell--num" onClick={() => changeSort("confidence")}>Confidence</button>
              <div className="tbl__cell tbl__headcell">A/W/A</div>
              <div className="tbl__cell tbl__headcell tbl__cell--action">Link</div>
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
                  <a className="icon-btn" href={r.link} target="_blank" rel="noreferrer" onClick={(e) => onLink?.(r, e)} aria-label="Open sources">↗</a>
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
 * MAIN APP — hooks into your existing endpoints as-is
 * ======================================================== */
export default function App() {
  const [region, setRegion] = useState("Nordics");
  const [kwInput, setKwInput] = useState("");
  const [keywords, setKeywords] = useState(["trenchcoat", "loafers", "quiet luxury"]);
  const [loadingRun, setLoadingRun] = useState(false);

  // panels
  const [topRows, setTopRows] = useState([]);          // [{ theme, heat, momentum, forecast, confidence, awa, link }]
  const [leaders, setLeaders] = useState([]);          // [{ entity, provider, avgAuth, avgEng }]
  const [bullets, setBullets] = useState([]);          // ["...", "..."]
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [loadingLeaders, setLoadingLeaders] = useState(false);

  const addKw = () => {
    const val = kwInput.trim();
    if (!val) return;
    if (!keywords.includes(val)) setKeywords((ks) => [...ks, val]);
    setKwInput("");
  };
  const removeKw = (k) => setKeywords((ks) => ks.filter((x) => x !== k));

  /** Map your /api/research/run result to table rows.
   *  Adjust this function if your shape differs! */
  const mapRunToRows = (runData) => {
    // Example tolerated shapes:
    // A) { entities: [{ entity, avgScore, avgEng, avgAuth, link } ...] }
    // B) { data: [{ entity, heat, momentum, forecast, confidence, awa, link } ...] }
    if (!runData) return [];
    if (Array.isArray(runData.data)) {
      return runData.data.map((d) => ({
        theme: d.entity ?? d.theme,
        heat: d.heat ?? d.avgScore ?? 0,
        momentum: d.momentum ?? 0,
        forecast: typeof d.forecast === "number" ? d.forecast : (d.forecastPct ?? 0),
        confidence: typeof d.confidence === "number" ? d.confidence : (d.confidencePct ?? 0),
        awa: d.awa ?? "Aware",
        link: d.link ?? (d.entity ? `https://www.youtube.com/results?search_query=${encodeURIComponent(d.entity)}` : "#"),
      }));
    }
    if (Array.isArray(runData.entities)) {
      return runData.entities.map((e) => ({
        theme: e.entity,
        heat: e.avgScore ?? e.agg?.engagement ?? 0,
        momentum: 0,
        forecast: 0.3, // placeholder if your API doesn’t send it
        confidence: e.avgAuth ?? e.agg?.authority ?? 0.9,
        awa: "Aware",
        link: `https://www.youtube.com/results?search_query=${encodeURIComponent(e.entity)}`,
      }));
    }
    return [];
  };

  // Fetch leaders (optional helper if you have /api/themes/top)
  async function fetchLeaders() {
    try {
      setLoadingLeaders(true);
      const res = await fetch(`/api/themes/top?region=${encodeURIComponent(region)}&limit=10`);
      if (!res.ok) throw new Error("leaders fetch failed");
      const json = await res.json(); // expects { ok, data:[{entity, provider, avgAuth, avgEng}] }
      setLeaders(json?.data ?? []);
    } catch (e) {
      console.warn("leaders error:", e);
      setLeaders([]);
    } finally {
      setLoadingLeaders(false);
    }
  }

  async function fetchInsight(rows) {
    try {
      setLoadingInsight(true);
      const entities = (rows ?? topRows).slice(0, 5).map((r) => ({
        entity: r.theme,
        agg: { engagement: r.heat ?? 0, authority: r.confidence ?? 0.9 },
      }));
      const res = await fetch("/api/insight", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ region, entities }),
      });
      if (!res.ok) throw new Error("insight request failed");
      const json = await res.json(); // { ok, bullets:[], provider }
      setBullets(json?.bullets ?? []);
    } catch (e) {
      console.warn("insight error:", e);
      setBullets([]);
    } finally {
      setLoadingInsight(false);
    }
  }

  const runResearch = async () => {
  setIsRunning(true);
  setErr('');
  setWhyBullets([]);

  try {
    // 1) Run
    const res = await fetch('/api/research/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ region, keywords }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`run failed ${res.status}: ${t || res.statusText}`);
    }

    const json = await res.json();
    const data = Array.isArray(json.data) ? json.data : [];
    setRows(data);
    setStats({
      signals: json.totalSignals ?? data.length,
      keywords: (json.keywords ?? keywords).length,
    });

    // Leaders (left as-is)
    const legacy = Array.isArray(json.entities) ? json.entities : [];
    const leadersRows = legacy.length
      ? legacy.map(e => ({
          theme: e.entity,
          provider: 'mixed',
          authority: (e.avgAuth ?? e.agg?.authority ?? 0),
          eng: (e.agg?.engagement ?? e.avgScore ?? 0),
        }))
      : (data || []).map(r => ({
          theme: r.entity,
          provider: 'mixed',
          authority: r.confidence ?? 0,
          eng: r.heat ?? 0,
        }));
    leadersRows.sort((a, b) => b.authority - a.authority);
    setLeaders(leadersRows.slice(0, 10));

    // 2) Prepare INSIGHT payload exactly as the API expects
    // Prefer the new `data` rows. If empty, fall back to legacy entities.
    let insightEntities = [];

    if (data.length) {
      // data rows: entity, heat ~ engagement proxy, confidence ~ authority
      insightEntities = data
        .slice(0, 3)
        .map(r => ({
          entity: r.entity,
          agg: {
            engagement: typeof r.heat === 'number' ? r.heat : 0,
            authority: typeof r.confidence === 'number' ? r.confidence : 0,
          },
        }))
        .filter(e => e.entity && (e.agg.engagement > 0 || e.agg.authority > 0));
    } else if (legacy.length) {
      // legacy rows: avgScore ~ engagement proxy, avgAuth ~ authority
      insightEntities = legacy
        .slice(0, 3)
        .map(e => ({
          entity: e.entity,
          agg: {
            engagement: typeof e.avgScore === 'number' ? e.avgScore : (e.agg?.engagement ?? 0),
            authority: typeof e.avgAuth === 'number' ? e.avgAuth : (e.agg?.authority ?? 0),
          },
        }))
        .filter(e => e.entity && (e.agg.engagement > 0 || e.agg.authority > 0));
    }

    // Only call /api/insight when we have something meaningful
    if (insightEntities.length) {
      try {
        const ins = await fetch('/api/insight', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ region, entities: insightEntities }),
        });

        if (!ins.ok) {
          const body = await ins.text().catch(() => '');
          // log the server’s validation details to console to debug quickly
          console.warn('insight error:', ins.status, body);
        } else {
          const ij = await ins.json();
          if (Array.isArray(ij.bullets) && ij.bullets.length) setWhyBullets(ij.bullets);
        }
      } catch (ie) {
        console.warn('insight request failed', ie);
      }
    }
  } catch (e) {
    console.error(e);
    setErr(e.message || 'Run failed');
  } finally {
    setIsRunning(false);
  }
};


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
            <div className="stat__label">Region</div>
            <div className="stat__value">{region}</div>
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
        <input className="input" style={{ minWidth: 160 }} placeholder="Add keyword…" value={kwInput} onChange={(e) => setKwInput(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter') addKw(); }} />
        <button className="btn btn--ghost" onClick={addKw}>Add</button>
      </div>

      {/* Panels */}
      <div className="panel-grid">
        <TopMoversTable rows={topRows} loading={loadingRun} onLink={() => {}} />
        <LeadersPanel items={leaders} loading={loadingLeaders} />
        <div className="card" style={{ gridColumn: "1 / -1" }}>
          <div className="card__title">What’s rising</div>
          <div className="card__body">
            <div className="empty">—</div>
          </div>
        </div>
        <WhyPanel bullets={bullets} loading={loadingInsight} onRegenerate={() => fetchInsight()} />
      </div>

      {/* Footer */}
      <div style={{ color: "var(--muted)", textAlign: "center", marginTop: 28 }}>
        Built with ♥ — data from YouTube, GDELT & Google Trends.
      </div>
    </div>
  );
}
