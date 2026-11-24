/* Island residents and the movable pieces of the post office's work yard. */
(() => {
  'use strict';
  const outline='#383944';
  function sprite(rows,palette){
    const sheet=document.createElement('canvas');
    sheet.width=Math.max(...rows.map(row=>row.length));sheet.height=rows.length;
    const pen=sheet.getContext('2d');
    rows.forEach((row,y)=>[...row].forEach((key,x)=>{
      if(!palette[key])return;
      pen.fillStyle=palette[key];pen.fillRect(x,y,1,1);
    }));
    return sheet;
  }
  const chief=sprite([
    '     ooooo','    onnnnno','   onbbbbbno','   ooooGoool',
    '    hfffffl','    hfefefl','    hfssffo','     oggoo',
    '   oobwwbboo','  obbnwGnbbbo','  obbarnnbbbo','  ohbaGarnhho',
    '   fhannnraho','   olGGGGGaao','    oddddddo','    oddodddo',
    '    oddodddo','   okkkokkko','   oooo oooo'
  ],{o:outline,n:'#315777',b:'#527898',G:'#dfb05e',l:'#62513e',h:'#9d6c49',f:'#e8b283',e:'#453e44',s:'#bc7e5d',g:'#a5a59b',w:'#eadcbc',a:'#834f37',r:'#b37e4b',d:'#374551',k:'#5f4a3e'});
  const keeperPalette={o:outline,r:'#9d4c33',t:'#cf7242',l:'#7b624c',f:'#e3b587',s:'#856c4c',h:'#ab7754',e:'#403d43',g:'#c1bd9f',y:'#c49a4c',u:'#e0b968',d:'#465b59',k:'#5d4840',b:'#5a5150'};
  const keeperFront=sprite([
    '     ooooo','    orrrrrro','   orrtttttro','   otoooootto',
    '    lfffsfho','    lfeffeh','    lggfggg','     oggggo',
    '    oyuuyyo','   oyuyyyuyoo','  otuyytyyyoho','  osuyysyyosfo',
    '  ofoyysyyob o','   oosssssobgbo','    odddddobuf','    oddoddoooo',
    '    oddoddo','   okkkokkk','   oooo oooo'
  ],keeperPalette);
  // The bends skirt the repair chest and keep both feet on the boardwalk.
  const path=[[144,127],[164,123],[188,129],[210,130],[224,123]];
  const hook={x:230,y:105};
  const keeper={x:144,y:127,art:keeperFront,mode:'waiting',direction:1,distance:0,moving:false,reach:0};
  const residents=[keeper,{x:62,y:139,art:chief}];
  let stops=[];
  function enterHarbor(lit){
    [keeper.x,keeper.y]=lit?path[path.length-1]:path[0];
    Object.assign(keeper,{mode:lit?'post':'waiting',direction:1,distance:0,moving:false,reach:0});
    stops=[];
  }
  function startRound(){
    if(keeper.mode!=='post')return;
    stops=path.slice(0,-1).reverse().concat(path.slice(1));
    keeper.mode='round';keeper.distance=0;
  }
  function tickKeeper(dt,lit,blocked,reduced){
    keeper.moving=false;
    if(!lit)return false;
    if(keeper.mode==='waiting'){
      stops=path.slice(1);keeper.mode='carry';
    }
    if(blocked||keeper.mode==='post')return false;
    if(reduced){enterHarbor(true);return true;}
    if(!stops.length){
      keeper.reach=Math.min(1,keeper.reach+dt/1.1);
      if(keeper.reach===1)keeper.mode='post';
      return false;
    }
    let budget=22*dt;
    while(budget>0&&stops.length){
      const [tx,ty]=stops[0],dx=tx-keeper.x,dy=ty-keeper.y;
      const gap=Math.hypot(dx,dy),step=Math.min(budget,gap);
      if(dx)keeper.direction=Math.sign(dx);
      if(gap){keeper.x+=dx*step/gap;keeper.y+=dy*step/gap;}
      keeper.distance+=step;budget-=step;
      if(step===gap){keeper.x=tx;keeper.y=ty;stops.shift();}
    }
    keeper.moving=stops.length>0;
    if(!keeper.moving){
      keeper.mode=keeper.mode==='carry'?'hang':'check';keeper.reach=0;
    }
    return true;
  }
  // Two steps per twelve world pixels. The trailing foot lifts at the passing pose.
  function keeperStep(distance){
    if(distance<=0)return {near:{dx:0,lift:0},far:{dx:0,lift:0},bob:0,arm:0};
    const phase=Math.floor(distance/2)%6,k=phase%3,second=phase>=3;
    const lead={dx:[2,1,-1][k],lift:0},trail={dx:[-2,-1,1][k],lift:k===1?1:0};
    const arm=[1,0,-1][k];
    return {near:second?trail:lead,far:second?lead:trail,bob:k===1?-1:0,arm:second?-arm:arm};
  }
  const profile=sprite([
    '   oooo','  orrrro',' orttttro',' otoootttoo',
    '  lfffee','  lgffeff','   lggfg','   oggg',
    '  ouyyuo',' ouyytuyo',' ouysyyyo','  oysyyoo','  ossssso'
  ],keeperPalette);
  function lamp(ctx,x,y){
    ctx.fillStyle='#494246';ctx.fillRect(x-2,y-4,4,1);ctx.fillRect(x-3,y-3,6,6);
    ctx.fillStyle='#ffa953';ctx.fillRect(x-2,y-2,4,4);ctx.fillStyle='#fff1a1';ctx.fillRect(x-1,y-2,2,3);
  }
  function keeperProfile(ctx,camera){
    const pose=keeperStep(keeper.moving?keeper.distance:0);
    const reach=keeper.mode==='hang'?keeper.reach:keeper.mode==='check'?Math.sin(Math.PI*keeper.reach):0;
    ctx.save();ctx.translate(Math.round(keeper.x)-camera,Math.round(keeper.y));ctx.scale(keeper.direction*1.12,1.12);
    function leg(pose,x,cloth,boot){
      const dx=x+pose.dx,foot=-pose.lift;
      ctx.fillStyle=cloth;ctx.fillRect(x,-7,3,3);ctx.fillRect(dx,-5,3,5+foot);
      ctx.fillStyle=boot;ctx.fillRect(dx,foot-2,4,2);
    }
    leg(pose.far,-2,'#354846','#483f39');leg(pose.near,0,'#526763','#634b3c');
    ctx.drawImage(profile,-6,-19+pose.bob);
    ctx.fillStyle='#a97e3e';ctx.fillRect(-3-pose.arm,-10+pose.bob,3,4);
    ctx.fillStyle='#dcaf7f';ctx.fillRect(-3-pose.arm,-7+pose.bob,2,2);
    const handY=-9-Math.round(reach*8);
    ctx.fillStyle='#bb924c';ctx.fillRect(2,-11+pose.bob,3,3);ctx.fillRect(4,Math.min(-10,handY),2,Math.abs(handY+10)+2);
    ctx.fillStyle='#e2b985';ctx.fillRect(5,handY,2,2);
    ctx.restore();
    if(keeper.mode==='carry'||keeper.mode==='hang'){
      const lift=keeper.mode==='hang'?keeper.reach:0;
      lamp(ctx,Math.round(keeper.x+7-lift)-camera,Math.round(keeper.y-8-10*lift));
    }
  }
  function person(ctx,camera,p,time){
    const x=p.x-camera, art=p.art;
    ctx.save();ctx.fillStyle='#382f3c55';ctx.beginPath();ctx.ellipse(x,p.y,5.9,1.65,0,0,2*Math.PI);ctx.fill();
    if(p===keeper&&p.mode!=='waiting'){
      ctx.restore();keeperProfile(ctx,camera);return;
    }
    const scale=1.12;
    // A brief shift of the upper body leaves both feet planted.
    const cut=14,shift=time&&Math.sin(time*1.65+p.x)>.86?.55:0;
    const left=x-art.width*scale/2,top=p.y-art.height*scale;
    ctx.drawImage(art,0,0,art.width,cut,left,top+shift,art.width*scale,cut*scale);
    ctx.drawImage(art,0,cut,art.width,art.height-cut,left,top+cut*scale,art.width*scale,(art.height-cut)*scale);
    ctx.restore();
  }
  function beacon(ctx,camera,t){
    const x=hook.x-camera,y=hook.y;
    ctx.fillStyle='#513f32';ctx.fillRect(x-5,y-4,2,17);ctx.fillRect(x-5,y-5,6,2);ctx.fillRect(x,y-4,1,2);
    if(!['post','round','check'].includes(keeper.mode))return;
    ctx.save();ctx.translate(x,y);
    ctx.fillStyle='#f9c45a30';ctx.beginPath();ctx.moveTo(1,1);ctx.lineTo(34,7);ctx.lineTo(42,11);ctx.closePath();ctx.fill();
    lamp(ctx,0,0);
    ctx.fillStyle='#ead98c75';ctx.fillRect(16+Math.round(Math.sin(t)),15,8,1);ctx.restore();
  }
  function paint(ctx,camera,state){
    ctx.save();ctx.translate(-camera,0);
    const rect=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h);};
    function polygon(points,fill,edge){
      ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();
      if(fill){ctx.fillStyle=fill;ctx.fill();}
      if(edge){ctx.strokeStyle=edge;ctx.lineWidth=1.3;ctx.stroke();}
    }
    if(!state.woodFrame&&!state.still){
      const edge=[[69,120],[74,105],[93,104],[89,119]];
      ctx.save();ctx.strokeStyle='#513b30';ctx.lineWidth=3.8;ctx.beginPath();edge.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.stroke();ctx.restore();
      polygon(edge,null,'#ce9861');
    }
    if(!state.glassPane&&!state.still){
      polygon([[275,122],[279,104],[299,103],[295,121]],'#a3cdc9b8','#587a79');
      polygon([[278,119],[282,110],[289,105],[285,114]],'#e2f2dfbb');
      polygon([[287,119],[291,111],[296,106]],'#e2f2df9e');
    }
    // Basin, collecting channel and a separate clear bottle at the sunny bench.
    ctx.save();ctx.translate(22,-29);
    polygon([[170,114],[192,114],[190,119],[173,119]],'#39494b','#594335');
    rect(172,114,18,1,'#8cb9b8');rect(197,114,3,6,'#9fc0b7');rect(198,112,2,2,'#687c75');
    if(state.still){
      polygon([[171,113],[174,103],[194,109],[192,114]],'#bfd3bcac','#835f43');
      polygon([[176,105],[180,106],[174,112]],'#f3eccebd');
      rect(192,113,7,1,'#b2c4bd');rect(198,115,1,1,'#e3f0de');
    }
    ctx.restore();
    ctx.save();ctx.translate(7,-14);
    // Direction marker placed on the path back down to the quay.
    rect(26,150,2,10,'#71553b');polygon([[18,148],[22,145],[34,145],[34,150],[22,151]],'#e1bc83','#6d503a');
    ctx.restore();ctx.restore();
  }
  window.PierYard={residents,keeper,enterHarbor,startRound,tickKeeper,person,paint,beacon};
})();
