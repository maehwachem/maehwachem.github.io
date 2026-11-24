// 화학자의 섬 v2 · 마지막 우편선 — 손 실험대 (lab.js)
(function () {
  'use strict';
  function has(v, id) { return !!(v && v.choices && v.choices.some(function (c) { return c.id === id; })); }
  function el(t, css, txt) { var e = document.createElement(t); if (css) e.style.cssText = css; if (txt != null) e.textContent = txt; return e; }
  function px(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function cvs(w, h, k) {
    var c = el('canvas', 'display:block;margin:0 auto;width:' + w * k + 'px;height:' + h * k + 'px;image-rendering:pixelated');
    c.width = w; c.height = h; var g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g];
  }
  var BOX = 'position:relative;width:288px;margin:8px auto;font:13px/1.4 sans-serif;color:#eef;user-select:none;touch-action:none';
  var BTN = 'font:12px sans-serif;padding:4px 8px;margin:2px;border:2px solid #9ab;background:#123;color:#eef;border-radius:2px;cursor:pointer';

  // ① 새 사슬: 아연 끌어 놓기
  function chain(box, view, choose) {
    var K = 3, a = cvs(96, 64, K), g = a[1]; box.appendChild(a[0]);
    a[0].setAttribute('role', 'img'); a[0].setAttribute('aria-label', '수면 위 부표와 고리, 물속 사슬과 족쇄, 부표에서 늘어진 밧줄.');
    var Z = [{ id: 'z_high', x: 59, y: 7, n: '물 위 고리' }, { id: 'z_bolt', x: 43, y: 41, n: '물속 족쇄' }, { id: 'z_rope', x: 21, y: 45, n: '밧줄 끝' }];
    function draw(on) {
      px(g, 0, 0, 96, 24, '#8fb8d8'); px(g, 0, 24, 96, 40, '#24507a');
      for (var x = 0; x < 96; x += 4) px(g, x, 23 + (x / 4) % 2, 3, 1, '#d6eef8');
      px(g, 40, 17, 16, 8, '#c33'); px(g, 40, 17, 16, 2, '#e66');
      px(g, 56, 10, 2, 9, '#666'); px(g, 61, 9, 6, 1, '#aaa'); px(g, 61, 14, 6, 1, '#aaa'); px(g, 61, 9, 1, 6, '#aaa'); px(g, 66, 9, 1, 6, '#aaa');
      for (var y = 25; y < 42; y += 3) px(g, 47, y, 2, 2, y % 2 ? '#8a8f96' : '#b0b4ba');
      px(g, 44, 42, 1, 6, '#c0c4ca'); px(g, 51, 42, 1, 6, '#c0c4ca'); px(g, 44, 48, 8, 1, '#c0c4ca');
      for (var i = 0; i < 14; i++) px(g, 40 - i, 21 + i * 2, 1, 2, '#c9a56a');
      px(g, 24, 48, 4, 3, '#c9a56a');
      if (on) Z.forEach(function (z) { for (var q = 0; q < 12; q += 2) { px(g, z.x + q, z.y, 1, 1, '#fff'); px(g, z.x + q, z.y + 9, 1, 1, '#fff'); } });
    }
    draw(false);
    var msg = el('div', 'margin:4px 0;min-height:18px', '아연을 끌어 어디에 달지 정하세요.');
    var zn = el('div', 'position:absolute;left:12px;top:12px;width:30px;height:18px;background:#c9ccd2;border:3px solid #7d828c;box-shadow:inset -3px -3px #9aa0a8;cursor:grab;box-sizing:border-box');
    zn.tabIndex = 0; zn.setAttribute('role', 'button'); zn.setAttribute('aria-label', '아연 덩이. 화살표로 옮기고 Enter로 놓기.');
    box.appendChild(zn);
    var pos = { x: 12, y: 12 }, drag = null;
    function place() { zn.style.left = pos.x + 'px'; zn.style.top = pos.y + 'px'; }
    function go(id) { if (has(view, id)) choose(id); }
    function back(t) { pos = { x: 12, y: 12 }; place(); draw(false); msg.textContent = t; }
    function drop() {
      var cx = (pos.x + 15) / K, cy = (pos.y + 9) / K;
      for (var i = 0; i < Z.length; i++) { var z = Z[i]; if (cx >= z.x - 2 && cx <= z.x + 14 && cy >= z.y - 3 && cy <= z.y + 12) return go(z.id); }
      back('거기엔 달 곳이 없다.');
    }
    zn.addEventListener('pointerdown', function (e) { drag = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }; zn.setPointerCapture(e.pointerId); draw(true); e.preventDefault(); });
    zn.addEventListener('pointermove', function (e) { if (!drag) return; pos.x = clamp(e.clientX - drag.dx, 0, 258); pos.y = clamp(e.clientY - drag.dy, 0, 174); place(); });
    zn.addEventListener('pointerup', function () { if (drag) { drag = null; drop(); } });
    zn.addEventListener('pointercancel', function () { drag = null; back('아연을 놓쳤다.'); });
    zn.addEventListener('keydown', function (e) {
      var d = { ArrowLeft: [-6, 0], ArrowRight: [6, 0], ArrowUp: [0, -6], ArrowDown: [0, 6] }[e.key];
      if (d) { pos.x = clamp(pos.x + d[0], 0, 258); pos.y = clamp(pos.y + d[1], 0, 174); place(); draw(true); e.preventDefault(); }
      else if (e.key === 'Enter' || e.key === ' ') { drop(); e.preventDefault(); }
    });
    box.appendChild(msg);
    var row = el('div', 'text-align:center');
    Z.forEach(function (z) { var b = el('button', BTN, z.n + '에 달기'); b.onclick = function () { go(z.id); }; row.appendChild(b); });
    box.appendChild(row);
  }

  // ② 거름종이: 비커 물 높이
  function chroma(box, view, choose) {
    var K = 4, a = cvs(48, 64, K), g = a[1], SP = 14, h = 0; box.appendChild(a[0]);
    a[0].setAttribute('role', 'img'); a[0].setAttribute('aria-label', '비커와 거름종이. 연필 기준선 위에 시료 점 넷.');
    var r = el('input', 'display:block;width:180px;margin:6px auto'); r.type = 'range'; r.min = 0; r.max = 30; r.value = 0;
    r.setAttribute('aria-label', '비커 물 높이');
    var out = el('div', 'text-align:center'), msg = el('div', 'text-align:center;min-height:18px'), btn = el('button', BTN, '전개 시작');
    function draw() {
      px(g, 0, 0, 48, 64, '#1b2633');
      px(g, 8, 14, 2, 48, '#cde'); px(g, 38, 14, 2, 48, '#cde'); px(g, 8, 60, 32, 2, '#cde');
      if (h) px(g, 10, 60 - h, 28, h, '#4f8fc4');
      px(g, 13, 2, 22, 58, '#f4efe2'); px(g, 12, 1, 24, 2, '#999');
      px(g, 13, 60 - SP, 22, 1, '#777');
      ['#7a4fb0', '#3a6fd8', '#8a4fa8', '#8a4fa8'].forEach(function (c, i) { px(g, 15 + i * 5, 59 - SP, 3, 2, c); });
      if (h) { g.globalAlpha = 0.5; px(g, 13, 60 - h, 22, h, '#5aa0d8'); g.globalAlpha = 1; }
      out.textContent = '물 높이 ' + h + '칸 · 점 높이 ' + SP + '칸';
    }
    r.addEventListener('input', function () { h = +r.value; msg.textContent = ''; draw(); });
    btn.onclick = function () {
      if (!h) { msg.textContent = '물이 없다. 높이를 정하자.'; return; }
      var id = h < SP ? 'c_low' : 'c_high';
      if (has(view, id)) choose(id);
    };
    draw();
    var row = el('div', 'text-align:center'); row.appendChild(btn);
    [r, out, msg, row].forEach(function (n) { box.appendChild(n); });
  }

  // ③ 분리 결과: 네 띠
  function bands(box, view, choose) {
    var K = 3, a = cvs(80, 56, K), g = a[1];
    var B = '#3a6fd8', R = '#c83a3a', P = '#f07ab8';
    var S = [['등대곶', 'r_light', [[B, 26]]], ['모래섬', 'r_sand', [[R, 38], [B, 26]]],
      ['북암', 'r_north', [[B, 38], [P, 10]]], ['압지 시료', null, [[B, 38], [P, 10]]]];
    px(g, 0, 0, 80, 56, '#1b2633');
    S.forEach(function (s, i) {
      var x = 3 + i * 19 + (i === 3 ? 2 : 0);
      px(g, x, 2, 12, 50, '#f4efe2'); px(g, x, 6, 12, 1, '#cfd8e0'); px(g, x, 46, 12, 1, '#888');
      s[2].forEach(function (b) { px(g, x + 2, b[1], 8, 3, b[0]); });
    });
    a[0].setAttribute('role', 'img');
    a[0].setAttribute('aria-label', '등대곶 파랑 하나. 모래섬 아래 빨강 위 파랑. 북암 아래 파랑 멀리 위 분홍. 압지 시료 아래 파랑 멀리 위 분홍.');
    box.appendChild(a[0]);
    var row = el('div', 'display:flex;justify-content:center;width:240px;margin:4px auto 0');
    S.forEach(function (s) {
      var cell = el('div', 'width:60px;text-align:center;font-size:12px');
      cell.appendChild(el('div', s[1] ? '' : 'color:#ffd27a', s[0]));
      if (s[1] && has(view, s[1])) { var b = el('button', BTN, '같다'); b.setAttribute('aria-label', s[0] + ' 띠와 같다'); b.onclick = function () { choose(s[1]); }; cell.appendChild(b); }
      row.appendChild(cell);
    });
    box.appendChild(row);
  }

  function mount(container, s, view, choose) {
    container.innerHTML = '';
    if (!view) return false;
    var f = view.title === '새 사슬' ? chain : has(view, 'c_low') ? chroma : has(view, 'r_north') ? bands : null;
    if (!f) return false;
    var box = el('div', BOX); container.appendChild(box);
    f(box, view, choose);
    return true;
  }

  window.VoyageLab = { mount: mount };
})();