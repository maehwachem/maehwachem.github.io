/* Sky Observatory — calculations only. Dates are always Korean Standard Time.
 * Astronomy Engine 2.1.19 (MIT). See vendor/astronomy-engine-LICENSE.txt.
 */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./vendor/astronomy.browser.min.js'), require('./stars.js'));
  } else root.SkyCore = factory(root.Astronomy, root.SkyStars);
})(typeof globalThis !== 'undefined' ? globalThis : self, function(A, STARS) {
  'use strict';
  const DAY=86400000, MINUTE=60000, KST=9*3600000;
  const BODIES=[['Mercury','수성'],['Venus','금성'],['Mars','화성'],['Jupiter','목성'],['Saturn','토성'],['Uranus','천왕성'],['Neptune','해왕성']];
  const PHASES=['삭','상현','망','하현'];
  const cache=new Map();
  function memo(key,fn) { if(cache.has(key))return cache.get(key);const v=fn();cache.set(key,v);if(cache.size>70)cache.delete(cache.keys().next().value);return v; }
  function dateKey(date) {return new Date(+new Date(date)+KST).toISOString().slice(0,10);}
  function dateStart(key) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(key))throw Error('날짜를 확인해 주세요.');
    const d=new Date(key+'T00:00:00+09:00');
    if(!Number.isFinite(+d)||dateKey(d)!==key||Number(key.slice(0,4))<2000||Number(key.slice(0,4))>2100)throw Error('2000년부터 2100년 사이의 날짜를 골라 주세요.');
    return d;
  }
  function atTime(key,clock) {
    dateStart(key);
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(clock))throw Error('관측 시각을 확인해 주세요.');
    return new Date(key+'T'+clock+':00+09:00');
  }
  function shiftDate(key,n) {return dateKey(new Date(+dateStart(key)+n*DAY));}
  function observer(location) {
    const lat=Number(location.lat),lon=Number(location.lon),height=Number(location.height||0);
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||!Number.isFinite(height)||Math.abs(lat)>90||Math.abs(lon)>180||height<0||height>9000)throw Error('위도·경도·높이를 확인해 주세요.');
    return new A.Observer(lat,lon,height);
  }
  function locKey(location){return [Number(location.lat).toFixed(5),Number(location.lon).toFixed(5),Number(location.height||0)].join(',');}
  function toDate(t){return t ? new Date(t.date) : null;}
  function within(t,start,end){const d=t&&toDate(t);return d&&+d>=+start&&+d<+end?d:null;}
  function direction(az) {return ['북','북북동','북동','동북동','동','동남동','남동','남남동','남','남남서','남서','서남서','서','서북서','북서','북북서'][Math.round(az/22.5)%16];}
  function position(body,time,obs) {
    const q=A.Equator(body,time,obs,true,true),h=A.Horizon(time,obs,q.ra,q.dec,'normal');
    return {alt:h.altitude,az:h.azimuth,direction:direction(h.azimuth)};
  }
  function geometricSunAltitude(time,obs){const q=A.Equator('Sun',time,obs,true,true);return A.Horizon(time,obs,q.ra,q.dec).altitude;}
  function dailyTimes(key,obs) {
    const start=dateStart(key),end=new Date(+start+DAY);
    const rise=(body,dir)=>within(A.SearchRiseSet(body,obs,dir,start,1),start,end);
    const transit=body=>within(A.SearchHourAngle(body,obs,0,start,1).time,start,end);
    const twilight=dir=>within(A.SearchAltitude('Sun',obs,dir,start,1,-18),start,end);
    return {sunrise:rise('Sun',1),sunset:rise('Sun',-1),sunTransit:transit('Sun'),moonrise:rise('Moon',1),moonset:rise('Moon',-1),moonTransit:transit('Moon'),dawn:twilight(1),dusk:twilight(-1)};
  }
  // The true elapsed time since conjunction is used, not phase-angle/360*29.53.
  function moonInfo(time,obs) {
    const t=A.MakeTime(time),previous=A.SearchMoonPhase(0,t,-35),phase=A.MoonPhase(t),light=A.Illumination('Moon',t);
    const name=phase<8||phase>352?'삭 무렵':phase<83?'차오르는 달':phase<=97?'상현 무렵':phase<173?'보름을 향하는 달':phase<=187?'보름 무렵':phase<263?'기우는 달':phase<=277?'하현 무렵':'그믐을 향하는 달';
    const next=A.SearchMoonQuarter(t);
    return {phase,fraction:light.phase_fraction,age:t.ut-previous.ut,name,waxing:phase<180,position:position('Moon',t,obs),next:{name:PHASES[next.quarter],time:toDate(next.time)}};
  }
  // Find time intervals by a short grid, refining transitions to about one second.
  function intervalsWhere(start,end,predicate,step=10*MINUTE) {
    const results=[];let previous=+start,inside=Boolean(predicate(new Date(previous))),begin=inside?previous:null;
    while(previous<+end){
      const current=Math.min(previous+step,+end),next=Boolean(predicate(new Date(current)));
      if(next!==inside){let lo=previous,hi=current;while(hi-lo>1000){const mid=(lo+hi)/2;if(Boolean(predicate(new Date(mid)))===inside)lo=mid;else hi=mid;}const edge=(lo+hi)/2;if(next)begin=edge;else if(begin!==null){results.push({start:new Date(begin),end:new Date(edge)});begin=null;}inside=next;}
      previous=current;
    }
    if(inside&&begin!==null)results.push({start:new Date(begin),end:new Date(end)});
    return results;
  }
  function daytimeMoonIntervals(key,obs) {
    const start=dateStart(key),end=new Date(+start+DAY);
    return intervalsWhere(start,end,t=>geometricSunAltitude(t,obs)>0&&position('Moon',t,obs).alt>=10&&A.AngleFromSun('Moon',t)>=30);
  }
  function status(alt,sunAlt){return alt<0?'지평선 아래':sunAlt>=-6?'하늘이 밝음':alt<10?'낮은 고도':sunAlt>-18?'박명 중':'지평선 위';}
  function daily(key,clock,location) {
    const obs=observer(location),time=atTime(key,clock),sun=position('Sun',time,obs),sunGeom=geometricSunAltitude(time,obs);
    const base=memo('day:'+key+':'+locKey(location),()=>({times:dailyTimes(key,obs),dayMoon:daytimeMoonIntervals(key,obs)}));
    const moon=moonInfo(time,obs);
    const planets=BODIES.map(([body,name])=>{const p=position(body,time,obs);return {body,name,...p,status:status(p.alt,sunGeom),mag:A.Illumination(body,time).mag,elongation:A.AngleFromSun(body,time),instrument:body==='Uranus'||body==='Neptune'?'망원경 필요':'맨눈·망원경'};});
    const stars=STARS.map(star=>{
      // Sequential only; no asynchronous work between DefineStar and Equator.
      // Fixed J2000 coordinates: proper motion omitted; 1000 ly is a far-field approximation.
      A.DefineStar('Star1',star.ra,star.dec,1000);
      return {...star,...position('Star1',time,obs)};
    }).filter(s=>s.alt>=10).sort((a,b)=>a.mag-b.mag).slice(0,6);
    return {date:key,clock,time,sun:{...sun,geometricAlt:sunGeom},moon,planets,stars,...base};
  }
  function solarData(e) {
    const point=p=>p?{time:toDate(p.time),alt:p.altitude}:null;
    const begin=point(e.partial_begin),end=point(e.partial_end),peak=point(e.peak);
    return {kind:e.kind,name:{partial:'부분일식',annular:'금환일식',total:'개기일식'}[e.kind],obscuration:e.obscuration,begin,end,peak,totalBegin:point(e.total_begin),totalEnd:point(e.total_end)};
  }
  function lunarData(e,obs) {
    const peak=toDate(e.peak),from=minutes=>new Date(+peak+minutes*MINUTE);
    const begin=from(-e.sd_penum),end=from(e.sd_penum),visible=intervalsWhere(begin,end,t=>position('Moon',t,obs).alt>0,5*MINUTE);
    const overlap=(minutes)=>minutes>0&&visible.some(v=>+v.end>+from(-minutes)&&+v.start<+from(minutes));
    return {kind:e.kind,name:{penumbral:'반영월식',partial:'부분월식',total:'개기월식'}[e.kind],begin,end,peak:{time:peak,alt:position('Moon',peak,obs).alt},visible,localStage:overlap(e.sd_total)?'개기 단계 관측 가능':overlap(e.sd_partial)?'부분 단계 관측 가능':visible.length?'반영 단계 일부 관측 가능':'이 지역에서는 지평선 아래',partialBegin:e.sd_partial?from(-e.sd_partial):null,partialEnd:e.sd_partial?from(e.sd_partial):null,totalBegin:e.sd_total?from(-e.sd_total):null,totalEnd:e.sd_total?from(e.sd_total):null};
  }
  function nextEclipses(key,location) {
    const obs=observer(location),start=dateStart(key);
    return memo('eclipses:'+key+':'+locKey(location),()=>{
      // Include an event already underway at the selected date's midnight.
      const search=new Date(+start-DAY);
      let s=A.SearchLocalSolarEclipse(search,obs);while(+toDate(s.partial_end.time)<+start)s=A.NextLocalSolarEclipse(s.peak.time,obs);
      let e=A.SearchLunarEclipse(search),lunar=null;
      for(let i=0;i<24;i++){const l=lunarData(e,obs);if(+l.end>=+start&&l.visible.some(v=>+v.end>=+start)){lunar=l;break;}e=A.NextLunarEclipse(e.peak);}
      return {solar:solarData(s),lunar};
    });
  }
  function monthRange(key) {
    const start=dateStart(key.slice(0,7)+'-01'),year=Number(key.slice(0,4)),month=Number(key.slice(5,7));
    const end=new Date(Date.UTC(year,month,1)-KST);
    return {start,end,year,month};
  }
  function calendar(key,location) {
    const {start,end,year,month}=monthRange(key),obs=observer(location);
    return memo('month:'+year+'-'+month+':'+locKey(location),()=>{
      const events=[];
      const add=(id,title,time,type,detail,extra={})=>{if(+time>=+start&&+time<+end)events.push({id,title,time,date:dateKey(time),type,detail,...extra});};
      let q=A.SearchMoonQuarter(start);
      while(+toDate(q.time)<+end){const name=PHASES[q.quarter];add('phase-'+q.quarter,name==='망'?'보름달 (망)':name==='삭'?'삭':name+'달',toDate(q.time),'phase','해당 위상이 되는 순간입니다. 이 지역의 달 출몰 시각과 관측 가능한 시간은 따로 확인하세요.');q=A.NextMoonQuarter(q);}
      let ap=A.SearchLunarApsis(start);
      while(+toDate(ap.time)<+end){add('apsis-'+ap.kind,ap.kind?'달의 원지점':'달의 근지점',toDate(ap.time),'apsis','지구 중심과 달 중심 사이 거리 약 '+Math.round(ap.dist_km/100)*100+' km. 근·원지점 시각은 근삿값이며 공식 역서와 차이가 날 수 있습니다.',{approx:true});ap=A.NextLunarApsis(ap);}
      const seasons=A.Seasons(year);
      [['mar_equinox','춘분'],['jun_solstice','하지'],['sep_equinox','추분'],['dec_solstice','동지']].forEach(([prop,name])=>add(prop,name,toDate(seasons[prop]),'season','태양의 겉보기 위치를 기준으로 정한 절기 시각입니다.'));
      // Locally visible eclipses only. Contacts crossing a month boundary are retained.
      let solar=A.SearchLocalSolarEclipse(new Date(+start-DAY),obs);
      for(let i=0;i<3&&+toDate(solar.partial_begin.time)<+end;i++){
        if(+toDate(solar.partial_end.time)>=+start){const data=solarData(solar),display=new Date(Math.min(+end-1,Math.max(+start,+data.peak.time)));add('solar',data.name,display,'solar','선택한 관측지 기준입니다. 진행 단계마다 태양의 고도가 다르므로 아래 관측 시간을 확인하세요.',{eclipse:data});}
        solar=A.NextLocalSolarEclipse(solar.peak.time,obs);
      }
      let lunar=A.SearchLunarEclipse(new Date(+start-DAY));
      for(let i=0;i<3&&+toDate(lunar.peak)-lunar.sd_penum*MINUTE<+end;i++){
        const data=lunarData(lunar,obs);
        if(data.visible.some(v=>+v.end>=+start&&+v.start<+end)){
          const display=new Date(Math.min(+end-1,Math.max(+start,+data.peak.time)));
          add('lunar',data.name,display,'lunar',data.localStage+' · 지평선 위에 떠 있는 구간 기준이며 날씨는 반영하지 않습니다.',{eclipse:data});
        }
        lunar=A.NextLunarEclipse(lunar.peak);
      }
      // Verified event from KASI's October 2026 ephemeris, not an annual recurrence.
      if(year===2026&&month===10)add('orionids-2026','오리온자리 유성우 극대',new Date('2026-10-22T03:16:00+09:00'),'meteor','한국천문연구원 2026년 10월 자료(NASA 기준)의 예상 극대입니다. 실제 관측 수는 달빛·구름·광공해·복사점 고도에 따라 달라집니다.',{source:'https://astro.kasi.re.kr/life/ephemeris',forecast:true});
      events.sort((a,b)=>+a.time-+b.time);
      const days=[];
      for(let time=+start;time<+end;time+=DAY){const date=dateKey(new Date(time)),phaseTime=atTime(date,'21:00'),phase=A.MoonPhase(phaseTime),fraction=A.Illumination('Moon',phaseTime).phase_fraction;days.push({date,day:Number(date.slice(-2)),phase,fraction,waxing:phase<180});}
      return {key:key.slice(0,7),year,month,days,events};
    });
  }
  function upcoming(key,location) {
    const start=dateStart(key),events=[...calendar(key,location).events];
    if(Number(key.slice(0,4))<2100||Number(key.slice(5,7))<12){const next=monthRange(key).end;events.push(...calendar(dateKey(next),location).events);}
    return events.filter(e=>+e.time>=+start).slice(0,4);
  }
  return {dateKey,dateStart,atTime,shiftDate,observer,direction,position,dailyTimes,moonInfo,intervalsWhere,daytimeMoonIntervals,daily,solarData,lunarData,nextEclipses,calendar,upcoming,monthRange,constants:{DAY,MINUTE,KST}};
});
