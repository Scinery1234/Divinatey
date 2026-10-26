import {load} from '../scripts/astro/load.mjs';import assert from 'node:assert/strict';import {test} from 'node:test';
import fs from 'node:fs';
const SYS=['genekeys','humandesign','natal','vedic'];
// Words that belong to one system only. A prompt from any other system must not contain them.
const OWN={
  genekeys:[/Gene Key/i,/Siddhi/i,/Hologenetic/i,/Venus Sequence/i],
  humandesign:[/Human Design/i,/bodygraph/i,/Manifestor|Projector|Reflector/],
  natal:[/Placidus/i,/tropical/i,/Western astrolog/i],
  vedic:[/Jyotish/i,/nakshatra/i,/dasha/i,/Lahiri/i],
};
const input={utc:new Date('1990-07-15T04:30:00Z'),lat:-33.87,lon:151.21,name:'Sample'};

for(const id of SYS){
  const X=load(id),S=X.SYSTEM,c=S.compute(input);c.input=input;
  const prompts=[];
  const d=S.reading.data(c);
  S.reading.sections.forEach(s=>{prompts.push(s.prompt(d));if(s.astroPrompt)prompts.push(s.astroPrompt(d));});
  S.guide.tabs.forEach(t=>{t.items(c).forEach(i=>prompts.push(i.prompt));if(t.overview)prompts.push(t.overview(c));});

  test(`${id}: pages render`,()=>{
    for(const k of ['chartHTML','transitsHTML'])assert.ok(S[k](c).length>500,k);
  });
  test(`${id}: no other system's vocabulary in any prompt`,()=>{
    for(const other of SYS.filter(x=>x!==id))for(const re of OWN[other])
      for(const p of prompts)assert.ok(!re.test(p),`${id} prompt mentions ${re} (from ${other}):\n${p.slice(0,200)}`);
  });
  test(`${id}: each guide item prompt holds only its own item`,()=>{
    S.guide.tabs.forEach(t=>{
      const items=t.items(c);
      items.forEach((it,i)=>items.forEach((o,j)=>{
        if(i===j||o.title===it.title)return;
        assert.ok(!it.prompt.includes(o.title),`[${t.key}] "${it.title}" prompt contains "${o.title}"`);
      }));
    });
  });
}
