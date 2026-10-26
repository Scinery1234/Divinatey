// ═════════════════════════════════════════════════════════════════════════════
// Shared core: astronomy, time, houses, aspects, transit scanning, UI framework.
//
// The core holds no interpretation and no system data. Each built page contains
// exactly one system module (window.SYSTEM), so no page can see another system's
// chart, data or readings.
//
// Reading isolation:
//   • apiCall() is stateless — every call is a single fresh user message, with
//     no conversation history and no system prompt shared between calls.
//   • Prompts are built only from computed chart/sky data, never from text a
//     previous call generated. Generated text is written to the DOM and never
//     read back into a prompt.
//   • Nothing is persisted (no localStorage / sessionStorage / cookies).
// ═════════════════════════════════════════════════════════════════════════════

const DAY_MS=86400000;
const DEG=Math.PI/180;
const norm=x=>((x%360)+360)%360;
function arcD(a,b){const d=Math.abs(norm(a-b));return d>180?360-d:d;}
function sdiff(a,b){let d=norm(a-b);return d>180?d-360:d;}   // a−b in (−180,180]
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const T=d=>Astronomy.MakeTime(d);

// ─── Time ────────────────────────────────────────────────────────────────────
// Newer IANA names an older browser may not know → long-standing equivalents.
const TZ_OLD={'Europe/Kyiv':'Europe/Kiev','Pacific/Kanton':'Pacific/Enderbury','America/Ciudad_Juarez':'America/Denver','America/Nuuk':'America/Godthab','Asia/Qostanay':'Asia/Almaty'};
function tzUsable(tz){return validTZ(tz)?tz:(TZ_OLD[tz]&&validTZ(TZ_OLD[tz])?TZ_OLD[tz]:null);}
function validTZ(tz){try{new Intl.DateTimeFormat('en',{timeZone:tz});return !!tz;}catch(e){return false;}}

function tzOffsetMs(tz,ms){
  const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  const p=fmt.formatToParts(new Date(ms)).reduce((a,x)=>(a[x.type]=x.value,a),{});
  const h=p.hour==='24'?0:+p.hour;
  return Date.UTC(+p.year,+p.month-1,+p.day,h,+p.minute,+p.second)+(p.hour==='24'?DAY_MS:0)-Math.floor(ms/1000)*1000;
}
// Local wall-clock time in an IANA zone → UTC Date (DST-aware).
function toUTC(dateStr,timeStr,tz){
  try{
    const target=Date.parse(`${dateStr}T${timeStr}:00Z`);
    if(!isFinite(target))return null;
    let utc=target-tzOffsetMs(tz,target);
    utc=target-tzOffsetMs(tz,utc);
    return new Date(utc);
  }catch(e){return null;}
}
const fmtDate=d=>(d.date||d).toISOString().slice(0,10);
const fmtUTC=d=>(d.date||d).toISOString().replace('T',' ').slice(0,16)+' UTC';
const DY=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MO=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const dayLabel=d=>`${DY[d.getUTCDay()]} ${d.getUTCDate()} ${MO[d.getUTCMonth()]}`;
const longDate=d=>d.toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short',year:'numeric'});

// ─── Positions (geocentric, apparent, true ecliptic & equinox of date) ───────
function meanNode(d){
  const t=T(d),c=t.tt/36525;
  const om=125.0445479-1934.1362891*c+0.0020754*c*c+c*c*c/467441-c*c*c*c/60616000;
  return norm(om+Astronomy.e_tilt(t).dpsi/3600);
}
// True (osculating) lunar node — Meeus, Astronomical Algorithms ch. 47.
function trueNode(d){
  const t=T(d),c=t.tt/36525;
  const D=(297.8501921+445267.1114034*c-0.0018819*c*c+c*c*c/545868)*DEG;
  const M=(357.5291092+35999.0502909*c-0.0001536*c*c)*DEG;
  const Mp=(134.9633964+477198.8675055*c+0.0087414*c*c+c*c*c/69699)*DEG;
  const F=(93.2720950+483202.0175233*c-0.0036539*c*c-c*c*c/3526000)*DEG;
  const om=125.0445479-1934.1362891*c+0.0020754*c*c+c*c*c/467441;
  const tr=om-1.4979*Math.sin(2*(D-F))-0.1500*Math.sin(M)-0.1226*Math.sin(2*D)+0.1176*Math.sin(2*F)+0.0801*Math.sin(2*(Mp-F));
  return norm(tr+Astronomy.e_tilt(t).dpsi/3600);
}
// body: Sun Moon Mercury Venus Mars Jupiter Saturn Uranus Neptune Pluto
//       Earth (= Sun+180) NorthNode SouthNode (true) MeanNode MeanSouthNode
function tropLon(body,d){
  const t=T(d);
  switch(body){
    case 'Sun':return Astronomy.SunPosition(t).elon;
    case 'Earth':return norm(Astronomy.SunPosition(t).elon+180);
    case 'NorthNode':return trueNode(t);
    case 'SouthNode':return norm(trueNode(t)+180);
    case 'MeanNode':return meanNode(t);
    case 'MeanSouthNode':return norm(meanNode(t)+180);
    default:return Astronomy.Ecliptic(Astronomy.GeoVector(Astronomy.Body[body],t,true)).elon;
  }
}
function positions(bodies,d,lonFn=tropLon){const r={};bodies.forEach(b=>r[b]=lonFn(b,d));return r;}

// Lahiri (Chitrapaksha) ayanamsa: 23°51'25.5" at J2000, advancing with IAU 2006
// general precession in longitude. Subtracting dpsi as well puts sidereal
// positions on the mean equinox, matching standard Jyotish software.
function ayanamsaLahiri(d){
  const t=T(d),c=t.tt/36525;
  return 23.857092+(5028.796195*c+1.1054348*c*c)/3600+Astronomy.e_tilt(t).dpsi/3600;
}

// ─── Angles & houses ─────────────────────────────────────────────────────────
function obliquity(d){return Astronomy.e_tilt(T(d)).tobl;}
function ramc(d,lonE){return norm(Astronomy.SiderealTime(T(d))*15+lonE);}
function mcLon(d,lonE){
  const r=ramc(d,lonE)*DEG,e=obliquity(d)*DEG;
  return norm(Math.atan2(Math.sin(r),Math.cos(r)*Math.cos(e))/DEG);
}
function ascLon(d,lat,lonE){
  const r=ramc(d,lonE)*DEG,e=obliquity(d)*DEG,f=lat*DEG;
  return norm(Math.atan2(Math.cos(r),-(Math.sin(r)*Math.cos(e)+Math.tan(f)*Math.sin(e)))/DEG);
}
// Placidus: cusps trisect each point's diurnal/nocturnal semi-arc. Returns
// 12 cusp longitudes (index 0 = 1st house), or null beyond the polar circles.
function placidusCusps(d,lat,lonE){
  if(Math.abs(lat)>=66)return null;
  const R=ramc(d,lonE),e=obliquity(d)*DEG,f=lat*DEG;
  const mc=mcLon(d,lonE),asc=ascLon(d,lat,lonE);
  function cusp(frac,below){
    let lam=norm(mc+(below?90:0)+frac*90);
    for(let i=0;i<100;i++){
      const dec=Math.asin(Math.sin(e)*Math.sin(lam*DEG));
      const x=Math.max(-1,Math.min(1,-Math.tan(f)*Math.tan(dec)));
      const sda=Math.acos(x)/DEG,nsa=180-sda;
      const a=(below?R+sda+frac*nsa:R+frac*sda)*DEG;
      const nl=norm(Math.atan2(Math.sin(a),Math.cos(a)*Math.cos(e))/DEG);
      if(Math.abs(sdiff(nl,lam))<1e-8){lam=nl;break;}
      lam=nl;
    }
    return lam;
  }
  const c11=cusp(1/3,false),c12=cusp(2/3,false),c2=cusp(1/3,true),c3=cusp(2/3,true);
  return[asc,c2,c3,norm(mc+180),norm(c11+180),norm(c12+180),norm(asc+180),norm(c2+180),norm(c3+180),mc,c11,c12];
}
function wholeSignCusps(asc){const s=Math.floor(norm(asc)/30)*30;return Array.from({length:12},(_,i)=>norm(s+30*i));}
function houseOf(lon,cusps){
  for(let i=0;i<12;i++){
    const a=cusps[i],b=cusps[(i+1)%12],span=norm(b-a),off=norm(lon-a);
    if(off<span)return i+1;
  }
  return 1;
}

// ─── I Ching / Rave mandala (shared by Gene Keys and Human Design) ──────────
// Gate 41 begins at 302° (2°00' Aquarius tropical). Gate = 5.625°, line = 0.9375°.
// Check: 0° Aries falls in Gate 25 (which begins at 358.25° = 28°15' Pisces).
const MANDALA_GATES=[41,19,13,49,30,55,37,63,22,36,25,17,21,51,42,3,27,24,2,23,8,20,16,35,
  45,12,15,52,39,53,62,56,31,33,7,4,29,59,40,64,47,6,46,18,48,57,32,50,28,44,1,43,14,
  34,9,5,26,11,10,58,38,54,61,60];
const MANDALA_START=302.0;
function gateLine(lon){
  const p=norm(norm(lon)-MANDALA_START);
  const idx=Math.min(63,Math.floor(p/5.625));
  const frac=(p-idx*5.625)/5.625;
  return{gate:MANDALA_GATES[idx],line:Math.min(6,Math.floor(frac*6)+1)};
}
// Design moment: when the Sun was exactly 88° of arc before its birth position.
function designDate(birth){
  const b=birth.date||birth;
  const tgt=norm(tropLon('Sun',b)-88);
  let d=new Date(+b-89.27*DAY_MS);
  for(let i=0;i<40;i++){
    const df=sdiff(tgt,tropLon('Sun',d));
    if(Math.abs(df)<1e-6)break;
    d=new Date(+d+df/0.9856*DAY_MS);
  }
  return d;
}

// ─── Zodiac helpers ──────────────────────────────────────────────────────────
const SIGNS=['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const SIGN_GLYPH=['♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓'].map(g=>g+'︎');
const signIdx=lon=>Math.floor(norm(lon)/30)%12;
function dms(lon){                      // 17°04' within sign
  const x=norm(lon)%30;let d=Math.floor(x),m=Math.round((x-d)*60);
  if(m===60){d++;m=0;}
  return `${d}°${String(m).padStart(2,'0')}'`;
}
const signPos=lon=>`${dms(lon)} ${SIGNS[signIdx(lon)]}`;

// ─── Aspects ─────────────────────────────────────────────────────────────────
const ASPECTS=[
  {name:'Conjunction',sym:'☌',ang:0,  type:'neutral'},
  {name:'Opposition', sym:'☍',ang:180,type:'hard'},
  {name:'Square',     sym:'□',ang:90, type:'hard'},
  {name:'Trine',      sym:'△',ang:120,type:'soft'},
  {name:'Sextile',    sym:'⚹',ang:60, type:'soft'},
];
// orb: number, or function(aspect) → number
function findAspect(la,lb,orb,list=ASPECTS){
  const d=arcD(la,lb);
  for(const a of list){
    const ob=typeof orb==='function'?orb(a):orb;
    const diff=Math.abs(d-a.ang);
    if(diff<=ob)return{...a,orb:+diff.toFixed(2)};
  }
  return null;
}
// Is the aspect tightening? Compares the orb now with the orb 6 h later.
function applying(lonFn,body,ptLon,ang,d){
  const now=Math.abs(arcD(lonFn(body,d),ptLon)-ang);
  const later=Math.abs(arcD(lonFn(body,new Date(+(d.date||d)+6*3600e3)),ptLon)-ang);
  return later<now;
}

// cfg: {bodies, lonFn, orbFn(body,aspect), points:[{key,name,lon,...}]}
function scanTransits(cfg,d){
  const pos=positions(cfg.bodies,d,cfg.lonFn),hits=[];
  for(const b of cfg.bodies)for(const pt of cfg.points){
    if(cfg.skip&&cfg.skip(b,pt))continue;
    const asp=findAspect(pos[b],pt.lon,a=>cfg.orbFn(b,a),cfg.aspects);
    if(asp)hits.push({body:b,tLon:pos[b],pt,asp});
  }
  return hits.sort((a,b)=>a.asp.orb-b.asp.orb);
}
function skyAspects(cfg,d){
  const bs=cfg.skyBodies||cfg.bodies,pos=positions(bs,d,cfg.lonFn),hits=[];
  for(let i=0;i<bs.length-1;i++)for(let j=i+1;j<bs.length;j++){
    const asp=findAspect(pos[bs[i]],pos[bs[j]],a=>cfg.orbFn(bs[i],a),cfg.aspects);
    if(asp)hits.push({p1:bs[i],p2:bs[j],lon1:pos[bs[i]],lon2:pos[bs[j]],asp});
  }
  return hits.sort((a,b)=>a.asp.orb-b.asp.orb);
}

// ─── Motion & stations ───────────────────────────────────────────────────────
const NEVER_RETRO=new Set(['Sun','Earth','Moon','NorthNode','SouthNode','MeanNode','MeanSouthNode']);
function dailyMotion(body,d,lonFn=tropLon){
  const t=+(d.date||d),h=0.25*DAY_MS;
  return sdiff(lonFn(body,new Date(t+h)),lonFn(body,new Date(t-h)))/0.5;
}
function isRetro(body,d,lonFn=tropLon){return !NEVER_RETRO.has(body)&&dailyMotion(body,d,lonFn)<0;}
function findStations(bodies,start,days,lonFn=tropLon){
  const bs=bodies.filter(b=>!NEVER_RETRO.has(b)),ev=[],prev={};
  bs.forEach(b=>prev[b]=isRetro(b,start,lonFn));
  for(let i=1;i<=days;i++){
    const t=new Date(+start+i*DAY_MS);
    bs.forEach(b=>{const r=isRetro(b,t,lonFn);if(r!==prev[b]){ev.push({day:i,body:b,type:r?'retrograde':'direct'});prev[b]=r;}});
  }
  return ev;
}
const rxMark=(b,d,lonFn)=>isRetro(b,d,lonFn)?' <span class="rx" title="Retrograde">℞</span>':'';

// ─── 14-day forecast: aspects newly entering orb or becoming exact ───────────
// Returns [{day, date, label, personal:[hits], sky:[hits], stations:[...]}].
function aspectForecast(cfg,start,days){
  const key=h=>`${h.body}|${h.asp.name}|${h.pt.key}`,skey=h=>`${h.p1}|${h.asp.name}|${h.p2}`;
  let prevP=new Set(scanTransits(cfg,start).map(key));
  let prevS=new Set(cfg.noSky?[]:skyAspects(cfg,start).map(skey));
  const st=findStations(cfg.skyBodies||cfg.bodies,start,days,cfg.lonFn),out=[];
  for(let d=1;d<=days;d++){
    const base=new Date(+start+d*DAY_MS);base.setUTCHours(0,0,0,0);
    const times=[6,12,18].map(h=>new Date(+base+h*3600e3));   // extra samples catch the fast Moon
    const bestP=new Map(),bestS=new Map();
    for(const t of times){
      for(const h of scanTransits(cfg,t)){const k=key(h);if(!bestP.has(k)||h.asp.orb<bestP.get(k).asp.orb)bestP.set(k,h);}
      if(!cfg.noSky)for(const h of skyAspects(cfg,t)){const k=skey(h);if(!bestS.has(k)||h.asp.orb<bestS.get(k).asp.orb)bestS.set(k,h);}
    }
    const personal=[...bestP.values()].filter(h=>!prevP.has(key(h))||h.asp.orb<0.5).sort((a,b)=>a.asp.orb-b.asp.orb);
    const sky=[...bestS.values()].filter(h=>!prevS.has(skey(h))||h.asp.orb<0.5).sort((a,b)=>a.asp.orb-b.asp.orb);
    prevP=new Set(bestP.keys());prevS=new Set(bestS.keys());
    out.push({day:d,date:base,label:dayLabel(base),personal,sky,stations:st.filter(s=>s.day===d)});
  }
  return out;
}

// ─── HTML helpers ────────────────────────────────────────────────────────────
const secH=(t,small)=>`<h3 class="sec-h">${t}${small?`<small>${small}</small>`:''}</h3>`;
function tableHTML(heads,rows,emptyMsg){
  const body=rows.length?rows.map(r=>`<tr>${r.map(c=>typeof c==='object'&&c!==null?`<td class="${c.cls||''}" style="${c.style||''}">${c.html}</td>`:`<td>${c}</td>`).join('')}</tr>`).join('')
    :`<tr><td colspan="${heads.length}" class="empty">${emptyMsg||'None'}</td></tr>`;
  return `<table><thead><tr>${heads.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`;
}
const pill=(exact,sky)=>exact?'<span class="pill exact">EXACT</span>':`<span class="pill${sky?' sky':''}">NEW</span>`;
function stationRow(s){
  const rx=s.type==='retrograde';
  return `<div class="fc-row ${rx?'station-rx':'station-d'}"><span>${rx?'℞':'➤'}</span>
    <span style="font-weight:bold;color:var(${rx?'--hard':'--soft'})">${s.body} stations ${s.type}</span>
    <span class="dim">${rx?'begins moving backwards':'resumes forward motion'}</span></div>`;
}
function forecastHTML(days,emptyMsg){
  const rows=days.filter(d=>d.rows&&d.rows.length);
  if(!rows.length)return `<p class="empty">${emptyMsg||'Nothing new in the next 14 days'}</p>`;
  return rows.map(d=>`<div class="fc-day"><div class="fc-date">${d.label}</div>${d.rows.join('')}</div>`).join('');
}
const toggleNext=label=>`<span class="eph-toggle" onclick="const n=this.nextElementSibling;n.style.display=n.style.display==='block'?'none':'block'">▸ ${label}</span>`;
function paras(text){return text.split(/\n{2,}/).map(p=>`<p>${esc(p).replace(/\n/g,'<br>')}</p>`).join('');}

// ─── Claude API: serialised queue, retries, stateless ────────────────────────
const API_MODEL='claude-sonnet-4-20250514';
let _apiChain=Promise.resolve();
// Inside a claude.ai artifact viewer, readings go through the page's `sample`
// capability (also one memoryless prompt per call). Elsewhere: direct fetch.
let _sampleP=null;
const getSample=()=>window.claude&&window.claude.use?(_sampleP||(_sampleP=window.claude.use('sample'))):Promise.resolve(undefined);
const SAMPLE_MSG={not_granted:'Claude access wasn’t allowed for this page. Reload the page to be asked again.',
  sampling_disabled:'Claude isn’t available for this account.',rate_limited:'Too many requests right now. Wait a moment, then try again.',
  session_expired:'Your Claude session expired. Sign in again, then try again.',refused:'Claude declined this request.',
  empty_completion:'Claude returned nothing. Try again.'};
function apiCall(prompt,maxTok){
  const job=async()=>{
    const sample=await getSample();
    if(sample!==undefined){
      if(!sample)throw new Error('Readings aren’t available in this view.');
      try{return(await sample(prompt,{cache:false})).text.trim();}
      catch(e){throw new Error(SAMPLE_MSG[e&&e.code]||'Couldn’t reach Claude. Try again.');}
    }
    for(let attempt=1;attempt<=4;attempt++){
      try{
        const res=await fetch('https://api.anthropic.com/v1/messages',{
          method:'POST',headers:{'Content-Type':'application/json'},
          // One fresh message per call: no history, no shared context.
          body:JSON.stringify({model:API_MODEL,max_tokens:maxTok||700,messages:[{role:'user',content:prompt}]})});
        if(res.status===429||res.status===529||res.status>=500){
          if(attempt===4)throw new Error('API busy (status '+res.status+') — try again shortly');
          await new Promise(r=>setTimeout(r,1200*2**(attempt-1)));continue;
        }
        const data=await res.json();
        if(data.error)throw new Error(data.error.message||data.error.type||'API error');
        const text=data.content&&data.content.filter(b=>b.type==='text').map(b=>b.text).join('\n').trim();
        if(!text)throw new Error('Empty response');
        return text;
      }catch(e){
        if(attempt===4)throw e;
        await new Promise(r=>setTimeout(r,1200*2**(attempt-1)));
      }
    }
  };
  const p=_apiChain.then(job,job);
  _apiChain=p.catch(()=>{});
  return p;
}

// ═════════════════════════════════════════════════════════════════════════════
// Page framework. SYSTEM supplies:
//   id, title, formTitle, formSub, needsLocation, needsBirthName, dateOnly, accent{...}
//   compute(input) → chart
//   header(chart,input) → extra meta html;  badges(chart) → [{n,h,p}]
//   chartHTML(chart);  positionsHTML(chart);  transitsHTML(chart)
//   reading: {title, sections:[{id,icon,title,desc,prompt(d),astroPrompt?(d)}], data(chart)}
//   guide:   {title, tabs:[{key,name,icon,col,blurb,items(chart)→[{title,code,sub,role,prompt}], overview?(chart)→prompt}]}
// ═════════════════════════════════════════════════════════════════════════════
const APP={chart:null,readingData:null,guide:null};

function formHTML(){
  const S=SYSTEM;
  return `<div id="form-section"><div class="form-card">
    <h2>${S.formTitle}</h2><p class="sub">${S.formSub||''}</p>
    ${S.needsBirthName?`<label for="bname">Full name at birth</label><input type="text" id="bname" maxlength="100" placeholder="As on the birth certificate">
    <label for="name">Name you use now (optional)</label>`:`<label for="name">Name (optional)</label>`}<input type="text" id="name" placeholder="Your name">
    <div class="row2">
      <div><label for="bdate">Birth Date</label><input type="date" id="bdate"></div>
      <div><label for="btime">Birth Time</label><input type="time" id="btime" value="12:00"></div>
    </div>
    <label for="tzInput">Birth Place${S.dateOnly?' (optional)':''}</label>
    <div class="tz-wrap"><input type="text" id="tzInput" placeholder="Start typing a town or city…" autocomplete="off" role="combobox" aria-autocomplete="list" aria-controls="tzDrop">
      <input type="hidden" id="tz"><div id="tzDrop" role="listbox"></div></div>
    <p class="hint" id="placeInfo">Any town of 1,000+ people. If yours isn’t listed, pick the nearest one${S.needsLocation?' and adjust the coordinates below':''}.</p>
    ${S.needsLocation?`<div class="row2">
      <div><label for="lat">Latitude (°N, − for S)</label><input type="number" id="lat" step="0.01" min="-90" max="90" placeholder="e.g. -33.87"></div>
      <div><label for="lon">Longitude (°E, − for W)</label><input type="number" id="lon" step="0.01" min="-180" max="180" placeholder="e.g. 151.21"></div>
    </div><p class="hint">Picking a city fills these in. Enter your exact birthplace for an accurate ${S.locationUse||'Ascendant'}.</p>`:''}
    <p id="form-err" class="warn" role="alert" hidden></p>
    <button class="btn-main" onclick="generate()">Generate ${S.noun||'Chart'}</button>
    <p class="form-foot">Astronomy calculated locally in your browser${S.formFoot?' · '+S.formFoot:''}<br>Places: GeoNames (CC BY 4.0)</p>
  </div></div><div id="chart-section" class="chart-wrap" style="display:none"></div>`;
}

function formError(msg){const e=document.getElementById('form-err');e.textContent=msg||'';e.hidden=!msg;return null;}
function readInput(){
  formError('');
  const name=document.getElementById('name').value.trim();
  const date=document.getElementById('bdate').value;
  const time=document.getElementById('btime').value||'12:00';
  const typed=document.getElementById('tzInput').value.trim();
  const tz=tzUsable(document.getElementById('tz').value||(typed.includes('/')?typed:''))||(SYSTEM.dateOnly?'UTC':null);
  if(!date)return formError('Please enter a birth date.');
  if(!tz)return formError('Please choose your birth place from the list.');
  const utc=toUTC(date,time,tz);
  if(!utc)return formError('Could not convert to UTC. Check your date/time/timezone.');
  const inp={name,date,time,tz,utc};
  if(SYSTEM.needsBirthName){
    inp.birthName=document.getElementById('bname').value.trim();
    if(!/[a-z]/i.test(inp.birthName.normalize('NFD')))return formError('Please enter the full name at birth.');
  }
  if(SYSTEM.needsLocation){
    const lat=parseFloat(document.getElementById('lat').value),lon=parseFloat(document.getElementById('lon').value);
    if(!isFinite(lat)||!isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return formError('Please enter the birth latitude and longitude (or pick a city).');
    inp.lat=lat;inp.lon=lon;
  }
  return inp;
}

function generate(){
  const inp=readInput();if(!inp)return;
  const chart=SYSTEM.compute(inp);
  chart.input=inp;
  APP.chart=chart;APP.readingData=null;APP.guide=null;
  document.getElementById('chart-section').innerHTML=pageHTML(chart);
  document.getElementById('form-section').style.display='none';
  document.getElementById('chart-section').style.display='block';
  window.scrollTo(0,0);
}
function showForm(){
  document.getElementById('form-section').style.display='block';
  document.getElementById('chart-section').style.display='none';
}

// The calculated chart without any AI parts (what the free tier shows).
function chartBodyHTML(c){
  const S=SYSTEM,i=c.input;
  const loc=S.needsLocation?` · ${i.lat.toFixed(2)}°, ${i.lon.toFixed(2)}°`:'';
  const badges=(S.badges(c)||[]).map(b=>`<div class="badge"><div class="badge-n">${b.n}</div><div class="badge-t"><h3>${b.h}</h3><p>${b.p}</p></div></div>`).join('');
  return `<div class="chart-hdr">
      <h1>${i.name?esc(i.name)+'’s':'Your'} ${S.title}</h1>
      <div class="chart-meta">${S.dateOnly?`Born ${i.date}${i.birthName?' · '+esc(i.birthName):''}`:`Born ${i.date} at ${i.time} · ${esc(i.tz)}${loc} · ${fmtUTC(i.utc)}`}${S.header?' · '+S.header(c):''}</div>
    </div>
    <div class="badges">${badges}</div>
    ${S.chartHTML(c)}
    ${S.positionsHTML?S.positionsHTML(c):''}
    ${S.transitsHTML(c)}`;
}
function pageHTML(c){
  const S=SYSTEM;
  return `${chartBodyHTML(c)}
    ${readingUI()}
    ${guidePanel(c)}
    <button class="back-btn" onclick="showForm()">← New chart</button>
    <button class="guide-fab" onclick="toggleGuide(true)">✦ ${S.guide.fab||'Open Guide'}</button>`;
}

// Fixed reference text for each guide item (titles and roles; no prompts, no AI).
function referenceData(c){
  return SYSTEM.guide.tabs.map(t=>({key:t.key,name:t.name,icon:t.icon,col:t.col,blurb:t.blurb,
    overview:!!t.overview,overviewTitle:t.overviewTitle||t.name+' — Overview',
    items:t.items(c).map(it=>({title:it.title,code:it.code||'',sub:it.sub||'',role:it.role||''}))}));
}

// ─── Reading ─────────────────────────────────────────────────────────────────
function readingUI(){
  const R=SYSTEM.reading;
  const secs=R.sections.map(s=>`<div class="rd-sec">
      <div class="rd-head"><div><span>${s.icon}</span><strong>${s.title}</strong><span class="d">${s.desc}</span></div>
        <button id="sec-${s.id}-btn" class="gen-btn" onclick="loadSection(${s.id})">Generate →</button></div>
      <div id="sec-${s.id}-body" class="rd-body"><p class="rd-ph">Click Generate to load this section.</p></div>
      ${s.astroPrompt?`<div id="sec-${s.id}-astro" style="display:none;padding:0 20px 2px"></div>
        <div style="padding:0 20px 14px"><button id="sec-${s.id}-astro-btn" class="rd-astro-btn" onclick="loadAstroDetail(${s.id})">📊 Show technical context</button></div>`:''}
    </div>`).join('');
  return `<div class="section"><h3 class="sec-h">✦ ${R.title}</h3>
    <p class="tagline">Each section is generated on its own from the chart and sky data only — no section sees another section’s text.</p>${secs}</div>`;
}
function _readingData(){return APP.readingData||(APP.readingData=SYSTEM.reading.data(APP.chart));}
async function loadSection(n){
  const s=SYSTEM.reading.sections.find(x=>x.id===n);
  const btn=document.getElementById(`sec-${n}-btn`),body=document.getElementById(`sec-${n}-body`);
  btn.disabled=true;btn.textContent='Channelling…';body.innerHTML='<div class="spark">✦</div>';
  try{
    body.innerHTML=paras(await apiCall(s.prompt(_readingData()),1000));
    const ab=document.getElementById(`sec-${n}-astro-btn`);
    if(ab){ab.style.display='inline-block';ab.dataset.loaded='0';ab.textContent='📊 Show technical context';
      const ad=document.getElementById(`sec-${n}-astro`);ad.style.display='none';}
  }catch(e){body.innerHTML=`<p class="err">Error: ${esc(e.message)}</p>`;}
  btn.disabled=false;btn.textContent='↺ Regenerate';
}
async function loadAstroDetail(n){
  const s=SYSTEM.reading.sections.find(x=>x.id===n);
  const ab=document.getElementById(`sec-${n}-astro-btn`),ad=document.getElementById(`sec-${n}-astro`);
  if(ab.dataset.loaded==='1'){
    const hide=ad.style.display!=='none';ad.style.display=hide?'none':'block';
    ab.textContent=hide?'📊 Show technical context':'📊 Hide technical context';return;
  }
  ab.disabled=true;ab.textContent='Loading…';ad.style.display='block';ad.innerHTML='<p class="dim">Loading…</p>';
  try{
    const text=await apiCall(s.astroPrompt(_readingData()),450);
    ad.innerHTML=`<div class="rd-astro"><p class="t">Technical Context</p>${paras(text)}</div>`;
    ab.dataset.loaded='1';ab.textContent='📊 Hide technical context';
  }catch(e){ad.innerHTML=`<p class="err">Error: ${esc(e.message)}</p>`;ab.textContent='📊 Show technical context';}
  ab.disabled=false;
}

// ─── Guide panel ─────────────────────────────────────────────────────────────
// Each item's prompt is built from that item's own data only. Tab overviews
// (where a system defines one) see only the items of that one tab.
function guidePanel(c){
  const G=SYSTEM.guide;
  APP.guide={};
  G.tabs.forEach(t=>APP.guide[t.key]=t.items(c));
  const tabs=G.tabs.map((t,i)=>`<button id="gtab-${t.key}" class="${i?'':'on'}" onclick="guideTab('${t.key}')">${t.icon} ${t.name}</button>`).join('');
  const bodies=G.tabs.map((t,i)=>{
    const ov=t.overview?`<div class="gk-item" style="border-color:${t.col}55">
        <div class="gk-item-h" style="background:${t.col}14">
          <div><strong style="color:${t.col};font-size:.85rem">${t.icon} ${t.overviewTitle||t.name+' — Overview'}</strong>
          <div class="role" style="font-style:normal">${t.blurb}</div></div>
          <button id="gov-btn-${t.key}" class="gen-btn" style="background:${t.col}" onclick="loadOverview('${t.key}')">Generate →</button>
        </div>
        <div id="gov-body-${t.key}" class="gk-item-b open"><p class="rd-ph">${t.overviewHint||'A summary of this section as a whole — click Generate.'}</p></div>
      </div>`:`<p class="tagline">${t.blurb}</p>`;
    const items=APP.guide[t.key].map((it,j)=>`<div class="gk-item">
        <div class="gk-item-h"><div style="min-width:0">
          <strong class="ttl">${it.title}</strong>${it.code?` <span class="code" style="color:${t.col}">${it.code}</span>`:''}
          ${it.sub?`<div class="sub">${it.sub}</div>`:''}${it.role?`<div class="role">${it.role}</div>`:''}</div>
          <button id="gi-btn-${t.key}-${j}" class="gen-btn" onclick="loadItem('${t.key}',${j})">Explain →</button></div>
        <div id="gi-body-${t.key}-${j}" class="gk-item-b"></div>
      </div>`).join('');
    return `<div id="gbody-${t.key}" style="display:${i?'none':'block'}">${ov}${items}</div>`;
  }).join('');
  return `<div id="guide-overlay" onclick="toggleGuide(false)"></div>
    <div id="guide-panel"><div id="guide-head"><strong>✦ ${G.title}</strong><button onclick="toggleGuide(false)">×</button></div>
    <div id="guide-tabs">${tabs}</div><div id="guide-body">${bodies}</div></div>`;
}
function toggleGuide(open){
  const ov=document.getElementById('guide-overlay'),pn=document.getElementById('guide-panel');
  if(!ov||!pn)return;
  const o=open===undefined?!pn.classList.contains('open'):open;
  ov.classList.toggle('open',o);pn.classList.toggle('open',o);
}
function guideTab(key){
  SYSTEM.guide.tabs.forEach(t=>{
    document.getElementById('gtab-'+t.key).classList.toggle('on',t.key===key);
    document.getElementById('gbody-'+t.key).style.display=t.key===key?'block':'none';
  });
}
async function loadItem(tab,j){
  const it=APP.guide[tab][j];
  const btn=document.getElementById(`gi-btn-${tab}-${j}`),body=document.getElementById(`gi-body-${tab}-${j}`);
  body.classList.add('open');btn.disabled=true;btn.textContent='Channelling…';body.innerHTML='<div class="spark">✦</div>';
  try{body.innerHTML=paras(await apiCall(it.prompt,650));}
  catch(e){body.innerHTML=`<p class="err">Error: ${esc(e.message)}</p>`;}
  btn.disabled=false;btn.textContent='↺';
}
async function loadOverview(key){
  const t=SYSTEM.guide.tabs.find(x=>x.key===key);
  const btn=document.getElementById('gov-btn-'+key),body=document.getElementById('gov-body-'+key);
  btn.disabled=true;btn.textContent='Channelling…';body.innerHTML='<div class="spark">✦</div>';
  try{body.innerHTML=paras(await apiCall(t.overview(APP.chart),800));}
  catch(e){body.innerHTML=`<p class="err">Error: ${esc(e.message)}</p>`;}
  btn.disabled=false;btn.textContent='↺ Regenerate';
}

// ─── Birth place picker ──────────────────────────────────────────────────────
// CITY_ROWS (cities.js) is sorted largest first, so the first matches are the
// most likely. Matching ignores accents and case; every typed word must start
// a word of "City, Region, Country", and the first must start the city name.
let _places=null;
// Hidden search aliases so "Springfield MO", "Perth WA" or "Leeds UK" work.
const REGION_ABBR={'United States':'us usa america','United Kingdom':'uk gb britain','Australia':'au aus','Canada':'ca can','New Zealand':'nz',
  'United Arab Emirates':'uae','Alabama':'al','Alaska':'ak','Arizona':'az','Arkansas':'ar','California':'ca','Colorado':'co','Connecticut':'ct','Delaware':'de',
  'District of Columbia':'dc','Florida':'fl','Georgia':'ga','Hawaii':'hi','Idaho':'id','Illinois':'il','Indiana':'in','Iowa':'ia','Kansas':'ks','Kentucky':'ky',
  'Louisiana':'la','Maine':'me','Maryland':'md','Massachusetts':'ma','Michigan':'mi','Minnesota':'mn','Mississippi':'ms','Missouri':'mo','Montana':'mt',
  'Nebraska':'ne','Nevada':'nv','New Hampshire':'nh','New Jersey':'nj','New Mexico':'nm','New York':'ny','North Carolina':'nc','North Dakota':'nd','Ohio':'oh',
  'Oklahoma':'ok','Oregon':'or','Pennsylvania':'pa','Rhode Island':'ri','South Carolina':'sc','South Dakota':'sd','Tennessee':'tn','Texas':'tx','Utah':'ut',
  'Vermont':'vt','Virginia':'va','Washington':'wa','West Virginia':'wv','Wisconsin':'wi','Wyoming':'wy',
  'New South Wales':'nsw','Victoria':'vic','Queensland':'qld','Western Australia':'wa','South Australia':'sa','Tasmania':'tas','Australian Capital Territory':'act','Northern Territory':'nt',
  'Ontario':'on','Quebec':'qc','British Columbia':'bc','Alberta':'ab','Manitoba':'mb','Saskatchewan':'sk','Nova Scotia':'ns','New Brunswick':'nb',
  'Newfoundland and Labrador':'nl','Prince Edward Island':'pe'};
const fold=s=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
function places(){
  if(_places)return _places;
  _places=CITY_ROWS.split('\n').map(r=>{const[n,p,la,lo,t]=r.split('|');const label=n+(CITY_PLACE[p]?', '+CITY_PLACE[p]:'');
    return{name:n,label,lat:+la,lon:+lo,tz:CITY_TZ[t],key:fold(label)+' '+(CITY_PLACE[p]||'').split(', ').map(x=>REGION_ABBR[x]||'').join(' '),nkey:fold(n)};});
  return _places;
}
const ABBR_WORD={st:'saint',ste:'sainte',mt:'mount',ft:'fort',pt:'port'};
function searchPlaces(q){
  const raw=fold(q).split(/[\s,.]+/).filter(Boolean);if(!raw.length)return[];
  const alts=raw.map(w=>ABBR_WORD[w]?[w,ABBR_WORD[w]]:[w]);
  const wordStart=(k,w)=>k.startsWith(w)||k.includes(' '+w)||k.includes('-'+w);
  const phrases=[...new Set(alts.reduce((acc,a)=>acc.flatMap(p=>a.map(w=>p?p+' '+w:w)),['']))];
  const exact=[],other=[];
  for(const c of places()){
    if(exact.length>=30)break;
    if(phrases.some(ph=>c.nkey.startsWith(ph))){exact.push(c);continue;}
    if(other.length<30&&alts[0].some(w=>c.nkey.startsWith(w)||(alts.length===1&&wordStart(c.nkey,w)))&&alts.slice(1).every(a=>a.some(w=>wordStart(c.key,w))))other.push(c);
  }
  return[...exact,...other.filter(c=>!exact.includes(c))].slice(0,30);
}
let _matches=[],_active=-1;
function renderDrop(){
  const drop=document.getElementById('tzDrop');
  drop.innerHTML=_matches.map((m,i)=>`<div role="option" id="opt-${i}" class="${i===_active?'on':''}" onmousedown="event.preventDefault();pickPlace(${i})">${m.city?`<b>${esc(m.city.name)}</b><span class="dim">${esc(m.city.label.slice(m.city.name.length))}</span>`:`Timezone: ${esc(m.tz)}`}</div>`).join('');
  drop.style.display=_matches.length?'block':'none';
}
function pickPlace(i){
  const m=_matches[i];if(!m)return;
  const inp=document.getElementById('tzInput'),info=document.getElementById('placeInfo');
  if(m.city){
    const c=m.city;inp.value=c.label;document.getElementById('tz').value=c.tz;
    const la=document.getElementById('lat'),lo=document.getElementById('lon');
    if(la&&lo){la.value=c.lat;lo.value=c.lon;}
    info.textContent=`Timezone ${c.tz} · ${Math.abs(c.lat).toFixed(2)}°${c.lat<0?'S':'N'}, ${Math.abs(c.lon).toFixed(2)}°${c.lon<0?'W':'E'}`;
  }else{inp.value=m.tz;document.getElementById('tz').value=m.tz;info.textContent=`Timezone ${m.tz}`+(SYSTEM.needsLocation?' · enter the coordinates below':'');}
  _matches=[];renderDrop();
}
if(typeof document!=='undefined'&&document.addEventListener){
document.addEventListener('input',e=>{
  if(e.target.id!=='tzInput')return;
  document.getElementById('tz').value='';
  const q=e.target.value.trim();_active=-1;
  _matches=q.length<2?[]:searchPlaces(q).map(c=>({city:c}));
  if(q.includes('/')||!_matches.length){const f=fold(q);ALL_TZ.filter(t=>f&&fold(t).includes(f)).slice(0,10).forEach(tz=>_matches.push({tz}));}
  renderDrop();
});
document.addEventListener('keydown',e=>{
  if(e.target.id!=='tzInput'||!_matches.length)return;
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();_active=(_active+(e.key==='ArrowDown'?1:-1)+_matches.length)%_matches.length;renderDrop();
    const o=document.getElementById('opt-'+_active);if(o)o.scrollIntoView({block:'nearest'});}
  else if(e.key==='Enter'){e.preventDefault();pickPlace(Math.max(0,_active));}
  else if(e.key==='Escape'){_matches=[];renderDrop();}
});
document.addEventListener('click',e=>{
  const drop=document.getElementById('tzDrop');
  if(drop&&!e.target.closest('.tz-wrap'))drop.style.display='none';
});
}

function boot(){
  document.title=SYSTEM.pageTitle;
  const r=document.documentElement.style;
  Object.entries(SYSTEM.accent||{}).forEach(([k,v])=>r.setProperty('--'+k,v));
  document.getElementById('app').innerHTML=formHTML();
}
