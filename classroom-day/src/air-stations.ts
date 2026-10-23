import metadata from './air-stations.json' with {type:'json'};
import type {WeatherLocation} from './weather-locations';
const stations=new Map(metadata.map(r=>[r[0]+'|'+r[1],{address:r[2],network:r[3]}]));
export function stationInfo(region:string,name:string){return stations.get(region+'|'+name)}
export function stationsForDistrict<T extends {stationName:string}>(rows:T[],region:string,location?:WeatherLocation){
 if(!location?.district)return [];
 const district=location.district.replace(/\s/g,'');
 return rows.filter(r=>{
  const meta=stationInfo(region,r.stationName);if(!meta)return false;
  // Match the leading administrative address only, not a road/building name.
  const words=meta.address.split(/\s+/);const prefix=words.slice(0,2).join('');
  return words[0]===district||prefix===district||region==='세종'&&location.province==='세종특별자치시';
 }).sort((a,b)=>{const na=stationInfo(region,a.stationName)?.network,nb=stationInfo(region,b.stationName)?.network;return Number(nb==='도시대기')-Number(na==='도시대기')||a.stationName.localeCompare(b.stationName,'ko')});
}
export function chooseLocalStation<T extends {stationName:string}>(rows:T[],saved:string,town?:string){
 if(rows.some(r=>r.stationName===saved))return saved;
 const exact=rows.filter(r=>r.stationName===town);
 if(exact.length===1)return exact[0].stationName;
 return rows.length===1?rows[0].stationName:'';
}
