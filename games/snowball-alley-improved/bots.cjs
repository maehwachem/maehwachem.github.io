'use strict';
const STEP=.5, NX=42, NZ=86, LEFT=-10.5, BACK=-21.5, CELLS=NX*NZ;
const DELTAS=[[0,1],[-1,0],[1,0],[0,-1],[-1,1],[1,1],[-1,-1],[1,-1]];
const position=index=>({x:LEFT+(index%NX+.5)*STEP,z:BACK+(Math.floor(index/NX)+.5)*STEP});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function createBotController({obstacles,piles,targets,limits}) {
  const passable=point=>!obstacles.some(o=>{
    const dx=Math.max(0,o.minX-point.x,point.x-o.maxX),dz=Math.max(0,o.minZ-point.z,point.z-o.maxZ);
    return Math.hypot(dx,dz)<.46;
  });
  const open=Array.from({length:CELLS},(_,index)=>passable(position(index)));

  function nearest(point) {
    const x=Math.max(0,Math.min(NX-1,Math.floor((point.x-LEFT)/STEP)));
    const z=Math.max(0,Math.min(NZ-1,Math.floor((point.z-BACK)/STEP)));
    const index=z*NX+x;
    if(open[index]) return index;
    let closest=-1,min=Infinity;
    for(let dz=-3;dz<=3;dz++) for(let dx=-3;dx<=3;dx++) {
      const a=x+dx,b=z+dz;
      if(a<0||a>=NX||b<0||b>=NZ||!open[b*NX+a])continue;
      const d=distance(point,position(b*NX+a));
      if(d<min){closest=b*NX+a;min=d;}
    }
    return closest;
  }

  function route(from,to) {
    const start=nearest(from), end=nearest(to);
    if(start<0||end<0)return [];
    const parent=new Int16Array(CELLS).fill(-1), queue=[start];
    parent[start]=start;
    for(let i=0;i<queue.length;i++) {
      const cell=queue[i];
      if(cell===end)break;
      const x=cell%NX,z=Math.floor(cell/NX);
      for(const [dx,dz] of DELTAS){
        const a=x+dx,b=z+dz,n=b*NX+a;
        if(a<0||a>=NX||b<0||b>=NZ||!open[n]||parent[n]>=0)continue;
        if(dx&&dz&&(!open[z*NX+a]||!open[b*NX+x]))continue;
        parent[n]=cell;queue.push(n);
      }
    }
    if(parent[end]<0)return [];
    const path=[];
    for(let cell=end;cell!==start;cell=parent[cell])path.push(position(cell));
    path.reverse();
    if(passable(to))path.push(to);
    return path;
  }

  function trajectory(from,target) {
    const range=distance(from,target);
    if(range<.65)return null;
    const yaw=Math.atan2(from.x-target.x,from.z-target.z)+Math.asin(.3/range);
    const sin=Math.sin(yaw),cos=Math.cos(yaw);
    const x=from.x+.3*(cos-sin),z=from.z-.3*(sin+cos);
    const d=Math.hypot(target.x-x,target.z-z),v2=225,dy=1.02-1.55;
    const disc=v2*v2-9.8*(9.8*d*d+2*dy*v2);
    if(disc<0)return null;
    for(const sign of [-1,1]){
      const pitch=Math.atan((v2+sign*Math.sqrt(disc))/(9.8*d));
      if(pitch<-.12||pitch>1.25)continue;
      const horizontal=15*Math.cos(pitch),vertical=15*Math.sin(pitch);
      const duration=d/horizontal;
      let blocked=false;
      for(let t=.02;t<duration;t+=.02){
        const a=x-sin*horizontal*t,b=z-cos*horizontal*t,y=1.55+vertical*t-4.9*t*t;
        if(y<.12 || obstacles.some(o=>y<o.h+.12&&a>o.minX-.12&&a<o.maxX+.12&&b>o.minZ-.12&&b<o.maxZ+.12)){
          blocked=true;break;
        }
      }
      if(!blocked)return {yaw,pitch};
    }
    return null;
  }

  // The two bots prefer opposite lanes and use only real shots to their current map's target.
  const firingSpots=[-1,1].map(side=>{
    const points=[];
    for(let x=1.25;x<=limits[0]-.6;x+=1.25){
      for(let z=-limits[1]+.75;z<=limits[1]-.75;z+=1.25){
        const point={x:side*x,z}, range=distance(point,targets.blue);
        if(range>=6 && range<=17 && passable(point) && trajectory(point,targets.blue)) points.push(point);
      }
    }
    return points.sort((a,b)=>Math.abs(distance(a,targets.blue)-11)-Math.abs(distance(b,targets.blue)-11)).slice(0,12);
  });

  function reloadPoint(bot) {
    const candidates=piles.flatMap(p=>[[-1.3,0],[1.3,0],[0,-1.3],[0,1.3]].map(([x,z])=>({x:p.x+x,z:p.z+z})));
    return candidates.filter(p=>passable(p) && (!bot.blockedReload || distance(p,bot.blockedReload)>.1))
      .sort((a,b)=>distance(a,bot)-distance(b,bot))[0];
  }

  function controlBot(bot,now,nearPile) {
    bot.input={mx:0,my:0,gather:false,crouch:false};
    if(bot.stun)return;
    if(bot.ammo===0&&!bot.refilling){bot.refilling=true;bot.route=null;}
    if(bot.refilling&&bot.ammo===3){bot.refilling=false;bot.route=null;bot.blockedReload=null;bot.station++;}
    if(bot.refilling&&nearPile(bot)){bot.input.gather=true;return;}

    if(!bot.route){
      const spots=firingSpots[bot.botIndex].length?firingSpots[bot.botIndex]:firingSpots.flat();
      const goal=bot.refilling?reloadPoint(bot):spots[bot.station%spots.length];
      if(!goal)return;
      bot.goal=goal;
      bot.route=route(bot,goal);
      bot.waypoint=null;
      bot.nextShotAt=0;
    }
    while(bot.route.length&&distance(bot,bot.route[0])<.23)bot.route.shift();
    if(!bot.refilling && bot.route.length && distance(bot,bot.goal)<.95 && trajectory(bot,targets.blue)) bot.route.length=0;
    if(bot.route.length){
      const target=bot.route[0], remaining=distance(bot,target);
      if(bot.waypoint!==target || remaining<bot.waypointDistance-.04){
        bot.waypoint=target;bot.waypointDistance=remaining;bot.lastProgressAt=now;
      }
      if(now-bot.lastProgressAt>=1500){
        if(bot.refilling) bot.blockedReload=bot.goal;
        else bot.station++;
        bot.route=null;
        return;
      }
      bot.yaw=Math.atan2(bot.x-target.x,bot.z-target.z);
      bot.input.my=Math.min(1,remaining*4);
      return;
    }
    if(bot.refilling){bot.route=null;return;}
    const shot=trajectory(bot,targets.blue);
    if(!shot){bot.station++;bot.route=null;return;}
    bot.yaw=shot.yaw;bot.pitch=shot.pitch;
    if(!bot.nextShotAt)bot.nextShotAt=now+850+bot.botIndex*650;
    if(now>=bot.nextShotAt){
      bot.shotUntil=now+200;
      bot.nextShotAt=now+2050+bot.botIndex*350;
    }
  }

  return controlBot;
}

module.exports={createBotController};
