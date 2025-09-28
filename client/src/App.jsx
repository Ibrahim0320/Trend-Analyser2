// client/src/App.jsx
import React, { useEffect, useMemo, useState } from 'react';

const DEFAULT_REGION = 'Nordics';
const DEFAULT_KEYWORDS = ['trenchcoat', 'loafers', 'quiet luxury'];

function pct(x) {
  if (x == null || Number.isNaN(x)) return '—';
  return `${Math.round(x * 100)}%`;
}

export default function App() {
  // Controls
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [keywords, setKeywords] = useState(DEFAULT_KEYWORDS);
  const [addText, setAddText] = useState('');

  // Data
  const [rows, setRows] = useState([]);               // preferred data from /api/research/run
  const [leaders, setLeaders] = useState([]);         // simple leaders panel
  const [whyBullets, setWhyBullets] = useState([]);   // /api/insight
  const [stats, setStats] = useState({ signals: 0, keywords: 0 });

  // UX
  const [isRunning, setIsRunning] = useState(false);
  const [err, setErr] = useState('');

  // Sources modal
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [sourcesFor, setSourcesFor] = useState({ entity: '', citations: [] });

  const openSources = (entity, citations = []) => {
    setSourcesFor({ entity, citations });
    setSourcesOpen(true);
  };
  const closeSources = () => setSourcesOpen(false);

  // derived: what’s rising (momentum top > 0)
  const rising = useMemo(() => {
    const list = (rows || [])
      .slice()
      .filter(r => (r.momentum ?? 0) > 0)
      .sort((a, b) => b.momentum - a.momentum)
      .slice(0, 5);
    return list;
  }, [rows]);

  // Add/remove keywords
  const addKeyword = () => {
    const k = addText.trim();
    if (!k) return;
    if (!keywords.includes(k)) setKeywords(prev => [...prev, k]);
    setAddText('');
  };
  const removeKeyword = (k) => {
    setKeywords(prev => prev.filter(x => x !== k));
  };
  const resetWorking = () => {
    setKeywords(DEFAULT_KEYWORDS);
  };

  // Core: run research
  const runResearch = async () => {
    setIsRunning(true);
    setErr('');
    setWhyBullets([]);
    try {
      const res = await fetch('/api/research/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ region, keywords }),
      });
      if (!res.ok) throw new Error(`run failed ${res.status}`);
      const json = await res.json();

      const data = Array.isArray(json.data) ? json.data : [];
      setRows(data);
      setStats({ signals: json.totalSignals ?? data.length, keywords: (json.keywords ?? keywords).length });

      // leaders: simple projection from legacy entities or from data
      const legacy = Array.isArray(json.entities) ? json.entities : [];
      const leadersRows = legacy.length
        ? legacy.map(e => ({
            theme: e.entity,
            provider: 'mixed',
            authority: (e.avgAuth ?? e.agg?.authority ?? 0),
            eng: (e.agg?.engagement ?? e.avgScore ?? 0),
          }))
        : (data || []).map(r => ({
            theme: r.entity, provider: 'mixed', authority: r.confidence ?? 0, eng: r.heat ?? 0,
          }));
      leadersRows.sort((a, b) => b.authority - a.authority);
      setLeaders(leadersRows.slice(0, 10));

      // Follow-up: Why this matters (send top 3)
      const topForInsight = (data || [])
        .slice(0, 3)
        .map(r => ({ entity: r.entity, agg: { engagement: r.heat ?? 0, authority: r.confidence ?? 0 } }));
      if (topForInsight.length) {
        try {
          const ins = await fetch('/api/insight', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ region, entities: topForInsight }),
          });
          if (ins.ok) {
            const ij = await ins.json();
            if (Array.isArray(ij.bullets) && ij.bullets.length) setWhyBullets(ij.bullets);
          }
        } catch {
          /* soft fail – keep UI responsive */
        }
      }
    } catch (e) {
      console.error(e);
      setErr(e.message || 'Run failed');
    } finally {
      setIsRunning(false);
    }
  };

  // Auto-run once on mount to show something
  useEffect(() => {
    // noop: keep current behaviour manual-only
  }, []);

  return (
    <div className="app">
      {/* Header */}
      <div className="toolbar">
        <div className="title">AI Trend Dashboard</div>
        <div className="spacer" />
        <div className="kpi">
          <div className="kpi-val">{stats.signals}</div>
          <div className="kpi-lbl">Signals (last run)</div>
        </div>
        <div className="kpi">
          <div className="kpi-val">{stats.keywords}</div>
          <div className="kpi-lbl">Keywords</div>
        </div>
        <div className="kpi">
          <div className="kpi-val">{region}</div>
          <div className="kpi-lbl">Region</div>
        </div>
      </div>

      {/* Controls */}
      <div className="card">
        <div className="row gap">
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="select"
            disabled={isRunning}
          >
            <option>Nordics</option>
            <option>US</option>
            <option>UK</option>
            <option>EU</option>
            <option>All</option>
          </select>
          <button className="btn primary" onClick={runResearch} disabled={isRunning}>
            {isRunning ? 'Running…' : 'Run research'}
          </button>
          {err && <div className="error">{err}</div>}
        </div>

        {/* chips */}
        <div className="chips">
          {keywords.map(k => (
            <div key={k} className="chip">
              <span>{k}</span>
              <button onClick={() => removeKeyword(k)} aria-label="Remove" className="chip-x">×</button>
            </div>
          ))}
        </div>

        {/* add keyword */}
        <div className="row gap">
          <input
            className="input"
            placeholder="Add keyword…"
            value={addText}
            onChange={(e) => setAddText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addKeyword(); }}
            disabled={isRunning}
          />
          <button className="btn" onClick={addKeyword} disabled={isRunning || !addText.trim()}>Add</button>
          <button className="btn ghost" onClick={resetWorking} disabled={isRunning}>Reset working list</button>
          <a className="btn ghost" href="/api/briefs/pdf" target="_blank" rel="noreferrer">Download Brief (PDF)</a>
        </div>
      </div>

      <div className="grid two">
        {/* Top movers */}
        <div className="card">
          <div className="card-head">Top Movers (themes)</div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Theme</th>
                <th>Heat</th>
                <th>Momentum</th>
                <th>Forecast</th>
                <th>Confidence</th>
                <th>A/W/A</th>
                <th>Link</th>
                <th>Sources</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.entity}>
                  <td>{r.entity}</td>
                  <td>{pct(r.heat)}</td>
                  <td>{pct(r.momentum)}</td>
                  <td>{pct(r.forecast)}</td>
                  <td>{pct(r.confidence)}</td>
                  <td>{r.awa}</td>
                  <td>
                    <a href={r.link} target="_blank" rel="noreferrer" className="btn btn-icon" title="Open best link">↗</a>
                  </td>
                  <td>
                    <button className="btn" onClick={() => openSources(r.entity, r.citations || [])}>
                      View sources
                    </button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={8} style={{ opacity: 0.6 }}>—</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Leaders */}
        <div className="card">
          <div className="card-head">Leaders (ranked)</div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Theme</th>
                <th>Provider</th>
                <th>Authority Avg</th>
                <th>Eng</th>
              </tr>
            </thead>
            <tbody>
              {leaders.map((l, i) => (
                <tr key={`${l.theme}-${i}`}>
                  <td>{l.theme}</td>
                  <td>{l.provider}</td>
                  <td>{pct(l.authority)}</td>
                  <td>{pct(l.eng)}</td>
                </tr>
              ))}
              {!leaders.length && (
                <tr><td colSpan={4} style={{ opacity: 0.6 }}>—</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* What’s rising */}
      <div className="card">
        <div className="card-head">What’s rising</div>
        <ul className="bullets">
          {rising.length === 0 && <li>—</li>}
          {rising.map(r => (
            <li key={r.entity}>
              <strong>{r.entity}</strong> · momentum {pct(r.momentum)} · confidence {pct(r.confidence)}
            </li>
          ))}
        </ul>
      </div>

      {/* Why this matters */}
      <div className="card">
        <div className="card-head">Why this matters</div>
        <ul className="bullets">
          {whyBullets.length === 0 && <li>—</li>}
          {whyBullets.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
      </div>

      {/* Sources modal */}
      {sourcesOpen && (
        <div className="modal-backdrop" onClick={closeSources}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">Sources: {sourcesFor.entity}</div>
              <button className="btn btn-icon" onClick={closeSources}>✕</button>
            </div>
            <div className="modal-body">
              {(!sourcesFor.citations || !sourcesFor.citations.length) && (
                <div style={{ opacity: 0.7 }}>No citations available.</div>
              )}
              {sourcesFor.citations?.map((c, i) => (
                <div key={i} className="cite-row">
                  <div className="cite-provider">{c.provider}</div>
                  <div className="cite-title">
                    {c.url ? (
                      <a href={c.url} target="_blank" rel="noreferrer">{c.title || '(untitled)'}</a>
                    ) : (c.title || '(untitled)')}
                  </div>
                  <div className="cite-meta">
                    <span>Auth {(c.authority * 100).toFixed?.(0) || Math.round(c.authority || 0)}%</span>
                    <span>•</span>
                    <span>{new Date(c.when).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <footer className="footer">
        Built with ❤️ — data from YouTube, Reddit, GDELT & Google Trends.
      </footer>
    </div>
  );
}
