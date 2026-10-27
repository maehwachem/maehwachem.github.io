import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite({ extensions: { pgcrypto } });
const file = (p) => readFile(new URL(p, import.meta.url), "utf8");
const q = async (sql, args = []) => (await db.query(sql, args)).rows;
const one = async (sql, args = []) => Object.values((await q(sql, args))[0])[0];
const call = (fn, args = []) =>
  one(
    `select public.${fn}(${args.map((_, i) => "$" + (i + 1)).join(",")})`,
    args,
  );
let passed = 0;
async function test(name, fn) {
  await fn();
  console.log("PASS", name);
  passed++;
}
async function rejects(fn, pattern) {
  await assert.rejects(fn, pattern);
}
try {
  await db.exec(await file("baseline.sql"));
  await db.exec(await file("baseline-functions.sql"));
  await db.exec(
    "insert into students(student_id,name,device_hash,device_bound_at) values('30101','검증학생',encode(extensions.digest(repeat('a',64),'sha256'),'hex'),now()); insert into attendance(student_id,att_date,status,checked_at) values('30101','2025-10-15','late','2025-10-15T08:30:00+09:00');",
  );
  await db.exec(
    await file(
      "../../supabase/migrations/20261027051543_attendance_roster_movements.sql",
    ),
  );
  await db.exec(await file("../../supabase/migrations/20261027070831_attendance_review_fixes.sql"));
  const uid = await one(
    "select student_uid from students where student_id='30101'",
  );
  const teacher = crypto.randomUUID();
  await q("insert into auth.users values($1,$2)", [
    teacher,
    "test@example.invalid",
  ]);
  await q("insert into teachers(user_id,email) values($1,$2)", [
    teacher,
    "test@example.invalid",
  ]);
  await q("select set_config('request.jwt.claim.sub',$1,false)", [teacher]);
  const today = await one(
    "select (now() at time zone 'Asia/Seoul')::date::text",
  );
  const year = await call("nfc_year", [today]);
  await db.exec(
    "update settings set open_time='00:00',close_time='23:59:59',deadline='23:00',allow_self_signup=true,signup_code='test-code';",
  );
  await call("nfc_calendar", [today, today, 0, true, "테스트"]);
  await test("migration preserves historical attendance and device binding", async () => {
    assert.equal(await one("select count(*)::int from attendance"), 1);
    assert.equal(await one("select student_uid from attendance"), uid);
    assert.equal(
      await one("select count(*)::int from enrollments where student_uid=$1", [
        uid,
      ]),
      2,
    );
    assert.equal((await call("check_in", ["a".repeat(64)])).ok, true);
  });
  await test("arrival correction preserves original tag timestamp and has optimistic locking", async () => {
    const before = await one(
      "select checked_at::text from attendance where student_uid=$1 and att_date=$2",
      [uid, today],
    );
    await call("nfc_correct", [uid, today, "late", "시각 확인", 1]);
    assert.equal(
      await one(
        "select checked_at::text from attendance where student_uid=$1 and att_date=$2",
        [uid, today],
      ),
      before,
    );
    await rejects(
      () => call("nfc_correct", [uid, today, "present", "중복 수정", 1]),
      /다른 변경/,
    );
  });
  const at = await one("select now()::text"),
    expected = await one("select (now()+interval '1 hour')::text");
  let previous = null;
  const move = async (kind, id = crypto.randomUUID()) => {
    await call("nfc_move", [
      uid,
      today,
      kind,
      at,
      kind === "out" ? expected : null,
      "검증 이동",
      previous,
      id,
    ]);
    previous = id;
    return id;
  };
  await test("multiple outings, duplicate retries, invalid transition and early-departure retap", async () => {
    const id = await move("out");
    assert.equal((await call("check_in", ["a".repeat(64)])).whereabouts, "out");
    await call("nfc_move", [
      uid,
      today,
      "out",
      at,
      expected,
      "검증 이동",
      null,
      id,
    ]);
    await rejects(
      () =>
        call("nfc_move", [
          uid,
          today,
          "out",
          at,
          expected,
          "검증 이동",
          id,
          crypto.randomUUID(),
        ]),
      /이미 외출/,
    );
    await move("return");
    await move("out");
    await move("early");
    assert.equal(
      (await call("check_in", ["a".repeat(64)])).whereabouts,
      "early",
    );
    await rejects(
      () =>
        call("nfc_move", [
          uid,
          today,
          "return",
          at,
          null,
          "검증 이동",
          previous,
          crypto.randomUUID(),
        ]),
      /외출 중/,
    );
    assert.equal(await one("select count(*)::int from movements"), 4);
    await move("void");
    assert.equal((await call("check_in", ["a".repeat(64)])).whereabouts, "out");
    await move("return");
    assert.equal(
      (await call("check_in", ["a".repeat(64)])).whereabouts,
      "inside",
    );
  });
  await test("move requires attendance and prevents destructive status changes", async () => {
    await rejects(
      () => call("nfc_correct", [uid, today, "absent", "결석", 2]),
      /이동 기록/,
    );
    await rejects(
      () =>
        call("nfc_move", [
          crypto.randomUUID(),
          today,
          "early",
          at,
          null,
          "없는 학생",
          null,
          crypto.randomUUID(),
        ]),
      /먼저 출석/,
    );
  });
  let preview;
  await test("roster preview rejects mismatched names and duplicates", async () => {
    await rejects(
      () =>
        call("nfc_roster_preview", [
          year,
          [{ student_id: "30101", name: "다른학생" }],
        ]),
      /이름이 다릅니다/,
    );
    await rejects(
      () =>
        call("nfc_roster_preview", [
          year,
          [
            { student_id: "30102", name: "신규학생" },
            { student_id: "30102", name: "중복학생" },
          ],
        ]),
      /중복/,
    );
  });
  await test("preview apply is idempotent and omissions preserve existing students", async () => {
    preview = await call("nfc_roster_preview", [
      year,
      [{ student_id: "30102", name: "신규학생", starts_on: today }],
    ]);
    assert(preview.changes.some((x) => x.type === "missing"));
    await call("nfc_roster_apply", [preview.preview_id]);
    await call("nfc_roster_apply", [preview.preview_id]);
    assert.equal(await one("select count(*)::int from students"), 2);
    assert.equal(
      await one(
        "select device_hash is not null from students where student_uid=$1",
        [uid],
      ),
      true,
    );
  });
  await test("stale preview rejected after another teacher roster edit", async () => {
    const a = await call("nfc_roster_preview", [
      year,
      [{ student_id: "30103", name: "세번째학생" }],
    ]);
    const b = await call("nfc_roster_preview", [
      year,
      [{ student_id: "30104", name: "네번째학생" }],
    ]);
    await call("nfc_roster_apply", [b.preview_id]);
    await rejects(
      () => call("nfc_roster_apply", [a.preview_id]),
      /명단이 바뀌었거나/,
    );
  });
  await test("year rollover can reuse numbers without linking the wrong person", async () => {
    const p = await call("nfc_roster_preview", [
      year + 1,
      [{ student_id: "30101", name: "새학년학생" }],
    ]);
    await call("nfc_roster_apply", [p.preview_id]);
    assert.notEqual(p.rows[0].student_uid, uid);
    assert.equal(
      await one("select count(*)::int from attendance where student_uid=$1", [
        uid,
      ]),
      2,
    );
  });
  await test("continuing student keeps fixed UID and device in next year", async () => {
    const p = await call("nfc_roster_preview", [
      year + 1,
      [{ student_uid: uid, student_id: "30201", name: "검증학생" }],
    ]);
    await call("nfc_roster_apply", [p.preview_id]);
    assert.equal(
      await one("select count(*)::int from enrollments where student_uid=$1", [
        uid,
      ]),
      3,
    );
  });
  await test("calendar and enrollment determine unconfirmed count", async () => {
    let day = await call("nfc_day", [today]);
    const s = day.find((x) => x.student_id === "30102");
    assert.equal(s.status, "unconfirmed");
    assert.equal(s.eligible, true);
    await call("nfc_calendar", [today, today, 3, false, "학년 휴업"]);
    day = await call("nfc_day", [today]);
    assert.equal(day.find((x) => x.student_id === "30102").eligible, false);
    await call("nfc_calendar", [today, today, 3, true, "복원"]);
    assert(
      (await call("nfc_report", [today, today])).some(
        (x) => x.student_id === "30102" && x.status === "unconfirmed",
      ),
    );
  });
  await test("self registration waits for teacher approval", async () => {
    const r = await call("register_device", [
      "30199",
      "대기학생",
      "test-code",
      "b".repeat(64),
    ]);
    assert.equal(r.ok, true);
    assert.equal((await call("check_in", ["b".repeat(64)])).error, "pending");
    const s = (await call("nfc_roster", [year])).find(
      (x) => x.student_id === "30199",
    );
    await call("nfc_confirm_signup", [s.student_uid, year, today, "가입 확인", s.revision]);
    assert.equal((await call("check_in", ["b".repeat(64)])).ok, true);
  });
  await test("stale sheet row version cannot overwrite a newer web edit", async () => {
    const row = (await call("nfc_roster", [year])).find(
      (x) => x.student_uid === uid,
    );
    const p = await call("nfc_roster_preview", [
      year,
      [{ ...row, name: "검증이름변경" }],
    ]);
    await call("nfc_roster_apply", [p.preview_id]);
    await rejects(
      () =>
        call("nfc_roster_preview", [year, [{ ...row, name: "오래된시트" }]]),
      /명단 버전/,
    );
  });
  await test("cancel all movements, absent retap signal, unconfirmed retap recovery", async () => {
    for (let i = 0; i < 10; i++) {
      const d = (await call("nfc_day", [today])).find(
        (x) => x.student_uid === uid,
      );
      if (!d.effective_movement_id) break;
      previous = d.movement_id;
      await move("void");
    }
    assert.equal(
      await one(
        "select count(*)::int from _nfc_current_move($1,$2) where id is not null",
        [uid, today],
      ),
      0,
    );
    await call("nfc_correct", [uid, today, "absent", "기록 오류 정정", 2]);
    assert.equal((await call("check_in", ["a".repeat(64)])).status, "absent");
    assert(
      (await call("nfc_day", [today])).find((x) => x.student_uid === uid)
        .last_exception_tag,
    );
    await call("nfc_correct", [uid, today, "unconfirmed", "재확인", 3]);
    assert.equal((await call("check_in", ["a".repeat(64)])).ok, true);
    assert.notEqual(
      (await call("check_in", ["a".repeat(64)])).status,
      "unconfirmed",
    );
  });
  await test("inactive students cannot check in but old records remain", async () => {
    const p = await call("nfc_roster_preview", [
      year,
      [
        {
          student_uid: uid,
          student_id: "30101",
          name: "검증이름변경",
          state: "transferred",
          ends_on: await one(
            "select ((now() at time zone 'Asia/Seoul')::date-1)::text",
          ),
          revision: 2,
        },
      ],
    ]);
    await call("nfc_roster_apply", [p.preview_id]);
    assert.equal((await call("check_in", ["a".repeat(64)])).error, "inactive");
    assert.equal(
      await one("select count(*)::int from attendance where student_uid=$1", [
        uid,
      ]),
      2,
    );
  });
  await test("unauthorized roles cannot read roster, mutate state or erase history", async () => {
    await q("select set_config('request.jwt.claim.sub','',false)");
    await db.exec("set role anon");
    await rejects(() => call("nfc_day", [today]), /permission denied/);
    await rejects(() => call("nfc_roster_preview", [year, []]), /연결 권한/);
    await db.exec("reset role");
    await q("select set_config('request.jwt.claim.sub',$1,false)", [teacher]);
    await db.exec("set role authenticated");
    await rejects(() => db.exec("delete from attendance"), /permission denied/);
    await rejects(() => db.exec("delete from students"), /permission denied/);
    await rejects(
      () => db.exec("update movements set reason=reason"),
      /permission denied/,
    );
    await db.exec("reset role");
  });
  console.log(`${passed} database tests passed`);
} catch (e) {
  console.error("FAIL", e.message, e.where || "", e.detail || "");
  process.exitCode = 1;
} finally {
  await db.close();
}
