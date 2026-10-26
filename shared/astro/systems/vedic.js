// ═════════════════════════════════════════════════════════════════════════════
// System module: Vedic Astrology (Jyotish) — sidereal, Lahiri ayanamsa,
// whole-sign houses, mean nodes, Vimshottari dasha.
// Self-contained: this file is the only system module in vedic-astrology.html.
// ═════════════════════════════════════════════════════════════════════════════
(function(){
const GRAHAS=['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn','Rahu','Ketu'];
const SRC={Rahu:'MeanNode',Ketu:'MeanSouthNode'};
const sidLon=(g,d)=>norm(tropLon(SRC[g]||g,d)-ayanamsaLahiri(d));
const SKT={Sun:'Surya',Moon:'Chandra',Mars:'Mangala',Mercury:'Budha',Jupiter:'Guru',Venus:'Shukra',Saturn:'Shani',Rahu:'Rahu',Ketu:'Ketu'};
const ABBR={Sun:'Su',Moon:'Mo',Mars:'Ma',Mercury:'Me',Jupiter:'Ju',Venus:'Ve',Saturn:'Sa',Rahu:'Ra',Ketu:'Ke',Lagna:'As'};
const RASHI=['Mesha','Vrishabha','Mithuna','Karka','Simha','Kanya','Tula','Vrishchika','Dhanu','Makara','Kumbha','Meena'];
const RASHI_ABBR=['Mesh','Vrsh','Mith','Kark','Simh','Kany','Tula','Vrsc','Dhan','Makr','Kumb','Meen'];
const RASHI_LORD=['Mars','Venus','Mercury','Moon','Sun','Mercury','Venus','Mars','Jupiter','Saturn','Saturn','Jupiter'];
const rashi=i=>`${RASHI[i]} (${SIGNS[i]})`;
const NAK=[ // name, lord, deity, symbol, power (shakti)
  ['Ashwini','Ketu','the Ashvini Kumaras','horse’s head','quick healing'],['Bharani','Venus','Yama','yoni','carrying away, bearing burdens'],
  ['Krittika','Sun','Agni','razor / flame','burning and purifying'],['Rohini','Moon','Prajapati (Brahma)','ox cart / chariot','growth and fertility'],
  ['Mrigashira','Mars','Soma','deer’s head','fulfilment through seeking'],['Ardra','Rahu','Rudra','teardrop','effort that breaks through'],
  ['Punarvasu','Jupiter','Aditi','quiver of arrows','return and renewal of substance'],['Pushya','Saturn','Brihaspati','cow’s udder / flower','spiritual nourishment'],
  ['Ashlesha','Mercury','the Nagas','coiled serpent','embrace and penetrating insight'],['Magha','Ketu','the Pitris (ancestors)','royal throne','leaving the body, ancestral power'],
  ['Purva Phalguni','Venus','Bhaga','front legs of a bed','creation and enjoyment'],['Uttara Phalguni','Sun','Aryaman','back legs of a bed','prosperity through union'],
  ['Hasta','Moon','Savitar','hand','placing what we seek in our hands'],['Chitra','Mars','Tvashtar (the cosmic craftsman)','bright jewel','accumulating merit, craft'],
  ['Swati','Rahu','Vayu','young shoot blown by the wind','scattering like the wind, independence'],['Vishakha','Jupiter','Indra-Agni','triumphal arch','achieving many fruits'],
  ['Anuradha','Saturn','Mitra','lotus','worship and devotion'],['Jyeshtha','Mercury','Indra','circular amulet','rising and conquering'],
  ['Mula','Ketu','Nirriti','bunch of roots','uprooting, getting to the root'],['Purva Ashadha','Venus','Apas (the waters)','winnowing fan','invigoration'],
  ['Uttara Ashadha','Sun','the Vishvadevas','elephant tusk','unchallengeable victory'],['Shravana','Moon','Vishnu','ear / three footprints','connection through listening'],
  ['Dhanishta','Mars','the eight Vasus','drum','abundance and fame'],['Shatabhisha','Rahu','Varuna','empty circle','healing'],
  ['Purva Bhadrapada','Jupiter','Aja Ekapada','front of a funeral cot','raising the spiritual level'],['Uttara Bhadrapada','Saturn','Ahir Budhnya','back of a funeral cot','bringing the rain, depth'],
  ['Revati','Mercury','Pushan','fish / drum','nourishment and safe passage']];
const NAK_SPAN=360/27,PADA_SPAN=NAK_SPAN/4;
const nakOf=lon=>{const i=Math.floor(norm(lon)/NAK_SPAN)%27;return{i,name:NAK[i][0],pada:Math.floor((norm(lon)%NAK_SPAN)/PADA_SPAN)+1,lord:NAK[i][1],deity:NAK[i][2],symbol:NAK[i][3],power:NAK[i][4]};};
const navamsaSign=lon=>Math.floor(norm(lon)/PADA_SPAN)%12;
const degIn=lon=>dms(lon);
const sidPos=lon=>`${dms(lon)} ${RASHI[signIdx(lon)]}`;

const EXALT={Sun:0,Moon:1,Mars:9,Mercury:5,Jupiter:3,Venus:11,Saturn:6};
const OWN={Sun:[4],Moon:[3],Mars:[0,7],Mercury:[2,5],Jupiter:[8,11],Venus:[1,6],Saturn:[9,10]};
function dignity(g,s){
  if(!(g in EXALT))return'';
  if(EXALT[g]===s)return'Exalted';
  if((EXALT[g]+6)%12===s)return'Debilitated';
  if(OWN[g].includes(s))return'Own sign';
  return'';
}
const GRAHA_ROLE={Sun:'soul, father, authority and vitality',Moon:'mind, mother, emotions and nourishment',Mars:'energy, courage, siblings and land',
  Mercury:'intellect, speech, trade and learning',Jupiter:'wisdom, teachers, children, dharma and grace',Venus:'love, beauty, comforts, arts and partnership',
  Saturn:'discipline, time, karma, endurance and service',Rahu:'worldly desire, obsession, the foreign and the new',Ketu:'detachment, past mastery, insight and liberation',
  Lagna:'the self, body and the lens through which the whole chart is lived'};
const BHAVA=['Tanu — self, body, temperament','Dhana — wealth, speech, family, food','Sahaja — courage, effort, siblings, skills',
  'Sukha — home, mother, heart, inner contentment','Putra — intelligence, children, creativity, mantra','Ripu — obstacles, health, enemies, service',
  'Kalatra — marriage, partnership, the public','Ayu — longevity, transformation, the hidden, inheritance','Dharma — fortune, teachers, father, higher learning',
  'Karma — career, action, status in the world','Labha — gains, networks, fulfilment of desires','Vyaya — loss, expenditure, retreat, liberation'];
const ORD=n=>n+(['th','st','nd','rd'][(n%100>10&&n%100<14)?0:n%10]||'th');

// ─── Vimshottari dasha ──────────────────────────────────────────────────────
const DASHA_ORDER=['Ketu','Venus','Sun','Moon','Mars','Rahu','Jupiter','Saturn','Mercury'];
const DASHA_YEARS={Ketu:7,Venus:20,Sun:6,Moon:10,Mars:7,Rahu:18,Jupiter:16,Saturn:19,Mercury:17};
const YEAR_MS=365.25*DAY_MS;
function vimshottari(moonLon,birth){
  const n=nakOf(moonLon),frac=(norm(moonLon)%NAK_SPAN)/NAK_SPAN;
  const first=DASHA_ORDER.indexOf(n.lord);
  let t=+birth-frac*DASHA_YEARS[n.lord]*YEAR_MS;
  const mds=[];
  for(let k=0;k<10;k++){
    const lord=DASHA_ORDER[(first+k)%9],len=DASHA_YEARS[lord]*YEAR_MS,start=t;
    const ads=[];let a=start;
    for(let j=0;j<9;j++){const al=DASHA_ORDER[(first+k+j)%9],alen=DASHA_YEARS[lord]*DASHA_YEARS[al]/120*YEAR_MS;ads.push({lord:al,start:new Date(a),end:new Date(a+alen)});a+=alen;}
    mds.push({lord,start:new Date(start),end:new Date(start+len),ads});t+=len;
  }
  return{balance:(1-frac)*DASHA_YEARS[n.lord],mds};
}
function dashaAt(v,d){
  const md=v.mds.find(m=>+d>=+m.start&&+d<+m.end);if(!md)return null;
  const ad=md.ads.find(a=>+d>=+a.start&&+d<+a.end);
  return{md,ad,nextAd:md.ads[md.ads.indexOf(ad)+1]||(v.mds[v.mds.indexOf(md)+1]||{ads:[]}).ads[0],nextMd:v.mds[v.mds.indexOf(md)+1]};
}
const ymd=d=>d.toISOString().slice(0,10);

// ─── Chart calculation ──────────────────────────────────────────────────────
function compute(inp){
  const d=inp.utc;
  const ayan=ayanamsaLahiri(d);
  const lagna=norm(ascLon(d,inp.lat,inp.lon)-ayan),ls=signIdx(lagna);
  const G={};
  GRAHAS.forEach(g=>{
    const lon=sidLon(g,d),s=signIdx(lon);
    G[g]={key:g,lon,sign:s,house:(s-ls+12)%12+1,nak:nakOf(lon),nav:navamsaSign(lon),dig:dignity(g,s),
      retro:g==='Rahu'||g==='Ketu'?true:isRetro(g,d,sidLon)};
  });
  const L={key:'Lagna',lon:lagna,sign:ls,house:1,nak:nakOf(lagna),nav:navamsaSign(lagna)};
  const v=vimshottari(G.Moon.lon,d);
  return{d,ayan,lagna,ls,G,L,v,yogas:findYogas(G,ls),moonSign:G.Moon.sign};
}
function findYogas(G,ls){
  const out=[],kendra=h=>[1,4,7,10].includes(h);
  const fromMoon=g=>(G[g].sign-G.Moon.sign+12)%12+1;
  if(kendra(fromMoon('Jupiter')))out.push({name:'Gaja Kesari Yoga',why:'Jupiter in a kendra (1st/4th/7th/10th) from the Moon',desc:'wisdom, reputation and the ability to overcome difficulty'});
  if(G.Sun.sign===G.Mercury.sign)out.push({name:'Budha-Aditya Yoga',why:'Sun and Mercury in the same sign',desc:'intelligence, articulation and skill'});
  if(G.Moon.sign===G.Mars.sign)out.push({name:'Chandra-Mangala Yoga',why:'Moon and Mars in the same sign',desc:'enterprise, drive and earning power'});
  const MP={Mars:['Ruchaka','courage, leadership and physical vigour'],Mercury:['Bhadra','intellect, eloquence and learning'],
    Jupiter:['Hamsa','righteousness, wisdom and grace'],Venus:['Malavya','beauty, refinement and enjoyment'],Saturn:['Sasa','authority, discipline and endurance']};
  Object.entries(MP).forEach(([g,[n,desc]])=>{
    const dg=G[g].dig;
    if(kendra(G[g].house)&&(dg==='Exalted'||dg==='Own sign'))out.push({name:n+' Yoga (Pancha Mahapurusha)',why:`${g} ${dg.toLowerCase()} in the ${ORD(G[g].house)} house`,desc});
  });
  const flank=['Mars','Mercury','Jupiter','Venus','Saturn'].filter(g=>[2,12].includes(fromMoon(g))||G[g].sign===G.Moon.sign);
  if(!flank.length)out.push({name:'Kemadruma Yoga',why:'no planet (other than Sun and nodes) with or on either side of the Moon',desc:'emotional self-reliance learned through periods of solitude'});
  return out;
}

// ─── Chart drawings ─────────────────────────────────────────────────────────
// signOf(key) → sign index for each body; asc = lagna sign
function northSVG(asc,place,title){
  const S=320,m=S/2,q=S/4;
  const C={1:[m,q],2:[q,q/2.4],3:[q/2.4,q],4:[q,m],5:[q/2.4,3*q],6:[q,S-q/2.4],7:[m,3*q],8:[3*q,S-q/2.4],9:[S-q/2.4,3*q],10:[3*q,m],11:[S-q/2.4,q],12:[3*q,q/2.4]};
  let s=`<rect x="1" y="1" width="${S-2}" height="${S-2}" fill="#fffdf8" stroke="#8a7a60" stroke-width="1.5"/>
    <line x1="0" y1="0" x2="${S}" y2="${S}" stroke="#8a7a60"/><line x1="${S}" y1="0" x2="0" y2="${S}" stroke="#8a7a60"/>
    <path d="M${m},0 L${S},${m} L${m},${S} L0,${m} Z" fill="none" stroke="#8a7a60"/>`;
  for(let h=1;h<=12;h++){
    const sign=(asc+h-1)%12,[x,y]=C[h],items=place[sign]||[];
    const big=[1,4,7,10].includes(h);
    s+=`<text x="${x}" y="${y-(big?22:12)}" text-anchor="middle" font-size="10" fill="#b07010" font-family="Georgia,serif">${sign+1}</text>`;
    items.forEach((t,i)=>{const per=big?3:2,row=Math.floor(i/per),col=i%per,n=Math.min(per,items.length-row*per);
      s+=`<text x="${x+(col-(n-1)/2)*24}" y="${y+(big?-4:2)+row*13}" text-anchor="middle" font-size="11" fill="${t.c||'#2a1a0a'}" font-family="Georgia,serif">${t.t}</text>`;});
  }
  return`<figure style="margin:0;text-align:center;width:min(320px,100%)"><svg viewBox="0 0 ${S} ${S}" style="width:100%">${s}</svg><figcaption class="note">${title}</figcaption></figure>`;
}
function southSVG(asc,place,title){
  const S=320,c=S/4,POS=[[1,0],[2,0],[3,0],[3,1],[3,2],[3,3],[2,3],[1,3],[0,3],[0,2],[0,1],[0,0]];
  let s=`<rect x="1" y="1" width="${S-2}" height="${S-2}" fill="#fffdf8" stroke="#8a7a60" stroke-width="1.5"/><rect x="${c}" y="${c}" width="${2*c}" height="${2*c}" fill="#faf7f0" stroke="#8a7a60"/>`;
  POS.forEach(([cx,cy],sign)=>{
    const x=cx*c,y=cy*c,items=place[sign]||[];
    s+=`<rect x="${x}" y="${y}" width="${c}" height="${c}" fill="none" stroke="#8a7a60"/>
      <text x="${x+4}" y="${y+11}" font-size="8.5" fill="#b07010" font-family="Georgia,serif">${RASHI_ABBR[sign]}</text>`;
    if(sign===asc)s+=`<line x1="${x}" y1="${y+16}" x2="${x+16}" y2="${y}" stroke="#b07010" stroke-width="1.5"/>`;
    items.forEach((t,i)=>s+=`<text x="${x+16+(i%2)*28}" y="${y+28+Math.floor(i/2)*13}" font-size="11" fill="${t.c||'#2a1a0a'}" font-family="Georgia,serif">${t.t}</text>`);
  });
  s+=`<text x="${S/2}" y="${S/2+4}" text-anchor="middle" font-size="12" fill="#8a7a60" font-family="Georgia,serif">${title}</text>`;
  return`<figure style="margin:0;text-align:center;width:min(320px,100%)"><svg viewBox="0 0 ${S} ${S}" style="width:100%">${s}</svg><figcaption class="note">${title}</figcaption></figure>`;
}
function placements(c,useNav){
  const place={},add=(s,t)=>(place[s]=place[s]||[]).push(t);
  if(useNav)add(c.L.nav,{t:'As',c:'#b07010'});
  GRAHAS.forEach(g=>{const x=c.G[g];add(useNav?x.nav:x.sign,{t:ABBR[g]+(x.retro&&g!=='Rahu'&&g!=='Ketu'?'ᴿ':''),c:x.dig==='Exalted'?'#1a6b48':x.dig==='Debilitated'?'#8b2050':null});});
  return place;
}
function chartsHTML(c,style){
  const f=style==='south'?southSVG:northSVG;
  return f(c.ls,placements(c,false),'Rashi (D1)')+f(c.L.nav,placements(c,true),'Navamsa (D9)');
}
// Both styles are rendered; the buttons only switch which one shows.
const VSTYLE_JS="const w=this.closest('.vedic-wrap');w.querySelectorAll('.vstyle').forEach(b=>b.classList.toggle('on',b===this));w.querySelectorAll('.vcharts').forEach(d=>d.hidden=d.dataset.s!==this.dataset.s)";
function chartHTML(c){
  const rows=[c.L,...GRAHAS.map(g=>c.G[g])].map(x=>[x.key==='Lagna'?'<b>Lagna</b>':`${x.key} <span class="dim">${SKT[x.key]}</span>${x.retro&&x.key!=='Rahu'&&x.key!=='Ketu'?' <span class="rx">℞</span>':''}`,
    sidPos(x.lon),{cls:'mono',html:ORD(x.house)},`${x.nak.name} ${x.nak.pada}`,{cls:'dim',html:x.nak.lord},RASHI[x.nav],x.dig?`<span class="${x.dig==='Debilitated'?'c-hard':'c-soft'}">${x.dig}</span>`:'']);
  return`<div class="vedic-wrap"><style>.vstyle{width:auto;padding:4px 12px;font-size:.78rem;background:#fff;color:var(--deep);border:1px solid var(--rule);border-radius:4px;cursor:pointer;font-family:var(--serif)}.vstyle.on{background:var(--deep);color:#fff}.vcharts:not([hidden]){display:flex!important}</style>
  <div style="text-align:center;margin-bottom:10px"><button class="vstyle on" data-s="north" onclick="${VSTYLE_JS}">North Indian</button>
    <button class="vstyle" data-s="south" onclick="${VSTYLE_JS}">South Indian</button></div>
  <div class="vcharts" data-s="north" style="display:flex;flex-wrap:wrap;gap:20px;justify-content:center;margin-bottom:18px">${chartsHTML(c,'north')}</div>
  <div class="vcharts" data-s="south" hidden style="flex-wrap:wrap;gap:20px;justify-content:center;margin-bottom:18px">${chartsHTML(c,'south')}</div></div>
  <div style="overflow-x:auto">${tableHTML(['Graha','Sidereal position','House','Nakshatra · pada','Nak. lord','Navamsa','Dignity'],rows)}</div>
  <p class="note">Ayanamsa (Lahiri) at birth: ${dms(c.ayan)} · whole-sign houses from Lagna · mean nodes · ᴿ retrograde · green exalted · red debilitated</p>
  ${c.yogas.length?'<p class="note"><b>Yogas:</b> '+c.yogas.map(y=>y.name).join(' · ')+'</p>':''}`;
}
function positionsHTML(c){
  const rows=c.v.mds.slice(0,9).map(m=>[`<b>${m.lord}</b>`,ymd(m.start),ymd(m.end),{cls:'dim',html:m.ads.map(a=>`${ABBR[a.lord]} ${ymd(a.start).slice(0,7)}`).join(' · ')}]);
  return toggleNext('Show Vimshottari dasha timeline')+`<div class="eph-table">${tableHTML(['Mahadasha','Start','End','Antardashas (start month)'],rows)}
    <p class="note">Balance at birth: ${c.v.balance.toFixed(2)} years of ${c.v.mds[0].lord} (Moon in ${c.G.Moon.nak.name}). Years of 365.25 days.</p></div>`;
}

// ─── Panchang, gochara and the forecast ─────────────────────────────────────
const TITHI=['Pratipada','Dwitiya','Tritiya','Chaturthi','Panchami','Shashthi','Saptami','Ashtami','Navami','Dashami','Ekadashi','Dwadashi','Trayodashi','Chaturdashi'];
const YOGA27=['Vishkambha','Priti','Ayushman','Saubhagya','Shobhana','Atiganda','Sukarma','Dhriti','Shula','Ganda','Vriddhi','Dhruva','Vyaghata','Harshana','Vajra','Siddhi','Vyatipata','Variyana','Parigha','Shiva','Siddha','Sadhya','Shubha','Shukla','Brahma','Indra','Vaidhriti'];
const KARANA7=['Bava','Balava','Kaulava','Taitila','Gara','Vanija','Vishti'];
const VARA=['Ravivara (Sun)','Somavara (Moon)','Mangalavara (Mars)','Budhavara (Mercury)','Guruvara (Jupiter)','Shukravara (Venus)','Shanivara (Saturn)'];
const TARA=['Janma','Sampat','Vipat','Kshema','Pratyari','Sadhaka','Vadha','Mitra','Parama Mitra'];
const TARA_Q=['mixed — the birth star','wealth, good','danger, caution','well-being, good','obstacles, caution','accomplishment, good','destruction, avoid new starts','friendship, good','great friendship, very good'];
function panchang(d){
  const su=sidLon('Sun',d),mo=sidLon('Moon',d),el=norm(mo-su);
  const ti=Math.floor(el/12);           // 0..29
  const paksha=ti<15?'Shukla':'Krishna';
  const tname=ti===14?'Purnima':ti===29?'Amavasya':TITHI[ti%15];
  const k=Math.floor(el/6);
  const karana=k===0?'Kimstughna':k>=57?['Shakuni','Chatushpada','Naga'][k-57]:KARANA7[(k-1)%7];
  return{tithi:`${paksha} ${tname}`,tithiNum:ti+1,nak:nakOf(mo),yoga:YOGA27[Math.floor(norm(su+mo)/NAK_SPAN)%27],karana,vara:VARA[new Date(d).getDay()],moonSign:signIdx(mo)};
}
function sadeSati(c,d){
  const s=signIdx(sidLon('Saturn',d)),rel=(s-c.moonSign+12)%12;
  if(rel===11)return'Sade Sati — rising phase (Saturn in the 12th from the Moon)';
  if(rel===0)return'Sade Sati — peak phase (Saturn over the natal Moon sign)';
  if(rel===1)return'Sade Sati — setting phase (Saturn in the 2nd from the Moon)';
  if(rel===3)return'Kantaka Shani — Saturn in the 4th from the Moon';
  if(rel===7)return'Ashtama Shani — Saturn in the 8th from the Moon';
  return'Not in Sade Sati';
}
const tara=(c,moonLon)=>{const n=(nakOf(moonLon).i-c.G.Moon.nak.i+27)%27;return{name:TARA[n%9],q:TARA_Q[n%9]};};
function gochara(c,d){
  return GRAHAS.map(g=>{const lon=sidLon(g,d),s=signIdx(lon);
    return{g,lon,s,nak:nakOf(lon),fromLagna:(s-c.ls+12)%12+1,fromMoon:(s-c.moonSign+12)%12+1,retro:g==='Rahu'||g==='Ketu'?false:isRetro(g,d,sidLon)};});
}
function vedicForecast(c,start,days){
  const out=[],slow=GRAHAS.filter(g=>g!=='Moon');
  let prev=gochara(c,start),prevP=panchang(start);
  const st=findStations(['Mars','Mercury','Jupiter','Venus','Saturn'],start,days,sidLon);
  for(let i=1;i<=days;i++){
    const base=new Date(+start+i*DAY_MS);base.setUTCHours(0,30,0,0);   // ≈ sunrise in India
    const g=gochara(c,base),p=panchang(base),rows=[];
    st.filter(x=>x.day===i).forEach(x=>rows.push(stationRow(x)));
    slow.forEach((k,j)=>{const a=prev[GRAHAS.indexOf(k)],b=g[GRAHAS.indexOf(k)];
      if(a.s!==b.s)rows.push(`<div class="fc-row"><span>➜</span><span class="who">${k}</span><span class="what">enters <b>${rashi(b.s)}</b></span><span class="dim">your ${ORD(b.fromLagna)} from Lagna · ${ORD(b.fromMoon)} from Moon</span>${pill(false)}</div>`);});
    const t=tara(c,g[1].lon);
    const moonRel=g[1].fromMoon;
    rows.push(`<div class="fc-row"><span>☽</span><span class="who">Moon</span><span class="what">${p.nak.name} · ${RASHI[g[1].s]}</span><span class="dim">Tara: <b>${t.name}</b> (${t.q})${moonRel===8?' · <b class="c-hard">Chandrashtama</b> (8th from your Moon)':''}</span></div>`);
    if(/Ekadashi|Purnima|Amavasya/.test(p.tithi)&&p.tithi!==prevP.tithi)rows.push(`<div class="fc-row"><span>✺</span><span class="what"><b>${p.tithi}</b></span><span class="dim">observance day</span></div>`);
    out.push({label:dayLabel(base),rows});prev=g;prevP=p;
  }
  return out;
}
function transitsHTML(c){
  const now=new Date(),p=panchang(now),g=gochara(c,now),da=dashaAt(c.v,now),t=tara(c,g[1].lon);
  const rows=g.map(x=>[`${x.g}${x.retro?' <span class="rx">℞</span>':''}`,sidPos(x.lon),`${x.nak.name} ${x.nak.pada}`,{cls:'mono',html:ORD(x.fromLagna)},{cls:'mono',html:ORD(x.fromMoon)}]);
  return`<div class="section">
    ${secH('Panchang & Dasha Now',longDate(now))}
    <div class="grid2">
      <div class="box" style="margin:0"><dl class="kv">
        <dt>Vara</dt><dd>${p.vara}</dd><dt>Tithi</dt><dd>${p.tithi}</dd><dt>Nakshatra</dt><dd>${p.nak.name} (pada ${p.nak.pada})</dd>
        <dt>Yoga</dt><dd>${p.yoga}</dd><dt>Karana</dt><dd>${p.karana}</dd><dt>Tara bala</dt><dd>${t.name} — ${t.q}</dd></dl>
        <p class="note">Instantaneous values for this moment (not sunrise-based).</p></div>
      <div class="box" style="margin:0"><dl class="kv">
        <dt>Mahadasha</dt><dd><b>${da?da.md.lord:'—'}</b> ${da?`until ${ymd(da.md.end)}`:''}</dd>
        <dt>Antardasha</dt><dd><b>${da&&da.ad?da.ad.lord:'—'}</b> ${da&&da.ad?`until ${ymd(da.ad.end)}`:''}</dd>
        <dt>Next</dt><dd>${da&&da.nextAd?`${da.nextAd.lord} antardasha from ${ymd(da.nextAd.start)}`:'—'}</dd>
        <dt>Saturn</dt><dd>${sadeSati(c,now)}</dd></dl></div>
    </div>
    ${secH('🪐 Gochara (Transits)')}
    <div style="overflow-x:auto;margin-bottom:22px">${tableHTML(['Graha','Sidereal position','Nakshatra','From Lagna','From Moon'],rows)}</div>
    ${secH('14-Day Forecast')}
    <p class="tagline">Sign ingresses, stations, the Moon’s daily nakshatra with your Tara bala, Chandrashtama and observance days. Sampled daily at 00:30 UTC (about sunrise in India).</p>
    <div class="box">${forecastHTML(vedicForecast(c,now,14))}</div>
  </div>`;
}

// ─── Reading (Jyotish language only; computed data only) ────────────────────
function readingData(c){
  const now=new Date(),p=panchang(now),g=gochara(c,now),da=dashaAt(c.v,now),t=tara(c,g[1].lon);
  const sky=g.map(x=>`${x.g} in ${rashi(x.s)}, ${x.nak.name} nakshatra${x.retro?' (retrograde)':''}`).join('\n');
  const pan=`Vara ${p.vara}; Tithi ${p.tithi}; Nakshatra ${p.nak.name} (deity ${p.nak.deity}); Yoga ${p.yoga}; Karana ${p.karana}`;
  const personal=[
    da?`Mahadasha: ${da.md.lord} (until ${ymd(da.md.end)}); Antardasha: ${da.ad.lord} (until ${ymd(da.ad.end)})`:'',
    `Natal: ${rashi(c.ls)} Lagna; Moon in ${rashi(c.moonSign)}, ${c.G.Moon.nak.name} nakshatra`,
    sadeSati(c,now),`Today's Tara bala from the birth star: ${t.name} (${t.q})`,
    ...g.filter(x=>x.g!=='Moon').map(x=>`${x.g} transiting the ${ORD(x.fromLagna)} house from Lagna and ${ORD(x.fromMoon)} from the Moon`)].filter(Boolean).join('\n');
  const week=vedicForecast(c,now,7).map(d=>d.label+': '+d.rows.map(r=>r.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()).join('; ')).join('\n');
  return{name:c.input.name||'',sky,pan,personal,week,dasha:da?`${da.md.lord}–${da.ad.lord}`:'—'};
}
const VOICE='You are a traditional Jyotish (Vedic astrology) guide working in the sidereal zodiac with the Lahiri ayanamsa. Use only Jyotish concepts.';
const SECTIONS=[
  {id:1,icon:'🌅',title:'The Present Signature',desc:'Today’s Panchang and the grahas in the sky',
   prompt:d=>VOICE+' Here is today’s sky (internal — do not list it):\n\nPanchang: '+d.pan+'\n\nGrahas:\n'+d.sky+'\n\n'+
     'Write a 200–250 word reading on the quality of this day and season — what the Panchang favours, and the mood the grahas set. Warm, plain language; use Sanskrit terms sparingly and explain them.',
   astroPrompt:d=>'Give a 120–150 word technical Jyotish note on this Panchang and the graha positions (signs, nakshatras, retrogrades):\n\n'+d.pan+'\n'+d.sky},
  {id:2,icon:'🪔',title:'Your Grahas Now',desc:'Dasha, gochara and Sade Sati for you',
   prompt:d=>VOICE+' Data about one person (internal — do not list it):\n\n'+(d.name?'Person: '+d.name+'\n':'')+d.personal+'\n\n'+
     'Write a 200–250 word reading in second person on the current chapter of their life: the dasha period as the main story, with transits from Lagna and Moon colouring it, and Saturn’s position. Grounded and encouraging; no fatalism.',
   astroPrompt:d=>'Give a 120–150 word technical Jyotish summary of this dasha and gochara picture:\n\n'+d.personal},
  {id:3,icon:'🔭',title:'The Week Ahead',desc:'The Moon’s path and ingresses over 7 days',
   prompt:d=>VOICE+' Here are the next 7 days for one person (internal — do not quote dates or list items):\n\n'+d.week+'\n\nCurrent dasha: '+d.dasha+'\n\n'+
     'Write a 200–250 word reading on the arc of the coming week — which days support beginnings, which call for care, and the overall rhythm. Second person; no dates.',
   astroPrompt:d=>'Give a 120–150 word technical Jyotish summary of these upcoming days (tara bala, ingresses, stations, tithis):\n\n'+d.week},
  {id:4,icon:'✦',title:'Sadhana',desc:'A simple practice for this period',
   prompt:d=>VOICE+' For a person in '+d.dasha+' dasha, with this picture:\n'+d.personal+'\n\n'+
     'Suggest one simple, gentle sadhana (70–90 words) suited to this period — such as a mantra, a day of observance, an act of seva or a reflection. Practical, respectful, no fear-based remedies or purchases.'}
];

// ─── Guide (each item prompt holds only that item's data) ──────────────────
function grahaItems(c){
  return[c.L,...GRAHAS.map(g=>c.G[g])].map(x=>{
    const isL=x.key==='Lagna',lord=RASHI_LORD[x.sign];
    return{title:isL?'Lagna (Ascendant)':`${x.key} · ${SKT[x.key]}`,code:sidPos(x.lon),
      sub:isL?`Lagna lord: ${lord}`:`${ORD(x.house)} house${x.dig?' · '+x.dig:''}${x.retro&&x.key!=='Rahu'&&x.key!=='Ketu'?' · retrograde':''}`,role:GRAHA_ROLE[x.key],
      prompt:VOICE+' Explain one placement in a person’s Rashi chart.\n\n'+(isL?`Lagna in ${rashi(x.sign)}, ruled by ${lord}.`:
        `${x.key} (${SKT[x.key]}) — karaka of ${GRAHA_ROLE[x.key]} — in ${rashi(x.sign)}, the ${ORD(x.house)} house (${BHAVA[x.house-1]}). Sign lord: ${lord}.${x.dig?' Dignity: '+x.dig+'.':''}${x.retro&&x.key!=='Rahu'&&x.key!=='Ketu'?' Retrograde.':''}`)+'\n\n'+
        'Write 150–190 words, second person: what this placement shows about '+(isL?'their nature, body and approach to life':'this area of their life')+', its strengths and its lessons. Warm, no headings.'};
  });
}
function nakItems(c){
  return[c.L,...GRAHAS.map(g=>c.G[g])].map(x=>{
    const n=x.nak,who=x.key==='Lagna'?'Lagna':x.key;
    return{title:`${who} in ${n.name}`,code:`pada ${n.pada}`,sub:`Lord ${n.lord} · deity ${n.deity} · symbol ${n.symbol}`,role:`power: ${n.power}`,
      prompt:VOICE+' Explain one nakshatra placement in a person’s chart.\n\n'+who+' in '+n.name+' nakshatra, pada '+n.pada+'. Nakshatra lord: '+n.lord+'. Deity: '+n.deity+'. Symbol: '+n.symbol+'. Shakti (power): '+n.power+'.'+
        (who==='Moon'?' This is the janma nakshatra (birth star).':'')+'\n\n'+
        'Write 140–180 words, second person: the nature of this nakshatra through its deity, symbol and shakti, and how it colours '+(who==='Lagna'?'their whole presence':who+'’s significations')+'. No headings.'};
  });
}
function dashaItems(c){
  const now=new Date(),da=dashaAt(c.v,now);if(!da)return[];
  const md=da.md,future=c.v.mds.filter(m=>+m.start>+now).slice(0,3);
  const one=(label,lord,start,end,extra)=>({title:label,code:lord,sub:`${ymd(start)} → ${ymd(end)}`,role:GRAHA_ROLE[lord],
    prompt:VOICE+' Explain one dasha period for a person.\n\n'+label+': '+lord+' ('+SKT[lord]+'), '+ymd(start)+' to '+ymd(end)+'.\nIn their birth chart '+lord+' is in '+rashi(c.G[lord].sign)+', the '+ORD(c.G[lord].house)+' house'+(c.G[lord].dig?', '+c.G[lord].dig:'')+'.'+(extra||'')+'\n\n'+
      'Write 150–190 words, second person: the themes this period brings given that natal placement, what it asks of them and how to use it well. No headings.'});
  return[one('Current Mahadasha',md.lord,md.start,md.end),
    one('Current Antardasha',da.ad.lord,da.ad.start,da.ad.end,` This runs within the ${md.lord} mahadasha.`),
    ...(da.nextAd?[one('Next Antardasha',da.nextAd.lord,da.nextAd.start,da.nextAd.end)]:[]),
    ...future.map(m=>one('Upcoming Mahadasha',m.lord,m.start,m.end))];
}
function yogaItems(c){
  return c.yogas.map(y=>({title:y.name,code:'',sub:y.why,role:y.desc,
    prompt:VOICE+' Explain one yoga in a person’s chart.\n\n'+y.name+': formed by '+y.why+'. Traditionally associated with '+y.desc+'.\n\n'+
      'Write 120–160 words, second person: how this yoga tends to show itself, and how to bring out its best. Balanced, no exaggerated promises. No headings.'}));
}
const ov=(label,list)=>VOICE+' Write a 200–260 word overview of the '+label+' in one person’s chart, as one connected picture. Second person, warm, no headings or lists.\n\n'+list;

window.SYSTEM={
  id:'vedic',pageTitle:'Vedic Astrology Chart',title:'Vedic Chart',noun:'Chart',
  formTitle:'Vedic Astrology (Jyotish)',formSub:'Sidereal zodiac · Lahiri ayanamsa · whole-sign houses · Vimshottari dasha.',
  needsLocation:true,locationUse:'Lagna',
  accent:{accent:'#b4561a','accent-dk':'#8f4210',deep:'#5a2a10'},
  compute,
  header:c=>`Lahiri ayanamsa ${dms(c.ayan)}`,
  badges:c=>{const da=dashaAt(c.v,new Date());return[
    {n:RASHI[c.ls].slice(0,3),h:'Lagna',p:sidPos(c.lagna)},{n:'☽︎',h:'Moon · Rashi',p:`${RASHI[c.moonSign]} · ${c.G.Moon.nak.name} ${c.G.Moon.nak.pada}`},
    {n:da?ABBR[da.md.lord]+'–'+ABBR[da.ad.lord]:'—',h:'Dasha now',p:da?`${da.md.lord} / ${da.ad.lord}`:'—'}];},
  chartHTML,positionsHTML,transitsHTML,
  reading:{title:'Jyotish Reading',sections:SECTIONS,data:readingData},
  guide:{title:'Jyotish Guide',fab:'Jyotish Guide',tabs:[
    {key:'grahas',name:'Lagna & Grahas',icon:'🌅',col:'#b4561a',blurb:'Lagna and the nine grahas by sign and house',items:grahaItems,
     overview:c=>ov('Rashi chart',grahaItems(c).map(i=>i.title+': '+i.code+(i.sub?', '+i.sub:'')).join('\n'))},
    {key:'nak',name:'Nakshatras',icon:'✨',col:'#3a4a8a',blurb:'The lunar mansions of the Lagna and each graha',items:nakItems,
     overview:c=>ov('nakshatras',nakItems(c).map(i=>i.title+' '+i.code+' ('+i.role+')').join('\n'))},
    {key:'dasha',name:'Dashas',icon:'⏳',col:'#1a6b48',blurb:'Vimshottari periods — the timeline of your chart',items:dashaItems,
     overview:c=>ov('Vimshottari dasha timeline',dashaItems(c).map(i=>i.title+': '+i.code+' '+i.sub).join('\n'))},
    {key:'yogas',name:'Yogas',icon:'🔱',col:'#8b2050',blurb:'Notable planetary combinations found in your chart',items:yogaItems}
  ]}
};
})();
