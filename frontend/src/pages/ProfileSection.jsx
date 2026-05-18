import { useState, useEffect } from "react";
import { S } from "../../styles/theme";
import { API_BASE, initials } from "../utils";
import { MiniPost } from "../common/MiniPost";

export function ProfileSection({ user, allPosts, token, onUserRefresh }) {
  const isAdmin = user.userType === "super_admin";
  const isRecruiter = user.userType === "recruiter";
  const isStudent = user.userType === "student";

  const [tab, setTab] = useState("posts");
  const [editing, setEditing] = useState(false);
  const [followStats, setFollowStats] = useState({ followers: 0, following: 0 });
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [cvBusy, setCvBusy] = useState(false);
  const [profileData, setProfileData] = useState({
    bio: "",
    skills: "",
    linkedin: "",
    github: "",
    website: "",
    degree: "",
    countryResidence: "",
    recruiterTitle: "",
    industry: "",
    companySize: "",
    companyWebsite: "",
    linkedinCompanyUrl: "",
    university: "",
    workEmail: "",
    cvUploaded: false,
    openToInternship: false,
  });

  useEffect(() => {
    if (isRecruiter) setTab("interests");
  }, [isRecruiter]);

  useEffect(() => {
    const loadMe = async () => {
      try {
        const resp = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) return;
        const data = await resp.json();
        const p = data.profile || {};
        setFollowStats({
          followers: (data.followers || []).length,
          following: (data.following || []).length,
        });
        const cvU = (p.cv_url || "").trim();
        setProfileData((prev) => ({
          ...prev,
          bio: data.bio ?? prev.bio,
          skills: p.skills ?? prev.skills,
          linkedin: p.linkedin_url ?? prev.linkedin,
          github: p.github_url ?? prev.github,
          website: p.website_url ?? prev.website,
          degree: p.degree ?? user.degree ?? "",
          countryResidence: p.country ?? user.countryResidence ?? "",
          recruiterTitle: p.recruiter_title ?? user.recruiterTitle ?? "",
          industry: p.industry ?? user.industry ?? "",
          companySize: p.company_size ?? user.companySize ?? "",
          companyWebsite: p.company_website ?? user.companyWebsite ?? "",
          linkedinCompanyUrl: p.linkedin_company_url ?? user.linkedinCompanyUrl ?? "",
          university: p.university ?? user.university ?? "",
          workEmail: (p.work_email || "").trim() || user.workEmail || user.email || "",
          cvUploaded: Boolean(cvU),
        }));
      } catch {
        // keep cached values
      }
    };
    loadMe();
  }, [token, user.id, user.degree, user.countryResidence, user.recruiterTitle, user.industry, user.companySize, user.companyWebsite, user.linkedinCompanyUrl]);

  const uploadAvatarFile = async (file) => {
    setAvatarBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`${API_BASE}/upload/image?folder=avatars`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Photo upload unavailable");
      const url = data.url;
      const pr = await fetch(`${API_BASE}/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ avatar: url }),
      });
      if (!pr.ok) throw new Error("Could not save avatar");
      onUserRefresh?.();
    } catch (e) {
      alert(e.message || "Avatar upload failed — configure Cloudinary in backend/.env.");
    } finally {
      setAvatarBusy(false);
    }
  };

  const uploadCvFile = async (file) => {
    if (!file) return;
    if (!isStudent) return;
    setCvBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`${API_BASE}/upload/document?folder=cvs`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof data.detail === "string" ? data.detail : "CV upload failed.");
      const url = data.url;
      const pr = await fetch(`${API_BASE}/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ profile: { cv_url: url } }),
      });
      if (!pr.ok) throw new Error("Could not save CV on profile.");
      setProfileData((p) => ({ ...p, cvUploaded: true }));
      onUserRefresh?.();
    } catch (e) {
      alert(e.message || "CV upload failed.");
    } finally {
      setCvBusy(false);
    }
  };

  const saveProfile = async () => {
    if (isAdmin) {
      alert("The built-in super admin account does not support profile updates through this form.");
      return;
    }
    const recruiterFields =
      user.userType === "recruiter"
        ? {
            recruiter_title: profileData.recruiterTitle,
            industry: profileData.industry,
            company_size: profileData.companySize,
            company_website: profileData.companyWebsite,
            linkedin_company_url: profileData.linkedinCompanyUrl,
            work_email: profileData.workEmail?.trim() || undefined,
          }
        : {};
    await fetch(`${API_BASE}/users/${user.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: user.name,
        bio: profileData.bio,
        profile: {
          major: user.major || "",
          university: profileData.university || user.university || "",
          target_country: user.targetCountry || "",
          interests: user.interests || [],
          skills: profileData.skills,
          linkedin_url: profileData.linkedin,
          github_url: profileData.github,
          website_url: profileData.website,
          degree: profileData.degree,
          country: profileData.countryResidence,
          ...recruiterFields,
        },
      }),
    });
    onUserRefresh?.();
  };

  const myPosts = allPosts.filter((p) => p.handle === user.handle);
  const savedPosts = allPosts.filter((p) => p.saved);

  const stats = [
    { label: "Posts", val: myPosts.length },
    { label: "Followers", val: followStats.followers },
    { label: "Following", val: followStats.following },
  ];

  return (
    <div style={{maxWidth:760,margin:"0 auto"}}>
      {isAdmin && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: "var(--radius)",
            background: "#1a1a1a",
            color: "#f5f5f0",
            marginBottom: 20,
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          <strong>Super admin</strong> — approve recruiters under the Approvals tab. This profile is display-only here (account is not stored as a normal user document).
        </div>
      )}
      {/* Profile card */}
      <div style={{background:"var(--white)",borderRadius:"var(--radius)",
        border:"1px solid var(--border)",overflow:"hidden",marginBottom:24}}>
        <div style={S.profBanner} />
        <div style={{padding:"56px 28px 24px",position:"relative"}}>
          <div
            style={{
              ...S.profAvatar,
              overflow: "hidden",
              padding: 0,
              alignItems: "center",
              justifyContent: "center",
            }}>
            {user.avatar && String(user.avatar).startsWith("http") ? (
              <img src={user.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              initials(user.name || "U")
            )}
          </div>
          <label
            style={{
              position: "absolute",
              left: 118,
              top: 146,
              fontSize: 12,
              color: "var(--brown3)",
              cursor: avatarBusy ? "wait" : "pointer",
              fontWeight: 600,
            }}>
            {avatarBusy ? "Uploading…" : "📷 Photo"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={avatarBusy}
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadAvatarFile(f);
                e.target.value = "";
              }}
            />
          </label>
          <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginBottom:12}}>
            {!isAdmin && (
            <button type="button" onClick={async ()=>{
              if (editing) await saveProfile();
              setEditing(!editing);
            }} className="btn-ghost" style={{padding:"8px 20px"}}>
              {editing?"Save Profile":"Edit Profile"}
            </button>
            )}
            {!isAdmin && user.userType==="student" && (
              <button onClick={()=>setProfileData(p=>({...p,openToInternship:!p.openToInternship}))}
                style={{padding:"8px 20px",borderRadius:99,fontSize:14,fontWeight:500,
                  fontFamily:"var(--sans)",cursor:"pointer",border:"none",
                  background:profileData.openToInternship?"#E6F9F0":"var(--cream2)",
                  color:profileData.openToInternship?"#1A7A4A":"var(--muted)",transition:"all var(--transition)"}}>
                {profileData.openToInternship?"✓ Open to Internship":"Open to Internship?"}
              </button>
            )}
          </div>
          <div style={{fontFamily:"var(--serif)",fontSize:26,color:"var(--brown4)"}}>{user.name}</div>
          <div style={{color:"var(--muted)",fontSize:13,marginBottom:6}}>@{user.handle || "—"}</div>
          {isRecruiter && (profileData.workEmail || user.email) && (
            <div style={{ fontSize: 13, color: "var(--text)", marginBottom: 10 }}>
              <span style={{ color: "var(--muted)" }}>Work email: </span>
              <span style={{ fontWeight: 600 }}>{profileData.workEmail || user.workEmail || user.email}</span>
            </div>
          )}
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
            {isAdmin && (
              <span style={{padding:"3px 12px",borderRadius:99,background:"#1a1a1a",
                color:"var(--white)",fontSize:11,fontWeight:600,letterSpacing:"0.05em"}}>SUPER ADMIN</span>
            )}
            {user.userType==="recruiter" && (
              <span style={{padding:"3px 12px",borderRadius:99,background:"var(--brown4)",
                color:"var(--white)",fontSize:11,fontWeight:600,letterSpacing:"0.05em"}}>RECRUITER</span>
            )}
            {user.userType==="student" && (
              <span style={{padding:"3px 12px",borderRadius:99,background:"var(--cream3)",
                color:"var(--brown4)",fontSize:11,fontWeight:600,letterSpacing:"0.05em"}}>STUDENT</span>
            )}
            {user.university && <span className="tag" style={{background:"var(--cream2)",color:"var(--brown3)"}}>🏛 {user.university}</span>}
            {(user.degree || profileData.degree) && (
              <span className="tag" style={{background:"var(--cream2)",color:"var(--brown3)"}}>🎓 {user.degree || profileData.degree}</span>
            )}
            {user.major && <span className="tag" style={{background:"var(--cream2)",color:"var(--brown3)"}}>📚 {user.major}</span>}
            {user.industry && <span className="tag" style={{background:"var(--cream2)",color:"var(--brown3)"}}>🏭 {user.industry}</span>}
            {user.targetCountry && <span className="tag" style={{background:"var(--cream2)",color:"var(--brown3)"}}>🌍 {user.targetCountry}</span>}
          </div>

          {editing ? (
            <div style={{display:"flex",flexDirection:"column",gap:12,marginTop:12}}>
              {[["Bio","bio"],["Skills (comma-separated)","skills"],["LinkedIn URL","linkedin"],
                ["GitHub URL","github"],["Portfolio URL","website"]].map(([lbl,key])=>(
                <div key={key} style={S.field}>
                  <label style={S.label}>{lbl}</label>
                  <input value={profileData[key]} onChange={e=>setProfileData(p=>({...p,[key]:e.target.value}))}
                    style={S.input} placeholder={lbl} />
                </div>
              ))}
              {user.userType === "student" && !isAdmin && (
                <>
                  {[["Degree level","degree","text"],["Country of residence","countryResidence","text"]].map(([lbl,key,t])=>(
                    <div key={key} style={S.field}>
                      <label style={S.label}>{lbl}</label>
                      <input type={t} value={profileData[key]} onChange={e=>setProfileData(p=>({...p,[key]:e.target.value}))} style={S.input} placeholder={lbl} />
                    </div>
                  ))}
                </>
              )}
              {user.userType === "recruiter" && !isAdmin && (
                <>
                  <div style={S.field}>
                    <label style={S.label}>Work email</label>
                    <input
                      type="email"
                      value={profileData.workEmail}
                      onChange={(e) => setProfileData((p) => ({ ...p, workEmail: e.target.value }))}
                      style={S.input}
                      placeholder="Shown to candidates & on applications"
                    />
                  </div>
                  <div style={S.field}>
                    <label style={S.label}>Organization / company name</label>
                    <input
                      value={profileData.university}
                      onChange={(e) => setProfileData((p) => ({ ...p, university: e.target.value }))}
                      style={S.input}
                      placeholder="Shown on job postings"
                    />
                  </div>
                  {[
                    ["Your title","recruiterTitle","text"],
                    ["Industry","industry","text"],
                    ["Company size","companySize","text"],
                    ["Company website","companyWebsite","url"],
                    ["LinkedIn company URL","linkedinCompanyUrl","url"],
                  ].map(([lbl,key,t])=>(
                    <div key={key} style={S.field}>
                      <label style={S.label}>{lbl}</label>
                      <input type={t} value={profileData[key]} onChange={e=>setProfileData(p=>({...p,[key]:e.target.value}))} style={S.input} />
                    </div>
                  ))}
                </>
              )}
              {/* CV Upload — students */}
              {isStudent && (
              <div>
                <label style={S.label}>CV / Resume (PDF)</label>
                <div style={{marginTop:6,display:"flex",flexWrap:"wrap",alignItems:"center",gap:12}}>
                  <label
                    style={{
                      padding:"10px 18px",
                      borderRadius:10,
                      background:"var(--cream2)",
                      border:"1.5px dashed var(--brown1)",
                      color:"var(--brown3)",
                      fontSize:13,
                      fontWeight:500,
                      cursor: cvBusy ? "wait" : "pointer",
                      fontFamily:"var(--sans)",
                    }}
                  >
                    {cvBusy ? "Uploading…" : profileData.cvUploaded ? "📄 Replace CV (PDF)" : "📤 Upload CV (PDF)"}
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      disabled={cvBusy}
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadCvFile(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {profileData.cvUploaded && (
                    <span style={{fontSize:12,color:"#1A7A4A"}}>Stored for job applications</span>
                  )}
                </div>
              </div>
              )}
            </div>
          ) : (
            <>
              <p style={{color:"var(--text)",fontSize:14,lineHeight:1.65,marginBottom:12}}>{profileData.bio}</p>
              {profileData.skills && (
                <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:12}}>
                  {profileData.skills.split(",").map(s=>(
                    <span key={s} className="tag" style={{background:"var(--cream3)",color:"var(--brown4)",padding:"4px 12px"}}>
                      {s.trim()}
                    </span>
                  ))}
                </div>
              )}
              <div style={{display:"flex",gap:24}}>
                {stats.map(s=>(
                  <div key={s.label} style={{textAlign:"center"}}>
                    <div style={{fontFamily:"var(--serif)",fontSize:22,color:"var(--brown4)"}}>{s.val}</div>
                    <div style={{fontSize:12,color:"var(--muted)"}}>{s.label}</div>
                  </div>
                ))}
              </div>
              {isStudent && profileData.cvUploaded && user.cvUrl && (
                <div style={{marginTop:14,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 16px",
                    borderRadius:10,background:"var(--cream2)",width:"fit-content",fontSize:13}}>
                    📄 <span style={{fontWeight:500,color:"var(--brown3)"}}>CV on file</span>
                    <span style={{color:"var(--muted)"}}>— used when you apply to roles</span>
                  </div>
                  <a href={user.cvUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 600, color: "var(--brown3)" }}>
                    Open your CV →
                  </a>
                </div>
              )}
              {isRecruiter && (
                <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 12, lineHeight: 1.6 }}>
                  Recruiters publish roles under <strong>Post roles</strong>. Student applicants attach their CV per application; you review them under each posting.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:4,marginBottom:20,background:"var(--cream2)",
        borderRadius:99,padding:4,width:"fit-content",flexWrap:"wrap"}}>
        {(isRecruiter
          ? [["interests","Focus"]]
          : isAdmin
          ? [["posts","Activity"]]
          : [["posts","My Posts"],["saved","Saved"],["interests","Interests"]]
        ).map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            style={{padding:"8px 20px",borderRadius:99,border:"none",cursor:"pointer",
              fontFamily:"var(--sans)",fontSize:13,fontWeight:500,transition:"all var(--transition)",
              background:tab===k?"var(--brown3)":"transparent",
              color:tab===k?"var(--white)":"var(--muted)"}}>
            {l}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab==="posts" && !isRecruiter && (
        myPosts.length===0
          ? <div style={{textAlign:"center",color:"var(--muted)",padding:40}}>No posts yet. Share your first achievement!</div>
          : myPosts.map(p=><MiniPost key={p.id} post={p}/>)
      )}
      {tab==="saved" && !isRecruiter && (
        savedPosts.length===0
          ? <div style={{textAlign:"center",color:"var(--muted)",padding:40}}>No saved posts yet.</div>
          : savedPosts.map(p=><MiniPost key={p.id} post={p}/>)
      )}
      {tab==="interests" && (
        <div style={{background:"var(--white)",borderRadius:"var(--radius)",
          border:"1px solid var(--border)",padding:"24px"}}>
          <div style={{fontFamily:"var(--serif)",fontSize:18,color:"var(--brown4)",marginBottom:14}}>
            {user.userType === "recruiter" ? "Hiring focus" : "Scholarship interests"}
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
            {((user.userType === "recruiter"
              ? (user.hiringFocus?.length ? user.hiringFocus : user.interests)
              : user.interests) || ["Fully Funded", "Merit Based", "STEM"]).map((i) => (
              <span key={i} className="tag" style={{background:"var(--cream2)",color:"var(--brown3)",
                padding:"6px 16px",fontSize:12}}>✓ {i}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
