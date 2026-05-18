import { useState, useEffect } from "react";
import { API_BASE } from "../utils";

export function GuidesSection() {
  const [guide, setGuide] = useState(null);
  const [open, setOpen] = useState({});
  useEffect(() => {
    fetch(`${API_BASE}/guides/degree-attestation`)
      .then((r) => r.json())
      .then(setGuide)
      .catch(() => setGuide(null));
  }, []);

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "var(--serif)", fontSize: 30, color: "var(--brown4)", marginBottom: 12 }}>{guide?.title || "Documentation guide"}</h1>
      {guide?.disclaimer && (
        <div className="card" style={{ padding: "16px 18px", marginBottom: 24, fontSize: 14, lineHeight: 1.65, background: "var(--cream2)", borderLeft: "4px solid var(--brown2)" }}>
          {guide.disclaimer}
        </div>
      )}
      {(guide?.sections || []).map((sec) => (
        <div key={sec.id} className="card" style={{ marginBottom: 16, overflow: "hidden" }}>
          <button type="button" onClick={() => setOpen((o) => ({ ...o, [sec.id]: !o[sec.id] }))}
            style={{
              width: "100%", textAlign: "left", padding: "18px 20px", border: "none", background: "var(--cream)",
              fontFamily: "var(--sans)", fontSize: 16, fontWeight: 600, color: "var(--brown4)", cursor: "pointer",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
            <span>{sec.authority}</span>
            <span>{open[sec.id] ? "−" : "+"}</span>
          </button>
          {open[sec.id] && (
            <div style={{ padding: "16px 20px 20px", borderTop: "1px solid var(--border)" }}>
              <p style={{ fontSize: 14, color: "var(--text)", marginBottom: 14, lineHeight: 1.65 }}>{sec.summary}</p>
              <ol style={{ marginLeft: 18, marginBottom: 12, fontSize: 14, lineHeight: 1.85, color: "var(--text)" }}>
                {(sec.steps || []).map((st, idx) => (
                  <li key={idx}>
                    {(typeof st === "string" ? st : st.detail) || ""}
                  </li>
                ))}
              </ol>
              {(sec.references || []).map((rf, idx) => (
                <div key={idx} style={{ fontSize: 14, marginBottom: 6 }}>
                  <a href={rf.url} target="_blank" rel="noreferrer" style={{ color: "var(--brown3)", fontWeight: 600 }}>
                    {rf.label} →
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
