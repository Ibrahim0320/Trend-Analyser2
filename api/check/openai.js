export const config = { runtime: 'nodejs' };
export default async function handler(req, res) {
  const hasKey = !!process.env.OPENAI_API_KEY;
  res.status(hasKey ? 200 : 500).json({ ok: hasKey });
}
