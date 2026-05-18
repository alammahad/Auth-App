import { initials } from "../utils";

export function MiniPost({ post }) {
  const text = post.text || "";
  const tag = post.tag || "";
  const img = post.imageUrl || post.image_url || "";
  const name = post.author_name || post.name || "";
  const handle = post.handle || "";

  return (
    <div
      style={{
        background: "var(--white)",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
        padding: 16,
        marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div
          className="avatar"
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "var(--brown2)",
            color: "var(--white)",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {initials(name || handle || "U")}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--brown4)" }}>{name || handle || "Member"}</div>
          {handle && (
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              @{handle}
            </div>
          )}
          {tag && (
            <span
              style={{
                display: "inline-block",
                marginTop: 6,
                padding: "3px 10px",
                borderRadius: 99,
                background: "var(--cream2)",
                color: "var(--brown3)",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {tag}
            </span>
          )}
          <p style={{ fontSize: 14, lineHeight: 1.55, marginTop: 10, whiteSpace: "pre-wrap", color: "var(--text)" }}>{text}</p>
          {img && (
            <img
              src={img}
              alt=""
              style={{ marginTop: 10, maxWidth: "100%", borderRadius: 12, border: "1px solid var(--border)" }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
