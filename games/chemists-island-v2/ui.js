(() => {
  'use strict';
  const chapter=new URLSearchParams(location.search).get('chapter');
  const northEntry=chapter==='north',westEntry=chapter==='west';
  const newVoyage=westEntry?Voyage.westStart:northEntry?Voyage.northStart:Voyage.initial;
  const $=id=>document.getElementById(id), panel=$('panel'), SAVE='kje.chemists-island.v2.last-mailboat.1'+(westEntry?'.west':northEntry?'.north':'');
  let state=null, trial=false, movingScene=false, previousFocus=null, pickupTimer, storageError=false;
  function read(){
    try{
      const data=JSON.parse(localStorage.getItem(SAVE));
      if(!data||data.version!==1||!data.game||!Object.hasOwn(World.scenes,data.game.scene))return null;
      const draft={...Voyage.initial(),...data.game};
      if(!Array.isArray(draft.log)||!draft.visited||typeof draft.visited!=='object')return null;
      if(!data.game.pack && !draft.repaired && draft.coupA && draft.coupB) draft.pack={chain:1,zinc:1};
      Supplies.restore(draft);WestStory.restore(draft,data.game);
      if(!['rain','brine'].includes(draft.water)||draft.gate)draft.water=null;
      return draft;
    }catch{return null;}
  }
  function save(){
    if(trial){$('save-status').classList.remove('warn');$('save-status').textContent='첫 수리 체험 중';return;}
    try{localStorage.setItem(SAVE,JSON.stringify({version:1,game:state}));storageError=false;}
    catch{storageError=true;}
    $('save-status').classList.toggle('warn',storageError);
    $('save-status').textContent=storageError?'저장 불가 · 이 창에서만 진행':'이 기기에 저장됨';
  }
  function cover(){
    const stored=read();
    $('try-repair').hidden=westEntry||northEntry||!stored?.repaired;
    if(northEntry){
      document.body.classList.add('north-entry');
      document.querySelector('.chapter').textContent='둘째 장 · 북암의 답장';
      document.querySelector('.intro').textContent='실종된 물새호의 굴뚝이 보인다. 건너편 사람이 왜 다리를 내려 달라고 손짓할까?';
      $('chapter-route').href='?v=north1';$('chapter-route').textContent='첫 장 항해로';
    }
    if(westEntry){
      document.body.classList.add('west-entry');
      document.querySelector('.chapter').textContent='셋째 장 · 서쪽 갱구의 우편함';
      document.querySelector('.intro').textContent='간판이 바랜 갱구가 둘. 석 어르신은 마지막 우편차가 어느 쪽으로 들어갔는지 찾고 있다.';
      $('west-route').href='?v=west2';$('west-route').textContent='첫 장 항해로';
    }
    $('start').textContent=stored?'항해 이어하기':westEntry?'광업소 마당으로':northEntry?'북암에 상륙':'첫 항해 시작';
    $('resume-info').textContent=stored?(stored.westStamp?'서쪽 갱구의 우편함 · 배달 완료':stored.northDelivered?'셋째 장 · 서쪽 갱구의 우편함':stored.finished?'둘째 장 · 북암의 답장':World.scenes[stored.scene].name+' · 귀항 '+stored.returns+'회'):westEntry?'셋째 장부터 시작하는 별도 저장 항해':northEntry?'북암부터 시작하는 별도 저장 항해':'';

  }
  function hud(){
    $('place').textContent=World.scenes[state.scene].name;
    $('tide').textContent=WestStory.isField(state.scene)?'셋째 장 · 서쪽 갱구의 우편함':state.scene==='north'?(state.northDelivered?'서쪽 광업소로 가는 길':'둘째 장 · 북암의 답장'):state.scene==='harbor'?(state.returns?'귀항 '+state.returns+'회 · 등대 점등':'첫 출항 전'):(state.scene==='yard'?'우체국 뒤뜰':'간조 · 연안 탐사');
    $('goal').textContent=trial&&state.repaired&&state.scene==='harbor'?'다시 뜬 빨간 부표가 보인다. 원래 항해로 돌아가자.':Voyage.goal(state);
  }
  const waterItems={...WestStory.contents,
    cord:{name:'삼줄 타래',detail:'창고 앞에서 주운 마른 줄.'},magnet:{name:'고리 달린 자석',detail:'고리에 줄을 단단히 묶을 수 있다.'},
    retriever:{name:'자석줄',detail:'점검홈 아래까지 닿는 손수 만든 도구.'},crankPin:{name:'강철 고정핀',detail:'도개교 손잡이 축에 맞는다.'},
    copper:{name:'피복 구리선',detail:'양 끝을 벗기면 구리 심선이 드러난다.'},reply:{name:'북암의 답장',detail:'석 어르신이 오 국장 앞으로 보낸 봉투.'},
    missingMail:{name:'하은이 옮겨 적은 미배달 기록',detail:'북암 우체소 옛 장부의 마지막 줄. “마지막 운행일 · 서안 우편함 한 개 미인도.”'},
    survey:{name:'옛 광업소 측량도',detail:'석 어르신이 그린 북암 서쪽 해안의 길.'},
    woodFrame:{name:'나무틀',detail:'유리판을 비스듬히 받칠 수 있다.'},
    glassPane:{name:'유리판',detail:'작업마당에서 찾은 투명한 창유리.'},
    flask:{name:'증류수 한 병',detail:'태양열 증류기의 물받이에서 받았다.'},
    rain:{name:'빗물 한 병',detail:'창고 처마 아래에서 받은 빗물. 바닥에 소금 결정이 없다.'},
    brine:{name:'소금물 한 병',detail:'염전 웅덩이의 포화 소금물. 바닥에 소금 결정이 쌓여 있었다.'},
    ink:{name:'압지 시료',detail:'광산 만에서 건진 종이. 번진 소인의 색이 희미하게 남았다.'},
    ledger:{name:'접힌 분류표',detail:'옛 염전 창고에서 꺼낸 우편 분류표. 뒷면에 임시 기항 기록이 남았다.'}
  };
  function packContents(){
    const ids=Supplies.bag(state);
    for(const id of Object.keys(WestStory.contents))if(state[id])ids.push(id);
    if(state.water)ids.push(state.water);
    for(const id of ['cord','magnet','retriever','crankPin','copper','reply'])if(state[id])ids.push(id);
    if(state.reply||state.northDelivered)ids.push('survey','missingMail');
    for(const part of ['woodFrame','glassPane','flask'])if(state[part])ids.push(part);
    if(state.mineClue)ids.push('ink');
    if(state.saltClue)ids.push('ledger');
    return ids;
  }
  function drawPack(ids){
    const tray=$('diagram');tray.className='bag-tray';tray.hidden=!ids.length;
    for(const id of ids){
      const item=Supplies.items[id]||waterItems[id];
      const row=document.createElement('div'), icon=document.createElement('i'), copy=document.createElement('div'), name=document.createElement('strong'), detail=document.createElement('span');
      row.className='bag-row';icon.className='stamp stamp-'+id;icon.setAttribute('aria-hidden','true');name.textContent=item.name;detail.textContent=item.detail;
      copy.append(name,detail);row.append(icon,copy);tray.append(row);
    }
  }
  function showPack(){
    if(movingScene||panel.open)return;
    const ids=packContents();
    drawDialog({title:'내 가방',text:ids.length?'':(state.repaired?'부표에 쓴 재료 자리가 비었다.':'아직 가방이 비어 있다. 부두를 걸으며 쓸 만한 물건을 챙겨 보자.')},choose,'소지품');
    drawPack(ids);
    if(ids.includes('mailCard')){
      const b=document.createElement('button');b.textContent='준의 엽서 읽기';b.onclick=()=>drawDialog({title:'준의 엽서',text:'북암 광업소 석 선생님 앞으로 온 우편물.',kind:'west-postcard'},choose,'가방');$('choices').prepend(b);
    }
    if(ids.includes('survey')){
      const b=document.createElement('button');b.textContent='측량도 펼치기';b.onclick=()=>{const v=WestStory.survey(state);save();hud();drawDialog(v,choose,'가방');};$('choices').prepend(b);
    }
  }
  $('pack').onclick=showPack;
  function pickup(view){
    if(panel.open)close();
    const notice=$('pickup');clearTimeout(pickupTimer);notice.textContent=view.text;
    notice.classList.add('shown');pickupTimer=setTimeout(()=>notice.classList.remove('shown'),2500);
    if(view.pickup==='chipLeft'||view.pickup==='chipRight')World.gather();
    World.refresh();
  }
  function clearNotice(){clearTimeout(pickupTimer);$('pickup').classList.remove('shown');$('pickup').textContent='';}
  function close(){if(panel.open)panel.close();World.pause(movingScene);if(previousFocus?.isConnected&&previousFocus.offsetWidth)previousFocus.focus({preventScroll:true});}
  function standardButtons(view,select){
    const buttons=$('choices');buttons.replaceChildren();
    const alternative=$('diagram').classList.contains('interactive-lab')?document.createElement('details'):null;
    if(alternative){const summary=document.createElement('summary');summary.textContent='선택 버튼으로 조작';alternative.append(summary);buttons.append(alternative);}
    for(const choice of view.choices||[{label:'닫기',id:'close'}]){
      if(view.kind==='rig'&&choice.id!=='close')continue;
      const b=document.createElement('button');b.type='button';b.textContent=choice.label;b.dataset.action=choice.id;
      if(choice.id==='close')b.className='muted';
      b.onclick=()=>choice.id==='close'?close():select(choice.id);(alternative&&choice.id!=='close'?alternative:buttons).append(b);
    }
  }
  function drawCoupon(canvas,connected){
    canvas.width=512;canvas.height=248;
    const g=canvas.getContext('2d');g.scale(2,2);
    let seed=connected?11:7;
    const rnd=()=> (seed=seed*16807%2147483647)/2147483647;
    const box=(x,y,w,h,color)=>{g.fillStyle=color;g.fillRect(x,y,w,h);};
    box(19,41,218,62,'#3c4e56');box(19,40,218,5,'#85989c');box(20,100,216,5,'#283a44');
    for(let i=0;i<40;i++)box(23+rnd()*186,47+rnd()*48,2+rnd()*18,.7,'#627781');
    if(connected){
      box(151,47,64,46,'#8a9698');box(151,46,63,43,'#c8d0cc');box(153,47,59,2,'#edf1dd');
      for(let i=0;i<22;i++)box(154+rnd()*52,51+rnd()*31,1+rnd()*5,2,'#e7e8dc');
      g.beginPath();
      for(let k=0;k<6;k++){const a=k*Math.PI/3;g.lineTo(182+11*Math.cos(a),66+11*Math.sin(a));}
      g.closePath();g.fillStyle='#79878a';g.fill();g.strokeStyle='#495960';g.lineWidth=2;g.stroke();
      g.fillStyle='#b3bdb9';g.fillRect(177,63,10,3);
      g.fillStyle='#394b4d';g.font='bold 18px sans-serif';g.textAlign='center';g.fillText('아연판',182,24);
      g.beginPath();g.moveTo(183,29);g.lineTo(183,44);g.stroke();
    }else{
      g.save();g.beginPath();g.rect(20,43,216,58);g.clip();
      for(let i=0;i<30;i++){
        const x=25+rnd()*204,y=45+rnd()*55,r=4+rnd()*14;
        g.beginPath();for(let k=0;k<9;k++){const a=k*Math.PI*2/9,rr=r*(.52+rnd()*.55);g.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr*.7);}
        g.closePath();g.fillStyle=['#a95732','#a34427','#87482d','#bc6b37'][i%4];g.fill();
        g.fillStyle='#532d25';g.fillRect(x-1,y-1,2.5,2.5);
      }
      g.restore();
    }
  }
  function specimens(title){
    const d=$('diagram');d.className='specimens';
    for(const [key,name] of [['A','아연이 연결된 강철'],['B','아연을 연결하지 않은 강철']]){
      const f=document.createElement('figure'),c=document.createElement('canvas'),l=document.createElement('figcaption');
      c.setAttribute('role','img');c.setAttribute('aria-label',key==='A'?'강철판 일부에 볼트로 고정한 작은 아연판':'강철판 표면 곳곳의 붉은 녹');
      drawCoupon(c,key==='A');l.textContent=key+' · '+name;
      f.classList.toggle('selected',title==='시험편 '+key);f.append(c,l);d.append(f);
    }
    d.hidden=false;
  }
  function drawDialog(view,select,label){
    if(!view){close();return;}
    clearNotice();
    const opened=panel.open;
    if(!opened)previousFocus=document.activeElement;
    World.pause(true);
    $('panel-label').textContent=label||World.scenes[state.scene].name;$('panel-title').textContent=view.title;$('panel-text').textContent=view.text;
    const d=$('diagram');d.replaceChildren();d.hidden=true;d.className='';
    if(view.kind==='rig'||view.kind?.startsWith('rig-')){
      d.hidden=false;d.className='rig-panel';VoyageLab.rig(d,view,select);
    }else if(WestLab.mount(d,state,view,select)||NorthLab.mount(d,view,select)){d.hidden=false;}
    else if(window.VoyageLab?.mount(d,state,view,select)){d.hidden=false;d.className='interactive-lab';}
    else if(view.kind==='samples'&&['작업대','시험편 A','시험편 B'].includes(view.title)) specimens(view.title);
    if(d.classList.contains('rig-panel'))d.before($('panel-text'));else d.after($('panel-text'));
    standardButtons(view,select);
    if(!opened)panel.showModal();
    panel.classList.toggle('rig-dialog',d.classList.contains('rig-panel'));
    panel.classList.toggle('story',!label&&!view.kind&&view.choices?.every(item=>item.id==='close'));
    panel.scrollTop=0;$('close-panel').focus({preventScroll:true});
  }
  function navigate(old,view){
    save();if(old===state.scene)hud();
    if(view?.fieldNotice){
      if(view.round)PierYard.startRound();
      pickup({text:view.fieldNotice});$('world').focus({preventScroll:true});return;
    }
    if(old===state.scene){if(view?.pickup)pickup(view);else drawDialog(view,choose);return;}
    clearNotice();
    const dest=state.scene;
    let landing=true;
    if(old==='yard')landing='post';
    else if(dest==='yard')landing='exit';
    else if(WestStory.isField(old)||WestStory.isField(dest)){
      if(dest==='north')landing='westTrail';
      else if(dest==='quarry')landing=old==='mailcave'?'rightDoor':'downhill';
      else landing=old==='north'?'coast':'exit';
    }
    movingScene=true;close();
    Passage.play(old,dest,state,()=>{
      World.enter(dest,landing);movingScene=false;World.pause(false);hud();
      if(view)drawDialog(view,choose);else $('world').focus({preventScroll:true});
    });
  }
  function choose(action){const old=state.scene;const result=Voyage.act(state,action);navigate(old,result);}
  function inspect(key){
    if(movingScene||panel.open)return;
    if(trial&&state.repaired&&key==='boat'){
      drawDialog({title:'부표가 다시 섰다',text:'이제 원래 항해로 돌아갈 수 있어요.',choices:[{id:'resume',label:'원래 항해로'},{id:'close',label:'부두 더 둘러보기'}]},resume);
      return;
    }
    const view=Voyage.interact(state,key,PierYard.keeper.mode);save();hud();
    if(view?.pickup)pickup(view);else drawDialog(view,choose);
  }
  function fieldStopped(){WestStory.finishMotion(state);save();hud();World.refresh();}
  function start(asTrial=false){
    trial=asTrial;$('exit-trial').hidden=!trial;
    const stored=trial?null:read();
    clearNotice();state=trial?Voyage.initial():(stored||newVoyage());$('cover').hidden=true;$('play').hidden=false;
    World.start(state,inspect,fieldStopped);save();hud();$('world').focus({preventScroll:true});
    if(!stored&&!trial&&(northEntry||westEntry)){
      movingScene=true;World.pause(true);
      Passage.play(westEntry?'north':'harbor',state.scene,state,()=>{
        movingScene=false;World.pause(false);$('world').focus({preventScroll:true});
      });
    }
  }
  function resume(){close();start();}
  $('start').onclick=()=>start();
  $('try-repair').onclick=()=>start(true);
  $('exit-trial').onclick=resume;
  $('close-panel').onclick=close;panel.addEventListener('cancel',e=>{e.preventDefault();close();});
  $('journal').onclick=()=>{if(movingScene)return;
    const entries=state.log;
    drawDialog({title:'항해일지',text:entries.length?entries.join('\n\n'):'아직 항해 기록이 없어요. 주운 재료는 가방에 담겨요.'},choose,'선실 · 기록');};
  function helpView(){
    if(trial){
      drawDialog({title:'첫 수리 체험',text:'부두에서 재료를 챙겨 부표를 수리해 보세요. 원래 항해는 언제든 다시 이어갈 수 있어요.',choices:[{id:'resume',label:'원래 항해로'},{id:'close',label:'계속 둘러보기'}]},resume,'탐험 안내');return;
    }
    drawDialog({title:'조작과 저장',text:'화면 속 길을 누르면 걷습니다. 우체국 문이나 작업대, 배를 누르면 그 앞으로 걸어가 살펴봅니다. 부두에 놓인 사슬이나 정비 상자를 누르면 재료를 챙깁니다. 가방에서 주운 물건을 살펴보고, 작업대에서 사용하세요. 세로 화면에서는 ‘전경 보기’로 시야를 넓힐 수 있습니다.\n\n키보드로는 방향키 또는 WASD로 걷고, E로 가까운 곳을 조사합니다. 대화는 Tab과 Enter로 선택하고 Esc로 닫습니다.\n\n조사와 항해는 이 브라우저에 자동 저장됩니다. 표지로 돌아가도 이어서 플레이할 수 있어요.',choices:[{label:'표지로 돌아가기',id:'title'},{label:'처음부터 다시 시작',id:'reset'},{label:'닫기',id:'close'}]},action=>{
      if(action==='title'){close();returnToCover();return;}
      if(action==='reset')drawDialog({title:'새 항해를 시작할까요?',text:westEntry?'셋째 장부터 시작한 별도 항해를 처음으로 되돌립니다.':northEntry?'북암부터 시작한 별도 항해를 처음으로 되돌립니다.':'이 기기에 저장한 v2의 현재 항해 기록을 새 기록으로 교체합니다.',choices:[{label:'새 항해 시작',id:'confirmed'},{label:'취소',id:'close'}]},action=>{
        if(action==='confirmed'){state=newVoyage();clearNotice();close();World.start(state,inspect,fieldStopped);save();hud();}
      },'항해일지');
    },'선실 · 안내');
  }
  $('help').onclick=()=>{if(!movingScene)helpView();};
  function returnToCover(){if(movingScene)return;save();World.stop();$('cover').hidden=false;$('play').hidden=true;cover();$('start').focus({preventScroll:true});}
  function preview(kind){
    const coastal=kind==='coast';
    const sample=coastal?Voyage.westStart():Voyage.northStart();
    if(coastal)Object.assign(sample,{coastOpen:true,cartPhase:'docked',westStamp:true});
    Passage.play(coastal?'mailcave':'harbor','north',sample,()=>{});
  }
  for(const b of document.querySelectorAll('[data-preview]'))b.onclick=()=>preview(b.dataset.preview);
  cover();
  const reel=new URLSearchParams(location.search).get('preview');
  if(reel==='sail'||reel==='coast'){
    $('preview-scenes').open=true;preview(reel);
  }
})();
