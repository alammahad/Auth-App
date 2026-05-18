import { useState, useEffect } from "react";
import { API_BASE } from "../utils";
import { S, G } from "../../styles/theme";

export function AdminDashboard({ token }) {
  const [activeTab, setActiveTab] = useState("pending_recruiters");
  const [pendingRecruiters, setPendingRecruiters] = useState([]);
  const [approvedRecruiters, setApprovedRecruiters] = useState([]);
  const [allRecruiters, setAllRecruiters] = useState([]);
  const [stats, setStats] = useState({ total_users: 0, total_recruiters: 0, pending_recruiters: 0, total_students: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [actionInProgress, setActionInProgress] = useState(null);

  const fetchPendingRecruiters = async () => {
    try {
      const resp = await fetch(`${API_BASE}/admin/recruiters/pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || "Failed to fetch pending recruiters");
      setPendingRecruiters(data.recruiters || []);
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchApprovedRecruiters = async () => {
    try {
      const resp = await fetch(`${API_BASE}/admin/recruiters/approved`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || "Failed to fetch approved recruiters");
      setApprovedRecruiters(data.recruiters || []);
    } catch (err) {
      console.error("Failed to fetch approved recruiters:", err);
    }
  };

  const fetchAllRecruiters = async () => {
    try {
      const resp = await fetch(`${API_BASE}/admin/recruiters/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || "Failed to fetch all recruiters");
      setAllRecruiters(data.recruiters || []);
    } catch (err) {
      console.error("Failed to fetch all recruiters:", err);
    }
  };

  const fetchStats = async () => {
    try {
      const resp = await fetch(`${API_BASE}/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchPendingRecruiters(), fetchApprovedRecruiters(), fetchAllRecruiters(), fetchStats()])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const handleAction = async (recruiterId, action) => {
    setMessage("");
    setError("");
    setActionInProgress(recruiterId);
    try {
      const resp = await fetch(`${API_BASE}/admin/recruiters/${recruiterId}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || `Failed to ${action} recruiter`);
      setMessage(`Recruiter ${action}ed successfully!`);
      fetchPendingRecruiters();
      fetchApprovedRecruiters();
      fetchAllRecruiters();
      fetchStats();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionInProgress(null);
    }
  };

  const RecruiterCard = ({ rec, showActions = false, action = null }) => (
    <div
      style={{
        padding: 16,
        background: action === "rejected" ? "var(--cream3)" : "var(--cream)",
        borderRadius: 12,
        border: `1px solid ${action === "rejected" ? "rgba(111,78,55,0.15)" : "var(--border)"}`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        transition: "all 0.2s",
      }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ fontWeight: 600, color: "var(--brown4)", fontSize: 15 }}>{rec.name}</div>
          {action && (
            <span
              style={{
                fontSize: 10,
                padding: "2px 8px",
                borderRadius: 4,
                background: action === "approved" ? "var(--cream2)" : "var(--cream3)",
                color: "var(--brown4)",
                fontWeight: 600,
              }}>
              {action.toUpperCase()}
            </span>
          )}
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>📧 {rec.email}</div>
        <div style={{ fontSize: 11, marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {rec.profile?.recruiter_title && (
            <span style={{ background: "var(--cream2)", color: "var(--brown3)", padding: "3px 8px", borderRadius: 4, fontSize: 12 }}>
              💼 {rec.profile.recruiter_title}
            </span>
          )}
          {rec.profile?.industry && (
            <span style={{ background: "var(--cream2)", color: "var(--brown3)", padding: "3px 8px", borderRadius: 4, fontSize: 12 }}>
              🏢 {rec.profile.industry}
            </span>
          )}
          {rec.profile?.company_size && (
            <span style={{ background: "var(--cream2)", color: "var(--brown3)", padding: "3px 8px", borderRadius: 4, fontSize: 12 }}>
              👥 {rec.profile.company_size} employees
            </span>
          )}
          {rec.profile?.company_website && (
            <span style={{ background: "var(--cream2)", color: "var(--brown3)", padding: "3px 8px", borderRadius: 4, fontSize: 12 }}>
              🔗 {rec.profile.company_website}
            </span>
          )}
        </div>
        {rec.profile?.hiring_focus?.length > 0 && (
          <div style={{ fontSize: 11, marginTop: 8, color: "var(--muted)" }}>
            <strong>Hiring for:</strong> {rec.profile.hiring_focus.join(", ")}
          </div>
        )}
      </div>
      {showActions && (
        <div style={{ display: "flex", gap: 8, marginLeft: 16, flexShrink: 0 }}>
          <button
            onClick={() => handleAction(rec._id, "approve")}
            disabled={actionInProgress === rec._id}
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              background: actionInProgress === rec._id ? "var(--muted)" : "#1A7A4A",
              color: "var(--white)",
              border: "none",
              cursor: actionInProgress === rec._id ? "not-allowed" : "pointer",
              fontSize: 12,
              fontWeight: 600,
              transition: "all 0.2s",
            }}>
            {actionInProgress === rec._id ? "..." : "✓ Approve"}
          </button>
          <button
            onClick={() => handleAction(rec._id, "reject")}
            disabled={actionInProgress === rec._id}
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              background: "transparent",
              color: actionInProgress === rec._id ? "var(--muted)" : "#A32D2D",
              border: `1px solid ${actionInProgress === rec._id ? "var(--muted)" : "#A32D2D"}`,
              cursor: actionInProgress === rec._id ? "not-allowed" : "pointer",
              fontSize: 12,
              fontWeight: 600,
              transition: "all 0.2s",
            }}>
            {actionInProgress === rec._id ? "..." : "✗ Reject"}
          </button>
        </div>
      )}
    </div>
  );

  const tabs = [
    { id: "pending_recruiters", label: "⏳ Pending Review", count: pendingRecruiters.length },
    { id: "approved_recruiters", label: "✓ Approved", count: approvedRecruiters.length },
    { id: "all_recruiters", label: "📋 All Recruiters", count: allRecruiters.length },
    { id: "analytics", label: "📊 Analytics" },
  ];

  const searchTerm = searchQ.toLowerCase();

  const filteredPending = pendingRecruiters.filter((r) => {
    const name = (r.name || "").toLowerCase();
    const email = (r.email || "").toLowerCase();
    const industry = (r.profile?.industry || "").toLowerCase();
    return name.includes(searchTerm) || email.includes(searchTerm) || industry.includes(searchTerm);
  });

  const filteredApproved = approvedRecruiters.filter((r) => {
    const name = (r.name || "").toLowerCase();
    const email = (r.email || "").toLowerCase();
    const industry = (r.profile?.industry || "").toLowerCase();
    return name.includes(searchTerm) || email.includes(searchTerm) || industry.includes(searchTerm);
  });

  const filteredAll = allRecruiters.filter((r) => {
    const name = (r.name || "").toLowerCase();
    const email = (r.email || "").toLowerCase();
    const industry = (r.profile?.industry || "").toLowerCase();
    return name.includes(searchTerm) || email.includes(searchTerm) || industry.includes(searchTerm);
  });

  return (
    <>
      <style>{G}</style>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: "var(--serif)", fontSize: 40, color: "var(--brown4)", marginBottom: 8 }}>
            Admin Dashboard
          </h1>
          <p style={{ color: "var(--muted)", fontSize: 15 }}>
            Manage the SCHLR community, verify accounts, and monitor platform activity.
          </p>
        </div>

        {/* Stats Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16, marginBottom: 32 }}>
          <div style={{ padding: 20, background: "var(--cream2)", borderRadius: 12, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>Total Users</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: "var(--brown4)" }}>{stats.total_users}</div>
          </div>
          <div style={{ padding: 20, background: "var(--cream2)", borderRadius: 12, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>Total Recruiters</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: "var(--brown4)" }}>{stats.total_recruiters}</div>
          </div>
          <div style={{ padding: 20, background: "var(--cream3)", borderRadius: 12, border: "1px solid rgba(111,78,55,0.15)" }}>
            <div style={{ fontSize: 12, color: "var(--brown3)", marginBottom: 8 }}>Pending Review</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: "var(--brown4)" }}>{stats.pending_recruiters}</div>
          </div>
        </div>

        {/* Alerts */}
        {message && (
          <div style={{ padding: 14, borderRadius: 10, background: "var(--cream2)", color: "var(--brown4)", fontSize: 14, marginBottom: 20, border: "1px solid rgba(111,78,55,0.15)" }}>
            ✅ {message}
          </div>
        )}
        {error && (
          <div style={{ padding: 14, borderRadius: 10, background: "var(--cream3)", color: "var(--brown4)", fontSize: 14, marginBottom: 20, border: "1px solid rgba(111,78,55,0.15)" }}>
            ❌ {error}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24, borderBottom: "1px solid var(--border)", paddingBottom: 16, overflowX: "auto" }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSearchQ(""); }}
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                background: activeTab === tab.id ? "var(--brown3)" : "var(--cream2)",
                color: activeTab === tab.id ? "var(--white)" : "var(--text)",
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 500,
                transition: "all 0.2s",
                whiteSpace: "nowrap",
              }}>
              {tab.label} {tab.count ? `(${tab.count})` : ""}
            </button>
          ))}
        </div>

        {/* Search Box - for recruiter tabs */}
        {(activeTab === "pending_recruiters" || activeTab === "approved_recruiters" || activeTab === "all_recruiters") && (
          <div style={{ marginBottom: 20 }}>
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search by name, email, or industry..."
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: 14,
                fontFamily: "var(--sans)",
              }}
            />
          </div>
        )}

        {/* Tab Content */}
        <div style={{ minHeight: 400 }}>
          {/* Pending Recruiters Tab */}
          {activeTab === "pending_recruiters" && (
            <div>
              <h2 style={{ fontSize: 20, color: "var(--brown4)", marginBottom: 16, fontWeight: 600 }}>
                ⏳ Pending Recruiter Accounts {filteredPending.length > 0 && `(${filteredPending.length})`}
              </h2>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20 }}>
                Review and approve recruiter applications. Only approved recruiters can access the platform.
              </p>
              {loading ? (
                <div style={{ color: "var(--muted)", textAlign: "center", padding: 40 }}>⏳ Loading...</div>
              ) : filteredPending.length === 0 ? (
                <div style={{ color: "var(--muted)", textAlign: "center", padding: 40, background: "var(--cream2)", borderRadius: 12 }}>
                  ✅ No pending recruiters. All applications processed!
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {filteredPending.map((rec) => (
                    <RecruiterCard key={rec._id} rec={rec} showActions={true} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Approved Recruiters Tab */}
          {activeTab === "approved_recruiters" && (
            <div>
              <h2 style={{ fontSize: 20, color: "var(--brown4)", marginBottom: 16, fontWeight: 600 }}>
                ✓ Approved Recruiters {filteredApproved.length > 0 && `(${filteredApproved.length})`}
              </h2>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20 }}>
                Active recruiter accounts with full platform access.
              </p>
              {loading ? (
                <div style={{ color: "var(--muted)", textAlign: "center", padding: 40 }}>⏳ Loading...</div>
              ) : filteredApproved.length === 0 ? (
                <div style={{ color: "var(--muted)", textAlign: "center", padding: 40, background: "var(--cream2)", borderRadius: 12 }}>
                  No approved recruiters yet.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {filteredApproved.map((rec) => (
                    <RecruiterCard key={rec._id} rec={rec} action="approved" />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* All Recruiters Tab */}
          {activeTab === "all_recruiters" && (
            <div>
              <h2 style={{ fontSize: 20, color: "var(--brown4)", marginBottom: 16, fontWeight: 600 }}>
                📋 All Recruiters {filteredAll.length > 0 && `(${filteredAll.length})`}
              </h2>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20 }}>
                Complete list of all recruiter accounts including pending, approved, and rejected.
              </p>
              {loading ? (
                <div style={{ color: "var(--muted)", textAlign: "center", padding: 40 }}>⏳ Loading...</div>
              ) : filteredAll.length === 0 ? (
                <div style={{ color: "var(--muted)", textAlign: "center", padding: 40, background: "var(--cream2)", borderRadius: 12 }}>
                  No recruiters found.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {filteredAll.map((rec) => (
                    <RecruiterCard key={rec._id} rec={rec} action={rec.status} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === "analytics" && (
            <div>
              <h2 style={{ fontSize: 20, color: "var(--brown4)", marginBottom: 16, fontWeight: 600 }}>📊 Platform Analytics</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
                <div style={{ padding: 16, background: "var(--cream2)", borderRadius: 12, border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>Total Students</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "var(--brown4)" }}>{stats.total_students}</div>
                </div>
                <div style={{ padding: 16, background: "var(--cream2)", borderRadius: 12, border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>Approved Recruiters</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#1A7A4A" }}>{stats.total_recruiters - stats.pending_recruiters}</div>
                </div>
                <div style={{ padding: 16, background: "#FFF3E0", borderRadius: 12, border: "1px solid #FFB74D" }}>
                  <div style={{ fontSize: 12, color: "#E65100", marginBottom: 8 }}>Pending Approval</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#E65100" }}>{stats.pending_recruiters}</div>
                </div>
              </div>
              <div style={{ background: "var(--cream2)", borderRadius: 12, padding: 24, textAlign: "center", color: "var(--muted)" }}>
                <p style={{ fontSize: 14 }}>📈 Advanced charts and insights coming soon</p>
                <p style={{ fontSize: 12, marginTop: 8 }}>Monitor user growth, engagement, and platform performance.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
