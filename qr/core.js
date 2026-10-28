(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.QRTool=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function normalizeURL(value){
    let raw=String(value).trim();
    if(!raw)throw new Error('참고 자료 주소를 입력해 주세요.');
    if(/[\s\u0000-\u001f\u007f]/u.test(raw))throw new Error('주소 중간의 공백이나 줄바꿈을 지워 주세요.');
    if(raw.startsWith('//'))raw='https:'+raw;
    else if(!/^[a-z][a-z0-9+.-]*:/i.test(raw))raw='https://'+raw;
    let url;try{url=new URL(raw);}catch{throw new Error('올바른 웹 주소를 입력해 주세요. 예: https://kjelab.kr');}
    if(!['https:','http:'].includes(url.protocol)||!url.hostname.includes('.'))throw new Error('http:// 또는 https:// 웹페이지 주소를 입력해 주세요.');
    if(url.username||url.password)throw new Error('로그인 정보가 포함되지 않은 공유 주소를 입력해 주세요.');
    if(new TextEncoder().encode(url.href).length>2000)throw new Error('주소가 너무 깁니다. 자료의 짧은 공유 링크를 사용해 주세요.');
    return url.href;
  }
  function matrixFor(url,qrFactory){const qr=qrFactory(0,'M');qr.addData(url,'Byte');qr.make();const n=qr.getModuleCount();return Array.from({length:n},(_,r)=>Array.from({length:n},(_,c)=>qr.isDark(r,c)));}
  function svgFor(matrix){const n=matrix.length,side=n+8;let path='';matrix.forEach((row,r)=>row.forEach((dark,c)=>{if(dark)path+=`M${c+4} ${r+4}h1v1h-1z`;}));return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}" width="${side*12}" height="${side*12}" shape-rendering="crispEdges"><rect width="${side}" height="${side}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;}
  function drawCanvas(canvas,matrix,size=1024){canvas.width=canvas.height=size;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('이미지 저장을 지원하지 않는 브라우저입니다. SVG 저장을 이용해 주세요.');const cell=Math.floor(size/(matrix.length+8)),pad=Math.floor((size-matrix.length*cell)/2);ctx.fillStyle='#fff';ctx.fillRect(0,0,size,size);ctx.fillStyle='#000';matrix.forEach((row,r)=>row.forEach((dark,c)=>{if(dark)ctx.fillRect(pad+c*cell,pad+r*cell,cell,cell);}));}
  function filename(title){return (String(title||'참고자료').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'').trim().slice(0,60)||'참고자료')+'-QR';}
  return {normalizeURL,matrixFor,svgFor,drawCanvas,filename};
});
