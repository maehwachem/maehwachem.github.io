/* A shared foot position drives touch, keyboard, camera and the walking cycle. */
(() => {
  'use strict';
  const scenes = {
    harbor: {name:'우편선 선착장', spawn:[100,170],
      spots:{post:['우체국',[40,123],[48,147]],bench:['작업대',[179,172],[143,190]],boat:['우편정',[323,97],[258,119]],board:['항로 게시판',[117,119],[117,126]],chain:['사슬 더미',[76,156],[80,163]],zinc:['정비 상자',[205,117],[205,127]]}},
    mine: {name:'붉은 만 · 옛 광산',spawn:[317,150],
      spots:{winch:['권양기',[80,150],[98,185]],wreck:['난파선',[252,150],[237,184]],boat:['우편정',[342,125],[317,150]]}},
    salt: {name:'흰 띠 · 옛 염전',spawn:[332,123],
      spots:{gate:['수문',[77,130],[67,165]],shed:['창고',[251,116],[243,140]],boat:['우편정',[342,108],[332,123]],rain:['처마 아래 빗물통',[186,129],[169,151]],brine:['염전 물웅덩이',[133,133],[103,161]]}}
  };
  // Bounds in the same 384 × 216 grid as the paintings. Keep bare walkways outside them.
  const objects = {
    harbor:{post:[4,67,80,70],bench:[147,164,68,34],boat:[267,68,108,60],board:[106,105,23,20],chain:[62,144,29,22],zinc:[191,103,29,23]},
    mine:{winch:[10,96,87,72],wreck:[173,113,113,53],boat:[300,100,82,47]},
    salt:{gate:[1,78,102,71],shed:[185,49,132,83],boat:[321,76,62,46],rain:[173,114,27,26],brine:[119,120,30,23]}
  };
  function actionLabel(scene,key,s){
    if(key==='chain')return '사슬을 챙긴다';
    if(key==='zinc')return '정비 상자를 뒤진다';
    if(key==='rain')return '빗물통을 살핀다';
    if(key==='brine')return '웅덩이를 살핀다';
    if(key==='boat')return scene==='harbor'&&!s.repaired?'우편정을 살핀다':'우편정에 오른다';
    if(key==='post')return s.mail?'국장과 이야기한다':'우체국 문을 연다';
    if(key==='board')return '게시판을 읽는다';
    if(key==='bench'){
      if(s.finished)return '말린 띠를 본다';
      if(!s.repaired)return Supplies.ready(s)?'모은 재료를 펼친다':'부표를 살핀다';
      if(!s.refs)return '작업대를 살핀다';
      if(s.ran)return '분리 결과를 본다';
      return s.line?'실험을 이어 간다':'거름종이를 편다';
    }
    if(key==='winch')return s.plate?'권양기를 살핀다':'명판을 살핀다';
    if(key==='wreck')return s.lifted&&!s.finished?(s.mineClue?'빈 상자를 본다':'건진 상자를 본다'):'난파선을 살핀다';
    if(key==='gate')return '수문을 살핀다';
    return s.gate?'창고 안을 본다':'창고 쪽을 본다';
  }
  const canvas=document.getElementById('world'), ctx=canvas.getContext('2d'), box=document.getElementById('worldbox'), viewport=document.getElementById('viewport');
  ctx.imageSmoothingEnabled=false;
  const textures={}, W=384, H=216;
  const props=new Image();props.src='art/pier-sprites.webp';
  const loaded=image=>image?.complete && image.naturalWidth>0;
  function loadScene(key){
    if(textures[key])return;
    const image=new Image();textures[key]=image;
    image.onerror=()=>{image.onerror=null;image.src='art/'+key+'.png';};
    image.src='art/'+key+'-hd.webp';
  }
  let density=1;
  function snap(v){return Math.round(v*density)/density;}
  const held=new Set(); const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let s, scene, id, px=0,py=0,face='down',route=[],request=null,walkPhase=0,wasWalking=false,lastFrame=0,raf=0,active=false,paused=false,onSpot=()=>{},width=W,camera=0;
  const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x)-camera,Math.round(y),w,h);}
  const controls=document.getElementById('objects'), nearby=document.getElementById('nearby'), viewMode=document.getElementById('view-mode');
  let overview=false, nearKey=null, target=null, padPointer=null, padDirection=null, padStart=null;
  const pad=document.getElementById('walk-pad');
  function size(){
    if(!active||!box.clientWidth)return;
    const full=box.clientWidth;
    const closeUp=full<640&&window.innerHeight>full&&window.innerHeight>=560;
    viewMode.hidden=!closeUp;
    const wideScale=Math.max(1,Math.floor(Math.min(full/W,Math.max(H,window.innerHeight-165)/H)));
    const scale=closeUp&&!overview?2:wideScale;
    width=Math.min(W,Math.max(1,Math.floor(full/scale)));
    canvas.style.width=viewport.style.width=(width*scale)+'px';
    canvas.style.height=viewport.style.height=(H*scale)+'px';
    density=Math.min(4,Math.max(1,Math.round(scale*(window.devicePixelRatio||1))));
    if(canvas.width!==width*density||canvas.height!==H*density){canvas.width=width*density;canvas.height=H*density;}
    ctx.setTransform(density,0,0,density,0,0);ctx.imageSmoothingEnabled=false;
    viewMode.textContent=overview?'가까이 보기':'전경 보기';
    viewMode.setAttribute('aria-pressed',String(overview));
    alignCamera(true);positionObjects();
  }
  function alignCamera(reset=false){
    const desired=reset?px-width/2:Math.min(px-width*.32,Math.max(px-width*.68,camera));
    camera=snap(Math.max(0,Math.min(W-width,desired)));
  }
  function present(key){
    return id!=='harbor'||!Object.hasOwn(Supplies.items,key)||(!s.repaired && !s.pack[key]);
  }
  function positionObjects(){
    for(const b of controls.children){
      const [x,y,w,h]=objects[id][b.dataset.spot];
      const left=Math.max(0,x-camera),right=Math.min(width,x+w-camera);
      b.hidden=right<=left || !present(b.dataset.spot);
      b.style.left=left*100/width+'%';b.style.width=Math.max(0,right-left)*100/width+'%';
      b.style.top=y*100/H+'%';b.style.height=h*100/H+'%';
    }
  }
  function refreshLabels(){
    positionObjects();
    for(const b of controls.children){
      const key=b.dataset.spot,label=actionLabel(id,key,s);
      b.setAttribute('aria-label',scene.spots[key][0]+' · '+label);
      b.firstChild.textContent=label;
    }
    updateNearby();
  }
  function mountObjects(){
    controls.replaceChildren();
    for(const key of Object.keys(scene.spots)){
      const b=document.createElement('button');
      b.type='button';b.className='object';b.dataset.spot=key;
      const label=document.createElement('span');label.className='caption';label.setAttribute('aria-hidden','true');b.append(label);
      b.onclick=()=>moveToSpot(key);
      controls.append(b);
    }
    refreshLabels();
  }
  function updateNearby(){
    nearKey=null;
    if(!paused&&!route.length){
      let best=23;
      for(const [key,spot] of Object.entries(scene.spots)){
        if(!present(key))continue;
        const d=dist([px,py],spot[2]);
        if(d<best){best=d;nearKey=key;}
      }
    }
    nearby.hidden=!nearKey;
    if(nearKey){const text=actionLabel(id,nearKey,s);if(nearby.textContent!==text)nearby.textContent=text;}
  }
  nearby.onclick=()=>{if(nearKey)moveToSpot(nearKey);};
  viewMode.onclick=()=>{overview=!overview;size();};
  function moveToSpot(key){
    if(paused||!scene.spots[key]||!present(key))return;
    stopPad();held.clear();
    target=Walkways[id].floor(scene.spots[key][2],Infinity);
    route=Walkways[id].route([px,py],target);request=route.length?key:null;
    if(overview){overview=false;size();}
    canvas.focus({preventScroll:true});updateNearby();
  }
  function orient(dx,dy){
    const ax=Math.abs(dx),ay=Math.abs(dy);
    if(ax+ay<.001)return;
    const same=(face==='left'&&dx<0)||(face==='right'&&dx>0)||(face==='up'&&dy<0)||(face==='down'&&dy>0);
    if(same&&Math.max(ax,ay)<Math.min(ax,ay)*1.25)return;
    face=ax>=ay?(dx<0?'left':'right'):(dy<0?'up':'down');
  }
  function movement(dt){
    if(paused)return;
    const down=key=>held.has(key)||padDirection===key;
    let dx=Number(down('right'))-Number(down('left')),dy=Number(down('down'))-Number(down('up'));
    const step=57*dt;
    if(dx||dy){
      const length=Math.hypot(dx,dy);
      const next=Walkways[id].slide([px,py],[px+dx*step/length,py+dy*step/length]);
      [px,py]=next;return;
    }
    let left=step;
    while(route.length&&left>0){
      const p=route[0];dx=p[0]-px;dy=p[1]-py;const length=Math.hypot(dx,dy);
      if(length<=left){[px,py]=p;left-=length;route.shift();}
      else{px+=dx*left/length;py+=dy*left/length;left=0;}
    }
  }
  function actor(moving){
    const x=snap(px)-camera,y=snap(py);
    ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();ctx.ellipse(x,y-1,9,2.8,0,0,Math.PI*2);ctx.fill();
    IslandChemist.draw(ctx,x,y,face,moving?Math.floor(walkPhase*8/28):-1);
  }
  function prop(column,x,y){
    if(!loaded(props))return false;
    ctx.drawImage(props,column*144,160,144,160,x-camera-18,y-40,36,40);
    return true;
  }
  function board(){
    if(prop(2,117,127))return;
    rect(111,112,2,13,'#694a38');rect(122,112,2,13,'#694a38');rect(109,108,17,9,'#503e38');
    rect(110,109,15,7,'#a5754b');rect(112,110,6,4,'#efdeb2');rect(119,111,3,3,'#d8c293');
  }
  // Small objects share the painting's pixel grid; pale edges catch the sun.
  function chainPile(){
    if(prop(0,76,161))return;
    function link(x,y){
      rect(x+1,y,6,1,'#3a4142');rect(x,y+1,8,3,'#384651');rect(x+1,y+4,6,1,'#3a4142');
      rect(x+1,y+1,6,1,'#abb8b3');rect(x+2,y+2,4,1,'#685956');rect(x+1,y+3,6,1,'#768b8d');
    }
    rect(68,158,16,2,'#684f41');link(67,155);link(72,153);link(77,155);link(71,157);link(77,152);
  }
  function toolbox(full){
    if(prop(1,205,123)){
      if(!full){
        // A folded canvas tool roll now lies over the former zinc plate.
        ctx.save();ctx.translate(205-camera,123);
        ctx.fillStyle='#496353';ctx.beginPath();ctx.moveTo(.6,-9.8);ctx.lineTo(6.2,-10.1);ctx.lineTo(5.2,-4);ctx.lineTo(-.6,-4.1);ctx.fill();
        ctx.fillStyle='#79907a';ctx.fillRect(.5,-5.8,4.9,.55);ctx.restore();
      }
      return;
    }
    rect(195,119,22,3,'#795a42');rect(195,111,19,8,'#273c36');
    rect(196,113,17,5,'#4c8274');rect(197,110,17,3,'#548f7e');rect(198,109,15,1,'#add1b5');
    rect(196,112,17,1,'#203f40');rect(203,112,4,3,'#e9b659');
    if(full){rect(199,107,9,3,'#626f79');rect(200,107,8,1,'#dbe1d1');rect(202,108,2,1,'#5d6567');}
    else {rect(196,108,17,3,'#27433e');rect(197,107,16,1,'#7aa48d');}
  }
  function waterSpots(){
    rect(178,124,15,9,'#4f4540');rect(179,121,13,13,'#965d3c');rect(181,123,3,10,'#bb8452');
    rect(178,122,16,2,'#455659');rect(178,130,16,2,'#506267');rect(180,120,12,2,'#a89477');rect(181,120,10,1,'#a7d9dd');
    rect(125,131,16,5,'#876b53');rect(123,132,19,2,'#688e94');rect(126,131,13,1,'#c2d4ba');
    rect(123,134,5,2,'#efe7c6');rect(137,132,4,1,'#dedfc7');
  }
  function weather(t,image){
    if(id==='harbor'){
      board();
      if(present('chain'))chainPile();
      toolbox(present('zinc'));
      if(!s.repaired){
        const k=image.naturalWidth/W;
        ctx.drawImage(image,182*k,39*k,22*k,43*k,207-camera,39,22,43);
      }
      if(s.lit){
        ctx.fillStyle='#1c315c55';ctx.fillRect(0,0,width,H);
        const beam=40+Math.round(Math.cos(t*.68)*120);
        ctx.fillStyle='#fff3b629';ctx.beginPath();ctx.moveTo(239-camera,18);ctx.lineTo(beam-camera,31);ctx.lineTo(beam-camera,36);ctx.closePath();ctx.fill();
        rect(238,17,2,2,'#fff1ad');
        const fx=258+Math.round(((t*3)%52));rect(fx,58,9,2,'#e1bb88');rect(fx+2,56,5,2,'#dcdbbe');rect(fx+2,55,4,1,'#b45741');rect(fx-3,61,9,1,'#c1c5aa');
      }
    }
    if(id==='salt')waterSpots();
    const patches=id==='harbor'?[[145,65],[267,82],[283,182]]:id==='mine'?[[314,83],[360,163],[201,101]]:[[157,74],[127,77],[329,182]];
    patches.forEach(([x,y],i)=>{for(let j=0;j<7;j++){const a=t*.9+i+j*1.37;const len=Math.round(1+Math.sin(a)*2);if(len>0)rect(x+(j*11)%33,y+(j*5)%8,len,1,'#d2e6cf72');}});
  }
  function frame(ts){
    if(!active)return;
    const dt=Math.max(0,Math.min(.08,(ts-lastFrame)/1000));lastFrame=ts;
    const oldX=px,oldY=py;
    movement(dt);
    const distance=Math.hypot(px-oldX,py-oldY),moving=distance>.015;
    if(moving){
      orient(px-oldX,py-oldY);
      walkPhase=((wasWalking?walkPhase:28/8)+distance)%28;
    }else walkPhase=0;
    wasWalking=moving;
    if(!paused&&!route.length&&request){
      const key=request,look=scene.spots[key][1];request=null;
      orient(look[0]-px,look[1]-py);onSpot(key);
    }
    const oldCamera=camera;alignCamera();if(oldCamera!==camera)positionObjects();updateNearby();
    const image=textures[id];if(loaded(image)){ctx.drawImage(image,-camera,0,W,H);weather(reduced.matches?0:ts/1000,image);}else{ctx.fillStyle='#164b59';ctx.fillRect(0,0,width,H);}
    if(target&&route.length){
      const [x,y]=target;rect(x-3,y,2,1,'#f2daa5');rect(x+2,y,2,1,'#f2daa5');
      rect(x-1,y+1,3,1,'#ffe9b4');
    }
    actor(moving);raf=requestAnimationFrame(frame);
  }
  canvas.addEventListener('pointerdown',e=>{
    if(!active||paused)return;
    const b=canvas.getBoundingClientRect(),pos=[camera+(e.clientX-b.left)*width/b.width,(e.clientY-b.top)*H/b.height];
    const foot=Walkways[id].floor(pos,3);
    if(!foot)return;
    stopPad();request=null;target=foot;held.clear();route=Walkways[id].route([px,py],foot);
    canvas.focus({preventScroll:true});
  });
  function stopPad(){
    if(padPointer!==null&&pad.hasPointerCapture(padPointer))pad.releasePointerCapture(padPointer);
    padPointer=null;padDirection=null;padStart=null;
    for(const b of pad.children)b.classList.remove('pressed');
  }
  function steer(e){
    const button=document.elementFromPoint(e.clientX,e.clientY)?.closest('#walk-pad button');
    padDirection=button?.dataset.dir||null;
    for(const b of pad.children)b.classList.toggle('pressed',b===button);
  }
  pad.addEventListener('pointerdown',e=>{
    if(!active||paused||padPointer!==null||!e.target.closest('button'))return;
    e.preventDefault();padPointer=e.pointerId;pad.setPointerCapture(e.pointerId);
    route=[];target=request=null;held.clear();steer(e);padStart=[px,py];
  });
  pad.addEventListener('pointermove',e=>{if(e.pointerId===padPointer)steer(e);});
  for(const type of ['pointerup','pointercancel','lostpointercapture']){
    pad.addEventListener(type,e=>{
      if(e.pointerId!==padPointer)return;
      const tap=type==='pointerup'&&padDirection&&padStart&&dist(padStart,[px,py])<.05;
      const dir=padDirection;stopPad();
      if(tap)nudge(dir);
    });
  }
  pad.addEventListener('click',e=>{
    if(e.detail||!active||paused)return;
    const dir=e.target.closest('button')?.dataset.dir;
    if(!dir)return;
    nudge(dir);
  });
  function nudge(dir){
    const dx=Number(dir==='right')-Number(dir==='left'),dy=Number(dir==='down')-Number(dir==='up');
    const end=Walkways[id].slide([px,py],[px+dx*6,py+dy*6]);
    request=null;target=end;route=Walkways[id].route([px,py],end);
  }
  const keys={ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right'};
  addEventListener('keydown',e=>{if(!active||paused||e.altKey||e.metaKey||e.ctrlKey)return;
    if(keys[e.code]){e.preventDefault();stopPad();route=[];request=target=null;held.add(keys[e.code]);}
    else if(e.code==='KeyE'||(e.code==='Space'&&e.target.tagName!=='BUTTON')){e.preventDefault();if(!e.repeat&&nearKey)moveToSpot(nearKey);}});
  addEventListener('keyup',e=>held.delete(keys[e.code]));addEventListener('blur',()=>{stopPad();held.clear();});
  addEventListener('resize',size);
  window.World={scenes,start(state,cb){s=state;onSpot=cb;active=true;paused=false;this.enter(state.scene);cancelAnimationFrame(raf);lastFrame=performance.now();raf=requestAnimationFrame(frame);},
    enter(key,arriving=false){
      s.scene=key;id=key;scene=scenes[key];loadScene(key);overview=false;
      const spawn=arriving&&key==='harbor'?scene.spots.boat[2]:scene.spawn;
      [px,py]=Walkways[id].floor(spawn,Infinity);walkPhase=0;wasWalking=false;stopPad();face=arriving?'left':'down';route=[];request=null;target=null;held.clear();mountObjects();size();
    },
    refresh(){if(scene)refreshLabels();},stop(){active=false;stopPad();held.clear();route=[];request=null;cancelAnimationFrame(raf);},pause(value){paused=value;stopPad();held.clear();walkPhase=0;wasWalking=false;if(value){target=request=null;route=[];}if(scene)refreshLabels();},resize:size};
})();
