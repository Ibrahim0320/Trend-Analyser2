import PDFDocument from 'pdfkit'
import prisma from '../../lib/db.js'

export const config = { runtime: 'nodejs' }; // <- unversioned here



function bufferFromDoc(doc) {
  return new Promise(resolve => {
    const chunks = []
    doc.on('data', c => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.end()
  })
}

export default async function handler(req, res) {
  const region = req.query.region || 'All'
  const latest = await prisma.researchRun.findFirst({
    where: { region }, orderBy: { created_at: 'desc' }
  })

  const doc = new PDFDocument({ size: 'A4', margin: 36 })
  doc.fontSize(18).text(`Trend Brief – ${region}`, { underline: true })
  doc.moveDown()

  if (!latest) {
    doc.fontSize(12).text('No research run found.')
  } else {
    doc.fontSize(14).text("What’s rising").moveDown(0.5)
    doc.fontSize(11)
    ;(latest.rising || []).forEach(b => doc.text(`• ${b}`))
    doc.moveDown()

    doc.fontSize(14).text("Why this matters").moveDown(0.5)
    doc.fontSize(11).text(latest.whyMatters || '—')
    doc.moveDown()

    doc.fontSize(14).text("Ahead of the curve").moveDown(0.5)
    ;(latest.aheadOfCurve || []).forEach(b => doc.text(`• ${b}`))
  }

  const buf = await bufferFromDoc(doc)
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="trend-brief-${region}.pdf"`)
  res.status(200).send(buf)
}
