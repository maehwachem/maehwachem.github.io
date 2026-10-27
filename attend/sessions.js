"use strict";
(() => {
  const SESSION_STATE = {open:"출석 접수",closed:"마감",cancelled:"휴강"};
  const ATTEMPT = {overlap:"시간이 겹치는 수업에도 출석함",after_manual:"교사 정정 후 재태그 · 기존 상태 유지",not_enrolled:"대상 제외 후 태그",movement_out:"외출 중 태그",movement_early:"조퇴 후 태그",daily_confirmed:"등교 결석·인정 상태 태그",session_closed:"접수시간 외 태그",not_school_day:"휴업일 태그",need_location:"위치 확인 실패",too_far:"학교 밖 태그",geo_not_configured:"위치 설정 필요"};
  let templates=[], sessions=[], detail=null, sequence=0;
  const shortTime = x => seoulTime(x).slice(0,5);
  const enabled = () => $("sContent").getAttribute("aria-busy") !== "true";
  async function loadClassDashboard() {
    const seq=++sequence, date=$("sDate").value;
    $("sContent").setAttribute("aria-busy","true");
    $("sMessage").textContent="수업을 불러오는 중입니다…";
    if (!date) { $("sContent").setAttribute("aria-busy","false"); $("sContent").classList.add("hidden"); $("sMessage").textContent="날짜를 선택하세요."; return; }
    try {
      const [list, defs]=await Promise.all([rpc("nfc_session_day",{p_date:date}),rpc("nfc_class_list",{p_year:yearOf(date)})]);
      if(seq!==sequence)return;
      sessions=list;templates=defs;
      const id=detail?.session.att_date===date && sessions.some(s=>s.id===detail.session.id)?detail.session.id:sessions.find(s=>s.state!=="cancelled")?.id||sessions[0]?.id;
      const next=id?await rpc("nfc_session_detail",{p_session:id}):null;
      if(seq!==sequence)return;
      detail=next;render();$("sContent").classList.remove("hidden");$("sMessage").textContent="";$("sUpdated").textContent="갱신 "+seoulTime(new Date().toISOString());
    } catch(e) {
      if(seq!==sequence)return;
      detail=null;$("sContent").classList.add("hidden");$("sMessage").textContent="불러오지 못했습니다. 새로고침으로 다시 시도하세요.";throw e;
    } finally {if(seq===sequence)$("sContent").setAttribute("aria-busy","false");}
  }
  window.loadClassDashboard=loadClassDashboard;
  function render() {
    $("sCards").innerHTML=sessions.map(s=>`<button class="session-card" data-session="${esc(s.id)}" aria-pressed="${detail?.session.id===s.id}"><strong>${esc(s.period_label)} ${esc(s.title)}</strong><small>${shortTime(s.opens_at)} ~ ${shortTime(s.closes_at)} · ${SESSION_STATE[s.state]}</small><span>대상 ${s.counts.total} · 출석 ${s.counts.present} · 지각 ${s.counts.late} · 미확인 ${s.counts.unconfirmed}</span>${s.overlap_count?`<small class="error">시간이 겹치는 수강생 ${s.overlap_count}명 · 명단 확인</small>`:""}</button>`).join("")||'<div class="card"><p>이 날짜에 준비된 수업이 없습니다.</p><p class="sub">반복 시간표를 등록하거나 이 날짜만 수업을 추가하세요. 오늘 시간표도 수강생의 재적 기간·요일·출석 대상일이 맞아야 생성됩니다.</p></div>';
    $("sTemplateList").innerHTML=templates.map(t=>`<div class="session-student" style="margin-top:10px"><div><strong>${esc(t.period_label)} ${esc(t.title)}</strong><span class="sub">${t.weekdays.map(d=>["","월","화","수","목","금","토","일"][d]).join("·")} · ${t.opens.slice(0,5)}~${t.closes.slice(0,5)} · ${t.members.length}명 · ${t.enabled?"사용 중":"중지"}<br>${esc(t.valid_from)} ~ ${esc(t.valid_to)}</span></div><div class="row"><button class="btn s" data-template="${t.id}" data-mode="edit">수정</button><button class="btn s" data-template="${t.id}" data-mode="copy">복사</button>${t.enabled?`<button class="btn s" data-template="${t.id}" data-mode="pause">중지</button>`:""}</div></div>`).join("")||'<p class="sub">등록된 반복 시간표가 없습니다.</p>';
    renderDetail();
  }
  function renderDetail(){
    $("sDetail").classList.toggle("hidden",!detail);if(!detail)return;
    const s=detail.session;
    $("sTitle").textContent=`${s.period_label} ${s.title} · ${SESSION_STATE[s.state]}`;
    $("sInfo").textContent=`${s.att_date} · 접수 ${shortTime(s.opens_at)} · 지각 시작 ${shortTime(s.late_at)} · 마감 ${shortTime(s.closes_at)}${s.allow_non_school_day?" · 휴업일 수업 허용":""}`;
    const term=$("sSearch").value.trim(),filter=$("sFilter").value;
    const rows=detail.rows.filter(r=>(filter==="removed"?!r.enrolled:r.enrolled&&(!filter||r.status===filter))&&(!term||r.name.includes(term)||r.student_id.includes(term)));
    const n=detail.rows.filter(r=>r.enrolled).length,missing=detail.rows.filter(r=>r.enrolled&&r.status==="unconfirmed").length;
    $("sCount").textContent=`대상 ${n}명 · 미확인 ${missing}명 · 목록 ${rows.length}명${s.state==="cancelled"?" · 휴강 회차는 집계에서 제외하여 해석하세요":""}`;
    $("sRows").innerHTML=rows.map(r=>`<div class="session-student"><div><strong>${esc(r.student_id)} · ${esc(r.name)}</strong> <span class="tag t-${r.status}">${STATUS[r.status]}</span>${!r.enrolled?'<span class="tag">대상 제외</span>':""}<span class="sub">첫 태그 ${esc(shortTime(r.first_tag_at)||"—")}${r.corrected_at?` · 교사 확인 ${shortTime(r.corrected_at)}`:""}<br>등교 ${STATUS[r.daily_status]||"미확인"} · ${r.whereabouts==="out"?"외출 중":r.whereabouts==="early"?"조퇴":"이동 없음"}${r.movement_time?" "+shortTime(r.movement_time):""}</span>${r.overlap_attendance?'<span class="sub error">시간이 겹치는 다른 수업에도 출석·지각 기록이 있습니다.</span>':""}${r.roster_warning?'<span class="sub error">현재 재적 기간·출석 대상일과 다릅니다. 명단을 확인하세요.</span>':""}${r.last_attempt?`<span class="sub error">${esc(ATTEMPT[r.last_attempt.result]||r.last_attempt.result)} · ${shortTime(r.last_attempt.at)}</span>`:""}</div><div class="row"><button class="btn s" data-uid="${r.student_uid}" data-act="correct" ${!r.enrolled||s.state==="cancelled"?"disabled":""}>교사 확인</button><button class="btn s" data-uid="${r.student_uid}" data-act="member" ${s.state==="cancelled"?"disabled":""}>${r.enrolled?"대상 제외":"대상 복원"}</button><button class="btn s" data-uid="${r.student_uid}" data-act="history">이력</button></div></div>`).join("")||'<p class="sub">해당 학생이 없습니다.</p>';
  }
  bind("sRefresh",loadClassDashboard);bind("sToday",async()=>{$("sDate").value=seoulDate();detail=null;await loadClassDashboard();});
  $("sDate").onchange=()=>{detail=null;run(null,loadClassDashboard);};
  $("sSearch").oninput=renderDetail;$("sFilter").onchange=renderDetail;
  $("sCards").onclick=e=>{const b=e.target.closest("button[data-session]");if(!b||!enabled())return;run(b,async()=>{
    const seq=++sequence;$("sContent").setAttribute("aria-busy","true");try{const next=await rpc("nfc_session_detail",{p_session:b.dataset.session});if(seq!==sequence)return;detail=next;$("sFilter").value="";$("sSearch").value="";render();$("sDetail").focus();}finally{if(seq===sequence)$("sContent").setAttribute("aria-busy","false");}
  });};
  const reasonField=()=>field("사유",'<textarea id="xClassReason" required maxlength="200" placeholder="예: 휴대폰 미지참으로 교사가 확인"></textarea>');
  function checkedDetail(){if(!detail||!enabled())throw Error("수업을 다시 선택하세요");return detail;}
  async function showHistory(uid=null){const d=checkedDetail();const records=await rpc("nfc_session_history",{p_session:d.session.id,p_uid:uid});openEditor("수업 처리 이력",records.map(r=>`<div class="history"><b>${esc(seoulDate(new Date(r.created_at)))} ${shortTime(r.created_at)}</b> · ${esc({correction:"출석 정정",check_in:"수업 태그",member:"명단 조정",state:"마감·휴강 변경",session:"회차 설정",generated:"자동 생성"}[r.action]||r.action)}<br>${esc(r.reason)}${r.action==="correction"?`<br>${STATUS[r.before_value?.status]||"미확인"} → ${STATUS[r.after_value?.status]||""}`:""}</div><hr>`).join("")||"<p>처리 이력이 없습니다.</p>",null);}
  bind("sHistory",()=>showHistory());
  $("sRows").onclick=e=>{const b=e.target.closest("button[data-act]");if(!b||b.disabled||!enabled())return;run(b,async()=>{
    const d=checkedDetail(),s=d.session,r=d.rows.find(x=>x.student_uid===b.dataset.uid);if(!r)return;
    if(b.dataset.act==="history")return showHistory(r.student_uid);
    if(b.dataset.act==="member"){
      openEditor(`${r.name} · ${r.enrolled?"대상 제외":"대상 복원"}`,`<p class="sub">이 회차에만 적용됩니다. 기존 기록과 이력은 보존되고, 복원하면 기존 출석 상태도 다시 집계됩니다.</p>`+reasonField(),async()=>{await rpc("nfc_session_member",{p_session:s.id,p_uid:r.student_uid,p_enrolled:!r.enrolled,p_revision:s.revision,p_reason:$("xClassReason").value.trim()});await loadClassDashboard();});return;
    }
    openEditor(`${r.name} · ${s.period_label} ${s.title}`,field("수업 출석 상태",`<select id="xClassStatus">${Object.entries(STATUS).map(([k,v])=>`<option value="${k}" ${(r.status==="unconfirmed"?"present":r.status)===k?"selected":""}>${v}</option>`).join("")}</select>`)+reasonField()+`<p class="sub">등교 기록은 바뀌지 않습니다. 지각한 학생은 지각을 선택하세요. 첫 태그 시각은 보존되며 교사 확인 시각이 별도로 남습니다.</p>`,async()=>{
      await rpc("nfc_session_correct",{p_session:s.id,p_uid:r.student_uid,p_status:$("xClassStatus").value,p_reason:$("xClassReason").value.trim(),p_version:r.version,p_revision:s.revision});await loadClassDashboard();toast("수업 출석을 저장했습니다");
    });
  });};
  bind("sState",async()=>{const s=checkedDetail().session;openEditor(`${s.title} · 마감·휴강`,field("회차 상태",`<select id="xClassState">${Object.entries(SESSION_STATE).map(([k,v])=>`<option value="${k}" ${k===s.state?"selected":""}>${v}</option>`).join("")}</select>`)+reasonField()+'<p class="sub">마감·휴강해도 미확인은 결석으로 바뀌지 않습니다. 접수를 다시 열어도 설정한 시간 안에서만 학생이 확인할 수 있습니다.</p>',async()=>{await rpc("nfc_session_state",{p_session:s.id,p_state:$("xClassState").value,p_revision:s.revision,p_reason:$("xClassReason").value.trim()});await loadClassDashboard();});});
  bind("sAddMember",async()=>{const d=checkedDetail(),s=d.session;const roster=await rpc("nfc_roster",{p_year:yearOf(s.att_date)});const options=roster.filter(r=>!['pending','rejected'].includes(r.state)&&r.starts_on<=s.att_date&&r.ends_on>=s.att_date&&!d.rows.some(x=>x.student_uid===r.student_uid&&x.enrolled));
    if(!options.length){toast("추가할 수 있는 학생이 없습니다. 학생 명단을 먼저 확인하세요.");return;}
    openEditor("이 회차 학생 추가",field("학생",`<select id="xAddUid">${options.map(r=>`<option value="${r.student_uid}">${esc(r.student_id)} ${esc(r.name)}</option>`).join("")}</select>`)+reasonField()+'<p class="sub">반복 시간표의 수강생은 바뀌지 않습니다. 제외했던 학생을 다시 넣으면 기존 상태가 복원됩니다.</p>',async()=>{await rpc("nfc_session_member",{p_session:s.id,p_uid:$("xAddUid").value,p_enrolled:true,p_revision:s.revision,p_reason:$("xClassReason").value.trim()});await loadClassDashboard();});
  });
  function timingFields(item={}){return field("수업·확인 이름",`<input id="xClassTitle" required maxlength="80" value="${esc(item.title)}" placeholder="예: 화학, 점심 후 확인, 자율학습">`)+field("교시·회차 표시",`<input id="xPeriod" maxlength="40" value="${esc(item.period_label)}" placeholder="예: 1교시, 오후 1차">`)+field("출석 접수 시작",`<input type="time" id="xOpens" required value="${esc(item.opens?.slice(0,5)||"08:50")}">`)+field("지각 시작 (이 시각부터 지각)",`<input type="time" id="xLate" required value="${esc(item.late?.slice(0,5)||"09:00")}">`)+field("출석 접수 마감 (이 시각부터 접수 불가)",`<input type="time" id="xCloses" required value="${esc(item.closes?.slice(0,5)||"09:50")}">`);}
  const timingData=()=>({title:$("xClassTitle").value.trim(),period_label:$("xPeriod").value.trim(),opens:$("xOpens").value,late:$("xLate").value,closes:$("xCloses").value});
  function validateTiming(){const t=timingData();if(!(t.opens<=t.late&&t.late<t.closes))throw Error("접수 시작 ≤ 지각 시작 < 접수 마감 순서로 설정하세요.");return t;}
  async function openScheduleEditor(template=null,copy=false,extra=false){
    const date=$("sDate").value; if(!date)throw Error("날짜를 먼저 선택하세요."); const year=yearOf(date),roster=(await rpc("nfc_roster",{p_year:year})).filter(r=>!['pending','rejected'].includes(r.state));
    if(!roster.length){toast("학생 명단에 승인된 학생을 먼저 등록하세요.");return;}
    const members=new Map((template?.members||[]).map(m=>[m.student_uid,m]));
    const id=template&&!copy?template.id:crypto.randomUUID();
    const from=template?.valid_from||date,to=template?.valid_to||`${year+1}-02-${(year+1)%4===0?'29':'28'}`;
    const classes=[...new Set(roster.map(classKey))].sort();
    const picker=`<div class="field"><strong>수강생 선택</strong><div class="row" style="margin:8px 0"><select id="xMemberClass" aria-label="수강생 반"><option value="">전체 반</option>${classes.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join("")}</select><button class="btn s" type="button" id="xSelectClass">이 반 선택</button><button class="btn s" type="button" id="xClearMembers">선택 해제</button></div><input id="xMemberSearch" placeholder="수강생 이름·학번 검색" aria-label="수강생 검색"><p id="xSelectedCount" class="sub"></p><div class="member-picker" id="xMembers">${roster.map(r=>{const m=members.get(r.student_uid);return `<div data-member="${r.student_uid}" data-class="${esc(classKey(r))}" data-name="${esc(r.name+' '+r.student_id)}"><label><input type="checkbox" value="${r.student_uid}" ${m?'checked':''}><span>${esc(r.student_id)} ${esc(r.name)}</span></label>${!extra?`<div class="row" style="padding:0 8px 8px"><input type="date" data-from value="${esc(m?.valid_from||from)}" aria-label="${esc(r.name)} 수강 시작일"><span>~</span><input type="date" data-to value="${esc(m?.valid_to||to)}" aria-label="${esc(r.name)} 수강 종료일"></div>`:''}</div>`;}).join('')}</div>${!extra?'<button class="btn s" type="button" id="xMatchDates" style="margin-top:8px">선택 학생 기간을 시간표 기간에 맞추기</button>':''}<p class="sub">반 선택은 현재 명단의 학생을 선택합니다. 전입생·수강 변경은 자동 추가되지 않으므로 명단을 다시 확인하세요.</p></div>`;
    const dates=extra?`<p class="notice">${esc(date)}에만 만드는 회차입니다. 반복 시간표에는 추가되지 않습니다.</p><label><input id="xHoliday" type="checkbox" style="width:auto"> 휴업일에도 수업 출석 허용</label>`:field("시간표 적용 시작",`<input type="date" id="xValidFrom" required value="${esc(from)}">`)+field("시간표 적용 종료",`<input type="date" id="xValidTo" required value="${esc(to)}">`)+`<div class="field"><strong>반복 요일</strong><div class="weekday-picker">${[1,2,3,4,5,6,7].map(d=>`<label><input type="checkbox" name="classDay" value="${d}" ${(template?.weekdays||[1,2,3,4,5]).includes(d)?'checked':''}>${['','월','화','수','목','금','토','일'][d]}</label>`).join('')}</div></div>`+field("사용 여부",`<select id="xClassEnabled"><option value="true">사용</option><option value="false" ${template?.enabled===false?'selected':''}>중지</option></select>`);
    openEditor(extra?"이 날짜만 수업 추가":copy?"시간표 복사":"반복 시간표 설정",timingFields(template||{})+dates+picker+reasonField(),async()=>{
      const timing=validateTiming();const selected=[...$("xMembers").querySelectorAll('input[type=checkbox]:checked')].map(c=>c.closest('[data-member]'));
      if(!selected.length)throw Error("수강생을 1명 이상 선택하세요.");
      const reason=$("xClassReason").value.trim();
      if(extra)await rpc("nfc_session_save",{p_data:{id,att_date:date,...timing,students:selected.map(e=>e.dataset.member),allow_non_school_day:$("xHoliday").checked},p_revision:0,p_reason:reason});
      else {
        const weekdays=[...document.querySelectorAll('input[name=classDay]:checked')].map(c=>Number(c.value));if(!weekdays.length)throw Error("요일을 선택하세요.");
        await rpc("nfc_class_save",{p_data:{id,school_year:year,...timing,weekdays,valid_from:$("xValidFrom").value,valid_to:$("xValidTo").value,enabled:$("xClassEnabled").value==='true',members:selected.map(e=>({student_uid:e.dataset.member,valid_from:e.querySelector('[data-from]').value,valid_to:e.querySelector('[data-to]').value}))},p_revision:template&&!copy?template.revision:0,p_reason:reason});
      }
      await loadClassDashboard();toast(extra?"이 날짜의 수업을 만들었습니다":"시간표를 저장했습니다. 이미 생성된 회차는 그대로 보존됩니다.");
    });
    function showMemberCount(){$("xSelectedCount").textContent=`${$("xMembers").querySelectorAll('input[type=checkbox]:checked').length}명 선택${template&&template.members.some(m=>!roster.some(r=>r.student_uid===m.student_uid))?' · 현재 승인 명단에 없는 기존 수강생은 저장 시 제외됩니다.':''}`;}
    $("xMembers").onchange=showMemberCount;showMemberCount();
    $("xSelectClass").onclick=()=>{const cls=$("xMemberClass").value;$("xMembers").querySelectorAll('[data-member]').forEach(e=>{if(!cls||e.dataset.class===cls)e.querySelector('input[type=checkbox]').checked=true;});showMemberCount();};
    $("xClearMembers").onclick=()=>{$("xMembers").querySelectorAll('input[type=checkbox]').forEach(e=>e.checked=false);showMemberCount();};
    $("xMemberSearch").oninput=()=>{const q=$("xMemberSearch").value.trim();$("xMembers").querySelectorAll('[data-member]').forEach(e=>e.classList.toggle('hidden',q&&!e.dataset.name.includes(q)));};
    if(!extra)$("xMatchDates").onclick=()=>{$("xMembers").querySelectorAll('input[type=checkbox]:checked').forEach(c=>{const e=c.closest('[data-member]');e.querySelector('[data-from]').value=$("xValidFrom").value;e.querySelector('[data-to]').value=$("xValidTo").value;});};
  }
  bind("sNewTemplate",()=>openScheduleEditor());bind("sExtra",()=>openScheduleEditor(null,false,true));
  $("sTemplateList").onclick=e=>{const b=e.target.closest('button[data-template]');if(b&&enabled())run(b,()=>{const t=templates.find(t=>t.id===b.dataset.template);if(b.dataset.mode==='pause'){openEditor(`${t.title} · 반복 중지`,'<p class="sub">새 회차의 자동 생성을 중지합니다. 이미 생성된 회차와 명단·출석 기록은 보존됩니다. 오늘 수업도 취소하려면 해당 회차에서 휴강 처리하세요.</p>'+reasonField(),async()=>{await rpc('nfc_class_pause',{p_template:t.id,p_revision:t.revision,p_reason:$("xClassReason").value.trim()});await loadClassDashboard();});return;}return openScheduleEditor(t,b.dataset.mode==='copy');});};
  bind("sEdit",async()=>{const s=checkedDetail().session;openEditor("이 회차 설정",timingFields({...s,opens:shortTime(s.opens_at),late:shortTime(s.late_at),closes:shortTime(s.closes_at)})+reasonField()+'<p class="sub">이 날짜에만 적용합니다. 출석 처리된 학생이 있으면 시간은 변경할 수 없습니다. 반복 시간표와 지난 기록은 바뀌지 않습니다.</p>',async()=>{await rpc("nfc_session_save",{p_data:{id:s.id,att_date:s.att_date,...validateTiming()},p_revision:s.revision,p_reason:$("xClassReason").value.trim()});await loadClassDashboard();});});
  bind("sExport",async()=>{const from=$("sFrom").value,to=$("sTo").value;const rows=await rpc("nfc_session_report",{p_from:from,p_to:to});downloadCSV(`수업출석_${from}_${to}.csv`,[["날짜","수업","교시","회차 상태","학번","이름","대상 여부","수업 출석","첫 태그","교사 확인","처리 방식","사유","회차 식별자","학생 식별자"],...rows.map(r=>[r.att_date,r.title,r.period_label,SESSION_STATE[r.session_state],r.student_id,r.name,r.enrolled?"대상":"제외",STATUS[r.status],seoulTime(r.first_tag_at),seoulTime(r.corrected_at),r.source||"",r.note||"",r.session_id,r.student_uid])]);});
})();
