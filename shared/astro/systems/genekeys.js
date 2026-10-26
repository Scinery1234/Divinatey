// ═════════════════════════════════════════════════════════════════════════════
// System module: Gene Keys — Hologenetic Profile
// Self-contained: this file is the only system module in gene-keys.html.
// ═════════════════════════════════════════════════════════════════════════════
(function(){
const GK_PLANETS=['Sun','Earth','Moon','Venus','Mars','Jupiter','Saturn','Mercury'];
const GK_SKY=GK_PLANETS.filter(p=>p!=='Earth');
const GK_ORB={Sun:5,Earth:5,Moon:3,Venus:4,Mars:4,Jupiter:5};
const gkOrb=b=>GK_ORB[b]||5;
const gpos=d=>positions(GK_PLANETS,d);

// ─── Gene Keys shadow/gift/siddhi ───
const GK={
1:{shadow:"Entropy",gift:"Freshness",siddhi:"Beauty"},
2:{shadow:"Dislocation",gift:"Orientation",siddhi:"Unity"},
3:{shadow:"Chaos",gift:"Innovation",siddhi:"Innocence"},
4:{shadow:"Intolerance",gift:"Understanding",siddhi:"Forgiveness"},
5:{shadow:"Impatience",gift:"Patience",siddhi:"Timelessness"},
6:{shadow:"Conflict",gift:"Diplomacy",siddhi:"Peace"},
7:{shadow:"Division",gift:"Guidance",siddhi:"Virtue"},
8:{shadow:"Mediocrity",gift:"Style",siddhi:"Exquisiteness"},
9:{shadow:"Inertia",gift:"Determination",siddhi:"Invincibility"},
10:{shadow:"Self-Obsession",gift:"Naturalness",siddhi:"Being"},
11:{shadow:"Obscurity",gift:"Idealism",siddhi:"Light"},
12:{shadow:"Vanity",gift:"Discrimination",siddhi:"Purity"},
13:{shadow:"Discord",gift:"Discernment",siddhi:"Empathy"},
14:{shadow:"Compromise",gift:"Competence",siddhi:"Bounteousness"},
15:{shadow:"Dullness",gift:"Magnetism",siddhi:"Florescence"},
16:{shadow:"Indifference",gift:"Versatility",siddhi:"Mastery"},
17:{shadow:"Opinion",gift:"Far-sightedness",siddhi:"Omniscience"},
18:{shadow:"Judgment",gift:"Integrity",siddhi:"Perfection"},
19:{shadow:"Co-dependence",gift:"Sensitivity",siddhi:"Sacrifice"},
20:{shadow:"Superficiality",gift:"Self-Assurance",siddhi:"Presence"},
21:{shadow:"Control",gift:"Authority",siddhi:"Valour"},
22:{shadow:"Dishonour",gift:"Graciousness",siddhi:"Grace"},
23:{shadow:"Complexity",gift:"Simplicity",siddhi:"Quintessence"},
24:{shadow:"Addiction",gift:"Invention",siddhi:"Silence"},
25:{shadow:"Constriction",gift:"Acceptance",siddhi:"Universal Love"},
26:{shadow:"Pride",gift:"Artfulness",siddhi:"Invisibility"},
27:{shadow:"Selfishness",gift:"Altruism",siddhi:"Selflessness"},
28:{shadow:"Purposelessness",gift:"Totality",siddhi:"Immortality"},
29:{shadow:"Half-heartedness",gift:"Commitment",siddhi:"Devotion"},
30:{shadow:"Desire",gift:"Lightness",siddhi:"Rapture"},
31:{shadow:"Arrogance",gift:"Leadership",siddhi:"Humility"},
32:{shadow:"Failure",gift:"Preservation",siddhi:"Veneration"},
33:{shadow:"Forgetting",gift:"Mindfulness",siddhi:"Revelation"},
34:{shadow:"Force",gift:"Strength",siddhi:"Majesty"},
35:{shadow:"Hunger",gift:"Adventure",siddhi:"Boundlessness"},
36:{shadow:"Turbulence",gift:"Humanity",siddhi:"Compassion"},
37:{shadow:"Weakness",gift:"Equality",siddhi:"Tenderness"},
38:{shadow:"Struggle",gift:"Perseverance",siddhi:"Honour"},
39:{shadow:"Provocation",gift:"Dynamism",siddhi:"Liberation"},
40:{shadow:"Exhaustion",gift:"Resolve",siddhi:"Divine Will"},
41:{shadow:"Fantasy",gift:"Anticipation",siddhi:"Emanation"},
42:{shadow:"Expectation",gift:"Detachment",siddhi:"Celebration"},
43:{shadow:"Deafness",gift:"Insight",siddhi:"Epiphany"},
44:{shadow:"Interference",gift:"Teamwork",siddhi:"Synarchy"},
45:{shadow:"Dominance",gift:"Synergy",siddhi:"Communion"},
46:{shadow:"Seriousness",gift:"Delight",siddhi:"Ecstasy"},
47:{shadow:"Oppression",gift:"Transmutation",siddhi:"Transfiguration"},
48:{shadow:"Inadequacy",gift:"Resourcefulness",siddhi:"Wisdom"},
49:{shadow:"Reaction",gift:"Revolution",siddhi:"Rebirth"},
50:{shadow:"Corruption",gift:"Equilibrium",siddhi:"Harmony"},
51:{shadow:"Agitation",gift:"Initiative",siddhi:"Awakening"},
52:{shadow:"Stress",gift:"Restraint",siddhi:"Stillness"},
53:{shadow:"Immaturity",gift:"Expansion",siddhi:"Superabundance"},
54:{shadow:"Greed",gift:"Aspiration",siddhi:"Ascension"},
55:{shadow:"Victimisation",gift:"Freedom",siddhi:"Freedom"},
56:{shadow:"Distraction",gift:"Enrichment",siddhi:"Intoxication"},
57:{shadow:"Unease",gift:"Intuition",siddhi:"Clarity"},
58:{shadow:"Dissatisfaction",gift:"Vitality",siddhi:"Bliss"},
59:{shadow:"Dishonesty",gift:"Intimacy",siddhi:"Transparency"},
60:{shadow:"Limitation",gift:"Realism",siddhi:"Justice"},
61:{shadow:"Psychosis",gift:"Inspiration",siddhi:"Sanctity"},
62:{shadow:"Intellectualisation",gift:"Precision",siddhi:"Impeccability"},
63:{shadow:"Doubt",gift:"Inquiry",siddhi:"Truth"},
64:{shadow:"Confusion",gift:"Imagination",siddhi:"Illumination"}
};
const PL={1:"Investigator",2:"Hermit",3:"Martyr",4:"Opportunist",5:"Heretic",6:"Role Model"};

function sphere(label,lon,note){
  const{gate,line}=gateLine(lon),g=GK[gate]||{};
  return{label,gate,line,display:`${gate}.${line}`,lineName:PL[line]||'',
    shadow:g.shadow||'—',gift:g.gift||'—',siddhi:g.siddhi||'—',lon,note:note||''};
}

function buildProfile(nd,dd){
  const N=gpos(nd),D=gpos(dd);
  const lw=sphere("Life's Work",N.Sun),ev=sphere("Evolution",N.Earth),
        ra=sphere("Radiance",D.Sun),pu=sphere("Purpose",D.Earth),
        at=sphere("Attraction",D.Moon),iq=sphere("IQ",N.Venus),
        eq=sphere("EQ",N.Mars),sq=sphere("SQ",D.Venus),co=sphere("Core",D.Mars),
        cu=sphere("Culture",D.Jupiter),pe=sphere("Pearl",N.Jupiter),
        br=sphere("Brand",N.Sun,"= Life's Work"),vo=sphere("Vocation",D.Mars,"= Core");
  return{pLine:`${lw.line}/${ra.line}`,pDesc:`${PL[lw.line]||''} / ${PL[ra.line]||''}`,
    activation:[lw,ev,ra,pu],venus:[at,iq,eq,sq,co,pu],pearl:[br,vo,cu,pe],N,D,nd,dd};
}

// ─── buildSVG ─────────────────────────────────────────────────────────────
// Layout (top → bottom):
//   VERTICAL:    Life's Work, Pearl, SQ (centre), Attraction, Purpose
//   HORIZONTAL:  Radiance — SQ — Evolution
//   CIRCLE of 4: Vocation (upper-left), Culture (upper-right),
//                IQ (lower-left), EQ (lower-right)
function buildSVG(p){
  const W=860,H=880,R=42;
  const CA='#b07010',CV='#8b2050',CP='#1a6b48';
  const TS='#7a1010',TG='#1a5020',TD='#1a2870';

  // 11 sphere centres [cx, cy]
  const POS={
    lw:[430, 68],  // Life's Work  top vertical    Activation+Pearl
    pe:[430,220],  // Pearl        2nd vertical    Pearl
    vo:[310,308],  // Vocation     upper-left      Venus+Pearl
    cu:[550,308],  // Culture      upper-right     Pearl
    ra:[ 95,420],  // Radiance     left horiz      Activation
    sq:[430,420],  // SQ           centre          Venus
    ev:[765,420],  // Evolution    right horiz     Activation
    iq:[310,532],  // IQ           lower-left      Venus
    eq:[550,532],  // EQ           lower-right     Venus
    at:[430,620],  // Attraction   4th vertical    Venus
    pu:[430,775],  // Purpose      bottom vertical Activation+Venus
  };

  // Sphere data from profile
  const pu=p.activation[3],ra=p.activation[2],ev=p.activation[1],lw=p.activation[0];
  const at=p.venus[0],iq=p.venus[1],eq=p.venus[2],sq=p.venus[3],vo=p.venus[4];
  const cu=p.pearl[2],pe=p.pearl[3];
  const SD={pu,at,iq,vo,ra,sq,ev,eq,cu,pe,lw};

  const META={
    pu:{name:'Purpose',     c1:CA,c2:CV},
    at:{name:'Attraction',  c1:CV,c2:null},
    iq:{name:'IQ',          c1:CV,c2:null},
    vo:{name:'Vocation',    c1:CV,c2:CP},
    ra:{name:'Radiance',    c1:CA,c2:null},
    sq:{name:'SQ',          c1:CV,c2:null},
    ev:{name:'Evolution',   c1:CA,c2:null},
    eq:{name:'EQ',          c1:CV,c2:null},
    cu:{name:'Culture',     c1:CP,c2:null},
    pe:{name:'Pearl',       c1:CP,c2:null},
    lw:{name:"Life's Work", c1:CA,c2:CP},
  };

  function edge(k1,k2,col,op,da=''){
    const[x1,y1]=POS[k1],[x2,y2]=POS[k2];
    const dx=x2-x1,dy=y2-y1,d=Math.hypot(dx,dy),g=R+4,ux=dx/d,uy=dy/d;
    return`<line x1="${(x1+ux*g).toFixed(1)}" y1="${(y1+uy*g).toFixed(1)}"
      x2="${(x2-ux*g).toFixed(1)}" y2="${(y2-uy*g).toFixed(1)}"
      stroke="${col}" stroke-width="1.8" opacity="${op}"${da?` stroke-dasharray="${da}"`:''}/>`;
  }

  function mkSphere(key){
    const[cx,cy]=POS[key],d=SD[key],m=META[key];
    const[gn,ln]=d.display.split('.');
    const{c1,c2,name}=m,lx=R+11;

    let circ=c2
      ?`<circle cx="${cx}" cy="${cy}" r="${R+7}" fill="none" stroke="${c2}" stroke-width="2" opacity="0.55" stroke-dasharray="7,4"/>
         <circle cx="${cx}" cy="${cy}" r="${R}" fill="#fffef9" stroke="${c1}" stroke-width="2.8"/>`
      :`<circle cx="${cx}" cy="${cy}" r="${R+5}" fill="${c1}" opacity="0.07"/>
         <circle cx="${cx}" cy="${cy}" r="${R}" fill="white" stroke="${c1}" stroke-width="2.8"/>`;

    const inner=`<text x="${cx}" y="${cy-3}" text-anchor="middle" font-size="19"
        font-weight="bold" fill="#1a1a1a" font-family="Georgia,serif">${gn}</text>
      <text x="${cx}" y="${cy+14}" text-anchor="middle" font-size="10"
        fill="#666" font-family="Georgia,serif">.${ln}\u00b7${d.lineName}</text>`;

    const NR=(x,y)=>`<text x="${x}" y="${y}" text-anchor="start" font-size="10" font-weight="bold" fill="${c1}" font-family="Georgia,serif">${name}</text>`;
    const NL=(x,y)=>`<text x="${x}" y="${y}" text-anchor="end" font-size="10" font-weight="bold" fill="${c1}" font-family="Georgia,serif">${name}</text>`;
    const NM=(x,y)=>`<text x="${x}" y="${y}" text-anchor="middle" font-size="10" font-weight="bold" fill="${c1}" font-family="Georgia,serif">${name}</text>`;
    const SR=(x,y)=>`<text x="${x}" y="${y}" text-anchor="start" font-size="8" fill="${TS}" font-family="Georgia,serif">${d.shadow}</text>
      <text x="${x}" y="${y+11}" text-anchor="start" font-size="8" fill="${TG}" font-family="Georgia,serif">${d.gift}</text>
      <text x="${x}" y="${y+22}" text-anchor="start" font-size="8" fill="${TD}" font-family="Georgia,serif">${d.siddhi}</text>`;
    const SL=(x,y)=>`<text x="${x}" y="${y}" text-anchor="end" font-size="8" fill="${TS}" font-family="Georgia,serif">${d.shadow}</text>
      <text x="${x}" y="${y+11}" text-anchor="end" font-size="8" fill="${TG}" font-family="Georgia,serif">${d.gift}</text>
      <text x="${x}" y="${y+22}" text-anchor="end" font-size="8" fill="${TD}" font-family="Georgia,serif">${d.siddhi}</text>`;
    const SM=(x,y)=>`<text x="${x}" y="${y}" text-anchor="middle" font-size="8" fill="${TS}" font-family="Georgia,serif">${d.shadow}</text>
      <text x="${x}" y="${y+11}" text-anchor="middle" font-size="8" fill="${TG}" font-family="Georgia,serif">${d.gift}</text>
      <text x="${x}" y="${y+22}" text-anchor="middle" font-size="8" fill="${TD}" font-family="Georgia,serif">${d.siddhi}</text>`;

    let lbl='';
    switch(key){
      case 'lw': lbl=NM(cx,cy-R-14)+SL(cx-lx,cy-6); break;
      case 'pe': lbl=NL(cx-lx,cy-4)+SL(cx-lx,cy+10); break;
      case 'eq': lbl=NR(cx+lx,cy-4)+SR(cx+lx,cy+10); break;
      case 'iq': lbl=NL(cx-lx,cy-4)+SL(cx-lx,cy+10); break;
      case 'ra': lbl=NM(cx,cy-R-14)+SM(cx,cy+R+14); break;
      case 'sq': lbl=NR(cx+lx,cy-4)+SR(cx+lx,cy+10); break;
      case 'ev': lbl=NM(cx,cy-R-14)+SM(cx,cy+R+14); break;
      case 'cu': lbl=NR(cx+lx,cy-4)+SR(cx+lx,cy+10); break;
      case 'vo': lbl=NL(cx-lx,cy-4)+SL(cx-lx,cy+10); break;
      case 'at': lbl=NR(cx+lx,cy-4)+SR(cx+lx,cy+10); break;
      case 'pu': lbl=NM(cx,cy+R+15)+SM(cx,cy+R+30); break;
    }
    return`<g>${circ}${inner}${lbl}</g>`;
  }

  // ACTIVATION (gold): complete graph on {pu,ra,ev,lw}
  const actLines=[
    edge('pu','ra',CA,'0.28'),
    edge('pu','ev',CA,'0.28'),
    edge('pu','lw',CA,'0.15','12,8'),   // long vertical spine
    edge('ra','ev',CA,'0.18'),           // long horizontal
    edge('ra','lw',CA,'0.28'),
    edge('ev','lw',CA,'0.28'),
  ].join('');

  // VENUS (crimson): ring pu→at→iq→eq→sq→vo→pu + inner star
  const venLines=[
    edge('pu','at',CV,'0.42'),
    edge('at','iq',CV,'0.42'),
    edge('iq','eq',CV,'0.42'),
    edge('eq','sq',CV,'0.42'),
    edge('sq','vo',CV,'0.42'),
    edge('vo','pu',CV,'0.42'),
    edge('at','vo',CV,'0.22','5,4'),
    edge('at','sq',CV,'0.22','5,4'),
    edge('iq','sq',CV,'0.22','5,4'),
    edge('eq','vo',CV,'0.22','5,4'),
    edge('iq','vo','#999','0.14','3,6'),
    edge('eq','cu','#999','0.14','3,6'),
  ].join('');

  // PEARL (teal): chain lw→vo→cu→pe
  const prlLines=[
    edge('lw','vo',CP,'0.40'),
    edge('vo','cu',CP,'0.45'),
    edge('cu','pe',CP,'0.45'),
    edge('pe','lw',CP,'0.18','6,5'),
  ].join('');

  const spheres=Object.keys(POS).map(k=>mkSphere(k)).join('');

  const lY=H-46;
  const legend=`<g font-family="Georgia,serif">
    <circle cx="22" cy="${lY}" r="5" fill="${CA}"/>
    <text x="34" y="${lY+4}" font-size="10" fill="${CA}">Activation</text>
    <circle cx="118" cy="${lY}" r="5" fill="${CV}"/>
    <text x="130" y="${lY+4}" font-size="10" fill="${CV}">Venus</text>
    <circle cx="191" cy="${lY}" r="5" fill="${CP}"/>
    <text x="203" y="${lY+4}" font-size="10" fill="${CP}">Pearl</text>
    <text x="275" y="${lY+4}" font-size="9" fill="${TS}">■ Shadow</text>
    <text x="350" y="${lY+4}" font-size="9" fill="${TG}">■ Gift</text>
    <text x="402" y="${lY+4}" font-size="9" fill="${TD}">■ Siddhi</text>
    <text x="450" y="${lY+4}" font-size="9" fill="#bbb">— dashed outer ring = shared sphere</text>
  </g>`;

  return`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"
      style="width:100%;max-width:${W}px;display:block;margin:0 auto;background:#fafaf8">
    ${actLines}${venLines}${prlLines}${spheres}${legend}</svg>`;
}


// ─── Transits ────────────────────────────────────────────────────────────────
function profSpheres(p){
  const a=p.activation,v=p.venus,r=p.pearl;
  return[
    {key:'lw',name:"Life's Work",lon:a[0].lon,gate:a[0].display},
    {key:'ev',name:'Evolution',  lon:a[1].lon,gate:a[1].display},
    {key:'ra',name:'Radiance',   lon:a[2].lon,gate:a[2].display},
    {key:'pu',name:'Purpose',    lon:a[3].lon,gate:a[3].display},
    {key:'at',name:'Attraction', lon:v[0].lon,gate:v[0].display},
    {key:'iq',name:'IQ',         lon:v[1].lon,gate:v[1].display},
    {key:'eq',name:'EQ',         lon:v[2].lon,gate:v[2].display},
    {key:'sq',name:'SQ',         lon:v[3].lon,gate:v[3].display},
    {key:'vo',name:'Vocation',   lon:v[4].lon,gate:v[4].display},
    {key:'cu',name:'Culture',    lon:r[2].lon,gate:r[2].display},
    {key:'pe',name:'Pearl',      lon:r[3].lon,gate:r[3].display},
  ];
}
const tcfg=p=>({bodies:GK_PLANETS,skyBodies:GK_SKY,lonFn:tropLon,orbFn:b=>gkOrb(b),points:profSpheres(p)});
const gtxt=lon=>{const g=gateLine(lon);return`${g.gate}.${g.line}`;};

function transitsHTML(p){
  const now=new Date(),cfg=tcfg(p),nowPos=gpos(now);
  const planetRows=GK_PLANETS.map(pl=>{
    const{gate,line}=gateLine(nowPos[pl]),gk=GK[gate]||{};
    return[pl+rxMark(pl,now),{cls:'mono',html:`${gate}.${line}`},
      {style:'color:#7a1010;font-size:.78rem',html:gk.shadow||'—'},
      {style:'color:#1a5020;font-size:.78rem',html:gk.gift||'—'},
      {style:'color:#1a2870;font-size:.78rem',html:gk.siddhi||'—'}];
  });
  const hits=scanTransits(cfg,now);
  const aspRows=hits.map(h=>{
    const gl=gateLine(h.tLon),gk=GK[gl.gate]||{},ap=applying(tropLon,h.body,h.pt.lon,h.asp.ang,now);
    return[h.body+rxMark(h.body,now),{cls:'mono',html:`${gl.gate}.${gl.line}`},{cls:'dim',html:`${gk.shadow||''}→${gk.gift||''}`},
      {cls:'c-'+h.asp.type,style:'font-size:1.1rem',html:h.asp.sym},h.asp.name,
      {style:'font-weight:bold;color:var(--deep)',html:h.pt.name},{cls:'mono',html:h.pt.gate},
      {style:`font-size:.75rem;color:var(${ap?'--soft':'--hard'})`,html:ap?'▶ applying':'◀ separating'},{cls:'dim',html:h.asp.orb+'°'}];
  });
  const sky=skyAspects(cfg,now).map(h=>[h.p1,{cls:'mono',html:gtxt(h.lon1)},{cls:'c-'+h.asp.type,html:h.asp.sym},h.asp.name,h.p2,{cls:'mono',html:gtxt(h.lon2)},{cls:'dim',html:h.asp.orb+'°'}]);
  const fc=aspectForecast(cfg,now,14).map(d=>({label:d.label,rows:[
    ...d.stations.map(stationRow),
    ...d.personal.map(h=>{const gl=gateLine(h.tLon),gk=GK[gl.gate]||{};
      return`<div class="fc-row"><span title="Personal transit">🎯</span><span class="who">${h.body}</span><span class="mono">${gl.gate}.${gl.line}</span>
        <span class="dim" style="min-width:100px">${gk.shadow||''}→${gk.gift||''}</span><span class="c-${h.asp.type}">${h.asp.sym}</span><span class="what">${h.asp.name}</span>
        <span class="tgt">${h.pt.name}</span><span class="mono">${h.pt.gate}</span>${pill(h.asp.orb<0.5)}<span class="dim">${h.asp.orb}°</span></div>`;}),
    ...d.sky.map(h=>`<div class="fc-row" style="opacity:.85"><span title="Sky aspect">🌍</span><span class="who">${h.p1}</span><span class="mono">${gtxt(h.lon1)}</span>
        <span class="c-${h.asp.type}">${h.asp.sym}</span><span class="what">${h.asp.name}</span><span class="tgt" style="color:var(--sky)">${h.p2}</span>
        <span class="mono">${gtxt(h.lon2)}</span>${pill(h.asp.orb<0.5,true)}<span class="dim">${h.asp.orb}°</span></div>`)]}));
  return`<div class="section">
    ${secH('Current Planetary Positions',longDate(now))}
    <div style="overflow-x:auto;margin-bottom:22px">${tableHTML(['Planet','Gate.Line','<span style="color:#7a1010">Shadow</span>','<span style="color:#1a5020">Gift</span>','<span style="color:#1a2870">Siddhi</span>'],planetRows)}</div>
    <div class="grid2">
      <div>${secH('🎯 Your Profile Transits')}${tableHTML(['Planet','Gate','','Aspect','','Sphere','Your Gate','Dir','Orb'],aspRows,'No aspects within orb right now')}</div>
      <div>${secH('🌍 Current Sky Aspects')}${tableHTML(['P1','Gate','','Aspect','P2','Gate','Orb'],sky,'No inter-planetary aspects within orb')}</div>
    </div>
    ${secH('14-Day Transit Forecast')}
    <p class="tagline">Newly entering &amp; exact aspects · ☌ conj · ☍ opp · □ sq · △ trine · ⚹ sext · Moon orb 3° · others 4–5°</p>
    <div class="box">${forecastHTML(fc,'No new aspects entering orb in the next 14 days')}</div>
  </div>`;
}

function positionsHTML(p){
  const rows=GK_PLANETS.map(pl=>{
    const nl=p.N[pl],dl=p.D[pl],ng=gateLine(nl),dg=gateLine(dl);
    return[pl,{cls:'mono',html:nl.toFixed(4)},{cls:'mono',html:`${ng.gate}.${ng.line}`},{cls:'mono',html:dl.toFixed(4)},{cls:'mono',html:`${dg.gate}.${dg.line}`},{cls:'dim',html:norm(nl-MANDALA_START).toFixed(4)+'°'}];
  });
  return toggleNext('Show planetary positions')+`<div class="eph-table">${tableHTML(['Planet','Natal lon°','Natal G.L','Design lon°','Design G.L','Natal ° from Gate 41'],rows)}</div>`;
}

// ─── Energetic Reading data (computed sky + profile only) ───────────────────
function readingData(p){
  const now=new Date(),cfg=tcfg(p),tPos=gpos(now);
  const skyThemes=GK_SKY.map(pl=>{const gk=GK[gateLine(tPos[pl]).gate]||{};
    return pl+': shadow='+(gk.shadow||'?')+', gift='+(gk.gift||'?')+', siddhi='+(gk.siddhi||'?');}).join('\n');
  const skyTech=GK_SKY.map(pl=>{const{gate,line}=gateLine(tPos[pl]),gk=GK[gate]||{};
    return pl+' Gate '+gate+'.'+line+' ('+(gk.shadow||'?')+' → '+(gk.gift||'?')+')';}).join('\n');
  const nowAsp=scanTransits(cfg,now),skyAsp=skyAspects(cfg,now);
  const personalThemes=nowAsp.length?nowAsp.map(h=>{const gk=GK[gateLine(h.tLon).gate]||{};
      return h.body+' ('+(gk.gift||'?')+') '+h.asp.name+' your '+h.pt.name+' — '+(applying(tropLon,h.body,h.pt.lon,h.asp.ang,now)?'applying':'separating');}).join('\n')
    :'No personal transits within orb';
  const personalTech=nowAsp.length?nowAsp.map(h=>{const g=gateLine(h.tLon),gk=GK[g.gate]||{};
      return h.body+' Gate '+g.gate+'.'+g.line+' ('+(gk.shadow||'?')+') '+h.asp.sym+' '+h.asp.name+' your '+h.pt.name+' Gate '+h.pt.gate;}).join('\n'):'None';
  const skyAspThemes=skyAsp.length?skyAsp.map(h=>{const g1=GK[gateLine(h.lon1).gate]||{},g2=GK[gateLine(h.lon2).gate]||{};
      return h.p1+' ('+(g1.gift||'?')+') '+h.asp.name+' '+h.p2+' ('+(g2.gift||'?')+')';}).join('\n'):'None';
  const skyAspTech=skyAsp.length?skyAsp.map(h=>h.p1+' '+h.asp.sym+' '+h.asp.name+' '+h.p2+' orb '+h.asp.orb.toFixed(1)).join('\n'):'None';
  const up=aspectForecast(cfg,now,7),upThemes=[],upTech=[];
  up.forEach(d=>{
    if(!d.personal.length&&!d.sky.length)return;
    upThemes.push(d.label+': '+[
      ...d.personal.map(h=>h.body+' ('+((GK[gateLine(h.tLon).gate]||{}).gift||'?')+') activates your '+h.pt.name),
      ...d.sky.map(h=>h.p1+' ('+((GK[gateLine(h.lon1).gate]||{}).gift||'?')+') '+h.asp.name+' '+h.p2)].join('; '));
    upTech.push(d.label+':\n'+[
      ...d.personal.map(h=>'  '+h.body+' Gate '+gtxt(h.tLon)+' '+h.asp.sym+' '+h.pt.name+' Gate '+h.pt.gate+(h.asp.orb<0.5?' [EXACT]':'')),
      ...d.sky.map(h=>'  '+h.p1+' Gate '+gtxt(h.lon1)+' '+h.asp.sym+' '+h.p2+(h.asp.orb<0.5?' [EXACT]':''))].join('\n'));
  });
  return{skyThemes,skyTech,personalThemes,personalTech,skyAspThemes,skyAspTech,
    upcomingThemes:upThemes.join('\n')||'No new aspects in 7 days',upcomingTech:upTech.join('\n')||'None',name:p.input.name||''};
}

const SECTIONS=[
  {id:1,icon:'🌅',title:'The Present Signature',desc:'The overall energetic tone right now',
   prompt:d=>'You are a Gene Keys contemplative guide. Here is data about the current sky (internal — do not quote or list it):\n\n'+
     'Planetary gifts currently active in the sky:\n'+d.skyThemes+'\n\nInter-planetary dynamics:\n'+d.skyAspThemes+'\n\n'+
     'Write a 220–260 word reading about the overall energetic signature of this present moment. '+
     'Synthesise the qualities into a coherent felt sense of what is in the field right now. '+
     'What is the quality of attention being asked for? What is ripening, releasing, or building? '+
     'Use shadow, gift, and siddhi as felt qualities, not labels. Do not mention planet names, gate numbers, or aspect types. '+
     'Write in warm, accessible Gene Keys language for someone who has no astrology background.',
   astroPrompt:d=>'Provide a brief astrological context (120–150 words) for a Gene Keys "Present Signature" reading. '+
     'Mention specific planets, gate numbers, and inter-planetary aspects:\n\nSky:\n'+d.skyTech+'\nAspects:\n'+d.skyAspTech},
  {id:2,icon:'🌿',title:'Your Personal Themes',desc:'What is alive in your profile right now',
   prompt:d=>'You are a Gene Keys contemplative guide. Here is data about this person\'s active transits (internal — do not quote or list it):\n\n'+
     (d.name?'Person: '+d.name+'\n\n':'')+'Their sphere activations:\n'+d.personalThemes+'\n\n'+
     'Write a 220–260 word reading about what is personally alive for this person right now. '+
     'Speak through the themes and purposes of the named spheres (Life\'s Work, Radiance, Evolution, Purpose, Attraction, IQ, EQ, SQ, Vocation, Culture, Pearl). '+
     'What is being awakened, tested, or invited in them specifically? If there are no personal transits, speak about the space that holds when nothing is pressing. '+
     'Do not mention planet names, gate numbers, or aspect types. Write as if speaking warmly and directly to them.',
   astroPrompt:d=>'Provide a brief astrological context (120–150 words) for a Gene Keys "Personal Themes" reading. '+
     'List specific planets, gates, sphere names, and aspect types:\n\n'+d.personalTech},
  {id:3,icon:'🔭',title:'The Week Ahead',desc:'Themes and invitations over the next 7 days',
   prompt:d=>'You are a Gene Keys contemplative guide. Here are themes entering the field in the next 7 days (internal — do not quote dates or list items mechanically):\n\n'+
     d.upcomingThemes+'\n\nWrite a 220–260 word reading about the energetic landscape of the coming week. '+
     'Weave the themes into a narrative arc — what is building, what threshold is approaching, what is completing? '+
     'Speak in terms of inner invitations and qualities of being, not events. Do not mention planet names, gate numbers, aspect types, or specific dates. '+
     'End with a felt sense of what this week is asking us to step into.',
   astroPrompt:d=>'Provide a brief astrological context (120–150 words) for a Gene Keys "Week Ahead" reading. '+
     'List specific planetary events, gates, and aspects by date:\n\n'+d.upcomingTech},
  {id:4,icon:'✦',title:'Contemplation',desc:'A closing reflection to sit with',
   prompt:d=>'You are a Gene Keys contemplative guide. Drawing on the current sky themes and this person\'s personal activations:\n\n'+
     'Sky gifts: '+d.skyThemes.split('\n').map(l=>(l.split('gift=')[1]||'').split(',')[0]).filter(Boolean).join(', ')+'\n'+
     'Personal: '+d.personalThemes+'\n\n'+
     'Write a single contemplative question or poetic invitation (70–90 words) to sit with. '+
     'It should be evocative, grounded, and open — something to sit with rather than answer. No gate numbers, no technical terms, no planet names.'}
];

// ─── Guide ───────────────────────────────────────────────────────────────────
const SEQ_META=[
  {key:'activation',name:'Activation',full:'Activation Sequence',icon:'☀️',col:'#b07010',blurb:'Your four Prime Gifts — the genius you came to embody'},
  {key:'venus',name:'Venus',full:'Venus Sequence',icon:'💗',col:'#8b2050',blurb:'The pathway of opening the heart through relationships'},
  {key:'pearl',name:'Pearl',full:'Pearl Sequence',icon:'💎',col:'#1a6b48',blurb:'Liberating prosperity through service and vocation'}
];
const SPHERE_ROLE={
  "Life's Work":'what you are here to do — your outer genius and creative expression',
  "Evolution":'your greatest challenge and the arena of your deepest growth',
  "Radiance":'what keeps your body and aura vital — how you stay healthy and radiant',
  "Purpose":'the deep inner reason beneath your life — felt rather than thought',
  "Attraction":'the force shaping who and what you draw into relationship',
  "IQ":'the mental patterns formed in childhood (7–14) — how your thinking opens',
  "EQ":'the emotional patterns formed from 0–7 — how your heart matures',
  "SQ":'the deepest wound-and-gift imprint from the womb and first moments',
  "Core":'the core wound of self-worth — and the fountain of true vocation',
  "Brand":'how your genius is seen by the world when you serve from your gifts',
  "Vocation":'the work that is truly yours — service arising from your core',
  "Culture":'your natural role in community — how you contribute to the collective',
  "Pearl":'the lens of simplicity — where prosperity concentrates when you live your purpose'
};
// One key, one prompt: only this sphere's own data goes in.
function keyPrompt(sp){
  return 'You are a Gene Keys contemplative guide. Explain one sphere of a person\'s Hologenetic Profile.\n\n'+
    'Sphere: '+sp.label+' — '+(SPHERE_ROLE[sp.label]||'')+'\n'+
    'Gene Key '+sp.gate+', Line '+sp.line+(sp.lineName?' ("'+sp.lineName+'")':'')+'\n'+
    'Shadow: '+sp.shadow+' · Gift: '+sp.gift+' · Siddhi: '+sp.siddhi+'\n\n'+
    'Write 160–200 words explaining what this placement means for them personally. '+
    'Describe: (1) how the Shadow tends to show up as a felt pattern in this area of life, (2) what the Gift looks like when it opens, '+
    '(3) a hint of the Siddhi as distant fragrance, (4) how the line number colours the expression. '+
    'Warm, direct, second person. No astrology jargon beyond the Gene Keys terms given. No headings.';
}
// Sequence summary: the keys of this one sequence only.
function seqPrompt(p,meta){
  const lines=p[meta.key].map(sp=>sp.label+': Gene Key '+sp.gate+'.'+sp.line+' (Shadow '+sp.shadow+' → Gift '+sp.gift+' → Siddhi '+sp.siddhi+')'+(sp.note?' '+sp.note:'')).join('\n');
  return 'You are a Gene Keys contemplative guide. Write an overall summary of a person\'s '+meta.full+'.\n\n'+
    'Theme of this sequence: '+meta.blurb+'.\n\nTheir keys in order:\n'+lines+'\n\n'+
    'Write 220–270 words synthesising the journey of this sequence as a whole — the narrative arc that these specific keys form together, how the shadows interlock as one pattern and how the gifts open as one unfolding. '+
    'Reference the sphere names and key qualities naturally. Warm, direct, second person. No headings, no bullet lists.';
}

window.SYSTEM={
  id:'gene-keys',pageTitle:'Gene Keys Hologenetic Profile',title:'Hologenetic Profile',noun:'Profile',
  formTitle:'Gene Keys Hologenetic Profile',formSub:'Activation, Venus and Pearl sequences from your birth moment and design moment.',
  needsLocation:false,
  accent:{accent:'#b07010','accent-dk':'#8a5808',deep:'#5a3a1a'},
  compute(inp){
    const nd=T(inp.utc),dd=T(designDate(inp.utc));
    return buildProfile(nd,dd);
  },
  header(p){
    const s=tropLon('Sun',p.nd),g=gateLine(s);
    return`Natal ${fmtDate(p.nd)} · Design ${fmtDate(p.dd)} · <span title="A Sun within ±0.5° of a line boundary may need an exact birth time">LW Sun ${s.toFixed(3)}° → ${g.gate}.${g.line}</span>`;
  },
  badges:p=>[{n:p.pLine,h:'Profile Line',p:p.pDesc}],
  chartHTML:p=>`<div class="svg-wrap">${buildSVG(p)}</div>`,
  positionsHTML,transitsHTML,
  reading:{title:'Energetic Signature Reading',sections:SECTIONS,data:readingData},
  guide:{title:'Profile Guide',fab:'Profile Guide',
    tabs:SEQ_META.map(m=>({key:m.key,name:m.name,icon:m.icon,col:m.col,blurb:m.blurb,
      overviewTitle:m.full+' — Overview',overviewHint:'Overall summary of this sequence — click Generate.',
      items:p=>p[m.key].map(sp=>({title:sp.label,code:sp.display+(sp.note?` <span class="dim">${sp.note}</span>`:''),
        sub:`<span style="color:#7a1010">${sp.shadow}</span> → <span style="color:#1a5020">${sp.gift}</span> → <span style="color:#1a2870">${sp.siddhi}</span>`,
        role:SPHERE_ROLE[sp.label]||'',prompt:keyPrompt(sp)})),
      overview:p=>seqPrompt(p,m)}))}
};
})();
