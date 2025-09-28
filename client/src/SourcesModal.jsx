import React from "react";

const fmtInt = (n) => (Number.isFinite(n) ? n.toLocaleString() : "—");
const fmtPct = (v) => (v === null || v === undefined ? "—" : `${Math.round(v * 100)}%`);

export default function SourcesModal({ open, onClose, theme, citations }) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div className="modal__title">Sources for “{theme}”</div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        {(!citations || citations.length === 0) && (
          <div className="empty">No source links returned for this item.</div>
        )}

        {citations && citations.length > 0 && (
          <div className="tbl tbl--dense">
            <div className="tbl__row tbl__head" style={{ gridTemplateColumns: "1.1fr .9fr .6fr .6fr .6fr" }}>
              <div className="tbl__cell tbl__headcell">Title</div>
              <div className="tbl__cell tbl__headcell">Provider</div>
              <div className="tbl__cell tbl__headcell tbl__cell--num">Authority</div>
              <div className="tbl__cell tbl__headcell tbl__cell--num">Eng</div>
              <div className="tbl__cell tbl__headcell tbl__cell--num">When</div>
            </div>
            {citations.map((c, i) => (
              <div key={i} className="tbl__row" style={{ gridTemplateColumns: "1.1fr .9fr .6fr .6fr .6fr" }}>
                <div className="tbl__cell">
                  {c.url ? (
                    <a href={c.url} target="_blank" rel="noreferrer" className="link">{c.title || c.provider}</a>
                  ) : (
                    <span>{c.title || c.provider}</span>
                  )}
                </div>
                <div className="tbl__cell">{c.provider}</div>
                <div className="tbl__cell tbl__cell--num">{fmtPct(c.authority)}</div>
                <div className="tbl__cell tbl__cell--num">{fmtPct(c.eng ?? 0)}</div>
                <div className="tbl__cell tbl__cell--num">
                  {c.when ? new Date(c.when).toLocaleDateString() : "—"}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="caption" style={{ marginTop: 10 }}>
          Tip: Open a few links to validate the trend quality (recency, creator authority, engagement pattern).
        </div>
      </div>
    </div>
  );
}
