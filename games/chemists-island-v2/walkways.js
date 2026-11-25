/* Foot-level boundaries traced on the 384 × 216 scene paintings. */
(() => {
  'use strict';
  const westHead=[[8,111],[34,104],[69,104],[104,101],[160,102],[174,96],[174,126]];
  const westTail=[[174,142],[171,153],[126,155],[61,155],[48,162],[28,167],[23,158],[8,155]];
  const east=[[238,126],[236,104],[275,98],[310,97],[335,96],[349,86],[363,87],[361,99],[378,101],[380,152],[351,156],[248,155],[238,142]];
  const outlines = {
    north:westHead.concat(westTail),
    northOpen:westHead.concat(east,westTail),
    harbor: [[22,147],[48,135],[61,137],[88,130],[104,123],[110,115],[156,120],[188,120],[226,117],[238,120],[278,105],[285,106],[285,109],[252,124],[282,128],[281,134],[160,135],[152,152],[141,166],[148,175],[145,194],[149,202],[199,205],[196,214],[61,214],[77,189],[77,174],[69,161],[27,157]],
    yard: [[18,157],[49,129],[107,122],[153,125],[216,127],[258,124],[299,122],[346,128],[368,160],[364,199],[325,210],[49,211],[19,195]],
    mine: [[70,194],[97,183],[108,177],[108,169],[152,174],[210,182],[257,185],[276,172],[289,157],[311,146],[319,141],[327,142],[326,147],[316,153],[308,169],[302,183],[308,193],[354,203],[376,212],[370,214],[193,214],[190,208],[176,203],[154,202],[140,204],[111,199],[92,201]],
    salt: [[12,166],[47,158],[82,152],[119,147],[154,142],[199,139],[234,135],[264,131],[290,126],[316,118],[323,110],[332,109],[339,114],[336,122],[371,124],[375,128],[315,137],[269,144],[223,153],[167,159],[115,171],[64,178],[14,186]]
  };
  const distance = (a,b) => Math.hypot(b[0]-a[0], b[1]-a[1]);
  const cross = (ax,ay,bx,by) => ax*by-ay*bx;
  function walkway(polygon) {
    const edges = polygon.map((p,i) => [p,polygon[(i+1)%polygon.length]]);
    function closest(p) {
      let best = null, gap = Infinity;
      for (const [a,b] of edges) {
        const dx=b[0]-a[0], dy=b[1]-a[1];
        const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));
        const q=[a[0]+t*dx,a[1]+t*dy], d=distance(p,q);
        if(d<gap){best=q;gap=d;}
      }
      return {point:best,gap};
    }
    function inside(p) {
      const [x,y]=p;
      let odd=false;
      for (const [[ax,ay],[bx,by]] of edges) {
        if (Math.abs(cross(bx-ax,by-ay,x-ax,y-ay))<0.00001 &&
            (x-ax)*(x-bx)+(y-ay)*(y-by)<=0.00001) return true;
        if ((ay>y)!==(by>y) && x<ax+(bx-ax)*(y-ay)/(by-ay)) odd=!odd;
      }
      return odd;
    }
    function clear(a,b) {
      const dx=b[0]-a[0],dy=b[1]-a[1], cuts=[0,1];
      for(const [u,v] of edges){
        const ex=v[0]-u[0],ey=v[1]-u[1],den=cross(dx,dy,ex,ey);
        if(Math.abs(den)<1e-9) continue;
        const ux=u[0]-a[0],uy=u[1]-a[1],t=cross(ux,uy,ex,ey)/den,k=cross(ux,uy,dx,dy)/den;
        if(t>0&&t<1&&k>=-1e-9&&k<=1+1e-9)cuts.push(t);
      }
      cuts.sort((a,b)=>a-b);
      for(let i=1;i<cuts.length;i++){
        const t=(cuts[i]+cuts[i-1])/2;
        if(cuts[i]-cuts[i-1]>1e-8&&!inside([a[0]+dx*t,a[1]+dy*t]))return false;
      }
      return true;
    }
    function floor(p,margin) {
      if(inside(p))return p;
      const hit=closest(p);
      return hit.gap<=margin?hit.point:null;
    }
    const links=polygon.map(()=>[]);
    for(let i=0;i<polygon.length;i++)for(let j=0;j<i;j++){
      if(clear(polygon[i],polygon[j])){links[i].push(j);links[j].push(i);}
    }
    function route(a,b) {
      if(clear(a,b))return [b];
      const points=polygon.concat([a,b]),start=points.length-2,end=start+1;
      const graph=links.map(list=>list.slice()).concat([[],[]]);
      for(let i=0;i<polygon.length;i++)for(const j of [start,end]){
        if(clear(points[i],points[j])){graph[i].push(j);graph[j].push(i);}
      }
      const cost=points.map(()=>Infinity),prev=points.map(()=>-1),done=new Set();
      cost[start]=0;
      while(true){
        let n=-1;
        for(let i=0;i<points.length;i++)if(!done.has(i)&&cost[i]<Infinity&&(n<0||cost[i]<cost[n]))n=i;
        if(n<0)return [];
        if(n===end)break;
        done.add(n);
        for(const j of graph[n]){
          const next=cost[n]+distance(points[n],points[j]);
          if(next<cost[j]){cost[j]=next;prev[j]=n;}
        }
      }
      const path=[];for(let n=end;n!==start;n=prev[n])path.unshift(points[n]);
      return path;
    }
    function slide(a,b) {
      const p=floor(b,Infinity);
      return clear(a,p)?p:a;
    }
    return {floor,route,slide};
  }
  window.Walkways=Object.fromEntries(Object.entries(outlines).map(([name,points])=>[name,walkway(points)]));
})();
