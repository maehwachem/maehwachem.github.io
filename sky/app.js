(function(){
  'use strict';
  const $=id=>document.getElementById(id),C=window.SkyCore;
  const tabs=['day','night','calendar','telescope','photo'];
  function hashView(){const hash=window.location.hash.slice(1);return hash.startsWith('scope-')?'telescope':hash.startsWith('photo-')?'photo':tabs.includes(hash)?hash:null;}
  if(!C){$('error').hidden=false;$('error').textContent='계산 파일을 불러오지 못했어요. 새로고침해 주세요.';$('loading').textContent='';return;}
  const LOCATIONS={ansan:{name:'안산',lat:37.3219,lon:126.8309},siheung:{name:'시흥',lat:37.3802,lon:126.8029},seoul:{name:'서울',lat:37.5665,lon:126.9780},incheon:{name:'인천',lat:37.4563,lon:126.7052},suwon:{name:'수원',lat:37.2636,lon:127.0286},chuncheon:{name:'춘천',lat:37.8813,lon:127.7298},gangneung:{name:'강릉',lat:37.7519,lon:128.8761},daejeon:{name:'대전',lat:36.3504,lon:127.3845},sejong:{name:'세종',lat:36.4800,lon:127.2890},cheongju:{name:'청주',lat:36.6424,lon:127.4890},jeonju:{name:'전주',lat:35.8242,lon:127.1480},gwangju:{name:'광주',lat:35.1595,lon:126.8526},daegu:{name:'대구',lat:35.8714,lon:128.6014},busan:{name:'부산',lat:35.1796,lon:129.0756},ulsan:{name:'울산',lat:35.5384,lon:129.3114},changwon:{name:'창원',lat:35.2285,lon:128.6811},jeju:{name:'제주',lat:33.4996,lon:126.5312}};
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtClock=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const fmtDate=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric',weekday:'long'});
  const shortDate=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',weekday:'short'});
  function hhmm(value){return fmtClock.format(new Date(value));}
  function clock(value,reference){if(!value)return '이날 없음';const rounded=new Date(Math.round(+new Date(value)/60000)*60000);const key=C.dateKey(rounded);return (reference&&key!==reference?Number(key.slice(5,7))+'/'+Number(key.slice(8,10))+' ':'')+hhmm(rounded);}
  function dateText(key){return fmtDate.format(C.dateStart(key));}
  function signed(value,digits=1){return (value>0?'+':'')+Number(value).toFixed(digits);}
  let initialLocation='ansan',custom={name:'직접 입력',lat:37.3219,lon:126.8309,height:0};
  try{const saved=JSON.parse(localStorage.getItem('kje-sky-location-v1')||'null');if(saved&&((saved.key&&LOCATIONS[saved.key])||saved.key==='custom')){C.observer(saved.key==='custom'?saved.custom:LOCATIONS[saved.key]);initialLocation=saved.key;if(saved.custom)custom=saved.custom;}}catch(_){/* Preferences are optional. */}
  const now=new Date(),today=C.dateKey(now),nowClock=hhmm(now);
  const initialObserver=C.observer(initialLocation==='custom'?custom:LOCATIONS[initialLocation]);
  const currentSkyView=C.position('Sun',now,initialObserver).alt>=0?'day':'night',initialView=hashView()||currentSkyView;
  const state={date:today,clock:nowClock,view:initialView,locationKey:initialLocation,custom,times:{day:currentSkyView==='day'?nowClock:'12:00',night:currentSkyView==='night'?nowClock:'20:00'},calendar:null,daily:null,events:[]};
  const location=()=>state.locationKey==='custom'?state.custom:LOCATIONS[state.locationKey];
  function rememberLocation(){try{localStorage.setItem('kje-sky-location-v1',JSON.stringify({key:state.locationKey,custom:state.custom}));}catch(_){}}
  function showError(message){$('error').textContent=message;$('error').hidden=!message;}
  let worker=null,requestId=0;const pending=new Map();
  function fallback(job){setTimeout(()=>{try{job.resolve(C[job.type](...job.args));}catch(e){job.reject(e);}},0);}
  try{if(window.Worker){worker=new Worker('worker.js');worker.onmessage=e=>{const job=pending.get(e.data.id);if(!job)return;pending.delete(e.data.id);if(e.data.error)job.reject(Error(e.data.error));else job.resolve(e.data.result);};worker.onerror=()=>{worker.terminate();worker=null;pending.forEach(fallback);pending.clear();};}}catch(_){worker=null;}
  function calculate(type,...args){return new Promise((resolve,reject)=>{const job={type,args,resolve,reject};if(worker){const id=++requestId;pending.set(id,job);worker.postMessage({id,type,args});}else fallback(job);});}
  function moonSVG(moon,label='',small=false){
    const fraction=Math.max(0,Math.min(1,moon.fraction)),side=moon.waxing?1:-1,k=1-2*fraction,r=68,cx=90,cy=90,points=[];
    // Orthographic illuminated disk: bright limb and projected terminator.
    for(let i=0;i<=60;i++){const angle=-Math.PI/2+Math.PI*i/60;points.push([cx+side*r*Math.cos(angle),cy+r*Math.sin(angle)]);}
    for(let i=60;i>=0;i--){const angle=-Math.PI/2+Math.PI*i/60;points.push([cx+side*k*r*Math.cos(angle),cy+r*Math.sin(angle)]);}
    const path=points.map((p,i)=>(i?'L':'M')+p[0].toFixed(2)+' '+p[1].toFixed(2)).join(' ')+' Z';
    return '<svg viewBox="0 0 180 180" '+(small?'aria-hidden="true"':'role="img" aria-label="'+esc(label)+'"')+'>'+(small?'':'<circle class="moon-glow" cx="90" cy="90" r="88"/>')+'<circle class="moon-base" cx="90" cy="90" r="68"/><path class="moon-lit" d="'+path+'"/></svg>';
  }
  function timeGrid(id,times,items){$(id).innerHTML=items.map(([key,label])=>'<div class="time-item"><span class="time-label">'+label+'</span><span class="time-value'+(!times[key]?' none':'')+'">'+esc(clock(times[key],state.date))+'</span></div>').join('');}
  function posText(p){return p.alt<0?'지평선 아래 · 고도 '+p.alt.toFixed(1)+'°':p.direction+'쪽 · 고도 '+p.alt.toFixed(1)+'° · 방위각 '+p.az.toFixed(0)+'°';}
  function renderDaily(data){
    state.daily=data;
    $('sun-at').textContent=data.clock+'의 태양';$('sun-heading').textContent=data.sun.alt<0?'태양은 지평선 아래에 있어요':'태양이 떠 있는 시간이에요';$('sun-direction').textContent=data.sun.direction+'쪽 · 방위각 '+data.sun.az.toFixed(0)+'°';$('sun-altitude').textContent=data.sun.alt.toFixed(1)+'°';$('sun-figure').classList.toggle('below',data.sun.alt<0);
    $('day-moon-phase').innerHTML=moonSVG(data.moon,'',true);$('day-moon-position').textContent=data.clock+' 기준 '+posText(data.moon.position);
    $('day-moon-window').textContent=data.dayMoon.length?'찾아볼 시간 · '+data.dayMoon.map(v=>clock(v.start,data.date)+'–'+clock(v.end,data.date)).join(' / '):'이 날짜에는 안내 기준에 맞는 낮의 달 관측 구간이 없어요.';
    timeGrid('day-times',data.times,[['sunrise','해가 뜨는 시각'],['sunTransit','태양의 남중 시각'],['sunset','해가 지는 시각'],['moonrise','달이 뜨는 시각'],['moonTransit','달의 남중 시각'],['moonset','달이 지는 시각']]);
    const m=data.moon;
    $('moon-at').textContent=data.clock+'의 달';$('moon-figure').innerHTML=moonSVG(m,m.name+' · 밝게 보이는 면 '+(m.fraction*100).toFixed(1)+'%');$('moon-heading').textContent=m.name;$('moon-age').innerHTML=m.age.toFixed(1)+'<span class="unit">일</span>';$('moon-fraction').textContent='밝게 보이는 면 '+(m.fraction*100).toFixed(1)+'% · '+data.clock+' 기준';$('next-phase').textContent='다음 '+(m.next.name==='망'?'보름달':m.next.name)+' · '+shortDate.format(new Date(m.next.time))+' '+clock(m.next.time);
    const bright=data.sun.geometricAlt>=-6,twilight=!bright&&data.sun.geometricAlt>-18;
    $('night-heading').textContent=bright?'선택한 시각에는 하늘이 밝아요':twilight?'하늘이 완전히 어둡지 않은 박명 시간이에요':'달과 별을 찾아볼 시간이에요';
    $('night-copy').textContent=bright?'행성이나 별의 위치가 지평선 위라도 밝은 하늘에서는 찾기 어렵습니다. 관측 시각을 저녁이나 새벽으로 바꿔 보세요.':twilight?'밝은 별부터 찾아보세요. 희미한 천체는 천문박명이 끝난 뒤에 살펴보는 편이 좋습니다.':'방향과 고도를 먼저 확인하고, 구름과 주변 불빛을 살펴보세요. 지평선 가까이에서는 산과 건물이 시야를 가릴 수 있습니다.';
    $('night-moon-position').textContent=posText(m.position);
    $('moon-tip').textContent=m.fraction<.06?'달빛이 약한 무렵이에요. 어두운 장소에서 별과 별자리를 찾아보세요.':m.fraction>.93?'보름 무렵이에요. 달의 밝은 무늬를 살펴보세요. 희미한 천체는 달빛의 영향을 많이 받을 수 있어요.':'달의 밝은 부분과 어두운 부분의 경계에서 표면의 굴곡을 살펴보세요. 망원경이 있으면 분화구 관찰에 도움이 됩니다.';
    timeGrid('night-times',data.times,[['sunset','해가 지는 시각'],['dusk','저녁 천문박명 종료'],['dawn','새벽 천문박명 시작'],['moonrise','달이 뜨는 시각'],['moonTransit','달의 남중 시각'],['moonset','달이 지는 시각']]);
    $('planet-time').textContent=data.clock+' · '+location().name;
    const row=p=>'<tr><th scope="row"><span class="planet-name">'+p.name+'</span><small>약 '+signed(p.mag)+'등급</small></th><td>'+p.direction+'<small class="number">'+p.az.toFixed(0)+'°</small></td><td class="number">'+p.alt.toFixed(1)+'°</td><td><span class="status'+(p.alt<0?' below':'')+'">'+p.status+'</span></td></tr>';
    $('planets').innerHTML=data.planets.filter(p=>!['Uranus','Neptune'].includes(p.body)).map(row).join('');$('outer-planets').innerHTML=data.planets.filter(p=>['Uranus','Neptune'].includes(p.body)).map(row).join('');
    $('star-note').textContent=bright?'선택한 시각의 위치만 표시합니다. 낮에는 이 별들을 맨눈으로 찾기 어렵습니다.':'대표 밝은 별을 기준으로 별자리를 찾아보세요. 별자리 전체 모양은 표시하지 않아요.';
    $('stars').innerHTML=data.stars.slice(0,4).map(s=>'<article class="star-card"><h3>'+esc(s.name)+'</h3><p>'+esc(s.constellation)+'</p><p class="star-position">'+esc(s.direction)+' · '+s.alt.toFixed(0)+'°</p><p>기준 '+signed(s.mag)+'등급</p></article>').join('')||'<p class="small">안내 목록에서 고도 10° 이상인 별이 없어요. 다른 시각을 골라보세요.</p>';
    renderUpcoming();
  }
  function solarHTML(e){
    if(!e)return '<p class="small">다음 일식을 계산하지 못했어요.</p>';
    const ref=C.dateKey(e.peak.time),contact=(label,p)=>p?'<dt>'+label+'</dt><dd>'+esc(clock(p.time,ref))+(p.alt<0?' · 지평선 아래':'')+'</dd>':'';
    const amount=e.peak.alt>0&&Number.isFinite(e.obscuration)?'최대 때 태양 면적의 약 '+(e.obscuration*100).toFixed(1)+'%가 가려져요.':'최대식 때 태양이 지평선 아래에 있어요. 일부 진행 단계만 볼 수 있습니다.';
    return '<div><p class="eclipse-date">'+esc(dateText(ref))+'</p><h3 class="eclipse-title">'+esc(e.name)+'</h3><p class="eclipse-copy">'+amount+'</p><p class="eclipse-copy">'+esc(location().name)+' 기준 · 태양 관측용 안전 장비 필요</p></div><dl class="contact-list">'+contact('부분식 시작',e.begin)+contact('개기·금환 시작',e.totalBegin)+contact('최대식',e.peak)+contact('개기·금환 끝',e.totalEnd)+contact('부분식 끝',e.end)+'</dl>';
  }
  function lunarHTML(e){
    if(!e)return '<p class="small">계산 범위에서 이 관측지의 다음 월식을 찾지 못했어요.</p>';
    const ref=C.dateKey(e.peak.time),ranges=e.visible.filter(v=>+new Date(v.end)>=+C.dateStart(state.date)).map(v=>clock(v.start,ref)+'–'+clock(v.end,ref)).join(' / ');
    return '<div><p class="eclipse-date">'+esc(dateText(ref))+'</p><h3 class="eclipse-title">'+esc(e.name)+'</h3><p class="eclipse-copy">'+esc(e.localStage)+'</p><p class="eclipse-copy">달이 떠 있는 진행 구간 · '+esc(ranges)+'</p></div><dl class="contact-list"><dt>반영식 시작</dt><dd>'+esc(clock(e.begin,ref))+'</dd>'+(e.partialBegin?'<dt>부분식 시작</dt><dd>'+esc(clock(e.partialBegin,ref))+'</dd>':'')+(e.totalBegin?'<dt>개기 단계</dt><dd>'+esc(clock(e.totalBegin,ref))+'–'+esc(clock(e.totalEnd,ref))+'</dd>':'')+'<dt>최대식</dt><dd>'+esc(clock(e.peak.time,ref))+(e.peak.alt<0?' · 지평선 아래':'')+'</dd><dt>반영식 끝</dt><dd>'+esc(clock(e.end,ref))+'</dd></dl>';
  }
  function eventTime(event){return (event.approx?'약 ':'')+clock(event.time,event.date)+(event.forecast?' 예상':'');}
  function renderUpcoming(){if(!state.daily)return;const events=state.events.filter(e=>+new Date(e.time)>=+new Date(state.daily.time)).slice(0,4);$('upcoming').innerHTML=events.map(e=>'<button class="event-card" type="button" data-event-date="'+e.date+'"><time datetime="'+e.date+'">'+esc(shortDate.format(new Date(e.time)))+'</time><strong>'+esc(e.title)+'</strong><small>'+esc(eventTime(e))+'</small></button>').join('');$('upcoming').querySelectorAll('[data-event-date]').forEach(b=>b.addEventListener('click',()=>selectCalendarDate(b.dataset.eventDate)));}
  let refreshVersion=0,calendarVersion=0,extraVersion=0,lastExtraKey='';
  async function loadExtras(){
    const key=state.date+':'+JSON.stringify(location());if(key===lastExtraKey)return;lastExtraKey=key;const v=++extraVersion;
    $('solar-eclipse').innerHTML='<p class="small">관측지에서 보이는 다음 일식을 찾고 있어요.</p>';$('lunar-eclipse').innerHTML='<p class="small">달이 떠 있는 시간과 겹치는 월식을 찾고 있어요.</p>';
    const results=await Promise.allSettled([calculate('nextEclipses',state.date,location()),calculate('upcoming',state.date,location())]);
    if(v!==extraVersion)return;
    if(results[0].status==='fulfilled'){$('solar-eclipse').innerHTML=solarHTML(results[0].value.solar);$('lunar-eclipse').innerHTML=lunarHTML(results[0].value.lunar);}else{$('solar-eclipse').textContent='일식 정보를 계산하지 못했어요. 날짜나 관측지를 다시 골라 주세요.';$('lunar-eclipse').textContent='월식 정보를 계산하지 못했어요.';lastExtraKey='';}
    if(results[1].status==='fulfilled'){state.events=results[1].value;renderUpcoming();}else $('upcoming').innerHTML='<p class="small">천문력을 다시 열어 확인해 주세요.</p>';
  }
  async function renderCalendar(){
    const v=++calendarVersion,key=state.date,loc=location();$('month-heading').textContent=Number(key.slice(0,4))+'년 '+Number(key.slice(5,7))+'월';$('selected-date').textContent=dateText(key);
    try{
      const [month,detail]=await Promise.all([calculate('calendar',key,loc),calculate('daily',key,'21:00',loc)]);if(v!==calendarVersion)return;state.calendar=month;
      const week=['일','월','화','수','목','금','토'],firstWeekday=new Date(+C.dateStart(month.days[0].date)+C.constants.KST).getUTCDay();
      let html=week.map(w=>'<div class="weekday">'+w+'</div>').join('')+'<span aria-hidden="true"></span>'.repeat(firstWeekday);
      month.days.forEach(d=>{const events=month.events.filter(e=>e.date===d.date);html+='<button class="calendar-day" type="button" data-date="'+d.date+'" data-today="'+(d.date===C.dateKey(new Date()))+'" aria-pressed="'+(d.date===key)+'" aria-label="'+d.day+'일'+(events.length?' · '+esc(events.map(e=>e.title).join(', ')):'')+'"><span>'+d.day+'</span>'+moonSVG(d,'',true)+(events.length?'<span class="event-dot" aria-hidden="true"></span>':'')+'</button>';});
      $('calendar').innerHTML=html;$('calendar').querySelectorAll('[data-date]').forEach(b=>b.addEventListener('click',()=>selectCalendarDate(b.dataset.date)));
      $('selected-phase').textContent=detail.moon.name;$('selected-moon-info').textContent='21시 기준 · 월령 '+detail.moon.age.toFixed(1)+'일 · 밝게 보이는 면 '+(detail.moon.fraction*100).toFixed(1)+'%';
      $('selected-times').innerHTML=[['sunrise','일출'],['sunset','일몰'],['moonrise','월출'],['moonset','월몰']].map(([k,label])=>'<div><span>'+label+'</span><strong>'+esc(clock(detail.times[k],key))+'</strong></div>').join('');
      const selected=month.events.filter(e=>e.date===key);
      $('selected-events').innerHTML=selected.map(e=>'<div class="selected-event"><strong>'+esc(e.title)+'</strong><time>'+esc(eventTime(e))+'</time><p>'+esc(e.detail)+'</p>'+(e.eclipse&&e.type==='solar'?'<p>최대식 때 태양 고도 '+e.eclipse.peak.alt.toFixed(1)+'°</p>':'')+(e.eclipse&&e.type==='lunar'?'<p>달이 떠 있는 구간: '+esc(e.eclipse.visible.map(x=>clock(x.start,key)+'–'+clock(x.end,key)).join(' / '))+'</p>':'')+'</div>').join('')||'<p class="small">이날 등록된 주요 현상은 없어요. 해와 달의 시각을 확인해 관측을 준비해 보세요.</p>';
      $('month-events').innerHTML=month.events.map(e=>'<div class="event-row"><time>'+esc(shortDate.format(new Date(e.time)))+'</time><button type="button" data-event-date="'+e.date+'">'+esc(e.title)+'</button><span class="event-time">'+esc(eventTime(e))+'</span></div>').join('')||'<p class="small">이달에 표시할 주요 천문현상이 없어요.</p>';
      $('month-events').querySelectorAll('[data-event-date]').forEach(b=>b.addEventListener('click',()=>selectCalendarDate(b.dataset.eventDate)));
      $('previous-month').disabled=month.key==='2000-01';$('next-month').disabled=month.key==='2100-12';
    }catch(e){if(v===calendarVersion)showError('천문력을 계산하지 못했어요. '+(e.message||e));}
  }
  async function refresh(){
    if(['telescope','photo'].includes(state.view))return;
    const v=++refreshVersion;showError('');$('loading').textContent='계산 중';
    try{
      C.atTime(state.date,state.clock);C.observer(location());
      $('context').textContent=dateText(state.date)+' · '+location().name+' · '+state.clock+' 기준';$('date').value=state.date;$('time').value=state.clock;
      $('previous-day').disabled=state.date==='2000-01-01';$('next-day').disabled=state.date==='2100-12-31';
      $('panel-day').setAttribute('aria-busy','true');$('panel-night').setAttribute('aria-busy','true');
      const data=await calculate('daily',state.date,state.clock,location());if(v!==refreshVersion)return;
      renderDaily(data);$('loading').textContent='';$('panel-day').setAttribute('aria-busy','false');$('panel-night').setAttribute('aria-busy','false');
      void loadExtras();if(state.view==='calendar')void renderCalendar();
    }catch(e){if(v===refreshVersion){showError(e.message||String(e));$('loading').textContent='';$('panel-day').setAttribute('aria-busy','false');$('panel-night').setAttribute('aria-busy','false');}}
  }
  function setView(view,changeTime=true,writeHash=true){
    if(!tabs.includes(view))return;
    if(changeTime&&['day','night'].includes(view)&&view!==state.view)state.clock=state.times[view];state.view=view;
    tabs.forEach(name=>{const active=name===view;$('tab-'+name).setAttribute('aria-selected',String(active));$('tab-'+name).tabIndex=active?0:-1;$('panel-'+name).hidden=!active;});
    const guide=['telescope','photo'].includes(view);
    $('observation-form').hidden=guide;$('observation-context').hidden=guide;$('calculation-method').hidden=guide;
    $('upcoming-section').hidden=guide||view==='calendar';
    if(writeHash){try{history.replaceState(null,'','#'+view);}catch(_){}}
    if(guide){++refreshVersion;++calendarVersion;showError('');$('loading').textContent='';}else void refresh();
  }
  function selectCalendarDate(key){state.date=key;setView('calendar',false);}
  function changeDate(key){try{C.dateStart(key);state.date=key;void refresh();}catch(e){showError(e.message);$('date').value=state.date;}}
  function changeMonth(delta){try{const base=state.date.split('-').map(Number),d=new Date(Date.UTC(base[0],base[1]-1+delta,1)),year=d.getUTCFullYear(),month=d.getUTCMonth()+1,last=new Date(Date.UTC(year,month,0)).getUTCDate(),key=year+'-'+String(month).padStart(2,'0')+'-'+String(Math.min(base[2],last)).padStart(2,'0');changeDate(key);}catch(e){showError(e.message);}}
  tabs.forEach((view,i)=>{$('tab-'+view).addEventListener('click',()=>setView(view));$('tab-'+view).addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const index=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;setView(tabs[index]);$('tab-'+tabs[index]).focus();});});
  document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view)));
  window.addEventListener('hashchange',()=>{
    const view=hashView();if(view)setView(view,true,false);
    const anchor=window.location.hash.slice(1),target=$(anchor);
    if(/^(scope-|photo-)/.test(anchor)&&target&&typeof target.scrollIntoView==='function')target.scrollIntoView({block:'start'});
  });
  $('observation-form').addEventListener('submit',e=>{e.preventDefault();void refresh();});
  $('date').addEventListener('change',e=>changeDate(e.target.value));$('time').addEventListener('change',e=>{try{C.atTime(state.date,e.target.value);state.clock=e.target.value;if(['day','night'].includes(state.view))state.times[state.view]=state.clock;void refresh();}catch(err){showError(err.message);$('time').value=state.clock;}});
  $('previous-day').addEventListener('click',()=>changeDate(C.shiftDate(state.date,-1)));$('next-day').addEventListener('click',()=>changeDate(C.shiftDate(state.date,1)));
  $('previous-month').addEventListener('click',()=>changeMonth(-1));$('next-month').addEventListener('click',()=>changeMonth(1));
  $('now').addEventListener('click',()=>{const n=new Date();state.date=C.dateKey(n);state.clock=hhmm(n);const view=C.position('Sun',n,C.observer(location())).alt>=0?'day':'night';state.times[view]=state.clock;setView(view,false);});
  $('location').value=initialLocation;$('custom-location').hidden=initialLocation!=='custom';$('latitude').value=custom.lat;$('longitude').value=custom.lon;$('height').value=custom.height||0;
  $('location').addEventListener('change',e=>{state.locationKey=e.target.value;$('custom-location').hidden=state.locationKey!=='custom';rememberLocation();void refresh();});
  $('apply-location').addEventListener('click',()=>{const custom={name:'직접 입력',lat:Number($('latitude').value),lon:Number($('longitude').value),height:Number($('height').value)};try{if(!$('latitude').value||!$('longitude').value)throw Error('위도와 경도를 입력해 주세요.');C.observer(custom);state.custom=custom;state.locationKey='custom';rememberLocation();void refresh();}catch(e){showError(e.message);}});
  $('geolocate').addEventListener('click',()=>{if(!navigator.geolocation){showError('이 브라우저에서는 현재 위치를 가져올 수 없어요. 관측지를 직접 골라 주세요.');return;}$('geolocate').disabled=true;$('geolocate').textContent='확인 중';navigator.geolocation.getCurrentPosition(result=>{state.custom={name:'내 위치',lat:Number(result.coords.latitude.toFixed(5)),lon:Number(result.coords.longitude.toFixed(5)),height:0};state.locationKey='custom';$('location').value='custom';$('custom-location').hidden=false;$('latitude').value=state.custom.lat;$('longitude').value=state.custom.lon;$('height').value=0;rememberLocation();$('geolocate').disabled=false;$('geolocate').textContent='내 위치';void refresh();},()=>{$('geolocate').disabled=false;$('geolocate').textContent='내 위치';showError('현재 위치를 가져오지 못했어요. 관측지를 직접 선택하거나 좌표를 입력해 주세요.');},{enableHighAccuracy:false,timeout:10000,maximumAge:300000});});
  $('show-calendar').addEventListener('click',()=>setView('calendar'));
  $('open-selected-date').addEventListener('click',()=>setView(C.position('Sun',C.atTime(state.date,state.clock),C.observer(location())).alt>=0?'day':'night',false));
  setView(initialView,false,false);
})();
