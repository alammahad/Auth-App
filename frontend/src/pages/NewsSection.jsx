import { useState, useEffect, useCallback } from "react";
import { S } from "../../styles/theme";
import { API_BASE, initials, toFrontendPost } from "../utils";
import { SEED_POSTS, SEED_NEWS, POST_TAGS } from "../../constants";

const RECRUITER_POST_TAGS = ["Internship open", "Experience", "Question", "Tip"];

export function NewsSection({ user, token, onPostsUpdated, feedVariant = "student", onUserRefresh }) {
  const isRecruiterFeed = feedVariant === "recruiter";

  const [tab, setTab] = useState(isRecruiterFeed ? "community" : "news");
  const [posts, setPosts] = useState([]);
  const [postError, setPostError] = useState("");
  const [myJobs, setMyJobs] = useState([]);
  const [linkedJobId, setLinkedJobId] = useState("");
  const [applyBusy, setApplyBusy] = useState(null);
  const [applyMsg, setApplyMsg] = useState({});

  const auth = { Authorization: `Bearer ${token}` };

  const loadPosts = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE}/posts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      const rawPosts = Array.isArray(data) ? data : data.posts || [];
      const mapped = rawPosts.map((p) => toFrontendPost(p, user.id));
      setPosts(mapped);
      onPostsUpdated?.(mapped);
    } catch {
      setPosts(SEED_POSTS);
      onPostsUpdated?.(SEED_POSTS);
    }
  }, [token, user.id, onPostsUpdated]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    if (!isRecruiterFeed || !token) return;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/recruiter/jobs/me`, { headers: auth });
        const d = await r.json().catch(() => ({}));
        setMyJobs(Array.isArray(d.jobs) ? d.jobs : []);
      } catch {
        setMyJobs([]);
      }
    })();
  }, [isRecruiterFeed, token]);

  const [newPost, setNewPost] = useState("");
  const [postTag, setPostTag] = useState(isRecruiterFeed ? "Internship open" : "Achievement");
  const [postImageFile, setPostImageFile] = useState(null);
  const [postImagePreview, setPostImagePreview] = useState(null);
  const [uploadingPic, setUploadingPic] = useState(false);
  const [openComments, setOpenComments] = useState(null);
  const [commentInput, setCommentInput] = useState("");

  const likePost = async (id) => {
    setPostError("");
    const resp = await fetch(`${API_BASE}/posts/${id}/like`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      setPostError(data.detail || "Unable to like post.");
      return;
    }
    loadPosts();
  };

  const savePost = async (id) => {
    setPostError("");
    const resp = await fetch(`${API_BASE}/posts/${id}/save`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      setPostError(data.detail || "Unable to save post.");
      return;
    }
    loadPosts();
  };

  const uploadPostImageIfNeeded = async () => {
    if (!postImageFile) return null;
    setUploadingPic(true);
    try {
      const fd = new FormData();
      fd.append("file", postImageFile);
      const resp = await fetch(`${API_BASE}/upload/image?folder=posts`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Image upload failed — add Cloudinary keys to backend/.env (CLOUDINARY_CLOUD_NAME, API_KEY, API_SECRET)."
        );
      }
      return data.url || null;
    } finally {
      setUploadingPic(false);
    }
  };

  const submitPost = async () => {
    if (!newPost.trim() && !postImageFile) {
      setPostError("Please add text or attach an image.");
      return;
    }
    setPostError("");
    let imageUrl = null;
    try {
      imageUrl = await uploadPostImageIfNeeded();
    } catch (e) {
      setPostError(e.message || "Upload failed.");
      return;
    }
    const body = { text: newPost.trim(), tag: postTag };
    if (imageUrl) body.image_url = imageUrl;
    if (isRecruiterFeed && linkedJobId) body.job_posting_id = linkedJobId;

    const resp = await fetch(`${API_BASE}/posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      setPostError(typeof data.detail === "string" ? data.detail : "Unable to create post.");
      return;
    }
    setNewPost("");
    setLinkedJobId("");
    setPostImageFile(null);
    if (postImagePreview) URL.revokeObjectURL(postImagePreview);
    setPostImagePreview(null);
    loadPosts();
  };

  const onPickPostImage = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (postImagePreview) URL.revokeObjectURL(postImagePreview);
    setPostImageFile(f);
    setPostImagePreview(URL.createObjectURL(f));
  };

  const addComment = async (id) => {
    if (!commentInput.trim()) return;
    setPostError("");
    const resp = await fetch(`${API_BASE}/posts/${id}/comment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ text: commentInput }),
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      setPostError(data.detail || "Unable to add comment.");
      return;
    }
    setCommentInput("");
    loadPosts();
  };

  const applyCvToLinkedJob = async (jobPostingId) => {
    if (user.userType !== "student") return;
    setApplyBusy(jobPostingId);
    setApplyMsg((m) => ({ ...m, [jobPostingId]: "" }));
    try {
      let cvUrl = (user.cvUrl || "").trim();
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp";
      const picked = await new Promise((resolve) => {
        input.onchange = () => resolve(input.files?.[0] || null);
        input.click();
      });
      if (picked) {
        const fd = new FormData();
        fd.append("file", picked);
        fd.append("notes", "Applied via Community");
        const r = await fetch(`${API_BASE}/jobs/${jobPostingId}/apply-with-cv`, {
          method: "POST",
          headers: auth,
          body: fd,
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Application failed.");
        setApplyMsg((m) => ({ ...m, [jobPostingId]: "Application submitted." }));
        return;
      }
      if (!cvUrl) throw new Error("Add a résumé on your profile or choose a file when applying.");

      const r = await fetch(`${API_BASE}/applications`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: jobPostingId,
          item_type: "job_posting",
          status: "applied",
          cv_url: cvUrl,
          notes: "Applied via Community",
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Application failed.");
      setApplyMsg((m) => ({ ...m, [jobPostingId]: "Application submitted." }));
    } catch (e) {
      setApplyMsg((m) => ({ ...m, [jobPostingId]: e.message || "Error" }));
    } finally {
      setApplyBusy(null);
    }
  };

  const applyWithSavedCv = async (jobPostingId) => {
    if (user.userType !== "student") return;
    const cvUrl = (user.cvUrl || "").trim();
    if (!cvUrl) {
      await applyCvToLinkedJob(jobPostingId);
      return;
    }
    setApplyBusy(jobPostingId);
    setApplyMsg((m) => ({ ...m, [jobPostingId]: "" }));
    try {
      const r = await fetch(`${API_BASE}/applications`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: jobPostingId,
          item_type: "job_posting",
          status: "applied",
          cv_url: cvUrl,
          notes: "Applied via Community",
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Application failed.");
      setApplyMsg((m) => ({ ...m, [jobPostingId]: "Application submitted." }));
    } catch (e) {
      setApplyMsg((m) => ({ ...m, [jobPostingId]: e.message || "Error" }));
    } finally {
      setApplyBusy(null);
    }
  };

  const tagColors = { online: "#1A7A4A", offline: "#A32D2D" };

  const tagButtons = isRecruiterFeed ? RECRUITER_POST_TAGS : POST_TAGS;

  return (
    <div>
      {!isRecruiterFeed && (
        <div
          style={{
            display: "flex",
            gap: 4,
            marginBottom: 24,
            background: "var(--cream2)",
            borderRadius: 99,
            padding: 4,
            width: "fit-content",
          }}
        >
          {["news", "community"].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{
                padding: "8px 24px",
                borderRadius: 99,
                fontFamily: "var(--sans)",
                fontSize: 14,
                fontWeight: 500,
                border: "none",
                cursor: "pointer",
                background: tab === t ? "var(--brown3)" : "transparent",
                color: tab === t ? "var(--white)" : "var(--muted)",
                textTransform: "capitalize",
                transition: "all var(--transition)",
              }}
            >
              {t === "news" ? "📰 Latest News" : "🌐 Community"}
            </button>
          ))}
        </div>
      )}

      {isRecruiterFeed && (
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontFamily: "var(--serif)", fontSize: 22, color: "var(--brown4)", marginBottom: 8 }}>Community</h2>
          <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6 }}>
            Share updates and optionally link one of your published roles so students can apply with a CV from the same thread.
          </p>
        </div>
      )}

      {tab === "news" && !isRecruiterFeed ? (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            {[...new Set(SEED_NEWS.map((n) => n.site))].map((site) => (
              <div
                key={site}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 14px",
                  borderRadius: 99,
                  background: "var(--white)",
                  border: "1px solid var(--border)",
                  fontSize: 12,
                }}
              >
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: tagColors.online }} />
                <span style={{ color: "var(--muted)" }}>{site}</span>
                <span style={{ color: tagColors.online, fontWeight: 600 }}>Online</span>
              </div>
            ))}
          </div>

          <div style={S.newsGrid}>
            {SEED_NEWS.map((n) => (
              <div
                key={n.id}
                style={S.newsCard}
                onMouseEnter={(e) => (e.currentTarget.style.cssText += ";transform:translateY(-3px);box-shadow:var(--shadowlg)")}
                onMouseLeave={(e) => (e.currentTarget.style.cssText += ";transform:none;box-shadow:var(--shadow)")}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--muted)" }}>
                    <span>{n.favicon}</span> {n.site}
                  </div>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{n.time}</span>
                </div>
                <div
                  style={{
                    padding: "4px 10px",
                    borderRadius: 99,
                    background: "var(--cream2)",
                    color: "var(--brown3)",
                    fontSize: 11,
                    fontWeight: 600,
                    width: "fit-content",
                    letterSpacing: "0.04em",
                  }}
                >
                  {n.tag}
                </div>
                <div style={{ fontFamily: "var(--serif)", fontSize: 17, color: "var(--brown4)", lineHeight: 1.3 }}>{n.title}</div>
                <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>{n.snippet}</div>
                <button
                  style={{
                    marginTop: 4,
                    color: "var(--brown3)",
                    fontSize: 13,
                    fontWeight: 500,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    padding: 0,
                    fontFamily: "var(--sans)",
                  }}
                >
                  Read more →
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {!!postError && (
            <div
              style={{
                marginBottom: 16,
                padding: "10px 12px",
                background: "#FCEBE9",
                border: "1px solid #E7B8B2",
                borderRadius: 10,
                color: "#8A2E25",
                fontSize: 13,
              }}
            >
              {postError}
            </div>
          )}
          <div
            style={{
              background: "var(--white)",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              padding: "20px",
              marginBottom: 24,
            }}
          >
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div className="avatar" style={{ width: 40, height: 40, background: "var(--brown2)", color: "var(--white)", fontSize: 14 }}>
                {initials(user.name || "U")}
              </div>
              <div style={{ flex: 1 }}>
                <textarea
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  placeholder={
                    isRecruiterFeed
                      ? "Highlight your role, team, or how candidates should think about this opening…"
                      : "Share a scholarship tip, achievement, or question…"
                  }
                  rows={3}
                  style={{
                    width: "100%",
                    background: "var(--cream)",
                    border: "1.5px solid var(--border)",
                    borderRadius: 12,
                    padding: "12px 16px",
                    fontSize: 14,
                    resize: "none",
                    color: "var(--text)",
                    fontFamily: "var(--sans)",
                  }}
                />
                {isRecruiterFeed && (
                  <div style={{ marginTop: 12 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--brown3)", display: "block", marginBottom: 6 }}>
                      Link published job / internship (optional)
                    </label>
                    <select
                      value={linkedJobId}
                      onChange={(e) => setLinkedJobId(e.target.value)}
                      style={{
                        width: "100%",
                        maxWidth: 420,
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1.5px solid var(--border)",
                        background: "var(--cream)",
                        fontFamily: "var(--sans)",
                        fontSize: 14,
                      }}
                    >
                      <option value="">— No job linked —</option>
                      {(myJobs || []).filter((j) => j.status === "active" || j.status == null).map((j) => (
                        <option key={j._id} value={j._id}>
                          {j.title} ({j.employment_type})
                        </option>
                      ))}
                    </select>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
                      Students will see an “Apply with CV” action on this post when a role is linked.
                    </div>
                  </div>
                )}
                <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
                  <label
                    style={{
                      fontSize: 13,
                      color: "var(--muted)",
                      cursor: "pointer",
                      padding: "8px 14px",
                      borderRadius: 10,
                      border: "1px dashed var(--brown1)",
                      background: "var(--cream2)",
                    }}
                  >
                    📷 Attach photo
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: "none" }} onChange={onPickPostImage} />
                  </label>
                  {postImagePreview && (
                    <div style={{ position: "relative" }}>
                      <img src={postImagePreview} alt="" style={{ maxHeight: 100, borderRadius: 10, border: "1px solid var(--border)" }} />
                      <button
                        type="button"
                        onClick={() => {
                          setPostImageFile(null);
                          URL.revokeObjectURL(postImagePreview);
                          setPostImagePreview(null);
                        }}
                        style={{ marginLeft: 8, fontSize: 12, color: "var(--brown3)", background: "none", border: "none", cursor: "pointer" }}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                    {tagButtons.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setPostTag(t)}
                        style={{
                          padding: "4px 12px",
                          borderRadius: 99,
                          fontSize: 12,
                          fontWeight: 500,
                          fontFamily: "var(--sans)",
                          cursor: "pointer",
                          transition: "all var(--transition)",
                          background: postTag === t ? "var(--brown3)" : "var(--cream2)",
                          color: postTag === t ? "var(--white)" : "var(--text)",
                          border: "none",
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <button onClick={submitPost} disabled={uploadingPic} className="btn-primary" style={{ padding: "9px 22px", opacity: uploadingPic ? 0.7 : 1 }}>
                    {uploadingPic ? "Uploading…" : "Post"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {posts.map((post) => (
            <div key={post.id} style={S.postCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div
                    className="avatar"
                    style={{
                      width: 42,
                      height: 42,
                      background: post.type === "recruiter" ? "var(--brown3)" : "var(--brown1)",
                      color: "var(--white)",
                      fontSize: 14,
                      overflow: "hidden",
                    }}
                  >
                    {typeof post.avatar === "string" && post.avatar.startsWith("http") ? (
                      <img src={post.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      post.avatar || initials(post.user)
                    )}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--brown4)", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                      {post.user}
                      {post.type === "recruiter" && (
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 99,
                            background: "var(--brown4)",
                            color: "var(--white)",
                            fontSize: 10,
                            fontWeight: 600,
                            letterSpacing: "0.05em",
                          }}
                        >
                          RECRUITER
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      @{post.handle} · {post.time}
                    </div>
                  </div>
                </div>
                <span
                  style={{
                    padding: "3px 12px",
                    borderRadius: 99,
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    background: post.tagBg,
                    color: post.tagColor,
                  }}
                >
                  {post.tag}
                </span>
              </div>
              <p style={{ marginTop: 14, color: "var(--text)", lineHeight: 1.65, fontSize: 14 }}>{post.text}</p>
              {post.jobPostingId && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: "var(--cream2)",
                    border: "1px solid var(--cream3)",
                    fontSize: 13,
                    color: "var(--brown3)",
                  }}
                >
                  🔗 Linked recruiter opening — apply with your SCHLR CV below.
                </div>
              )}
              {post.imageUrl && (
                <img
                  src={post.imageUrl}
                  alt=""
                  style={{ marginTop: 12, width: "100%", maxHeight: 420, objectFit: "cover", borderRadius: 12, border: "1px solid var(--border)" }}
                />
              )}
              {user.userType === "student" && post.jobPostingId && (
                <div
                  style={{
                    marginTop: 14,
                    padding: 14,
                    borderRadius: 12,
                    background: "#F8F6F2",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--brown4)", marginBottom: 10 }}>Apply to this opening with your CV</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                    <button
                      type="button"
                      disabled={applyBusy === post.jobPostingId}
                      className="btn-primary"
                      style={{ padding: "9px 18px", opacity: applyBusy === post.jobPostingId ? 0.75 : 1 }}
                      onClick={() => applyWithSavedCv(post.jobPostingId)}
                    >
                      {applyBusy === post.jobPostingId ? "Submitting…" : "Submit CV (saved profile)"}
                    </button>
                    <button type="button" className="btn-ghost" disabled={applyBusy === post.jobPostingId} onClick={() => applyCvToLinkedJob(post.jobPostingId)}>
                      Upload different PDF & apply
                    </button>
                  </div>
                  {applyMsg[post.jobPostingId] && (
                    <div
                      style={{
                        marginTop: 10,
                        fontSize: 13,
                        color: applyMsg[post.jobPostingId].includes("Error") || applyMsg[post.jobPostingId].includes("failed") ? "#8A2E25" : "#1A7A4A",
                      }}
                    >
                      {applyMsg[post.jobPostingId]}
                    </div>
                  )}
                </div>
              )}
              <div style={S.postActions}>
                <button type="button" onClick={() => likePost(post.id)} style={{ ...S.actionBtn, color: post.liked ? "var(--brown3)" : "var(--muted)" }}>
                  <span style={{ fontSize: 16 }}>{post.liked ? "♥" : "♡"}</span> {post.likes}
                </button>
                <button type="button" onClick={() => setOpenComments(openComments === post.id ? null : post.id)} style={S.actionBtn}>
                  <span style={{ fontSize: 16 }}>💬</span> {post.commentList?.length || 0}
                </button>
                <button type="button" onClick={() => savePost(post.id)} style={{ ...S.actionBtn, color: post.saved ? "var(--brown3)" : "var(--muted)", marginLeft: "auto" }}>
                  <span style={{ fontSize: 16 }}>{post.saved ? "🔖" : "🏷"}</span> {post.saved ? "Saved" : "Save"}
                </button>
              </div>
              {openComments === post.id && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                  {(post.commentList || []).map((c, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-start" }}>
                      <div className="avatar" style={{ width: 30, height: 30, background: "var(--cream3)", fontSize: 11 }}>
                        {initials(c.u)}
                      </div>
                      <div style={{ background: "var(--cream)", borderRadius: 10, padding: "9px 14px", flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--brown4)", marginBottom: 3 }}>{c.u}</div>
                        <div style={{ fontSize: 13, color: "var(--text)" }}>{c.t}</div>
                      </div>
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                    <input
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addComment(post.id)}
                      placeholder="Write a comment…"
                      style={{
                        flex: 1,
                        background: "var(--cream)",
                        border: "1.5px solid var(--border)",
                        borderRadius: 10,
                        padding: "9px 14px",
                        fontSize: "14px",
                        color: "var(--text)",
                      }}
                    />
                    <button type="button" onClick={() => addComment(post.id)} className="btn-primary" style={{ padding: "9px 18px" }}>
                      Reply
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
