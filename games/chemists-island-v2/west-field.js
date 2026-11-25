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
  const home=[185,145],junction=[205,127],storage=[119,127],dock=[337,127];
  const routes={toStore:[home,junction,storage],toDock:[home,junction,dock],returning:[storage,junction,home]};
  let phase='',progress=0,gateProgress=0,mapOpened=0,lastElderTime=null;
  function pathPose(points,p){
    const lengths=points.slice(1).map(([x,y],i)=>Math.hypot(x-points[i][0],y-points[i][1]));
    const total=lengths.reduce((a,b)=>a+b,0),distance=total*p*p*(3-2*p);
    let left=distance,i=0;
    while(i<lengths.length-1&&left>lengths[i])left-=lengths[i++];
    const [x,y]=points[i],[nx,ny]=points[i+1],u=Math.min(1,left/lengths[i]);
    const signed=(n,d)=>Math.sign(points[n+1][0]-points[n][0])*d;
    const spin=lengths.slice(0,i).reduce((sum,d,n)=>sum+signed(n,d),0)+signed(i,left);
    return {x:x+(nx-x)*u,y:y+(ny-y)*u+(p>0&&p<1&&Math.floor(distance)%14===0?.4:0),wheel:spin/3};
  }
  function tick(dt,s,reduced){
    if(s.coastOpening){
      gateProgress=reduced?1:Math.min(1,gateProgress+dt/1.1);
      if(gateProgress===1)return true;
    }
    if(!routes[s.cartPhase]){phase=s.cartPhase;return false;}
    if(phase!==s.cartPhase){phase=s.cartPhase;progress=0;}
    progress=reduced?1:Math.min(1,progress+dt/(phase==='toDock'?2.1:1.65));
    return progress===1;
  }
  function pose(s){
    if(s.cartPhase==='returning')return pathPose(routes.toStore,s.cartPhase===phase?1-progress:1);
    if(routes[s.cartPhase])return pathPose(routes[s.cartPhase],s.cartPhase===phase?progress:0);
    if(s.cartPhase==='parked')return pathPose(routes.toStore,1);
    if(s.cartPhase==='docked')return pathPose(routes.toDock,1);
    return {x:home[0],y:home[1],wheel:0};
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
  function marker(g,x,y){
    box(g,x-6,y,13,3,'#58594e');box(g,x-5,y,11,1,'#b3a184');
    const pts=[[x-4,y],[x-4,y-11],[x-2,y-15],[x+2,y-15],[x+4,y-12],[x+4,y]];
    g.beginPath();pts.forEach(([a,b],i)=>i?g.lineTo(a,b):g.moveTo(a,b));g.closePath();g.fillStyle='#c3c1ae';g.fill();g.strokeStyle='#63675c';g.lineWidth=.8;g.stroke();
    line(g,[[x-3,y-2],[x-3,y-11],[x-1,y-14],[x+2,y-14]],'#e1dfc9');
    line(g,[[x,y-8],[x+2,y-9],[x+3,y-12]],'#8c9180');
    box(g,x-5,y+3,2,1,'#ded8c0');box(g,x-1,y+3,1,1,'#d6ccad');
  }
  function wall(g){
    // The collapsed wall crossed the shared yard entrance, before the two portals.
    for(const [x,y,h] of [[77,142,3],[84,140,3],[91,138,2],[98,136,1],[194,126,1],[201,125,2],[208,124,3]]){
      for(let j=0;j<h;j++){
        const xx=x+j%2,yy=y-j*2;
        box(g,xx,yy,7,3,'#655b4d');box(g,xx,yy,6,1,'#b2a28a');box(g,xx,yy+1,5,1,'#90856e');
      }
    }
    for(const [x,y] of [[106,138],[108,136],[119,135],[177,131],[186,129],[190,131]]){
      box(g,x,y,3,2,'#8d7b61');box(g,x,y,2,1,'#c0ab85');
    }
  }
  function fieldRails(g){
    const [hx,hy]=home,[jx,jy]=junction;
    for(let i=0;i<7;i++){const t=i/7,x=hx+(jx-hx)*t,y=hy+(jy-hy)*t;
      line(g,[[x-3,y-2],[x+4,y+2]],'#5e4a39',2.4);}
    for(const d of [-2,2]){
      line(g,[[hx+d,hy+d],[jx+d,jy+d],[jx+11,jy+d]],'#514c43',1.7);
      line(g,[[hx+d,hy+d-.4],[jx+d,jy+d-.4],[jx+11,jy+d-.4]],'#b5a58b',.7);
    }
    box(g,jx+5,jy+4,5,2,'#725842');line(g,[[jx+7,jy+4],[jx+9,jy]],'#ceaf70',1.2);
  }
  function coastGate(g,img,p){
    if(!img||!p)return;
    const sx=img.naturalWidth/384,sy=img.naturalHeight/216;
    const part=(x,y,w,h,tx,ty,tw,th)=>g.drawImage(img,x*sx,y*sy,w*sx,h*sy,tx,ty,tw,th);
    const open=Math.max(0,(p-.24)/.76),leaf=22*(1-Math.sin(open*Math.PI/2)*.90);
    g.save();g.beginPath();g.rect(325,50,45,35);g.clip();
    // Sea beyond the original gate and the stone sill share the original scene texture.
    part(329,29,37,17,325,50,45,22);part(327,86,43,6,325,72,45,13);
    part(325,50,22.5,35,325,50,leaf+.5,35);part(347.5,50,22.5,35,370-leaf-.5,50,leaf+.5,35);
    if(p<.48)box(g,343-Math.min(1,p/.24)*6,65,7,1.5,'#d7ba75');
    g.restore();
  }
  function paint(g,camera,scene,s,t,img){
    g.save();g.translate(-camera,0);
    if(scene==='north'){
      arrow(g,371,105,1);if(s.coastOpen)flag(g,365,91,t);
    }else if(scene==='quarry'){
      arrow(g,28,155,-1);
      if(!s.acidKit){box(g,62,105,4,6,'#b17e3c');box(g,63,103,2,3,'#f2c57f');line(g,[[69,105],[66,110]],'#c3ddd9');}
      for(const x of [115,122]){box(g,x-2,105,5,2,'#dfcda2');box(g,x-1,107,3,1,'#775f4b');}
      wall(g);marker(g,177,94);marker(g,347,101);
    }else{
      coastGate(g,img,s.coastOpen?1:gateProgress);
      fieldRails(g);
      const current=pose(s),x=current.x,y=current.y;
      g.fillStyle='#4b3d334d';g.beginPath();g.ellipse(x,y+4,12,2,0,0,Math.PI*2);g.fill();
      for(const axle of [-7,7]){
        g.beginPath();g.arc(x+axle,y+1,3,0,2*Math.PI);g.fillStyle='#374448';g.fill();
        const xx=2*Math.cos(current.wheel),yy=2*Math.sin(current.wheel);line(g,[[x+axle-xx,y+1-yy],[x+axle+xx,y+1+yy]],'#b8b6a0');
      }
      box(g,x-12,y-3,25,3,'#4a4237');box(g,x-11,y-4,23,2,'#b18353');
      if(s.caseLoaded&&!s.mailCard&&!s.westStamp){
        box(g,x-9,y-12,19,8,'#6b5140');box(g,x-10,y-13,20,3,'#b38a59');box(g,x-6,y-13,2,9,'#64716a');box(g,x+5,y-13,2,9,'#60736d');box(g,x,y-9,3,3,'#e9d7a6');
      }
      if(s.coastOpen)flag(g,351,81,t);
    }
    g.restore();
  }
  const rows=['    11111   ','   1222221  ','   2322322  ','   1333531  ','    33333   ','    2223    ','   466664   ','  46677664  ','  34677643  ','  34666643  ','   4444443  ','   887788 1 ','   888888 1 ','   888 88 1 ','   888 88 1 ','   111 11 1 ','  1111 1111 '];
  const palette=['','#48473d','#ddd4b7','#d3a97e','#617363','#886e50','#789383','#c6ac70','#56626a'];
  function elder(g,camera,t,px,py){
    const near=Math.hypot(px-140,py-120)<34,look=px<140?-1:1;
    const dt=lastElderTime===null?0:Math.max(0,Math.min(.12,t-lastElderTime));lastElderTime=t;
    mapOpened=t===0?Number(near):Math.max(0,Math.min(1,mapOpened+(near?1:-1)*dt*5));
    g.save();g.translate(140-camera,120);g.fillStyle='#4f41354f';g.beginPath();g.ellipse(0,0,6,1.5,0,0,7);g.fill();
    g.save();if(near)g.scale(look,1);
    rows.forEach((row,y)=>{for(let x=0;x<row.length;x++){const k=Number(row[x]);if(k)box(g,x-6,y-17,1,1,palette[k]);}});
    box(g,-2,-11,5,1,'#a85339');box(g,-2,-10,2,3,'#c97549');
    if(near){
      box(g,2,-14,1,1,'#523f33');box(g,3,-13,1,1,'#d7aa7e');
      const w=3+Math.round(4*mapOpened);box(g,0,-7,w,4,'#cebc91');box(g,1,-7,2,3,'#efe2bd');if(w>5)box(g,4,-6,2,1,'#89917d');box(g,w-1,-5,1,2,'#bb916c');
    }else{const h=Math.sin(t*1.35)>.5?0:1;box(g,-4,-8+h,4,2,'#d4c39c');}
    g.restore();g.restore();
  }
  window.WestField={scenes,bounds,labels,routes,pathPose,paint,elder,tick,
    enter(s){phase='';progress=0;gateProgress=s.coastOpen?1:0;}};
})();
