import prisma from '../../lib/db.js'

export const config = { api: { bodyParser: true } }

export default async function handler(req, res) {
  const region = (req.query.region || req.body?.region || 'All')

  try {
    if (req.method === 'GET') {
      const wl = await prisma.watchlist.findUnique({ where: { region } })
      return res.status(200).json({ region, keywords: (wl?.keywords ?? []) })
    }

    if (req.method === 'POST') {
      const { keywords = [] } = req.body || {}
      const wl = await prisma.watchlist.upsert({
        where: { region },
        update: { keywords, updated_at: new Date() },
        create: { region, keywords }
      })
      return res.status(200).json({ region, keywords: wl.keywords })
    }

    if (req.method === 'PATCH') {
      const remove = req.body?.remove ?? []
      const wl = await prisma.watchlist.findUnique({ where: { region } })
      const next = (wl?.keywords ?? []).filter(k => !remove.includes(k))
      const updated = await prisma.watchlist.upsert({
        where: { region },
        update: { keywords: next, updated_at: new Date() },
        create: { region, keywords: next }
      })
      return res.status(200).json({ region, keywords: updated.keywords })
    }

    if (req.method === 'DELETE') {
      await prisma.watchlist.delete({ where: { region } }).catch(()=>{})
      return res.status(200).json({ region, keywords: [] })
    }

    res.status(405).json({ ok:false, error:'Method not allowed' })
  } catch (e) {
    console.error(e)
    res.status(500).json({ ok:false, error:'watchlist_failed' })
  }
}
