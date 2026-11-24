// 화학자의 섬 v2 · 부표 수리용 재료
(function () {
  'use strict';
  const items = {
    chain: {name:'예비 사슬', detail:'손으로 들어 보니 고리가 단단하다. 끊어진 부표 사슬과 굵기가 같다.'},
    zinc: {name:'아연판', detail:'회색 판 한쪽에 볼트를 끼울 구멍이 있다. 뒷면에 작은 글씨로 Zn이 찍혀 있다.'}
  };
  const ids = Object.keys(items);
  function restore(s) {
    const p = s.pack || {};
    s.pack = {chain:!s.repaired && p.chain > 0 ? 1 : 0, zinc:!s.repaired && p.zinc > 0 ? 1 : 0};
  }
  function bag(s) { return ids.filter(id => s.pack?.[id] === 1); }
  function take(s,id) {
    if (!Object.hasOwn(items,id) || s.repaired || s.pack?.[id] === 1) return false;
    if (!s.pack) restore(s);
    s.pack[id] = 1;
    return true;
  }
  function ready(s) { return !s.repaired && bag(s).length === ids.length; }
  function install(s) {
    if (!ready(s)) return false;
    s.pack.chain=0; s.pack.zinc=0; s.repaired=true;
    return true;
  }
  function missing(s) { return s.repaired ? [] : ids.filter(id=>!s.pack?.[id]).map(id=>items[id].name); }
  window.Supplies = {items, restore, bag, take, ready, install, missing};
})();
