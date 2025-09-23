import { useEffect, useMemo, useState } from 'react';
import './styles.css';

const DEFAULT_REGION = 'Nordics';
const DEFAULT_KEYWORDS = ['trenchcoat', 'loafers', 'quiet luxury'];

export default function App() {
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [keywords, setKeywords] = useState(DEFAULT_KEYWORDS);
  const [newKeyword, setNewKeyword] = useState('');
  const [busy, setBusy] = useState(false);
  const [topMovers, setTopMovers] = useState([]);

  const qs = useMemo(
    () => new URLSearchParams({ region, limit: '10' }).toString(),
    [region]
  );

  useEffect(() => {
    fetchTopMovers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  async function fetchTopMovers() {
    try {
      const res = await fetch(`/api/themes/top?${qs}`);
      const json = await res.json();
      const raw = Array.isArray(json.data) ? json.data : [];

      const rows = raw.map((it) => {
        const heatPct = Number.isFinite(it.heatPct)
          ? it.heatPct
          : Math.round((Number(it.heat) || 0) * 100);

        const forecastPct = Number.isFinite(it.forecastPct)
          ? it.forecastPct
          : Math.round((Number(it.forecast) || 0) * 100);

        const confidencePct = Number.isFinite(it.confidencePct)
          ? it.confidencePct
          : Math.round((Number(it.confidence) || 0) * 100);

        const momentumPct = Number.isFinite(it.momentumPct)
          ? it.momentumPct
          : Math.round((Number(it.momentum) || 0) * 100);

        const momentumSign =
          it.momentumSign ||
          (momentumPct > 0 ? 'up' : momentumPct < 0 ? 'down' : 'flat');

        return {
          theme: it.theme || it.entity || '',
          heatPct,
          forecastPct,
          confidencePct,
          momentumPct,
          momentumSign,
          awa: it.awa || 'Aware',
          url: it.url || it.link || null,
        };
      });

      setTopMovers(rows);
    } catch (e) {
      console.error('fetchTopMovers failed', e);
      setTopMovers([]);
    }
  }

  async function runResearch() {
    setBusy(true);
    try {
      await fetch('/api/research/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ region, keywords }),
      }).then((r) => r.json().catch(() => ({})));

      await fetchTopMovers();
    } catch (e) {
      console.error('runResearch failed', e);
    } finally {
      setBusy(false);
    }
  }

  function addKeyword() {
    const k = newKeyword.trim();
    if (!k || keywords.includes(k)) return;
    setKeywords([...keywords, k]);
    setNewKeyword('');
  }

  function removeKeyword(word) {
    setKeywords(keywords.filter((k) => k !== word));
  }

  return (
    <div className="page">
      <header className="hdr">
        <h1>AI Trend Dashboard</h1>

        <div className="controls">
          <div className="row">
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="select"
              aria-label="Region"
            >
              <option>Nordics</option>
              <option>All</option>
              <option>US</option>
              <option>EU</option>
            </select>

            <button className="btn" disabled={busy} onClick={runResearch}>
              {busy ? 'Running…' : 'Run research'}
            </button>
          </div>

          <div className="row">
            <div className="keywords">
              {keywords.map((k) => (
                <span key={k} className="chip">
                  {k}
                  <button
                    className="x"
                    onClick={() => removeKeyword(k)}
                    title="Remove"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="addkw">
              <input
                className="input"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="Add keyword…"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addKeyword();
                }}
              />
              <button className="btn" onClick={addKeyword}>
                Add
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="grid">
        <section className="card">
          <h2>Top Movers (themes)</h2>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Theme</th>
                  <th>Heat</th>
                  <th>Momentum</th>
                  <th>Forecast (2w)</th>
                  <th>Confidence</th>
                  <th>A/W/A</th>
                  <th>Link</th>
                </tr>
              </thead>
              <tbody>
                {topMovers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="muted">
                      —
                    </td>
                  </tr>
                )}
                {topMovers.map((r, i) => (
                  <tr key={`${r.theme}-${i}`}>
                    <td>{r.theme || '—'}</td>
                    <td>
                      <span className="pill">
                        {Number.isFinite(r.heatPct) ? r.heatPct : 0}
                      </span>
                    </td>
                    <td className="mono">
                      <span className={`arrow ${r.momentumSign}`} aria-hidden />
                      {Number.isFinite(r.momentumPct) ? r.momentumPct : 0}
                    </td>
                    <td>
                      {Number.isFinite(r.forecastPct)
                        ? `${r.forecastPct}%`
                        : '—'}
                    </td>
                    <td>
                      {Number.isFinite(r.confidencePct)
                        ? `${r.confidencePct}%`
                        : '—'}
                    </td>
                    <td>{r.awa || '—'}</td>
                    <td>
                      {r.url ? (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noreferrer"
                          title="Open"
                        >
                          ↗
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <h2>What’s rising</h2>
          <div className="muted">—</div>
        </section>
        <section className="card">
          <h2>Leaders (ranked)</h2>
          <div className="muted">—</div>
        </section>
        <section className="card">
          <h2>Why this matters</h2>
          <div className="muted">—</div>
        </section>
        <section className="card">
          <h2>Ahead of the curve</h2>
          <div className="muted">—</div>
        </section>
      </main>
    </div>
  );
}
