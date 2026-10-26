import { useEffect } from "react";
import { T, SCRIPT } from "../theme.js";
import { P, cardLabel } from "../cardPaths.js";
import { PAGES } from "../content.js";
import { CRISIS_RES } from "../../shared/safety.js";

export const VIK_URL = "https://www.vikashan.org";
export const FOOTER_PAGES = [["about","About"],["terms","Terms"],["privacy","Privacy"]];

export function VikLink({color}) {
  return <a href={VIK_URL} target="_blank" rel="noopener noreferrer" style={{color:color||T.purple,textDecoration:"none",fontWeight:500}}>Vikashan</a>;
}

function linkVik(text) {
  const parts = text.split("Vikashan");
  return parts.reduce(function(acc, part, i) {
    if (i === 0) return [part];
    return acc.concat([<VikLink key={i}/>, part]);
  }, []);
}

function useEscape(onClose) {
  useEffect(function(){
    const h = function(e){ if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return function(){ window.removeEventListener("keydown", h); };
  }, [onClose]);
}

export function PageOverlay({page, onClose}) {
  useEscape(onClose);
  const content = PAGES[page];
  if (!content) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={content.title} style={{position:"fixed",inset:0,background:T.bg,zIndex:200,display:"flex",flexDirection:"column",overflowY:"auto"}}>
      <div style={{maxWidth:560,width:"100%",margin:"0 auto",padding:"32px 24px 60px"}}>
        <button onClick={onClose} className="link-btn" style={{color:T.dim,fontSize:12,letterSpacing:2,textTransform:"uppercase",marginBottom:32}}>← back</button>
        <h2 style={{fontSize:30,fontWeight:400,color:T.text,margin:"0 0 32px",fontFamily:SCRIPT}}>{content.title}</h2>
        {content.sections.map(function(s,i) {
          return (
            <div key={i} style={{marginBottom:28}}>
              <h3 style={{fontSize:10,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:T.purple,margin:"0 0 8px"}}>{s.h}</h3>
              <p style={{fontSize:14,lineHeight:1.85,color:T.muted,margin:0}}>{linkVik(s.p)}</p>
            </div>
          );
        })}
        <p style={{fontSize:11,color:T.dim,marginTop:40}}>© <VikLink color={T.dim}/> {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}

export function CrisisOverlay({onClose}) {
  useEscape(onClose);
  return (
    <div role="dialog" aria-modal="true" aria-label="Crisis support" style={{position:"fixed",inset:0,background:"rgba(247,245,255,0.97)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:T.surface,borderRadius:20,maxWidth:380,width:"100%",padding:28,textAlign:"center",border:"1px solid "+T.border}}>
        <div style={{fontSize:32,marginBottom:10}} aria-hidden="true">💙</div>
        <h2 style={{fontSize:18,color:T.text,margin:"0 0 8px",fontWeight:700}}>you're not alone</h2>
        <p style={{fontSize:14,color:T.muted,lineHeight:1.7,marginBottom:20}}>please reach out to someone who can help</p>
        {CRISIS_RES.map(function(r,i){return(
          <div key={i} style={{background:T.bg,border:"1px solid "+T.border,borderRadius:12,padding:"10px 14px",display:"flex",justifyContent:"space-between",marginBottom:8}}>
            <div style={{fontWeight:600,fontSize:13,color:T.text}}>{r.name}</div>
            <a href={"tel:"+r.num.replace(/\s/g,"")} style={{fontWeight:700,fontSize:14,color:T.cyan,textDecoration:"none"}}>{r.num}</a>
          </div>
        );})}
        <button autoFocus onClick={onClose} style={{marginTop:14,background:"none",border:"1px solid "+T.border,borderRadius:999,padding:"9px 24px",fontSize:13,color:T.muted,cursor:"pointer"}}>i'm safe, take me back</button>
      </div>
    </div>
  );
}

export function CardMini({name, pos, active}) {
  const d = P[name] || "M22 16h16v22H22z";
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,flexShrink:0}}>
      <svg width="44" height="62" viewBox="0 0 60 56" role="img" aria-label={name} style={{borderRadius:6,opacity:active?1:0.35,transition:"opacity 0.3s",filter:active?"drop-shadow(0 0 6px rgba(168,85,247,0.4))":"none"}}>
        <rect x="1" y="1" width="58" height="54" rx="6" fill={T.card} stroke={active?T.purple:T.dim} strokeWidth={active?1.5:0.8}/>
        <path d={d} fill="none" stroke={active?T.gold:T.dim} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        <text x="30" y="51" textAnchor="middle" fontSize="6.5" fill={active?T.gold:T.dim}>{cardLabel(name)}</text>
      </svg>
      <div style={{fontSize:7,color:active?T.muted:T.dim,textAlign:"center",maxWidth:48,lineHeight:1.2,textTransform:"uppercase",letterSpacing:0.5}}>{pos}</div>
    </div>
  );
}

export function Divider({label, sub}) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:12,margin:"24px 0 14px"}}>
      <div style={{flex:1,height:1,background:T.border}}/>
      <div style={{textAlign:"center"}}>
        <h2 style={{fontSize:9,letterSpacing:3,color:T.purple,textTransform:"uppercase",fontWeight:700,margin:0}}>{label}</h2>
        {sub && <div style={{fontSize:9,color:T.dim,marginTop:2}}>{sub}</div>}
      </div>
      <div style={{flex:1,height:1,background:T.border}}/>
    </div>
  );
}

// Official sources for the two systems that have one.
export const OFFICIAL_LINKS = [["Gene Keys", "https://genekeys.com"], ["Human Design (Jovian Archive)", "https://www.jovianarchive.com"]];
export const DISCLAIMER = "For reflection and entertainment only. Readings and chart interpretations are generated by AI and can be wrong, so take them with a grain of salt. Nothing here is medical, psychological, legal or financial advice, and it shouldn't be relied on for important decisions.";

export function FooterLinks({onPage, onCrisis}) {
  const small = {fontSize:10.5,color:T.dim,lineHeight:1.7,margin:0};
  return (
    <footer style={{flexShrink:0}}>
      <div style={{maxWidth:560,margin:"0 auto",padding:"14px 20px 4px",textAlign:"center",display:"grid",gap:6}}>
        <p style={small}>{DISCLAIMER}</p>
        <p style={small}>
          Learn from the source: {OFFICIAL_LINKS.map(function(l, i){ return <span key={l[1]}>{i ? " · " : ""}<a href={l[1]} target="_blank" rel="noopener noreferrer" style={{color:T.muted,fontWeight:600}}>{l[0]}</a></span>; })}.
          {" "}Divinatey isn't affiliated with or endorsed by Gene Keys or Jovian Archive.
        </p>
      </div>
      <div style={{padding:"10px 20px",textAlign:"center",fontSize:11,color:T.dim}}>
        in crisis? <a href="tel:131114" style={{color:"#f87171",textDecoration:"none",fontWeight:600}}>Lifeline 13 11 14</a> · <button onClick={onCrisis} className="link-btn" style={{color:"#f87171",fontSize:11}}>all resources</button>
      </div>
      <nav style={{padding:"4px 20px 14px",display:"flex",justifyContent:"center",gap:24}}>
        {FOOTER_PAGES.map(function(item){return(
          <a key={item[0]} href={"/"+item[0]} onClick={function(e){e.preventDefault();onPage(item[0]);}} style={{fontSize:10,color:T.dim,letterSpacing:1,textTransform:"uppercase",textDecoration:"none"}}>{item[1]}</a>
        );})}
      </nav>
    </footer>
  );
}
