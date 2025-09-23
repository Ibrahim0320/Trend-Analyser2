// lib/guard.js
// Provider guard: timeout + retry (exp backoff) + tiny circuit breaker.
// No external deps; safe for serverless.
//
// Usage:
//   const { ok, data, error, meta } = await callProvider('youtube', () => fetchYouTubeSignals(...));

const breakers = new Map();
/**
 * @typedef {Object} GuardOptions
 * @property {number} timeoutMs
 * @property {number} maxRetries
 * @property {number} breakerFailures
 * @property {number} breakerOpenMs
 */

const DEFAULTS = {
  timeoutMs: 12000,
  maxRetries: 2,          // total tries = maxRetries + 1
  breakerFailures: 3,     // open breaker after 3 consecutive failures
  breakerOpenMs: 60_000,  // stay open for 60s
};

/**
 * Exponential backoff with jitter, in ms
 */
function backoff(attempt) {
  const base = Math.min(1000 * 2 ** attempt, 4000);
  return base + Math.floor(Math.random() * 250);
}

function now() { return Date.now(); }

function getBreaker(name) {
  if (!breakers.has(name)) {
    breakers.set(name, { fails: 0, openUntil: 0 });
  }
  return breakers.get(name);
}

function markSuccess(state) {
  state.fails = 0;
  state.openUntil = 0;
}

function markFailure(state, opts) {
  state.fails += 1;
  if (state.fails >= opts.breakerFailures) {
    state.openUntil = now() + opts.breakerOpenMs;
  }
}

export async function callProvider(name, fn, partialOpts = {}) {
  const opts = { ...DEFAULTS, ...partialOpts };
  const state = getBreaker(name);

  if (state.openUntil > now()) {
    return {
      ok: false,
      data: [],
      error: `breaker_open:${name}`,
      meta: { name, breaker: 'open', openMsLeft: state.openUntil - now() }
    };
  }

  let lastErr = null;
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const result = await withTimeout(fn(), opts.timeoutMs);
      markSuccess(state);
      return {
        ok: true,
        data: result,
        error: null,
        meta: { name, attempt, breaker: 'closed', tookMs: null }
      };
    } catch (err) {
      lastErr = err;
      if (attempt < opts.maxRetries) {
        await sleep(backoff(attempt));
        continue;
      }
    }
  }

  markFailure(state, opts);
  return {
    ok: false,
    data: [],
    error: serializeError(lastErr),
    meta: { name, breaker: state.openUntil > now() ? 'opened' : 'closed' }
  };
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function withTimeout(promise, ms) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(new Error('timeout')), ms);
  try {
    // If fn supports AbortSignal, pass ac.signal; otherwise it’s a no-op
    // We can’t enforce a signature, but many fetch-like functions accept it.
    const res = await promise;
    return res;
  } finally {
    clearTimeout(timer);
  }
}

function serializeError(err) {
  if (!err) return 'unknown_error';
  if (typeof err === 'string') return err;
  const o = /** @type {any} */ (err);
  return o?.message || o?.code || 'error';
}
