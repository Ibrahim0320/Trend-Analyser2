import React, { useEffect, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || "";
const API = (p) => `${API_BASE}${p}`;


const H = ({children}) => <h1>{children}</h1>

function ResearchPanel({region}) {
  const [chips, setChips] = useState(["trenchcoat","loafers","quiet luxury"])
  const [input, setInput] = useState("")
  const [watchlist, setWatchlist] = useState([])
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState("")
  const [showCites, setShowCites] = useState(false)
  const [topThemes, setTopThemes] = useState([])

  const addChip = () => { const v=input.trim(); if(v && !chips.includes(v)) setChips([...chips,v]); setInput("") }
  const removeChip = (c) => setChips(chips.filter(x=>x!==c))
  const resetChips = () => setChips([])

  const run = async () => {
    setBusy(true); setNote("Researching…")
    const res = await fetch(API('/api/research/run'), {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({region, keywords: chips})
    })
    if (res.ok) { const d = await res.json(); setData(d.data); setNote(""); fetchTopThemes() }
    else setNote("Research request failed")
    setBusy(false)
  }

  const saveWatchlistAndRerun = async () => {
    setBusy(true); setNote("Saving watchlist…")
    await fetch(API('/api/research/watchlist'), {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({region, keywords: chips})
    })
    await loadWatchlist()
    await run()
    setBusy(false)
  }

  const fetchTopThemes = async () => {
    const r = await fetch(API(`/api/themes/top?region=${encodeURIComponent(region)}&limit=10`))
    if (r.ok) { const d = await r.json(); setTopThemes(d.data || []) }
  }

  const loadWatchlist = async () => {
    const r = await fetch(API(`/api/research/watchlist?region=${encodeURIComponent(region)}`))
    if (r.ok) { const d = await r.json(); setWatchlist(d.keywords || []) }
  }

  const removeFromWatchlist = async (kw) => {
    const r = await fetch(API('/api/research/watchlist'), {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ region, remove: [kw] })
    })
    if (r.ok) { const d = await r.json(); setWatchlist(d.keywords || []) }
  }

  const clearWatchlist = async () => {
    if (!confirm('Clear saved keywords for this region?')) return
    const r = await fetch(API(`/api/research/watchlist?region=${encodeURIComponent(region)}`), { method:'DELETE' })
    if (r.ok) setWatchlist([])
  }

  const downloadBrief = async () => {
    const r = await fetch(API(`/api/briefs/pdf?region=${encodeURIComponent(region)}`))
    if (!r.ok) return
    const blob = await r.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `trend-brief-${region}.pdf`
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
  }

  useEffect(()=>{ fetchTopThemes(); loadWatchlist() }, [region])

  const heatClass = (h) => {
    if (typeof h !== 'number') return 'heat'
    if (h >= 70) return 'heat heat--high'
    if (h >= 40) return 'heat heat--mid'
    return 'heat heat--low'
  }
  const fmtPct = (x) => (x || x===0) ? `${Math.round(x*100)}%` : '—'
  const fmtVol = (x) => (x || x===0) ? (x>=1000?`${Math.round(x/100)/10}k`:Math.round(x)) : '—'

  return (
    <div>
      <div className="card" style={{marginBottom:12}}>
        <div className="label">Research mode</div>
        <div className="sub" style={{marginBottom:8}}>
          AI scans Google Trends, YouTube, and news (GDELT) – optionally Reddit. No scraping.
        </div>

        <div className="sub" style={{marginTop:2, marginBottom:6}}>Working keywords:</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          {chips.map(c=>(
            <span key={c} className="badge">
              {c} <span style={{cursor:'pointer',marginLeft:6}} onClick={()=>removeChip(c)}>×</span>
            </span>
          ))}
        </div>

        <div style={{marginTop:8,display:'flex',gap:8,flexWrap:'wrap'}}>
          <input className="input" value={input} placeholder="Add keyword…"
                 onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'?addChip():null} style={{minWidth:260}}/>
          <button className="button" onClick={addChip}>Add</button>
          <button className="button" onClick={resetChips}>Reset working list</button>
          <button className="button accent" onClick={run} disabled={busy}>{busy?'Running…':'Run research'}</button>
          <button className="button" onClick={saveWatchlistAndRerun} disabled={busy}>Replace saved ← working & Re-run</button>
          <button className="button" onClick={()=>setShowCites(true)} disabled={!data || !data.citations?.length}>Citations</button>
          <button className="button" onClick={downloadBrief}>Download Brief (PDF)</button>
          {note && <div className="small" style={{alignSelf:'center'}}>{note}</div>}
        </div>

        <div className="sub" style={{marginTop:14, marginBottom:6}}>Saved watchlist (server):</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          {watchlist.length ? watchlist.map(kw=>(
            <span key={kw} className="badge">
              {kw} <span title="Remove" style={{cursor:'pointer',marginLeft:6}} onClick={()=>removeFromWatchlist(kw)}>×</span>
            </span>
          )) : <span className="small">— (no saved keywords)</span>}
        </div>
        <div style={{marginTop:8,display:'flex',gap:8}}>
          <button className="button danger" onClick={clearWatchlist} disabled={!watchlist.length}>Clear saved watchlist</button>
        </div>
      </div>

      <div className="card" style={{marginBottom:12}}>
        <h3 style={{marginBottom:8}}>Top Movers (themes)</h3>
        {topThemes?.length ? (
          <div className="card inset">
            <table className="table">
              <thead><tr><th>Theme</th><th>Heat</th><th>Momentum</th><th>Forecast (2w)</th><th>Confidence</th><th>A/W/A</th><th>Link</th></tr></thead>
              <tbody>
                {topThemes.slice(0,10).map((t,i)=>{
                  const conf = typeof t.confidence === 'number' ? `${Math.round(t.confidence*100)}%` : '—'
                  return (
                    <tr key={`${t.theme}-${i}`}>
                      <td>{t.theme}</td>
                      <td><span className={heatClass(t.heat)}>{Math.round(t.heat)}</span></td>
                      <td className={t.momentum>0?'momentum up':'momentum down'}>{t.momentum>0?'↑':'↓'}</td>
                      <td>{typeof t.forecast_heat==='number'?Math.round(t.forecast_heat):'—'}</td>
                      <td>{conf}</td>
                      <td>
                        {t.act_watch_avoid==='ACT' && <span className="badge success">ACT</span>}
                        {t.act_watch_avoid==='WATCH' && <span className="badge warn">WATCH</span>}
                        {t.act_watch_avoid==='AVOID' && <span className="badge danger">AVOID</span>}
                      </td>
                      <td>{t.links?.length ? <a href={t.links[0]} target="_blank" rel="noreferrer">open</a> : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : <div className="small">—</div>}
      </div>

      <div className="card" style={{marginBottom:12}}>
        <h3 style={{marginBottom:8}}>What’s rising</h3>
        { (data?.rising || []).length ? <ul className="ul">{data.rising.map((b,i)=><li key={i} className="li">{b}</li>)}</ul> : <div className="small">—</div>}
      </div>

      <div className="card" style={{marginBottom:12}}>
        <h3 style={{marginBottom:8}}>Leaders (ranked)</h3>
        { (data?.leaders || []).length ? (
          <div className="card inset">
            <table className="table">
              <thead><tr><th>Entity</th><th>Type</th><th>Trend</th><th>Volume</th><th>Score</th><th>Link</th></tr></thead>
              <tbody>
                {data.leaders.slice(0,12).map((l,idx)=>(
                  <tr key={`${l.entity}-${l.type}-${idx}`}>
                    <td>{l.entity}</td><td>{l.type}</td><td>{fmtPct(l.trend)}</td><td>{fmtVol(l.volume)}</td>
                    <td>{l.score ? l.score.toFixed(2) : '—'}</td>
                    <td>{(l.urls && l.urls.length) ? <a href={l.urls[0]} target="_blank" rel="noreferrer">open</a> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="small">—</div>}
      </div>

      <div className="card" style={{marginBottom:12}}>
        <h3 style={{marginBottom:8}}>Why this matters</h3>
        <div>{data?.whyMatters || <span className="small">—</span>}</div>
      </div>

      <div className="card">
        <h3 style={{marginBottom:8}}>Ahead of the curve</h3>
        {!data ? <div className="small">—</div> :
          <ul className="ul">{(data.aheadOfCurve||[]).map((r,i)=><li key={i} className="li">{r}</li>)}</ul>}
      </div>

      {showCites && data &&
        <div className="card" style={{marginTop:12}}>
          <h3 style={{marginBottom:8}}>Citations</h3>
          <ul className="ul">
            {(data.citations||[]).map((c,i)=><li key={i} className="li"><a href={c.url} target="_blank" rel="noreferrer">{c.entity}</a></li>)}
          </ul>
          <div className="small">Top links feeding the current findings.</div>
          <div style={{marginTop:8}}><button className="button" onClick={()=>setShowCites(false)}>Close</button></div>
        </div>}
    </div>
  )
}

function DataPanel(){ return (
  <div className="card"><div className="label">Data mode</div>
    <div className="sub">CSV ingestion to be added on this Vercel build (kept minimal here).</div>
  </div>) }

export default function App() {
  const [mode, setMode] = useState('Research (AI)')
  const [region, setRegion] = useState('Nordics')

  return (
    <div style={{maxWidth:1100,margin:'24px auto',padding:'0 16px'}}>
      <H>AI Trend Dashboard</H>
      <div className="card" style={{display:'flex',gap:8,alignItems:'center',marginBottom:12}}>
        <select className="input" value={mode} onChange={e=>setMode(e.target.value)}>
          <option>Research (AI)</option><option>Data (CSV/API)</option>
        </select>
        <select className="input" value={region} onChange={e=>setRegion(e.target.value)}>
          <option>Nordics</option><option>FR</option><option>All</option>
        </select>
      </div>
      {mode==='Research (AI)' ? <ResearchPanel region={region}/> : <DataPanel/>}
    </div>
  )
}
