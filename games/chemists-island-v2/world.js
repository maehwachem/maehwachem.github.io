/* Fixed pixel grid, walking corridors follow the jetties in the painted backgrounds. */
(() => {
  'use strict';
  const scenes = {
    harbor: {name:'우편선 선착장', spawn:0, nodes:[[100,170],[48,147],[91,151],[126,134],[178,128],[232,126],[258,119],[144,190],[122,148],[117,126]],
      edges:[[0,2],[2,1],[2,3],[3,4],[4,5],[5,6],[0,7],[0,8],[8,3],[3,9]],
      spots:{post:['우체국',[40,123],1],bench:['작업대',[179,172],7],boat:['우편정',[323,97],6],board:['항로 게시판',[117,119],9]}},
    mine: {name:'붉은 만 · 옛 광산',spawn:4,nodes:[[98,185],[138,187],[204,195],[261,188],[317,150],[266,174],[237,184]],
      edges:[[0,1],[1,2],[2,6],[6,3],[3,5],[5,4]],spots:{winch:['권양기',[80,150],0],wreck:['난파선',[252,150],6],boat:['우편정',[342,125],4]}},
    salt: {name:'흰 띠 · 옛 염전',spawn:4,nodes:[[67,165],[103,161],[169,151],[243,140],[332,123],[285,132]],
      edges:[[0,1],[1,2],[2,3],[3,5],[5,4]],spots:{gate:['수문',[77,130],0],shed:['창고',[251,116],3],boat:['우편정',[342,108],4]}}
  };
  // Bounds in the same 384 × 216 grid as the paintings. Keep bare walkways outside them.
  const objects = {
    harbor:{post:[3,64,87,82],bench:[147,164,68,34],boat:[267,68,108,60],board:[106,105,23,20]},
    mine:{winch:[10,96,87,72],wreck:[173,113,113,53],boat:[300,100,82,47]},
    salt:{gate:[1,78,102,71],shed:[185,49,132,83],boat:[321,76,62,46]}
  };
  function actionLabel(scene,key,s){
    if(key==='boat')return scene==='harbor'&&!s.repaired?'우편정을 살핀다':'우편정에 오른다';
    if(key==='post')return s.mail?'국장과 이야기한다':'우체국 문을 연다';
    if(key==='board')return '게시판을 읽는다';
    if(key==='bench'){
      if(s.finished)return '말린 띠를 본다';
      if(!s.mail)return '작업대를 살핀다';
      if(!s.repaired)return '정비 기록을 본다';
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
  const textures={};const W=384,H=216;
  for(const id of Object.keys(scenes)){const img=new Image();img.src='art/'+id+'.png';textures[id]=img;}
  const colors={o:'#20303a',h:'#372c2b',a:'#60433a',s:'#e4a076',u:'#fac197',t:'#207071',j:'#318a88',l:'#57a6a1',b:'#805134',g:'#cb9652',c:'#f1d7a5',p:'#c5b18c',k:'#443937'};
  const sprites={
    down:['....ohhhho....','...ohhaahho...','..ohhhhhhhho..','..ohhsuushu o.'.replace(/ /g,''),'...osusuuso...','....ouuuuo....','...ottoo tto...'.replace(/ /g,''),'..ojjjbgjjjo..','..ojjjgbjtjo..','..osjtbgjtso..','...otgbbbo....','...ogggbcco...','....oppcco....'],
    up:['....ohhhho....','...ohhaaaho...','..ohhaahhhho..','..ohhhhhhhho..','...ohhhhhho...','....ohhhho....','...otttttto...','..ojjtgbtjjo..','..ojtgbtttjo..','..osgbbbjtso..','...obggbbo....','...obggbcco...','....oppcco....'],
    side:['....ohhhho....','...ohhaahho...','...ohhhhhho...','...ohhhusuo...','....ohsuuuo...','.....osuuo....','....otttto....','...obgtjjto...','...oggjjjto...','...obgjssto...','....obbbbo....','....oppcco....','....opccco....']
  };
  const held=new Set(); const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let s, scene, id, px=0,py=0,face='down',route=[],request=null,walkTime=0,lastFrame=0,raf=0,active=false,paused=false,onSpot=()=>{},width=W,camera=0;
  const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x)-camera,Math.round(y),w,h);}
  const controls=document.getElementById('objects'), nearby=document.getElementById('nearby'), viewMode=document.getElementById('view-mode');
  let overview=false, nearKey=null, target=null;
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
    if(canvas.width!==width){canvas.width=width;ctx.imageSmoothingEnabled=false;}
    viewMode.textContent=overview?'가까이 보기':'전경 보기';
    viewMode.setAttribute('aria-pressed',String(overview));
    alignCamera();positionObjects();
  }
  function alignCamera(){camera=Math.round(Math.max(0,Math.min(W-width,px-width/2)));}
  function positionObjects(){
    for(const b of controls.children){
      const [x,y,w,h]=objects[id][b.dataset.spot];
      const left=Math.max(0,x-camera),right=Math.min(width,x+w-camera);
      b.hidden=right<=left;
      b.style.left=left*100/width+'%';b.style.width=Math.max(0,right-left)*100/width+'%';
      b.style.top=y*100/H+'%';b.style.height=h*100/H+'%';
    }
  }
  function refreshLabels(){
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
        const d=dist([px,py],scene.nodes[spot[2]]);
        if(d<best){best=d;nearKey=key;}
      }
    }
    nearby.hidden=!nearKey;
    if(nearKey){const text=actionLabel(id,nearKey,s);if(nearby.textContent!==text)nearby.textContent=text;}
  }
  nearby.onclick=()=>{if(nearKey)moveToSpot(nearKey);};
  viewMode.onclick=()=>{overview=!overview;size();};
  function nearestOnSegment(pos,a,b){
    const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((pos[0]-a[0])*dx+(pos[1]-a[1])*dy)/(dx*dx+dy*dy)));
    return [a[0]+dx*t,a[1]+dy*t];
  }
  function projection(pos){
    let best;
    for(const [a,b] of scene.edges){
      const point=nearestOnSegment(pos,scene.nodes[a],scene.nodes[b]),d=dist(pos,point);
      if(!best||d<best.d)best={a,b,point,d};
    }return best;
  }
  function findRoute(target){
    const start=projection([px,py]),end=projection(target);
    const nodes=[...scene.nodes,start.point,end.point],a=nodes.length-2,b=a+1;
    const edges=[...scene.edges,[a,start.a],[a,start.b],[b,end.a],[b,end.b]];
    if(start.a===end.a&&start.b===end.b)edges.push([a,b]);
    const costs=nodes.map(()=>Infinity),previous=nodes.map(()=>-1),visited=new Set();costs[a]=0;
    while(visited.size<nodes.length){
      let u=-1; for(let i=0;i<nodes.length;i++)if(!visited.has(i)&&(u<0||costs[i]<costs[u]))u=i;
      if(u===b||u<0||costs[u]===Infinity)break;visited.add(u);
      for(const [x,y] of edges){const v=x===u?y:y===u?x:-1;if(v<0)continue;
        const c=costs[u]+dist(nodes[u],nodes[v]);if(c<costs[v]){costs[v]=c;previous[v]=u;}}
    }
    const list=[];for(let i=b;i!==-1;i=previous[i])list.unshift(nodes[i]);return list;
  }
  function moveToSpot(key){
    if(paused||!scene.spots[key])return;
    target=null;held.clear();request=key;route=findRoute(scene.nodes[scene.spots[key][2]]);
    if(overview){overview=false;size();}
    canvas.focus({preventScroll:true});updateNearby();
  }
  function orient(dx,dy){if(Math.abs(dx)>Math.abs(dy)*1.4)face=dx<0?'left':'right';else if(dy!==0)face=dy<0?'up':'down';}
  function movement(dt){
    if(paused)return false;
    let dx=Number(held.has('right'))-Number(held.has('left')),dy=Number(held.has('down'))-Number(held.has('up'));
    const step=85*dt;
    if(dx||dy){
      const len=Math.hypot(dx,dy);dx/=len;dy/=len;const desired=[px+dx*step,py+dy*step],near=projection(desired);
      if(near.d>6){const k=6/near.d;px=near.point[0]+(desired[0]-near.point[0])*k;py=near.point[1]+(desired[1]-near.point[1])*k;}else [px,py]=desired;
      orient(dx,dy);return true;
    }
    let left=step;
    while(route.length&&left>0){
      const p=route[0];dx=p[0]-px;dy=p[1]-py;const length=Math.hypot(dx,dy);
      if(length>.15)orient(dx,dy);
      if(length<=left){[px,py]=p;left-=length;route.shift();}else{px+=dx*left/length;py+=dy*left/length;left=0;}
    }
    if(!route.length&&request){
      const key=request, look=scene.spots[key][1];request=null;
      orient(look[0]-px,look[1]-py);onSpot(key);
    }
    return route.length>0;
  }
  function actor(moving){
    const x=Math.round(px),y=Math.round(py),beat=moving?Math.floor(walkTime*8)%2:0;
    rect(x-8,y-1,17,2,'#4b453f88');rect(x-5,y-2,12,3,'#3a3e4788');
    const rows=sprites[face==='left'||face==='right'?'side':face];
    const xx=[0,1,2,4,5,7,8,10,11,13,14,16,17,18,19], yy=[0,2,3,5,7,8,10,12,14,16,18,20,22,24];
    rows.forEach((row,iy)=>[...row].forEach((c,ix)=>{
      if(colors[c])rect(x+(face==='left'?9-xx[ix+1]:xx[ix]-9),y-31+yy[iy]-beat,xx[ix+1]-xx[ix],yy[iy+1]-yy[iy],colors[c]);
    }));
    const offset=moving?(beat?1:-1):0;
    rect(x-4,y-9-offset,5,6,colors.p);rect(x+1,y-9+offset,5,6,colors.c);
    rect(x-4,y-9-offset,1,6,'#947d67');rect(x+5,y-9+offset,1,6,'#947d67');
    rect(x-5,y-4-offset,6,4,colors.k);rect(x+1,y-4+offset,6,4,colors.k);
    rect(x-4,y-4-offset,3,1,'#806048');rect(x+2,y-4+offset,3,1,'#806048');
  }
  function board(){
    rect(111,112,2,13,'#694a38');rect(122,112,2,13,'#694a38');rect(109,108,17,9,'#503e38');
    rect(110,109,15,7,'#a5754b');rect(112,110,6,4,'#efdeb2');rect(119,111,3,3,'#d8c293');
  }
  function weather(t){
    if(id==='harbor'){
      board();
      if(!s.repaired){ctx.drawImage(textures.harbor,182,39,22,43,207-camera,39,22,43);}
      if(s.lit){
        ctx.fillStyle='#1c315c55';ctx.fillRect(0,0,width,H);
        const beam=40+Math.round(Math.cos(t*.68)*120);
        ctx.fillStyle='#fff3b629';ctx.beginPath();ctx.moveTo(239-camera,18);ctx.lineTo(beam-camera,31);ctx.lineTo(beam-camera,36);ctx.closePath();ctx.fill();
        rect(238,17,2,2,'#fff1ad');
        const fx=258+Math.round(((t*3)%52));rect(fx,58,9,2,'#e1bb88');rect(fx+2,56,5,2,'#dcdbbe');rect(fx+2,55,4,1,'#b45741');rect(fx-3,61,9,1,'#c1c5aa');
      }
    }
    const patches=id==='harbor'?[[145,65],[267,82],[283,182]]:id==='mine'?[[314,83],[360,163],[201,101]]:[[157,74],[127,77],[329,182]];
    patches.forEach(([x,y],i)=>{for(let j=0;j<7;j++){const a=t*.9+i+j*1.37;const len=Math.round(1+Math.sin(a)*2);if(len>0)rect(x+(j*11)%33,y+(j*5)%8,len,1,'#d2e6cf72');}});
  }
  function frame(ts){
    if(!active)return;
    const dt=Math.min(.22,(ts-lastFrame)/1000||0);lastFrame=ts;const moving=movement(dt);if(moving)walkTime+=dt;
    const oldCamera=camera;alignCamera();if(oldCamera!==camera)positionObjects();updateNearby();
    const image=textures[id];if(image.complete&&image.naturalWidth){ctx.drawImage(image,-camera,0);weather(reduced.matches?0:ts/1000);}else{ctx.fillStyle='#164b59';ctx.fillRect(0,0,width,H);}
    if(target&&route.length){
      const [x,y]=target;rect(x-3,y,2,1,'#f2daa5');rect(x+2,y,2,1,'#f2daa5');
      rect(x-1,y+1,3,1,'#ffe9b4');
    }
    actor(moving);raf=requestAnimationFrame(frame);
  }
  canvas.addEventListener('pointerdown',e=>{
    if(!active||paused)return;
    const b=canvas.getBoundingClientRect(),pos=[camera+(e.clientX-b.left)*width/b.width,(e.clientY-b.top)*H/b.height];
    const foot=projection(pos);
    if(foot.d>20)return;
    request=null;target=foot.point;held.clear();route=findRoute(foot.point);
  });
  const keys={ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right'};
  addEventListener('keydown',e=>{if(!active||paused||e.altKey||e.metaKey||e.ctrlKey)return;
    if(keys[e.code]){e.preventDefault();route=[];request=null;held.add(keys[e.code]);}
    else if(e.code==='KeyE'||(e.code==='Space'&&e.target.tagName!=='BUTTON')){e.preventDefault();if(!e.repeat&&nearKey)moveToSpot(nearKey);}});
  addEventListener('keyup',e=>held.delete(keys[e.code]));addEventListener('blur',()=>held.clear());
  addEventListener('resize',size);
  window.World={scenes,start(state,cb){s=state;onSpot=cb;active=true;paused=false;this.enter(state.scene);cancelAnimationFrame(raf);lastFrame=performance.now();raf=requestAnimationFrame(frame);},
    enter(key,arriving=false){
      s.scene=key;id=key;scene=scenes[key];overview=false;
      const spawn=arriving&&key==='harbor'?scene.spots.boat[2]:scene.spawn;
      [px,py]=scene.nodes[spawn];face=arriving?'left':'up';route=[];request=null;target=null;held.clear();mountObjects();size();
    },
    stop(){active=false;held.clear();route=[];request=null;cancelAnimationFrame(raf);},pause(value){paused=value;held.clear();if(scene)refreshLabels();},resize:size};
})();
