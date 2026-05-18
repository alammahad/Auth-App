import { S, G } from "../../styles/theme";

export function LandingPage({ onChoose }) {
  return (
    <>
      <style>{G}</style>
      <div style={S.authWrap}>
        <div style={{position:"absolute",top:-80,right:-80,width:360,height:360,borderRadius:"50%",
          background:"radial-gradient(circle, var(--cream3) 0%, transparent 70%)",opacity:0.7}} />
        <div style={{position:"absolute",bottom:-60,left:-60,width:260,height:260,borderRadius:"50%",
          background:"radial-gradient(circle, var(--brown1) 0%, transparent 70%)",opacity:0.25}} />

        <div style={{...S.authCard, maxWidth:560}}>
          <div style={{textAlign:"center"}}>
            <div style={{fontFamily:"var(--serif)",fontSize:48,color:"var(--brown4)",fontStyle:"italic"}}>SCHLR</div>
            <div style={{fontSize:12,color:"var(--muted)",letterSpacing:"0.12em",marginTop:2}}>SCHOLARSHIP COMMUNITY</div>
            <div style={{marginTop:18,fontSize:15,color:"var(--muted)"}}>
              Discover scholarships, connect with peers, and grow your academic career.
            </div>
          </div>
          <div style={{display:"flex",gap:12,justifyContent:"center",marginTop:28}}>
            <button className="btn-primary" style={{padding:"12px 28px"}} onClick={() => onChoose("signup")}>Sign Up</button>
            <button className="btn-ghost" style={{padding:"12px 28px"}} onClick={() => onChoose("login")}>Sign In</button>
          </div>
        </div>
      </div>
    </>
  );
}
