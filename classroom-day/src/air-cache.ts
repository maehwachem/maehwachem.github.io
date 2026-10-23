export const AIR_CACHE_MAX_AGE=24*60*60*1000;
export function airCacheKey(region:string,station:string){return 'classday-air-v1:'+region+':'+station}
export function readAirCache(storage:Pick<Storage,'getItem'>,key:string,station:string,now=Date.now()){
 try{const cached=JSON.parse(storage.getItem(key)||'null');
  if(!cached||!Number.isFinite(cached.savedAt)||cached.savedAt>now||now-cached.savedAt>AIR_CACHE_MAX_AGE||!Array.isArray(cached.rows)||cached.rows.length!==1||cached.rows[0]?.stationName!==station||!cached.rows[0]?.dataTime)return null;
  return cached;
 }catch{return null}
}
