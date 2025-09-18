// api/health.js
export const config = { runtime: 'nodejs22.x' };
export default async function handler(_req, res) {
  res.status(200).json({ ok: true, ts: new Date().toISOString() });
}
