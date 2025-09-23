// client/src/App.jsx
import React, { useEffect, useMemo, useState } from 'react';
import './styles.css';

const REGION_OPTIONS = ['Nordics', 'US', 'UK', 'EU', 'All'];

function Badge({ children }) {
  return <span className="badge">{children}</span>;
}

function Pill({ label, onRemove }) {
  return (
    <span className="pill">
      {label}
      <button className="pill-x" onClick={onRemove} aria-label={`Remove ${label}`}>×</button>
    </span>
  );
}

function Empty({ children = '—' }) {
  return <div className="empty">{children}</div>;
}

function Spinner() {
  return <div className="spinner" aria-label="loading" />;
}

function ExternalArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" className="ext">
      <path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3z" />
      <path d="M5 5h7v2H7v10h10v-5h2v7H5z" />
    </svg>
  );
}

// -------- Helpers on the client --------
function ytLink(sourceId, query) {
  if (sourceId) return `https://www.youtube.com/watch?v=${sourceId}`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}
function newsLink(query) {
  return `https://news.google.com/search?q=${encodeURIComponent(query)}`;
}
function trendsLink(query, region = 'US') {
  return `https://trends.google.com/trends/explore?geo=${encodeURIComponent(region)}&q=${encodeURIComponent(query)}`;
}

function computeRising(entities, limit = 10) {
  const rows = [];
  for (const e of entities || []) {
    for (const s of e.top || []) {
      const vel = Number(s.velocity || 0);
      const eng = Number(s.engagement || 0);
      const auth = Number(s.authority || 0);
      const score = Number(s.score || 0);

      // If no velocity from providers, synthesize a lightweight “rise” score.
      // Favor engagement + authority and lightly mix in score.
      const riseScore = vel > 0 ? vel : (0.6 * eng + 0.4 * auth + 0.2 * score);

      rows.push({
        entity: e.entity,
        provider: s.provider,
        velocity: riseScore,           // we sort by this
        authority: auth,
        engagement: eng,
        link:
          s.provider === 'youtube'
            ? (s.sourceId ? `https://www.youtube.com/watch?v=${s.sourceId}` : `https://www.youtube.com/results?search_query=${encodeURIComponent(e.entity)}`)
            : (s.provider === 'gdelt'
                ? `https://news.google.com/search?q=${encodeURIComponent(e.entity)}`
                : `https://trends.google.com/trends/explore?q=${encodeURIComponent(e.entity)}`),
      });
    }
  }
  rows.sort((a, b) => b.velocity - a.velocity || b.authority - a.authority);
  return rows.slice(0, limit);
}


export default function App() {
  const [region, setRegion] = useState('Nordics');
  const [working, setWorking] = useState(['trenchcoat', 'loafers', 'quiet luxury']);
  const [addTerm, setAddTerm] = useState('');
  const [busy, setBusy] = useState(false);

  // data from API
  const [entities, setEntities] = useState([]); // [{entity, top:[...], agg:{}}]
  const [lastTotals, setLastTotals] = useState({ signals: 0, keywords: 0 });

  // Leaders + Insight
  const [leaders, setLeaders] = useState([]);
  const [leadersBusy, setLeadersBusy] = useState(false);

  const [insight, setInsight] = useState(null);
  const [insightBusy, setInsightBusy] = useState(false);

  const rising = useMemo(() => computeRising(entities, 10), [entities]);

  useEffect(() => {
    // On load, fetch the initial "top movers" block (server derived)
    refreshTopMovers();
    // Also show leaders for current region
    loadLeaders(region);
  }, [region]);

  async function refreshTopMovers() {
    try {
      const r = await fetch(`/api/themes/top?region=${encodeURIComponent(region)}&limit=10`);
      const j = await r.json();
      // j = { ok, data: [{ entity, avgScore, totalViews, avgEng, avgAuth, ...}] }
      // This endpoint is for the "quick cards", but we still drive the table from /run results,
      // so we only use it when nothing else is present.
    } catch {
      // ignore; this is best-effort on load
    }
  }

  function removeTerm(ix) {
    const copy = working.slice();
    copy.splice(ix, 1);
    setWorking(copy);
  }

  function addKeyword() {
    const v = (addTerm || '').trim();
    if (!v) return;
    if (!working.includes(v)) setWorking([...working, v]);
    setAddTerm('');
  }

  async function runResearch() {
    setBusy(true);
    try {
      const r = await fetch('/api/research/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ region, keywords: working }),
      });
      const j = await r.json();
      if (j?.ok) {
        setEntities(j.entities || []);
        setLastTotals({ signals: j.totalSignals || 0, keywords: (j.keywords || []).length });
        // fetch fresh leaders (based on new signals)
        loadLeaders(region);
        // fetch a short insight
        generateInsight(j.entities || []);
      } else {
        alert('Research request failed.');
      }
    } catch (err) {
      console.error(err);
      alert('Research error (see console).');
    } finally {
      setBusy(false);
    }
  }

  async function loadLeaders(rgn) {
    setLeadersBusy(true);
    try {
      const r = await fetch(`/api/themes/leaders?region=${encodeURIComponent(rgn)}&limit=8`);
      const j = await r.json();
      setLeaders(j?.data || []);
    } catch (e) {
      console.error(e);
      setLeaders([]);
    } finally {
      setLeadersBusy(false);
    }
  }

  async function generateInsight(currentEntities) {
    setInsightBusy(true);
    try {
      const r = await fetch('/api/briefs/insight', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ region, entities: currentEntities }),
      });
      const j = await r.json();
      setInsight(j?.bullets || null);
    } catch (e) {
      console.error(e);
      setInsight(null);
    } finally {
      setInsightBusy(false);
    }
  }

  return (
    <div className="app">
      <header className="toolbar">
        <h1>AI Trend Dashboard</h1>
        <div className="toolbar-cta">
          <select
            className="select"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            aria-label="Region"
          >
            {REGION_OPTIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <button className="btn primary" disabled={busy} onClick={runResearch}>
            {busy ? 'Running…' : 'Run research'}
          </button>

          <div className="meta">
            <div><b>{lastTotals.signals}</b><div className="meta-sub">Signals (last run)</div></div>
            <div><b>{lastTotals.keywords}</b><div className="meta-sub">Keywords</div></div>
            <div><b>{region}</b><div className="meta-sub">Region</div></div>
          </div>
        </div>
      </header>

      <section className="panel">
        <div className="row between">
          <div className="kw">
            {working.map((w, i) => (
              <Pill key={`${w}-${i}`} label={w} onRemove={() => removeTerm(i)} />
            ))}
          </div>
          <div className="kw-actions">
            <div className="form">
              <input
                className="input"
                placeholder="Add keyword…"
                value={addTerm}
                onChange={(e) => setAddTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
              />
              <button className="btn" onClick={addKeyword}>Add</button>
            </div>
            <button className="btn">Reset working list</button>
            <a className="btn" href="/api/briefs/pdf" rel="noreferrer">Download Brief (PDF)</a>
          </div>
        </div>
      </section>

      <div className="grid">
        {/* Top Movers */}
        <section className="card tall">
          <div className="card-head">
            <h3>Top Movers (themes)</h3>
          </div>
          <div className="tbl">
            <div className="tr th">
              <div>Theme</div><div>Heat</div><div>Momentum</div><div>Forecast (2w)</div>
              <div>Confidence</div><div>A/W/A</div><div>Link</div>
            </div>
            {(entities?.length ? entities : []).map((row) => (
              <div className="tr" key={row.entity}>
                <div className="theme">{row.entity}</div>
                <div>{Number(row.top?.[0]?.engagement || 0).toFixed(2)}</div>
                <div>{Number(row.top?.[0]?.velocity || 0).toFixed(2)}</div>
                <div>{Math.round((row.top?.[0]?.score || 0) * 100)}%</div>
                <div>{Math.round((row.agg?.engagement || 0) * 100)}%</div>
                <div>Aware</div>
                <div>
                  <a
                    className="icon-link"
                    href={ytLink(row.top?.[0]?.sourceId, row.entity)}
                    target="_blank" rel="noreferrer" title="Open signals"
                  >
                    <ExternalArrow />
                  </a>
                </div>
              </div>
            ))}
            {!entities?.length && <Empty />}
          </div>
        </section>

        {/* Leaders (ranked) */}
        <section className="card">
          <div className="card-head">
            <h3>Leaders (ranked)</h3>
            {leadersBusy && <Spinner />}
          </div>
          <div className="tbl">
            <div className="tr th"><div>Source</div><div>Provider</div><div>Authority</div><div>Avg Eng</div></div>
            {leaders?.length ? leaders.map((l, i) => (
              <div className="tr" key={`${l.key}-${i}`}>
                <div className="theme">{l.source}</div>
                <div>{l.provider}</div>
                <div>{(l.authority * 100).toFixed(0)}%</div>
                <div>{(l.avgEng * 100).toFixed(0)}%</div>
              </div>
            )) : <Empty />}
          </div>
        </section>

        {/* What's rising */}
        <section className="card">
          <div className="card-head">
            <h3>What’s rising</h3>
          </div>
          <div className="tbl">
            <div className="tr th"><div>Theme</div><div>Velocity</div><div>Authority</div><div>Link</div></div>
            {rising?.length ? rising.map((r, i) => (
              <div className="tr" key={`${r.entity}-${i}`}>
                <div className="theme">{r.entity}</div>
                <div>{(r.velocity * 100).toFixed(0)}%</div>
                <div>{(r.authority * 100).toFixed(0)}%</div>
                <div>
                  <a className="icon-link" href={r.link} target="_blank" rel="noreferrer" title="Open">
                    <ExternalArrow />
                  </a>
                </div>
              </div>
            )) : <Empty />}
          </div>
        </section>

        {/* Why this matters */}
        <section className="card">
          <div className="card-head">
            <h3>Why this matters</h3>
            {insightBusy && <Spinner />}
          </div>
          {insight?.length ? (
            <ul className="bullets">
              {insight.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          ) : <Empty />}
        </section>
      </div>

      <footer className="footer">
        Built with <span className="heart">♥</span> — data from YouTube, GDELT & Google Trends.
      </footer>
    </div>
  );
}

