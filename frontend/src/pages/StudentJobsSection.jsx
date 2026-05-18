import { useState, useEffect, useCallback } from "react";
import { API_BASE } from "../utils";

export function StudentJobsSection({ user, token, onUserRefresh }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState({});
  const [busyId, setBusyId] = useState(null);

  const auth = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`${API_BASE}/jobs/public?limit=40`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof d.detail === "string" ? d.detail : "Could not load jobs.");
      setItems(Array.isArray(d.items) ? d.items : []);
    } catch (e) {
      setError(e.message || "Failed to load.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const uploadCvAndApply = async (jobId) => {
    setBusyId(jobId);
    setMsg((m) => ({ ...m, [jobId]: "" }));
    try {
      let cvUrl = (user.cvUrl || "").trim();
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/pdf,.pdf";
      const picked = await new Promise((resolve) => {
        input.onchange = () => resolve(input.files?.[0] || null);
        input.click();
      });
      if (picked) {
        const fd = new FormData();
        fd.append("file", picked);
        const up = await fetch(`${API_BASE}/upload/document?folder=cvs`, {
          method: "POST",
          headers: auth,
          body: fd,
        });
        const upData = await up.json().catch(() => ({}));
        if (!up.ok) throw new Error(typeof upData.detail === "string" ? upData.detail : "CV upload failed.");
        cvUrl = upData.url;
        await fetch(`${API_BASE}/users/${user.id}`, {
          method: "PUT",
          headers: { ...auth, "Content-Type": "application/json" },
          body: JSON.stringify({
            profile: { cv_url: cvUrl },
          }),
        });
        onUserRefresh?.();
      }
      if (!cvUrl) {
        throw new Error("Add a PDF résumé on your profile or pick a file when applying.");
      }
      const body = {
        item_id: jobId,
        item_type: "job_posting",
        status: "applied",
        cv_url: cvUrl,
        notes: "Applied via SCHLR",
      };
      const r = await fetch(`${API_BASE}/applications`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Application failed.");
      setMsg((m) => ({ ...m, [jobId]: "Application submitted." }));
    } catch (e) {
      setMsg((m) => ({ ...m, [jobId]: e.message || "Error" }));
    } finally {
      setBusyId(null);
    }
  };

  const applyWithSavedCv = async (jobId) => {
    const cvUrl = (user.cvUrl || "").trim();
    if (!cvUrl) {
      await uploadCvAndApply(jobId);
      return;
    }
    setBusyId(jobId);
    setMsg((m) => ({ ...m, [jobId]: "" }));
    try {
      const r = await fetch(`${API_BASE}/applications`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: jobId,
          item_type: "job_posting",
          status: "applied",
          cv_url: cvUrl,
          notes: "Applied via SCHLR",
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Application failed.");
      setMsg((m) => ({ ...m, [jobId]: "Application submitted." }));
    } catch (e) {
      setMsg((m) => ({ ...m, [jobId]: e.message || "Error" }));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "var(--muted)", fontFamily: "var(--sans)" }}>
        Loading opportunities…
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 880, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "var(--serif)", fontSize: 28, color: "var(--brown4)", marginBottom: 8 }}>
        Jobs & internships from recruiters
      </h1>
      <p style={{ color: "var(--muted)", marginBottom: 24, lineHeight: 1.6 }}>
        Apply with your CV (PDF). You can store a default résumé on your profile, or upload a new file when you apply.
      </p>
      {error && (
        <div style={{ padding: 14, borderRadius: 10, background: "#FCEBE9", color: "#8A2E25", marginBottom: 16 }}>{error}</div>
      )}
      {(items || []).length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
          No active postings yet. Check back soon.
        </div>
      ) : (
        (items || []).map((j) => (
          <div key={j._id} className="card" style={{ padding: 22, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", color: "var(--brown3)", textTransform: "uppercase" }}>
              {j.employment_type || "Role"} · {j.location_type || "On-site"}
              {j.location ? ` · ${j.location}` : ""}
            </div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 22, color: "var(--brown4)", marginTop: 10 }}>{j.title}</div>
            <div style={{ fontSize: 14, color: "var(--muted)", marginTop: 6 }}>
              {j.company_name || "Company"}
            </div>
            <p style={{ fontSize: 15, lineHeight: 1.65, marginTop: 14, whiteSpace: "pre-wrap" }}>{j.description}</p>
            {(j.skills_keywords || []).length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                {j.skills_keywords.map((s) => (
                  <span key={s} className="tag" style={{ background: "var(--cream2)", color: "var(--brown3)", padding: "4px 12px", fontSize: 12 }}>
                    {s}
                  </span>
                ))}
              </div>
            )}
            <div style={{ fontSize: 13, marginTop: 16, color: "var(--brown3)" }}>
              <strong>How to apply (direct):</strong>{" "}
              <span style={{ wordBreak: "break-all", fontWeight: 400 }}>{j.apply_how}</span>
            </div>
            <div style={{ marginTop: 18, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <button
                type="button"
                disabled={busyId === j._id}
                className="btn-primary"
                onClick={() => applyWithSavedCv(j._id)}
                style={{ opacity: busyId === j._id ? 0.7 : 1 }}
              >
                {busyId === j._id ? "Submitting…" : "Submit application (CV)"}
              </button>
              <button type="button" className="btn-ghost" disabled={busyId === j._id} onClick={() => uploadCvAndApply(j._id)}>
                Upload different CV & apply
              </button>
            </div>
            {msg[j._id] && (
              <div
                style={{
                  marginTop: 12,
                  fontSize: 13,
                  color: msg[j._id].includes("Error") || msg[j._id].includes("failed") ? "#8A2E25" : "#1A7A4A",
                }}
              >
                {msg[j._id]}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
