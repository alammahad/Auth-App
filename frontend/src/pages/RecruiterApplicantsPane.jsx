import { RecruiterJobsPane } from "./RecruiterJobsPane";

/** Lists each published role with total applicants + expandable CV list (composer hidden). */
export function RecruiterApplicantsPane({ token }) {
  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "var(--serif)", fontSize: 28, marginBottom: 8, color: "var(--brown4)" }}>
        Applicants & CVs
      </h1>
      <p style={{ color: "var(--muted)", marginBottom: 22, lineHeight: 1.6 }}>
        For each live posting you&apos;ll see how many students applied through SCHLR with a CV. Open{" "}
        <strong>View applicants</strong> to download or review PDFs.
      </p>
      <RecruiterJobsPane token={token} showComposer={false} />
    </div>
  );
}
