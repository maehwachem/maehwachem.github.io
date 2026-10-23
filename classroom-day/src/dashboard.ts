// Publish each card as soon as it settles; an old/aborted load cannot replace a newer one.
export async function loadCards(kinds:readonly string[], load:(kind:string)=>Promise<any>, signal:AbortSignal, publish:(kind:string,value:any)=>void){
 await Promise.all(kinds.map(async kind=>{
  let value:any;
  try{value=await load(kind)}catch{value={error:'연결이 원활하지 않아요. 새로고침으로 다시 시도해 주세요.'}}
  if(!signal.aborted)publish(kind,value);
 }));
}
