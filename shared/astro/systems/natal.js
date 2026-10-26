// ═════════════════════════════════════════════════════════════════════════════
// System module: Natal Astrology — Western tropical chart, Placidus houses
// Self-contained: this file is the only system module in natal-astrology.html.
// ═════════════════════════════════════════════════════════════════════════════
(function(){
const PLANETS=['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto','NorthNode'];
const TRANSIT_BODIES=['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'];
const NAME={Sun:'Sun',Moon:'Moon',Mercury:'Mercury',Venus:'Venus',Mars:'Mars',Jupiter:'Jupiter',Saturn:'Saturn',Uranus:'Uranus',Neptune:'Neptune',Pluto:'Pluto',NorthNode:'North Node',ASC:'Ascendant',MC:'Midheaven'};
const GLYPH={Sun:'☉',Moon:'☽',Mercury:'☿',Venus:'♀',Mars:'♂',Jupiter:'♃',Saturn:'♄',Uranus:'♅',Neptune:'♆',Pluto:'♇',NorthNode:'☊',ASC:'AC',MC:'MC'};
const gl=k=>(GLYPH[k]||k)+(GLYPH[k]&&GLYPH[k].length===1?'︎':'');
const ELEMENT=['Fire','Earth','Air','Water'],MODALITY=['Cardinal','Fixed','Mutable'];
const RULER=['Mars','Venus','Mercury','Moon','Sun','Mercury','Venus','Pluto (trad. Mars)','Jupiter','Saturn','Uranus (trad. Saturn)','Neptune (trad. Jupiter)'];
const PLANET_ROLE={
  Sun:'core identity, vitality and conscious purpose',Moon:'emotional needs, instinct and what makes you feel safe',
  Mercury:'mind, communication and how you learn',Venus:'love, values, beauty and what you attract',Mars:'drive, desire, courage and how you act',
  Jupiter:'growth, faith, meaning and where life expands',Saturn:'structure, responsibility, limits and mastery over time',
  Uranus:'awakening, freedom and sudden change',Neptune:'imagination, spirituality, dissolution and ideals',Pluto:'power, depth and transformation',
  NorthNode:'the direction of growth this life is reaching toward',ASC:'how you meet the world — your approach, body and first impression',
  MC:'public life, calling and the direction of your reputation'};
const HOUSE_ROLE=['self, body and approach to life','money, possessions, resources and self-worth','communication, siblings, learning and the local world',
  'home, family, roots and inner foundations','creativity, romance, play and children','work, health, routines and service',
  'partnership, marriage and open others','intimacy, shared resources, death and rebirth','beliefs, higher learning, travel and meaning',
  'career, vocation, reputation and authority','friends, groups, community and hopes','solitude, the unconscious, retreat and spirituality'];
const ORD=n=>n+(['th','st','nd','rd'][(n%100>10&&n%100<14)?0:n%10]||'th');

// Natal orbs: 8° conj/opp, 7° square/trine, 5° sextile; +2° when Sun or Moon is involved.
const NATAL_ASPECTS=[...ASPECTS,{name:'Quincunx',sym:'⚻',ang:150,type:'minor'}];
const natalOrb=(a,b)=>asp=>{
  const base={0:8,180:8,90:7,120:7,60:5,150:3}[asp.ang];
  const lum=[a,b].some(x=>x==='Sun'||x==='Moon')&&asp.ang!==150?2:0;
  const ang=[a,b].some(x=>x==='ASC'||x==='MC')?-3:0;
  return base+lum+ang;
};
// Transit orbs: tighter, by transiting body.
const TR_ORB={Moon:3,Sun:2,Mercury:2,Venus:2,Mars:2,Jupiter:2,Saturn:2,Uranus:1.5,Neptune:1.5,Pluto:1.5};

// ─── Chart calculation ──────────────────────────────────────────────────────
function compute(inp){
  const d=inp.utc,lat=inp.lat,lon=inp.lon;
  const pos=positions(PLANETS,d);
  const asc=ascLon(d,lat,lon),mc=mcLon(d,lon);
  let cusps=placidusCusps(d,lat,lon),houseSystem='Placidus';
  if(!cusps){cusps=wholeSignCusps(asc);houseSystem='Whole Sign';}
  const pts=PLANETS.map(k=>({key:k,lon:pos[k],retro:isRetro(k,d),house:houseOf(pos[k],cusps)}));
  pts.push({key:'ASC',lon:asc,house:1},{key:'MC',lon:mc,house:10});
  const aspects=[];
  for(let i=0;i<pts.length-1;i++)for(let j=i+1;j<pts.length;j++){
    const a=pts[i],b=pts[j];
    if((a.key==='ASC'&&b.key==='MC')||(a.key==='NorthNode'&&b.key==='ASC'))continue;
    const asp=findAspect(a.lon,b.lon,natalOrb(a.key,b.key),NATAL_ASPECTS);
    if(asp)aspects.push({a:a.key,b:b.key,asp});
  }
  const ten=pts.filter(p=>TRANSIT_BODIES.includes(p.key));
  const elements=[0,0,0,0],modes=[0,0,0];
  ten.forEach(p=>{const s=signIdx(p.lon);elements[s%4]++;modes[s%3]++;});
  return{d,lat,lon,pts,P:Object.fromEntries(pts.map(p=>[p.key,p])),asc,mc,cusps,houseSystem,aspects,
    patterns:findPatterns(pts,aspects),elements,modes,ruler:RULER[signIdx(asc)]};
}
function findPatterns(pts,aspects){
  const keys=pts.filter(p=>TRANSIT_BODIES.includes(p.key)).map(p=>p.key);
  const has=(x,y,ang)=>aspects.some(a=>((a.a===x&&a.b===y)||(a.a===y&&a.b===x))&&a.asp.ang===ang);
  const out=[],seen=new Set();
  const add=(name,members,desc)=>{const k=name+[...members].sort().join();if(!seen.has(k)){seen.add(k);out.push({name,members,desc});}};
  for(const a of keys)for(const b of keys)for(const c of keys){
    if(a>=b||b>=c)continue;
    if(has(a,b,120)&&has(b,c,120)&&has(a,c,120))add('Grand Trine',[a,b,c],'three planets in mutual trine — a closed circuit of ease and talent');
  }
  for(const a of keys)for(const b of keys){
    if(a>=b||!has(a,b,180))continue;
    for(const c of keys){
      if(c===a||c===b)continue;
      if(has(a,c,90)&&has(b,c,90)){
        const d4=keys.find(d=>d!==a&&d!==b&&d!==c&&has(c,d,180)&&has(a,d,90)&&has(b,d,90));
        if(d4)add('Grand Cross',[a,b,c,d4],'two oppositions squaring each other — great tension that builds great strength');
        else add('T-Square',[a,b,c],'an opposition both squaring a focal planet — the drive to resolve tension');
      }
    }
  }
  for(const a of keys)for(const b of keys){
    if(a>=b||!has(a,b,60))continue;
    for(const c of keys)if(c!==a&&c!==b&&has(a,c,150)&&has(b,c,150))add('Yod',[a,b,c],'two planets in sextile both quincunx an apex — a “finger of fate” pointing at a special task');
  }
  const bySign={};pts.filter(p=>TRANSIT_BODIES.includes(p.key)).forEach(p=>(bySign[signIdx(p.lon)]=bySign[signIdx(p.lon)]||[]).push(p.key));
  Object.entries(bySign).forEach(([s,m])=>{if(m.length>=3)add('Stellium',m,`three or more planets in ${SIGNS[s]} — a concentrated focus of energy`);});
  return out;
}

// ─── Chart wheel SVG ────────────────────────────────────────────────────────
function wheelSVG(c){
  const W=640,cx=320,cy=320,R1=300,R2=258,R3=232,R4=150;
  const th=lon=>(180+norm(lon-c.asc))*DEG;
  const xy=(lon,r)=>[cx+r*Math.cos(th(lon)),cy-r*Math.sin(th(lon))];
  const f=n=>n.toFixed(1);
  let s=`<circle cx="${cx}" cy="${cy}" r="${R1}" fill="#fffdf8" stroke="#8a7a60" stroke-width="1.4"/>
    <circle cx="${cx}" cy="${cy}" r="${R2}" fill="#fff" stroke="#8a7a60" stroke-width="1"/>
    <circle cx="${cx}" cy="${cy}" r="${R4}" fill="#fcfaf5" stroke="#c8b89a" stroke-width="1"/>`;
  const ECOL=['#c0392b','#4a7a3a','#b07010','#2a5a8a'];
  for(let i=0;i<12;i++){
    const[a,b]=xy(i*30,R1),[a2,b2]=xy(i*30,R2);
    s+=`<line x1="${f(a)}" y1="${f(b)}" x2="${f(a2)}" y2="${f(b2)}" stroke="#8a7a60" stroke-width="1"/>`;
    const[gx,gy]=xy(i*30+15,(R1+R2)/2);
    s+=`<text x="${f(gx)}" y="${f(gy+7)}" text-anchor="middle" font-size="20" fill="${ECOL[i%4]}">${SIGN_GLYPH[i]}</text>`;
    for(let k=1;k<6;k++){const[t1,t2]=xy(i*30+k*5,R2),[t3,t4]=xy(i*30+k*5,R2+6);s+=`<line x1="${f(t1)}" y1="${f(t2)}" x2="${f(t3)}" y2="${f(t4)}" stroke="#c8b89a"/>`;}
  }
  c.cusps.forEach((cu,i)=>{
    const ang=i===0||i===9;
    const[a,b]=xy(cu,R2),[a2,b2]=xy(cu,ang?R4-20:R4);
    s+=`<line x1="${f(a)}" y1="${f(b)}" x2="${f(a2)}" y2="${f(b2)}" stroke="${ang?'#5a3a1a':'#c8b89a'}" stroke-width="${ang?2:1}"/>`;
    const mid=cu+norm(c.cusps[(i+1)%12]-cu)/2,[hx,hy]=xy(mid,R4+12);
    s+=`<text x="${f(hx)}" y="${f(hy+4)}" text-anchor="middle" font-size="10" fill="#aaa" font-family="Georgia,serif">${i+1}</text>`;
  });
  [['AC',c.asc],['DC',c.asc+180],['MC',c.mc],['IC',c.mc+180]].forEach(([t,l])=>{const[x,y]=xy(l,R1+12);s+=`<text x="${f(x)}" y="${f(y+4)}" text-anchor="middle" font-size="11" font-weight="bold" fill="#5a3a1a" font-family="Georgia,serif">${t}</text>`;});
  // aspect lines
  const ACOL={hard:'#c0392b',soft:'#2a7a4a',neutral:'#b07010',minor:'#8a7aa0'};
  c.aspects.forEach(a=>{
    if(a.asp.ang===0||a.a==='ASC'||a.b==='ASC'||a.a==='MC'||a.b==='MC'||a.a==='NorthNode'||a.b==='NorthNode')return;
    const[x1,y1]=xy(c.P[a.a].lon,R4-4),[x2,y2]=xy(c.P[a.b].lon,R4-4);
    s+=`<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${ACOL[a.asp.type]}" stroke-width="${a.asp.orb<2?1.6:1}" opacity=".7"${a.asp.ang===150?' stroke-dasharray="4,3"':''}/>`;
  });
  // planets, spread so glyphs never overlap
  const pl=c.pts.filter(p=>p.key!=='ASC'&&p.key!=='MC').map(p=>({...p,disp:p.lon})).sort((a,b)=>a.lon-b.lon);
  const MIN=7.5;
  for(let it=0;it<60;it++){let moved=false;
    for(let i=0;i<pl.length;i++){const a=pl[i],b=pl[(i+1)%pl.length];const gap=norm(b.disp-a.disp);
      if(pl.length>1&&gap<MIN){const push=(MIN-gap)/2;a.disp=norm(a.disp-push);b.disp=norm(b.disp+push);moved=true;}}
    if(!moved)break;}
  pl.forEach(p=>{
    const[x,y]=xy(p.disp,R3-14),[tx,ty]=xy(p.lon,R2),[tx2,ty2]=xy(p.lon,R2-8),[dx,dy]=xy(p.disp,R3-36);
    s+=`<line x1="${f(tx)}" y1="${f(ty)}" x2="${f(tx2)}" y2="${f(ty2)}" stroke="#5a3a1a" stroke-width="1.4"/>
      <text x="${f(x)}" y="${f(y+7)}" text-anchor="middle" font-size="19" fill="#2a1a0a">${gl(p.key)}</text>
      <text x="${f(dx)}" y="${f(dy+3)}" text-anchor="middle" font-size="8.5" fill="#8a7a60" font-family="Georgia,serif">${Math.floor(norm(p.lon)%30)}°${p.retro?'℞':''}</text>`;
  });
  return`<svg viewBox="-10 -10 ${W+20} ${W+20}" xmlns="http://www.w3.org/2000/svg" style="max-width:600px">${s}</svg>`;
}

function chartHTML(c){
  const rows=c.pts.map(p=>[gl(p.key)+' '+NAME[p.key]+(p.retro?' <span class="rx">℞</span>':''),signPos(p.lon),{cls:'mono',html:ORD(p.house)}]);
  const el=ELEMENT.map((e,i)=>`${e} ${c.elements[i]}`).join(' · '),mo=MODALITY.map((m,i)=>`${m} ${c.modes[i]}`).join(' · ');
  const asp=c.aspects.map(a=>[gl(a.a)+' '+NAME[a.a],{cls:'c-'+a.asp.type,style:'font-size:1rem',html:a.asp.sym},a.asp.name,gl(a.b)+' '+NAME[a.b],{cls:'dim',html:a.asp.orb+'°'}]);
  return`${c.houseSystem!=='Placidus'?'<p class="warn">Placidus houses are undefined above the polar circles, so this chart uses Whole Sign houses.</p>':''}
  <div class="grid2" style="align-items:start">
    <div class="svg-wrap">${wheelSVG(c)}</div>
    <div>${secH('Placements')}${tableHTML(['Point','Position','House'],rows)}
      <p class="note">Elements: ${el}<br>Modalities: ${mo}<br>Chart ruler: ${c.ruler}</p>
      ${c.patterns.length?'<p class="note"><b>Patterns:</b> '+c.patterns.map(p=>`${p.name} (${p.members.map(k=>NAME[k]).join(', ')})`).join('; ')+'</p>':''}
    </div>
  </div>
  ${toggleNext('Show aspect list')}<div class="eph-table">${tableHTML(['Point','','Aspect','Point','Orb'],asp)}</div>`;
}
function positionsHTML(c){
  const rows=c.cusps.map((cu,i)=>[ORD(i+1),signPos(cu),{cls:'mono',html:cu.toFixed(3)}]);
  return '<br>'+toggleNext('Show house cusps ('+c.houseSystem+')')+`<div class="eph-table">${tableHTML(['House','Cusp','lon°'],rows)}</div>`;
}

// ─── Transits ────────────────────────────────────────────────────────────────
const tcfg=c=>({bodies:TRANSIT_BODIES,lonFn:tropLon,orbFn:b=>TR_ORB[b]||2,
  points:c.pts.map(p=>({key:p.key,name:NAME[p.key],lon:p.lon}))});
function progressedMoon(c,now){
  const ageYears=(+now-+c.d)/(365.2422*DAY_MS);
  const pd=new Date(+c.d+ageYears*DAY_MS);
  const lon=tropLon('Moon',pd);
  return{lon,house:houseOf(lon,c.cusps)};
}
function lunations(c,start,days){
  const out=[];
  for(const [ph,name] of [[0,'New Moon'],[180,'Full Moon']]){
    let t=Astronomy.SearchMoonPhase(ph,start,days);
    while(t&&+t.date<+start+days*DAY_MS){
      const lon=tropLon('Moon',t.date);
      const hits=c.pts.filter(p=>arcD(p.lon,lon)<=3).map(p=>NAME[p.key]);
      out.push({name,date:t.date,lon,house:houseOf(lon,c.cusps),hits});
      t=Astronomy.SearchMoonPhase(ph,t.AddDays(1),days);
    }
  }
  return out.sort((a,b)=>a.date-b.date);
}
function transitsHTML(c){
  const now=new Date(),cfg=tcfg(c),pos=positions(TRANSIT_BODIES,now);
  const pr=TRANSIT_BODIES.map(b=>[gl(b)+' '+NAME[b]+rxMark(b,now),signPos(pos[b]),{cls:'mono',html:'your '+ORD(houseOf(pos[b],c.cusps))}]);
  const hits=scanTransits(cfg,now).map(h=>{const ap=applying(tropLon,h.body,h.pt.lon,h.asp.ang,now);
    return[gl(h.body)+' '+h.body+rxMark(h.body,now),{cls:'c-'+h.asp.type,style:'font-size:1.05rem',html:h.asp.sym},h.asp.name,{style:'font-weight:bold;color:var(--deep)',html:'natal '+h.pt.name},
      {style:`font-size:.75rem;color:var(${ap?'--soft':'--hard'})`,html:ap?'▶ applying':'◀ separating'},{cls:'dim',html:h.asp.orb+'°'}];});
  const sky=skyAspects(cfg,now).map(h=>[h.p1,{cls:'c-'+h.asp.type,html:h.asp.sym},h.asp.name,h.p2,{cls:'dim',html:h.asp.orb+'°'}]);
  const pm=progressedMoon(c,now);
  const lun=lunations(c,now,32).map(l=>[l.name==='New Moon'?'🌑 New Moon':'🌕 Full Moon',dayLabel(l.date),signPos(l.lon),'your '+ORD(l.house),l.hits.length?'on natal '+l.hits.join(', '):'']);
  const fc=aspectForecast(cfg,now,14).map(d=>({label:d.label,rows:[
    ...d.stations.map(stationRow),
    ...d.personal.map(h=>`<div class="fc-row"><span>🎯</span><span class="who">${h.body}</span><span class="dim">${SIGNS[signIdx(h.tLon)]}</span><span class="c-${h.asp.type}">${h.asp.sym}</span>
        <span class="what">${h.asp.name}</span><span class="tgt">natal ${h.pt.name}</span>${pill(h.asp.orb<0.5)}<span class="dim">${h.asp.orb}°</span></div>`),
    ...d.sky.map(h=>`<div class="fc-row" style="opacity:.85"><span>🌍</span><span class="who">${h.p1}</span><span class="c-${h.asp.type}">${h.asp.sym}</span><span class="what">${h.asp.name}</span>
        <span class="tgt" style="color:var(--sky)">${h.p2}</span>${pill(h.asp.orb<0.5,true)}<span class="dim">${h.asp.orb}°</span></div>`)]}));
  return`<div class="section">
    ${secH('Current Sky',longDate(now))}
    <div class="grid2">
      <div>${tableHTML(['Planet','Position','Transiting'],pr)}</div>
      <div>${secH('🌙 Progressed Moon & Lunations')}
        <p class="note" style="margin-bottom:8px">Secondary progressed Moon: <b>${signPos(pm.lon)}</b>, in your ${ORD(pm.house)} house.</p>
        ${tableHTML(['Lunation','Date','Position','House',''],lun)}</div>
    </div>
    <div class="grid2">
      <div>${secH('🎯 Transits to Your Chart')}${tableHTML(['Transit','','Aspect','To','Dir','Orb'],hits,'No transits within orb right now')}</div>
      <div>${secH('🌍 Current Sky Aspects')}${tableHTML(['P1','','Aspect','P2','Orb'],sky,'No inter-planetary aspects within orb')}</div>
    </div>
    ${secH('14-Day Transit Forecast')}
    <p class="tagline">Newly entering &amp; exact aspects to your natal points · Moon orb 3° · Sun–Saturn 2° · Uranus–Pluto 1.5°</p>
    <div class="box">${forecastHTML(fc,'No new transits entering orb in the next 14 days')}</div>
  </div>`;
}

// ─── Reading (Western astrology language only; computed data only) ─────────
function readingData(c){
  const now=new Date(),cfg=tcfg(c),pos=positions(TRANSIT_BODIES,now);
  const sky=TRANSIT_BODIES.map(b=>`${NAME[b]} in ${signPos(pos[b])}${isRetro(b,now)?' (retrograde)':''}`).join('\n');
  const skyAsp=skyAspects(cfg,now).map(h=>`${h.p1} ${h.asp.name} ${h.p2} (orb ${h.asp.orb}°)`).join('\n')||'None';
  const hits=scanTransits(cfg,now);
  const personal=hits.map(h=>`Transiting ${h.body} (in their ${ORD(houseOf(h.tLon,c.cusps))} house) ${h.asp.name} natal ${h.pt.name} (${signPos(h.pt.lon)}, ${ORD(c.P[h.pt.key].house)} house) — ${applying(tropLon,h.body,h.pt.lon,h.asp.ang,now)?'applying':'separating'}, orb ${h.asp.orb}°`).join('\n')||'No transits to the natal chart within orb';
  const houses=TRANSIT_BODIES.map(b=>`${NAME[b]} transiting their ${ORD(houseOf(pos[b],c.cusps))} house`).join('\n');
  const week=aspectForecast(cfg,now,7).filter(d=>d.personal.length||d.sky.length||d.stations.length).map(d=>d.label+': '+[
    ...d.stations.map(s=>`${s.body} stations ${s.type}`),
    ...d.personal.map(h=>`transiting ${h.body} ${h.asp.name} natal ${h.pt.name}${h.asp.orb<0.5?' [exact]':''}`),
    ...d.sky.map(h=>`${h.p1} ${h.asp.name} ${h.p2}${h.asp.orb<0.5?' [exact]':''}`)].join('; ')).join('\n')||'No new transits in the next 7 days';
  const big3=`Sun in ${SIGNS[signIdx(c.P.Sun.lon)]}, Moon in ${SIGNS[signIdx(c.P.Moon.lon)]}, ${SIGNS[signIdx(c.asc)]} rising`;
  return{name:c.input.name||'',sky,skyAsp,personal,houses,week,big3};
}
const VOICE='You are a thoughtful Western astrologer (tropical zodiac, Placidus houses).';
const SECTIONS=[
  {id:1,icon:'🌅',title:'The Present Signature',desc:'The overall tone of the sky right now',
   prompt:d=>VOICE+' Here is the current sky (internal — do not list it):\n\n'+d.sky+'\n\nAspects between planets:\n'+d.skyAsp+'\n\n'+
     'Write a 200–250 word reading on the collective mood of this moment — what is building, releasing or asking for attention. Plain, warm language; mention at most two planets by name; no degrees.',
   astroPrompt:d=>'Give a 120–150 word technical astrological summary of this sky — signs, retrogrades and the tightest aspects:\n\n'+d.sky+'\n'+d.skyAsp},
  {id:2,icon:'🌿',title:'Your Personal Themes',desc:'What the transits are activating in your chart',
   prompt:d=>VOICE+' Data about one person (internal — do not list it):\n\n'+(d.name?'Person: '+d.name+'\n':'')+'Natal: '+d.big3+'\n\nTransits to their chart:\n'+d.personal+'\n\nPlanets by house:\n'+d.houses+'\n\n'+
     'Write a 200–250 word reading in second person on what is personally alive for them now — speak through the life areas (houses) and natal planets being touched. Warm and grounded; no degrees or orb numbers.',
   astroPrompt:d=>'Give a 120–150 word technical summary of these transits to a natal chart, noting applying/separating and house context:\n\n'+d.personal},
  {id:3,icon:'🔭',title:'The Week Ahead',desc:'Transits over the next 7 days',
   prompt:d=>VOICE+' Here are the transit events for one person over the next 7 days (internal — do not quote dates or list items):\n\n'+d.week+'\n\n'+
     'Write a 200–250 word reading on the arc of the coming week — what builds, peaks and resolves, and how to work with it. Second person, warm, no dates or degrees.',
   astroPrompt:d=>'Give a 120–150 word technical astrological summary of these upcoming events by date:\n\n'+d.week},
  {id:4,icon:'✦',title:'Contemplation',desc:'A closing reflection to sit with',
   prompt:d=>VOICE+' For a person who is '+d.big3+', with these current transits:\n'+d.personal+'\n\n'+
     'Write a single contemplative question or poetic invitation (70–90 words) to sit with. Evocative and open; no planet names, no technical terms.'}
];

// ─── Guide (each item prompt holds only that item's data) ──────────────────
function placementPrompt(p){
  const where=p.key==='ASC'||p.key==='MC'?`${NAME[p.key]} in ${signPos(p.lon)}`:`${NAME[p.key]} in ${signPos(p.lon)}, ${ORD(p.house)} house${p.retro?', retrograde':''}`;
  return VOICE+' Explain one placement in a person’s natal chart.\n\nPlacement: '+where+'\nWhat this point represents: '+PLANET_ROLE[p.key]+'\n'+
    (p.house&&p.key!=='ASC'&&p.key!=='MC'?'House theme: '+HOUSE_ROLE[p.house-1]+'\n':'')+'\n'+
    'Write 150–190 words, second person, warm and specific: how this energy expresses through the sign'+(p.key!=='ASC'&&p.key!=='MC'?', where it plays out through the house':'')+(p.retro?', what retrograde adds':'')+', its gifts and its challenges. No headings.';
}
const item=(p)=>({title:NAME[p.key],code:`${gl(p.key)} ${signPos(p.lon)}`,sub:p.key==='ASC'||p.key==='MC'?'':`${ORD(p.house)} house${p.retro?' · retrograde':''}`,role:PLANET_ROLE[p.key],prompt:placementPrompt(p)});
const bigThree=c=>[c.P.Sun,c.P.Moon,c.P.ASC].map(item);
const planetsTab=c=>['Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto','NorthNode','MC'].map(k=>item(c.P[k]));
function houseItems(c){
  return c.cusps.map((cu,i)=>{
    const occ=c.pts.filter(p=>p.house===i+1&&p.key!=='ASC'&&p.key!=='MC').map(p=>NAME[p.key]);
    const ruler=RULER[signIdx(cu)];
    return{title:`${ORD(i+1)} House`,code:SIGNS[signIdx(cu)]+' cusp',sub:occ.length?'Occupants: '+occ.join(', '):'Empty house',role:HOUSE_ROLE[i],
      prompt:VOICE+' Explain one house in a person’s natal chart.\n\nHouse: '+ORD(i+1)+' — '+HOUSE_ROLE[i]+'\nCusp sign: '+SIGNS[signIdx(cu)]+' (ruled by '+ruler+')\nPlanets in this house: '+(occ.join(', ')||'none')+'\n\n'+
        'Write 140–180 words, second person: how this area of life tends to unfold for them given the sign on the cusp'+(occ.length?' and the planets here':' (an empty house is not an inactive one — speak to the cusp sign and its ruler)')+'. No headings.'};
  });
}
function aspectItems(c){
  return c.aspects.map(a=>({title:`${NAME[a.a]} ${a.asp.name} ${NAME[a.b]}`,code:`${gl(a.a)} ${a.asp.sym} ${gl(a.b)}`,sub:`orb ${a.asp.orb}°`,
    role:`${PLANET_ROLE[a.a]} · ${PLANET_ROLE[a.b]}`,
    prompt:VOICE+' Explain one aspect in a person’s natal chart.\n\nAspect: '+NAME[a.a]+' '+a.asp.name+' '+NAME[a.b]+' (orb '+a.asp.orb+'°)\n'+NAME[a.a]+' represents '+PLANET_ROLE[a.a]+'.\n'+NAME[a.b]+' represents '+PLANET_ROLE[a.b]+'.\n\n'+
      'Write 130–170 words, second person: how these two energies talk to each other through this aspect, what it feels like from the inside, and how to work with it well. No headings.'}));
}
const ov=(label,list)=>VOICE+' Write a 200–260 word overview of the '+label+' in one person’s natal chart, as one connected picture. Second person, warm, no headings or lists.\n\n'+list;

window.SYSTEM={
  id:'natal',pageTitle:'Natal Astrology Chart',title:'Natal Chart',noun:'Chart',
  formTitle:'Natal Astrology Chart',formSub:'Tropical zodiac · Placidus houses · aspects, patterns and transits.',
  needsLocation:true,locationUse:'Ascendant and houses',
  accent:{accent:'#3a4a8a','accent-dk':'#2a3870',deep:'#2a2a4a'},
  compute,
  header:c=>`${c.houseSystem} houses`,
  badges:c=>[{n:SIGN_GLYPH[signIdx(c.P.Sun.lon)],h:'Sun',p:signPos(c.P.Sun.lon)},{n:SIGN_GLYPH[signIdx(c.P.Moon.lon)],h:'Moon',p:signPos(c.P.Moon.lon)},
    {n:SIGN_GLYPH[signIdx(c.asc)],h:'Rising',p:signPos(c.asc)}],
  chartHTML,positionsHTML,transitsHTML,
  reading:{title:'Transit Reading',sections:SECTIONS,data:readingData},
  guide:{title:'Chart Guide',fab:'Chart Guide',tabs:[
    {key:'big3',name:'Big Three',icon:'☀️',col:'#b07010',blurb:'Sun, Moon and Ascendant',items:bigThree,
     overview:c=>ov('Sun, Moon and Ascendant',bigThree(c).map(i=>i.title+': '+i.code.replace(/^\S+\s/,'')+(i.sub?', '+i.sub:'')).join('\n'))},
    {key:'planets',name:'Planets',icon:'🪐',col:'#3a4a8a',blurb:'The personal, social and outer planets, the Node and Midheaven',items:planetsTab,
     overview:c=>ov('planets',planetsTab(c).map(i=>i.title+': '+i.code.replace(/^\S+\s/,'')+(i.sub?', '+i.sub:'')).join('\n'))},
    {key:'houses',name:'Houses',icon:'🏠',col:'#1a6b48',blurb:'The twelve areas of life',items:houseItems},
    {key:'aspects',name:'Aspects',icon:'△',col:'#8b2050',blurb:'How the planets talk to each other',items:aspectItems,
     overview:c=>ov('aspect patterns',(c.patterns.map(p=>p.name+': '+p.members.map(k=>NAME[k]).join(', ')).join('\n')||'No major patterns')+'\nTightest aspects:\n'+
       [...c.aspects].sort((a,b)=>a.asp.orb-b.asp.orb).slice(0,8).map(a=>NAME[a.a]+' '+a.asp.name+' '+NAME[a.b]).join('\n'))}
  ]}
};
})();
