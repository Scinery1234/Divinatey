// ═════════════════════════════════════════════════════════════════════════════
// System module: Human Design — Bodygraph
// Self-contained: this file is the only system module in human-design.html.
// ═════════════════════════════════════════════════════════════════════════════
(function(){
// 13 activations per side. Nodes are the true (osculating) lunar node.
const HD_BODIES=['Sun','Earth','NorthNode','SouthNode','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'];
const BODY_NAME={Sun:'Sun',Earth:'Earth',NorthNode:'North Node',SouthNode:'South Node',Moon:'Moon',Mercury:'Mercury',Venus:'Venus',Mars:'Mars',Jupiter:'Jupiter',Saturn:'Saturn',Uranus:'Uranus',Neptune:'Neptune',Pluto:'Pluto'};
const BODY_GLYPH={Sun:'☉',Earth:'⊕',NorthNode:'☊',SouthNode:'☋',Moon:'☽',Mercury:'☿',Venus:'♀',Mars:'♂',Jupiter:'♃',Saturn:'♄',Uranus:'♅',Neptune:'♆',Pluto:'♇'};
const g_=b=>BODY_GLYPH[b]+'︎';
const FC_BODIES=HD_BODIES.filter(b=>b!=='Moon');   // forecast ignores the fast Moon

const GATE_NAME={1:'Self-Expression',2:'Direction of the Self',3:'Ordering',4:'Formulization',5:'Fixed Rhythms',6:'Friction',
  7:'The Role of the Self',8:'Contribution',9:'Focus',10:'Behavior of the Self',11:'Ideas',12:'Caution',13:'The Listener',
  14:'Power Skills',15:'Extremes',16:'Skills',17:'Opinions',18:'Correction',19:'Wanting',20:'The Now',21:'The Hunter/Huntress',
  22:'Openness',23:'Assimilation',24:'Rationalization',25:'The Spirit of the Self',26:'The Egoist',27:'Caring',28:'The Game Player',
  29:'Perseverance',30:'Recognition of Feelings',31:'Influence',32:'Continuity',33:'Privacy',34:'Power',35:'Change',36:'Crisis',
  37:'Friendship',38:'The Fighter',39:'The Provocateur',40:'Aloneness',41:'Contraction',42:'Growth',43:'Insight',44:'Alertness',
  45:'The Gatherer',46:'Determination of the Self',47:'Realizing',48:'Depth',49:'Principles',50:'Values',51:'Shock',52:'Stillness',
  53:'Beginnings',54:'Ambition',55:'Spirit',56:'Stimulation',57:'Intuitive Clarity',58:'Vitality',59:'Sexuality',60:'Acceptance',
  61:'Mystery',62:'Details',63:'Doubt',64:'Confusion'};
const LINE_NAME={1:'Investigator',2:'Hermit',3:'Martyr',4:'Opportunist',5:'Heretic',6:'Role Model'};

const CENTERS={
  Head:{name:'Head',gates:[64,61,63],fill:'#f2cf55',role:'inspiration and mental pressure — the questions that press to be answered'},
  Ajna:{name:'Ajna',gates:[47,24,4,17,43,11],fill:'#79b85a',role:'conceptualising and processing — how the mind holds ideas and certainty'},
  Throat:{name:'Throat',gates:[62,23,56,35,12,45,33,8,31,20,16],fill:'#c49a6c',role:'communication and manifestation — where energy becomes word and action'},
  G:{name:'G (Identity)',gates:[7,1,13,10,25,15,2,46],fill:'#f2cf55',role:'identity, love and direction — the sense of self and where life is heading'},
  Heart:{name:'Heart (Ego)',gates:[21,40,26,51],fill:'#d9604c',role:'willpower and self-worth — promises, value and the material world'},
  Sacral:{name:'Sacral',gates:[34,5,14,29,59,9,3,42,27],fill:'#d9604c',role:'life-force and work energy — sustainable power that answers through response'},
  SolarPlexus:{name:'Solar Plexus',gates:[6,37,22,36,30,55,49],fill:'#c49a6c',role:'emotions, feelings and the emotional wave — clarity that comes over time'},
  Spleen:{name:'Spleen',gates:[48,57,44,50,32,28,18],fill:'#c49a6c',role:'intuition, health and survival — in-the-moment knowing and well-being'},
  Root:{name:'Root',gates:[53,60,52,19,39,41,58,38,54],fill:'#c49a6c',role:'adrenal pressure and drive — the fuel and stress that start things moving'}
};
const CENTER_OF={};Object.entries(CENTERS).forEach(([k,c])=>c.gates.forEach(g=>CENTER_OF[g]=k));
const MOTORS=['Sacral','SolarPlexus','Heart','Root'];

const CHANNELS=[
  [1,8,'Inspiration'],[2,14,'The Beat'],[3,60,'Mutation'],[4,63,'Logic'],[5,15,'Rhythm'],[6,59,'Mating'],[7,31,'The Alpha'],
  [9,52,'Concentration'],[10,20,'Awakening'],[10,34,'Exploration'],[10,57,'Perfected Form'],[11,56,'Curiosity'],[12,22,'Openness'],
  [13,33,'The Prodigal'],[16,48,'The Wavelength'],[17,62,'Acceptance'],[18,58,'Judgment'],[19,49,'Synthesis'],[20,34,'Charisma'],
  [20,57,'The Brainwave'],[21,45,'Money'],[23,43,'Structuring'],[24,61,'Awareness'],[25,51,'Initiation'],[26,44,'Surrender'],
  [27,50,'Preservation'],[28,38,'Struggle'],[29,46,'Discovery'],[30,41,'Recognition'],[32,54,'Transformation'],[34,57,'Power'],
  [35,36,'Transitoriness'],[37,40,'Community'],[39,55,'Emoting'],[42,53,'Maturation'],[47,64,'Abstraction']
].map(([a,b,name])=>({a,b,name,key:`${a}-${b}`,ca:CENTER_OF[a],cb:CENTER_OF[b]}));

const TYPE_INFO={
  'Generator':{strategy:'To Respond',sig:'Satisfaction',ns:'Frustration',role:'sustainable life-force energy that knows itself through response'},
  'Manifesting Generator':{strategy:'To Respond, then Inform',sig:'Satisfaction',ns:'Frustration and Anger',role:'fast, multi-passionate life-force that responds, then moves'},
  'Manifestor':{strategy:'To Inform',sig:'Peace',ns:'Anger',role:'the initiator — able to begin things independently'},
  'Projector':{strategy:'Wait for the Invitation',sig:'Success',ns:'Bitterness',role:'the guide — seeing deeply into others and systems'},
  'Reflector':{strategy:'Wait a Lunar Cycle',sig:'Surprise',ns:'Disappointment',role:'the mirror — sampling and reflecting the health of the community'}
};
const AUTH_ROLE={
  'Emotional (Solar Plexus)':'clarity comes over time by riding the emotional wave, not in the moment',
  'Sacral':'the gut’s in-the-moment response — the sounds and pulls of yes and no',
  'Splenic':'quiet, instantaneous intuitive knowing that speaks once',
  'Ego Manifested':'what the heart truly wants and is willing to commit to, spoken aloud',
  'Ego Projected':'hearing what you really want as you talk it through with others',
  'Self-Projected':'hearing your own truth and direction in your voice as you speak',
  'Mental (Environmental)':'clarity through the right environments and sounding-board conversations',
  'Lunar':'clarity over a full 28-day lunar cycle'
};
const DEF_ROLE={'No Definition':'completely open — taking in and reflecting the whole environment',
  'Single Definition':'one continuous flow — self-contained processing',
  'Split Definition':'two areas of definition — others often bridge the gap',
  'Triple Split':'three areas of definition — processing through many varied encounters',
  'Quadruple Split':'four areas of definition — rare, deeply independent processing'};
const PROFILE_ANGLE=pr=>pr==='4/1'?'Juxtaposition':['5/1','5/2','6/2','6/3'].includes(pr)?'Left Angle':'Right Angle';

// ─── Chart calculation ──────────────────────────────────────────────────────
function activations(side,d){
  return HD_BODIES.map(b=>{const lon=tropLon(b,d),{gate,line}=gateLine(lon);return{side,body:b,lon,gate,line};});
}
function analyse(gatesBySide){
  const all=new Set([...gatesBySide.P,...gatesBySide.D]);
  const defined=CHANNELS.filter(ch=>all.has(ch.a)&&all.has(ch.b)).map(ch=>{
    const who=g=>(gatesBySide.P.has(g)?'P':'')+(gatesBySide.D.has(g)?'D':'');
    const wa=who(ch.a),wb=who(ch.b),both=s=>s.length===2;
    const pAll=wa.includes('P')&&wb.includes('P'),dAll=wa.includes('D')&&wb.includes('D');
    return{...ch,wa,wb,kind:pAll&&dAll?'Personality & Design':pAll?'Personality':dAll?'Design':'Personality + Design'};
  });
  const dc=new Set();defined.forEach(ch=>{dc.add(ch.ca);dc.add(ch.cb);});
  const adj={};Object.keys(CENTERS).forEach(k=>adj[k]=new Set());
  defined.forEach(ch=>{adj[ch.ca].add(ch.cb);adj[ch.cb].add(ch.ca);});
  const reach=start=>{const seen=new Set([start]),q=[start];while(q.length){const c=q.shift();adj[c].forEach(n=>{if(!seen.has(n)){seen.add(n);q.push(n);}});}return seen;};
  const throatReach=dc.has('Throat')?reach('Throat'):new Set();
  const motorToThroat=MOTORS.some(m=>throatReach.has(m));
  let comps=0;const seen=new Set();
  [...dc].forEach(c=>{if(!seen.has(c)){comps++;reach(c).forEach(x=>seen.add(x));}});
  let type;
  if(!dc.size)type='Reflector';
  else if(dc.has('Sacral'))type=motorToThroat?'Manifesting Generator':'Generator';
  else type=motorToThroat?'Manifestor':'Projector';
  const has=k=>defined.some(c=>c.key===k);
  let authority;
  if(dc.has('SolarPlexus'))authority='Emotional (Solar Plexus)';
  else if(dc.has('Sacral'))authority='Sacral';
  else if(dc.has('Spleen'))authority='Splenic';
  else if(dc.has('Heart'))authority=has('21-45')?'Ego Manifested':'Ego Projected';
  else if(dc.has('G')&&['1-8','7-31','10-20','13-33'].some(has))authority='Self-Projected';
  else if(type==='Reflector')authority='Lunar';
  else authority='Mental (Environmental)';
  const definition=['No Definition','Single Definition','Split Definition','Triple Split','Quadruple Split'][comps]||'Quadruple Split';
  return{all,defined,dc,type,authority,definition};
}
function compute(inp){
  const nd=inp.utc,dd=designDate(nd);
  const P=activations('P',nd),D=activations('D',dd);
  const gatesBySide={P:new Set(P.map(a=>a.gate)),D:new Set(D.map(a=>a.gate))};
  const an=analyse(gatesBySide);
  const pSun=P[0],pEarth=P[1],dSun=D[0],dEarth=D[1];
  const profile=`${pSun.line}/${dSun.line}`;
  return{nd,dd,P,D,gatesBySide,...an,info:TYPE_INFO[an.type],profile,
    profileDesc:`${LINE_NAME[pSun.line]} / ${LINE_NAME[dSun.line]}`,
    cross:{angle:PROFILE_ANGLE(profile),gates:`${pSun.gate}/${pEarth.gate} | ${dSun.gate}/${dEarth.gate}`}};
}

// ─── Bodygraph SVG ──────────────────────────────────────────────────────────
const GP={64:[178,78],61:[200,78],63:[222,78],
  47:[178,122],24:[200,122],4:[222,122],17:[184,144],43:[200,166],11:[216,144],
  62:[181,215],23:[200,215],56:[219,215],16:[175,230],20:[175,257],35:[225,226],12:[225,241],45:[225,257],31:[182,270],8:[200,270],33:[218,270],
  7:[189,321],1:[200,312],13:[211,321],10:[168,345],25:[232,345],15:[189,369],2:[200,378],46:[211,369],
  21:[294,388],51:[264,401],26:[274,410],40:[296,414],
  5:[182,445],14:[200,445],29:[218,445],34:[175,459],27:[175,485],59:[225,485],42:[182,496],3:[200,496],9:[218,496],
  48:[58,400],57:[78,411],44:[98,423],50:[98,437],32:[78,449],28:[60,459],18:[47,468],
  36:[342,400],22:[322,411],37:[302,423],6:[302,437],49:[322,449],55:[340,459],30:[353,468],
  53:[182,540],60:[200,540],52:[218,540],54:[175,553],38:[175,567],58:[175,582],19:[225,553],39:[225,567],41:[225,582]};
const SHAPES={
  Head:'M200,22 L238,86 L162,86 Z',Ajna:'M162,114 L238,114 L200,180 Z',
  Throat:'M168,206 H232 V279 H168 Z',G:'M200,302 L242,345 L200,388 L158,345 Z',
  Heart:'M254,402 L306,378 L306,422 Z',Sacral:'M168,436 H232 V505 H168 Z',
  Spleen:'M38,383 L124,430 L38,477 Z',SolarPlexus:'M362,383 L276,430 L362,477 Z',Root:'M168,531 H232 V592 H168 Z'};
const COL_P='#1a1a1a',COL_D='#c0392b',COL_OFF='#e4dfd4';

function bodygraphSVG(c,opts={}){
  const P=c.gatesBySide.P,D=c.gatesBySide.D,Tr=opts.transit||new Set();
  const half=(g,x1,y1,x2,y2)=>{
    const p=P.has(g),d=D.has(g),t=Tr.has(g);
    if(p&&d)return`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${COL_D}" stroke-width="6"/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${COL_P}" stroke-width="6" stroke-dasharray="4,4"/>`;
    if(p||d)return`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${p?COL_P:COL_D}" stroke-width="6"/>`;
    if(t)return`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#3a7bd5" stroke-width="6" opacity=".8"/>`;
    return`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${COL_OFF}" stroke-width="6"/>`;
  };
  const chans=CHANNELS.map(ch=>{
    const[ax,ay]=GP[ch.a],[bx,by]=GP[ch.b],mx=(ax+bx)/2,my=(ay+by)/2;
    return half(ch.a,ax,ay,mx,my)+half(ch.b,mx,my,bx,by);
  }).join('');
  const dcAll=opts.centers||c.dc;
  const shapes=Object.entries(SHAPES).map(([k,d])=>{
    const on=dcAll.has(k),tOnly=on&&!c.dc.has(k);
    return`<path d="${d}" fill="${on?(tOnly?'#cfe0f7':CENTERS[k].fill):'#fff'}" stroke="#8a7a60" stroke-width="1.6" stroke-linejoin="round"/>`;
  }).join('');
  const gates=Object.entries(GP).map(([g,[x,y]])=>{
    g=+g;const p=P.has(g),d=D.has(g),t=Tr.has(g);
    const fill=p?COL_P:d?COL_D:t?'#3a7bd5':'#fff';
    const stroke=p&&d?COL_D:'#9a8a70';
    return`<circle cx="${x}" cy="${y}" r="7" fill="${fill}" stroke="${stroke}" stroke-width="${p&&d?2.2:.8}"/>
      <text x="${x}" y="${y+2.6}" text-anchor="middle" font-size="7.2" fill="${p||d||t?'#fff':'#6a5a40'}" font-family="Georgia,serif">${g}</text>`;
  }).join('');
  const col=(list,x,anchor,color,title)=>`<text x="${x}" y="40" text-anchor="${anchor}" font-size="11" font-weight="bold" fill="${color}" font-family="Georgia,serif">${title}</text>`+
    list.map((a,i)=>`<text x="${x}" y="${66+i*28}" text-anchor="${anchor}" font-size="12" fill="${color}" font-family="Georgia,serif">${anchor==='end'?`${a.gate}.${a.line}  ${g_(a.body)}`:`${g_(a.body)}  ${a.gate}.${a.line}`}</text>`).join('');
  const side=opts.noColumns?'':col(c.D,78,'end',COL_D,'Design')+col(c.P,522,'start',COL_P,'Personality');
  const legend=opts.transit?`<g font-family="Georgia,serif" font-size="10"><circle cx="110" cy="610" r="5" fill="${COL_P}"/><text x="120" y="614">You</text>
      <circle cx="160" cy="610" r="5" fill="${COL_D}"/><text x="170" y="614">You (Design)</text><circle cx="250" cy="610" r="5" fill="#3a7bd5"/><text x="260" y="614">Transit</text>
      <rect x="315" y="604" width="12" height="12" fill="#cfe0f7" stroke="#8a7a60"/><text x="332" y="614">defined by transit</text></g>`:'';
  return`<svg viewBox="0 0 600 ${opts.transit?625:605}" xmlns="http://www.w3.org/2000/svg" style="max-width:${opts.max||600}px;background:#fafaf8">
    <g transform="translate(100,0)">${chans}${shapes}${gates}</g>${side}${legend}</svg>`;
}

// ─── Transits ────────────────────────────────────────────────────────────────
function transitState(c,d,bodies=HD_BODIES){
  const acts=bodies.map(b=>{const lon=tropLon(b,d);return{body:b,lon,...gateLine(lon)};});
  const tg=new Set(acts.map(a=>a.gate));
  const mine=c.all;
  const completions=[],collective=[];
  CHANNELS.forEach(ch=>{
    if(c.defined.some(x=>x.key===ch.key))return;
    const ma=mine.has(ch.a),mb=mine.has(ch.b),ta=tg.has(ch.a),tb=tg.has(ch.b);
    if((ma&&tb)||(mb&&ta)){
      const yours=ma&&tb?ch.a:ch.b,tr=yours===ch.a?ch.b:ch.a;
      completions.push({ch,yours,tr,body:acts.filter(a=>a.gate===tr).map(a=>a.body)});
    }else if(ta&&tb)collective.push({ch,bodies:acts.filter(a=>a.gate===ch.a||a.gate===ch.b).map(a=>a.body)});
  });
  const union=analyse({P:new Set([...c.gatesBySide.P,...tg]),D:c.gatesBySide.D});
  const newCenters=[...union.dc].filter(k=>!c.dc.has(k));
  return{acts,tg,completions,collective,newCenters,unionCenters:union.dc};
}
function hdForecast(c,start,days){
  const out=[];let prev=transitState(c,start,FC_BODIES);
  const st=findStations(FC_BODIES,start,days);
  let prevSun=gateLine(tropLon('Sun',start)).gate;
  for(let i=1;i<=days;i++){
    const base=new Date(+start+i*DAY_MS);base.setUTCHours(12,0,0,0);
    const s=transitState(c,base,FC_BODIES),rows=[];
    st.filter(x=>x.day===i).forEach(x=>rows.push(stationRow(x)));
    const sun=gateLine(tropLon('Sun',base)).gate;
    if(sun!==prevSun)rows.push(`<div class="fc-row"><span>☉</span><span class="what">Sun enters <b>Gate ${sun}</b> — ${GATE_NAME[sun]}</span><span class="dim">Earth in Gate ${gateLine(tropLon('Earth',base)).gate}</span></div>`);
    prevSun=sun;
    const pk=new Set(prev.completions.map(x=>x.ch.key));
    s.completions.filter(x=>!pk.has(x.ch.key)).forEach(x=>rows.push(`<div class="fc-row"><span>🎯</span><span class="who">${x.body.map(b=>BODY_NAME[b]).join(', ')}</span>
      <span class="what">completes <b>${x.ch.name}</b> (${x.ch.key})</span><span class="dim">your Gate ${x.yours} + transit Gate ${x.tr}</span>${pill(false)}</div>`));
    const ck=new Set(prev.collective.map(x=>x.ch.key));
    s.collective.filter(x=>!ck.has(x.ch.key)).forEach(x=>rows.push(`<div class="fc-row" style="opacity:.85"><span>🌍</span><span class="what">Sky defines <b>${x.ch.name}</b> (${x.ch.key})</span>${pill(false,true)}</div>`));
    out.push({label:dayLabel(base),rows});prev=s;
  }
  return out;
}
function transitsHTML(c){
  const now=new Date(),s=transitState(c,now);
  const rows=s.acts.map(a=>[g_(a.body)+' '+BODY_NAME[a.body]+rxMark(a.body,now),{cls:'mono',html:`${a.gate}.${a.line}`},GATE_NAME[a.gate],
    {cls:'dim',html:c.all.has(a.gate)?'● in your chart':''}]);
  const comp=s.completions.map(x=>[`<b>${x.ch.name}</b>`,{cls:'mono',html:x.ch.key},`your ${x.yours} + ${x.body.map(b=>BODY_NAME[b]).join(', ')} in ${x.tr}`]);
  const coll=s.collective.map(x=>[`<b>${x.ch.name}</b>`,{cls:'mono',html:x.ch.key},x.bodies.map(b=>BODY_NAME[b]).join(', ')]);
  return`<div class="section">
    ${secH('Transit Gates Now',longDate(now))}
    <div class="grid2">
      <div>${tableHTML(['Body','Gate.Line','Gate','In you'],rows)}</div>
      <div>${bodygraphSVG(c,{transit:s.tg,centers:s.unionCenters,noColumns:true,max:420})}
        <p class="note">${s.newCenters.length?'Centres temporarily defined by today’s transits: <b>'+s.newCenters.map(k=>CENTERS[k].name).join(', ')+'</b>':'No open centres are defined by today’s transits.'}</p></div>
    </div>
    <div class="grid2">
      <div>${secH('🎯 Channels completed for you')}${tableHTML(['Channel','Gates','How'],comp,'No channels completed by transit right now')}</div>
      <div>${secH('🌍 Channels defined in the sky')}${tableHTML(['Channel','Gates','By'],coll,'No channels fully defined by the transit field')}</div>
    </div>
    ${secH('14-Day Transit Forecast')}
    <p class="tagline">Sun gate changes, new channel completions with your chart, sky channels and stations. Sampled daily at 12:00 UTC; the Moon is left out because it changes gate about every 10 hours.</p>
    <div class="box">${forecastHTML(hdForecast(c,now,14),'No new channel activations in the next 14 days')}</div>
  </div>`;
}

function positionsHTML(c){
  const rows=HD_BODIES.map((b,i)=>[g_(b)+' '+BODY_NAME[b],{cls:'mono',html:`${c.P[i].gate}.${c.P[i].line}`},{cls:'mono',html:c.P[i].lon.toFixed(4)},
    {cls:'mono',html:`${c.D[i].gate}.${c.D[i].line}`},{cls:'mono',html:c.D[i].lon.toFixed(4)}]);
  return toggleNext('Show activations and longitudes')+`<div class="eph-table">${tableHTML(['Body','Personality','lon°','Design','lon°'],rows)}
    <p class="note">Design moment: ${fmtUTC(c.dd)} (Sun 88° before birth). Nodes: true node.</p></div>`;
}

// ─── Reading (Human Design language only; computed data only) ────────────────
function readingData(c){
  const now=new Date(),s=transitState(c,now);
  const sun=gateLine(tropLon('Sun',now)),earth=gateLine(tropLon('Earth',now));
  const field=s.acts.map(a=>`${BODY_NAME[a.body]}: Gate ${a.gate} (${GATE_NAME[a.gate]}) line ${a.line}`).join('\n');
  const collective=s.collective.length?s.collective.map(x=>`Channel ${x.ch.key} ${x.ch.name}`).join('\n'):'None';
  const personal=[
    ...s.completions.map(x=>`Transit completes Channel ${x.ch.key} ${x.ch.name} (their Gate ${x.yours} ${GATE_NAME[x.yours]} + transit Gate ${x.tr} ${GATE_NAME[x.tr]})`),
    ...s.newCenters.map(k=>`Their open ${CENTERS[k].name} centre is temporarily defined`)
  ].join('\n')||'No channels completed and no open centres defined by transit';
  const week=hdForecast(c,now,7).filter(d=>d.rows.length).map(d=>d.label+': '+d.rows.map(r=>r.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()).join('; ')).join('\n')||'No new channel activations in the next 7 days';
  return{name:c.input.name||'',type:c.type,strategy:c.info.strategy,authority:c.authority,profile:c.profile,
    sunGate:`Gate ${sun.gate} (${GATE_NAME[sun.gate]}) line ${sun.line}`,earthGate:`Gate ${earth.gate} (${GATE_NAME[earth.gate]}) line ${earth.line}`,
    field,collective,personal,week,openCenters:Object.keys(CENTERS).filter(k=>!c.dc.has(k)).map(k=>CENTERS[k].name).join(', ')||'none'};
}
const GUIDE='You are a Human Design guide. Use only Human Design concepts (type, strategy, authority, centres, channels, gates, lines).';
const SECTIONS=[
  {id:1,icon:'🌅',title:'The Present Signature',desc:'The transit field everyone is living in now',
   prompt:d=>GUIDE+' Here is the current transit field (internal — do not list it):\n\nSun: '+d.sunGate+'\nEarth: '+d.earthGate+'\n\nAll transit gates:\n'+d.field+'\n\nChannels defined in the sky:\n'+d.collective+'\n\n'+
     'Write a 200–250 word reading on the collective weather right now: the theme the Sun and Earth gates set, and what the sky channels condition in everyone. '+
     'Plain language, warm, no lists, no gate numbers.',
   astroPrompt:d=>'Give a 120–150 word technical Human Design summary of this transit field — Sun/Earth gates and lines, notable gates and any sky channels:\n\nSun '+d.sunGate+'\nEarth '+d.earthGate+'\n'+d.field+'\nSky channels: '+d.collective},
  {id:2,icon:'🧬',title:'Your Design Today',desc:'How today’s transits meet your bodygraph',
   prompt:d=>GUIDE+' Data about one person (internal — do not list it):\n\n'+(d.name?'Person: '+d.name+'\n':'')+'Type: '+d.type+' · Strategy: '+d.strategy+' · Authority: '+d.authority+' · Profile '+d.profile+'\nOpen centres: '+d.openCenters+'\n\nToday’s transit conditioning:\n'+d.personal+'\n\n'+
     'Write a 200–250 word reading, in second person, on how today’s transits are likely to feel for them, what is temporarily consistent, and how their strategy and authority help them meet it without being pulled off course. No gate numbers.',
   astroPrompt:d=>'Give a 120–150 word technical Human Design note on these transit activations for a '+d.type+' with '+d.authority+' authority:\n\n'+d.personal},
  {id:3,icon:'🔭',title:'The Week Ahead',desc:'Channel activations over the next 7 days',
   prompt:d=>GUIDE+' Here are the transit activations of the next 7 days for one person (internal — do not quote dates or list items):\n\n'+d.week+'\n\nTheir type: '+d.type+', strategy: '+d.strategy+', authority: '+d.authority+'.\n\n'+
     'Write a 200–250 word reading on the arc of the coming week — what builds, what conditioning comes and goes, and how to stay with their own strategy through it. No gate numbers, no dates.',
   astroPrompt:d=>'Give a 120–150 word technical Human Design summary of these upcoming transit events by date:\n\n'+d.week},
  {id:4,icon:'✦',title:'Experiment',desc:'One small experiment to live today',
   prompt:d=>GUIDE+' For a '+d.type+' (strategy: '+d.strategy+'; authority: '+d.authority+') whose transit conditioning today is:\n'+d.personal+'\n\n'+
     'Offer one simple, concrete experiment (70–90 words) they could try today to live their strategy and authority more fully. Practical and kind; no jargon beyond type, strategy and authority.'}
];

// ─── Guide (each item prompt holds only that item's data) ──────────────────
function typeItems(c){
  const i=c.info;
  const p=(what,txt)=>GUIDE+' Explain one element of a person’s chart.\n\n'+what+'\n\nWrite 150–190 words, warm and direct, second person, no headings. '+txt;
  return[
    {title:'Type',code:c.type,role:i.role,prompt:p('Type: '+c.type+' — '+i.role+'. Signature: '+i.sig+'. Not-self theme: '+i.ns+'.','Describe how this type’s energy works, what the signature and not-self theme feel like, and what living correctly looks like day to day.')},
    {title:'Strategy',code:i.strategy,role:'how this type meets life with the least resistance',prompt:p('Strategy: '+i.strategy+' (for a '+c.type+').','Explain this strategy in practical terms with everyday examples, and what tends to happen when it is skipped.')},
    {title:'Inner Authority',code:c.authority,role:AUTH_ROLE[c.authority],prompt:p('Inner Authority: '+c.authority+' — '+AUTH_ROLE[c.authority]+'.','Explain how decisions are made reliably with this authority, how it feels in the body, and common traps.')},
    {title:'Profile',code:c.profile,role:c.profileDesc,prompt:p('Profile: '+c.profile+' ('+c.profileDesc+'). The first number is the conscious Personality Sun line, the second the unconscious Design Sun line.','Describe the costume this profile wears in life, how the two lines interact, and the life themes it brings.')},
    {title:'Definition',code:c.definition,role:DEF_ROLE[c.definition],prompt:p('Definition: '+c.definition+' — '+DEF_ROLE[c.definition]+'.','Explain how this definition shapes the way they process, and what it means for relationships and solitude.')},
    {title:'Incarnation Cross',code:c.cross.angle+' '+c.cross.gates,role:'the life theme carried by the Sun and Earth gates at birth and design',
     prompt:p('Incarnation Cross: '+c.cross.angle+' Cross with gates '+c.cross.gates+' (Personality Sun/Earth | Design Sun/Earth). Gate themes: '+
       [c.P[0],c.P[1],c.D[0],c.D[1]].map(a=>a.gate+' '+GATE_NAME[a.gate]).join(', ')+'.','Describe the life theme these four gates weave together and what the '+c.cross.angle+' geometry says about how it is lived (personal, fixed, or transpersonal). Do not invent a cross name.')}
  ];
}
function centerItems(c){
  return Object.entries(CENTERS).map(([k,ce])=>{
    const on=c.dc.has(k),act=ce.gates.filter(g=>c.all.has(g));
    return{title:ce.name,code:on?'Defined':'Open',role:ce.role,sub:act.length?'Active gates: '+act.join(', '):'No active gates',
      prompt:GUIDE+' Explain one centre in a person’s bodygraph.\n\nCentre: '+ce.name+' — '+ce.role+'\nState: '+(on?'Defined (consistent)':'Undefined / open')+'\nActive gates in this centre: '+(act.map(g=>g+' '+GATE_NAME[g]).join(', ')||'none')+'\n\n'+
        'Write 150–190 words, second person: how this centre works for them, the '+(on?'consistent energy they carry and how it affects others':'conditioning they take in, the not-self questions to watch for, and the wisdom it can become')+'. Warm, no headings.'};
  });
}
function channelItems(c){
  return c.defined.map(ch=>({title:'Channel of '+ch.name,code:ch.key,role:`${CENTERS[ch.ca].name} ↔ ${CENTERS[ch.cb].name} · ${ch.kind}`,
    sub:`${ch.a} ${GATE_NAME[ch.a]} · ${ch.b} ${GATE_NAME[ch.b]}`,
    prompt:GUIDE+' Explain one defined channel in a person’s bodygraph.\n\nChannel '+ch.key+' — '+ch.name+'\nConnects: '+CENTERS[ch.ca].name+' and '+CENTERS[ch.cb].name+'\nGates: '+ch.a+' ('+GATE_NAME[ch.a]+') and '+ch.b+' ('+GATE_NAME[ch.b]+')\nActivated by: '+ch.kind+'\n\n'+
      'Write 150–190 words, second person: the consistent life-force this channel gives, how it shows up, and how to use it well. Mention what conscious (Personality) vs unconscious (Design) activation means for how they experience it. No headings.'}));
}
function gateItems(c){
  return[...c.P,...c.D].map(a=>{
    const side=a.side==='P'?'Personality (conscious)':'Design (unconscious)';
    return{title:`${side.split(' ')[0]} ${BODY_NAME[a.body]}`,code:`${a.gate}.${a.line}`,sub:`${GATE_NAME[a.gate]} · Line ${a.line} ${LINE_NAME[a.line]}`,role:`${CENTERS[CENTER_OF[a.gate]].name} centre`,
      prompt:GUIDE+' Explain one activation in a person’s chart.\n\nActivation: '+side+' '+BODY_NAME[a.body]+' in Gate '+a.gate+' ('+GATE_NAME[a.gate]+'), Line '+a.line+' ('+LINE_NAME[a.line]+')\nCentre: '+CENTERS[CENTER_OF[a.gate]].name+'\n\n'+
        'Write 130–170 words, second person: the theme of this gate, how the line colours it, and what the '+BODY_NAME[a.body]+' placement and '+(a.side==='P'?'conscious':'unconscious')+' side add. No headings.'};
  });
}
const ov=(label,list)=>GUIDE+' Write a 200–260 word overview of the '+label+' in one person’s bodygraph, as one connected picture. Second person, warm, no headings or lists.\n\n'+list;

window.SYSTEM={
  id:'human-design',pageTitle:'Human Design Bodygraph',title:'Human Design Bodygraph',noun:'Bodygraph',
  formTitle:'Human Design Bodygraph',formSub:'Type, strategy, authority, centres and channels from your birth and design moments.',
  needsLocation:false,
  accent:{accent:'#9a2a2a','accent-dk':'#7a1c1c',deep:'#3a2020'},
  compute,
  header:c=>`Design ${fmtUTC(c.dd)}`,
  badges:c=>[{n:c.type.split(' ').map(w=>w[0]).join(''),h:'Type',p:`${c.type} · ${c.info.strategy}`},
    {n:'◉',h:'Authority',p:c.authority},{n:c.profile,h:'Profile',p:c.profileDesc},
    {n:c.dc.size,h:'Definition',p:`${c.definition} · ${c.dc.size} of 9 centres defined`}],
  chartHTML:c=>`<div class="svg-wrap">${bodygraphSVG(c)}</div>
    <p class="note" style="text-align:center">Black = Personality (conscious, birth) · Red = Design (unconscious, 88° earlier) · striped = both · Incarnation Cross: ${c.cross.angle} ${c.cross.gates}</p>`,
  positionsHTML,transitsHTML,
  reading:{title:'Transit Reading',sections:SECTIONS,data:readingData},
  guide:{title:'Bodygraph Guide',fab:'Bodygraph Guide',tabs:[
    {key:'type',name:'Type',icon:'⚡',col:'#9a2a2a',blurb:'Type, strategy, authority, profile, definition and cross',items:typeItems,
     overviewTitle:'Your Design — Overview',overview:c=>ov('core mechanics',typeItems(c).map(i=>i.title+': '+i.code+' — '+(i.role||'')).join('\n'))},
    {key:'centres',name:'Centres',icon:'🔺',col:'#b07010',blurb:'The nine centres — defined and open',items:centerItems,
     overview:c=>ov('nine centres (defined and open)',Object.entries(CENTERS).map(([k,ce])=>ce.name+': '+(c.dc.has(k)?'defined':'open')).join('\n'))},
    {key:'channels',name:'Channels',icon:'🔗',col:'#1a6b48',blurb:'Your defined channels — consistent life-force',items:channelItems,
     overview:c=>ov('defined channels',c.defined.map(ch=>ch.key+' '+ch.name+' ('+CENTERS[ch.ca].name+'–'+CENTERS[ch.cb].name+')').join('\n')||'No defined channels (Reflector).')},
    {key:'gates',name:'Gates',icon:'◎',col:'#3a4a7a',blurb:'All 26 activations — each explained on its own',items:gateItems}
  ]}
};
})();
