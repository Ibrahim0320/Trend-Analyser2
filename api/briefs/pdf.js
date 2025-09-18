// api/briefs/pdf.js
// Minimal placeholder so the "Download Brief (PDF)" button works.
// Returns a tiny PDF with the timestamp and region; we’ll replace with the
// real styled brief once sources are live.

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).send('Method not allowed');
  }
  try {
    const region = String(req.query.region || 'All');
    const text = `Trend Brief — ${region}\nGenerated at ${new Date().toISOString()}`;
    const pdf = makeSimplePDF(text);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="trend-brief-${region}.pdf"`);
    return res.status(200).send(Buffer.from(pdf));
  } catch (e) {
    console.error('[briefs/pdf] error', e);
    return res.status(500).send('Internal error');
  }
}

// super tiny PDF writer (no deps)
function makeSimplePDF(txt) {
  // This is a barebones one-page PDF with your text (ASCII).
  const body = `%PDF-1.4
1 0 obj<<>>endobj
2 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj
3 0 obj<< /Length 44 >>stream
BT /F1 12 Tf 50 750 Td (${escapePDF(txt)}) Tj ET
endstream endobj
4 0 obj<< /Type /Page /Parent 5 0 R /MediaBox [0 0 612 792] /Contents 3 0 R /Resources<< /Font<< /F1 2 0 R >> >> >>endobj
5 0 obj<< /Type /Pages /Count 1 /Kids [4 0 R] >>endobj
6 0 obj<< /Type /Catalog /Pages 5 0 R >>endobj
xref
0 7
0000000000 65535 f 
0000000010 00000 n 
0000000053 00000 n 
0000000114 00000 n 
0000000221 00000 n 
0000000361 00000 n 
0000000423 00000 n 
trailer<< /Size 7 /Root 6 0 R >>
startxref
486
%%EOF`;
  return body;
}
function escapePDF(s){ return String(s).replace(/[\\()]/g, m => '\\' + m); }
