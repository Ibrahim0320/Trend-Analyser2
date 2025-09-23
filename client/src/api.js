// client/src/api.js
// Small helpers for fetch with JSON and our two API routes.

export async function postJSON(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  // Try to parse response even for non-2xx to surface API errors
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export async function runResearch({ region, keywords }) {
  return postJSON('/api/research/run', { region, keywords });
}

export async function fetchInsight({ region, entities }) {
  // entities: [{ entity: 'trenchcoat', agg: { engagement: 0.05, authority: 0.7 } }, ...]
  return postJSON('/api/insight', { region, entities });
}
