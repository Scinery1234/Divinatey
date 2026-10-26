// Loads core (+ optional system module) into a VM context with DOM stubs.
import fs from 'node:fs';import vm from 'node:vm';import path from 'node:path';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'../..');
export function load(system){
  const files=['shared/astro/core/astronomy.js','shared/astro/core/tz.js','shared/astro/core/cities.js','shared/astro/core/core.js'];
  if(system)files.push(`shared/astro/systems/${system}.js`);
  const ctx={console,Intl,Date,Math,JSON,setTimeout,
    document:{addEventListener(){},getElementById(){return null}},window:{}};
  vm.createContext(ctx);ctx.window=ctx;
  const src=files.map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n;\n')+
    '\n;globalThis.__x={Astronomy,tropLon,ascLon,mcLon,placidusCusps,houseOf,gateLine,designDate,toUTC,ayanamsaLahiri,trueNode,meanNode,ramc,obliquity,sdiff,norm,arcD,signPos,findStations,aspectForecast,scanTransits,SYSTEM:typeof SYSTEM!=="undefined"?SYSTEM:null};';
  vm.runInContext(src,ctx,{filename:'bundle.js'});
  return ctx.__x;
}
