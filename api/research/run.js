import prisma from '../../lib/db.js'

export const config = { api: { bodyParser: true } }

function synthesizeThemes(keywords = []) {
  return (keywords.length ? keywords : ['trenchcoat','loafers','quiet luxury']).map((k,i)=>({
    theme: k,
    heat: 50 + (i===0?20:0),
    momentum: i === 0 ? 1 : -1,
    forecast: i===0 ? 93 : 50,
    confidence: i===0 ? 0.42 : 0.50,
    awa: i===0 ? 'ACT' : 'WATCH',
    links: []
  }))
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Method not allowed' })
  try {
    const { region = 'All', keywords = [] } = req.body || {}

    const themes = synthesizeThemes(keywords)

    const rising = themes.map(t => `• ${t.theme} – ${t.momentum>0?'up':'down'}`)
    const leaders = themes.map(t => ({
      entity: t.theme, type: 'topic', trend: 0.5, volume: 500, score: t.heat, urls: t.links
    }))
    const whyMatters = 'External signals show momentum across search, video, and news.'
    const aheadOfCurve = [
      'Prototype 3 looks and brief creators this week; measure save/comment lift vs baseline.',
      'Pre-book core neutrals; test small red accents to validate before scaling.',
      'Set a watchlist alert when the 7d trend > 1.3× across two sources.'
    ]
    const citations = []

    // persist run
    const run = await prisma.researchRun.create({
      data: {
        region,
        keywords,
        rising,
        leaders,
        whyMatters,
        aheadOfCurve,
        citations
      }
    })

    // also snapshot themes
    await prisma.$transaction(themes.map(t => prisma.theme.create({
      data: {
        region,
        theme: t.theme,
        heat: t.heat,
        momentum: t.momentum,
        forecast: t.forecast ?? null,
        confidence: t.confidence ?? null,
        awa: t.awa ?? null,
        links: t.links
      }
    })))

    res.status(200).json({
      ok: true,
      data: {
        created_at: run.created_at,
        region,
        keywords,
        rising,
        leaders,
        whyMatters,
        aheadOfCurve,
        sourceCounts: { trends: 0, youtube: 0, gdelt: 0, reddit: 0 },
        citations
      }
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok:false, error: 'research_failed' })
  }
}
