import {weatherLocations,findWeatherLocation,weatherLocationLabel,airRegionFor} from './weather-locations';
export function WeatherLocationPicker({value,region,onChange}:{value?:string;region:string;onChange:(id:string,airRegion:string)=>void}){
 const provinces=weatherLocations.filter(r=>!r.district&&!r.town);
 const selected=findWeatherLocation(value);
 const current=selected||provinces.find(r=>airRegionFor(r)===region)||provinces.find(r=>r.province==='전남광주통합특별시')!;
 const districts=weatherLocations.filter(r=>r.province===current.province&&r.district&&!r.town);
 const towns=weatherLocations.filter(r=>r.province===current.province&&r.district===current.district&&r.town);
 const district=districts.find(r=>r.district===current.district);
 function choose(id:string){const r=findWeatherLocation(id);if(r)onChange(id,airRegionFor(r))}
 return <fieldset className="weather-location-fields"><legend>날씨·대기질 지역</legend><label>시·도<select aria-label="날씨 시·도" value={provinces.find(r=>r.province===current.province)?.id||''} onChange={e=>choose(e.target.value)}>{provinces.map(r=><option key={r.id} value={r.id}>{r.province}</option>)}</select></label><div className="field-row"><label>시·군·구<select aria-label="날씨 시·군·구" value={district?.id||''} onChange={e=>choose(e.target.value||provinces.find(r=>r.province===current.province)!.id)}><option value="">시·군·구 선택</option>{districts.map(r=><option key={r.id} value={r.id}>{r.district}</option>)}</select></label><label>읍·면·동<select aria-label="날씨 읍·면·동" disabled={!district||!towns.length} value={current.town?current.id:''} onChange={e=>choose(e.target.value||district!.id)}><option value="">{district?'동네 선택 · 미선택 시 대표 지점':'시·군·구를 먼저 선택'}</option>{towns.map(r=><option key={r.id} value={r.id}>{r.town}</option>)}</select></label></div><p className="fineprint">{selected?'선택한 날씨 지역: '+weatherLocationLabel(selected):'기존 대표 지점을 사용 중이에요. 학교가 있는 시·군·구와 읍·면·동을 골라 주세요.'}</p><p className="fineprint">선택한 동네의 기상청 격자 자료를 조회해요. 같은 격자에 있는 동네는 값이 같을 수 있고, 학교 현장의 실제 날씨와는 차이가 있을 수 있어요.</p></fieldset>;
}
