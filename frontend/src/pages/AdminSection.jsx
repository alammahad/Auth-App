import { useState, useEffect } from "react";
import { API_BASE } from "../utils";

export function AdminSection({ token }) {
  const [pendingRecruiters, setPendingRecruiters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const fetchPending = async () => {
    setLoading(true);
    setError("");

    try {
      const resp = await fetch(`${API_BASE}/admin/recruiters/pending`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.detail || "Failed to fetch pending recruiters");
      }

      setPendingRecruiters(Array.isArray(data.recruiters) ? data.recruiters : []);
    } catch (err) {
      setError(err.message || "Failed to fetch pending recruiters");
      setPendingRecruiters([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchPending();
    }
  }, [token]);

  const handleAction = async (recruiterId, action) => {
    if (!recruiterId) return;

    setMessage("");
    setError("");
    setActionLoading(`${action}-${recruiterId}`);

    try {
      const resp = await fetch(`${API_BASE}/admin/recruiters/${recruiterId}/${action}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.detail || `Failed to ${action} recruiter`);
      }

      setMessage(`Recruiter ${action === "approve" ? "approved" : "rejected"} successfully.`);
      await fetchPending();
    } catch (err) {
      setError(err.message || `Failed to ${action} recruiter`);
    } finally {
      setActionLoading("");
    }
  };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <h1
        style={{
          fontFamily: "var(--serif)",
          fontSize: 30,
          color: "var(--brown4)",
          marginBottom: 8,
        }}
      >
        Admin Panel
      </h1>

      <p style={{ color: "var(--muted)", marginBottom: 24 }}>
        Review and verify recruiter accounts to maintain the quality of the SCHLR community.
      </p>

      {message && (
        <div
          style={{
            padding: 14,
            borderRadius: 10,
            background: "var(--cream2)",
            color: "var(--brown4)",
            fontSize: 14,
            marginBottom: 20,
            border: "1px solid rgba(111,78,55,0.12)",
          }}
        >
          {message}
        </div>
      )}

      {error && (
        <div
          style={{
            padding: 14,
            borderRadius: 10,
            background: "var(--cream3)",
            color: "var(--brown4)",
            fontSize: 14,
            marginBottom: 20,
            border: "1px solid rgba(111,78,55,0.15)",
          }}
        >
          {error}
        </div>
      )}

      <div className="card" style={{ padding: 24 }}>
        <h2
          style={{
            fontFamily: "var(--serif)",
            fontSize: 20,
            color: "var(--brown4)",
            marginBottom: 16,
          }}
        >
          Pending Recruiters
        </h2>

        {loading ? (
          <div style={{ color: "var(--muted)" }}>Loading pending recruiters...</div>
        ) : pendingRecruiters.length === 0 ? (
          <div style={{ color: "var(--muted)", textAlign: "center", padding: 40 }}>
            No pending recruiters at the moment.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {pendingRecruiters.map((rec) => {
              const recruiterId = rec._id || rec.id;

              return (
                <div
                  key={recruiterId || rec.email}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: 16,
                    background: "var(--cream)",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    gap: 16,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--brown4)", fontSize: 16 }}>
                      {rec.name || "Unnamed recruiter"}
                    </div>

                    <div style={{ fontSize: 13, color: "var(--muted)" }}>
                      {rec.email || "No email"}
                    </div>

                    <div
                      style={{
                        fontSize: 12,
                        marginTop: 4,
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      {rec.profile?.recruiter_title && (
                        <span
                          className="tag"
                          style={{ background: "var(--cream2)", color: "var(--brown3)" }}
                        >
                          💼 {rec.profile.recruiter_title}
                        </span>
                      )}

                      {rec.profile?.industry && (
                        <span
                          className="tag"
                          style={{ background: "var(--cream2)", color: "var(--brown3)" }}
                        >
                          🏢 {rec.profile.industry}
                        </span>
                      )}

                      {rec.profile?.university && (
                        <span
                          className="tag"
                          style={{ background: "var(--cream2)", color: "var(--brown3)" }}
                        >
                          🏛 {rec.profile.university}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      onClick={() => handleAction(recruiterId, "approve")}
                      disabled={actionLoading === `approve-${recruiterId}`}
                      className="btn-primary"
                      style={{
                        padding: "8px 16px",
                        fontSize: 13,
                        background: "#1A7A4A",
                        opacity: actionLoading === `approve-${recruiterId}` ? 0.7 : 1,
                      }}
                    >
                      {actionLoading === `approve-${recruiterId}` ? "Approving..." : "Approve"}
                    </button>

                    <button
                      onClick={() => handleAction(recruiterId, "reject")}
                      disabled={actionLoading === `reject-${recruiterId}`}
                      className="btn-ghost"
                      style={{
                        padding: "8px 16px",
                        fontSize: 13,
                        borderColor: "#A32D2D",
                        color: "#A32D2D",
                        opacity: actionLoading === `reject-${recruiterId}` ? 0.7 : 1,
                      }}
                    >
                      {actionLoading === `reject-${recruiterId}` ? "Rejecting..." : "Reject"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}