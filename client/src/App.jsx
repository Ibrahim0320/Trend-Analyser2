import React, { useEffect, useMemo, useState } from 'react';

const REGIONS = ['Nordics', 'US', 'UK', 'DACH', 'France', 'Italy', 'Spain', 'All'];

function useAsync(fn, deps = []) {
  const [state, set] = useState({ loading: false, error: null, data: null });
  const run = async (...args) => {
    try {
      set({ loading: true, error: null, data: null });
      const data = await fn(...args);
      set({ loading: false, error: null, data });
      return data;
    } catch (err) {
      console.error(err);
      set({ loading: false, error: err, data: null });
      throw err;
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => ({ ...state, run }), [state.loading, state.error, state.data]);
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function Pill({ children, onRemove }) {
  return (
    <span className="pill">
      {children}
      {!!onRemove && (
        <button className="pill-x" title="Remove" onClick={onRemove} aria-label="Remove keyword">
          ×
        </button>
      )}
    </span>
  );
}

function SmallStat({ label, value }) {
  return (
    <div className="stat">
      <div className="stat-v">{value}</div>
      <div className="stat-k">{label}</div>
    </div>
  );
}

export default function App() {
  const [region, setRegion] = useState('Nordics');
  const [input, setInput] = useState('');
  const [working, setWorking] = useState(['trenchcoat', 'loafers', 'quiet luxury']);

  // top movers
  const top = useAsync(async (reg) => {
    const q = new URLSearchParams({ region: reg, limit: '10' }).toString();
    const data = await getJSON(`/api/themes/top?${q}`);
    // expect: { ok: true, data: [...] }
    return Array.isArray(data?.data) ? data.data : [];
  });

  // research runner
  const research = useAsync(async () => {
    const payload = { region, keywords: working };
    const data = await postJSON('/api/research/run', payload);
    return data;
  });

  // hydrate top movers on mount and when region changes
  useEffect(() => {
    top.run(region);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region]);

  const addKeyword = () => {
    const k = input.trim();
    if (!k) return;
    if (!working.includes(k)) setWorking((w) => [...w, k]);
    setInput('');
  };
  const removeKeyword = (k) => setWorking((w) => w.filter((x) => x !== k));
  const resetWorking = () => setWorking([]);

  const onRun = async () => {
    await research.run();
    // refresh “top movers” after the run
    top.run(region);
  };

  return (
    <div className="app">
      {/* top gradient frame */}
      <div className="toolbar">
        <div className="toolbar-left">
          <h1 className="title">AI Trend Dashboard</h1>
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

            <button className="btn primary" onClick={onRun} disabled={research.loading}>
              {research.loading ? 'Running…' : 'Run research'}
            </button>
          </div>
        </div>

        <div className="toolbar-right">
          <SmallStat label="Signals (last run)" value={research.data?.totalSignals ?? '—'} />
          <SmallStat
            label="Keywords"
            value={Array.isArray(research.data?.keywords) ? research.data.keywords.length : working.length}
          />
          <SmallStat label="Region" value={region} />
        </div>
      </div>

      {/* keywords card */}
      <div className="card">
        <div className="row wrap gap">
          {working.map((k) => (
            <Pill key={k} onRemove={() => removeKeyword(k)}>
              {k}
            </Pill>
          ))}
        </div>

        <div className="row gap mt">
          <input
            className="input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Add keyword…"
            onKeyDown={(e) => (e.key === 'Enter' ? addKeyword() : null)}
          />
          <button className="btn" onClick={addKeyword}>
            Add
          </button>
          <button className="btn ghost" onClick={resetWorking} disabled={!working.length}>
            Reset working list
          </button>

          <a className="btn ghost" href="/api/briefs/pdf" target="_blank" rel="noreferrer">
            Download Brief (PDF)
          </a>
        </div>
      </div>

      {/* 2-col content area */}
      <div className="grid">
        {/* left */}
        <div className="col">
          <div className="card">
            <div className="card-h">
              <span>Top Movers (themes)</span>
            </div>

            <div className="tbl">
              <div className="tbl-head">
                <div>Theme</div>
                <div>Heat</div>
                <div>Momentum</div>
                <div>Forecast (2w)</div>
                <div>Confidence</div>
                <div>A/W/A</div>
                <div>Link</div>
              </div>

              <div className="tbl-body">
                {top.loading && (
                  <div className="empty">Loading…</div>
                )}

                {!top.loading && !top.error && top.data?.length === 0 && (
                  <div className="empty">—</div>
                )}

                {!top.loading &&
                  top.data?.map((row) => (
                    <div key={row.entity} className="tbl-row">
                      <div className="b">{row.entity}</div>
                      <div>{Math.round((row.heat ?? 0) * 100) / 100}</div>
                      <div>{Math.round((row.momentum ?? 0) * 100) / 100}</div>
                      <div>{Math.round((row.forecast ?? 0) * 100)}%</div>
                      <div>{Math.round((row.confidence ?? 0) * 100)}%</div>
                      <div>{row.awA ?? 'Aware'}</div>
                      <div>
                        {row.link ? (
                          <a className="link" href={row.link} target="_blank" rel="noreferrer" title="Open">
                            ↗
                          </a>
                        ) : (
                          '—'
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <span>What’s rising</span>
            </div>
            <div className="empty muted">—</div>
          </div>
        </div>

        {/* right */}
        <div className="col">
          <div className="card">
            <div className="card-h">
              <span>Leaders (ranked)</span>
            </div>
            <div className="empty muted">—</div>
          </div>

          <div className="card">
            <div className="card-h">
              <span>Why this matters</span>
            </div>
            <div className="empty muted">—</div>
          </div>
        </div>
      </div>

      <footer className="footer">
        Built with <span className="heart">♥</span> — data from YouTube, GDELT &amp; Google Trends.
      </footer>
    </div>
  );
}
