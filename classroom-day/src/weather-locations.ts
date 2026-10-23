import rows from './weather-locations.json' with {type:'json'};
export type WeatherLocation={id:string;province:string;district:string;town:string;nx:number;ny:number};
export const weatherLocations:WeatherLocation[]=rows.map(r=>({id:String(r[0]),province:String(r[1]),district:String(r[2]),town:String(r[3]),nx:Number(r[4]),ny:Number(r[5])}));
const byId=new Map(weatherLocations.map(r=>[r.id,r]));
export function findWeatherLocation(id?:string|null){return id?byId.get(id):undefined}
export function weatherLocationLabel(r:WeatherLocation){return [r.province,r.district,r.town].filter(Boolean).filter((s,i,a)=>i===0||s!==a[i-1]).join(' · ')+(r.town?'':' · 대표 지점')}
export function airRegionFor(r:WeatherLocation){
 if(r.province==='전남광주통합특별시')return ['동구','서구','남구','북구','광산구'].includes(r.district)?'광주':'전남';
 const names:Record<string,string>={'서울특별시':'서울','부산광역시':'부산','대구광역시':'대구','인천광역시':'인천','대전광역시':'대전','울산광역시':'울산','세종특별자치시':'세종','경기도':'경기','강원특별자치도':'강원','충청북도':'충북','충청남도':'충남','전북특별자치도':'전북','경상북도':'경북','경상남도':'경남','제주특별자치도':'제주'};
 return names[r.province]||'서울';
}
