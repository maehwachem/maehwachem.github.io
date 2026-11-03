/* Common attendance entry: NFC and QR open the same URL and share the
 * existing browser registration. No student credentials enter this QR. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const target = new URL("index.html", window.location.href);
  target.search = "";
  target.hash = "";
  const address = target.href;
  $("attendanceAddress").href = address;
  $("attendanceAddress").textContent = address;
  $("attendanceOpen").href = address;

  let svg = "";
  try {
    const code = qrcode(0, "M");
    code.addData(address, "Byte");
    code.make();
    svg = code.createSvgTag({cellSize:8, margin:32, scalable:true});
    $("attendanceQr").innerHTML = svg;
    $("printQr").disabled = false;
    $("downloadQr").disabled = false;
  } catch (error) {
    $("qrStatus").textContent = "QR을 만들지 못했어요. 새로고침하거나 아래 출결 화면 열기를 이용하세요.";
  }

  $("printQr").onclick = () => window.print();
  $("downloadQr").onclick = () => {
    if (!svg) return;
    const file = new Blob([svg], {type:"image/svg+xml;charset=utf-8"});
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "출결용_QR.svg";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    $("qrStatus").textContent = "QR 이미지 저장을 요청했어요. 기기의 다운로드 항목을 확인하세요.";
  };
  $("copyQrUrl").onclick = async () => {
    try {
      await navigator.clipboard.writeText(address);
      $("qrStatus").textContent = "출결 주소를 복사했어요.";
    } catch (error) {
      $("qrStatus").textContent = "복사하지 못했어요. QR 아래 주소를 길게 누르거나 선택해 복사하세요.";
    }
  };
})();
