import { useState, useEffect } from "react";
import { API_BASE } from "../utils";

export function MatchesSection({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const r = await fetch(`${API_BASE}/recommendations/matches?limit=8`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(typeof d.detail === "string" ? d.detail : "Unable to load matches.");
        if (!cancelled) setData(d);
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const cardSch = (s) => (
    <div key={s._id} className="card" style={{ padding: "18px", marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", color: "var(--brown3)", textTransform: "uppercase" }}>
        Scholarship · {(s.type || "").toUpperCase()}
      </div>
      <div style={{ fontFamily: "var(--serif)", fontSize: 18, color: "var(--brown4)", marginTop: 8 }}>{s.title}</div>
      <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>{s.country}{s.university ? ` · ${s.university}` : ""}</div>
      <p style={{ fontSize: 14, marginTop: 10, lineHeight: 1.55 }}>{s.eligibility}</p>
      {s.apply_url && (
        <a href={s.apply_url} target="_blank" rel="noreferrer"
          style={{ display: "inline-block", marginTop: 12, color: "var(--brown3)", fontWeight: 600, fontSize: 14 }}>
          Apply / details →
        </a>
      )}
    </div>
  );

  const cardInt = (i) => (
    <div key={i._id} className="card" style={{ padding: "18px", marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", color: "var(--brown3)", textTransform: "uppercase" }}>
        Internship
      </div>
      <div style={{ fontFamily: "var(--serif)", fontSize: 18, color: "var(--brown4)", marginTop: 8 }}>{i.title}</div>
      <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
        {i.company} · {i.location} {i.field ? `· ${i.field}` : ""}
      </div>
      {i.apply_url && (
        <a href={i.apply_url} target="_blank" rel="noreferrer"
          style={{ display: "inline-block", marginTop: 12, color: "var(--brown3)", fontWeight: 600, fontSize: 14 }}>
          Apply →
        </a>
      )}
    </div>
  );

  return (
    <div style={{ maxWidth: 920, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "var(--serif)", fontSize: 28, color: "var(--brown4)", marginBottom: 8 }}>Your dashboard</h1>
      <p style={{ color: "var(--muted)", marginBottom: 24, maxWidth: 640, lineHeight: 1.6 }}>
        Scholarships and internships ranked by overlap with your major, destinations, and interests. Refine these from your Profile to improve matches.
      </p>
      {loading && <div style={{ color: "var(--muted)" }}>Loading personalized picks…</div>}
      {error && (
        <div style={{ padding: 14, borderRadius: 10, background: "var(--cream3)", color: "var(--brown4)", fontSize: 14, border: "1px solid rgba(111,78,55,0.15)" }}>
          {error}
        </div>
      )}
      {data?.profile_summary && (
        <div className="card" style={{ padding: "16px 18px", marginBottom: 20, fontSize: 14, color: "var(--muted)" }}>
          Matching on profile:{" "}
          <strong style={{ color: "var(--brown4)" }}>
            {[data.profile_summary.degree, data.profile_summary.major, data.profile_summary.target_country]
              .filter(Boolean)
              .join(" · ") || "Incomplete — edit Profile"}
          </strong>
        </div>
      )}
      {data && !loading && (
        <div style={{ display: "grid", gap: 24, gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <h2 style={{ fontFamily: "var(--serif)", fontSize: 20, color: "var(--brown4)", marginBottom: 12 }}>Scholarships</h2>
            {(data.scholarships || []).length === 0 ? (
              <div style={{ color: "var(--muted)" }}>None in database matching filters — check back after the nightly scrape.</div>
            ) : (
              data.scholarships.map(cardSch)
            )}
          </div>
          <div>
            <h2 style={{ fontFamily: "var(--serif)", fontSize: 20, color: "var(--brown4)", marginBottom: 12 }}>Internships</h2>
            {(data.internships || []).length === 0 ? (
              <div style={{ color: "var(--muted)" }}>No internships with future deadlines yet.</div>
            ) : (
              data.internships.map(cardInt)
            )}
          </div>
        </div>
      )}
    </div>
  );
}
