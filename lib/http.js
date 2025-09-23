// /lib/http.js
// Small fetch helpers: timeout + retry + JSON guard

export function withTimeout(ms, signal) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(new Error('timeout')), ms);
  // chain cancel
  if (signal) signal.addEventListener('abort', () => ctrl.abort(signal.reason));
  return { signal: ctrl.signal, clear: () => clearTimeout(id) };
}

export async function fetchJson(url, opts = {}, { timeoutMs = 5000, retries = 1 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const { signal, clear } = withTimeout(timeoutMs, opts?.signal);
    try {
      const res = await fetch(url, { ...opts, signal });
      clear();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ct = res.headers.get('content-type') || '';
      return ct.includes('json') ? res.json() : res.text();
    } catch (err) {
      lastErr = err;
      if (attempt === retries) break;
      await new Promise(r => setTimeout(r, 200 + Math.random() * 400));
    }
  }
  throw lastErr;
}

export async function safe(promise, fallback = []) {
  try {
    const v = await promise;
    return Array.isArray(v) || typeof v === 'object' ? v : fallback;
  } catch {
    return fallback;
  }
}
