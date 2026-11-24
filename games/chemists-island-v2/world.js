/* Fixed pixel grid, walking corridors follow the jetties in the painted backgrounds. */
(() => {
  'use strict';
  const scenes = {
    harbor: {name:'우편선 선착장', spawn:0, nodes:[[100,170],[66,148],[91,151],[126,134],[178,128],[232,126],[258,119],[144,190],[122,148],[117,126]],
      edges:[[0,2],[2,1],[2,3],[3,4],[4,5],[5,6],[0,7],[0,8],[8,3],[3,9]],
      spots:{post:['우체국',[40,123],1],bench:['작업대',[179,172],7],boat:['우편정',[323,97],6],board:['항로 게시판',[117,119],9]}},
    mine: {name:'붉은 만 · 옛 광산',spawn:4,nodes:[[98,185],[138,187],[204,195],[261,188],[317,150],[266,174],[237,184]],
      edges:[[0,1],[1,2],[2,6],[6,3],[3,5],[5,4]],spots:{winch:['권양기',[80,150],0],wreck:['난파선',[252,150],6],boat:['우편정',[342,125],4]}},
    salt: {name:'흰 띠 · 옛 염전',spawn:4,nodes:[[67,165],[103,161],[169,151],[243,140],[332,123],[285,132]],
      edges:[[0,1],[1,2],[2,3],[3,5],[5,4]],spots:{gate:['수문',[77,130],0],shed:['창고',[251,116],3],boat:['우편정',[342,108],4]}}
  };
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
  function size(){
    if(!active)return;
    const full=box.clientWidth;if(!full)return;
    width=Math.min(W,Math.max(180,Math.floor(full)));
    const usable=Math.max(H,window.innerHeight-(window.innerHeight<520?125:204));
    const scale=Math.max(1,Math.floor(Math.min(full/width,usable/H)));
    canvas.style.width=viewport.style.width=(width*scale)+'px';canvas.style.height=viewport.style.height=(H*scale)+'px';
    if(canvas.width!==width){canvas.width=width;ctx.imageSmoothingEnabled=false;}
    alignCamera();updatePins();
  }
  function alignCamera(){camera=Math.round(Math.max(0,Math.min(W-width,px-width/2)));}
  function updatePins(){
    if(!scene)return;
    for(const b of document.getElementById('pins').children){
      const spot=scene.spots[b.dataset.spot];if(!spot)continue;
      const [x,y]=spot[1];
      b.style.left=(100*(x-camera)/width)+'%';b.style.top=(100*y/H)+'%';b.hidden=x-camera<5||x-camera>width-5;
    }
  }
  function markers(){
    const pins=document.getElementById('pins'), nav=document.getElementById('destinations');pins.replaceChildren();nav.replaceChildren();
    Object.entries(scene.spots).forEach(([key,[name]],i)=>{
      const marker=document.createElement('button');marker.type='button';marker.className='pin';marker.dataset.spot=key;marker.title=name;marker.setAttribute('aria-label',name+' 살펴보기');marker.textContent=i+1;marker.onclick=()=>moveToSpot(key);pins.append(marker);
      const button=document.createElement('button');button.type='button';button.dataset.spot=key;
      const number=document.createElement('b');number.textContent=i+1;button.append(number,document.createTextNode(name));button.onclick=()=>moveToSpot(key);nav.append(button);
    });updatePins();
  }
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
  function moveToSpot(key){if(paused||!scene.spots[key])return;held.clear();request=key;route=findRoute(scene.nodes[scene.spots[key][2]]);}
  function nearestSpot(){
    const spots=Object.keys(scene.spots).sort((a,b)=>dist([px,py],scene.nodes[scene.spots[a][2]])-dist([px,py],scene.nodes[scene.spots[b][2]]));
    moveToSpot(spots[0]);
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
    if(!route.length&&request){const key=request;request=null;face='up';onSpot(key);}
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
    const oldCamera=camera;alignCamera();if(oldCamera!==camera)updatePins();
    const image=textures[id];if(image.complete&&image.naturalWidth){ctx.drawImage(image,-camera,0);weather(reduced.matches?0:ts/1000);}else{ctx.fillStyle='#164b59';ctx.fillRect(0,0,width,H);}
    actor(moving);raf=requestAnimationFrame(frame);
  }
  canvas.addEventListener('pointerdown',e=>{
    if(!active||paused)return;
    const b=canvas.getBoundingClientRect(),pos=[camera+(e.clientX-b.left)*width/b.width,(e.clientY-b.top)*H/b.height];
    for(const [k,[,p]] of Object.entries(scene.spots))if(dist(pos,p)<12){moveToSpot(k);return;}
    const foot=projection(pos);
    if(foot.d>16)return;
    request=null;held.clear();route=findRoute(foot.point);
  });
  const keys={ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right'};
  addEventListener('keydown',e=>{if(!active||paused||e.altKey||e.metaKey||e.ctrlKey)return;
    if(keys[e.code]){e.preventDefault();route=[];request=null;held.add(keys[e.code]);}
    else if(e.code==='KeyE'||(e.code==='Space'&&e.target.tagName!=='BUTTON')){e.preventDefault();if(!e.repeat)nearestSpot();}});
  addEventListener('keyup',e=>held.delete(keys[e.code]));addEventListener('blur',()=>held.clear());
  addEventListener('resize',size);
  window.World={scenes,start(state,cb){s=state;onSpot=cb;active=true;paused=false;this.enter(state.scene);cancelAnimationFrame(raf);lastFrame=performance.now();raf=requestAnimationFrame(frame);},
    enter(key){s.scene=key;id=key;scene=scenes[id];[px,py]=scene.nodes[scene.spawn];face='up';route=[];request=null;held.clear();markers();size();},
    stop(){active=false;held.clear();route=[];request=null;cancelAnimationFrame(raf);},pause(value){paused=value;held.clear();},resize:size};
})();
