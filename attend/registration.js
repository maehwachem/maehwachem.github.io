/* Personal enrollment QR. Credentials stay in the fragment and are consumed
 * before third-party resources load. Registration still requires confirmation. */
(() => {
  "use strict";
  const schoolYear = (date = new Date()) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul", year: "numeric", month: "2-digit",
    }).formatToParts(date);
    const part = type => Number(parts.find(p => p.type === type).value);
    return part("year") - (part("month") < 3 ? 1 : 0);
  };
  const validate = p => {
    const id = String(p.id || "").trim(), name = String(p.name || "").trim().normalize("NFC");
    const code = String(p.code || "").trim(), year = Number(p.year);
    if (!/^\d{3,10}$/.test(id) || name.length < 2 || name.length > 40 ||
        !code || code.length > 20 || /[\u0000-\u001f\u007f]/.test(name + code) ||
        !Number.isInteger(year) || year < 2020 || year > 2200) {
      throw new Error("등록 QR의 정보가 올바르지 않아요. 선생님께 새 QR을 요청하거나 직접 입력해 주세요.");
    }
    return {id, name, code, year};
  };
  let pending = null;
  if (location.hash.startsWith("#enroll=")) {
    const fragment = location.hash.slice(1);
    history.replaceState(null, "", location.pathname + location.search);
    try {
      const p = new URLSearchParams(fragment);
      if (fragment.length > 2048 || p.get("enroll") !== "1" ||
          ["enroll", "id", "name", "code", "year"].some(k => p.getAll(k).length !== 1)) throw new Error("invalid");
      pending = {student: validate(Object.fromEntries(p))};
      if (pending.student.year !== schoolYear()) {
        pending = {error: "현재 학년도용 등록 QR이 아니에요. 선생님께 새 QR을 요청해 주세요."};
      }
    } catch (e) {
      pending = {error: "등록 QR을 읽지 못했어요. 선생님께 새 QR을 요청하거나 직접 입력해 주세요."};
    }
  }
  window.NFCRegistration = Object.freeze({
    take() { const value = pending; pending = null; return value; },
    schoolYear,
    url(base, student) {
      const p = validate(student), url = new URL(base);
      url.search = "";
      url.hash = new URLSearchParams({enroll: "1", ...p}).toString();
      return url.href;
    },
  });
})();
