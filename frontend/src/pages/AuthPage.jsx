import { useState, useEffect } from "react";
import { S, G } from "../../styles/theme";
import { API_BASE, mapMeToUser } from "../utils";
import { INTERESTS } from "../../constants";

const ADMIN_EMAIL = "admin@schlr.com";
const ADMIN_PASSWORD = "Admin123!";

export function AuthPage({ onLogin, onAuthToken, initialMode = "login", onBack }) {
  const [mode, setMode] = useState(initialMode);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name:"", email:"", password:"", confirmPassword:"",
    university:"", degree:"", major:"", gpa:"",
    country:"", targetCountry:"", interests:[],
    userType:"student",
    recruiterTitle:"", industry:"", companySize:"", hiringFocus:[],
    companyWebsite:"", linkedinCompany:"",
  });

  useEffect(() => {
    setMode(initialMode);
    setStep(1);
    setError("");
  }, [initialMode]);

  const toggleInterest = (i) => {
    setForm(f=>({...f, interests: f.interests.includes(i) ? f.interests.filter(x=>x!==i) : [...f.interests,i]}));
  };
  const toggleHiringFocus = (i) => {
    setForm(f=>({...f, hiringFocus: f.hiringFocus.includes(i) ? f.hiringFocus.filter(x=>x!==i) : [...f.hiringFocus,i]}));
  };

  const handleSubmit = async () => {
    setError("");
    const normalizedEmail = form.email.trim().toLowerCase();
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    const strongPassRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!emailRegex.test(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!form.email.trim() || !form.password.trim()) {
      setError("Email and password are required.");
      return;
    }
    if (mode === "signup" && normalizedEmail === ADMIN_EMAIL) {
      setError("Admin account cannot be created here. Use the built-in admin credentials to log in.");
      return;
    }
    if (mode==="signup" && step===2) {
      if (form.userType==="recruiter") {
        if (!form.recruiterTitle.trim()) {
          setError("Your title or role at the organization is required.");
          return;
        }
        if (!form.industry.trim()) {
          setError("Industry is required for recruiter accounts.");
          return;
        }
      }
    }

    if (mode==="signup" && step===1) {
      if (!form.name.trim()) {
        setError("Full name is required.");
        return;
      }
      if (!strongPassRegex.test(form.password)) {
        setError("Password must be 8+ chars with uppercase, lowercase, number, and special character.");
        return;
      }
      if (form.password !== form.confirmPassword) {
        setError("Password and confirm password do not match.");
        return;
      }
      setStep(2);
      return;
    }

    const endpoint = mode === "login" ? "/auth/login" : "/auth/signup";
    const payload = mode === "login"
      ? { email: normalizedEmail, password: form.password }
      : form.userType === "recruiter"
      ? {
          name: form.name,
          email: normalizedEmail,
          password: form.password,
          user_type: "recruiter",
          university: form.university,
          degree: form.degree || null,
          major: form.major || null,
          country: form.country || null,
          target_country: form.targetCountry || null,
          interests: form.interests,
          recruiter_title: form.recruiterTitle,
          industry: form.industry,
          company_size: form.companySize || null,
          hiring_focus: form.hiringFocus.length ? form.hiringFocus : form.interests,
          company_website: form.companyWebsite || null,
          linkedin_company_url: form.linkedinCompany || null,
        }
      : {
          name: form.name,
          email: normalizedEmail,
          password: form.password,
          user_type: "student",
          university: form.university,
          degree: form.degree,
          major: form.major,
          country: form.country,
          target_country: form.targetCountry,
          interests: form.interests,
        };

    try {
      setLoading(true);
      const resp = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || "Authentication failed");

      const token = data.token;
      const apiUser = data.user || {};
      const profile = apiUser.profile || {};
      onAuthToken(token);
      const mergedDoc = {
        ...apiUser,
        _id: apiUser.id || apiUser._id,
        user_type:
          apiUser.user_type ||
          (form.userType === "recruiter" ? "recruiter" : "student"),
        handle: apiUser.handle,
        name: apiUser.name || form.name,
        email: apiUser.email || form.email,
        profile: {
          ...(apiUser.profile || {}),
          work_email: profile.work_email || form.email,
          university: profile.university || form.university,
          major: profile.major || form.major,
          target_country: profile.target_country || form.targetCountry,
          interests: profile.interests?.length ? profile.interests : form.interests,
          degree: profile.degree || form.degree,
          country: profile.country || form.country,
          recruiter_title: profile.recruiter_title || form.recruiterTitle,
          industry: profile.industry || form.industry,
          company_size: profile.company_size || form.companySize,
          hiring_focus: profile.hiring_focus?.length ? profile.hiring_focus : form.hiringFocus,
          company_website: profile.company_website || form.companyWebsite,
          linkedin_company_url: profile.linkedin_company_url || form.linkedinCompany,
        },
      };
      onLogin(mapMeToUser(mergedDoc));
    } catch (err) {
      setError(err.message || "Unable to authenticate. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{G}</style>
      <div style={S.authWrap}>
        {/* bg decoration */}
        <div style={{position:"absolute",top:-80,right:-80,width:360,height:360,borderRadius:"50%",
          background:"radial-gradient(circle, var(--cream3) 0%, transparent 70%)",opacity:0.7}} />
        <div style={{position:"absolute",bottom:-60,left:-60,width:260,height:260,borderRadius:"50%",
          background:"radial-gradient(circle, var(--brown1) 0%, transparent 70%)",opacity:0.25}} />

        <div style={S.authCard}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
            <button onClick={onBack} className="btn-ghost" style={{padding:"7px 16px",fontSize:12}}>← Back</button>
            <div style={{fontSize:12,color:"var(--muted)"}}>Secure authentication</div>
          </div>
          {/* Logo */}
          <div style={{textAlign:"center",marginBottom:28}}>
            <span style={{fontFamily:"var(--serif)",fontSize:"44px",color:"var(--brown4)",fontStyle:"italic",letterSpacing:"-1px"}}>
              SCHLR
            </span>
            <div style={{fontSize:12,color:"var(--muted)",letterSpacing:"0.12em",marginTop:2}}>SCHOLARSHIP COMMUNITY</div>
          </div>

          {/* Tab */}
          <div style={{display:"flex",background:"var(--cream2)",borderRadius:99,padding:4,marginBottom:28}}>
            {["login","signup"].map(m=>(
              <button key={m} onClick={()=>{setMode(m);setStep(1)}}
                style={{flex:1,padding:"9px",borderRadius:99,fontFamily:"var(--sans)",fontSize:14,fontWeight:500,
                  background:mode===m?"var(--brown3)":"transparent",
                  color:mode===m?"var(--white)":"var(--muted)",border:"none",cursor:"pointer",
                  transition:"all var(--transition)",textTransform:"capitalize"}}>
                {m}
              </button>
            ))}
          </div>

          {mode==="login" ? (
            <>
              {[["Email","email","email"],["Password","password","password"]].map(([lbl,name,type])=>(
                <div key={name} style={S.field}>
                  <label style={S.label}>{lbl}</label>
                  <input type={type} style={S.input} placeholder={lbl}
                    value={form[name]} onChange={e=>setForm(f=>({...f,[name]:e.target.value}))} />
                </div>
              ))}
              <button disabled={loading} onClick={handleSubmit} className="btn-primary" style={{width:"100%",marginTop:8,padding:"13px",opacity:loading?0.75:1}}>
                {loading ? "Signing In..." : "Sign In"}
              </button>
            </>
          ) : step===1 ? (
            <>
              {/* User type */}
              <div style={S.field}>
                <label style={S.label}>I am a</label>
                <div style={{display:"flex",gap:10}}>
                  {[["student","Student 🎓"],["recruiter","Recruiter 💼"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setForm(f=>({...f,userType:v}))}
                      style={{flex:1,padding:"10px",borderRadius:10,fontFamily:"var(--sans)",fontSize:13,fontWeight:500,
                        background:form.userType===v?"var(--brown3)":"var(--cream2)",
                        color:form.userType===v?"var(--white)":"var(--text)",
                        border:form.userType===v?"none":"1px solid var(--border)",cursor:"pointer"}}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {[["Full Name","name","text"],
                form.userType==="recruiter" ? ["Work email","email","email"] : ["Email","email","email"],
                ["Password","password","password"],
                ["Confirm Password","confirmPassword","password"],
                ["University / Company","university","text"]].map(([lbl,name,type])=>(
                <div key={`${lbl}-${name}`} style={S.field}>
                  <label style={S.label}>{lbl}</label>
                  <input type={type} style={S.input} placeholder={lbl}
                    value={form[name]} onChange={e=>setForm(f=>({...f,[name]:e.target.value}))} />
                </div>
              ))}
              <button disabled={loading} onClick={handleSubmit} className="btn-primary" style={{width:"100%",marginTop:8,padding:"13px",opacity:loading?0.75:1}}>
                Continue →
              </button>
            </>
          ) : (
            <>
              <div style={{fontFamily:"var(--serif)",fontSize:20,color:"var(--brown4)",marginBottom:18}}>
                {form.userType==="recruiter"
                  ? "Professional recruiting profile (LinkedIn-style)"
                  : "Tell us more to personalize your experience"}
              </div>
              {form.userType==="recruiter" ? (
                <>
                  {[
                    ["Your title / role","recruiterTitle","text","Talent Partner, Engineering Manager…"],
                    ["Industry","industry","text","Technology, Finance, Healthcare…"],
                    ["Company size band","companySize","text","e.g. 51–200"],
                    ["Company website","companyWebsite","url","https://"],
                    ["LinkedIn company page","linkedinCompany","url","https://www.linkedin.com/company/…"],
                  ].map(([lbl,name,type,ph])=>(
                    <div key={name} style={S.field}>
                      <label style={S.label}>{lbl}</label>
                      <input type={type==="url"?"url":"text"} style={S.input} placeholder={ph}
                        value={form[name]} onChange={e=>setForm(f=>({...f,[name]:e.target.value}))} />
                    </div>
                  ))}
                  <div style={S.field}>
                    <label style={S.label}>Hiring focus</label>
                    <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                      {["Internships","Software","Data","Product","Business","Research","Remote","Graduate hiring"].map(i=>(
                        <button key={i} type="button" onClick={()=>toggleHiringFocus(i)}
                          style={{padding:"5px 13px",borderRadius:99,fontSize:12,fontWeight:500,cursor:"pointer",
                            fontFamily:"var(--sans)",transition:"all var(--transition)",
                            background:form.hiringFocus.includes(i)?"var(--brown3)":"var(--cream2)",
                            color:form.hiringFocus.includes(i)?"var(--white)":"var(--text)",
                            border:form.hiringFocus.includes(i)?"none":"1px solid var(--border)"}}>
                          {i}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={S.field}>
                    <label style={S.label}>Optional — countries you recruit from</label>
                    <input type="text" style={S.input} placeholder="Pakistan, UAE, Global remote…"
                      value={form.targetCountry} onChange={e=>setForm(f=>({...f,targetCountry:e.target.value}))} />
                  </div>
                </>
              ) : (
                <>
                  {[["Degree Level","degree","text","BSc / MSc / PhD"],
                    ["Major / Field","major","text","Computer Science"],
                    ["Current Country","country","text","Pakistan"],
                    ["Target Study Country","targetCountry","text","UK, Germany, USA"]].map(([lbl,name,type,ph])=>(
                    <div key={name} style={S.field}>
                      <label style={S.label}>{lbl}</label>
                      <input type={type} style={S.input} placeholder={ph}
                        value={form[name]} onChange={e=>setForm(f=>({...f,[name]:e.target.value}))} />
                    </div>
                  ))}
                  <div style={S.field}>
                    <label style={S.label}>Scholarship Interests</label>
                    <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                      {INTERESTS.map(i=>(
                        <button key={i} type="button" onClick={()=>toggleInterest(i)}
                          style={{padding:"5px 13px",borderRadius:99,fontSize:12,fontWeight:500,cursor:"pointer",
                            fontFamily:"var(--sans)",transition:"all var(--transition)",
                            background:form.interests.includes(i)?"var(--brown3)":"var(--cream2)",
                            color:form.interests.includes(i)?"var(--white)":"var(--text)",
                            border:form.interests.includes(i)?"none":"1px solid var(--border)"}}>
                          {i}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              <div style={{display:"flex",gap:10,marginTop:8}}>
                <button type="button" onClick={()=>setStep(1)} className="btn-ghost" style={{flex:1,padding:"13px"}}>← Back</button>
                <button type="button" disabled={loading} onClick={handleSubmit} className="btn-primary" style={{flex:2,padding:"13px",opacity:loading?0.75:1}}>
                  {loading ? "Creating Account..." : "Create Account 🎉"}
                </button>
              </div>
            </>
          )}
          {!!error && (
            <div style={{marginTop:14,padding:"10px 12px",background:"#FCEBE9",border:"1px solid #E7B8B2",borderRadius:10,color:"#8A2E25",fontSize:13}}>
              {error}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
