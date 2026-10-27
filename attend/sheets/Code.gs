/** NFC 출석 v2 — 이 파일을 기존 출석 시트의 Apps Script에 설치하세요.
 * 명단 원본: 명단 탭. 출석/이동 원본: 서버. 유료 API/자동 예약을 만들지 않습니다.
 * 연결 코드는 사용자 속성에 저장합니다. 시트를 학생에게 공유하지 마세요.
 */
const NFC = {
  url: "https://mesbyexzkbtsqqlopqxv.supabase.co",
  key: "sb_publishable_eVB_tqHU85HKVJxBdPNe7A_dZRkEq8k", // 공개 publishable key
  roster: [
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
  states: {
    active: "재적",
    pending: "승인 대기",
    inactive: "비활성",
    transferred: "전출",
    graduated: "졸업",
  },
  status: {
    present: "출석",
    late: "지각",
    excused: "인정",
    absent: "결석 확정",
    unconfirmed: "미확인",
  },
  move: { out: "외출", return: "복귀", early: "조퇴", void: "직전 이동 취소" },
};
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("NFC 출석")
    .addItem("처음 준비 · 연결 설정", "nfcSetup")
    .addSeparator()
    .addItem("1. 명단 변경 미리보기", "nfcPreview")
    .addItem("2. 미리본 명단 적용", "nfcApply")
    .addItem("서버 명단 확인용 사본 받기", "nfcServerRoster")
    .addSeparator()
    .addItem("기간별 출석·이동 가져오기", "nfcPull")
    .addToUi();
}
function nfcProps_() {
  return PropertiesService.getUserProperties();
}
function nfcUi_() {
  SpreadsheetApp.flush();
  return SpreadsheetApp.getUi();
}
function nfcReacquire_() {
  if (!LockService.getDocumentLock().tryLock(1000))
    throw new Error("다른 동기화가 진행 중입니다. 다시 실행하세요.");
}
function nfcToday_() {
  return Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd");
}
function nfcYear_(d) {
  return Number(d.slice(0, 4)) - (Number(d.slice(5, 7)) < 3 ? 1 : 0);
}
function nfcPrompt_(title, message, initial) {
  const r = nfcUi_().prompt(
    title,
    message + (initial ? "\n예: " + initial : ""),
    nfcUi_().ButtonSet.OK_CANCEL,
  );
  nfcReacquire_();
  return r.getSelectedButton() === nfcUi_().Button.OK
    ? r.getResponseText().trim()
    : null;
}
function nfcRun_(fn) {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(1000)) {
    nfcUi_().alert(
      "다른 동기화 작업이 진행 중입니다. 잠시 후 다시 실행하세요.",
    );
    return;
  }
  try {
    fn();
  } catch (e) {
    nfcUi_().alert("처리하지 못했습니다\n" + e.message);
  } finally {
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}
function nfcRpc_(name, args) {
  const secret = nfcProps_().getProperty("NFC_SECRET");
  if (!secret) throw new Error("처음 준비 · 연결 설정을 먼저 실행하세요.");
  const response = UrlFetchApp.fetch(NFC.url + "/rest/v1/rpc/" + name, {
    method: "post",
    contentType: "application/json",
    headers: { apikey: NFC.key },
    payload: JSON.stringify(Object.assign({}, args, { p_secret: secret })),
    muteHttpExceptions: true,
  });
  const data = JSON.parse(response.getContentText());
  if (response.getResponseCode() >= 300 || data.ok === false)
    throw new Error(data.message || data.error || "서버에 연결하지 못했습니다");
  return data;
}
function nfcSheet_(name, headers) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getMaxColumns() < headers.length)
    sh.insertColumnsAfter(
      sh.getMaxColumns(),
      headers.length - sh.getMaxColumns(),
    );
  sh.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setBackground("#edf1ff")
    .setFontColor("#000000")
    .setFontWeight("bold");
  sh.setFrozenRows(1);
  return sh;
}
function nfcSetup() {
  nfcRun_(() => {
    const secret = nfcPrompt_(
      "연결 코드",
      "교사 관리 화면 → 설정에서 발급한 연결 코드를 입력하세요. 이 코드는 현재 Google 사용자에게만 저장됩니다.",
    );
    if (secret === null) return;
    if (secret.length < 32) throw new Error("연결 코드를 확인하세요.");
    const year = nfcPrompt_(
      "학년도",
      "관리할 학년도를 입력하세요.",
      String(nfcYear_(nfcToday_())),
    );
    if (year === null) return;
    if (!/^20\d\d$/.test(year)) throw new Error("학년도를 확인하세요.");
    nfcProps_().setProperties({ NFC_SECRET: secret, NFC_YEAR: year });
    const ss = SpreadsheetApp.getActive();
    ss.setSpreadsheetTimeZone("Asia/Seoul");
    const sh = ss.getSheetByName("명단");
    if (sh) {
      const headers = sh
        .getRange(1, 1, 1, Math.min(12, sh.getMaxColumns()))
        .getDisplayValues()[0];
      if (
        (headers[0] && headers[0] !== "학번") ||
        (headers[1] && headers[1] !== "이름")
      )
        throw new Error("명단의 A/B 열이 학번/이름인지 확인하세요.");
      for (let i = 6; i < headers.length; i++)
        if (headers[i] && headers[i] !== NFC.roster[i])
          throw new Error(
            "G~L열에 다른 내용이 있습니다. 먼저 별도 열로 옮겨 보존하세요.",
          );
    }
    const roster = nfcSheet_("명단", NFC.roster);
    roster.getRange("A:A").setNumberFormat("@");
    roster.getRange("G:G").setNumberFormat("@");
    roster.getRange("J:K").setNumberFormat("yyyy-mm-dd");
    roster
      .getRange(2, 9, roster.getMaxRows() - 1, 1)
      .setDataValidation(
        SpreadsheetApp.newDataValidation()
          .requireValueInList(Object.values(NFC.states), true)
          .setAllowInvalid(false)
          .build(),
      );
    roster.setColumnWidths(1, 12, 125);
    roster.setColumnWidth(7, 285);
    roster
      .getRange("G1")
      .setNote(
        "학생 고정 식별자. 자동 입력되며 진급 때도 유지하세요. 새 학생에게 복사하지 마세요.",
      );
    roster
      .getRange("K1")
      .setNote(
        "마지막 출석 대상일(포함). 전출·졸업·비활성으로 바꿀 때 종료일도 지정하세요.",
      );
    nfcUi_().alert(
      "준비되었습니다. 기존 출석기록·요약 탭은 보존합니다. 명단의 A/B와 H~K를 편집하고 미리보기 → 적용하세요.",
    );
  });
}
function nfcDateCell_(x) {
  if (x instanceof Date)
    return Utilities.formatDate(x, "Asia/Seoul", "yyyy-MM-dd");
  return String(x || "").trim();
}
function nfcInput_() {
  const sh = SpreadsheetApp.getActive().getSheetByName("명단");
  if (!sh) throw new Error("명단 탭이 없습니다. 연결 설정을 먼저 실행하세요.");
  const n = Math.max(0, sh.getLastRow() - 1);
  if (n > 5000) throw new Error("명단은 5000명 이하로 관리하세요.");
  const values = n ? sh.getRange(2, 1, n, 12).getValues() : [];
  const year = Number(nfcProps_().getProperty("NFC_YEAR"));
  if (!year) throw new Error("연결 설정에서 학년도를 지정하세요.");
  const rows = [],
    positions = [];
  values.forEach((r, i) => {
    if (!r[0] && !r[1]) return;
    const y = r[7] ? Number(r[7]) : year;
    if (y !== year)
      throw new Error(
        i +
          2 +
          "행의 학년도가 연결 설정(" +
          year +
          ")과 다릅니다. 한 번에 한 학년도만 적용하세요.",
      );
    const state =
      Object.keys(NFC.states).find((k) => NFC.states[k] === r[8]) ||
      String(r[8] || "");
    rows.push({
      student_id: String(r[0]).trim(),
      name: String(r[1]).trim().normalize("NFC"),
      student_uid: String(r[6] || "").trim(),
      state: state,
      starts_on: nfcDateCell_(r[9]),
      ends_on: nfcDateCell_(r[10]),
      revision: r[11] ? Number(r[11]) : null,
    });
    positions.push(i + 2);
  });
  return { sh: sh, year: year, rows: rows, positions: positions };
}
function nfcHash_(input) {
  return Utilities.base64Encode(
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      JSON.stringify({
        year: input.year,
        rows: input.rows,
        positions: input.positions,
      }),
    ),
  );
}
function nfcSafe_(v) {
  const s = String(v === null || v === undefined ? "" : v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}
function nfcWrite_(name, headers, rows) {
  const existing = SpreadsheetApp.getActive().getSheetByName(name);
  if (existing && existing.getLastRow() > 0) {
    const old = existing
      .getRange(1, 1, 1, Math.min(headers.length, existing.getMaxColumns()))
      .getDisplayValues()[0];
    if (old.some((v, i) => v && v !== headers[i]))
      throw new Error(
        name +
          " 탭에 다른 자료가 있습니다. 사본으로 보관한 후 다시 실행하세요.",
      );
  }
  const sh = nfcSheet_(name, headers);
  if (sh.getMaxRows() < rows.length + 1)
    sh.insertRowsAfter(sh.getMaxRows(), rows.length + 1 - sh.getMaxRows());
  if (sh.getLastRow() > 1)
    sh.getRange(2, 1, sh.getLastRow() - 1, headers.length).clearContent();
  for (let i = 0; i < rows.length; i += 1000) {
    const batch = rows.slice(i, i + 1000).map((r) => r.map(nfcSafe_));
    sh.getRange(i + 2, 1, batch.length, headers.length)
      .setNumberFormat("@")
      .setValues(batch);
  }
  sh.setColumnWidths(1, headers.length, 115);
  return sh;
}
function nfcPreview() {
  nfcRun_(() => {
    const input = nfcInput_();
    const data = nfcRpc_("nfc_roster_preview", {
      p_year: input.year,
      p_rows: input.rows,
    });
    const rows = data.changes.map((c) => {
      const a = c.after || {},
        b = c.before || {};
      return [
        c.type === "new"
          ? "신규"
          : c.type === "change"
            ? "변경"
            : "누락 · 유지",
        b.student_id || "",
        b.name || "",
        a.student_id || "",
        a.name || "",
        b.state ? NFC.states[b.state] : "",
        a.state ? NFC.states[a.state] : "",
        b.starts_on || "",
        b.ends_on || "",
        a.starts_on || "",
        a.ends_on || "",
      ];
    });
    (data.warnings || []).forEach(w => rows.push(["확인 필요", "", "", "", w, "", "", "", "", "", ""]));
    const sh = nfcWrite_(
      "동기화 미리보기",
      [
        "처리",
        "기존 학번",
        "기존 이름",
        "새 학번",
        "새 이름",
        "기존 상태",
        "새 상태",
        "기존 시작",
        "기존 종료",
        "새 시작",
        "새 종료",
      ],
      rows,
    );
    nfcProps_().setProperties({
      NFC_PREVIEW: data.preview_id,
      NFC_HASH: nfcHash_(input),
    });
    SpreadsheetApp.getActive().setActiveSheet(sh);
    nfcUi_().alert(
      "변경 " +
        rows.filter((r) => r[0] === "신규" || r[0] === "변경").length +
        "건, 누락 " +
        rows.filter((r) => r[0] === "누락 · 유지").length +
        "건입니다.\n" + (data.warnings || []).join("\n") + "\n누락된 학생은 유지됩니다. 내용을 확인한 뒤 30분 안에 “미리본 명단 적용”을 실행하세요.",
    );
  });
}
function nfcApply() {
  nfcRun_(() => {
    const props = nfcProps_(),
      id = props.getProperty("NFC_PREVIEW"),
      hash = props.getProperty("NFC_HASH");
    if (!id) throw new Error("명단 변경 미리보기를 먼저 실행하세요.");
    const input = nfcInput_();
    if (nfcHash_(input) !== hash)
      throw new Error("미리보기 후 시트가 바뀌었습니다. 다시 미리보기하세요.");
    if (
      nfcUi_().alert(
        "미리본 명단을 서버에 적용할까요? 누락된 학생은 삭제되지 않습니다.",
        nfcUi_().ButtonSet.YES_NO,
      ) !== nfcUi_().Button.YES
    )
      return;
    nfcReacquire_();
    if (nfcHash_(nfcInput_()) !== hash)
      throw new Error("확인 중 시트가 바뀌었습니다. 다시 미리보기하세요.");
    const data = nfcRpc_("nfc_roster_apply", { p_preview: id });
    if (nfcHash_(nfcInput_()) !== hash)
      throw new Error(
        "서버 적용은 완료됐으나 시트가 변경되어 학생 식별자를 쓰지 않았습니다. 서버 명단 사본을 받아 대조하세요.",
      );
    data.rows.forEach((r, i) => {
      input.sh
        .getRange(input.positions[i], 7, 1, 6)
        .setValues([
          [
            r.student_uid,
            r.school_year,
            NFC.states[r.state],
            r.starts_on,
            r.ends_on,
            r.revision,
          ],
        ]);
    });
    props.deleteProperty("NFC_PREVIEW");
    props.deleteProperty("NFC_HASH");
    nfcUi_().alert(
      data.count +
        "명의 명단을 적용했습니다. 출석·이동은 교사 화면에서 처리하세요.",
    );
  });
}
function nfcServerRoster() {
  nfcRun_(() => {
    const today = nfcToday_();
    const data = nfcRpc_("sync_pull", { p_from: today, p_to: today });
    const sh = nfcWrite_(
      "서버 명단",
      NFC.roster,
      data.students.map((r) => [
        r.student_id,
        r.name,
        r.reg_code,
        r.device_bound_at ? "등록" : "미등록",
        NFC.states[r.state],
        "",
        r.student_uid,
        r.school_year,
        NFC.states[r.state],
        r.starts_on,
        r.ends_on,
        r.revision,
      ]),
    );
    SpreadsheetApp.getActive().setActiveSheet(sh);
    nfcUi_().alert(
      "서버 명단 사본을 받았습니다. 명단 원본은 바꾸지 않았습니다. 진급 학생은 학생 식별자를 유지해 명단에 옮기세요.",
    );
  });
}
function nfcTime_(s) {
  return s ? Utilities.formatDate(new Date(s), "Asia/Seoul", "HH:mm:ss") : "";
}
function nfcMergePeriod_(name, headers, from, to, rows) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  const old =
    sh && sh.getLastRow() > 1
      ? sh
          .getRange(2, 1, sh.getLastRow() - 1, headers.length)
          .getDisplayValues()
      : [];
  const kept = old.filter((r) => r[0] && (r[0] < from || r[0] > to));
  nfcWrite_(
    name,
    headers,
    kept
      .concat(rows)
      .sort(
        (a, b) =>
          String(a[0]).localeCompare(String(b[0])) ||
          String(a[1]).localeCompare(String(b[1])),
      ),
  );
}
function nfcPull() {
  nfcRun_(() => {
    const today = nfcToday_();
    const text = nfcPrompt_(
      "출석·이동 가져오기",
      "시작일과 종료일을 쉼표로 구분하세요. 최대 62일, 더 오래된 정정은 해당 기간을 다시 가져오세요.",
      today.slice(0, 8) + "01," + today,
    );
    if (text === null) return;
    const parts = text.split(",").map((s) => s.trim()),
      from = parts[0],
      to = parts[1];
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
      to < from ||
      new Date(to) - new Date(from) > 61 * 86400000
    )
      throw new Error(
        "yyyy-mm-dd,yyyy-mm-dd 형식과 62일 이하 기간을 확인하세요.",
      );
    const data = nfcRpc_("sync_pull", { p_from: from, p_to: to });
    if (data.version !== 2) throw new Error("서버 버전을 확인하세요.");
    const headers = [
      "날짜",
      "학생 식별자",
      "학년도",
      "학번",
      "이름",
      "대상일",
      "등교 상태",
      "원래 태그 시각",
      "이동 상태",
      "복귀 예정",
      "복귀 지연",
      "처리",
    ];
    nfcMergePeriod_(
      "출석기록 v2",
      headers,
      from,
      to,
      data.attendance.map((r) => [
        r.date,
        r.student_uid,
        r.school_year,
        r.student_id,
        r.name,
        r.eligible ? "대상" : "대상 외",
        NFC.status[r.status],
        nfcTime_(r.checked_at),
        r.whereabouts === "out"
          ? "외출 중"
          : r.whereabouts === "early"
            ? "조퇴"
            : "",
        nfcTime_(r.expected_return_at),
        r.overdue ? "지연" : "",
        r.source === "manual" ? "교사 확인" : "",
      ]),
    );
    const names = {};
    data.attendance.forEach((r) => (names[r.date + "|" + r.student_uid] = r));
    nfcMergePeriod_(
      "이동기록",
      [
        "날짜",
        "학생 식별자",
        "학번",
        "이름",
        "처리",
        "실제 시각",
        "복귀 예정",
        "사유",
        "기록 시각",
        "이동 ID",
      ],
      from,
      to,
      data.movements.map((m) => {
        const s = names[m.att_date + "|" + m.student_uid] || {};
        return [
          m.att_date,
          m.student_uid,
          s.student_id || "",
          s.name || "",
          NFC.move[m.kind],
          nfcTime_(m.happened_at),
          nfcTime_(m.expected_return_at),
          m.reason,
          m.created_at,
          m.id,
        ];
      }),
    );
    nfcSummary_();
    nfcUi_().alert(
      "출석 " +
        data.attendance.length +
        "건과 이동 " +
        data.movements.length +
        "건을 가져왔습니다. 해당 기간은 서버 내용으로 갱신했고 다른 기간과 기존 v1 탭은 보존했습니다.",
    );
  });
}
function nfcSummary_() {
  const sh = SpreadsheetApp.getActive().getSheetByName("출석기록 v2");
  const values =
    sh.getLastRow() > 1
      ? sh.getRange(2, 1, sh.getLastRow() - 1, 12).getDisplayValues()
      : [];
  const map = {};
  values.forEach((r) => {
    if (r[5] !== "대상") return;
    const key = r[2] + "|" + r[1];
    if (!map[key]) map[key] = [r[2], r[1], r[3], r[4], 0, 0, 0, 0, 0, 0, 0];
    const x = map[key];
    x[2] = r[3];
    x[3] = r[4];
    const col = { 출석: 4, 지각: 5, 인정: 6, "결석 확정": 7, 미확인: 8 }[r[6]];
    if (col !== undefined) x[col]++;
    if (r[8] === "조퇴") x[9]++;
    x[10]++;
  });
  nfcWrite_(
    "학생별 요약 v2",
    [
      "학년도",
      "학생 식별자",
      "학번",
      "이름",
      "출석",
      "지각",
      "인정",
      "결석 확정",
      "미확인",
      "조퇴일",
      "가져온 대상일 수",
    ],
    Object.values(map),
  );
}
