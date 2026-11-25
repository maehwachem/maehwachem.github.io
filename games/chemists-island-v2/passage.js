/* Travel shots share the field's 384 × 216 coordinate system and the original walking sprite. */
(() => {
  'use strict';
  const byId=id=>document.getElementById(id);
  const dialog=byId('passage'),canvas=byId('passage-picture'),g=canvas.getContext('2d');
  const heading=byId('passage-title'),caption=byId('passage-caption'),skip=byId('passage-skip');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'), images=new Map();
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const tween=(a,b,p)=>a+(b-a)*p;
  const smooth=p=>p*p*(3-2*p);
  const names={harbor:'우편선 선착장',mine:'붉은 만',salt:'옛 염전',north:'북암 부두',quarry:'옛 광업소',mailcave:'서쪽 우편굴',yard:'우체국 작업마당'};
  // Each pair runs from the walkable field to the gangway or threshold.
  const docks={
    harbor:[[258,119],[298,103]],mine:[[317,150],[340,126]],
    salt:[[332,123],[345,110]],north:[[64,151],[74,170]]
  };
  const walks=[
    {ends:['harbor','yard'],paths:[[[57,150],[38,131]],[[54,151],[32,125]]],name:'우체국 옆 골목'},
    {ends:['north','quarry'],paths:[[[369,111],[382,101]],[[36,166],[9,175]]],name:'광업소 오르막'},
    {ends:['quarry','mailcave'],paths:[[[310,103],[317,76]],[[32,110],[31,75]]],name:'목재 갱문'},
    {ends:['mailcave','north'],paths:[[[351,104],[348,82]],[[369,111],[382,101]]],name:'서안 해안길',plate:'coast'}
  ];
  const notes={
    harbor:'빨간 우체통 옆 부두에 닿았다.',mine:'권양기 아래 붉은 바위가 보인다.',
    salt:'수문 너머 흰 소금밭이 펼쳐진다.',north:'북암 부두의 계선 기둥에 배를 댄다.',
    quarry:'무너진 돌담 사이로 광업소 마당에 들어선다.',mailcave:'그늘에 눈이 익자 낡은 우편 선로가 보인다.',
    yard:'골목 너머로 우체국 작업마당이 열린다.'
  };
  const file={sea:'art/passage-sea.webp',boat:'art/passage-boat.webp',coast:'art/passage-coast.webp'};
  function asset(key){
    if(!images.has(key)){
      const img=new Image();
      if(!file[key])img.onerror=()=>{img.onerror=null;img.src='art/'+key+'.png';};
      images.set(key,img);img.src=file[key]||'art/'+key+'-hd.webp';
    }
    return images.get(key);
  }
  const ready=img=>img.complete&&img.naturalWidth>0;
  function plan(from,to){
    const land=walks.find(r=>r.ends.includes(from)&&r.ends.includes(to)&&from!==to);
    if(land){
      const i=land.ends.indexOf(from);
      return {from,to,land,depart:land.paths[i],arrive:land.paths[1-i],dir:i===0?1:-1};
    }
    return {from,to,depart:docks[from],arrive:docks[to],dir:from==='harbor'?1:-1};
  }
  function shadow(x,y,w){
    g.fillStyle='#162f3763';g.fillRect(Math.round(x-w/2),Math.round(y),w,1.5);
  }
  function person(x,y,dx,dy,p,stride){
    const face=Math.abs(dx)>Math.abs(dy)*.78?(dx<0?'left':'right'):(dy<0?'up':'down');
    shadow(x,y,10);
    IslandChemist.draw(g,Math.round(x),Math.round(y),face,stride?Math.floor(p*stride)%8:-1,1.25);
  }
  function fieldShot(id,path,arriving,p,w,h,s){
    const img=asset(id);
    if(!ready(img))return;
    const [floor,edge]=path,start=arriving?edge:floor,end=arriving?floor:edge;
    const q=smooth(p),x=tween(start[0],end[0],q),y=tween(start[1],end[1],q);
    const zoom=Math.max(w/306,h/151);
    const cameraX=clamp(x-w/zoom*.50,0,384-w/zoom);
    const cameraY=clamp(y-h/zoom*.65,0,216-h/zoom);
    g.save();g.scale(zoom,zoom);g.translate(-cameraX,-cameraY);
    g.drawImage(img,0,0,384,216);
    if(id==='mailcave'||id==='quarry')WestField.paint(g,0,id,s,p,img);
    if(id==='north'){NorthDock.paint(g,0,s,p);NorthDock.person(g,0,s,p);}
    person(x,y,end[0]-start[0],end[1]-start[1],q,(p>.03&&p<.97)?16:0);
    g.restore();
  }
  function background(img,w,h,progress,dir){
    const scale=Math.max(w/img.naturalWidth,h/img.naturalHeight)*1.065;
    const bw=img.naturalWidth*scale,bh=img.naturalHeight*scale;
    const travel=dir===1?progress:1-progress;
    g.drawImage(img,-Math.round((bw-w)*tween(.23,.77,travel)),-Math.round((bh-h)*.48),bw,bh);
    return {top:-Math.round((bh-h)*.48),height:bh};
  }
  // Claude's moving foam line fades behind the stern, in either direction.
  function drawWake(x,y,dir,seconds){
    const f=Math.floor(seconds*10);
    x=Math.round(x);y=Math.round(y);
    for(let i=0;i<6;i++){
      const k=(Math.imul(i*31+f,2654435761)>>>0)%100;
      if(k<60){g.fillStyle=k<25?'#f5f7ee':'#cfe9ec';g.fillRect(x-dir*(i+1),y-1+k%3,1,1);}
    }
    for(let i=6;i<34;i++){
      const a=1-(i-6)/28;
      if(((i-f)%5+5)%5<3){g.fillStyle='rgba(232,246,252,'+a+')';g.fillRect(x-dir*i,y,1,1);}
      if(i<20&&((i-f)%3+3)%3===0){g.fillStyle='rgba(160,205,225,'+a+')';g.fillRect(x-dir*i,y+2,1,1);}
    }
  }
  function seaShot(route,p,w,h){
    const sea=asset('sea'),boat=asset('boat');
    if(ready(sea))background(sea,w,h,p,route.dir);
    else{
      const scene=asset('harbor');
      if(ready(scene))g.drawImage(scene,scene.naturalWidth*.27,0,scene.naturalWidth*.38,scene.naturalHeight*.44,0,0,w,h);
    }
    const q=route.dir===1?p:1-p;
    const x=Math.round(w*tween(.25,.74,q)),y=Math.round(h*.69+Math.sin(p*16)*.9);
    const sw=Math.round(Math.min(w*.43,116)),sh=ready(boat)?sw*boat.naturalHeight/boat.naturalWidth:sw*.40;
    g.save();g.translate(x,y);g.scale(route.dir,1);shadow(0,1,Math.round(sw*.7));g.restore();
    drawWake(x-route.dir*sw*.44,y-.2,route.dir,p*3);
    g.save();g.translate(x,y);g.scale(route.dir,1);
    if(ready(boat))g.drawImage(boat,-sw/2,-sh,sw,sh);
    else{
      g.fillStyle='#864233';g.beginPath();g.moveTo(-sw*.45,-5);g.lineTo(sw*.47,-8);g.lineTo(sw*.3,0);g.lineTo(-sw*.38,0);g.fill();
      g.fillStyle='#f2dcb1';g.fillRect(-4,-17,19,12);g.fillStyle='#3a6271';g.fillRect(0,-15,10,5);
      g.fillStyle='#365878';g.fillRect(-sw*.40,-16,sw*.29,3);
    }
    g.restore();
  }
  function pathShot(route,p,w,h,state){
    const img=asset('coast');
    if(!ready(img)){fieldShot(route.to,route.arrive,true,p,w,h,state);return;}
    const crop=background(img,w,h,p,route.dir);
    const x=w*tween(.32,.67,route.dir===1?p:1-p),y=crop.top+crop.height*.566;
    person(x,y,route.dir,0,p,32);
  }
  function legCaption(r,side){
    if(side==='arrive'){
      if(!r.land)return notes[r.to];
      if(r.to==='harbor')return '골목을 빠져나오자 빨간 우체통이 보인다.';
      if(r.to==='north')return '바람우체소 지붕 아래로 다시 부두가 보인다.';
      return notes[r.to];
    }
    if(!r.land)return r.to==='harbor'?'우편정에 올라 귀항할 채비를 한다.':'부두에서 우편정에 올라 출항한다.';
    if(r.land.plate)return '물결 깃발이 걸린 해안문 길로 들어선다.';
    if(r.land.ends.includes('mailcave'))return r.from==='quarry'?'두꺼운 갱문 아래로 들어간다.':'선로를 따라 밝은 갱문으로 걸어간다.';
    if(r.land.ends.includes('north'))return r.from==='north'?'돌계단을 따라 광업소로 올라간다.':'돌계단을 따라 북암 부두로 내려간다.';
    return '우체국 옆 좁은 골목을 지난다.';
  }
  function render(run,p,still=false){
    const r=run.route,withMiddle=!r.land||r.land.plate;
    const departEnd=withMiddle ? .23 : .50,arriveStart=withMiddle ? .74 : .50;
    const part=p<departEnd?'depart':p<arriveStart?'middle':'arrive';
    const local=part==='depart'?p/departEnd:part==='middle'?(p-departEnd)/(arriveStart-departEnd):(p-arriveStart)/(1-arriveStart);
    const rect=canvas.getBoundingClientRect();
    const w=clamp(Math.round(216*rect.width/Math.max(1,rect.height)),145,480),h=216;
    const density=clamp(Math.ceil(rect.height*(devicePixelRatio||1)/h),1,4);
    if(canvas.width!==w*density||canvas.height!==h*density){canvas.width=w*density;canvas.height=h*density;}
    g.setTransform(density,0,0,density,0,0);g.imageSmoothingEnabled=false;g.fillStyle='#123c49';g.fillRect(0,0,w,h);
    if(part==='middle'){if(r.land)pathShot(r,local,w,h,run.state);else seaShot(r,local,w,h);}
    else{const arriving=part==='arrive';fieldShot(arriving?r.to:r.from,arriving?r.arrive:r.depart,arriving,local,w,h,run.state);}
    // A very brief dip marks the cut at the gangway or the tunnel threshold.
    if(!still){
      const edge=Math.min(Math.abs(p-departEnd),Math.abs(p-arriveStart));
      if(edge<.035){g.fillStyle='rgba(16,31,35,'+(.62*(1-edge/.035))+')';g.fillRect(0,0,w,h);}
    }
    if(run.part!==part){
      run.part=part;
      heading.textContent=part==='depart'?names[r.from]:part==='arrive'?names[r.to]:(r.land?r.land.name:(r.to==='north'?'북암':names[r.to])+'행 우편정');
      caption.textContent=part==='middle'?(r.land?'파도 소리를 따라 절벽길을 걷는다.':(r.to==='harbor'?'뱃머리를 돌려 익숙한 포구로 향한다.':'부표를 뒤로하고 섬 사이 물길을 건넌다.')):legCaption(r,part);
      canvas.setAttribute('aria-label',caption.textContent);
    }
  }
  let current=null;
  function finish(){
    if(!current)return;
    const run=current;current=null;
    cancelAnimationFrame(run.frame);clearTimeout(run.timer);dialog.close();run.done();
  }
  function play(from,to,state,done){
    if(current)return;
    const route=plan(from,to),keys=[from,to,...(route.land?(route.land.plate?['coast']:[]):['sea','boat'])];
    const pictures=keys.map(asset);
    const run={route,state,done,part:'',frame:0,timer:0};current=run;
    dialog.showModal();skip.focus({preventScroll:true});
    const hold=reduced.matches, duration=hold?1350:route.land?(route.land.plate?3500:2200):5100;
    const opened=performance.now();
    let start=null;
    function tick(t){
      if(current!==run)return;
      if(start===null&&(pictures.every(ready)||performance.now()-opened>1000))start=t;
      const p=start===null?0:clamp((t-start)/duration,0,1);
      // Reduced motion shows a static illustration; skipping always reaches the same landing.
      const poster=route.land&&!route.land.plate ? .82 : .50;
      render(run,hold?poster:p,hold);
      if(p>=1)finish();else run.frame=requestAnimationFrame(tick);
    }
    render(run,hold?(route.land&&!route.land.plate ? .82 : .50):0,hold);run.frame=requestAnimationFrame(tick);
    // Browsers suspend rAF in background tabs. The story destination was saved at departure.
    run.timer=setTimeout(finish,duration+2000);
  }
  skip.onclick=finish;
  dialog.addEventListener('cancel',e=>{e.preventDefault();finish();});
  window.Passage={play};
})();
