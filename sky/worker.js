/* All astronomy calculations run in a worker to keep touch controls responsive. */
importScripts('vendor/astronomy.browser.min.js','stars.js','core.js');
self.onmessage=function(event){
  const {id,type,args}=event.data;
  try {
    if(!['daily','calendar','nextEclipses','upcoming'].includes(type))throw Error('알 수 없는 계산 요청입니다.');
    self.postMessage({id,result:SkyCore[type](...args)});
  } catch(error){self.postMessage({id,error:String(error&&error.message||error)});}
};
