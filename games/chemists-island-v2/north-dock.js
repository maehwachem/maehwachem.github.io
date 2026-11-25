(() => {
  'use strict';
  const scene={name:'북암 · 바람우체소',spawn:[63,149],spots:{
    boat:['우편정',[94,170],[64,151]],cord:['삼줄 타래',[53,117],[53,126]],
    magnet:['창고 공구걸이',[84,86],[83,109]],tools:['창고 옆 작업대',[138,90],[141,108]],
    drain:['다리 점검홈',[128,135],[125,146]],crank:['도개교 손잡이',[166,118],[158,129]],
    haeun:['물새호 기관사',[304,100],[293,113]],radio:['우체소 무전기',[345,85],[346,103]]
  }};
  const bounds={boat:[48,158,88,30],cord:[41,106,23,20],magnet:[72,71,26,29],tools:[111,75,49,25],
    drain:[114,126,28,18],crank:[152,103,25,28],haeun:[293,84,23,27],radio:[330,69,32,25]};
  const labels={cord:'삼줄 챙기기',magnet:'공구걸이 살피기',tools:'작업대 살피기',drain:'점검홈 들여다보기',crank:'다리 손잡이 살피기',haeun:'기관사에게 말 걸기',radio:'무전기 살피기',boat:'우편정에 오르기'};
  let lowered=0;
  function paint(g,camera,s,t){
    g.save();g.translate(-camera,0);
    function box(x,y,w,h,c){g.fillStyle=c;g.fillRect(x,y,w,h);}
    function line(points,c,w=1){
      g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.strokeStyle=c;g.lineWidth=w;g.stroke();
    }
    function oval(x,y,rx,ry,c,w){
      g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);
      if(w){g.lineWidth=w;g.strokeStyle=c;g.stroke();}else{g.fillStyle=c;g.fill();}
    }
    // Mount the moving deck along the west quay. Its underside shows while raised.
    const angle=(1-lowered)*1.36, dx=66*Math.cos(angle), rise=51*Math.sin(angle);
    function corner(f,y){return [173+dx*f,y-rise*f];}
    const deck=[corner(0,126),corner(1,126),corner(1,142),corner(0,142)];
    function fill(poly,c){g.beginPath();poly.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fillStyle=c;g.fill();}
    fill(deck,'#825137');line(deck.concat([deck[0]]),'#4a3d36',2);
    for(let i=1;i<13;i++){const f=i/13;line([corner(f,126),corner(f,141)],i%3?'#ac8053':'#be9363',1.8);line([corner(f,127),corner(f,142)],'#513f34',.6);}
    line([corner(0,126),corner(1,126)],'#e1b57d',1.5);
    line([corner(0,140),corner(1,140)],'#674a37',2);
    for(const f of [.05,.5,.96]){
      const [x,y]=corner(f,126);box(x-1,y-5,2,6,'#594934');box(x-1,y-5,2,1,'#d8ae76');
    }
    line([corner(.05,121),corner(.5,121),corner(.96,121)],'#ceb78b',1);
    box(163,119,6,7,'#4a4e49');box(161,125,10,2,'#574638');
    oval(166,116,5.2,5.2,'#3e4949',2);oval(166,116,4.6,4.6,'#c5a675',1);
    const spin=lowered*3.8;for(let n=0;n<3;n++){const a=spin+n*2*Math.PI/3;line([[166,116],[166+4.8*Math.cos(a),116+4.8*Math.sin(a)]],'#60493a',1);}
    box(165,115,2,2,s.bridgeDown?'#dfbe82':'#323e40');
    // Recessed opening and small rim on the west quay.
    fill([[115,136],[120,131],[141,131],[137,139],[115,139]],'#5c5f59');
    fill([[117,136],[121,132],[138,132],[135,137],[117,137]],'#293c41');line([[115,139],[137,139],[141,132]],'#d5b993',1);
    if(!s.crankPin&&!s.bridgeDown)line([[129,135],[132,134]],'#c9d1c6',1);
    if(!s.cord&&!s.retriever&&!s.bridgeDown){
      oval(53,119,8,2,'#796650');for(let i=0;i<3;i++)oval(52,116,7-i*1.55,3-i*.6,'#b17d47',1.3);
      line([[56,116],[59,118],[63,117]],'#e1b371',1.1);
    }
    if(!s.magnet&&!s.retriever&&!s.bridgeDown){
      box(83,79,2,3,'#d7b383');line([[81,84],[81,89],[84,91],[88,89],[88,83]],'#473d3c',3);
      line([[81,84],[81,88],[84,90],[87,88],[87,84]],'#b8563e',2);
      box(80,82,2,3,'#c2ccc7');box(86,82,2,3,'#d5d6c8');
    }
    box(134,89,11,5,'#713d30');box(134,88,11,2,'#be6243');box(138,90,3,1,'#e6c081');
    box(337,87,17,5,'#6f513a');box(338,91,2,5,'#574836');box(351,91,2,5,'#574836');
    box(338,80,13,8,'#344649');box(339,81,11,2,'#91a19a');box(339,84,6,2,'#273f46');
    box(347,84,2,2,s.radioFixed?'#b7df87':'#a37354');line([[348,80],[351,72]],'#484f49',1);
    for(const [x,y] of [[191,163],[207,118],[221,181],[167,169]]){
      const dx=Math.floor((Math.sin(t*1.1+x)+1)*2);box(x+dx,y,4+dx,1,'rgba(199,231,217,.48)');
    }
    g.restore();
  }
  const sprite=['    ddddd    ','   dcccccdd  ','   ccbbccccc ','   daaaaad   ','   dabaaad   ','    aaaaa    ','   jjee jj   ','  ejjjejjje  ','  ajejjejja  ','  ajjjjjjja  ','   jgggggj   ','   hhhhhhh   ','   hhhlhhh   ','   hhh hhh   ','   hhh hhh   ','   ddd ddd   ','  dddd dddd  '];
  const palette={d:'#373c3d',c:'#d7cbb2',b:'#766b60',a:'#daaa78',j:'#a5553c',e:'#ebc785',g:'#5f4838',h:'#394c59',l:'#687d83'};
  function person(g,camera,s,t){
    g.save();g.translate(304-camera,107);g.fillStyle='rgba(39,44,42,.27)';g.beginPath();g.ellipse(0,0,6.5,1.6,0,0,Math.PI*2);g.fill();
    sprite.forEach((row,y)=>Array.from(row).forEach((k,x)=>{if(palette[k]){g.fillStyle=palette[k];g.fillRect(x-6,y-17,1,1);}}));
    if(!s.metHaeun){const lift=Math.sin(t*2)>.1?1:0;g.fillStyle='#ac6244';g.fillRect(-7,-11,3,3);g.fillStyle='#e6ba8c';g.fillRect(-8,-13-lift,2,4);}
    if(s.radioFixed&&!s.reply&&!s.northDelivered){g.fillStyle='#f4deb1';g.fillRect(3,-8,5,3);g.fillStyle='#a95540';g.fillRect(5,-7,1,1);}
    g.restore();
  }
  window.NorthDock={scene,bounds,labels,paint,person,enter(s){lowered=Number(s.bridgeDown);},
    tick(dt,down,reduced){if(down)lowered=reduced?1:Math.min(1,lowered+dt*1.45);},crossable(){return lowered>=1;}};
})();
