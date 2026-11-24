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
  const keeper=sprite([
    '     ooooo','    orrrrrro','   orrtttttro','   otoooootto',
    '    lfffsfho','    lfeffeh','    lggfggg','     oggggo',
    '    oyuuyyo','   oyuyyyuyoo','  otuyytyyyoho','  osuyysyyosfo',
    '  ofoyysyyob o','   oosssssobgbo','    odddddobuf','    oddoddoooo',
    '    oddoddo','   okkkokkk','   oooo oooo'
  ],{o:outline,r:'#9d4c33',t:'#cf7242',l:'#7b624c',f:'#e3b587',s:'#856c4c',h:'#ab7754',e:'#403d43',g:'#c1bd9f',y:'#c49a4c',u:'#e0b968',d:'#465b59',k:'#5d4840',b:'#5a5150'});
  const residents=[{x:144,y:127,art:keeper},{x:62,y:139,art:chief}];
  function person(ctx,camera,p,time){
    const x=p.x-camera, art=p.art;
    ctx.save();ctx.fillStyle='#382f3c55';ctx.beginPath();ctx.ellipse(x,p.y,5.9,1.65,0,0,2*Math.PI);ctx.fill();
    const scale=1.12;
    // A brief shift of the upper body leaves both feet planted.
    const cut=14,shift=time&&Math.sin(time*1.65+p.x)>.86?.55:0;
    const left=x-art.width*scale/2,top=p.y-art.height*scale;
    ctx.drawImage(art,0,0,art.width,cut,left,top+shift,art.width*scale,cut*scale);
    ctx.drawImage(art,0,cut,art.width,art.height-cut,left,top+cut*scale,art.width*scale,(art.height-cut)*scale);
    ctx.restore();
  }
  function beacon(ctx,camera,t){
    ctx.save();ctx.translate(230-camera,113);
    ctx.fillStyle='#f9c45a30';ctx.beginPath();ctx.moveTo(1,-9);ctx.lineTo(34,-4);ctx.lineTo(42,0);ctx.closePath();ctx.fill();
    ctx.fillStyle='#594535';ctx.fillRect(-1,-8,2,11);ctx.fillRect(-3,-13,6,6);
    ctx.fillStyle='#ffdc82';ctx.fillRect(-2,-12,4,4);ctx.fillStyle='#fff4c5';ctx.fillRect(-1,-12,2,3);
    ctx.fillStyle='#ead98c75';ctx.fillRect(16+Math.round(Math.sin(t)),4,8,1);ctx.restore();
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
  window.PierYard={residents,person,paint,beacon};
})();
