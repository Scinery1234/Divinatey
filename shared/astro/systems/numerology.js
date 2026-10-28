// ═════════════════════════════════════════════════════════════════════════════
// System module: Numerology — Pythagorean, from the full birth name and birth date
// Self-contained: this file is the only system module in numerology.html.
// No astronomy: only the birth date, the full name at birth and today's date.
// ═════════════════════════════════════════════════════════════════════════════
(function(){
const MASTER=new Set([11,22,33]);
const DEBT={13:'hard work and patience instead of shortcuts',14:'moderation, and keeping commitments while staying free',
  16:'humility, and rebuilding on truer ground after a fall',19:'standing on your own while learning to accept help'};
const KEY={
  0:'free choice: no single lesson, so any of them can arise',
  1:'independence, leadership and starting things',2:'partnership, sensitivity and cooperation',3:'expression, creativity and joy',
  4:'structure, steady work and solid foundations',5:'freedom, change and adventure',6:'care, responsibility, home and family',
  7:'reflection, study and inner truth',8:'ambition, power and mastery of the material world',9:'compassion, completion and the bigger picture',
  11:'intuition and inspiration (a heightened 2)',22:'turning big visions into lasting, practical things (a heightened 4)',
  33:'devoted, selfless care and teaching (a heightened 6)'};
const ROLE={
  lifePath:'the main road of your life: the lessons and strengths you grow into',
  expression:'your natural talents and how you are built to use them',
  soul:'what your heart wants most: your inner motivation',
  personality:'how others see you at first, before they know you',
  birthday:'a special gift you carry, from the day of the month you were born',
  maturity:'what comes into focus in the second half of life',
  currentName:'the tone your everyday name adds to how you show up',
  lesson:'a quality your name doesn’t carry, so life asks you to learn it',
  passion:'the talent your name repeats most: something you are drawn to and good at',
  debt:'a harder lesson carried in the numbers, asking for effort and honesty',
  balance:'how evenly the numbers 1 to 9 are spread through your name',
  pinnacle:'the main opportunity of one long stretch of life',
  challenge:'the main obstacle to work through in one long stretch of life',
  pYear:'the theme of this calendar year for you, in a 9-year cycle',
  pMonth:'the flavour of this month within your year',
  pDay:'the tone of today for you',
  uYear:'the shared theme of this year for everyone'};
const ORD=['First','Second','Third','Fourth'];
const VALUE=ch=>(ch.charCodeAt(0)-65)%9+1;
const VOWELS=new Set(['A','E','I','O','U']);
const digits=n=>String(n).split('').reduce((a,b)=>a+ +b,0);

// Reduces to a single digit (keeping 11, 22 and 33 unless `single`), with every step.
function reduce(n,single){
  const steps=[n];
  while(n>9&&(single||!MASTER.has(n))){n=digits(n);steps.push(n);}
  return{n,steps,debt:steps.find(s=>DEBT[s])||null};
}
const one=n=>reduce(n,true).n;
const chain=r=>r.steps.join(' → ');
const part=r=>r.steps.length>1?'('+chain(r)+')':chain(r);

// Letters only, A–Z, accents removed. Returns the words of the name.
function nameWords(s){
  return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase()
    .replace(/ß/g,'SS').replace(/Æ/g,'AE').replace(/Œ/g,'OE').replace(/Ø/g,'O')
    .split(/[^A-Z]+/).filter(Boolean);
}
// Y counts as a vowel when no other vowel sits next to it (as in Lynn, but not in Yolanda or Murray).
const isVowel=(w,i)=>VOWELS.has(w[i])||(w[i]==='Y'&&!VOWELS.has(w[i-1])&&!VOWELS.has(w[i+1]));

// One number from a name: each word is reduced, then the words are added and reduced.
function nameNumber(words,pick){
  const parts=words.map(w=>{let t=0;for(let i=0;i<w.length;i++)if(pick(w,i))t+=VALUE(w[i]);return{word:w,total:t,red:reduce(t).n};});
  const sum=parts.reduce((a,p)=>a+p.red,0);
  return{parts,...reduce(sum)};
}
const nameNumbers=words=>({
  expression:nameNumber(words,()=>true),
  soul:nameNumber(words,isVowel),
  personality:nameNumber(words,(w,i)=>!isVowel(w,i)),
});

const ymd=s=>{const[y,m,d]=String(s).split('-').map(Number);return{y,m,d};};
// The date "today" where the person was born (their timezone), as y/m/d.
function today(tz,now){
  try{
    const p=new Intl.DateTimeFormat('en-CA',{timeZone:tz||'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
    return ymd(p);
  }catch(e){return ymd(now.toISOString().slice(0,10));}
}
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const WDAY=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const dateLabel=t=>{const d=new Date(Date.UTC(t.y,t.m-1,t.d));return`${WDAY[d.getUTCDay()]} ${t.d} ${MONTHS[t.m-1].slice(0,3)}`;};
const addDays=(t,n)=>{const d=new Date(Date.UTC(t.y,t.m-1,t.d+n));return{y:d.getUTCFullYear(),m:d.getUTCMonth()+1,d:d.getUTCDate()};};

// Personal cycles run 1–9 and change on 1 January.
function cycles(b,t){
  const year=one(one(b.m)+one(b.d)+one(t.y)),month=one(year+t.m),day=one(month+t.d);
  return{year,month,day,universalYear:one(t.y),universalDay:one(one(t.y)+t.m+t.d)};
}

// ─── Calculation ────────────────────────────────────────────────────────────
function compute(inp){
  const date=inp.date||inp.utc.toISOString().slice(0,10);
  const b=ymd(date);
  const words=nameWords(inp.birthName||inp.name);
  const now=new Date(),t=today(inp.tz,now);

  const lpParts=[reduce(b.m),reduce(b.d),reduce(b.y)];
  const lifePath=reduce(lpParts.reduce((a,r)=>a+r.n,0));
  lifePath.debt=lifePath.debt||lpParts.map(r=>r.debt).find(Boolean)||null;
  const birthday=reduce(b.d);
  const N=nameNumbers(words);
  const maturity={...reduce(lifePath.n+N.expression.n),debt:null};   // karmic debt is read from the birth date and name only

  // Current name (if the person gave one that differs from the birth name).
  const cw=nameWords(inp.name);
  const current=inp.birthName&&cw.length&&cw.join(' ')!==words.join(' ')?{words:cw,...nameNumber(cw,()=>true)}:null;

  // How many times each number 1–9 appears in the birth name.
  const counts=Array(10).fill(0);
  words.forEach(w=>[...w].forEach(ch=>counts[VALUE(ch)]++));
  const lessons=[1,2,3,4,5,6,7,8,9].filter(n=>!counts[n]);
  const top=Math.max(...counts.slice(1));
  const tied=[1,2,3,4,5,6,7,8,9].filter(n=>counts[n]===top);
  const passion=top>=2&&tied.length<=2?tied:[];   // only when one or two numbers clearly lead

  const debts=[];
  const addDebt=(where,r)=>{if(r&&r.debt)debts.push({where,n:r.debt});};
  addDebt('birth date',lifePath);addDebt('full name',N.expression);addDebt('vowels of the name',N.soul);
  addDebt('consonants of the name',N.personality);if(DEBT[b.d])debts.push({where:'birth day',n:b.d});

  // Pinnacles and challenges, from the single-digit month, day and year.
  const m1=one(b.m),d1=one(b.d),y1=one(b.y);
  const p1=reduce(m1+d1).n,p2=reduce(d1+y1).n,p3=reduce(one(p1)+one(p2)).n,p4=reduce(m1+y1).n;
  const c1=Math.abs(m1-d1),c2=Math.abs(d1-y1),c3=Math.abs(c1-c2),c4=Math.abs(m1-y1);
  const end1=36-one(lifePath.n);
  const ages=[[0,end1],[end1+1,end1+9],[end1+10,end1+18],[end1+19,null]];
  const age=t.y-b.y-((t.m<b.m||(t.m===b.m&&t.d<b.d))?1:0);
  const stage=ages.findIndex(([a,z])=>age>=a&&(z==null||age<=z));
  const periods=[p1,p2,p3,p4].map((p,i)=>({i,pinnacle:p,challenge:[c1,c2,c3,c4][i],from:ages[i][0],to:ages[i][1],
    years:`${b.y+ages[i][0]}–${ages[i][1]==null?'':b.y+ages[i][1]}`,now:i===Math.max(0,stage)}));

  return{date,b,words,birthName:words.join(' '),lpParts,lifePath,birthday,maturity,...N,current,counts,lessons,passion,debts,
    periods,age,today:t,cyc:cycles(b,t)};
}

// ─── Display ────────────────────────────────────────────────────────────────
const big=n=>`<b style="font-size:1.15rem;color:var(--deep)">${n}</b>`;
const kw=n=>KEY[n]||'';
const debtNote=r=>r&&r.debt?` <span class="dim">· karmic debt ${r.debt}</span>`:'';
function coreRows(c){
  return[
    ['Life Path',big(c.lifePath.n)+debtNote(c.lifePath),`${c.lpParts.map(part).join(' + ')} = ${chain(c.lifePath)}`,kw(c.lifePath.n)],
    ['Expression',big(c.expression.n)+debtNote(c.expression),`${c.expression.parts.map(p=>p.red).join(' + ')} = ${chain(c.expression)}`,kw(c.expression.n)],
    ['Soul Urge',big(c.soul.n)+debtNote(c.soul),`${c.soul.parts.map(p=>p.red).join(' + ')} = ${chain(c.soul)}`,kw(c.soul.n)],
    ['Personality',big(c.personality.n)+debtNote(c.personality),`${c.personality.parts.map(p=>p.red).join(' + ')} = ${chain(c.personality)}`,kw(c.personality.n)],
    ['Birthday',big(c.birthday.n)+debtNote(c.birthday),chain(c.birthday),kw(c.birthday.n)],
    ['Maturity',big(c.maturity.n),`${c.lifePath.n} + ${c.expression.n} = ${chain(c.maturity)}`,kw(c.maturity.n)],
    ...(c.current?[['Current name',big(c.current.n),`${c.current.parts.map(p=>p.red).join(' + ')} = ${chain(c.current)}`,kw(c.current.n)]]:[]),
  ];
}
function lettersHTML(c){
  return c.words.map(w=>`<div style="display:inline-block;margin:0 14px 10px 0;text-align:center">
    <div style="display:flex;gap:2px">${[...w].map((ch,i)=>`<span style="display:inline-block;width:1.5em;font-family:Georgia,serif">
      <span style="display:block;font-size:1rem;${isVowel(w,i)?'color:var(--accent);font-weight:bold':''}">${ch}</span>
      <span class="dim" style="display:block;font-size:.75rem">${VALUE(ch)}</span></span>`).join('')}</div></div>`).join('');
}
function gridHTML(c){
  const cell=n=>`<td style="text-align:center;padding:10px 14px;border:1px solid #ddd2bf;${c.counts[n]?'':'background:#f7efe2'}">
    <div style="font-size:1.1rem;font-family:Georgia,serif">${n}</div><div class="dim" style="font-size:.75rem">${c.counts[n]?'×'+c.counts[n]:'missing'}</div></td>`;
  return`<table style="border-collapse:collapse;margin:6px 0">${[[1,2,3],[4,5,6],[7,8,9]].map(r=>`<tr>${r.map(cell).join('')}</tr>`).join('')}</table>`;
}
function chartHTML(c){
  return`<div class="grid2" style="align-items:start">
    <div>${secH('Core Numbers')}${tableHTML(['Number','','How it’s found','Keywords'],coreRows(c).map(r=>[r[0],{html:r[1]},{cls:'mono',html:r[2]},{cls:'dim',html:r[3]}]))}
      <p class="note">Y counts as a vowel when no other vowel sits next to it. Master numbers (11, 22, 33) are kept, not reduced.</p></div>
    <div>${secH('Full Name at Birth')}<div class="box">${lettersHTML(c)}</div>
      <p class="note">Vowels are highlighted: they give the Soul Urge; the consonants give the Personality.</p>
      ${secH('Number Balance')}${gridHTML(c)}
      <p class="note">${c.lessons.length?'<b>Karmic lessons</b> (missing numbers): '+c.lessons.join(', '):'No missing numbers: every number from 1 to 9 is in the name.'}<br>
        <b>Hidden passion</b>: ${c.passion.join(', ')||'no single number stands out'}${c.debts.length?'<br><b>Karmic debt</b>: '+c.debts.map(d=>`${d.n} (${d.where})`).join('; '):''}</p>
    </div>
  </div>`;
}
function positionsHTML(c){
  const rows=c.periods.map(p=>[(p.now?'▶ ':'')+ORD[p.i],`${p.from}–${p.to==null?'':p.to}`,{cls:'dim',html:p.years},{html:big(p.pinnacle)},{html:big(p.challenge)}]);
  return`<div class="section">${secH('Pinnacles & Challenges',`age ${c.age}`)}
    ${tableHTML(['Period','Age','Years','Pinnacle','Challenge'],rows)}
    <p class="note">Four long stretches of life. Each pinnacle is an opportunity; each challenge is the obstacle that comes with it.</p></div>`;
}
function weekAhead(c){
  return Array.from({length:7},(_,i)=>{const t=addDays(c.today,i+1);return{t,day:cycles(c.b,t).day};});
}
function transitsHTML(c){
  const y=c.cyc,cur=c.periods.find(p=>p.now);
  const rows=[['Personal Year',big(y.year),kw(y.year)],['Personal Month',big(y.month),kw(y.month)],['Personal Day',big(y.day),kw(y.day)],
    ['Universal Year',big(y.universalYear),kw(y.universalYear)],['Universal Day',big(y.universalDay),kw(y.universalDay)]];
  const wk=weekAhead(c).map(w=>[dateLabel(w.t),{html:big(w.day)},{cls:'dim',html:kw(w.day)}]);
  return`<div class="section">${secH('Your Numbers Now',dateLabel(c.today)+' '+c.today.y)}
    <div class="grid2">
      <div>${tableHTML(['Cycle','','Keywords'],rows.map(r=>[r[0],{html:r[1]},{cls:'dim',html:r[2]}]))}
        <p class="note">Now in your ${ORD[cur.i].toLowerCase()} pinnacle (${cur.pinnacle}) with challenge ${cur.challenge}.</p></div>
      <div>${secH('The Next 7 Days')}${tableHTML(['Day','Personal day',''],wk)}</div>
    </div></div>`;
}

// ─── Reading (numerology language only; calculated data only) ──────────────
function readingData(c){
  const y=c.cyc,cur=c.periods.find(p=>p.now);
  const personal=[`Personal year ${y.year} (${kw(y.year)})`,`Personal month ${y.month} (${kw(y.month)})`,`Personal day ${y.day} (${kw(y.day)})`,
    `Current pinnacle ${cur.pinnacle} (${kw(cur.pinnacle)}), ages ${cur.from}–${cur.to==null?'onward':cur.to}`,
    `Current challenge ${cur.challenge} (${kw(cur.challenge)})`].join('\n');
  const week=weekAhead(c).map(w=>`${dateLabel(w.t)}: personal day ${w.day} (${kw(w.day)})`).join('\n');
  const core=`Life path ${c.lifePath.n}, expression ${c.expression.n}, soul urge ${c.soul.n}`;
  return{name:(c.input&&c.input.name)||'',core,personal,week,universal:`Universal year ${y.universalYear} (${kw(y.universalYear)}), universal day ${y.universalDay} (${kw(y.universalDay)})`};
}
const VOICE='You are a thoughtful numerologist working in the Pythagorean system. Use plain, everyday language.';
const SECTIONS=[
  {id:1,icon:'🗓️',title:'The Year You’re In',desc:'Your personal year and the year everyone shares',
   prompt:d=>VOICE+' Data about one person (internal — do not list it):\n\n'+d.personal.split('\n')[0]+'\n'+d.universal+'\nTheir core numbers: '+d.core+'\n\n'+
     'Write a 200–250 word reading in second person on what this year is asking of them and how to work with it. Warm and grounded; mention at most two numbers.',
   astroPrompt:d=>'Give a 120–150 word technical numerology summary of these cycles:\n\n'+d.personal+'\n'+d.universal},
  {id:2,icon:'🌿',title:'This Month and Today',desc:'Your personal month and day, within the long stretch you’re in',
   prompt:d=>VOICE+' Data about one person (internal — do not list it):\n\n'+d.personal+'\n\n'+
     'Write a 200–250 word reading in second person on what is alive for them this month and today, set against the longer stretch of life they are in. Warm and specific; mention at most two numbers.',
   astroPrompt:d=>'Give a 120–150 word technical numerology summary of this person’s current month, day, pinnacle and challenge:\n\n'+d.personal},
  {id:3,icon:'🔭',title:'The Week Ahead',desc:'Your personal days over the next 7 days',
   prompt:d=>VOICE+' Here are one person’s personal day numbers for the next 7 days (internal — do not quote dates or list items):\n\n'+d.week+'\n\n'+
     'Write a 200–250 word reading on the arc of the coming week — where to push, where to rest, where to connect. Second person, warm, no dates.',
   astroPrompt:d=>'Give a 120–150 word technical numerology summary of these personal days by date:\n\n'+d.week},
  {id:4,icon:'✦',title:'Contemplation',desc:'A closing reflection to sit with',
   prompt:d=>VOICE+' For a person whose numbers are: '+d.core+'\nand whose current cycles are:\n'+d.personal+'\n\n'+
     'Write a single contemplative question or poetic invitation (70–90 words) to sit with. Evocative and open; no numbers, no technical terms.'}
];

// ─── Guide (each item prompt holds only that item's data) ──────────────────
const explain=(what,detail,ask)=>VOICE+' Explain one number in a person’s numerology chart.\n\n'+what+'\n'+detail+'\n\n'+
  'Write 140–180 words, second person, warm and specific: '+ask+' No headings.';
const coreItem=(title,role,r,how)=>({title,code:String(r.n),sub:kw(r.n)+(r.debt?' · karmic debt '+r.debt:''),role,
  prompt:explain(`Position: ${title.toLowerCase()} — ${role}\nNumber: ${r.n} (${kw(r.n)})`,
    `How it is found: ${how}`+(r.debt?`\nIt passes through ${r.debt} on the way down, which asks for ${DEBT[r.debt]}.`:'')+(MASTER.has(r.n)?'\nThis is a master number: keep it, don’t reduce it.':''),
    'what this number means in this position, its gifts, its shadow side, and how to live it well.')});
function coreItems(c){
  const out=[
    coreItem('Life Path',ROLE.lifePath,c.lifePath,`adding the birth month, day and year (${c.date})`),
    coreItem('Expression',ROLE.expression,c.expression,'adding every letter of the full name at birth'),
    coreItem('Soul Urge',ROLE.soul,c.soul,'adding the vowels of the full name at birth'),
    coreItem('Personality',ROLE.personality,c.personality,'adding the consonants of the full name at birth'),
    coreItem('Birthday',ROLE.birthday,c.birthday,`the day of the month they were born (${c.b.d})`),
    coreItem('Maturity',ROLE.maturity,c.maturity,'adding the two main totals: the one from the birth date and the one from the full name'),
  ];
  if(c.current)out.push(coreItem('Current Name',ROLE.currentName,c.current,'adding every letter of the name they use now'));
  return out;
}
function nameItems(c){
  const out=[{title:'Number Balance',code:[1,2,3,4,5,6,7,8,9].map(n=>c.counts[n]).join(' '),sub:'how often 1 to 9 appear',role:ROLE.balance,
    prompt:explain('Position: the spread of numbers in the full name at birth',
      'Count of each number 1–9 in the name: '+[1,2,3,4,5,6,7,8,9].map(n=>`${n}×${c.counts[n]}`).join(', ')+'\n'+[1,2,3,4,5,6,7,8,9].map(n=>`${n}: ${kw(n)}`).join('\n'),
      'which qualities come easily (the frequent numbers), which are quieter (the rare or absent ones), and what that balance means day to day.')}];
  c.passion.forEach(n=>out.push({title:`Hidden Passion ${n}`,code:String(n),sub:kw(n),role:ROLE.passion,
    prompt:explain(`Position: hidden passion — ${ROLE.passion}\nNumber: ${n} (${kw(n)}), appearing ${c.counts[n]} times in the full name`,'',
      'what this repeated quality looks like as a drive and a talent, and how to keep it from taking over.')}));
  c.lessons.forEach(n=>out.push({title:`Missing ${n}`,code:String(n),sub:kw(n),role:ROLE.lesson,
    prompt:explain(`Position: karmic lesson — ${ROLE.lesson}\nMissing number: ${n} (${kw(n)})`,'',
      'how the absence of this quality might show up, and simple ways to grow it.')}));
  c.debts.forEach(d=>out.push({title:`Karmic Debt ${d.n} (${d.where})`,code:String(d.n),sub:DEBT[d.n],role:ROLE.debt,
    prompt:explain(`Position: karmic debt ${d.n}, found in the ${d.where}\nWhat it asks for: ${DEBT[d.n]}`,'',
      'how this debt tends to show up, why it can feel hard, and how working with it becomes a strength.')}));
  return out;
}
function periodItems(c){
  return c.periods.flatMap(p=>{
    const ages=`ages ${p.from}–${p.to==null?'onward':p.to} (${p.years})`;
    return[
      {title:`${ORD[p.i]} Pinnacle`,code:String(p.pinnacle),sub:ages+(p.now?' · now':''),role:ROLE.pinnacle,
       prompt:explain(`Position: pinnacle ${p.i+1} of 4 — ${ROLE.pinnacle}\nNumber: ${p.pinnacle} (${kw(p.pinnacle)})\nWhen: ${ages}${p.now?', the stretch they are in now':''}`,'',
         'the opportunity this stretch of life offers and how to make the most of it.')},
      {title:`${ORD[p.i]} Challenge`,code:String(p.challenge),sub:ages+(p.now?' · now':''),role:ROLE.challenge,
       prompt:explain(`Position: challenge ${p.i+1} of 4 — ${ROLE.challenge}\nNumber: ${p.challenge} (${kw(p.challenge)})\nWhen: ${ages}${p.now?', the stretch they are in now':''}`,'',
         'the obstacle this stretch of life brings and how working through it builds strength.')},
    ];
  });
}
function cycleItems(c){
  const y=c.cyc,when=`${MONTHS[c.today.m-1]} ${c.today.y}`;
  return[
    {title:'Personal Year',code:String(y.year),sub:kw(y.year),role:ROLE.pYear,
     prompt:explain(`Position: this year's personal number (${c.today.y}) — ${ROLE.pYear}\nNumber: ${y.year} (${kw(y.year)})`,'','what this year is for, what to start or finish, and what to let be.')},
    {title:'Personal Month',code:String(y.month),sub:kw(y.month),role:ROLE.pMonth,
     prompt:explain(`Position: this month's personal number (${when}) — ${ROLE.pMonth}\nNumber: ${y.month} (${kw(y.month)})`,'','what this month favours and how to use it well.')},
    {title:'Personal Day',code:String(y.day),sub:kw(y.day),role:ROLE.pDay,
     prompt:explain(`Position: today's personal number (${dateLabel(c.today)}) — ${ROLE.pDay}\nNumber: ${y.day} (${kw(y.day)})`,'','what today favours and one simple way to meet it.')},
    {title:'Universal Year',code:String(y.universalYear),sub:kw(y.universalYear),role:ROLE.uYear,
     prompt:explain(`Position: the shared number of ${c.today.y} — ${ROLE.uYear}\nNumber: ${y.universalYear} (${kw(y.universalYear)})`,'','the collective mood this number points to and how it might be felt.')},
  ];
}
const ov=(label,list)=>VOICE+' Write a 200–260 word overview of the '+label+' in one person’s numerology chart, as one connected picture. Second person, warm, no headings or lists.\n\n'+list;
const lines=items=>items.map(i=>`${i.title}: ${i.code} (${i.sub})`).join('\n');

window.SYSTEM={
  id:'numerology',pageTitle:'Numerology Chart',title:'Numerology Chart',noun:'Chart',
  formTitle:'Numerology',formSub:'Pythagorean numerology from your full name at birth and your birth date: core numbers, pinnacles, challenges and your personal year, month and day.',
  needsBirthName:true,dateOnly:true,formFoot:'only the date and name are used',
  accent:{accent:'#7a4a8a','accent-dk':'#5e3570',deep:'#3a2a4a'},
  compute,
  header:c=>'Pythagorean',
  badges:c=>[{n:c.lifePath.n,h:'Life Path',p:kw(c.lifePath.n)},{n:c.expression.n,h:'Expression',p:kw(c.expression.n)},{n:c.soul.n,h:'Soul Urge',p:kw(c.soul.n)}],
  chartHTML,positionsHTML,transitsHTML,
  reading:{title:'Cycle Reading',sections:SECTIONS,data:readingData},
  guide:{title:'Numbers Guide',fab:'Numbers Guide',tabs:[
    {key:'core',name:'Core Numbers',icon:'✶',col:'#7a4a8a',blurb:'From your birth date and full name',items:coreItems,
     overview:c=>ov('core numbers',lines(coreItems(c)))},
    {key:'name',name:'Name Details',icon:'🔤',col:'#b07010',blurb:'Balance, passions, lessons and debts in your name',items:nameItems},
    {key:'periods',name:'Pinnacles & Challenges',icon:'⛰️',col:'#1a6b48',blurb:'Four long stretches of life',items:periodItems,
     overview:c=>ov('pinnacles and challenges (the four long stretches of life; they are now age '+c.age+')',lines(periodItems(c)))},
    {key:'cycles',name:'Cycles Now',icon:'🔄',col:'#3a4a8a',blurb:'Your personal year, month and day',items:cycleItems},
  ]}
};
})();
