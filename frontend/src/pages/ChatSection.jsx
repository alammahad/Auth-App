import { useState, useRef, useEffect } from "react";
import { S } from "../../styles/theme";
import { API_BASE, initials } from "../utils";
import { SPECIALIZED_BOTS } from "../../constants";

export function ChatSection({ user, token }) {
  const [activeBot, setActiveBot] = useState(SPECIALIZED_BOTS[0]);
  const [chats, setChats] = useState({ general:[
    {role:"assistant", text:`Hello ${user.name?.split(" ")[0] || "there"}! I'm SCHLR AI. I can help you find scholarships, review applications, and guide you through the process. What are you looking for today?`}
  ]});
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  const msgs = chats[activeBot.id] || [];

  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:"smooth"}); }, [msgs, loading]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    const updated = [...msgs, {role:"user", text:userMsg}];
    setChats(c=>({...c,[activeBot.id]:updated}));
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          question: userMsg,
          conversation_history: updated.map(m => ({
            role: m.role,
            content: m.text
          })),
          bot_type: activeBot.id
        })
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data.detail || "Request failed");
      }
      let reply = data.answer || "No response received.";
      if (data.warning === "ai_upstream") {
        reply += "\n\n— Note: the language model was unreachable; verify ANTHROPIC_API_KEY in your backend .env.";
      }
      if (Array.isArray(data.sources) && data.sources.length > 0) {
        reply += "\n\nSources:\n" + data.sources.slice(0, 5).map((u) => "• " + u).join("\n");
      }
      setChats(c => ({
        ...c,
        [activeBot.id]: [...updated, { role: "assistant", text: reply }]
      }));
    } catch (err) {
      setChats(c => ({
        ...c,
        [activeBot.id]: [
          ...updated,
          { role: "assistant", text: err.message || "Network error — is the FastAPI server running on port 8000?" }
        ]
      }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{height:"calc(100vh - 62px - 56px)", display:"flex", gap:20}}>
      {/* Bot selector sidebar */}
      <div style={{width:220,display:"flex",flexDirection:"column",gap:6}}>
        <div style={{fontFamily:"var(--serif)",fontSize:17,color:"var(--brown4)",marginBottom:8,paddingLeft:4}}>
          AI Advisors
        </div>
        {SPECIALIZED_BOTS.map(bot=>(
          <div key={bot.id} onClick={()=>setActiveBot(bot)}
            style={{...S.botItem(activeBot.id===bot.id),padding:"12px 14px",borderRadius:12,
              cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:20}}>{bot.icon}</span>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:"var(--brown4)"}}>{bot.name}</div>
              <div style={{fontSize:11,color:"var(--muted)"}}>{bot.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Chat area */}
      <div style={{flex:1,display:"flex",flexDirection:"column",background:"var(--white)",
        borderRadius:"var(--radius)",border:"1px solid var(--border)",overflow:"hidden"}}>
        {/* Header */}
        <div style={{padding:"16px 20px",borderBottom:"1px solid var(--border)",
          display:"flex",alignItems:"center",gap:12,background:"var(--cream)"}}>
          <span style={{fontSize:24}}>{activeBot.icon}</span>
          <div>
            <div style={{fontWeight:600,color:"var(--brown4)"}}>{activeBot.name}</div>
            <div style={{fontSize:12,color:"var(--muted)"}}>{activeBot.desc}</div>
          </div>
          <div style={{marginLeft:"auto",padding:"4px 12px",borderRadius:99,background:"var(--cream2)",
            color:"var(--brown4)",fontSize:11,fontWeight:600}}>● Online</div>
        </div>

        {/* Messages */}
        <div style={{flex:1,overflowY:"auto",padding:"20px",display:"flex",flexDirection:"column",gap:14}}>
          {msgs.map((m,i)=>(
            <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",gap:10,alignItems:"flex-end"}}>
              {m.role==="assistant" && (
                <div style={{width:32,height:32,borderRadius:"50%",background:"var(--cream3)",
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>
                  {activeBot.icon}
                </div>
              )}
              <div style={S.bubble(m.role==="user")}>{m.text}</div>
              {m.role==="user" && (
                <div className="avatar" style={{width:32,height:32,fontSize:12,background:"var(--brown2)",color:"var(--white)"}}>
                  {initials(user.name||"U")}
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <div style={{width:32,height:32,borderRadius:"50%",background:"var(--cream3)",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{activeBot.icon}</div>
              <div style={{...S.bubble(false),display:"flex",gap:5,alignItems:"center"}}>
                {[0,1,2].map(i=>(
                  <div key={i} style={{width:7,height:7,borderRadius:"50%",background:"var(--brown2)",
                    animation:`bounce 1.2s ${i*0.2}s ease-in-out infinite`}} />
                ))}
              </div>
            </div>
          )}
          <div ref={endRef}/>
        </div>

        {/* Input */}
        <div style={{padding:"14px 16px",borderTop:"1px solid var(--border)",display:"flex",gap:10}}>
          <input value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()}
            placeholder={`Ask ${activeBot.name} anything…`}
            style={{flex:1,background:"var(--cream)",border:"1.5px solid var(--border)",
              borderRadius:99,padding:"11px 18px",fontSize:14,color:"var(--text)"}} />
          <button onClick={send} disabled={loading}
            style={{background:loading?"var(--cream3)":"var(--brown3)",color:"var(--white)",
              borderRadius:99,padding:"11px 22px",fontSize:14,fontWeight:500,border:"none",cursor:"pointer",
              transition:"background var(--transition)"}}>
            Send
          </button>
        </div>
      </div>
      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-8px)} }
      `}</style>
    </div>
  );
}
