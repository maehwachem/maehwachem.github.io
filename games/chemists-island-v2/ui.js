(() => {
  'use strict';
  const $=id=>document.getElementById(id), panel=$('panel'), SAVE='kje.chemists-island.v2.last-mailboat.1';
  let state=null, movingScene=false, previousFocus=null, travelTimer, storageError=false;
  function read(){
    try{
      const data=JSON.parse(localStorage.getItem(SAVE));
      if(!data||data.version!==1||!data.game||!Object.hasOwn(World.scenes,data.game.scene))return null;
      const draft={...Voyage.initial(),...data.game};
      if(!Array.isArray(draft.log)||!draft.visited||typeof draft.visited!=='object')return null;
      return draft;
    }catch{return null;}
  }
  function save(){
    try{localStorage.setItem(SAVE,JSON.stringify({version:1,game:state}));storageError=false;}
    catch{storageError=true;}
    $('save-status').classList.toggle('warn',storageError);
    $('save-status').textContent=storageError?'저장 불가 · 이 창에서만 진행':'이 기기에 저장됨';
  }
  function cover(){
    const stored=read();
    $('start').textContent=stored?'항해 이어하기':'첫 항해 시작';
    $('resume-info').textContent=stored?(stored.finished?'첫 장 완료 · 자유 항해':World.scenes[stored.scene].name+' · 귀항 '+stored.returns+'회'):'';
  }
  function hud(){
    $('place').textContent=World.scenes[state.scene].name;
    $('tide').textContent=state.scene==='harbor'?(state.returns?'귀항 '+state.returns+'회 · 등대 점등':'첫 출항 전'):'간조 · 연안 탐사';
    $('goal').textContent=Voyage.goal(state);
  }
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
    if(old===state.scene){drawDialog(view,choose);return;}
    movingScene=true;close();World.enter(state.scene,true);World.pause(true);
    const sail=$('sailing');sail.querySelector('b').textContent=World.scenes[state.scene].name+' 방면';sail.hidden=false;
    clearTimeout(travelTimer);travelTimer=setTimeout(()=>{movingScene=false;sail.hidden=true;World.pause(false);drawDialog(view,choose);},matchMedia('(prefers-reduced-motion: reduce)').matches?40:1050);
  }
  function choose(action){const old=state.scene;const result=Voyage.act(state,action);navigate(old,result);}
  function inspect(key){if(movingScene||panel.open)return;const view=Voyage.interact(state,key);save();hud();drawDialog(view,choose);}
  function start(){
    state=read()||Voyage.initial();$('cover').hidden=true;$('play').hidden=false;
    World.start(state,inspect);save();hud();$('world').focus({preventScroll:true});
  }
  $('start').onclick=start;
  $('close-panel').onclick=close;panel.addEventListener('cancel',e=>{e.preventDefault();close();});
  $('journal').onclick=()=>{if(movingScene)return;
    const entries=state.log;
    drawDialog({title:'항해일지',text:entries.length?entries.join('\n\n'):'아직 첫 기록을 기다리고 있어요. 선착장의 우체국을 찾아가세요.'},choose,'선실 · 기록');};
  function helpView(){
    drawDialog({title:'조작과 저장',text:'화면 속 길을 누르면 걷습니다. 우체국 문이나 작업대, 배를 누르면 그 앞으로 걸어가 살펴봅니다. 가까이 서면 가능한 행동이 화면 아래에 나타납니다. 세로 화면에서는 ‘전경 보기’로 시야를 넓힐 수 있습니다.\n\n키보드로는 방향키 또는 WASD로 걷고, E로 가까운 곳을 조사합니다. 대화는 Tab과 Enter로 선택하고 Esc로 닫습니다.\n\n조사와 항해는 이 브라우저에 자동 저장됩니다. 표지로 돌아가도 이어서 플레이할 수 있어요.',choices:[{label:'표지로 돌아가기',id:'title'},{label:'처음부터 다시 시작',id:'reset'},{label:'닫기',id:'close'}]},action=>{
      if(action==='title'){close();returnToCover();return;}
      if(action==='reset')drawDialog({title:'새 항해를 시작할까요?',text:'이 기기에 저장한 v2의 현재 항해 기록을 새 기록으로 교체합니다.',choices:[{label:'새 항해 시작',id:'confirmed'},{label:'취소',id:'close'}]},action=>{
        if(action==='confirmed'){state=Voyage.initial();close();World.start(state,inspect);save();hud();}
      },'항해일지');
    },'선실 · 안내');
  }
  $('help').onclick=()=>{if(!movingScene)helpView();};
  function returnToCover(){if(movingScene)return;save();World.stop();$('cover').hidden=false;$('play').hidden=true;cover();$('start').focus({preventScroll:true});}
  cover();
})();
