(() => {
  'use strict';
  const $=id=>document.getElementById(id), panel=$('panel'), SAVE='kje.chemists-island.v2.last-mailboat.1';
  let state=null, trial=false, movingScene=false, previousFocus=null, travelTimer, pickupTimer, storageError=false;
  function read(){
    try{
      const data=JSON.parse(localStorage.getItem(SAVE));
      if(!data||data.version!==1||!data.game||!Object.hasOwn(World.scenes,data.game.scene))return null;
      const draft={...Voyage.initial(),...data.game};
      if(!Array.isArray(draft.log)||!draft.visited||typeof draft.visited!=='object')return null;
      if(!data.game.pack && !draft.repaired && draft.coupA && draft.coupB) draft.pack={chain:1,zinc:1};
      Supplies.restore(draft);
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
    $('try-repair').hidden=!stored?.repaired;
    $('start').textContent=stored?'항해 이어하기':'첫 항해 시작';
    $('resume-info').textContent=stored?(stored.finished?'첫 장 완료 · 자유 항해':World.scenes[stored.scene].name+' · 귀항 '+stored.returns+'회'):'';
  }
  function hud(){
    $('place').textContent=World.scenes[state.scene].name;
    $('tide').textContent=state.scene==='harbor'?(state.returns?'귀항 '+state.returns+'회 · 등대 점등':'첫 출항 전'):'간조 · 연안 탐사';
    $('goal').textContent=trial&&state.repaired?'다시 뜬 빨간 부표가 보인다. 원래 항해로 돌아가자.':Voyage.goal(state);
  }
  const waterItems={
    rain:{name:'빗물 한 병',detail:'창고 처마 아래에서 받은 빗물. 바닥에 소금 결정이 없다.'},
    brine:{name:'소금물 한 병',detail:'염전 웅덩이의 포화 소금물. 바닥에 소금 결정이 쌓여 있었다.'},
    ink:{name:'압지 시료',detail:'광산 만에서 건진 종이. 번진 소인의 색이 희미하게 남았다.'},
    ledger:{name:'접힌 분류표',detail:'옛 염전 창고에서 꺼낸 우편 분류표. 뒷면에 임시 기항 기록이 남았다.'}
  };
  function packContents(){
    const ids=Supplies.bag(state);
    if(state.water)ids.push(state.water);
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
  }
  $('pack').onclick=showPack;
  function pickup(view){
    if(panel.open)close();
    const notice=$('pickup');clearTimeout(pickupTimer);notice.textContent=view.text;
    notice.classList.add('shown');pickupTimer=setTimeout(()=>notice.classList.remove('shown'),2500);
    World.refresh();
  }
  function clearNotice(){clearTimeout(pickupTimer);$('pickup').classList.remove('shown');$('pickup').textContent='';}
  function close(){if(panel.open)panel.close();World.pause(movingScene);if(previousFocus?.isConnected&&previousFocus.offsetWidth)previousFocus.focus({preventScroll:true});}
  function standardButtons(view,select){
    const buttons=$('choices');buttons.replaceChildren();
    const alternative=$('diagram').classList.contains('interactive-lab')?document.createElement('details'):null;
    if(alternative){const summary=document.createElement('summary');summary.textContent='선택 버튼으로 조작';alternative.append(summary);buttons.append(alternative);}
    for(const choice of view.choices||[{label:'닫기',id:'close'}]){
      const b=document.createElement('button');b.type='button';b.textContent=choice.label;b.dataset.action=choice.id;
      if(choice.id==='close')b.className='muted';
      b.onclick=()=>choice.id==='close'?close():select(choice.id);(alternative&&choice.id!=='close'?alternative:buttons).append(b);
    }
  }
  function specimens(title){
    const d=$('diagram');
    for(const [cls,name] of [['metal','A · 아연 연결'],['rust','B · 강철']]){
      const f=document.createElement('figure'),p=document.createElement('i'),l=document.createElement('figcaption');
      p.className='coupon '+cls;l.textContent=name;f.append(p,l);d.append(f);
    }
    if(title==='시험편 A'||title==='시험편 B'){const f=d.children[title.endsWith('A')?0:1];f.style.fontWeight='900';}
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
    if(window.VoyageLab?.mount(d,state,view,select)){d.hidden=false;d.className='interactive-lab';}
    else if(view.kind==='samples'&&['작업대','시험편 A','시험편 B'].includes(view.title)) specimens(view.title);
    standardButtons(view,select);
    if(!opened)panel.showModal();
    panel.classList.toggle('story',!label&&!view.kind&&view.choices?.every(item=>item.id==='close'));
    panel.scrollTop=0;$('close-panel').focus({preventScroll:true});
  }
  function navigate(old,view){
    save();hud();
    if(old===state.scene){if(view?.pickup)pickup(view);else drawDialog(view,choose);return;}
    clearNotice();
    movingScene=true;close();World.enter(state.scene,true);World.pause(true);
    const sail=$('sailing');sail.querySelector('b').textContent=World.scenes[state.scene].name+' 방면';sail.hidden=false;
    clearTimeout(travelTimer);travelTimer=setTimeout(()=>{movingScene=false;sail.hidden=true;World.pause(false);drawDialog(view,choose);},matchMedia('(prefers-reduced-motion: reduce)').matches?40:1050);
  }
  function choose(action){const old=state.scene;const result=Voyage.act(state,action);navigate(old,result);}
  function inspect(key){
    if(movingScene||panel.open)return;
    if(trial&&state.repaired&&key==='boat'){
      drawDialog({title:'부표가 다시 섰다',text:'이제 원래 항해로 돌아갈 수 있어요.',choices:[{id:'resume',label:'원래 항해로'},{id:'close',label:'부두 더 둘러보기'}]},resume);
      return;
    }
    const view=Voyage.interact(state,key);save();hud();
    if(view?.pickup)pickup(view);else drawDialog(view,choose);
  }
  function start(asTrial=false){
    trial=asTrial;$('exit-trial').hidden=!trial;
    clearNotice();state=trial?Voyage.initial():(read()||Voyage.initial());$('cover').hidden=true;$('play').hidden=false;
    World.start(state,inspect);save();hud();$('world').focus({preventScroll:true});
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
      if(action==='reset')drawDialog({title:'새 항해를 시작할까요?',text:'이 기기에 저장한 v2의 현재 항해 기록을 새 기록으로 교체합니다.',choices:[{label:'새 항해 시작',id:'confirmed'},{label:'취소',id:'close'}]},action=>{
        if(action==='confirmed'){state=Voyage.initial();clearNotice();close();World.start(state,inspect);save();hud();}
      },'항해일지');
    },'선실 · 안내');
  }
  $('help').onclick=()=>{if(!movingScene)helpView();};
  function returnToCover(){if(movingScene)return;save();World.stop();$('cover').hidden=false;$('play').hidden=true;cover();$('start').focus({preventScroll:true});}
  cover();
})();
