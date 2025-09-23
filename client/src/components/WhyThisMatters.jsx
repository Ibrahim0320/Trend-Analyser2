// client/src/components/WhyThisMatters.jsx
import React from 'react';

export default function WhyThisMatters({ state }) {
  const { loading, error, bullets } = state || {};

  return (
    <div className="card">
      <div className="card__title">Why this matters</div>

      {loading && <p>Generating brief…</p>}
      {!loading && error && <p className="text-red-400">{error}</p>}

      {!loading && !error && Array.isArray(bullets) && bullets.length > 0 && (
        <ul className="list-disc pl-5 space-y-2">
          {bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}

      {!loading && !error && (!bullets || bullets.length === 0) && <p>—</p>}
    </div>
  );
}
