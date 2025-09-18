import prisma from '../../lib/db.js'

export default async function handler(req, res) {
  const region = req.query.region || 'All'
  const limit = Math.min(Number(req.query.limit || 10), 25)

  try {
    const themes = await prisma.theme.findMany({
      where: { region },
      orderBy: [{ created_at: 'desc' }, { heat: 'desc' }],
      take: limit
    })

    const data = themes.map(t => ({
      theme: t.theme,
      heat: t.heat,
      momentum: t.momentum,
      forecast_heat: t.forecast ?? null,
      confidence: t.confidence ?? null,
      act_watch_avoid: t.awa ?? null,
      links: t.links
    }))

    res.status(200).json({ ok:true, data })
  } catch (e) {
    console.error(e)
    res.status(500).json({ ok:false, data: [] })
  }
}
