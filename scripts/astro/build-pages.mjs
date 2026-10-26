// Builds one standalone HTML file per system: shared core + exactly one system module.
// Usage: node scripts/astro/build-pages.mjs   → astro-pages/*.html (+ astro-pages/artifact/)
import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'../..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const SYSTEMS=[
  {module:'genekeys',out:'gene-keys.html',title:'Gene Keys Hologenetic Profile'},
  {module:'humandesign',out:'human-design.html',title:'Human Design Bodygraph'},
  {module:'natal',out:'natal-astrology.html',title:'Natal Astrology Chart'},
  {module:'vedic',out:'vedic-astrology.html',title:'Vedic Astrology Chart'},
];
const core=['shared/astro/core/astronomy.js','shared/astro/core/tz.js','shared/astro/core/cities.js','shared/astro/core/core.js'].map(read).join('\n;\n');
const css=read('shared/astro/core/core.css');
fs.mkdirSync(path.join(root,'astro-pages'),{recursive:true});
const only=process.argv[2];
for(const s of SYSTEMS){
  if(only&&s.module!==only)continue;
  const file=path.join(root,'shared/astro/systems',s.module+'.js');
  if(!fs.existsSync(file)){console.log('skip',s.module);continue;}
  const html=`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${s.title}</title>
<style>
${css}
</style>
</head>
<body>
<div id="app"></div>
<script>
${core}
;
${fs.readFileSync(file,'utf8')}
;
boot();
</script>
</body>
</html>
`;
  fs.writeFileSync(path.join(root,'astro-pages',s.out),html);
  // claude.ai artifact variant: the publisher supplies the document skeleton.
  const frag=html.slice(html.indexOf('<title>'),html.indexOf('</head>')).trim()+'\n'+
    html.slice(html.indexOf('<body>')+6,html.indexOf('</body>')).trim()+'\n';
  fs.mkdirSync(path.join(root,'astro-pages/artifact'),{recursive:true});
  fs.writeFileSync(path.join(root,'astro-pages/artifact',s.out),frag);
  console.log('built astro-pages/'+s.out,(html.length/1024).toFixed(0)+' KB');
}
