import {load} from '../scripts/astro/load.mjs';import assert from 'node:assert/strict';import {test} from 'node:test';
const X=load();const A=X.Astronomy;

test('toUTC handles DST zones',()=>{
  assert.equal(X.toUTC('1990-07-15','14:30','Australia/Sydney').toISOString(),'1990-07-15T04:30:00.000Z');
  assert.equal(X.toUTC('1990-07-15','14:30','America/New_York').toISOString(),'1990-07-15T18:30:00.000Z');
  assert.equal(X.toUTC('2024-01-01','00:00','Asia/Kolkata').toISOString(),'2023-12-31T18:30:00.000Z');
});

test('Ascendant rises on the eastern horizon and MC culminates',()=>{
  for(const [lat,lon,iso] of [[-33.87,151.21,'1990-07-15T04:30:00Z'],[51.5,-0.13,'1985-03-02T22:10:00Z'],[19.08,72.88,'2001-11-20T06:00:00Z'],[60.17,24.94,'1972-12-24T12:00:00Z']]){
    const d=new Date(iso),t=A.MakeTime(d),obs=new A.Observer(lat,lon,0);
    const eps=X.obliquity(d)*Math.PI/180;
    const hor=l=>{ // ecliptic-of-date point (lat 0) → horizon
      const L=l*Math.PI/180;
      const ra=Math.atan2(Math.sin(L)*Math.cos(eps),Math.cos(L))*180/Math.PI/15;
      const dec=Math.asin(Math.sin(eps)*Math.sin(L))*180/Math.PI;
      return A.Horizon(t,obs,(ra+24)%24,dec,null);
    };
    const asc=hor(X.ascLon(d,lat,lon));
    assert.ok(Math.abs(asc.altitude)<0.01,'asc alt '+asc.altitude);
    assert.ok(asc.azimuth>0&&asc.azimuth<180,'asc east '+asc.azimuth);
    const mc=hor(X.mcLon(d,lon));
    assert.ok(Math.abs(Math.abs(mc.azimuth-180)%180)<0.05||Math.abs(mc.azimuth)<0.05||Math.abs(mc.azimuth-360)<0.05,'mc az '+mc.azimuth);
  }
});

test('Placidus cusps are ordered and trisect semi-arcs',()=>{
  const d=new Date('1990-07-15T04:30:00Z'),lat=-33.87,lon=151.21;
  const c=X.placidusCusps(d,lat,lon);
  assert.equal(c.length,12);
  let total=0;for(let i=0;i<12;i++)total+=X.norm(c[(i+1)%12]-c[i]);
  assert.ok(Math.abs(total-360)<1e-6,'cusps go round once');
  assert.ok(Math.abs(X.sdiff(c[0],X.ascLon(d,lat,lon)))<1e-9);
  assert.ok(Math.abs(X.sdiff(c[9],X.mcLon(d,lon)))<1e-9);
  // 11th cusp: hour angle = −SDA/3
  const eps=X.obliquity(d)*Math.PI/180,L=c[10]*Math.PI/180;
  const ra=Math.atan2(Math.sin(L)*Math.cos(eps),Math.cos(L))*180/Math.PI,dec=Math.asin(Math.sin(eps)*Math.sin(L));
  const sda=Math.acos(-Math.tan(lat*Math.PI/180)*Math.tan(dec))*180/Math.PI;
  const ha=X.sdiff(X.ramc(d,lon),ra);
  assert.ok(Math.abs(ha+sda/3)<1e-5,`ha ${ha} sda/3 ${sda/3}`);
  assert.equal(X.placidusCusps(d,70,20),null);
});

test('Mandala: equinox in Gate 25, solstices in 15 / 10 region',()=>{
  assert.equal(X.gateLine(0).gate,25);
  assert.equal(X.gateLine(358.3).gate,25);
  assert.equal(X.gateLine(358.2).gate,36);
  assert.equal(X.gateLine(302.0).gate,41);
  assert.equal(X.gateLine(301.99).gate,60);
  assert.equal(X.gateLine(90).gate,15);
  assert.equal(X.gateLine(270).gate,10);
  assert.equal(X.gateLine(180).gate,46);
  assert.equal(X.gateLine(302.0+0.9375*2.5).line,3);
});

test('Design date is 88° of solar arc earlier',()=>{
  const b=new Date('1990-07-15T04:30:00Z'),d=X.designDate(b);
  assert.ok(Math.abs(X.sdiff(X.tropLon('Sun',b),X.tropLon('Sun',d))-88)<1e-4);
  const days=(b-d)/864e5;assert.ok(days>85&&days<93);
});

test('True node matches Moon at node crossings within 0.3°',()=>{
  let n=A.SearchMoonNode(A.MakeTime(new Date('2020-01-01T00:00:00Z')));
  for(let i=0;i<6;i++){
    const moon=X.tropLon('Moon',n.time.date);
    const node=X.trueNode(n.time.date);
    const diff=Math.min(X.arcD(moon,node),X.arcD(moon,node+180));
    assert.ok(diff<0.3,'diff '+diff);
    n=A.NextMoonNode(n);
  }
  const m=X.meanNode(new Date('2000-01-01T12:00:00Z'));assert.ok(Math.abs(m-125.04)<0.05,'mean node J2000 '+m);
});

test('Lahiri ayanamsa',()=>{
  const a2000=X.ayanamsaLahiri(new Date('2000-01-01T12:00:00Z'));
  assert.ok(Math.abs(a2000-23.857)<0.01,'J2000 '+a2000);
  const a2024=X.ayanamsaLahiri(new Date('2024-01-01T00:00:00Z'));
  assert.ok(Math.abs(a2024-24.19)<0.02,'2024 '+a2024);
});

test('Stations: Mercury retrograde Aug 2023 begins ~23 Aug',()=>{
  const ev=X.findStations(['Mercury'],new Date('2023-08-15T00:00:00Z'),20);
  assert.equal(ev[0].type,'retrograde');assert.ok(ev[0].day>=7&&ev[0].day<=10,'day '+ev[0].day);
});
