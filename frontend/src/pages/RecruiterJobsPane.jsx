import { useState, useEffect } from "react";
import { S } from "../../styles/theme";
import { API_BASE } from "../utils";

export function RecruiterJobsPane({ token, showComposer = true }) {
  const [jobs, setJobs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [applicantsByJob, setApplicantsByJob] = useState({});
  const [loadingApps, setLoadingApps] = useState(null);
  const [reviewing, setReviewing] = useState(null);
  const [reviewMsg, setReviewMsg] = useState({});
  const [form, setForm] = useState({
    title: "",
    description: "",
    employment_type: "Internship",
    location_type: "Hybrid",
    location: "",
    apply_how: "",
    field: "",
    skills: "",
    required_keywords: "",
    preferred_keywords: "",
    minimum_cv_score: "45",
    auto_hide_irrelevant_cvs: true,
    deadline: "",
  });

  const load = async () => {
    const r = await fetch(`${API_BASE}/recruiter/jobs/me`, { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json().catch(() => ({}));
    setJobs(Array.isArray(d.jobs) ? d.jobs : []);
  };

  useEffect(() => {
    load();
  }, [token]);

  const fetchApplicants = async (jobId) => {
    setLoadingApps(jobId);
    try {
      const r = await fetch(`${API_BASE}/recruiter/jobs/${jobId}/applications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof d.detail === "string" ? d.detail : "Unable to load applicants.");
      setApplicantsByJob((prev) => ({ ...prev, [jobId]: d.applications || [] }));
    } catch {
      setApplicantsByJob((prev) => ({ ...prev, [jobId]: [] }));
    } finally {
      setLoadingApps(null);
    }
  };

  const toggleApplicants = (jobId) => {
    if (expanded === jobId) {
      setExpanded(null);
      return;
    }
    setExpanded(jobId);
    if (!applicantsByJob[jobId]) fetchApplicants(jobId);
  };

  const reviewApplication = async (applicationId, status) => {
    setReviewing(applicationId);
    setReviewMsg((prev) => ({ ...prev, [applicationId]: "" }));
    try {
      const r = await fetch(`${API_BASE}/recruiter/applications/${applicationId}/review`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ review_status: status }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof d.detail === "string" ? d.detail : "Review update failed.");
      setReviewMsg((prev) => ({ ...prev, [applicationId]: "Updated." }));
      const jobId = Object.keys(applicantsByJob).find((jobKey) =>
        (applicantsByJob[jobKey] || []).some((app) => app._id === applicationId)
      );
      if (jobId) fetchApplicants(jobId);
    } catch (e) {
      setReviewMsg((prev) => ({ ...prev, [applicationId]: e.message || "Error" }));
    } finally {
      setReviewing(null);
    }
  };

  const submit = async () => {
    setBusy(true);
    setMsg("");
    try {
      const skills_keywords = form.skills
        ? form.skills.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
      const deadline = form.deadline ? new Date(form.deadline).toISOString() : null;
      const required_keywords = form.required_keywords
        ? form.required_keywords.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
      const preferred_keywords = form.preferred_keywords
        ? form.preferred_keywords.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
      const r = await fetch(`${API_BASE}/recruiter/jobs`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          employment_type: form.employment_type,
          location_type: form.location_type,
          location: form.location || null,
          apply_how: form.apply_how,
          field: form.field || null,
          skills_keywords,
          required_keywords,
          preferred_keywords,
          minimum_cv_score: Number(form.minimum_cv_score) || 45,
          auto_hide_irrelevant_cvs: form.auto_hide_irrelevant_cvs,
          deadline,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof d.detail === "string" ? d.detail : "Publish failed.");
      setForm({
        title: "",
        description: "",
        field: "",
        employment_type: "Internship",
        location_type: "Hybrid",
        location: "",
        apply_how: "",
        skills: "",
        required_keywords: "",
        preferred_keywords: "",
        minimum_cv_score: "45",
        auto_hide_irrelevant_cvs: true,
        deadline: "",
      });
      setMsg("Job published.");
      load();
    } catch (e) {
      setMsg(e.message || "Error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!confirm("Remove this posting?")) return;
    await fetch(`${API_BASE}/recruiter/jobs/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    load();
  };

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      {showComposer ? (
        <>
      <h1 style={{ fontFamily: "var(--serif)", fontSize: 28, marginBottom: 8, color: "var(--brown4)" }}>Post internships & jobs</h1>
      <p style={{ color: "var(--muted)", marginBottom: 20 }}>
        Published roles appear to students on <strong>Jobs &amp; apply</strong> and in <strong>Community</strong> when linked. Students submit a PDF CV per role.
      </p>
      <div className="card" style={{ padding: 22, marginBottom: 26 }}>
        {[
          ["Job title", "title", "text"],
          ["Description", "description", "area"],
          ["Field / discipline", "field", "text"],
          ["Employment type", "employment_type", "text"],
          ["Location mode", "location_type", "text"],
          ["Office / region", "location", "text"],
          ["How to apply", "apply_how", "textarea"],
          ["Skills keywords (comma-separated)", "skills", "text"],
          ["Required keywords (comma-separated)", "required_keywords", "text"],
          ["Preferred keywords (comma-separated)", "preferred_keywords", "text"],
          ["Minimum CV score to show", "minimum_cv_score", "number"],
          ["Deadline (optional)", "deadline", "datetime-local"],
        ].map(([label, field, typ]) => (
          <div key={field} style={{ marginBottom: 14 }}>
            <label style={{ ...S.label, display: "block", marginBottom: 6 }}>{label}</label>
            {typ === "textarea" ? (
              <textarea
                rows={4}
                value={form[field]}
                onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                style={{ ...S.input, width: "100%", resize: "vertical", padding: "10px 14px", borderRadius: 10 }}
              />
            ) : (
              <input
                type={typ}
                value={form[field]}
                onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                style={{ ...S.input, width: "100%", padding: "10px 14px", borderRadius: 10 }}
              />
            )}
          </div>
        ))}
        <div style={{ marginBottom: 14 }}>
          <label style={{ ...S.label, display: "block", marginBottom: 6 }}>
            <input
              type="checkbox"
              checked={form.auto_hide_irrelevant_cvs}
              onChange={(e) => setForm((f) => ({ ...f, auto_hide_irrelevant_cvs: e.target.checked }))}
              style={{ marginRight: 8 }}
            />
            Hide irrelevant CVs automatically
          </label>
        </div>
        {msg && (
          <div style={{ marginBottom: 10, fontSize: 13, color: msg.includes("Error") ? "#8A2E25" : "#1A7A4A" }}>{msg}</div>
        )}
        <button type="button" disabled={busy} onClick={submit} className="btn-primary">
          Publish role
        </button>
      </div>
        </>
      ) : null}
      {(jobs || []).map((j) => (
        <div key={j._id} className="card" style={{ padding: 18, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontFamily: "var(--serif)", fontSize: 18, color: "var(--brown4)" }}>{j.title}</div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                {j.employment_type} · {j.location_type}
                {j.location ? ` · ${j.location}` : ""}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--brown3)", marginTop: 6 }}>
                {(j.application_count ?? 0)} student{(j.application_count ?? 0) === 1 ? "" : "s"} applied (SCHLR CV)
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button type="button" className="btn-ghost" style={{ fontSize: 12 }} onClick={() => toggleApplicants(j._id)}>
                {expanded === j._id ? "Hide applicants" : "View applicants"}
              </button>
              <button type="button" className="btn-ghost" style={{ fontSize: 12 }} onClick={() => remove(j._id)}>
                Archive
              </button>
            </div>
          </div>
          <p style={{ fontSize: 14, marginTop: 10, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{j.description}</p>
          <div style={{ fontSize: 13, marginTop: 10, fontWeight: 600, color: "var(--brown3)" }}>
            Apply:{" "}
            <span style={{ fontWeight: 400, wordBreak: "break-all" }}>{j.apply_how}</span>
          </div>
          {expanded === j._id && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              {loadingApps === j._id ? (
                <div style={{ fontSize: 13, color: "var(--muted)" }}>Loading applicants…</div>
              ) : (applicantsByJob[j._id] || []).length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--muted)" }}>No SCHLR applications yet.</div>
              ) : (
                (applicantsByJob[j._id] || []).map((app) => {
                  const a = app.applicant || {};
                  const cv = app.cv_url;
                  return (
                    <div
                      key={app._id}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                        padding: "12px 0",
                        borderBottom: "1px solid var(--cream3)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontWeight: 600, color: "var(--brown4)" }}>{a.name || "Applicant"}</div>
                          <div style={{ fontSize: 13, color: "var(--muted)" }}>{a.email}</div>
                          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Status: {app.status}</div>
                          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Review: {app.review_status || "n/a"}</div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                          {cv ? (
                            <a href={cv} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 600, color: "var(--brown3)" }}>
                              Open CV →
                            </a>
                          ) : (
                            <span style={{ fontSize: 12, color: "var(--muted)" }}>No CV on file</span>
                          )}
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>Score: {app.cv_score ?? "—"}</div>
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>Match: {app.cv_match_status || "—"}</div>
                        </div>
                      </div>
                      {(app.matched_required_keywords || []).length > 0 && (
                        <div style={{ fontSize: 12, color: "var(--brown4)" }}>
                          Matched required: {app.matched_required_keywords.join(", ")}
                        </div>
                      )}
                      {(app.matched_preferred_keywords || []).length > 0 && (
                        <div style={{ fontSize: 12, color: "var(--brown4)" }}>
                          Matched preferred: {app.matched_preferred_keywords.join(", ")}
                        </div>
                      )}
                      {(app.missing_required_keywords || []).length > 0 && (
                        <div style={{ fontSize: 12, color: "#8A2E25" }}>
                          Missing required: {app.missing_required_keywords.join(", ")}
                        </div>
                      )}
                      {(app.cv_analysis?.issues || []).length > 0 && (
                        <div style={{ fontSize: 12, color: "#8A2E25" }}>
                          Issues: {(app.cv_analysis?.issues || []).join("; ")}
                        </div>
                      )}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                        <button
                          type="button"
                          className="btn-ghost"
                          disabled={reviewing === app._id}
                          onClick={() => reviewApplication(app._id, "manual_shortlisted")}
                          style={{ fontSize: 12 }}
                        >
                          Shortlist
                        </button>
                        <button
                          type="button"
                          className="btn-ghost"
                          disabled={reviewing === app._id}
                          onClick={() => reviewApplication(app._id, "needs_review")}
                          style={{ fontSize: 12 }}
                        >
                          Needs Review
                        </button>
                        <button
                          type="button"
                          className="btn-ghost"
                          disabled={reviewing === app._id}
                          onClick={() => reviewApplication(app._id, "manual_rejected")}
                          style={{ fontSize: 12 }}
                        >
                          Reject
                        </button>
                      </div>
                      {reviewMsg[app._id] && (
                        <div style={{ fontSize: 12, color: reviewMsg[app._id].includes("Error") ? "#8A2E25" : "#1A7A4A" }}>
                          {reviewMsg[app._id]}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
