"use strict";
const CFG = window.ATTEND_CONFIG;
const sb = supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY);
const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const seoulDate = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(d);
const seoulTime = (iso) =>
  iso
    ? new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(new Date(iso))
    : "";
const yearOf = (d) =>
  Number(d.slice(0, 4)) - (Number(d.slice(5, 7)) < 3 ? 1 : 0);
const STATUS = {
  present: "출석",
  late: "지각",
  excused: "인정",
  absent: "결석 확정",
  unconfirmed: "미확인",
};
const STATE = {
  active: "재적",
  pending: "승인 대기",
  inactive: "비활성",
  transferred: "전출",
  graduated: "졸업",
};
const MOVE = {
  out: "외출",
  return: "복귀",
  early: "조퇴",
  void: "직전 이동 취소",
};
let students = [],
  dayRows = [],
  refreshTimer,
  schoolName = "",
  preview = null,
  editSubmit = null,
  loadSequence = 0;
const classKey = (s) =>
  s.grade && s.class_no ? `${s.grade}-${s.class_no}` : "기타";
const seat = (s) => (s.class_no ? `${s.class_no}-${s.number ?? ""}` : "");
function toast(m) {
  $("toast").textContent = m;
  $("toast").classList.add("on");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("toast").classList.remove("on"), 5000);
}
function newCode() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(a[0] % 1000000).padStart(6, "0");
}
async function rpc(name, args) {
  const { data, error } = await sb.rpc(name, args);
  if (error) throw new Error(error.message);
  if (data?.ok === false) throw new Error(data.message || data.error);
  return data;
}
async function run(button, fn) {
  if (button) button.disabled = true;
  try {
    return await fn();
  } catch (e) {
    toast(e.message || "처리에 실패했습니다");
  } finally {
    if (button) button.disabled = false;
  }
}
function bind(id, fn) {
  $(id).onclick = () => run($(id), fn);
}
function matches(s, cls, q) {
  return (
    (!cls || classKey(s) === cls) &&
    (!q || s.name.includes(q) || s.student_id.includes(q))
  );
}
function fillClasses(id, list) {
  const v = $(id).value;
  const keys = [...new Set(list.map(classKey))].sort();
  $(id).innerHTML =
    '<option value="">전체 반</option>' +
    keys
      .map(
        (k) =>
          `<option value="${esc(k)}">${esc(k === "기타" ? k : k.replace("-", "학년 ") + "반")}</option>`,
      )
      .join("");
  if (keys.includes(v)) $(id).value = v;
}
async function fetchAll(factory) {
  const out = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await factory().range(i, i + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) return out;
  }
}
async function enterApp() {
  if (!(await rpc("claim_first_teacher")))
    throw new Error("교사로 등록된 계정이 아닙니다");
  $("login").classList.add("hidden");
  ["app", "nav", "btnLogout"].forEach((x) => $(x).classList.remove("hidden"));
  const today = seoulDate();
  $("dDate").value = today;
  $("eFrom").value = today.slice(0, 8) + "01";
  $("eTo").value = today;
  $("rYear").value = yearOf(today);
  $("cFrom").value = today;
  $("cTo").value = today;
  await Promise.all([loadStudents(), loadToday()]);
  startAutoRefresh();
}
bind("btnLogin", async () => {
  const { error } = await sb.auth.signInWithPassword({
    email: $("lEmail").value.trim(),
    password: $("lPw").value,
  });
  if (error) throw new Error("이메일 또는 비밀번호를 확인하세요");
  await enterApp();
  $("lPw").value = "";
});
$("lPw").onkeydown = (e) => {
  if (e.key === "Enter") $("btnLogin").click();
};
bind("btnLogout", async () => {
  await sb.auth.signOut();
  location.reload();
});
sb.auth.getSession().then(({ data }) => {
  if (data.session) run(null, enterApp);
});
document.querySelectorAll("#nav button").forEach(
  (b) =>
    (b.onclick = () =>
      run(b, async () => {
        document
          .querySelectorAll("#nav button")
          .forEach((x) => x.classList.toggle("on", x === b));
        ["today", "roster", "calendar", "settings"].forEach((t) =>
          $("tab-" + t).classList.toggle("hidden", t !== b.dataset.tab),
        );
        if (b.dataset.tab === "settings") await loadSettings();
        if (b.dataset.tab === "roster") await loadStudents();
        if (b.dataset.tab === "calendar") await loadCalendar();
      })),
);
async function loadStudents() {
  students = await rpc("nfc_roster", { p_year: Number($("rYear").value) });
  fillClasses("rClass", students);
  renderRoster();
}
async function loadToday() {
  const seq = ++loadSequence,
    date = $("dDate").value;
  const rows = await rpc("nfc_day", { p_date: date });
  if (seq !== loadSequence) return;
  dayRows = rows;
  fillClasses("dClass", rows);
  renderToday();
  $("dUpdated").textContent = "갱신 " + seoulTime(new Date().toISOString());
}
function startAutoRefresh() {
  clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    if (
      !document.hidden &&
      !$("editor").open &&
      !$("tab-today").classList.contains("hidden") &&
      $("dDate").value === seoulDate()
    )
      run(null, loadToday);
  }, 20000);
}
function renderToday() {
  const candidates = dayRows.filter((s) =>
    matches(s, $("dClass").value, $("dSearch").value.trim()),
  );
  const list = candidates.filter((s) => s.eligible || s.version > 0);
  const eligible = list.filter((s) => s.eligible);
  const count = (k) => eligible.filter((s) => s.status === k).length;
  const kpis = [
    ["대상", eligible.length],
    ["출석", count("present")],
    ["지각", count("late")],
    ["인정", count("excused")],
    ["결석 확정", count("absent")],
    ["미확인", count("unconfirmed")],
    ["외출 중", list.filter((s) => s.whereabouts === "out").length],
    ["조퇴", list.filter((s) => s.whereabouts === "early").length],
  ];
  $("kpis").innerHTML = kpis
    .map(([l, n]) => `<div class="kpi"><b>${n}</b><span>${l}</span></div>`)
    .join("");
  const f = $("dStatus").value;
  const shown = list.filter(
    (s) =>
      !f ||
      (f === "overdue"
        ? s.overdue
        : f === "out" || f === "early"
          ? s.whereabouts === f
          : s.status === f),
  );
  $("todayBody").innerHTML =
    shown
      .map((s) => {
        const wh =
          s.whereabouts === "out"
            ? `외출 중${s.overdue ? " · 복귀 지연" : ""}<br><small>예정 ${esc(seoulTime(s.expected_return_at))}</small>`
            : s.whereabouts === "early"
              ? "조퇴"
              : ["present", "late"].includes(s.status)
                ? "교내"
                : "—";
        return `<tr><td>${esc(seat(s))}</td><td>${esc(s.student_id)} · <b>${esc(s.name)}</b>${!s.eligible ? "<br><small>대상 외 기록</small>" : ""}${s.last_exception_tag ? '<br><small class="error">재태그 확인 ' + esc(seoulTime(s.last_exception_tag)) + "</small>" : ""}</td><td><span class="tag t-${s.status}">${STATUS[s.status]}</span>${s.source === "manual" ? "<br><small>교사 확인</small>" : ""}</td><td><span class="tag t-${s.whereabouts}">${wh}</span></td><td class="mono">${esc(seoulTime(s.checked_at) || "—")}</td><td><button class="btn s" data-action="correct" data-uid="${s.student_uid}" ${!s.eligible ? "disabled" : ""}>출석 정정</button> <button class="btn s" data-action="move" data-uid="${s.student_uid}" ${!["present", "late"].includes(s.status) ? "disabled" : ""}>이동 처리</button> <button class="btn s" data-action="history" data-uid="${s.student_uid}">이력</button></td></tr>`;
      })
      .join("") ||
    '<tr><td colspan="6" style="padding:24px;text-align:center">해당하는 학생이 없습니다.</td></tr>';
  $("eligibilityNote").textContent =
    `재적 기간·출석 대상일에 해당하지 않는 학생 ${candidates.filter((s) => !s.eligible).length}명은 집계에서 제외됩니다.`;
}
["dClass", "dStatus"].forEach((id) => ($(id).onchange = renderToday));
$("dSearch").oninput = renderToday;
$("dDate").onchange = () => run(null, loadToday);
bind("btnRefresh", loadToday);
function field(label, html) {
  return `<div class="field"><label>${label}${html}</label></div>`;
}
function openEditor(title, fields, submit) {
  $("editTitle").textContent = title;
  $("editFields").innerHTML = fields;
  $("editError").textContent = "";
  $("editSave").classList.toggle("hidden", !submit);
  editSubmit = submit;
  $("editor").showModal();
}
$("editCancel").onclick = () => $("editor").close();
$("editForm").onsubmit = async (e) => {
  e.preventDefault();
  if (!editSubmit) return;
  $("editSave").disabled = true;
  $("editError").textContent = "";
  try {
    await editSubmit();
    $("editor").close();
  } catch (e) {
    $("editError").textContent = e.message;
  } finally {
    $("editSave").disabled = false;
  }
};
$("todayBody").onclick = (e) => {
  const b = e.target.closest("button[data-action]");
  if (!b) return;
  const s = dayRows.find((x) => x.student_uid === b.dataset.uid),
    date = $("dDate").value;
  if (b.dataset.action === "correct")
    openEditor(
      `${s.name} · 출석 정정`,
      field(
        "상태",
        `<select id="xStatus">${Object.entries(STATUS)
          .map(
            ([k, v]) =>
              `<option value="${k}" ${s.status === k ? "selected" : ""}>${v}</option>`,
          )
          .join("")}</select>`,
      ) +
        field(
          "정정 사유",
          '<textarea id="xReason" required maxlength="200" placeholder="예: 휴대폰 미지참으로 교사가 확인"></textarea>',
        ) +
        '<p class="sub">기존 태그 시각은 보존됩니다. 미확인으로 되돌려도 정정 이력은 남습니다.</p>',
      async () => {
        await rpc("nfc_correct", {
          p_uid: s.student_uid,
          p_date: date,
          p_status: $("xStatus").value,
          p_reason: $("xReason").value.trim(),
          p_version: s.version,
        });
        await loadToday();
        toast("정정 이력을 저장했습니다");
      },
    );
  else if (b.dataset.action === "move") {
    const options =
      s.whereabouts === "early"
        ? ["void"]
        : s.whereabouts === "out"
          ? ["return", "early", "void"]
          : ["out", "early", ...(s.effective_movement_id ? ["void"] : [])];
    const request = crypto.randomUUID();
    openEditor(
      `${s.name} · 이동 처리`,
      field(
        "처리",
        `<select id="xKind">${options.map((k) => `<option value="${k}">${MOVE[k]}</option>`).join("")}</select>`,
      ) +
        field(
          "실제 시각",
          `<input type="time" id="xAt" required value="${seoulTime(new Date().toISOString()).slice(0, 5)}">`,
        ) +
        field(
          "복귀 예정 (외출일 때 필수)",
          '<input type="time" id="xExpected">',
        ) +
        field(
          "사유",
          '<textarea id="xReason" required maxlength="200" placeholder="예: 병원 진료"></textarea>',
        ) +
        '<p class="sub">교사가 확인한 이동을 기록합니다. 조퇴는 출석·지각을 덮어쓰지 않습니다. 잘못 누른 이동은 직전 이동 취소로 되돌리세요. 이전 상태로 복원되며 취소 이력이 남습니다.</p>',
      async () => {
        const kind = $("xKind").value;
        await rpc("nfc_move", {
          p_uid: s.student_uid,
          p_date: date,
          p_kind: kind,
          p_at: `${date}T${$("xAt").value}:00+09:00`,
          p_expected:
            kind === "out" && $("xExpected").value
              ? `${date}T${$("xExpected").value}:00+09:00`
              : null,
          p_reason: $("xReason").value.trim(),
          p_previous: s.movement_id,
          p_request: request,
        });
        await loadToday();
        toast("이동 기록을 저장했습니다");
      },
    );
  } else
    run(b, async () => {
      const { data, error } = await sb
        .from("attendance_audit")
        .select("action,before_value,after_value,reason,created_at,actor")
        .eq("student_uid", s.student_uid)
        .eq("att_date", date)
        .order("id", { ascending: false })
        .limit(100);
      if (error) throw error;
      openEditor(
        `${s.name} · ${date} 처리 이력`,
        data
          .map(
            (r) =>
              `<div class="history"><b>${esc(seoulTime(r.created_at))} ${r.action === "movement" ? MOVE[r.after_value.kind] : "출석 정정"}</b><br>${r.action === "movement" ? `${esc(seoulTime(r.after_value.happened_at))} 처리` : `${STATUS[r.before_value?.status] || "미확인"} → ${STATUS[r.after_value?.status] || ""}`}<br>${esc(r.reason)}</div><hr>`,
          )
          .join("") || "<p>교사 처리 이력이 없습니다.</p>",
        null,
      );
    });
};
function csvCell(v) {
  const s = String(v ?? "");
  return (
    '"' + (/^[=+\-@\t\r]/.test(s) ? "'" : "") + s.replace(/"/g, '""') + '"'
  );
}
function downloadCSV(name, rows) {
  const u = URL.createObjectURL(
    new Blob(
      ["\ufeff" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    ),
  );
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
bind("btnExport", async () => {
  const from = $("eFrom").value,
    to = $("eTo").value;
  const rows = await rpc("nfc_report", { p_from: from, p_to: to });
  downloadCSV(`출석_${from}_${to}.csv`, [
    [
      "날짜",
      "학년도",
      "학번",
      "이름",
      "대상일",
      "등교 상태",
      "태그 시각",
      "이동 상태",
      "복귀 예정",
      "복귀 지연",
      "학생 식별자",
    ],
    ...rows.map((r) => [
      r.date,
      r.school_year,
      r.student_id,
      r.name,
      r.eligible ? "대상" : "대상 외",
      STATUS[r.status],
      seoulTime(r.checked_at),
      r.whereabouts === "out"
        ? "외출 중"
        : r.whereabouts === "early"
          ? "조퇴"
          : "",
      seoulTime(r.expected_return_at),
      r.overdue ? "지연" : "",
      r.student_uid,
    ]),
  ]);
});
function rosterList() {
  return students.filter(
    (s) =>
      matches(s, $("rClass").value, $("rSearch").value.trim()) &&
      (!$("rSelfOnly").checked || s.state === "pending"),
  );
}
function renderRoster() {
  const list = rosterList();
  $("rCount").textContent =
    `${list.length}명 · 승인 대기 ${students.filter((s) => s.state === "pending").length}명`;
  $("rosterBody").innerHTML =
    list
      .map(
        (s) =>
          `<tr><td>${esc(s.student_id)} · <b>${esc(s.name)}</b></td><td>${esc(s.starts_on)} ~ ${esc(s.ends_on)}<br>${STATE[s.state]}</td><td class="mono">${esc(s.reg_code)} ${s.failed_attempts >= 5 ? "(잠김)" : ""}</td><td>${s.device_bound_at ? "등록됨" : "미등록"}</td><td><button class="btn s" data-act="edit" data-uid="${s.student_uid}">수정</button> ${s.state === "pending" ? `<button class="btn s p" data-act="confirm" data-uid="${s.student_uid}">명단 확정</button>` : ""} <button class="btn s" data-act="reset" data-uid="${s.student_uid}">기기 초기화</button> <button class="btn s" data-act="code" data-uid="${s.student_uid}">코드 재발급</button></td></tr>`,
      )
      .join("") ||
    '<tr><td colspan="5" style="padding:24px">등록된 명단이 없습니다.</td></tr>';
}
["rClass", "rSelfOnly"].forEach((id) => ($(id).onchange = renderRoster));
$("rSearch").oninput = renderRoster;
bind("btnRosterRefresh", loadStudents);
function previewText(c) {
  const a = c.after,
    b = c.before;
  if (c.type === "missing")
    return `${b.student_id} ${b.name}: 이번 입력에 없음 · 기존 명단 유지`;
  if (c.type === "new")
    return `${a.student_id} ${a.name}: 신규 · ${STATE[a.state]} (${a.starts_on} ~ ${a.ends_on})`;
  return `${b.student_id} ${b.name} → ${a.student_id} ${a.name} · ${STATE[b.state]} → ${STATE[a.state]} · 기간 ${b.starts_on}~${b.ends_on} → ${a.starts_on}~${a.ends_on}`;
}
async function makePreview(rows) {
  preview = await rpc("nfc_roster_preview", {
    p_year: Number($("rYear").value),
    p_rows: rows,
  });
  $("previewBox").classList.remove("hidden");
  $("previewBox").innerHTML =
    '<h3>명단 변경 미리보기</h3><p class="sub">30분 동안 유효합니다. 누락은 유지되며 삭제되지 않습니다.</p>' +
    preview.changes.map((c) => `<p>${esc(previewText(c))}</p>`).join("");
  $("btnApplyRoster").classList.remove("hidden");
}
function invalidatePreview() {
  preview = null;
  $("previewBox").classList.add("hidden");
  $("btnApplyRoster").classList.add("hidden");
}
$("rPaste").oninput = invalidatePreview;
$("rYear").oninput = invalidatePreview;
bind("btnImport", async () => {
  const lines = $("rPaste").value.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) throw new Error("명단을 입력하세요");
  const rows = lines.map((l, i) => {
    const p = l.trim().split(/[\t,]+|\s+/);
    if (p.length < 2 || !/^\d{3,10}$/.test(p[0]))
      throw new Error(`${i + 1}번째 줄의 학번과 이름을 확인하세요`);
    return { student_id: p[0], name: p.slice(1).join(" ") };
  });
  await makePreview(rows);
});
bind("btnApplyRoster", async () => {
  if (!preview) return;
  await rpc("nfc_roster_apply", { p_preview: preview.preview_id });
  preview = null;
  $("previewBox").classList.add("hidden");
  $("btnApplyRoster").classList.add("hidden");
  $("rPaste").value = "";
  await Promise.all([loadStudents(), loadToday()]);
  toast("미리본 명단을 적용했습니다");
});
$("rosterBody").onclick = (e) => {
  const b = e.target.closest("button[data-act]");
  if (!b) return;
  const s = students.find((x) => x.student_uid === b.dataset.uid);
  if (b.dataset.act === "edit") {
    openEditor(
      `${s.name} · 명단 수정`,
      field(
        "학번",
        `<input id="xId" value="${esc(s.student_id)}" required pattern="[0-9]{3,10}">`,
      ) +
        field(
          "이름",
          `<input id="xName" value="${esc(s.name)}" required maxlength="40">`,
        ) +
        field(
          "재적 상태",
          `<select id="xState">${Object.entries(STATE)
            .map(
              ([k, v]) =>
                `<option value="${k}" ${s.state === k ? "selected" : ""}>${v}</option>`,
            )
            .join("")}</select>`,
        ) +
        field(
          "시작일 (포함)",
          `<input type="date" id="xStart" value="${s.starts_on}" required>`,
        ) +
        field(
          "종료일 (포함)",
          `<input type="date" id="xEnd" value="${s.ends_on}" required>`,
        ) +
        '<p class="sub">시트에도 같은 내용을 반영하세요. 학번이 5자리면 학년·반·번호를 다시 계산합니다.</p>',
      async () => {
        await makePreview([
          {
            student_uid: s.student_uid,
            revision: s.revision,
            student_id: $("xId").value.trim(),
            name: $("xName").value.trim(),
            state: $("xState").value,
            starts_on: $("xStart").value,
            ends_on: $("xEnd").value,
          },
        ]);
        toast("미리보기를 확인한 뒤 적용하세요");
      },
    );
  } else
    run(b, async () => {
      const label = {
        reset: "기기 등록을 해제",
        code: "등록코드를 재발급",
        confirm: "명단을 확정",
      }[b.dataset.act];
      if (!confirm(`${s.name} 학생의 ${label}할까요?`)) return;
      await rpc("nfc_student_action", {
        p_uid: s.student_uid,
        p_year: Number($("rYear").value),
        p_action: b.dataset.act,
      });
      await loadStudents();
      toast("처리했습니다");
    });
};
bind("btnRosterExport", async () => {
  downloadCSV(`명단_${$("rYear").value}.csv`, [
    [
      "학번",
      "이름",
      "등록코드",
      "휴대폰",
      "구분",
      "메모",
      "학생 식별자",
      "학년도",
      "재적 상태",
      "시작일",
      "종료일",
      "명단 버전",
    ],
    ...students.map((s) => [
      s.student_id,
      s.name,
      s.reg_code,
      s.device_bound_at ? "등록" : "미등록",
      STATE[s.state],
      "",
      s.student_uid,
      s.school_year,
      STATE[s.state],
      s.starts_on,
      s.ends_on,
      s.revision,
    ]),
  ]);
});
bind("btnPrint", async () => {
  const list = rosterList();
  if (!list.length) throw new Error("인쇄할 학생이 없습니다");
  $("printArea").innerHTML = list
    .map(
      (s) =>
        `<div class="slip"><b>${esc(s.student_id)} ${esc(s.name)}</b><div class="code">${esc(s.reg_code)}</div><p>본인 휴대폰으로 NFC 스티커를 찍고 학번·이름·등록코드를 입력하세요.</p><p>친구에게 코드를 보여주지 마세요.</p><small>${esc(nfcUrl())}</small></div>`,
    )
    .join("");
  window.print();
});
async function loadCalendar() {
  const from = $("cFrom").value.slice(0, 4) + "-01-01",
    to = $("cFrom").value.slice(0, 4) + "-12-31";
  const rows = await fetchAll(() =>
    sb
      .from("school_days")
      .select("*")
      .gte("day", from)
      .lte("day", to)
      .order("day")
      .order("grade"),
  );
  $("calendarList").innerHTML =
    "<h3>올해 개별 설정</h3>" +
    rows
      .map(
        (r) =>
          `<span class="tag ${r.is_school_day ? "t-present" : "t-unconfirmed"}">${esc(r.day)} · ${r.grade ? r.grade + "학년" : "전체"} · ${r.is_school_day ? "대상" : "제외"} ${esc(r.note)}</span> `,
      )
      .join("");
}
bind("btnCalendar", async () => {
  if (
    !confirm(`${$("cFrom").value} ~ ${$("cTo").value} 기간 전체에 적용할까요?`)
  )
    return;
  await rpc("nfc_calendar", {
    p_from: $("cFrom").value,
    p_to: $("cTo").value,
    p_grade: Number($("cGrade").value),
    p_school: $("cSchool").value === "true",
    p_note: $("cNote").value,
  });
  await Promise.all([loadCalendar(), loadToday()]);
  toast("출석 대상일을 저장했습니다");
});
// ---------- 설정 ----------
function nfcUrl() {
  return new URL("index.html", location.href).href;
}
async function loadSettings() {
  $("nfcUrl").value = nfcUrl();
  const { data, error } = await sb
    .from("settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (error) {
    toast("설정을 불러오지 못했어요");
    return;
  }
  $("sOpen").value = data.open_time.slice(0, 5);
  $("sDeadline").value = data.deadline.slice(0, 5);
  $("sClose").value = data.close_time.slice(0, 5);
  schoolName = data.school_name || "";
  $("sSchool").value = schoolName;
  $("sSelf").checked = data.allow_self_signup;
  $("sSignupCode").value = data.signup_code ?? "";
  $("sGeo").checked = data.geo_required;
  $("sLat").value = data.school_lat ?? "";
  $("sLng").value = data.school_lng ?? "";
  $("sRadius").value = data.radius_m;
  loadSyncStatus();
  const { data: t } = await sb.from("teachers").select("email");
  $("teacherList").textContent =
    "현재 교사: " + (t || []).map((x) => x.email).join(", ");
}
$("btnSaveSettings").onclick = async () => {
  const lat = parseFloat($("sLat").value),
    lng = parseFloat($("sLng").value);
  if ($("sGeo").checked && (isNaN(lat) || isNaN(lng))) {
    toast("위치 확인을 켜려면 학교 위도·경도가 필요해요");
    return;
  }
  const signupCode = $("sSignupCode").value.trim();
  if ($("sSelf").checked && signupCode.length < 4) {
    toast("추가 등록을 열려면 4자 이상의 추가 등록 코드가 필요해요");
    return;
  }
  if (
    !(
      $("sOpen").value < $("sDeadline").value &&
      $("sDeadline").value < $("sClose").value
    )
  ) {
    toast("시작 < 마감 < 종료 순서인지 확인해 주세요");
    return;
  }
  const { error } = await sb
    .from("settings")
    .update({
      open_time: $("sOpen").value,
      deadline: $("sDeadline").value,
      close_time: $("sClose").value,
      school_name: $("sSchool").value.trim(),
      allow_self_signup: $("sSelf").checked,
      signup_code: signupCode || null,
      geo_required: $("sGeo").checked,
      school_lat: isNaN(lat) ? null : lat,
      school_lng: isNaN(lng) ? null : lng,
      radius_m: parseInt($("sRadius").value) || 300,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (!error) schoolName = $("sSchool").value.trim();
  toast(error ? "저장 실패: " + error.message : "설정을 저장했어요");
};
$("btnGenSignup").onclick = () => {
  $("sSignupCode").value = newCode();
  toast("코드를 만들었어요. 설정 저장을 눌러 주세요");
};
$("btnHere").onclick = () => {
  if (!navigator.geolocation) {
    toast("이 기기는 위치를 지원하지 않아요");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (p) => {
      $("sLat").value = p.coords.latitude.toFixed(6);
      $("sLng").value = p.coords.longitude.toFixed(6);
      toast(
        `현재 위치를 넣었어요 (오차 약 ${Math.round(p.coords.accuracy)}m). 저장을 눌러 주세요`,
      );
    },
    () => toast("위치 권한을 허용해 주세요"),
    { enableHighAccuracy: true, timeout: 10000 },
  );
};
$("btnCopyUrl").onclick = () => {
  navigator.clipboard
    .writeText($("nfcUrl").value)
    .then(() => toast("복사했어요"));
};
$("btnWriteNfc").onclick = async () => {
  if (!("NDEFReader" in window)) {
    toast(
      "이 브라우저는 NFC 쓰기를 지원하지 않아요. NFC Tools 앱을 이용해 주세요",
    );
    return;
  }
  try {
    toast("빈 스티커를 휴대폰 뒷면에 대 주세요");
    await new NDEFReader().write({
      records: [{ recordType: "url", data: nfcUrl() }],
    });
    toast("스티커에 기록했어요! 다음 스티커는 버튼을 다시 누르세요");
  } catch (e) {
    toast("기록 실패: " + e.message);
  }
};
const fmtDT = (v) =>
  v
    ? new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(v))
    : "없음";
async function loadSyncStatus() {
  const { data } = await sb.rpc("sync_status");
  $("syncStatus").innerHTML = !data
    ? ""
    : data.connected
      ? `연결 코드 있음 (${fmtDT(data.created_at)} 발급) · 마지막 가져오기 ${fmtDT(data.last_pull_at)} · 마지막 명단 보내기 ${fmtDT(data.last_push_at)}`
      : "아직 연결 코드가 없어요.";
}
$("btnSyncSecret").onclick = async () => {
  const { data: st } = await sb.rpc("sync_status");
  if (
    st?.connected &&
    !confirm(
      "새 코드를 만들면 지금 시트에 넣어 둔 코드는 더 이상 동작하지 않아요. 계속할까요?",
    )
  )
    return;
  const { data, error } = await sb.rpc("create_sync_secret");
  if (error || !data?.ok) {
    toast("코드를 만들지 못했어요");
    return;
  }
  $("syncSecret").value = data.secret;
  $("syncSecretBox").classList.remove("hidden");
  loadSyncStatus();
};
$("btnCopySecret").onclick = () => {
  navigator.clipboard
    .writeText($("syncSecret").value)
    .then(() => toast("복사했어요"));
};
$("btnAddTeacher").onclick = async () => {
  const { data, error } = await sb.rpc("add_teacher", {
    p_email: $("tEmail").value,
  });
  if (error || !data.ok) {
    toast(
      data?.error === "user_not_found"
        ? "그 이메일의 계정이 없어요. 먼저 Supabase에서 만들어 주세요"
        : "추가하지 못했어요",
    );
    return;
  }
  $("tEmail").value = "";
  toast("교사로 추가했어요");
  loadSettings();
};
