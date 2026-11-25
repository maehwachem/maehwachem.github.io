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
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  function animate(g,ms,paint,finish){
    let start;
    function frame(t){
      if(!g.canvas.isConnected||!g.canvas.closest('dialog')?.open)return;
      start??=t;
      const p=reduced()?1:Math.min(1,(t-start)/ms);
      paint(p);
      if(p<1)requestAnimationFrame(frame);else finish?.();
    }
    requestAnimationFrame(frame);
  }
  function tray(g,right,p,observed){
    rect(g,0,0,144,88,'#31484a');
    oval(g,71,58,47,17,'#ab9c7c');oval(g,71,54,47,17,'#ede1bd');oval(g,71,54,40,12,'#c8bda0','#b4a486');
    shape(g,[[42,57],[52,50],[60,51],[68,46],[76,46],[94,53],[103,58],[73,63]],'#e6e0ca');
    for(let i=0;i<24;i++)rect(g,56+(i*19)%31,53+(i*11)%7,1.4,1.2,'#c2bba6');
    shape(g,[[105,7],[111,12],[84,33],[78,35],[80,29]],'#b2ccca','#709a9c');
    shape(g,[[106,3],[113,9],[110,15],[103,9]],'#c17b53');
    if(p!==null&&p<.34){
      const v=p/.34,y=35+16*v*v;
      shape(g,[[79,y-4],[76.5,y],[77,y+1.5],[81,y+1.5],[81.5,y]],'#b7ebf5','#669ea6',.7);
    }
    const wet=observed?1:p===null?0:Math.min(1,Math.max(0,(p-.34)/.23));
    if(!wet)return;
    oval(g,76,55,19*wet,4*wet,'#829f9bce');oval(g,77,54,11*wet,2*wet,'#b0cdbe');rect(g,73,53,5*wet,1,'#e6ede0');
    if(!right||(p!==null&&p<.51))return;
    for(let i=0;i<8;i++){
      const stage=p===null?(i+1)/10:((p-.51)*2.25-i*.095);
      if(stage<0||stage>.98)continue;
      const x=64+(i*13%27),y=54-stage*(9+i%4*2),r=1.2+stage*1.6;
      if(stage<.84){oval(g,x,y,r,r,'#ccded4','#6e8d87');rect(g,x-.7,y-1,.9,.8,'#f8f1d8');}
      else{g.strokeStyle='#c5dcd4';g.beginPath();g.arc(x,y,r+1,0,1.8);g.stroke();}
    }
  }
  function assay(parent,s,select){
    const trays=make('div',null,'assay-trays');parent.append(trays);
    let busy=false;
    for(const [side,id,observed] of [['왼쪽','west_left',s.leftWet],['오른쪽','west_right',s.rightWet]]){
      const right=id==='west_right',cell=make('div',null,'assay-cell');trays.append(cell);
      const g=surface(cell,144,88,side+' 표지석 가루와 유리 스포이트');
      const readout=make('p',observed?(right?'젖은 가루에서 작은 기포가 올라왔다.':'가루가 젖었다. 눈에 띄는 기포가 없다.'):'마른 가루');
      readout.setAttribute('role','status');tray(g,right,null,observed);
      const b=btn(side+' 가루에 식초 한 방울',()=>{
        if(busy)return;busy=true;
        for(const other of trays.querySelectorAll('button'))other.disabled=true;
        readout.textContent='식초 한 방울을 떨어뜨린다.';
        animate(g,1250,p=>tray(g,right,p,false),()=>{
          select(id);
          const next=parent.querySelector('[data-trial="'+id+'"]');next?.focus({preventScroll:true});
        });
      });
      b.dataset.trial=id;b.setAttribute('aria-label',side+' 가루에 식초 떨어뜨리기');cell.append(b,readout);
    }
    if(s.leftWet&&s.rightWet)parent.append(make('p','측량도에 적힌 두 표지석은 석영과 방해석이다. 방해석의 탄산칼슘은 식초의 아세트산과 반응해 이산화 탄소 기포를 만든다.','lab-note'));
  }
  function turnout(parent,s,select){
    let toRight=false;
    const g=surface(parent,320,124,'아래쪽 수레에서 한 선로가 분기점으로 올라간다. 왼쪽은 보관선, 오른쪽은 서안 인도대.');
    const lever=btn('선로 바꾸기',()=>{toRight=!toRight;draw();});
    const release=btn('감개 돌리기',()=>select(toRight?'west_send':'west_park'));
    const status=make('p');status.setAttribute('role','status');
    // Project the field points, keeping the signed directions and the common trunk.
    const project=([x,y])=>[24+(x-119)*1.23,48+(y-127)*3.0];
    function draw(){
      rect(g,0,0,320,124,'#2d4448');
      const [home,junction,store]=WestField.routes.toStore.map(project),dock=project(WestField.routes.toDock[2]);
      for(const [u,v,lit] of [[home,junction,true],[junction,store,!toRight],[junction,dock,toRight]]){
        const dx=v[0]-u[0],dy=v[1]-u[1],len=Math.hypot(dx,dy),nx=-dy/len,ny=dx/len;
        for(let d=0;d<len;d+=10){const x=u[0]+dx*d/len,y=u[1]+dy*d/len;shape(g,[[x-5*nx,y-5*ny],[x+5*nx,y+5*ny]],null,'#92734e',3);}
        for(const o of [-3,3])shape(g,[[u[0]+o*nx,u[1]+o*ny],[v[0]+o*nx,v[1]+o*ny]],null,lit?'#e5c58e':'#849795',2);
      }
      const [jx,jy]=junction;shape(g,[[jx+8,jy+8],[jx+(toRight?16:1),jy+3]],null,'#dda363',3);
      oval(g,jx+(toRight?16:1),jy+3,2.5,2.5,'#f7ce8a');
      const [x,y]=home;rect(g,x-10,y-8,20,8,'#b58e61');rect(g,x-6,y,3,3,'#142e33');rect(g,x+5,y,3,3,'#142e33');
      words(g,'보관선',40,27,14,'#eddfbb');words(g,'서안 인도대',270,27,14,'#eddfbb');
      status.textContent='현재 선로 · '+(toRight?'오른쪽 인도대':'왼쪽 보관선');lever.setAttribute('aria-pressed',String(toRight));
    }
    parent.append(status,lever,release);draw();
  }
  function postcard(parent){
    const paper=make('figure',null,'west-card');const stamp=make('span','北岩 · 서안 우편','postmark');
    paper.append(stamp,make('figcaption','아버지께'),make('p','글자가 둘로 보이는 돌, 아버지 서랍에 두세요. 식초엔 넣지 마시고요.'),make('p','준 올림','signed'));parent.append(paper);
  }
  function optics(parent,s,select,ending=false){
    const g=surface(parent,320,164,'엽서의 아버지께 글씨를 덮는 투명 방해석. 결정 안에서만 글씨가 겹쳐 보인다.');
    const range=make('input');range.type='range';range.min='0';range.max='180';range.step='5';range.value='20';range.setAttribute('aria-label','방해석 돌리기');let on=true;
    const status=make('p');status.setAttribute('role','status');
    const place=btn('결정 들어 보기',()=>{on=!on;place.textContent=on?'결정 들어 보기':'글씨 위에 놓기';draw(1);});
    function draw(p){
      rect(g,0,0,320,164,'#a98a67');rect(g,8,8,304,148,'#f0e1bf');
      for(let i=0;i<4;i++)rect(g,26,54+22*i,264,1,'#d8c6a2');
      words(g,'서안 우편',265,32,11,'#70857b');words(g,'아버지께',154,94,28,'#4b4d43');
      if(on){
        const a=Number(range.value)*Math.PI/180,co=Math.cos(a),si=Math.sin(a),dx=7*co,dy=7*si;
        const cx=154+(1-p)*182,cy=82-(1-p)*33;
        const corners=[[-60,-21],[42,-29],[60,19],[-42,27]].map(([x,y])=>[cx+x*co-y*si,cy+x*si+y*co]);
        shape(g,corners.map(([x,y])=>[x+1,y+4]),'#9cad9bba','#788e7a');
        shape(g,corners,'#b2d6c49c','#739481',1.5);g.save();g.clip();
        words(g,'아버지께',154,94,28,'#4b4d43');words(g,'아버지께',154+dx,94+dy,28,'#606b53bf');g.restore();
        shape(g,corners.slice(0,3),null,'#e3ecce',1.2);
      }
      range.setAttribute('aria-valuetext',range.value+'도');range.disabled=!on;
      if(!ending)status.textContent=on?'결정 아래서 글씨가 두 겹으로 보인다.':'종이 위에는 글씨가 한 줄이다.';
    }
    if(ending){
      parent.append(status);status.textContent='어르신이 돌을 꺼내 ‘아버지께’ 위에 가만히 얹는다.';draw(0);
      animate(g,1100,p=>draw(p*p*(3-2*p)),()=>{status.textContent='“여기 있다, 준아.”';});
    }else{range.oninput=()=>draw(1);parent.append(place,range,status);draw(1);}
  }
  window.WestLab={mount(parent,s,view,select){
    const draw={'west-assay':assay,'west-switch':turnout,'west-postcard':postcard,'west-optics':optics,'west-ending':(p,s,select)=>optics(p,s,select,true)}[view.kind];
    if(!draw)return false;parent.className='north-lab west-lab';parent.hidden=false;draw(parent,s,select);return true;
  }};
})();
