// 화학자의 섬 v2 · 마지막 우편선 — 첫 장 코어 (game.js)
(function () {
  'use strict';
  var X = { label: '닫기', id: 'close' };
  function D(t, x, c, k) { var r = { title: t, text: x, choices: (c || []).concat([X]) }; if (k) r.kind = k; return r; }
  function L(s, m) { if (s.log.indexOf(m) < 0) s.log.push(m); }
  var ISL = { mine: '붉은 만(옛 광산)', salt: '흰 띠(폐염전)' };

  function initial() {
    return { scene: 'harbor', returns: 0, finished: false, log: [], mineClue: false, saltClue: false, repaired: false,
      pack: {chain:0, zinc:0}, water: null, woodFrame:false, glassPane:false, still:false, flask:false, lampWashed:false, lampReady:false, mail: false, coupA: false, coupB: false, trip: null, first: null, visited: {}, lit: false,
      plate: false, lifted: false, gate: false, refs: false, line: false, ran: false };
  }

  function goal(s) {
    if(s.scene==='yard'){
      if(s.flask)return '증류수를 담았다. 등대지기에게 돌아가거나 다음 항해를 준비하자.';
      if(s.still)return '증류기 안쪽 물받이에 모인 물을 작은 병에 받자.';
      if(s.woodFrame && s.glassPane)return '작업대의 바닷물 대야에 모은 재료로 증류기를 만들자.';
      return '마당에서 나무틀과 유리판을 찾아보자.';
    }
    if (s.finished) return '북암 항로가 지도에 올랐다. 섬들을 자유롭게 다시 찾아가자.';
    if (!s.repaired) {
      if (Supplies.ready(s)) return '작업대에 모은 재료를 펼쳐 부표를 고쳐 보자.';
      return Supplies.bag(s).length ? '부두 곳곳에 쓸 만한 정비 자재가 더 있을 것 같다.' : '부표 사슬이 끊겼다. 부두에서 쓸 만한 물건을 찾아보자.';
    }
    if (s.scene === 'mine') return !s.plate ? '권양기 명판을 읽어 보자.' : !s.lifted ? '권양기로 물속 상자를 끌어올리자.' : !s.mineClue ? '난파선 옆 상자를 열자.' : '배로 항구에 돌아가자.';
    if (s.scene === 'salt') return !s.gate ? '굳은 수문을 열자.' : !s.saltClue ? '창고의 우편행낭을 조사하자.' : '배로 항구에 돌아가자.';
    if (s.mineClue && s.saltClue) return s.refs ? '작업대에서 잉크를 분리해 보자.' : '우체국에서 소인 잉크 견본을 받자.';
    if (!s.mineClue && !s.saltClue) return '우편정에 올라 광산 만과 염전 중 첫 기항지를 고르자.';
    return s.mineClue ? '다음 썰물에 염전을 찾아가자.' : '다음 썰물에 광산 만을 찾아가자.';
  }

  function chainMenu() {
    return D('부표 사슬 수리', '부표 아래 강철 사슬이 바닷속에 잠겨 있다. 사슬의 부식을 늦추려면 아연판을 어디에 달아야 할까?', [
      {label:'물 위 금속 고리',id:'z_high'},{label:'섬유 밧줄 끝',id:'z_rope'},{label:'물속 강철 연결쇠',id:'z_bolt'}], 'rig');
  }
  function chromaResult() {
    return D('분리 결과', '등대곶: 파랑 한 줄.\n모래섬: 아래 빨강, 위 파랑.\n북암: 아래 파랑, 멀리 위 분홍.\n압지 시료: 아래 파랑, 멀리 위 분홍.\n\n분류표 뒷면: "임시 1회 기항." 지명은 지워졌다.\n물새호는 어디에 들렀나?',
      [{ label: '등대곶', id: 'r_light' }, { label: '모래섬', id: 'r_sand' }, { label: '북암', id: 'r_north' }], 'ink');
  }

  function salvage(s,id) {
    if (!Supplies.take(s,id)) return null;
    return {pickup:id, text:Supplies.items[id].name+'을 가방에 넣었다.'};
  }
  function waterSource(s,type) {
    var fresh=type==='rain', name=fresh?'빗물통':'소금물 웅덩이';
    if(s.gate) return D(name, fresh?'처마에서 모인 빗물이 남아 있다.':'바닥에 녹지 않은 소금 결정이 보인다.');
    if(s.water===type) return D(name,'가방 속 물병에 이곳의 물이 들어 있다.');
    return D(name, (fresh?'처마 홈통에서 흘러온 빗물이다.':'얕은 물 바닥에 소금 결정이 수북하다.') +
      (s.water?'\n물병을 비우면 이 물로 바꿔 담을 수 있다.':'\n물통 곁에 빈 물병이 있다. 조금 담아 갈 수 있다.'),
      [{label:s.water?'물병을 비우고 바꿔 담기':'물병에 담기',id:'fill_'+type}]);
  }
  function fill(s,type) {
    if(s.gate || s.scene!=='salt') return null;
    s.water=type;
    return {pickup:type,text:(type==='rain'?'빗물':'소금물')+'을 물병에 담았다.'};
  }
  var SPOT = {
    harbor: {
      chain: function(s){return salvage(s,'chain');},
      zinc: function(s){return salvage(s,'zinc');},
      post: function (s) {
        if (!s.mail && !(s.mineClue && s.saltClue)) { s.mail = true; L(s, '물새호가 열이틀째 돌아오지 않았다.');
          if(s.repaired) return D('우체국','오 국장이 낡은 항로도를 편다. “부표를 세워 줬구나. 광산 만이나 옛 염전에 가거든 물새호 소식 좀 알아봐 주겠니?”');
          return D('우체국', '오 국장이 물에 젖은 봉투를 펼친다. 폐쇄된 항로의 소인이다.\n"옛 뱃길을 보러 간 물새호가 열이틀째 안 와.\n부표 사슬이 끊겨 우편정도 묶였지.\n작업대에 옛 정비 기록이 있네."'); }
        if (s.finished) return D('우체국', '"북암행 우편이 모이고 있어.\n주소 쓰는 사람이 늘었네."');
        if (s.mineClue && s.saltClue && !s.refs) { s.mail = true; s.refs = true; L(s, '소인 잉크 견본 셋을 받았다(원본 대장은 그대로).');
          return D('우체국', '"원본 대장엔 손대지 말게."\n국장이 등대곶·모래섬·북암 소인대를\n새 종이에 하나씩 찍어 준다.', [], 'samples'); }
        return D('우체국', '"' + goal(s) + '"\n국장은 그 말만 하고 장부로 돌아간다.');
      },
      chief: function(s){ return SPOT.harbor.post(s); },
      keeper: function(s){
        if(s.lampReady)return D('등대지기','“저 빛이 보이나? 해 질 때 우편정이 저걸 보고 부두 끝을 찾아.”');
        if(s.lampWashed)return D('등대지기','유리가 맑아졌다. 등대지기가 가리킨 물길 쪽으로 가림판을 열면 빛이 나간다.',[{label:'물길 쪽 가림판 열기',id:'light_pier'}]);
        return D('등대지기','등대지기가 손등으로 부두 등불의 유리를 문지른다. “바닷물로 닦고 말리면 또 하얘져. 우체국 뒤 작업마당에 민물을 모으던 대야가 있었는데.”',s.flask?[{label:'가방의 증류수로 유리 헹구기',id:'wash_lamp'}]:[]);
      },
      bench: function (s) {
        if (!s.repaired) {
          var c = [{label:'정비 기록 A 펼치기', id:'coupA'},{label:'정비 기록 B 펼치기',id:'coupB'}];
          if (Supplies.ready(s)) c.unshift({label:'가방의 재료로 수리하기',id:'chain'});
          else c.push({label:'남은 자재의 행방 살피기',id:'stock_note'});
          var text=Supplies.ready(s)?'끊어진 부표가 작업대에 누워 있다. 모은 사슬과 아연판을 옆에 펼쳤다.':'부표 아래쪽에 끊어진 사슬 한 토막이 매달려 있다. 그 옆에 낡은 정비 기록 두 장이 놓여 있다.';
          return D('작업대',text,c,'bench');
        }
        if (s.finished) return D('작업대', '말린 거름종이 띠 넷. 분홍 띠가 아직 선명하다.');
        if (!(s.mineClue && s.saltClue)) return D('작업대', '단서가 더 필요하다.');
        if (!s.refs) return D('작업대', '비교할 기준 견본이 없다. 우체국 소인대로.');
        if (s.ran) return chromaResult();
        if (!s.line) return D('크로마토그래피', '거름종이 띠 넷. 먼저 기준선을 긋는다.',
          [{ label: '수성펜으로 긋는다', id: 'c_pen' }, { label: '연필로 긋는다', id: 'c_pencil' }], 'ink');
        return D('크로마토그래피', '견본 셋, 압지 시료 하나를 선 위에 찍었다.\n비커에 물을 얼마나 부을까?',
          [{ label: '점보다 높게', id: 'c_high' }, { label: '점보다 낮게', id: 'c_low' }], 'ink');
      },
      boat: function (s) {
        if (!s.repaired) return D('우편정', '부표가 없으면 암초 사이로 못 나간다.');
        var t = s.mail?'물이 빠졌다. 이번 썰물에 다녀올 섬을 고르자.':'배 안에 젖은 쪽지가 있다. 물새호가 열이틀째 돌아오지 않았단다.\n썰물인 지금, 어느 섬에서부터 찾아볼까?';
        if (s.lit) t += '\n등대 불빛이 뱃길을 긋는다.';
        return D('출항', t, [{ label: ISL.mine + (s.visited.mine ? ' ✓' : ''), id: 'go_mine' },
          { label: ISL.salt + (s.visited.salt ? ' ✓' : ''), id: 'go_salt' }], 'route');
      },
      board: function (s) {
        return D('게시판', '목표: ' + goal(s) + '\n\n' + (s.log.length ? s.log.join('\n') : '아직 기록 없음.'), [], s.finished ? 'map' : 'log');
      }
    },
    yard: {
      frame: function(s){ if(s.still||s.woodFrame)return null; s.woodFrame=true; return {pickup:'woodFrame',text:'나무틀을 가방에 넣었다.'}; },
      pane: function(s){ if(s.still||s.glassPane)return null; s.glassPane=true; return {pickup:'glassPane',text:'유리판을 가방에 넣었다.'}; },
      still: function(s){
        if(s.flask)return D('작업마당의 증류기','가방의 작은 병은 가득 찼다. 물받이 아래엔 새 물방울이 맺힌다.');
        if(s.still)return D('작업마당의 증류기','햇살에 데워진 바닷물에서 물이 증발한다. 기울인 유리 안쪽의 물방울이 가장자리를 타고 별도의 물받이에 떨어진다.',[{label:'시간을 보내고 증류수 받기',id:'decant'}]);
        return D('볕 드는 작업대','검은 대야에는 바닷물이, 옆에는 빈 물받이가 있다. 대야 위에 비스듬히 세울 나무틀과 유리판이 필요하다.',s.woodFrame&&s.glassPane?[{label:'나무틀에 유리판을 끼워 덮기',id:'build_still'}]:[]);
      },
      exit: function(){return D('부두로 난 길','나무 발판을 따라가면 우체국 앞이다.',[{label:'선착장으로 걷기',id:'leave_yard'}]);}
    },
    mine: {
      winch: function (s) {
        if (!s.plate) return D('권양기', '녹청이 명판을 덮었다. 글자가 안 보인다.',
          [{ label: '철솔로 닦는다', id: 'p_brush' }, { label: '식초를 붓는다', id: 'p_vin' }, { label: '종이를 대고 연필로 문지른다', id: 'p_rub' }]);
        if (!s.lifted) return D('권양기', '탁본: "제동은 왼쪽 레버를 당긴 채 감을 것."',
          [{ label: '오른쪽 레버로 감는다', id: 'w_bad' }, { label: '왼쪽 레버를 당기고 감는다', id: 'w_ok' }]);
        return D('권양기', '쇠줄이 팽팽하다. 할 일은 끝났다.');
      },
      wreck: function (s) {
        if (s.finished) return D('전마선', '뱃머리가 북쪽을 향해 기울어 있다.');
        if (!s.lifted) return D('전마선', '물새호의 전마선. 주황 물에 반쯤 잠겼다.\n물속 철 이온이 산화되며 생긴 갈색 침전물이 바위에 남아 있다.\n바닥에 쇠상자가 보인다. 손이 안 닿는다.');
        if (!s.mineClue) return D('전마선', '건져 올린 쇠상자. 밀랍 봉인이 남았다.', [{ label: '연다', id: 'box' }]);
        return D('전마선', '빈 상자. 압지 시료는 챙겼다.');
      },
      boat: function (s) { return D('우편정', '물이 들어오기 전에 돌아가야 한다.', [{ label: '항구로 귀항', id: 'home' }]); }
    },
    salt: {
      rain: function(s){return waterSource(s,'rain');},
      brine: function(s){return waterSource(s,'brine');},
      gate: function (s) {
        if (s.gate) return D('수문', '열린 수문으로 바람이 지난다.');
        var choices=s.water?[{label:'가방의 '+(s.water==='rain'?'빗물':'소금물')+' 붓기',id:s.water==='rain'?'g_rain':'g_brine'}]:[];
        if(s.flask) choices.push({label:'가방의 증류수 붓기',id:'g_distilled'});
        return D('수문','경첩 사이로 하얀 소금 결정이 빽빽하다. 손잡이를 당겨도 꿈쩍하지 않는다.' +
          (s.water?'':'\n물레방아 옆 웅덩이와 창고 처마 아래 물통에 물이 고여 있다.'),choices);
      },
      shed: function (s) {
        if (s.finished) return D('창고', '분류표 자리에 새 표가 꽂혔다. "북암."');
        if (!s.gate) return D('창고', '창고 앞이 물에 잠겼다. 수문부터.');
        if (!s.saltClue) return D('창고', '벽에 우편행낭이 걸려 있다. 소금기에 빳빳하다.', [{ label: '행낭을 연다', id: 'bag' }]);
        return D('창고', '빈 고리. 분류표는 챙겼다.');
      },
      boat: function (s) { return D('우편정', '물이 들어오기 전에 돌아가야 한다.', [{ label: '항구로 귀항', id: 'home' }]); }
    }
  };

  function interact(s, id) {
    var f = SPOT[s.scene] && SPOT[s.scene][id];
    var view=f ? f(s) : null;
    if(view && s.scene==='harbor' && (id==='post'||id==='chief')){
      if(id==='chief')view.title='오 국장';
      if(!s.still)view.text+='\n“우체국 뒤에 쓰던 유리판이 있네. 필요하면 가져가게.”';
      view.choices.splice(view.choices.length-1,0,{label:'뒤쪽 작업마당으로 걷기',id:'enter_yard'});
    }
    return view;
  }

  function go(s, isl) {
    if (!s.repaired || s.scene !== 'harbor') return null;
    s.scene = isl; s.trip = isl; s.visited[isl] = true; if (!s.first) s.first = isl;
    return D('출항', isl === 'mine' ? '물이 녹슨 주황빛. 바위마다 갈색 앙금.\n멀리 권양기 하나가 서 있다.' : '갯벌 끝 흰 결정 띠. 바람이 짜다.\n수문 너머 낮은 창고.');
  }
  function retry(t, x, back) { return D(t, x, [{ label: '다시', id: back }]); }

  var ACT = {
    enter_yard: function(s){if(s.scene!=='harbor')return null;s.scene='yard';return null;},
    leave_yard: function(s){if(s.scene!=='yard')return null;s.scene='harbor';return null;},
    build_still: function(s){
      if(s.scene!=='yard'||s.still||!s.woodFrame||!s.glassPane)return null;
      s.woodFrame=s.glassPane=false;s.still=true;
      L(s,'우체국 뒤에 태양열 증류기를 세웠다.');
      return SPOT.yard.still(s);
    },
    decant: function(s){
      if(s.scene!=='yard'||!s.still||s.flask)return null;
      s.flask=true;return {pickup:'flask',text:'볕이 기울 무렵, 증류수 한 병을 받았다.'};
    },
    wash_lamp: function(s){
      if(s.scene!=='harbor'||!s.flask||s.lampWashed)return null;
      s.flask=false;s.lampWashed=true;return SPOT.harbor.keeper(s);
    },
    light_pier: function(s){
      if(s.scene!=='harbor'||!s.lampWashed||s.lampReady)return null;
      s.lampReady=true;L(s,'등대지기와 함께 부두 끝 등불을 밝혔다.');
      return D('부두 끝 등불','가림판이 열리자 물 위에 금빛 한 줄이 비친다. 등대지기가 우편정을 향해 손을 든다.');
    },
    g_distilled: function(s){
      if(s.scene!=='salt'||!s.flask||s.gate)return null;
      s.flask=false;s.gate=true;return D('수문','마당에서 모아 둔 물에 경첩의 소금 결정이 녹는다. 손잡이가 돌아가고 창고 앞 물이 빠진다.');
    },
    fill_rain: function(s){return fill(s,'rain');},
    fill_brine: function(s){return fill(s,'brine');},
    stock_note: function(s){
      var notes=[];
      if(!s.pack.chain) notes.push('사슬을 마지막으로 풀어 둔 곳은 부두 입구의 낮은 나무 발판이다.');
      if(!s.pack.zinc) notes.push('작은 금속 부속은 배로 가는 길목의 초록 정비 상자에 보관한다.');
      return D('정비 당번의 메모',notes.join('\n')||'필요한 자재가 가방에 있다.');
    },
    coupA: function (s) { s.coupA = true; if (s.coupB) L(s, '같은 바닷물 속에서 전기적으로 연결된 아연이 먼저 부식되어 강철을 보호했다.');
      return D('시험편 A', '같은 바닷물에 담가 두었더니, 아연판은 부식되어 얇아졌고 강철 표면에는 붉은 녹이 거의 보이지 않았다.\n\n정비 일지\n“볼트가 풀려 아연판과 강철 사이의 전기적 연결이 끊긴 달에는 강철 표면에도 붉은 녹이 생겼다.”', (Supplies.ready(s) ? [{label:'가방의 재료로 수리하기',id:'chain'}] : []).concat([{ label: 'B 보기', id: 'coupB' }]), 'samples'); },
    coupB: function (s) { s.coupB = true; if (s.coupA) L(s, '같은 바닷물 속에서 전기적으로 연결된 아연이 먼저 부식되어 강철을 보호했다.');
      return D('시험편 B', 'A와 같은 강철을 같은 기간 동안 같은 바닷물에 담가 두었다. 이 강철에는 아연판을 연결하지 않았다.\n\n표면 여러 곳에 붉은 녹이 보이고, 일부가 움푹 패어 있다.', (Supplies.ready(s) ? [{label:'가방의 재료로 수리하기',id:'chain'}] : []).concat([{ label: 'A 보기', id: 'coupA' }]), 'samples'); },
    chain: function (s) { return (s.scene==='harbor' && Supplies.ready(s)) ? chainMenu() : null; },
    z_rope: function () {
      return D('밧줄 끝에 단 아연판','아연판은 바닷물에 잠겼다. 하지만 섬유 밧줄에만 매달려 있어 사슬까지 전자가 흐를 금속 경로가 없다. 이 위치에서는 강철을 보호할 수 없다.',[{label:'다른 곳에 달아 보기',id:'chain'}],'rig-rope');
    },
    z_high: function () {
      return D('물 위 고리에 단 아연판','금속 고리는 사슬과 전기적으로 이어져 있다. 하지만 이 고리는 계속 수면 위에 있어 아연판이 마른 상태다. 이 위치에서는 물속 사슬에 보호 전류를 공급할 수 없다.',[{label:'다른 곳에 달아 보기',id:'chain'}],'rig-high');
    },
    z_bolt: function (s) {
      if(s.scene!=='harbor'||!Supplies.install(s))return null;
      L(s,'부표 사슬 교체. 물속의 강철 연결쇠에 아연판을 볼트로 고정했다.');
      return D('부표 복구','아연판과 사슬이 같은 바닷물에 잠기고, 강철 연결쇠를 통해 전기가 통한다. 아연이 먼저 산화되어 전자를 공급하므로 강철의 부식이 느려진다.\n\n빨간 부표가 다시 섰다. 이제 우편정으로 출항할 수 있다.',[],'rig-bolt');
    },
    go_mine: function (s) { return go(s, 'mine'); },
    go_salt: function (s) { return go(s, 'salt'); },
    home: function (s) {
      if (!Object.hasOwn(ISL,s.scene)) return null;
      s.scene = 'harbor'; s.trip = null; s.returns++;
      var t = '우편정이 부두에 닿았다.';
      if (s.returns === 1) { s.lit = true; L(s, '등대에 불이 켜졌다. 정기선 운항 재개.');
        t += '\n등대지기가 불을 올린다. 끊겼던 정기선이 다시 포구를 지난다.\n오 국장: ' + (s.first === 'mine' ? '"광산부터라. 폐쇄 뒤 기항이 끊긴 곳이지."' : '"염전부터라. 물새호가 마지막으로 소금을 실은 데야."'); }
      return D('귀항', t);
    },
    p_brush: function () { return retry('멈춤', '철솔은 얕은 각인까지 긁어낸다.', 'p_back'); },
    p_vin: function () { return retry('멈춤', '산을 쓰면 명판 표면과 남은 흔적까지 손상될 수 있다.\n원본에는 쓰지 않는다.', 'p_back'); },
    p_back: function (s) { return interact(s, 'winch'); },
    p_rub: function (s) { s.plate = true; L(s, '권양기 명판 탁본: 북암 광업소, 왼쪽 레버 제동.');
      return D('탁본', '볼록한 글자만 검게 떠오른다.\n"북암 광업소. 제동은 왼쪽 레버를 당긴 채 감을 것."'); },
    w_bad: function () { return retry('철렁', '드럼이 미끄러져 쇠줄이 풀렸다. 탁본 순서를 다시 본다.', 'p_back'); },
    w_ok: function (s) { if (!s.plate) return null; s.lifted = true; return D('권양기', '덜컥, 덜컥. 물 밑에서 쇠상자가 올라와 전마선 옆에 놓인다.'); },
    box: function (s) { if (!s.lifted) return null; s.mineClue = true; L(s, '광산 만: 물새호 전마선. 압지에 거꾸로 찍힌 소인 잉크.');
      return D('쇠상자', '우편 기록부는 물에 번졌다.\n맞붙은 압지에 소인 잉크가 거꾸로 찍혀 남았다.\n압지의 잉크 자국에서 분석용 소량 시료를 따로 챙긴다.', [], 'samples'); },
    g_brine: function (s) { if(s.scene!=='salt'||s.water!=='brine'||s.gate)return null; s.water=null; return D('남아 있는 결정','물병을 비웠지만 경첩에 흰 결정이 남았다. 웅덩이 물에는 이미 소금이 녹을 만큼 녹아 있었다.'); },
    g_rain: function (s) { if(s.scene!=='salt'||s.water!=='rain'||s.gate)return null; s.water=null; s.gate = true; return D('수문', '민물에 결정이 녹아내린다.\n수문이 열리고 창고 앞 물이 빠진다.'); },
    bag: function (s) { if (!s.gate) return null; s.saltClue = true; L(s, '염전 창고: 분류표 "북암 기항 폐지", 뒷면 "임시 1회 기항".');
      return D('분류표', '"정기 항로 등대곶→모래섬.\n북암 기항 폐지(광업소 폐쇄)."\n뒷면 연필: "임시 1회 기항." 지명은 번져 지워졌다.', [], 'samples'); },
    c_pen: function () { return retry('번짐', '수성펜 잉크까지 물에 녹아 올라간다.\n엉뚱한 띠가 섞인다. 새 띠로.', 'c_back'); },
    c_pencil: function (s) { if (!s.refs) return null; s.line = true; return interact(s, 'bench'); },
    c_high: function () { return retry('녹아버림', '점이 물에 잠겨 비커 속으로 풀렸다.\n따로 나눈 시료가 남아 있다. 새 띠로.', 'c_back'); },
    c_low: function (s) { if (!s.line) return null; s.ran = true; L(s, '크로마토그래피: 압지 시료와 북암 견본의 띠가 같다.'); return chromaResult(); },
    c_back: function (s) { return interact(s, 'bench'); },
    r_light: function () { return retry('아니다', '등대곶은 파랑 하나뿐. 분홍이 없다.', 'r_back'); },
    r_sand: function () { return retry('아니다', '눈으로는 둘 다 보랏빛.\n하지만 모래섬은 빨강이 아래에 남는다.', 'r_back'); },
    r_back: function (s) { return s.ran ? chromaResult() : null; },
    r_north: function (s) { if (!s.ran) return null; s.finished = true; L(s, '물새호는 폐쇄된 북암에 들렀다.');
      return D('첫 장 끝', '물새호는 끊긴 항로, 북암에 들렀다.\n오 국장이 지도에 북쪽 선을 다시 긋는다.\n"거기 아직 편지 받을 사람이 있었나 보군."\n다음 정기선이 키를 북으로 돌린다.\n\n섬들은 언제든 다시 찾아갈 수 있다.', [], 'map'); }
  };

  function act(s, action) {
    if (action === 'close') return null;
    var f = ACT[action];
    return f ? f(s) : null;
  }

  window.Voyage = { initial: initial, goal: goal, interact: interact, act: act };
})();