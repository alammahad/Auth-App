export const G = `
:root {
  --white: #ffffff;
  --cream: #fbf7f0;
  --cream2: #f7ede4;
  --cream3: #f1e7dd;
  --brown1: #a77b4f;
  --brown2: #8f6342;
  --brown3: #6f4e37;
  --brown4: #483425;
  --text: #47392e;
  --muted: #7c6b5d;
  --border: #e6ddd6;
  --shadow: 0 10px 25px rgba(73, 48, 30, 0.08);
  --shadowlg: 0 16px 60px rgba(73, 48, 30, 0.12);
  --radius: 22px;
  --transition: 0.22s ease;
  font-family: "Inter", "System", sans-serif;
}

body {
  margin: 0;
  min-height: 100vh;
  background: var(--cream);
  color: var(--text);
}

button,
input,
textarea {
  font-family: inherit;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}
`;

export const S = {
  authWrap: {
    position: "relative",
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 20px",
    background: "var(--cream)",
  },
  authCard: {
    position: "relative",
    width: "100%",
    maxWidth: 680,
    padding: 32,
    borderRadius: 28,
    background: "var(--white)",
    border: "1px solid var(--border)",
    boxShadow: "0 24px 80px rgba(73, 48, 30, 0.12)",
  },
  field: {
    marginBottom: 18,
  },
  label: {
    display: "block",
    marginBottom: 8,
    fontSize: 13,
    fontWeight: 600,
    color: "var(--brown4)",
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid var(--border)",
    background: "var(--cream)",
    color: "var(--text)",
    fontSize: 14,
    fontFamily: "var(--sans, Inter, system-ui, sans-serif)",
    outline: "none",
  },
  newsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 18,
  },
  newsCard: {
    padding: 20,
    borderRadius: 20,
    border: "1px solid var(--border)",
    background: "var(--white)",
    boxShadow: "var(--shadow)",
    transition: "transform var(--transition), box-shadow var(--transition)",
  },
  postCard: {
    marginBottom: 18,
    padding: 20,
    borderRadius: 22,
    border: "1px solid var(--border)",
    background: "var(--white)",
    boxShadow: "0 18px 45px rgba(73, 48, 30, 0.08)",
  },
  postActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
    alignItems: "center",
  },
  actionBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "11px 14px",
    borderRadius: 14,
    border: "1px solid var(--border)",
    background: "var(--cream2)",
    color: "var(--muted)",
    cursor: "pointer",
    transition: "all var(--transition)",
    fontSize: 13,
    fontWeight: 600,
  },
  profBanner: {
    width: "100%",
    height: 160,
    borderRadius: 22,
    background: "linear-gradient(135deg, rgba(111, 78, 55, 0.14), rgba(251, 247, 240, 0.98))",
    marginBottom: 24,
  },
  botItem: (active) => ({
    background: active ? "var(--brown3)" : "var(--white)",
    color: active ? "var(--white)" : "var(--brown4)",
    border: active ? "1px solid transparent" : "1px solid var(--border)",
  }),
  bubble: (isUser) => ({
    maxWidth: "76%",
    padding: "14px 16px",
    borderRadius: 18,
    background: isUser ? "var(--brown3)" : "var(--cream3)",
    color: isUser ? "var(--white)" : "var(--text)",
    lineHeight: 1.65,
    whiteSpace: "pre-wrap",
    fontSize: 14,
  }),
  msgLayout: {
    display: "grid",
    gridTemplateColumns: "320px 1fr",
    gap: 18,
    height: "100%",
  },
  contactList: {
    padding: 16,
    background: "var(--cream)",
    borderRight: "1px solid var(--border)",
    overflowY: "auto",
  },
};
