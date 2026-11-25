(() => {
  'use strict';
  function element(tag,text){const e=document.createElement(tag);if(text)e.textContent=text;return e;}
  function button(text,action){const b=element('button',text);b.type='button';b.onclick=action;return b;}
  function canvas(parent,label,w=320,h=132){
    const c=element('canvas');c.width=w*2;c.height=h*2;c.setAttribute('role','img');c.setAttribute('aria-label',label);parent.append(c);
    const g=c.getContext('2d');g.scale(2,2);return {c,g};
  }
  function path(g,points,color,width=2,closed=false){
    g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.strokeStyle=color;g.lineWidth=width;if(closed)g.closePath();g.stroke();
  }
  function words(g,label,x,y,color='#f3e9c9',size=13){g.textAlign='center';g.fillStyle=color;g.font='600 '+size+'px sans-serif';g.fillText(label,x,y);}
  function box(g,x,y,w,h,c){g.fillStyle=c;g.fillRect(x,y,w,h);}
  function ring(g,x,y,rx,ry,c,w){g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.strokeStyle=c;g.lineWidth=w;g.stroke();}
  function pin(g,x,y){box(g,x-12,y-3,22,5,'#a6bbc0');box(g,x-12,y-5,5,9,'#d2dcd4');box(g,x+6,y-2,2,4,'#536c70');}
  function well(parent,select){
    const {g,c}=canvas(parent,'점검홈 단면. 왼쪽 황동 고리, 가운데 나무 조각, 오른쪽 회색 핀.');
    const range=element('input');range.type='range';range.min='24';range.max='296';range.value='128';range.setAttribute('aria-label','자석줄 위치');
    const readout=element('p'),msg=element('p','줄을 밀거나 그림을 눌러 자석을 옮기세요.');msg.setAttribute('role','status');
    let caught=false,depth=0;
    const objects=[{x:67,name:'황동 고리'},{x:160,name:'나무 조각'},{x:253,name:'회색 핀'}];
    function target(){return objects.find(ob=>Math.abs(ob.x-Number(range.value))<=21);}
    function draw(){
      const x=Number(range.value),tipY=34+depth;
      box(g,0,0,320,132,'#253d46');box(g,10,12,300,94,'#344e53');box(g,15,25,290,73,'#213d45');
      box(g,15,14,290,4,'#8b7760');box(g,10,94,300,12,'#5f706a');box(g,10,95,300,3,'#9b9a83');
      for(let i=0;i<13;i++){box(g,20+i*23,100,6+i%5,1,'#4a635e');}
      ring(g,67,89,12,5,'#806937',4);ring(g,67,87,12,4,'#d9af60',3);
      path(g,[[149,91],[171,85]],'#8f6343',7);path(g,[[149,89],[171,83]],'#c79866',2);
      if(!caught)pin(g,253,90);else pin(g,x,tipY+10);
      for(let y=0;y<tipY-6;y+=5){box(g,x-1,y,2,5,'#d4b477');box(g,x,y,1,2,'#886a48');}
      path(g,[[x-6,tipY+5],[x-6,tipY],[x-4,tipY-4],[x+4,tipY-4],[x+6,tipY],[x+6,tipY+5]],'#da7355',4);
      box(g,x-8,tipY+4,4,5,'#c6d4d3');box(g,x+4,tipY+4,4,5,'#c6d4d3');
      objects.forEach(ob=>words(g,ob.name,ob.x,123));
      const name=target()?.name;readout.textContent='자석 위치 · '+(name?name+' 위':'빈 홈 위');range.setAttribute('aria-valuetext',readout.textContent);
    }
    range.oninput=()=>{depth=0;msg.textContent='원하는 물건 위에서 줄을 내리세요.';draw();};
    c.style.cursor='crosshair';c.onpointerdown=e=>{
      if(caught)return;const r=c.getBoundingClientRect();range.value=String(Math.round((e.clientX-r.left)*320/r.width));range.oninput();
    };
    const lower=button('자석 내리기',()=>{
      if(caught){select('recover_pin');return;}
      const item=target();depth=46;
      if(item===objects[2]){
        caught=true;range.disabled=true;lower.textContent='줄 감아 올리기';msg.textContent='딸깍. 회색 핀이 자석 끝에 붙었다.';
      }else msg.textContent=item?item.name+'에 자석을 대 보았다. 붙지 않는다. 옆으로 옮겨 보자.':'자석 끝에 아무것도 닿지 않았다.';
      draw();
    });
    parent.append(range,readout,lower,msg);draw();
  }
  function splice(parent,select){
    const {g}=canvas(parent,'전지함에서 무전기로 가는 전원선 한 가닥의 끊어진 두 끝과 교체할 구리선.');
    const msg=element('p','전원을 끈 상태다. 작은 단자 두 곳에 여분의 선을 물릴 수 있다.');msg.setAttribute('role','status');let bare=false;
    function draw(){
      box(g,0,0,320,132,'#29434a');box(g,16,12,288,77,'#344e53');
      words(g,'전지함 쪽',50,33);words(g,'무전기 쪽',268,33);
      path(g,[[24,58],[99,58]],'#6ca5a5',7);path(g,[[218,58],[295,58]],'#6ca5a5',7);
      for(const x of [102,216]){box(g,x-6,51,13,14,'#bcc2b4');box(g,x-4,53,9,9,'#617778');box(g,x-3,56,7,2,'#e1d4b6');}
      words(g,'끊어진 부분',160,62,'#f1ca9d',12);
      const wire=[[94,95],[109,95],[124,104],[195,104],[211,95],[225,95]];
      path(g,wire,'#243b40',8);path(g,wire,'#87beb4',5);
      if(bare){path(g,[[94,95],[105,95]],'#e7a26d',4);path(g,[[214,95],[225,95]],'#e7a26d',4);}
      words(g,'여분의 피복 구리선',160,126,'#f3e9c9',11);
    }
    const strip=button('양 끝 피복 벗기기',()=>{bare=true;strip.disabled=true;msg.textContent='양 끝에 구리 심선이 드러났다. 이제 두 단자에 물릴 수 있다.';draw();});
    const join=button('단자에 잇고 전원 켜기',()=>{if(bare)select('fix_radio');else msg.textContent='표시등이 켜지지 않는다. 단자가 피복만 물고 있다. 전원을 다시 껐다.';});
    parent.append(strip,join,msg);draw();
  }
  function chart(parent){
    const {g}=canvas(parent,'북암 옛 측량도. 옛 선착장에서 광업소를 거쳐 서쪽 갱구로 이어지는 점선.',320,139);
    box(g,0,0,320,139,'#e7d4a8');box(g,6,6,308,127,'#edddb9');g.save();
    g.strokeStyle='#bad1bd';g.lineWidth=.7;for(let x=12;x<320;x+=16){path(g,[[x,6],[x,133]],'#bbbea1',.6);}
    for(let y=14;y<133;y+=16)path(g,[[6,y],[313,y]],'#bbbea1',.6);
    const shore=[[8,35],[31,44],[49,35],[68,43],[87,62],[64,74],[70,88],[103,94],[118,125],[130,133]];
    path(g,shore,'#608e88',3);path(g,shore.map(([x,y])=>[x-5,y+4]),'#8fae9d',1);
    words(g,'北岩',33,111,'#758f82',12);words(g,'북암 광업소 측량도',209,29,'#564e3e',17);
    g.setLineDash([4,4]);path(g,[[79,78],[108,75],[141,69],[173,83],[200,76],[232,87],[263,63]],'#9a6045',2);g.setLineDash([]);
    for(const [x,y,name] of [[79,78,'옛 선착장'],[173,83,'광업소'],[263,63,'서쪽 갱구']]){
      ring(g,x,y,4,4,'#795b48',2);words(g,name,x,y+20,'#564f40',12);
    }
    g.restore();
  }
  window.NorthLab={mount(parent,view,select){
    const render={'magnet-well':well,splice, survey:chart}[view.kind];if(!render)return false;
    parent.className='north-lab';parent.hidden=false;render(parent,select);return true;
  }};
})();
