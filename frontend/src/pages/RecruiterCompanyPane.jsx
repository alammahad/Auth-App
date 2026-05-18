import { useState, useEffect } from "react";
import { S } from "../../styles/theme";
import { API_BASE } from "../utils";

export function RecruiterCompanyPane({ token, user, onUserRefresh }) {
  const [form, setForm] = useState({
    university: user.university || "",
    industry: user.industry || "",
    recruiterTitle: user.recruiterTitle || "",
    companySize: user.companySize || "",
    companyWebsite: user.companyWebsite || "",
    linkedinCompanyUrl: user.linkedinCompanyUrl || "",
  });
  useEffect(() => {
    setForm({
      university: user.university || "",
      industry: user.industry || "",
      recruiterTitle: user.recruiterTitle || "",
      companySize: user.companySize || "",
      companyWebsite: user.companyWebsite || "",
      linkedinCompanyUrl: user.linkedinCompanyUrl || "",
    });
  }, [user.university, user.industry, user.recruiterTitle, user.companySize, user.companyWebsite, user.linkedinCompanyUrl]);

  const save = async () => {
    await fetch(`${API_BASE}/users/${user.id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: user.name,
        profile: {
          university: form.university,
          industry: form.industry,
          recruiter_title: form.recruiterTitle,
          company_size: form.companySize,
          company_website: form.companyWebsite,
          linkedin_company_url: form.linkedinCompanyUrl,
        },
      }),
    });
    onUserRefresh?.();
  };

  return (
    <div className="card" style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontFamily: "var(--serif)", fontSize: 26, color: "var(--brown4)", marginBottom: 8 }}>Company profile</h1>
      <p style={{ color: "var(--muted)", marginBottom: 20, fontSize: 14 }}>
        This card appears on your recruiting overview. Keep it aligned with your public careers pages.
      </p>
      {[
        ["Organization / brand name", "university", "text"],
        ["Industry", "industry", "text"],
        ["Your title", "recruiterTitle", "text"],
        ["Company size", "companySize", "text"],
        ["Website", "companyWebsite", "url"],
        ["LinkedIn company URL", "linkedinCompanyUrl", "url"],
      ].map(([label, key, typ]) => (
        <div key={key} style={{ marginBottom: 14 }}>
          <label style={S.label}>{label}</label>
          <input
            type={typ}
            value={form[key]}
            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
            style={{ ...S.input, width: "100%" }}
          />
        </div>
      ))}
      <button type="button" onClick={save} className="btn-primary">Save company</button>
    </div>
  );
}
