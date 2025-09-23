// /client/src/App.jsx
import React, { useEffect, useMemo, useState } from 'react';
import './styles.css';

const number = (n, d = 0) =>
  typeof n === 'number' && Number.isFinite(n) ? n.toFixed(d) : '—';
const pct = (p) =>
  typeof p === 'number' && Number.isFinite(p) ? `${Math.round(p)}%` : '—';
const compact = (n) =>
  typeof n === 'number' && Number.isFinite(n)
    ? Intl.NumberFormat('en', { notation: 'compact' }).format(n)
    : '—';

export default function App() {
  const [region, setRegion] = useState('Nordics');
  const [working, setWorking] = useState(['trenchcoat', 'loafers', 'quiet luxury']);
  const [addText, setAddText] = useState('');
  const [loading, setLoading] = useState(false);
  const [run, setRun] = useState(null);
  const [leaders, setLeaders] = useState([]);
  const [rising, setRising] = useState([]);
  const [bullets, setBullets] = useState([]);
  const [insightLoading, setInsightLoading] = useState(false);

  const canRun = useMemo(() => working.length > 0 && !loading, [working, loading]);

  const onAdd = () => {
    const v = addText.trim();
    if (!v) return;
    if (!working.includes(v)) setWorking((w) => [...w, v]);
    setAddText('');
  };
  const onRemove = (kw) => setWorking((w) => w.filter((x) => x !== kw));
  const resetWorking = () => setWorking([]);

  async function doRun() {
    setLoading(true);
    setBullets([]);
    try {
      const res = await fetch('/api/research/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ region, keywords: working }),
      });
      const data = await res.json();
      if (!data?.ok) throw new Error('run failed');

      setRun(data);

      // Panels
      const entities = data.entities ?? [];
      // Leaders: rank by (authority*0.55 + engagement*0.45)
      const rows = entities
        .flatMap((e) =>
          (e.top || []).map((s) => ({
            theme: e.entity,
            provider: s.provider || '—',
            authority: s.authority ?? 0,
            engagement: s.engagement ?? 0,
            link:
              s.provider === 'youtube'
                ? `https://www.youtube.com/results?search_query=${encodeURIComponent(e.entity)}`
                : s.provider === 'gdelt'
                ? `https://search.gdeltproject.org/?query=${encodeURIComponent(e.entity)}`
                : `https://trends.google.com/trends/explore?q=${encodeURIComponent(e.entity)}`,
          })),
        )
        .map((r) => ({
          ...r,
          rankScore: 0.55 * r.authority + 0.45 * r.engagement,
        }))
        .filter((r) => r.rankScore > 0.02)
        .sort((a, b) => b.rankScore - a.rankScore)
        .slice(0, 10);

      setLeaders(rows);

      // Rising: fallback score (engagement+authority mix) * recency decay
      const nowTs = Date.now();
      const risingRows = entities
        .flatMap((e) =>
          (e.top || []).map((s) => {
            const t = new Date(s.observedAt || data.now || Date.now()).getTime();
            const ageDays = Math.max(0, (nowTs - t) / (86400e3));
            const base = 0.6 * (s.engagement ?? 0) + 0.4 * (s.authority ?? 0);
            const decay = Math.exp(-ageDays / 7);
            return { theme: e.entity, score: base * decay };
          }),
        )
        .sort((a, b) => b.score - a.score)
        .filter((r) => r.score > 0.02)
        .slice(0, 5);
      setRising(risingRows);

      // Why this matters (OpenAI)
      setInsightLoading(true);
      const brief = await fetch('/api/insight', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ region, entities }),
      }).then((r) => r.json());
      if (brief?.ok && Array.isArray(brief.bullets)) setBullets(brief.bullets);
    } catch (e) {
      console.error(e);
    } finally {
      setInsightLoading(false);
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <div className="toolbar">
        <div className="title">AI Trend Dashboard</div>
        <div className="toolbar-right">
          <select
            className="select"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          >
            <option>Nordics</option>
            <option>US</option>
            <option>UK</option>
            <option>All</option>
          </select>
          <button className="btn primary" disabled={!canRun} onClick={doRun}>
            {loading ? 'Running…' : 'Run research'}
          </button>
          <div className="meta">
            <div className="meta-item">
              <div className="meta-num">{run?.totalSignals ?? 0}</div>
              <div className="meta-label">Signals (last run)</div>
            </div>
            <div className="meta-item">
              <div className="meta-num">{working.length}</div>
              <div className="meta-label">Keywords</div>
            </div>
            <div className="meta-item">
              <div className="meta-num">{region}</div>
              <div className="meta-label">Region</div>
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="pill-row">
          {working.map((kw) => (
            <span key={kw} className="pill">
              {kw}
              <button className="pill-x" onClick={() => onRemove(kw)}>×</button>
            </span>
          ))}
        </div>
        <div className="kw-row">
          <input
            className="input"
            placeholder="Add keyword…"
            value={addText}
            onChange={(e) => setAddText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onAdd()}
          />
          <button className="btn" onClick={onAdd}>Add</button>
          <button className="btn ghost" onClick={resetWorking}>Reset working list</button>
          <a className="btn ghost" href="/api/briefs/pdf" target="_blank" rel="noreferrer">
            Download Brief (PDF)
          </a>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <div className="card-title">Top Movers (themes)</div>
          <table className="tbl">
            <thead>
              <tr>
                <th className="tl">Theme</th>
                <th className="tr">Heat</th>
                <th className="tr">Momentum</th>
                <th className="tr">Forecast (2w)</th>
                <th className="tr">Confidence</th>
                <th className="tr">A/W/A</th>
                <th className="tr">Link</th>
              </tr>
            </thead>
            <tbody>
              {(run?.entities ?? []).map((e) => {
                // demo numbers based on agg to keep table filled
                const heat = Math.min(1, (e.agg?.engagement ?? 0) * 0.8 + (e.agg?.authority ?? 0) * 0.2);
                const forecast = Math.round((0.3 + heat * 0.3) * 100);
                const conf = Math.round((e.agg?.authority ?? 0) * 100);
                const link = `https://www.youtube.com/results?search_query=${encodeURIComponent(e.entity)}`;
                return (
                  <tr key={e.entity}>
                    <td className="tl">{e.entity}</td>
                    <td className="tr">{number(heat, 2)}</td>
                    <td className="tr">{number(0, 2)}</td>
                    <td className="tr">{pct(forecast)}</td>
                    <td className="tr">{pct(conf)}</td>
                    <td className="tr">Aware</td>
                    <td className="tr">
                      <a className="icon-link" href={link} target="_blank" rel="noreferrer">↗</a>
                    </td>
                  </tr>
                );
              })}
              {(!run || (run?.entities ?? []).length === 0) && (
                <tr><td colSpan={7} className="td-empty">—</td></tr>
              )}
            </tbody>
          </table>
          {run?.now && <div className="card-foot">Last run: {new Date(run.now).toLocaleString()}</div>}
        </div>

        <div className="card">
          <div className="card-title">Leaders (ranked)</div>
          <table className="tbl">
            <thead>
              <tr>
                <th className="tl">Theme</th>
                <th className="tl">Provider</th>
                <th className="tr">Authority</th>
                <th className="tr">Avg Eng</th>
              </tr>
            </thead>
            <tbody>
              {leaders.map((r, i) => (
                <tr key={`${r.theme}-${i}`}>
                  <td className="tl">{r.theme}</td>
                  <td className="tl"><span className={`badge ${r.provider}`}>{r.provider}</span></td>
                  <td className="tr">{pct(Math.round((r.authority ?? 0) * 100))}</td>
                  <td className="tr">{pct(Math.round((r.engagement ?? 0) * 100))}</td>
                </tr>
              ))}
              {leaders.length === 0 && <tr><td colSpan={4} className="td-empty">—</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-title">What’s rising</div>
          <ul className="list">
            {rising.map((r, i) => (
              <li key={`${r.theme}-${i}`}>{r.theme}</li>
            ))}
            {rising.length === 0 && <li className="td-empty">—</li>}
          </ul>
        </div>

        <div className="card">
          <div className="card-title">Why this matters</div>
          <div className="bullets">
            {insightLoading && <div className="skeleton lines-3" />}
            {!insightLoading && bullets.map((b, i) => <div key={i} className="bullet">• {b}</div>)}
            {!insightLoading && bullets.length === 0 && <div className="td-empty">—</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
