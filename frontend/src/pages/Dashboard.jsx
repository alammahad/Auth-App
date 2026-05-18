import { useState, useEffect, useMemo } from "react";
import { NewsSection } from "./NewsSection";
import { StudentJobsSection } from "./StudentJobsSection";
import { MatchesSection } from "./MatchesSection";
import { ChatSection } from "./ChatSection";
import { GuidesSection } from "./GuidesSection";
import { MessagingSection } from "./MessagingSection";
import { ProfileSection } from "./ProfileSection";
import { RecruiterOverview } from "./RecruiterOverview";
import { RecruiterJobsPane } from "./RecruiterJobsPane";
import { RecruiterApplicantsPane } from "./RecruiterApplicantsPane";
import { AdminSection } from "./AdminSection";
import { AdminDashboard } from "./AdminDashboard";

function tabButtonStyle(active) {
  return {
    padding: "10px 18px",
    borderRadius: 99,
    border: "none",
    cursor: "pointer",
    fontFamily: "var(--sans)",
    fontSize: 13,
    fontWeight: 500,
    transition: "all var(--transition)",
    background: active ? "var(--brown3)" : "transparent",
    color: active ? "var(--white)" : "var(--muted)",
  };
}

export default function Dashboard({ user, token, onLogout, onUserRefresh }) {
  const [tab, setTab] = useState("news");
  const [allPosts, setAllPosts] = useState([]);

  const role = user?.userType || "student";

  useEffect(() => {
    if (role === "recruiter") setTab("overview");
    else if (role === "super_admin") setTab("admin");
    else setTab("news");
  }, [role]);

  const studentNav = useMemo(
    () => [
      ["news", "Feed"],
      ["jobs", "Jobs & apply"],
      ["matches", "Matches"],
      ["chat", "AI chat"],
      ["guides", "Guides"],
      ["messages", "Messages"],
      ["profile", "Profile"],
    ],
    []
  );

  const recruiterNav = useMemo(
    () => [
      ["overview", "Overview"],
      ["community", "Community"],
      ["postings", "Post roles"],
      ["applicants", "Applicants"],
      ["messages", "Messages"],
      ["profile", "Profile"],
    ],
    []
  );

  const adminNav = useMemo(
    () => [
      ["admin", "Approvals"],
      ["analytics", "Insights"],
      ["profile", "Profile"],
    ],
    []
  );

  const nav = role === "recruiter" ? recruiterNav : role === "super_admin" ? adminNav : studentNav;

  return (
    <>
      <style>{`
        .app-shell { min-height: 100vh; background: var(--cream); display: flex; flex-direction: column; }
        .app-top {
          background: var(--cream2);
          border-bottom: 1px solid rgba(111, 78, 55, 0.15);
          padding: 0 24px;
          min-height: 62px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
          position: sticky;
          top: 0;
          z-index: 50;
          box-shadow: 0 2px 12px rgba(73,48,30,0.08);
        }
        .app-brand { font-family: var(--serif); font-size: 26px; color: var(--brown4); font-style: italic; letter-spacing: -0.5px; }
        .app-nav-scroll { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; flex: 1; justify-content: center; }
        .app-main { flex: 1; padding: 24px 24px 48px; }
      `}</style>

      <div className="app-shell">
        <header className="app-top">
          <div className="app-brand">SCHLR</div>
          <nav className="app-nav-scroll" aria-label="Main">
            {nav.map(([id, label]) => (
              <button key={id} type="button" style={tabButtonStyle(tab === id)} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </nav>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 13, color: "var(--muted)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user.name}
            </span>
            <button type="button" className="btn-ghost" style={{ padding: "8px 16px", fontSize: 13 }} onClick={onLogout}>
              Log out
            </button>
          </div>
        </header>

        <main className="app-main">
          {role === "student" && (
            <>
              {tab === "news" && (
                <NewsSection user={user} token={token} onPostsUpdated={setAllPosts} onUserRefresh={onUserRefresh} />
              )}
              {tab === "jobs" && (
                <StudentJobsSection user={user} token={token} onUserRefresh={onUserRefresh} />
              )}
              {tab === "matches" && <MatchesSection token={token} />}
              {tab === "chat" && <ChatSection user={user} token={token} />}
              {tab === "guides" && <GuidesSection />}
              {tab === "messages" && <MessagingSection user={user} token={token} />}
              {tab === "profile" && (
                <ProfileSection user={user} allPosts={allPosts} token={token} onUserRefresh={onUserRefresh} />
              )}
            </>
          )}

          {role === "recruiter" && (
            <>
              {tab === "overview" && <RecruiterOverview token={token} />}
              {tab === "community" && (
                <NewsSection user={user} token={token} onPostsUpdated={setAllPosts} feedVariant="recruiter" />
              )}
              {tab === "postings" && <RecruiterJobsPane token={token} />}
              {tab === "applicants" && <RecruiterApplicantsPane token={token} />}
              {tab === "messages" && <MessagingSection user={user} token={token} />}
              {tab === "profile" && (
                <ProfileSection user={user} allPosts={[]} token={token} onUserRefresh={onUserRefresh} />
              )}
            </>
          )}

          {role === "super_admin" && (
            <>
              {tab === "admin" && <AdminSection token={token} />}
              {tab === "analytics" && <AdminDashboard token={token} />}
              {tab === "profile" && (
                <ProfileSection user={user} allPosts={allPosts} token={token} onUserRefresh={onUserRefresh} />
              )}
            </>
          )}
        </main>
      </div>
    </>
  );
}
