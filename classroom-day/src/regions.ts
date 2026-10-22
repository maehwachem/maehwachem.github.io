export const regions = [
 {name:'서울',label:'서울 · 시청 부근',nx:60,ny:127}, {name:'경기',label:'경기 · 수원 시청 부근',nx:60,ny:121},
 {name:'인천',label:'인천 · 시청 부근',nx:55,ny:124}, {name:'부산',label:'부산 · 시청 부근',nx:98,ny:76},
 {name:'대구',label:'대구 · 중구 부근',nx:89,ny:90}, {name:'광주',label:'광주 · 시청 부근',nx:58,ny:74},
 {name:'대전',label:'대전 · 시청 부근',nx:67,ny:100}, {name:'울산',label:'울산 · 시청 부근',nx:102,ny:84},
 {name:'세종',label:'세종 · 시청 부근',nx:66,ny:103}, {name:'강원',label:'강원 · 춘천 시청 부근',nx:73,ny:134},
 {name:'충북',label:'충북 · 청주 부근',nx:69,ny:106}, {name:'충남',label:'충남 · 홍성 부근',nx:55,ny:106},
 {name:'전북',label:'전북 · 전주 시청 부근',nx:63,ny:89}, {name:'전남',label:'전남 · 무안 부근',nx:50,ny:67},
 {name:'경북',label:'경북 · 안동 시청 부근',nx:91,ny:106}, {name:'경남',label:'경남 · 창원 시청 부근',nx:90,ny:77},
 {name:'제주',label:'제주 · 제주시청 부근',nx:53,ny:38}
];
export function koreanDate(d=new Date()){return new Date(d.getTime()+9*3600000).toISOString().slice(0,10)}
export function weatherBase(d=new Date()){const t=new Date(d.getTime()+9*3600000-45*60000);return {base_date:t.toISOString().slice(0,10).replaceAll('-',''),base_time:String(t.getUTCHours()).padStart(2,'0')+'00'}}
export function clean(s:string){return String(s??'').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ')}
