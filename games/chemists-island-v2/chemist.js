/* Default white coat and four idle views from science-tools/chemists-island drawPlayer.
   Render each pose once at the original pixel grid, then use the same actor on the cover and in the field. */
(() => {
  'use strict';
  const width=18, height=19, rows=['down','up','right','left'];
  const sheet=document.createElement('canvas');sheet.width=width*9;sheet.height=height*4;
  const atlas=sheet.getContext('2d');
  const cell=document.createElement('canvas');cell.width=width;cell.height=height;
  const g=cell.getContext('2d',{willReadFrequently:true});
  const coat='#f3f3ed',hem='#d2d2c9',skin='#f1c27d',hair='#3b2a1a',lens='#86d6f2',strap='#3a8fb0';
  function rect(x,y,w,h,c){g.fillStyle=c;g.fillRect(x+1,y+1,w,h);}
  // Eight contact, recoil and passing poses. Frame zero in the sheet is the original idle.
  const stride=[2,1,0,-1,-2,-1,0,1], lift=[0,0,0,1,2,2,1,0];
  function paint(dir,frame){
    g.clearRect(0,0,width,height);
    const moving=frame>=0, side=dir==='left'||dir==='right', sign=dir==='left'?-1:1;
    const swing=moving?stride[frame]:0,arm=Math.sign(swing);
    const rise=moving&&(frame===2||frame===6)?-1:0;
    for(const leg of [0,1]){
      const phase=moving?(frame+leg*4)%8:0, advance=moving?stride[phase]:0;
      const x=side&&moving?7:leg?9:5;
      const shift=side?advance*sign:0,sole=16-(moving?lift[phase]:0);
      rect(x,13+rise,2,2,'#39405e');
      rect(x+Math.trunc(shift/2),14+rise,2,Math.max(1,sole-14-rise),'#39405e');
      rect(x+shift,sole-1,2,1,'#39405e');
    }
    g.save();g.translate(0,rise);
    rect(4,8,8,6,coat);rect(4,13,8,1,hem);rect(4,8,8,1,'rgba(255,255,255,.25)');
    if(!side){
      rect(3,8-arm,1,5,coat);rect(12,8+arm,1,5,coat);
      rect(3,12-arm,1,1,skin);rect(12,12+arm,1,1,skin);
    }else{
      const x=(dir==='left'?7:8)-sign*swing;
      rect(x,9,2,4,hem);rect(x,13,2,1,skin);
    }
    rect(4,2,8,6,skin);rect(4,7,8,1,'#d9a868');
    if(dir==='up'){
      rect(4,1,8,6,hair);rect(4,3,8,1,strap);
    }else{
      rect(4,1,8,2,hair);rect(5,1,3,1,'#5a4128');
      if(dir==='down'){
        rect(5,3,2,2,lens);rect(9,3,2,2,lens);
        rect(5,3,1,1,'#e6f7fd');rect(9,3,1,1,'#e6f7fd');
        rect(7,3,2,1,strap);rect(4,3,1,1,strap);rect(11,3,1,1,strap);
        rect(7,6,2,1,'#c4875a');rect(7,8,2,5,hem);rect(7,8,2,1,'#ef8a1f');
      }else{
        const left=dir==='left';
        rect(left?9:4,1,3,5,hair);rect(left?4:9,3,3,2,lens);
        rect(left?4:11,3,1,1,'#e6f7fd');rect(7,3,2,1,strap);rect(left?4:10,6,2,1,'#c4875a');
      }
    }
    g.restore();
    const pixels=g.getImageData(0,0,width,height),data=pixels.data,outline=[];
    function alpha(x,y){return x<0||y<0||x>=width||y>=height?0:data[(y*width+x)*4+3];}
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      if(!alpha(x,y)&&(alpha(x-1,y)||alpha(x+1,y)||alpha(x,y-1)||alpha(x,y+1)))outline.push((y*width+x)*4);
    }
    for(const i of outline)data.set([26,24,30,200],i);
    return pixels;
  }
  rows.forEach((dir,row)=>{
    for(let frame=-1;frame<8;frame++){
      atlas.putImageData(paint(dir,frame),(frame+1)*width,row*height);
    }
  });
  function draw(ctx,x,y,dir,frame=-1,scale=1.25){
    ctx.drawImage(sheet,(frame+1)*width,rows.indexOf(dir)*height,width,height,x-9*scale,y-17*scale,width*scale,height*scale);
  }
  window.IslandChemist={draw};
  const cover=document.getElementById('cover-hero'),cg=cover.getContext('2d');
  cg.imageSmoothingEnabled=false;draw(cg,116*4,182*4,'down',-1,5);
})();
