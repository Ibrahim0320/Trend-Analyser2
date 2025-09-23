import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Polished UI that keeps your existing endpoints and flows:
 * - POST /api/research/run  (body: { region, keywords[]? })
 * - GET  /api/themes/top?region=...&limit=10
 * - GET/POST /api/research/watchlist
 * - GET  /api/briefs/pdf?region=...&k=keyword1&k=keyword2...
 */

const REGIONS = ["Nordics", "US", "UK", "DACH", "Benelux", "All"];

export default function App() {
  // ------- UI state -------
  const [region, setRegion] = useState("Nordics");
  const [input, setInput] = useState("");
  const [chips, setChips] = useState(["trenchcoat", "loafers", "quiet luxury"]);
  const [loadingRun, setLoadingRun] = useState(false);
  const [loadingTop, setLoadingTop] = useState(false);

  // server data
  const [top, setTop] = useState([]); // [{ theme, heat, momentum, forecast, confidence, awa, link }]
  const [lastRunMeta, setLastRunMeta] = useState(null); // {totalSignals, entities: [...]}

  const inputRef = useRef(null);

  // -------- helpers ----------
  const addChip = () => {
    const v = input.trim();
    if (!v) return;
    if (!chips.includes(v)) setChips((c) => [...c, v]);
    setInput("");
    inputRef.current?.focus();
  };
  const removeChip = (v) => setChips((c) => c.filter((x) => x !== v));

  // -------- API calls ----------
  const fetchTop = async (r = region) => {
    setLoadingTop(true);
    try {
      const res = await fetch(`/api/themes/top?region=${encodeURIComponent(r)}&limit=10`);
      const js = await res.json();
      // Expecting {ok, data:[{entity, avgScore, totalViews, avgEng, avgAuth, heat, momentum, forecast, confidence, awa, link}]}
      setTop(js?.data ?? []);
    } catch (err) {
      console.error("top failed", err);
      setTop([]);
    } finally {
      setLoadingTop(false);
    }
  };

  const runResearch = async () => {
    setLoadingRun(true);
    try {
      const res = await fetch("/api/research/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ region, keywords: chips }),
      });
      const js = await res.json();
      setLastRunMeta({
        totalSignals: js?.totalSignals ?? 0,
        entities: js?.entities ?? [],
      });
      // Refresh the top movers once run completes
      await fetchTop(region);
      // Save watchlist silently
      await saveWatchlistSilent();
    } catch (err) {
      console.error("run failed", err);
    } finally {
      setLoadingRun(false);
    }
  };

  const saveWatchlistSilent = async () => {
    try {
      await fetch("/api/research/watchlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ region, keywords: chips }),
      });
    } catch {}
  };

  const loadWatchlist = async () => {
    try {
      const res = await fetch(`/api/research/watchlist?region=${encodeURIComponent(region)}`);
      const js = await res.json();
      if (Array.isArray(js?.keywords) && js.keywords.length) setChips(js.keywords);
    } catch {}
  };

  // initial + region change
  useEffect(() => {
    fetchTop(region);
    loadWatchlist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region]);

  // derived: nice rows for the top table
  const rows = useMemo(
    () =>
      (top || []).map((t) => ({
        theme: t.theme || t.entity,
        heat: Math.round((t.heat ?? 0)),
        momentum: Math.round((t.momentum ?? 0)),
        forecast: Math.round((t.forecast ?? 0) * 100),
        confidence: `${Math.round((t.confidence ?? 0) * 100)}%`,
        awa: t.awa ?? "Aware",
        link:
          t.link ||
          (t.entity
            ? `https://www.youtube.com/results?search_query=${encodeURIComponent(
                t.entity
              )}`
            : "#"),
      })),
    [top]
  );

  const pdfHref = useMemo(() => {
    const qs = new URLSearchParams();
    qs.set("region", region);
    chips.forEach((k) => qs.append("k", k));
    return `/api/briefs/pdf?${qs.toString()}`;
  }, [region, chips]);

  return (
    <div className="container">
      <div className="header">
        <div className="brand">
          <div className="logo" />
          <h1>AI Trend Dashboard</h1>
        </div>
        <div className="controls">
          <select
            className="select"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            aria-label="Region"
          >
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <button
            className="btn primary"
            onClick={runResearch}
            disabled={loadingRun}
            title="Aggregate YouTube + News + Trends for your keywords"
          >
            {loadingRun ? "Running…" : "Run research"}
          </button>
        </div>
      </div>

      {/* Working keywords */}
      <div className="panel">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div className="meta">Working keywords:</div>
          <div className="chips">
            {chips.map((c) => (
              <span key={c} className="chip">
                {c}
                <button onClick={() => removeChip(c)} aria-label={`remove ${c}`}>
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <input
            ref={inputRef}
            className="input"
            placeholder="Add keyword…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addChip()}
          />
          <button className="btn ghost" onClick={addChip}>Add</button>
          <button className="btn ghost" onClick={() => setChips([])}>Reset working list</button>
          <a className="btn ghost" href={pdfHref} target="_blank" rel="noreferrer">
            Download Brief (PDF)
          </a>
        </div>

        {lastRunMeta ? (
          <div style={{ marginTop: 10 }} className="meta">
            Last run: <b className="k">{lastRunMeta.totalSignals}</b> signals across{" "}
            <b className="k">{lastRunMeta.entities?.length ?? 0}</b> themes.
          </div>
        ) : null}
      </div>

      {/* Top Movers */}
      <div className="panel">
        <h2>Top Movers (themes)</h2>
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ minWidth: 160 }}>Theme</th>
                <th>Heat</th>
                <th>Momentum</th>
                <th>Forecast (2w)</th>
                <th>Confidence</th>
                <th>A/W/A</th>
                <th>Link</th>
              </tr>
            </thead>
            <tbody>
              {loadingTop
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`skel-${i}`}>
                      <td><div className="skel" style={{ width: 140 }} /></td>
                      <td><div className="skel" style={{ width: 40 }} /></td>
                      <td><div className="skel" style={{ width: 40 }} /></td>
                      <td><div className="skel" style={{ width: 60 }} /></td>
                      <td><div className="skel" style={{ width: 60 }} /></td>
                      <td><div className="skel" style={{ width: 60 }} /></td>
                      <td><div className="skel" style={{ width: 80 }} /></td>
                    </tr>
                  ))
                : rows.length === 0
                ? (
                  <tr>
                    <td colSpan={7} className="meta">
                      — No data yet. Run research to populate insights.
                    </td>
                  </tr>
                )
                : rows.map((r) => (
                    <tr key={r.theme}>
                      <td>{r.theme}</td>
                      <td>{r.heat}</td>
                      <td>{r.momentum}</td>
                      <td>{r.forecast}%</td>
                      <td>{r.confidence}</td>
                      <td>{r.awa}</td>
                      <td>
                        <a className="link" href={r.link} target="_blank" rel="noreferrer">
                          ↗
                        </a>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* What’s rising */}
      <div className="panel">
        <h2>What’s rising</h2>
        <div className="meta">—</div>
      </div>

      {/* Leaders ranked */}
      <div className="panel">
        <h2>Leaders (ranked)</h2>
        <div className="meta">—</div>
      </div>

      <div className="footer">
        Built with ❤️ — data from YouTube, GDELT & Google Trends.
      </div>
    </div>
  );
}
