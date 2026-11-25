(() => {
  'use strict';
  const spots={
    quarry:{
      downhill:['부두로 내려가는 길',[26,161],[35,165]],
      elder:['석 어르신',[140,119],[149,124]],supply:['사무실 공구함',[64,111],[68,133]],
      bench:['광업소 작업대',[118,105],[118,123]],
      leftPile:['왼쪽 표지석',[180,86],[179,107]],rightPile:['오른쪽 표지석',[349,96],[349,116]],
      leftDoor:['왼쪽 갱구',[213,64],[212,98]],rightDoor:['오른쪽 갱구',[315,66],[310,103]]},
    mailcave:{
      exit:['광업소 출구',[30,65],[31,108]],rack:['옛 배달 칸',[109,62],[108,106]],
      wreck:['기울어진 우편차',[211,65],[205,103]],switch:['황동 전환기',[287,77],[292,114]],
      delivery:['인도대의 우편함',[337,129],[331,141]],coast:['서안 해안길',[353,68],[351,104]]}
  };
  const scenes={quarry:{name:'북암 · 옛 광업소',spawn:[36,166],spots:spots.quarry},mailcave:{name:'서쪽 우편굴',spawn:[32,110],spots:spots.mailcave}};
  const bounds={quarry:{downhill:[10,149,35,29],elder:[132,99,17,23],supply:[49,95,29,28],bench:[100,94,34,24],leftPile:[158,73,37,26],rightPile:[333,81,40,27],leftDoor:[197,47,34,34],rightDoor:[296,48,34,35]},
    mailcave:{exit:[7,40,47,51],rack:[72,39,77,50],wreck:[163,35,91,60],switch:[271,58,42,41],delivery:[323,115,28,20],coast:[327,44,50,47]}};
  const labels={downhill:'부두 길 살피기',elder:'석 어르신과 대화',supply:'공구함 살피기',bench:'두 종지 살피기',leftPile:'왼쪽 표지석 조사',rightPile:'오른쪽 표지석 조사',leftDoor:'왼쪽 갱구 살피기',rightDoor:'오른쪽 갱구 살피기',exit:'광업소로 난 길',rack:'배달 칸 살피기',wreck:'우편차 조사',switch:'선로 전환기 살피기',delivery:'우편함 열기',coast:'해안길 살피기'};
  let progress=0,shuntTime=-1;
  // Claude's distance-linked wheel and rail-joint motion, on the field pixel grid.
  function cartPose(progress,fromX,toX){
    const p=Math.min(1,Math.max(0,progress));
    const e=p*p*(3-2*p);
    const x=Math.round(fromX+(toX-fromX)*e);
    const y=p>0&&p<1&&Math.abs(x-fromX)%8===0?1:0;
    return {x,y,wheel:((x-fromX)/3)%(2*Math.PI)};
  }
  function tick(dt,s,reduced){
    const ready=progress===1;
    if(s.cartSent){shuntTime=-1;progress=reduced?1:Math.min(1,progress+dt*.54);}
    else if(shuntTime>=0){shuntTime+=dt;if(shuntTime>=2||reduced)shuntTime=-1;}
    return ready!==(progress===1);
  }
  function line(g,pts,c,w=1){
    g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.strokeStyle=c;g.lineWidth=w;g.stroke();
  }
  function box(g,x,y,w,h,c){g.fillStyle=c;g.fillRect(x,y,w,h);}
  function arrow(g,x,y,dir){
    box(g,x,y,2,10,'#6c4e36');box(g,x-5,y-3,12,5,'#523d32');box(g,x-4,y-3,10,4,'#bd9361');
    line(g,[[x+dir*3,y-1],[x-dir*2,y-1]],'#423a31');line(g,[[x+dir,y-2],[x+dir*3,y-1],[x+dir,y]],'#423a31');
  }
  function flag(g,x,y,t){
    box(g,x,y,1,14,'#634d3c');g.fillStyle='#378a81';g.beginPath();g.moveTo(x+1,y);g.lineTo(x+10,y+1+Math.sin(t*2));g.lineTo(x+1,y+6);g.fill();box(g,x+2,y+2,4,1,'#f0dcaf');
  }
  function paint(g,camera,scene,s,t){
    g.save();g.translate(-camera,0);
    if(scene==='north'){
      arrow(g,371,105,1);if(s.westStamp)flag(g,365,91,t);
    }else if(scene==='quarry'){
      arrow(g,28,155,-1);
      if(!s.acidKit){box(g,62,105,4,6,'#b17e3c');box(g,63,103,2,3,'#f2c57f');line(g,[[69,105],[66,110]],'#c3ddd9');}
      for(const x of [115,122]){box(g,x-2,105,5,2,'#dfcda2');box(g,x-1,107,3,1,'#775f4b');}
      for(const [x,y] of [[177,90],[347,98]]){
        box(g,x-3,y-6,6,8,'#bcb9a7');box(g,x-3,y-6,2,7,'#e1dbbe');box(g,x+2,y-5,1,7,'#797e75');
      }
    }else{
      const shunt=shuntTime<0?0:1-Math.abs(shuntTime-1);
      const pose=shuntTime<0?cartPose(progress,183,337):cartPose(shunt,183,121);
      const x=pose.x,y=128+pose.y;
      g.fillStyle='#4b3d334d';g.beginPath();g.ellipse(x,y+4,12,2,0,0,Math.PI*2);g.fill();
      for(const axle of [-7,7]){
        g.beginPath();g.arc(x+axle,y+1,3,0,2*Math.PI);g.fillStyle='#374448';g.fill();
        const xx=2*Math.cos(pose.wheel),yy=2*Math.sin(pose.wheel);line(g,[[x+axle-xx,y+1-yy],[x+axle+xx,y+1+yy]],'#b8b6a0');
      }
      box(g,x-12,y-3,25,3,'#4a4237');box(g,x-11,y-4,23,2,'#b18353');
      if(s.caseLoaded&&!s.mailCard&&!s.westStamp){
        box(g,x-9,y-12,19,8,'#6b5140');box(g,x-10,y-13,20,3,'#b38a59');box(g,x-6,y-13,2,9,'#64716a');box(g,x+5,y-13,2,9,'#60736d');box(g,x,y-9,3,3,'#e9d7a6');
      }
      if(s.westStamp)flag(g,351,81,t);
    }
    g.restore();
  }
  const rows=['    11111   ','   1222221  ','   2322322  ','   1333531  ','    33333   ','    2223    ','   466664   ','  46677664  ','  34677643  ','  34666643  ','   4444443  ','   887788 1 ','   888888 1 ','   888 88 1 ','   888 88 1 ','   111 11 1 ','  1111 1111 '];
  const palette=['','#48473d','#ddd4b7','#d3a97e','#617363','#886e50','#789383','#c6ac70','#56626a'];
  function elder(g,camera,t){
    g.save();g.translate(140-camera,120);g.fillStyle='#4f41354f';g.beginPath();g.ellipse(0,0,6,1.5,0,0,7);g.fill();
    rows.forEach((row,y)=>{for(let x=0;x<row.length;x++){const k=Number(row[x]);if(k)box(g,x-6,y-17,1,1,palette[k]);}});
    const h=Math.sin(t*1.35)>.5?0:1;box(g,-4,-8+h,4,2,'#d4c39c');box(g,-2,-8+h,1,1,'#94775a');g.restore();
  }
  window.WestField={scenes,bounds,labels,cartPose,paint,elder,tick,arrived:()=>progress===1,shunt(){shuntTime=0;},
    enter(s){progress=s.cartSent?1:0;shuntTime=-1;}};
})();
