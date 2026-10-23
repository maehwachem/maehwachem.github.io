import {useEffect,useState} from 'react';
import {airCacheKey,readAirCache} from './air-cache';
type Requester=(kind:string,args:Record<string,string>,signal?:AbortSignal)=>Promise<any>;
export function useAirQuality(region:string,station:string,tick:number,active:boolean,request:Requester){
 const key=airCacheKey(region,station);
 const [state,setState]=useState<any>({key:'',rows:[],loading:false});
 useEffect(()=>{
  if(!active||!station){setState({key,rows:[],loading:false});return}
  const ctrl=new AbortController();let cached:any=null;
  try{cached=readAirCache(localStorage,key,station)}catch{}
  setState((old:any)=>({key,rows:cached?.rows||(old.key===key?old.rows:[])||[],loading:true,previous:true}));
  request('air',{region,station},ctrl.signal).then(result=>{
   if(ctrl.signal.aborted)return;
   if(result.error)throw new Error(result.error);
   const rows=(result.rows||[]).filter((r:any)=>r.stationName===station);
   if(!rows.length)throw new Error('이 측정소에서 제공된 자료가 없어요. 다른 측정소를 선택할 수 있어요.');
   setState({key,rows,loading:false,previous:false});
   try{localStorage.setItem(key,JSON.stringify({rows,savedAt:Date.now()}))}catch{}
  }).catch(error=>{if(!ctrl.signal.aborted)setState((old:any)=>({...old,key,loading:false,previous:true,error:error.message||'대기질을 불러오지 못했어요.'}))});
  return()=>ctrl.abort();
 },[key,region,station,tick,active,request]);
 // Never paint another station's value during the render before its effect runs.
 return active&&station&&state.key===key?state:{key,rows:[],loading:!!(active&&station)};
}
