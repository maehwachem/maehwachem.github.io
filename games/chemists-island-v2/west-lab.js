(() => {
  'use strict';
  const make=(tag,txt,cl)=>{const e=document.createElement(tag);if(txt)e.textContent=txt;if(cl)e.className=cl;return e;};
  function btn(txt,fn){const b=make('button',txt);b.type='button';b.onclick=fn;return b;}
  function surface(parent,w,h,alt){const c=make('canvas');c.width=w*2;c.height=h*2;c.setAttribute('aria-label',alt);c.setAttribute('role','img');parent.append(c);const g=c.getContext('2d');g.scale(2,2);return g;}
  function shape(g,points,fill,stroke,width=1){
    g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));if(fill){g.closePath();g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=width;g.stroke();}
  }
  function rect(g,x,y,w,h,c){g.fillStyle=c;g.fillRect(x,y,w,h);}
  function oval(g,x,y,rx,ry,c,edge){g.beginPath();g.ellipse(x,y,rx,ry,0,0,2*Math.PI);g.fillStyle=c;g.fill();if(edge){g.strokeStyle=edge;g.lineWidth=1.3;g.stroke();}}
  function words(g,text,x,y,size,c){g.font='600 '+size+'px sans-serif';g.textAlign='center';g.fillStyle=c;g.fillText(text,x,y);}
  function assay(parent,s,select){
    const trays=make('div',null,'assay-trays');parent.append(trays);
    for(const [side,id,wet] of [['왼쪽','west_left',s.leftWet],['오른쪽','west_right',s.rightWet]]){
      const cell=make('div',null,'assay-cell');trays.append(cell);
      const b=btn(side+' 가루에 식초 한 방울',()=>select(id));
      const g=surface(cell,144,88,side+' 표지석의 흰 가루 접시');rect(g,0,0,144,88,'#31484a');
      oval(g,71,58,47,17,'#ab9c7c');oval(g,71,54,47,17,'#ede1bd');oval(g,71,54,40,12,'#c8bda0','#b4a486');
      shape(g,[[42,57],[52,50],[60,51],[68,46],[76,46],[94,53],[103,58],[73,63]],'#e6e0ca');
      for(let i=0;i<24;i++)rect(g,56+(i*19)%31,53+(i*11)%7,1.4,1.2,'#c2bba6');
      shape(g,[[109,8],[114,13],[90,37],[85,39],[87,33]],'#b2ccca','#709a9c');
      shape(g,[[111,4],[117,10],[112,16],[106,10]],'#c17b53');
      if(wet){oval(g,74,55,17,4,'#aebfb18a');if(id==='west_right')for(let i=0;i<11;i++)oval(g,61+i*29%29,55-i*13%15,1.5+i%3*.4,1.6+i%3*.4,'#dce7d9','#8caaa3');}
      cell.append(b,make('p',wet?(id==='west_right'?'작은 기포가 올라온다.':'눈에 띄는 기포가 없다.'):'마른 가루'));b.setAttribute('aria-label',side+' 가루에 식초 떨어뜨리기');
    }
    if(s.leftWet&&s.rightWet)parent.append(make('p','두 표지에는 석영과 방해석을 하나씩 썼다. 방해석의 탄산칼슘은 식초와 반응해 이산화 탄소 기포를 만든다.','lab-note'));
  }
  function turnout(parent,s,select){
    let toRight=false;
    const g=surface(parent,320,124,'손수레가 선로 분기점에 서 있다. 왼쪽은 보관선, 오른쪽은 인도대.');
    const lever=btn('선로 바꾸기',()=>{toRight=!toRight;draw();});
    const release=btn('감개 돌리기',()=>select(toRight?'west_send':'west_park'));
    const status=make('p');status.setAttribute('role','status');
    function draw(){
      rect(g,0,0,320,124,'#2d4448');
      for(const side of [-1,1]){
        for(let j=0;j<9;j++){const t=j/9,x=160+side*105*t,y=72-40*t;shape(g,[[x-4,y-3],[x+4,y+4]],null,'#93734e',4);}
        for(const d of [-3,3])shape(g,[[160+d,88],[160+d,73],[160+side*109+d,31]],null,(side===1)===toRight?'#edd097':'#809396',2);
      }
      for(const d of [-3,3])shape(g,[[160+d,119],[160+d,79]],null,'#b9c4b4',2);
      shape(g,[[160,84],[160,73],[160+(toRight?1:-1)*24,64]],null,'#ec995c',4);
      rect(g,149,99,22,8,'#af8655');rect(g,150,98,20,3,'#c5ad76');rect(g,152,107,4,3,'#1e3138');rect(g,164,107,4,3,'#1e3138');
      words(g,'보관선',48,22,13,'#eddfbb');words(g,'서안 인도대',269,22,13,'#eddfbb');
      status.textContent='현재 선로 · '+(toRight?'오른쪽 인도대':'왼쪽 보관선');lever.setAttribute('aria-pressed',String(toRight));
    }
    parent.append(status,lever,release);draw();
  }
  function postcard(parent){
    const paper=make('figure',null,'west-card');const stamp=make('span','北岩 · 서안 우편','postmark');
    paper.append(stamp,make('figcaption','아버지께'),make('p','글자가 둘로 보이는 돌, 아버지 서랍에 두세요. 식초엔 넣지 마시고요.'),make('p','준 올림','signed'));parent.append(paper);
  }
  function optics(parent){
    const g=surface(parent,320,145,'투명 방해석 아래 엽서의 글씨와 각도를 바꾸면 움직이는 두 번째 상.');
    const range=make('input');range.type='range';range.min='0';range.max='180';range.step='5';range.value='30';range.setAttribute('aria-label','방해석 돌리기');let on=true;
    const place=btn('결정 들어 보기',()=>{on=!on;place.textContent=on?'결정 들어 보기':'글씨 위에 놓기';draw();});
    function draw(){
      rect(g,0,0,320,145,'#dec9a1');rect(g,10,11,300,123,'#f3e6c6');
      for(let i=0;i<3;i++)rect(g,27,58+22*i,261,1,'#dbcaac');
      words(g,'아버지께',157,85,31,'#4c5146');
      if(on){
        const a=Number(range.value)*Math.PI/180,dx=8*Math.cos(a),dy=8*Math.sin(a);
        const corners=[[73,56],[195,29],[249,81],[115,109]];
        shape(g,corners,'#a8d0c170','#90a995',1.5);g.save();g.clip();
        words(g,'아버지께',157+dx,85+dy,31,'#626951bd');g.restore();
        shape(g,[[73,56],[73,64],[115,117],[249,88],[249,81],[115,109]],'#9eb0a178','#7f9989',1);
      }
      range.disabled=!on;range.setAttribute('aria-valuetext',range.value+'도');status.textContent=on?'결정 아래서 글씨가 두 겹으로 보인다.':'종이 위에는 글씨가 한 줄이다.';
    }
    const status=make('p');status.setAttribute('role','status');range.oninput=draw;parent.append(place,range,status);draw();
  }
  window.WestLab={mount(parent,s,view,select){
    const draw={'west-assay':assay,'west-switch':turnout,'west-postcard':postcard,'west-optics':optics}[view.kind];
    if(!draw)return false;parent.className='north-lab west-lab';parent.hidden=false;draw(parent,s,select);return true;
  }};
})();
