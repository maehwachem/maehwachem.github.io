// 화학자의 섬 v2 · 마지막 우편선 — 손 실험대 (lab.js)
(function () {
  'use strict';
  function has(v, id) { return !!(v && v.choices && v.choices.some(function (c) { return c.id === id; })); }
  function el(t, css, txt) { var e = document.createElement(t); if (css) e.style.cssText = css; if (txt != null) e.textContent = txt; return e; }
  function px(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
  function cvs(w, h, k) {
    var c = el('canvas', 'display:block;margin:0 auto;width:' + w * k + 'px;height:' + h * k + 'px;image-rendering:pixelated');
    c.width = w; c.height = h; var g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g];
  }
  var BOX = 'position:relative;width:288px;margin:8px auto;font:13px/1.4 sans-serif;color:#eef;user-select:none;touch-action:none';
  var BTN = 'font:12px sans-serif;padding:4px 8px;margin:2px;border:2px solid #9ab;background:#123;color:#eef;border-radius:2px;cursor:pointer';

  const sites=[
    {id:'z_high', name:'물 위 금속 고리', x:330,y:42, side:'right', top:12},
    {id:'z_rope', name:'섬유 밧줄 끝', x:146,y:259, side:'left', top:55},
    {id:'z_bolt', name:'물속 강철 연결쇠', x:300,y:247, side:'right', top:67}
  ];
  function drawRig(canvas,chosen){
    const W=600,H=386;
    canvas.width=W*2;canvas.height=H*2;
    const g=canvas.getContext('2d');g.scale(2,2);
    const gradient=(y1,y2,a,b)=>{const f=g.createLinearGradient(0,y1,0,y2);f.addColorStop(0,a);f.addColorStop(1,b);return f;};
    function shape(coords,fill,stroke,weight=2){
      g.beginPath();coords.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));
      if(fill){g.closePath();g.fillStyle=fill;g.fill();}
      if(stroke){g.strokeStyle=stroke;g.lineJoin='round';g.lineCap='round';g.lineWidth=weight;g.stroke();}
    }
    function oval(x,y,rx,ry,fill,stroke,weight=2){
      g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);
      if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=weight;g.stroke();}
    }
    function steel(path){
      shape(path,null,'#183e4a',9);shape(path,null,'#a7b9b9',5);shape(path,null,'#dae0ce',1.3);
    }
    g.fillStyle=gradient(0,114,'#b6deea','#f8e9cb');g.fillRect(0,0,W,114);
    g.fillStyle=gradient(113,H,'#337d87','#153f53');g.fillRect(0,113,W,H-113);
    // A continuous metal fitting through the buoy connects the dry lifting eye and the submerged chain.
    shape([[294,94],[293,56],[312,56],[318,46]],null,'#374f53',10);
    oval(330,42,13,12,null,'#334d51',7);oval(330,42,13,12,null,'#bcc7b9',3);
    shape([[271,104],[280,67],[302,66],[314,104]],'#ba4937','#753e36');
    shape([[278,83],[281,74],[303,74],[305,82]],'#f5ddac');
    shape([[247,101],[266,92],[313,92],[339,102],[336,123],[318,139],[268,139],[248,123]],'#cb513b','#723c31',3);
    shape([[249,107],[337,107],[335,116],[249,116]],'#f2d6a2');
    shape([[269,139],[318,139],[309,148],[281,148]],'#713d34');
    oval(289,147,6,6,null,'#c5cdba',4);
    // A real fibre line, separate from the metal mooring, ends freely in the water.
    const rope=[[248,111],[237,135],[217,159],[205,179],[190,196],[180,215],[161,234],[146,259]];
    shape(rope,null,'#654936',7);shape(rope,null,'#d7ad66',4);
    g.setLineDash([2,6]);shape(rope,null,'#f7d79b',2);g.setLineDash([]);
    oval(147,255,5,4,'#ca9856','#7f603e');shape([[146,258],[140,268]],null,'#d1ae73',2);shape([[146,258],[146,268]],null,'#dfbc83',2);
    function link(x,y,edge){
      oval(x,y,edge?2.7:6,10,null,'#173947',6);
      oval(x,y,edge?2.7:6,10,null,edge?'#839d9d':'#bcc9c0',3.5);
    }
    for(let i=0;i<7;i++)link(289+i*1.55,156+i*12,i%2);
    // The shackle pin passes through the last upper link; the lower link encircles its bow.
    steel([[287,235],[287,249],[290,256],[296,260],[304,260],[311,255],[313,249],[313,235]]);
    steel([[283,234],[317,234]]);
    for(let i=0;i<7;i++)link(300+i*2,266+i*12,i%2);
    shape([[0,379],[85,374],[162,379],[249,367],[347,371],[477,365],[600,373],[600,386],[0,386]],'#9a9b81');
    shape([[290,355],[318,347],[340,354],[344,371],[286,371]],'#777e71','#485f5f');
    oval(313,350,5,7,null,'#b4bcb0',3);
    const waves=[];for(let x=0;x<=600;x+=5)waves.push([x,114+Math.sin(x/19)*1.8]);
    shape(waves,null,'#dcf2e8',3);
    const guides=[
      [[345,42],[365,42],[385,45]],
      [[143,257],[129,234],[99,226]],
      [[315,245],[345,258],[384,258]]
    ];
    guides.forEach((p,i)=>shape(p,null,i===0?'#46646a':'#cce3d9',1.7));
    g.font='bold 21px sans-serif';g.textAlign='left';g.fillStyle='#325764';g.fillText('수면',14,104);
    g.fillStyle='#dbebe3';g.fillText('바닷물',14,148);
    g.font='bold 19px sans-serif';g.fillText('강철 사슬',389,180);
    shape([[379,174],[346,174],[301,183]],null,'#c1dccf',1.5);
    if(chosen){
      const site=sites.find(p=>p.id===chosen);
      const x=site.x+9,y=site.y+1;
      shape([[x-8,y-7],[x+21,y-7],[x+21,y+8],[x-8,y+8]],'#d1d8cc','#3c535b',2.5);
      if(chosen==='z_rope'){shape([[x-5,y-6],[x-5,y+6]],null,'#b38d52',4);}
      else oval(x-2,y,3,3,'#70818b','#4a616c',1.5);
      g.fillStyle='#3b5059';g.font='bold 10px sans-serif';g.fillText('Zn',x+4,y+4);
    }
  }
  function rig(container,view,choose){
    const active=view.kind==='rig';
    const chosen=active?null:'z_'+view.kind.slice(4);
    const stage=document.createElement('div');stage.className='rig-scene';
    const canvas=document.createElement('canvas');canvas.setAttribute('role','img');
    canvas.setAttribute('aria-label','부표 단면. 수면 위 금속 고리는 사슬에 전기가 통하는 금속 부품이다. 물속 왼쪽에는 섬유 밧줄 끝이, 가운데에는 강철 사슬의 위아래 고리를 잇는 U자형 강철 연결쇠가 있다.'+(chosen?' 아연판을 단 곳은 '+sites.find(t=>t.id===chosen).name+'이다.':''));
    stage.append(canvas);drawRig(canvas,chosen);
    const strip=document.createElement('div');strip.className='rig-tray';
    const chip=document.createElement('button');chip.type='button';chip.className='zinc-tool';chip.textContent='아연판';
    const help=document.createElement('span');help.setAttribute('role','status');help.textContent='달고 싶은 부품을 누르거나, 아연판을 그곳으로 끌어 놓으세요.';
    if(active){strip.append(chip,help);container.append(strip);}
    container.append(stage);
    for(const site of sites){
      const label=document.createElement(active?'button':'span');label.textContent=site.name;
      label.style.top=site.top+'%';label.className='rig-label '+site.side+(chosen===site.id?' attached':'');
      label.dataset.spotId=site.id;
      if(active){label.type='button';label.onclick=()=>choose(site.id);}
      stage.append(label);
    }
    if(!active)return;
    function hit(x,y){
      const label=document.elementFromPoint(x,y)?.closest('.rig-label');
      if(label&&stage.contains(label))return label.dataset.spotId;
      const r=canvas.getBoundingClientRect();
      if(x<r.left||x>r.right||y<r.top||y>r.bottom)return null;
      return sites.find(p=>Math.hypot(x-r.left-p.x*r.width/600,y-r.top-p.y*r.height/386)<Math.max(22,r.width*.06))?.id;
    }
    function place(x,y){const id=hit(x,y);if(id)choose(id);else help.textContent='금속 고리, 밧줄 끝, 강철 연결쇠 중 한 곳을 골라 보세요.';}
    canvas.onclick=e=>place(e.clientX,e.clientY);
    chip.onclick=e=>{if(e.detail===0)stage.querySelector('button').focus();};
    let drag=null, ghost=null;
    function clear(){ghost?.remove();drag=ghost=null;}
    chip.onpointerdown=e=>{if(e.button!==0)return;drag={x:e.clientX,y:e.clientY};chip.setPointerCapture(e.pointerId);};
    chip.onpointermove=e=>{
      if(!drag)return;
      if(!ghost&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>4){
        ghost=document.createElement('span');ghost.className='zinc-ghost';ghost.textContent='Zn';container.append(ghost);
      }
      if(ghost){ghost.style.left=e.clientX+'px';ghost.style.top=e.clientY+'px';}
    };
    chip.onpointerup=e=>{const moved=!!ghost;clear();if(moved)place(e.clientX,e.clientY);};
    chip.onpointercancel=chip.onlostpointercapture=clear;
  }

  // ② 거름종이: 비커 물 높이
  function chroma(box, view, choose) {
    var K = 4, a = cvs(48, 64, K), g = a[1], SP = 14, h = 0; box.appendChild(a[0]);
    a[0].setAttribute('role', 'img'); a[0].setAttribute('aria-label', '비커와 거름종이. 연필 기준선 위에 시료 점 넷.');
    var r = el('input', 'display:block;width:180px;margin:6px auto'); r.type = 'range'; r.min = 0; r.max = 30; r.value = 0;
    r.setAttribute('aria-label', '비커 물 높이');
    var out = el('div', 'text-align:center'), msg = el('div', 'text-align:center;min-height:18px'), btn = el('button', BTN, '전개 시작');
    function draw() {
      px(g, 0, 0, 48, 64, '#1b2633');
      px(g, 8, 14, 2, 48, '#cde'); px(g, 38, 14, 2, 48, '#cde'); px(g, 8, 60, 32, 2, '#cde');
      if (h) px(g, 10, 60 - h, 28, h, '#4f8fc4');
      px(g, 13, 2, 22, 58, '#f4efe2'); px(g, 12, 1, 24, 2, '#999');
      px(g, 13, 60 - SP, 22, 1, '#777');
      ['#7a4fb0', '#3a6fd8', '#8a4fa8', '#8a4fa8'].forEach(function (c, i) { px(g, 15 + i * 5, 59 - SP, 3, 2, c); });
      if (h) { g.globalAlpha = 0.5; px(g, 13, 60 - h, 22, h, '#5aa0d8'); g.globalAlpha = 1; }
      out.textContent = '물 높이 ' + h + '칸 · 점 높이 ' + SP + '칸';
    }
    r.addEventListener('input', function () { h = +r.value; msg.textContent = ''; draw(); });
    btn.onclick = function () {
      if (!h) { msg.textContent = '물이 없다. 높이를 정하자.'; return; }
      var id = h < SP ? 'c_low' : 'c_high';
      if (has(view, id)) choose(id);
    };
    draw();
    var row = el('div', 'text-align:center'); row.appendChild(btn);
    [r, out, msg, row].forEach(function (n) { box.appendChild(n); });
  }

  // ③ 분리 결과: 네 띠
  function bands(box, view, choose) {
    var K = 3, a = cvs(80, 56, K), g = a[1];
    var B = '#3a6fd8', R = '#c83a3a', P = '#f07ab8';
    var S = [['등대곶', 'r_light', [[B, 26]]], ['모래섬', 'r_sand', [[R, 38], [B, 26]]],
      ['북암', 'r_north', [[B, 38], [P, 10]]], ['압지 시료', null, [[B, 38], [P, 10]]]];
    px(g, 0, 0, 80, 56, '#1b2633');
    S.forEach(function (s, i) {
      var x = 3 + i * 19 + (i === 3 ? 2 : 0);
      px(g, x, 2, 12, 50, '#f4efe2'); px(g, x, 6, 12, 1, '#cfd8e0'); px(g, x, 46, 12, 1, '#888');
      s[2].forEach(function (b) { px(g, x + 2, b[1], 8, 3, b[0]); });
    });
    a[0].setAttribute('role', 'img');
    a[0].setAttribute('aria-label', '등대곶 파랑 하나. 모래섬 아래 빨강 위 파랑. 북암 아래 파랑 멀리 위 분홍. 압지 시료 아래 파랑 멀리 위 분홍.');
    box.appendChild(a[0]);
    var row = el('div', 'display:flex;justify-content:center;width:240px;margin:4px auto 0');
    S.forEach(function (s) {
      var cell = el('div', 'width:60px;text-align:center;font-size:12px');
      cell.appendChild(el('div', s[1] ? '' : 'color:#ffd27a', s[0]));
      if (s[1] && has(view, s[1])) { var b = el('button', BTN, '같다'); b.setAttribute('aria-label', s[0] + ' 띠와 같다'); b.onclick = function () { choose(s[1]); }; cell.appendChild(b); }
      row.appendChild(cell);
    });
    box.appendChild(row);
  }

  function mount(container, s, view, choose) {
    container.innerHTML = '';
    if (!view) return false;
    var f = has(view, 'c_low') ? chroma : has(view, 'r_north') ? bands : null;
    if (!f) return false;
    var box = el('div', BOX); container.appendChild(box);
    f(box, view, choose);
    return true;
  }

  window.VoyageLab = { mount: mount, rig: rig };
})();