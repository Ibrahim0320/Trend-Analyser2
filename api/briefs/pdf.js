// api/briefs/pdf.js
// Lightweight PDF (works on Node runtime). No custom fonts.

export const config = { runtime: 'nodejs22.x' };

import PDFDocument from 'pdfkit';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow','GET');
    return res.status(405).end('Method not allowed');
  }
  try {
    // Accept region via query for filename parity with the UI
    const { region = 'All' } = req.query || {};

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="trend-brief-${region}.pdf"`);

    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    doc.pipe(res);

    doc.fontSize(20).text('Trend Brief', { continued: false });
    doc.moveDown(0.25);
    doc.fontSize(12).fillColor('#666').text(`Region: ${region}`);
    doc.moveDown();

    doc.fillColor('#000').fontSize(14).text('This is a minimal placeholder brief.');
    doc.moveDown(0.5);
    doc.fontSize(12).text('Once the full signals and narrative are wired, this PDF will include:');
    doc.moveDown(0.25);
    doc.list([
      'Top Movers with heat, momentum, and forecast',
      'Leaders table with scores and volumes',
      'Curated citations from fashion publications',
      'Short narrative: why this matters & actions',
    ]);

    doc.end();
  } catch (e) {
    console.error('[briefs/pdf] error', e);
    return res.status(500).end('PDF error');
  }
}
