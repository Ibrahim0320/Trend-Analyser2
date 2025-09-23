// client/src/App.jsx
import React, { useMemo, useState } from 'react';
import { runResearch, fetchInsight } from './api';
import WhyThisMatters from './components/WhyThisMatters';
import './styles.css';

export default function App() {
  const [region, setRegion] = useState('Nordics');
  const [input, setInput] = useState('');
  const [keywords, setKeywords] = useState(['trenchcoat', 'loafers', 'quiet luxury']);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // research results state
  const [entities, setEntities] = useState([]); // [{ entity, top: [...], agg: { engagement, authority }, ... }]
  const [totalSignals, setTotalSignals] = useState(0);

  // insights state
  const [insight, setInsight] = useState({ loading: false, error: null, bullets: [] });

  function addKeyword() {
    const k = input.trim();
    if (!k) return;
    if (!keywords.includes(k)) setKeywords(prev => [...prev, k]);
    setInput('');
  }

  function removeKeyword(k) {
    setKeywords(prev => prev.filter(x => x !== k));
  }

  async function handleRunResearch() {
    setLoading(true);
    setError(null);
    setEntities([]);
    setTotalSignals(0);
    setInsight({ loading: false, error: null, bullets: [] }); // reset brief

    try {
      const data = await runResearch({ region, keywords });
      // expects: { ok, region, keywords, totalSignals, entities: [{ entity, top: [...], agg: { engagement, authority } }] }
      if (!data?.ok) throw new Error(data?.error || 'Run failed');
      setEntities(data.entities || []);
      setTotalSignals(Number(data.totalSignals || 0));

      // Build top-3 payload for insights (engagement/authority only)
      const topForInsight = (data.entities || [])
        .slice(0, 3)
        .map(e => ({
          entity: e.entity,
          agg: {
            engagement: Number(e.agg?.engagement ?? 0),
            authority: Number(e.agg?.authority ?? 0),
          },
        }))
        // filter empty agg
        .filter(x => x.entity && (x.agg.engagement > 0 || x.agg.authority > 0));

      if (topForInsight.length === 0) {
        setInsight({ loading: false, error: null, bullets: [] });
      } else {
        // Fire-and-show: fetch insight after tables render for perceived snappiness
        setInsight({ loading: true, error: null, bullets: [] });
        try {
          const brief = await fetchInsight({ region: data.region || region, entities: topForInsight });
          if (!brief?.ok) throw new Error(brief?.error || 'Insight failed');
          setInsight({ loading: false, error: null, bullets: brief.bullets || [] });
        } catch (err) {
          setInsight({ loading: false, error: 'Could not generate insights right now.', bullets: [] });
        }
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  const movers = useMemo(() => {
    // Flatten entity aggregates into a compact view for the table
    return (entities || []).map(e => ({
      theme: e.entity,
      heat: Number(e.avgScore ?? e.agg?.engagement ?? 0),
      momentum: Number(e.momentum ?? 0),
      forecast: Math.round((e.forecast ?? (e.agg?.engagement ?? 0) * 100)),
      confidence: Math.round((e.confidence ?? (e.agg?.authority ?? 0)) * 100),
      link: `https://www.youtube.com/results?search_query=${encodeURIComponent(e.entity)}`,
    }));
  }, [entities]);

  return (
    <div className="app">
      <div className="toolbar">
        <div className="toolbar-left">
          <span className="brand">AI Trend Dashboard</span>
        </div>

        <div className="toolbar-right">
          <select value={region} onChange={e => setRegion(e.target.value)} className="select">
            <option>Nordics</option>
            <option>US</option>
            <option>UK</option>
            <option>EU</option>
            <option>Global</option>
          </select>

          <button className="btn primary" onClick={handleRunResearch} disabled={loading}>
            {loading ? 'Running…' : 'Run research'}
          </button>

          <div className="stats">
            <div className="stat">
              <div className="stat-num">{totalSignals}</div>
              <div className="stat-label">Signals (last run)</div>
            </div>
            <div className="stat">
              <div className="stat-num">{keywords.length}</div>
              <div className="stat-label">Keywords</div>
            </div>
            <div className="stat">
              <div className="stat-num">{region}</div>
              <div className="stat-label">Region</div>
            </div>
          </div>
        </div>
      </div>

      {/* Keyword chips + add box */}
      <div className="card">
        <div className="chip-row">
          {keywords.map(k => (
            <span key={k} className="chip">
              {k}
              <button className="chip-x" onClick={() => removeKeyword(k)}>×</button>
            </span>
          ))}
        </div>

        <div className="chip-actions">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Add keyword…"
            className="input"
            onKeyDown={e => {
              if (e.key === 'Enter') addKeyword();
            }}
          />
          <button className="btn" onClick={addKeyword}>Add</button>
          <button className="btn subtle" onClick={() => setKeywords([])}>Reset working list</button>
          <a className="btn outline" href="/api/briefs/pdf" rel="noreferrer">Download Brief (PDF)</a>
        </div>
      </div>

      {error && <div className="card text-red-400">Error: {error}</div>}

      <div className="grid">
        {/* Top Movers */}
        <div className="card">
          <div className="card__title">Top Movers (themes)</div>
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
              {movers.length === 0 && (
                <div className="tbl-empty">—</div>
              )}
              {movers.map((m) => (
                <div className="tbl-row" key={m.theme}>
                  <div>{m.theme}</div>
                  <div>{Number.isFinite(m.heat) ? m.heat.toFixed(2) : '0.00'}</div>
                  <div>{Number.isFinite(m.momentum) ? m.momentum.toFixed(2) : '0.00'}</div>
                  <div>{Number.isFinite(m.forecast) ? `${m.forecast}%` : '—'}</div>
                  <div>{Number.isFinite(m.confidence) ? `${m.confidence}%` : '—'}</div>
                  <div>Aware</div>
                  <div>
                    <a href={m.link} target="_blank" rel="noreferrer" title="Open source search">
                      ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Leaders (ranked) – placeholder uses entities; refine as you like */}
        <div className="card">
          <div className="card__title">Leaders (ranked)</div>
          <div className="tbl">
            <div className="tbl-head">
              <div>Theme</div>
              <div>Provider</div>
              <div>Authority</div>
              <div>Avg Eng</div>
            </div>
            <div className="tbl-body">
              {(entities || []).length === 0 && <div className="tbl-empty">—</div>}
              {(entities || []).slice(0, 8).map(e => (
                <div className="tbl-row" key={e.entity}>
                  <div>{e.entity}</div>
                  <div>{(e.top?.[0]?.provider || 'gdelt')}</div>
                  <div>{Math.round((e.agg?.authority ?? 0) * 100)}%</div>
                  <div>{Math.round((e.agg?.engagement ?? 0) * 100)}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* What's rising – you can later feed this from velocity signals */}
        <div className="card">
          <div className="card__title">What’s rising</div>
          <div>—</div>
        </div>

        {/* Why this matters – driven by /api/insight */}
        <WhyThisMatters state={insight} />
      </div>

      <footer className="footer">
        Built with ❤️ — data from YouTube, GDELT & Google Trends.
      </footer>
    </div>
  );
}
