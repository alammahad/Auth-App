export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

export const mapMeToUser = (doc) => {
  if (!doc) return null;
  const profile = doc.profile || {};
  const id = String(doc.id ?? doc._id ?? "");
  return {
    id,
    name: doc.name || "",
    email: doc.email || "",
    workEmail: profile.work_email ?? "",
    handle: doc.handle || "",
    avatar: doc.avatar ?? null,
    bio: doc.bio ?? "",
    userType: doc.user_type || "student",
    status: doc.status,
    university: profile.university ?? "",
    degree: profile.degree ?? "",
    major: profile.major ?? "",
    country: profile.country ?? "",
    targetCountry: profile.target_country ?? "",
    interests: Array.isArray(profile.interests) ? profile.interests : [],
    hiringFocus: Array.isArray(profile.hiring_focus) ? profile.hiring_focus : [],
    recruiterTitle: profile.recruiter_title ?? "",
    industry: profile.industry ?? "",
    companySize: profile.company_size ?? "",
    companyWebsite: profile.company_website ?? "",
    linkedinCompanyUrl: profile.linkedin_company_url ?? "",
    cvUrl: profile.cv_url ?? "",
    followers: doc.followers || [],
    following: doc.following || [],
  };
};

export const initials = (text) => {
  if (!text || typeof text !== "string") return "";
  return text
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
};

function timeAgo(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
  return d.toLocaleDateString();
}

function tagStyles(tag) {
  const t = (tag || "").toLowerCase().trim();
  const map = {
    achievement: { tagColor: "#1A7A4A", tagBg: "#E6F9F0" },
    tip: { tagColor: "#6B4A2D", tagBg: "#F5E6D3" },
    question: { tagColor: "#6B4A2D", tagBg: "#EDE9F5" },
    "internship open": { tagColor: "#1A5A7A", tagBg: "#E6F2FA" },
    "scholarship alert": { tagColor: "#7A5A1A", tagBg: "#FBF4E0" },
    experience: { tagColor: "#6B4A2D", tagBg: "#F3EDE6" },
    scholarship: { tagColor: "#1A7A4A", tagBg: "#E6F9F0" },
    internship: { tagColor: "#1A5A7A", tagBg: "#E6F2FA" },
    phd: { tagColor: "#4A2D6B", tagBg: "#F0EBFA" },
    merit: { tagColor: "#1A7A4A", tagBg: "#E6F9F0" },
    "need-based": { tagColor: "#7A3A2D", tagBg: "#FCEBE9" },
    deadline: { tagColor: "#8A5A2D", tagBg: "#FFF6E8" },
    result: { tagColor: "#2D6B4A", tagBg: "#E8FAF2" },
    general: { tagColor: "#6B4A2D", tagBg: "#F3EDE6" },
  };
  return map[t] || { tagColor: "#6B4A2D", tagBg: "#F3EDE6" };
}

/** Maps API post documents to the shape expected by NewsSection / MiniPost */
export const toFrontendPost = (post = {}, currentUserId = "") => {
  const id = post._id ?? post.id ?? "";
  const likedBy = post.liked_by || [];
  const savedBy = post.saved_by || [];
  const comments = post.comments || [];
  const uid = currentUserId ? String(currentUserId) : "";
  const styles = tagStyles(post.tag);

  const commentList = comments.map((c) => ({
    u: c.user_name || c.u || "Member",
    t: c.text || c.t || "",
  }));

  return {
    ...post,
    id,
    user: post.user_name || post.user,
    handle: post.user_handle || post.handle,
    type: post.user_type || post.type,
    avatar: post.user_avatar ?? post.avatar,
    text: post.text,
    tag: post.tag,
    likes: post.likes ?? 0,
    liked: uid ? likedBy.some((x) => String(x) === uid) : false,
    saved: uid ? savedBy.some((x) => String(x) === uid) : false,
    commentList,
    time: post.created_at ? timeAgo(post.created_at) : post.time || "",
    jobPostingId: post.job_posting_id || post.jobPostingId || null,
    imageUrl: post.imageUrl || post.image_url || "",
    ...styles,
  };
};
