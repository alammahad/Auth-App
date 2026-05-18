import { useState, useEffect } from "react";
import { API_BASE } from "../utils";

export function RecruiterOverview({ token }) {
  const [dash, setDash] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/recruiter/dashboard`, { headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json();
        if (!r.ok) throw new Error(typeof d.detail === "string" ? d.detail : "Unable to load");
        setDash(d);
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [token]);

  const m = dash?.metrics || {};
  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "var(--serif)", fontSize: 30, color: "var(--brown4)", marginBottom: 8 }}>Recruiting overview</h1>
      <p style={{ color: "var(--muted)", marginBottom: 24, maxWidth: 620 }}>
        Talent discovery and pipelines similar to LinkedIn Recruiter: manage job posts and student conversations centrally.
      </p>
      {error && (
        <div style={{ padding: 12, background: "#FCEBE9", color: "#8A2E25", borderRadius: 10 }}>{error}</div>
      )}
      {dash && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16, marginBottom: 28 }}>
            {[
              { label: "Active job postings", val: m.active_job_postings },
              { label: "Total applicants", val: m.total_applicants ?? 0 },
              { label: "New applicants (7 days)", val: m.new_applicants_this_week },
              { label: "Pipeline (reserved)", val: m.shortlisted },
            ].map((box) => (
              <div key={box.label} className="card" style={{ padding: "22px", textAlign: "center" }}>
                <div style={{ fontFamily: "var(--serif)", fontSize: 32, color: "var(--brown4)" }}>{box.val}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>{box.label}</div>
              </div>
            ))}
          </div>
          <div className="card" style={{ padding: 22, marginBottom: 20 }}>
            <div style={{ fontFamily: "var(--serif)", fontSize: 20, color: "var(--brown4)", marginBottom: 10 }}>
              Company card
            </div>
            <div style={{ fontSize: 15, lineHeight: 1.6 }}>
              <div><strong>{dash.company.display_name}</strong></div>
              <div style={{ color: "var(--muted)" }}>{dash.company.industry}{dash.company.recruiter_title ? ` · ${dash.company.recruiter_title}` : ""}</div>
              {(dash.company.hiring_focus || []).length > 0 && (
                <div style={{ marginTop: 10 }}>
                  Hiring focus:{" "}
                  {dash.company.hiring_focus.map((h) => (
                    <span key={h} className="tag" style={{ marginRight: 6, marginTop: 4, display: "inline-block", background: "var(--cream2)", color: "var(--brown3)" }}>
                      {h}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <ul style={{ paddingLeft: 18, fontSize: 14, color: "var(--text)", lineHeight: 1.8 }}>
            {(dash.tips || []).map((t, idx) => (
              <li key={idx}>{t}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
