import { useState, useRef, useEffect, useCallback } from "react";
import { T, SCRIPT, GRAD } from "./theme.js";
import { PAGES } from "./content.js";
import { detectCrisis } from "../shared/safety.js";
import { drawReading, interpret, askOracle, oracleErrorText, getSystems, getConfig } from "./api.js";
import { PageOverlay, CrisisOverlay, CardMini, Divider, FooterLinks, VikLink } from "./components/common.jsx";
import { ChartScreen, ChartNav, CHART_SYSTEMS } from "./components/ChartScreen.jsx";
import { AccountScreen } from "./components/AccountScreen.jsx";
import { ChatTeaser, SuggestedChips } from "./components/ChatTeaser.jsx";
import { useAuth } from "./auth.js";
import { PREVIEW, routePath, href } from "./preview.js";

const now = () => new Date().toLocaleTimeString("en-AU",{hour:"2-digit",minute:"2-digit"});
const hexChar = n => n ? String.fromCodePoint(0x4DC0+n-1) : "?";
const lineGlyph = v => ({6:"— × —",7:"———",8:"— —",9:"——○"}[v]||"—");
const INTERPRET_STEPS = ["consulting the I Ching ✦","drawing the Tarot ✦","weaving the synthesis ✦"];

// Overlay pages live at /about, /terms and /privacy so they can be linked to.
const pageFromPath = () => {
  const p = routePath();
  return PAGES[p] ? p : null;
};

// Chart screens live at /gene-keys, /human-design, /natal and /vedic; the account at /account.
const chartFromPath = () => {
  const p = routePath();
  return p === "account" || CHART_SYSTEMS.some(c => c.id === p) ? p : null;
};

function useChartRoute() {
  const [chart, setChart] = useState(chartFromPath);
  useEffect(function(){
    const h = function(){ setChart(chartFromPath()); };
    window.addEventListener("popstate", h);
    return function(){ window.removeEventListener("popstate", h); };
  }, []);
  useEffect(function(){
    const c = CHART_SYSTEMS.find(x => x.id === chart);
    if (c) document.title = c.label + " · Divinatey";
    else if (chart === "account") document.title = "Account · Divinatey";
  }, [chart]);
  // Keeps the URL hash: sign-in and password-reset links arrive on /account with tokens in it.
  const go = useCallback(function(id){ window.history.pushState(null, "", href(id)); setChart(id); }, []);
  return [chart, go];
}

function usePage() {
  const [page, setPage] = useState(pageFromPath);
  useEffect(function(){
    const h = function(){ setPage(pageFromPath()); };
    window.addEventListener("popstate", h);
    return function(){ window.removeEventListener("popstate", h); };
  }, []);
  useEffect(function(){
    document.title = page ? PAGES[page].title + " · Divinatey" : "Divinatey — I Ching + Tarot";
  }, [page]);
  const open = useCallback(function(p){ window.history.pushState(null, "", href(p)); setPage(p); }, []);
  const close = useCallback(function(){ window.history.pushState(null, "", href("")); setPage(null); }, []);
  return [page, open, close];
}

// Shown on every screen under /preview.
function PreviewBanner() {
  const [on, setOn] = useState(true);
  useEffect(function(){ getConfig().then(function(c){ setOn(c.preview !== false); }).catch(function(){}); }, []);
  return (
    <div role="note" style={{flexShrink:0,background:GRAD,color:"#fff",fontSize:12,lineHeight:1.5,padding:"7px 16px",textAlign:"center",fontWeight:600,letterSpacing:0.2}}>
      {on ? "Preview: paid features are unlocked for testing (no daily chart limit, chat with the oracle, saving when signed in). "
          : "The paid preview is switched off right now. "}
      <a href="/" style={{color:"#fff",textDecoration:"underline"}}>Go to the main site</a>
    </div>
  );
}

const primaryBtn = {background:GRAD,border:"none",borderRadius:999,color:"#fff",fontWeight:700,cursor:"pointer",letterSpacing:0.5};

export default function App() {
  const [phase, setPhase] = useState("splash"); // splash | loading | interpreting | ready
  const [draw, setDraw] = useState(null);       // {seed, source, reading}
  const [interp, setInterp] = useState(null);
  const [interpError, setInterpError] = useState(null);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState(null);
  const [crisis, setCrisis] = useState(false);
  const [page, openPage, closePageRaw] = usePage();
  const [chart, goChart] = useChartRoute();
  const [systems, setSystems] = useState(null);
  const auth = useAuth();
  const [prefill, setPrefill] = useState(null);
  const canChat = PREVIEW || !!(auth.me && auth.me.plan === "paid");
  const teaserRef = useRef(null);
  const [pulse, setPulse] = useState(false);
  const showTeaser = useCallback(function(){
    if (teaserRef.current) teaserRef.current.scrollIntoView({behavior:"smooth", block:"center"});
    setPulse(false); setTimeout(function(){ setPulse(true); }, 30);
  }, []);
  const openSaved = useCallback(function(c){ setPrefill(c); goChart(c.system); }, [goChart]);
  const accountBtn = auth.enabled && <button onClick={function(){goChart("account");}} style={{fontSize:12,color:T.muted,background:"none",border:"1px solid "+T.border,borderRadius:999,padding:"5px 14px",cursor:"pointer",fontWeight:600}}>{auth.session ? "account" : "sign in"}</button>;
  useEffect(function(){ if (chart && chart !== "account" && !systems) getSystems().then(setSystems).catch(function(){}); }, [chart, systems]);
  // Closing an overlay page returns to the screen it was opened from.
  const closePage = useCallback(function(){ closePageRaw(); if (chart) window.history.replaceState(null, "", href(chart)); }, [closePageRaw, chart]);
  const drawId = useRef(0);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(function(){ bottomRef.current && bottomRef.current.scrollIntoView({behavior:"smooth"}); }, [msgs, chatLoading, interp]);

  useEffect(function(){
    if (phase !== "interpreting") return;
    let i = 0;
    setLoadingMsg(INTERPRET_STEPS[0]);
    const t = setInterval(function(){ i = Math.min(i+1, INTERPRET_STEPS.length-1); setLoadingMsg(INTERPRET_STEPS[i]); }, 2600);
    return function(){ clearInterval(t); };
  }, [phase]);

  const runInterpret = async function(d, id) {
    setPhase("interpreting"); setInterpError(null);
    try {
      const result = await interpret(d.seed);
      if (id !== drawId.current) return;
      setInterp(result);
    } catch (err) {
      if (id !== drawId.current) return;
      setInterpError(oracleErrorText(err));
    }
    setPhase("ready");
  };

  const startDraw = async function() {
    const id = ++drawId.current;
    setPhase("loading"); setMsgs([]); setInterp(null); setInterpError(null); setChatError(null); setDraw(null);
    setLoadingMsg("checking in with the universe ✦");
    try {
      const d = await drawReading();
      if (id !== drawId.current) return;
      setDraw(d);
      await runInterpret(d, id);
    } catch (err) {
      if (id !== drawId.current) return;
      setInterpError(oracleErrorText(err));
      setPhase("ready");
    }
  };

  const sendChat = async function(text) {
    if (detectCrisis(text)) setCrisis(true);
    const history = [...msgs, {role:"user",text,ts:now()}];
    const id = drawId.current;
    setMsgs(history); setChatLoading(true); setChatError(null);
    try {
      const { reply } = await askOracle(draw.seed, interp && interp.synthesis, history);
      if (id !== drawId.current) return;
      setMsgs(function(p){ return [...p, {role:"assistant",text:reply,ts:now()}]; });
    } catch (err) {
      if (id !== drawId.current) return;
      // Drop the unanswered message so the conversation stays well-formed.
      setMsgs(msgs); setInput(text); setChatError(oracleErrorText(err));
    } finally {
      if (id === drawId.current) setChatLoading(false);
    }
    setTimeout(function(){ inputRef.current && inputRef.current.focus(); }, 80);
  };

  const submit = function() {
    if (input.trim() && !chatLoading) { sendChat(input.trim()); setInput(""); if (inputRef.current) inputRef.current.style.height = "auto"; }
  };

  const overlays = <>
    {page && <PageOverlay page={page} onClose={closePage}/>}
    {crisis && <CrisisOverlay onClose={function(){setCrisis(false);}}/>}
  </>;

  // ── CHARTS ──────────────────────────────────────────────────────────────────
  if (chart) return (
    <div className="app-shell">
      {PREVIEW && <PreviewBanner/>}
      <header style={{padding:"12px 18px",borderBottom:"1px solid "+T.border,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexShrink:0,background:T.surface,flexWrap:"wrap"}}>
        <button className="link-btn" onClick={function(){goChart(null);}} style={{fontSize:22,color:T.text,letterSpacing:1,fontFamily:SCRIPT}}>Divinatey</button>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>{accountBtn}<button onClick={function(){setCrisis(true);}} aria-label="Crisis support" style={{fontSize:11,color:"#f87171",background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:999,padding:"4px 10px",cursor:"pointer"}}>🆘</button></div>
      </header>
      <main style={{flex:1,overflowY:"auto"}}>
        <div style={{maxWidth:chart==="account"?560:980,margin:"0 auto",padding:"14px 14px 24px"}}>
          <ChartNav current={chart} onNav={goChart}/>
          {chart === "account"
            ? <AccountScreen auth={auth} onOpenChart={openSaved}/>
            : <ChartScreen system={chart} meta={systems} auth={auth} canChat={canChat} onAccount={function(){goChart("account");}} onCrisis={function(){setCrisis(true);}} prefill={prefill} onPrefillUsed={function(){setPrefill(null);}} onOpenSaved={openSaved} onSignIn={function(){goChart("account");}}/>}
          <div style={{marginTop:18}}><FooterLinks onPage={openPage} onCrisis={function(){setCrisis(true);}}/></div>
        </div>
      </main>
      {overlays}
    </div>
  );

  // ── SPLASH ──────────────────────────────────────────────────────────────────
  if (phase==="splash") return (
    <div className="app-shell">
      {PREVIEW && <PreviewBanner/>}
      {auth.enabled && <div style={{position:"absolute",top:"max(12px, env(safe-area-inset-top))",right:16}}>{accountBtn}</div>}
      <main style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 24px",textAlign:"center"}}>
        <h1 style={{fontSize:58,fontWeight:400,color:T.text,margin:"0 0 6px",lineHeight:1.1,letterSpacing:2,fontFamily:SCRIPT}}>Divinatey</h1>
        <p style={{fontSize:14,color:T.muted,margin:"0 0 8px"}}>what does the universe know?</p>
        <p style={{fontSize:13,color:T.dim,lineHeight:2.2,maxWidth:280,margin:"0 0 48px"}}>I Ching + Tarot drawn from this exact moment in time — independently, blind to your question</p>
        <p style={{fontSize:13,color:T.muted,margin:"0 0 20px",fontStyle:"italic",fontFamily:"Georgia,serif"}}>Think of a question for the oracle — or write it down — then draw.</p>
        <button onClick={startDraw} style={{...primaryBtn,padding:"16px 44px",fontSize:16}}>draw my reading ✦</button>
        <p style={{marginTop:20,fontSize:10,color:T.dim,letterSpacing:2,textTransform:"uppercase"}}>I Ching · Tarot</p>
        <p style={{marginTop:28,fontSize:13,color:T.muted,margin:"28px 0 10px"}}>or open your chart</p>
        <ChartNav hideDraw onNav={goChart}/>
        <p style={{marginTop:16,fontSize:12,color:T.dim,lineHeight:1.8}}>
          Prefer a human? Get coaching, psychotherapy and intuitive guidance with <VikLink/>.
        </p>
      </main>
      <FooterLinks onPage={openPage} onCrisis={function(){setCrisis(true);}}/>
      {overlays}
    </div>
  );

  const reading = draw && draw.reading;
  const tarotReady = !!(interp && interp.tarot && interp.tarot.length);

  // ── READING ─────────────────────────────────────────────────────────────────
  return (
    <div className="app-shell">
      {PREVIEW && <PreviewBanner/>}
      <header style={{padding:"12px 18px",borderBottom:"1px solid "+T.border,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,background:T.surface}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:22,fontWeight:400,color:T.text,letterSpacing:1,fontFamily:SCRIPT}}>Divinatey</span>
          {draw && <div style={{fontSize:9,color:T.dim,fontWeight:600,letterSpacing:1,textTransform:"uppercase",paddingTop:1}} title={draw.source==="ANU"?"Seeded with quantum noise from ANU":"Seeded with hardware entropy"}>
            {draw.source==="ANU"?"⚛ quantum · ":""}#{String(draw.seed).slice(-6)}
          </div>}
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {accountBtn}
          <button onClick={startDraw} disabled={phase==="loading"} style={{fontSize:12,color:T.muted,background:"none",border:"1px solid "+T.border,borderRadius:999,padding:"5px 14px",cursor:"pointer",fontWeight:600}}>new reading</button>
          <button onClick={function(){setCrisis(true);}} aria-label="Crisis support" style={{fontSize:11,color:"#f87171",background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:999,padding:"4px 10px",cursor:"pointer"}}>🆘</button>
        </div>
      </header>

      <main style={{flex:1,overflowY:"auto"}}>
        <div style={{maxWidth:640,margin:"0 auto",padding:"12px 14px"}}>
        <div style={{margin:"0 0 6px"}}><ChartNav current={null} onNav={function(id){ if (id) goChart(id); }}/></div>
        {phase==="loading" && (
          <div style={{textAlign:"center",marginTop:80,color:T.muted}} role="status">
            <div className="pulse" style={{fontSize:36,marginBottom:20}}>✦</div>
            <div style={{fontSize:14,fontWeight:600,letterSpacing:1}}>{loadingMsg}</div>
          </div>
        )}

        {phase==="interpreting" && (
          <div role="status" style={{textAlign:"center",fontSize:12,color:T.purple,fontWeight:600,letterSpacing:1,margin:"8px 0 0"}}><span className="pulse">✦</span> {loadingMsg}</div>
        )}

        {interpError && phase==="ready" && (
          <div style={{textAlign:"center",marginTop:reading?16:40,padding:"0 24px",marginBottom:20}}>
            {!reading && <div style={{fontSize:32,marginBottom:16}}>✦</div>}
            <p style={{fontSize:15,color:T.muted,lineHeight:1.8,marginBottom:24,fontFamily:"Georgia,serif"}}>{interpError}</p>
            <button onClick={function(){ draw ? runInterpret(draw, drawId.current) : startDraw(); }} style={{...primaryBtn,padding:"14px 36px",fontSize:15}}>try again ✦</button>
          </div>
        )}

        {reading && <>
          <Divider label="I Ching" sub={"hexagram "+reading.pHex+(reading.rHex?" → "+reading.rHex:"")}/>
          <section style={{marginBottom:8,padding:18,background:T.surface,borderRadius:16,border:"1px solid "+T.border}}>
            <div style={{display:"flex",gap:16,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}>
              <div style={{textAlign:"center",flexShrink:0}}>
                <div style={{fontSize:52,lineHeight:1,color:T.gold,filter:"drop-shadow(0 0 8px rgba(201,168,76,0.4))"}} aria-hidden="true">{hexChar(reading.pHex)}</div>
                <div style={{fontSize:10,color:T.muted,marginTop:4,fontWeight:600}}>#{reading.pHex} · {reading.pName}</div>
              </div>
              {reading.rHex && <>
                <div style={{color:T.dim,fontSize:18}} aria-hidden="true">→</div>
                <div style={{textAlign:"center",flexShrink:0}}>
                  <div style={{fontSize:52,lineHeight:1,color:"#a89058"}} aria-hidden="true">{hexChar(reading.rHex)}</div>
                  <div style={{fontSize:10,color:T.muted,marginTop:4,fontWeight:600}}>#{reading.rHex} · {reading.rName}</div>
                </div>
              </>}
              <div style={{flex:1,paddingLeft:4,minWidth:90}} aria-label="hexagram lines, top to bottom">
                {[...reading.lines].reverse().map(function(l,i){
                  const ln=6-i;
                  return <div key={i} style={{fontFamily:"monospace",fontSize:11,color:reading.changing.includes(ln)?T.gold:T.dim,marginBottom:5}}>{lineGlyph(l)}{reading.changing.includes(ln)&&<span style={{marginLeft:8,fontSize:9,color:T.purple,fontFamily:"system-ui,sans-serif",fontWeight:700}}>✦{ln}</span>}</div>;
                })}
              </div>
            </div>
            {interp && interp.iching && interp.iching.primary ? <>
              <p style={{fontSize:14,lineHeight:1.8,color:T.text,margin:"0 0 10px",fontFamily:"Georgia,serif"}}>{interp.iching.primary}</p>
              {interp.iching.lines && <p style={{fontSize:13,lineHeight:1.7,color:T.muted,borderLeft:"2px solid "+T.purple,paddingLeft:12,margin:"0 0 8px",fontFamily:"Georgia,serif"}}>{interp.iching.lines}</p>}
              {interp.iching.resulting && <p style={{fontSize:13,lineHeight:1.7,color:T.muted,borderLeft:"2px solid "+T.dim,paddingLeft:12,margin:0,fontFamily:"Georgia,serif"}}>{interp.iching.resulting}</p>}
            </> : !interpError && <p style={{fontSize:12,color:T.dim,fontStyle:"italic",margin:0}}>interpreting…</p>}
          </section>

          <Divider label="Tarot" sub="seven positions · rider-waite"/>
          <div style={{overflowX:"auto",marginBottom:14,paddingBottom:4}}>
            <div style={{display:"flex",gap:6,minWidth:"max-content",padding:"4px 0",margin:"0 auto",justifyContent:"center"}}>
              {reading.cards.map(function(c,i){ return <CardMini key={i} name={c.name} pos={c.pos} active={tarotReady}/>; })}
            </div>
          </div>
          <section style={{marginBottom:8}}>
            {reading.cards.map(function(c,i){ const t = interp && interp.tarot && interp.tarot[i]; return (
              <div key={i} style={{padding:"14px 16px",background:T.surface,borderRadius:12,border:"1px solid "+T.border,marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6,gap:8}}>
                  <div style={{fontSize:9,letterSpacing:2,color:T.purple,textTransform:"uppercase",fontWeight:700}}>{c.pos}</div>
                  <div style={{fontSize:13,color:T.text,fontWeight:600,textAlign:"right"}}>{c.name}</div>
                </div>
                {t && t.insight ? <div style={{fontSize:13,lineHeight:1.7,color:T.muted,fontFamily:"Georgia,serif"}}>{t.insight}</div> : !interpError && <div style={{fontSize:11,color:T.dim,fontStyle:"italic"}}>interpreting…</div>}
              </div>
            ); })}
          </section>

          {interp && interp.synthesis && <>
            <Divider label="the vibe"/>
            <div style={{marginBottom:16,padding:20,background:"linear-gradient(135deg,#ede8ff,#fce7f3)",borderRadius:16,border:"1px solid "+T.purple+"44"}}>
              <p style={{fontSize:15,lineHeight:1.9,color:T.text,fontStyle:"italic",margin:0,fontFamily:"Georgia,serif"}}>{interp.synthesis}</p>
            </div>
          </>}

          {interp && interp.invitation && (
            <p style={{fontSize:15,color:T.purple,textAlign:"center",lineHeight:1.8,marginBottom:20,fontWeight:600,fontFamily:"Georgia,serif",padding:"0 8px"}}>{interp.invitation}</p>
          )}

          {interp && phase==="ready" && (canChat
            ? (msgs.length===0 && !chatLoading && <SuggestedChips reading={reading} onAsk={sendChat} disabled={chatLoading}/>)
            : <ChatTeaser reading={reading} auth={auth} pulse={pulse} innerRef={teaserRef}
                onSignIn={function(){goChart("account");}} onAccount={function(){goChart("account");}}/>)}

          <div aria-live="polite">
            {msgs.map(function(m,i){ const mine = m.role==="user"; return (
              <div key={i} style={{display:"flex",flexDirection:"column",alignItems:mine?"flex-end":"flex-start",marginBottom:12}}>
                <div style={{maxWidth:"82%",padding:"12px 16px",borderRadius:mine?"18px 18px 4px 18px":"18px 18px 18px 4px",background:mine?GRAD:T.surface,color:mine?"#fff":T.muted,fontSize:14,lineHeight:1.75,whiteSpace:"pre-wrap",border:mine?"none":"1px solid "+T.border,fontFamily:"Georgia,serif"}}>{m.text}</div>
                <div style={{fontSize:9,color:T.dim,marginTop:3,padding:"0 4px"}}>{m.ts}</div>
              </div>
            ); })}
            {chatLoading && <div style={{display:"flex",marginBottom:12}}><div className="pulse" style={{padding:"12px 16px",borderRadius:"18px 18px 18px 4px",background:T.surface,border:"1px solid "+T.border,color:T.dim,fontSize:20}} aria-label="the oracle is thinking">···</div></div>}
            {chatError && <p style={{fontSize:13,color:T.pink,textAlign:"center",margin:"0 0 12px"}}>{chatError}</p>}
          </div>

          <div style={{marginTop:8,paddingTop:4,borderTop:"1px solid "+T.border}}>
            <FooterLinks onPage={openPage} onCrisis={function(){setCrisis(true);}}/>
          </div>
        </>}
        <div ref={bottomRef}/>
        </div>
      </main>

      {phase==="ready" && interp && !canChat && (
        <div style={{borderTop:"1px solid "+T.border,background:T.surface,flexShrink:0}}>
          <div style={{maxWidth:640,margin:"0 auto",padding:"10px 14px"}}>
            <button onClick={showTeaser} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,border:"1px solid "+T.border,borderRadius:12,padding:"11px 14px",background:T.bg,cursor:"pointer",color:T.muted,fontSize:15,fontFamily:"Georgia,serif"}}>
              <span>ask the oracle about this reading…</span>
              <span style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#fff",background:GRAD,borderRadius:999,padding:"4px 10px",fontFamily:"system-ui,sans-serif"}}>🔒 paid</span>
            </button>
          </div>
        </div>
      )}
      {phase==="ready" && interp && canChat && (
        <div style={{borderTop:"1px solid "+T.border,background:T.surface,flexShrink:0}}>
          <form onSubmit={function(e){e.preventDefault();submit();}} style={{maxWidth:640,margin:"0 auto",padding:"12px 14px",display:"flex",gap:10,alignItems:"flex-end"}}>
            <textarea ref={inputRef} value={input} aria-label="Share what's on your mind" maxLength={2000} onChange={function(e){setInput(e.target.value);e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,120)+"px";}} onKeyDown={function(e){if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();submit();}}} placeholder="what's on your mind?" disabled={chatLoading} rows={1} style={{flex:1,resize:"none",border:"1px solid "+T.border,borderRadius:12,padding:"10px 14px",fontSize:16,fontFamily:"Georgia,serif",lineHeight:1.5,outline:"none",overflow:"hidden",color:T.text,background:T.bg}}/>
            <button type="submit" disabled={chatLoading||!input.trim()} style={{background:chatLoading||!input.trim()?"none":GRAD,color:chatLoading||!input.trim()?T.dim:"#fff",border:chatLoading||!input.trim()?"1px solid "+T.border:"1px solid transparent",borderRadius:12,padding:"10px 18px",fontSize:13,cursor:"pointer",fontWeight:700}}>send</button>
          </form>
        </div>
      )}
      {overlays}
    </div>
  );
}
