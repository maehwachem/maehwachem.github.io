const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../core.js');
const A = require('../vendor/astronomy.browser.min.js');
const ansan = {lat:37.3219, lon:126.8309};
const seoul = {lat:37.5665, lon:126.978};
const kst = (day, time) => new Date(`${day}T${time}:00+09:00`);
const near = (actual, expected, seconds) => assert.ok(Math.abs(+actual - +expected) <= seconds*1000, `${actual.toISOString()} differs from ${expected.toISOString()}`);

// Independent reference: KASI, October 2026 monthly ephemeris, Seoul.
// https://astro.kasi.re.kr/life/ephemeris
test('Seoul rise/set times agree with KASI to the published minute', () => {
  const d = C.daily('2026-10-17', '21:00', seoul);
  for (const [key,time] of [['sunrise','06:42'],['sunset','17:53'],['moonrise','12:56'],['moonset','22:10']]) {
    near(d.times[key], kst('2026-10-17',time), 30);
  }
  assert.equal(d.moon.age.toFixed(1),'6.8');
});

test('October lunar phases agree with KASI within two minutes', () => {
  const m = C.calendar('2026-10-17',seoul);
  near(m.events.find(x=>x.id==='phase-1').time,kst('2026-10-19','01:12'),120);
  near(m.events.find(x=>x.id==='phase-2').time,kst('2026-10-26','13:12'),120);
  assert.equal(m.days.length,31);
});

test('KST dates remain correct across UTC midnight and leap days', () => {
  assert.equal(C.dateKey(new Date('2026-10-16T15:00:00Z')),'2026-10-17');
  assert.equal(C.shiftDate('2024-02-28',1),'2024-02-29');
  assert.equal(C.shiftDate('2024-02-29',1),'2024-03-01');
  assert.throws(()=>C.dateStart('2026-02-29'));
  assert.throws(()=>C.atTime('2026-10-17','24:00'));
  assert.throws(()=>C.observer({lat:91,lon:0}));
});

test('a missing moonset is not replaced with the next day’s event', () => {
  assert.equal(C.daily('2026-10-19','20:00',ansan).times.moonset,null);
});

test('polar day and polar night do not invent sunrise or sunset times', () => {
  const tromso = {lat:69.6492,lon:18.9553};
  for(const date of ['2026-06-21','2026-12-21']) {
    const d = C.daily(date,'12:00',tromso);
    assert.equal(d.times.sunrise,null);
    assert.equal(d.times.sunset,null);
    assert.ok(d.planets.every(p=>Number.isFinite(p.alt)));
  }
});

test('a lunar eclipse can be locally visible even when its maximum is below the horizon', () => {
  const e = C.nextEclipses('2026-10-17',ansan).lunar;
  assert.equal(C.dateKey(e.peak.time),'2027-02-21');
  assert.ok(e.peak.alt<0);
  assert.ok(e.visible.length>0);
  assert.ok(+e.visible[0].start<+e.visible[0].end);
  assert.ok(+e.visible[0].end<+e.peak.time);
  assert.equal(e.localStage,'반영 단계 일부 관측 가능');
  assert.ok(C.calendar('2027-02-01',ansan).events.some(x=>x.type==='lunar'));
});

test('the March 2026 total eclipse includes the visible total phase in Ansan', () => {
  const e = C.lunarData(A.SearchLunarEclipse(new Date('2026-03-01')),C.observer(ansan));
  assert.equal(e.localStage,'개기 단계 관측 가능');
  assert.ok(+e.visible[0].start>+e.begin);
  assert.ok(+e.visible[0].start<+e.totalBegin);
  assert.ok(+e.visible[0].end>+e.totalEnd);
});

test('daytime moon windows satisfy the stated altitude and solar separation rules', () => {
  const windows = C.daily('2026-10-17','12:00',ansan).dayMoon;
  assert.ok(windows.length>0);
  for(const window of windows) {
    const time = new Date((+window.start + +window.end)/2);
    const obs = C.observer(ansan);
    assert.ok(C.position('Moon',time,obs).alt>=10);
    assert.ok(C.position('Sun',time,obs).alt>0);
    assert.ok(A.AngleFromSun('Moon',time)>=30);
  }
});

test('verified meteor-shower data is not repeated in other years', () => {
  assert.ok(C.calendar('2026-10-01',ansan).events.some(x=>x.type==='meteor'));
  assert.equal(C.calendar('2027-10-01',ansan).events.some(x=>x.type==='meteor'),false);
});
