export type ScenePhase='morning'|'day'|'evening'|'night';
export type SceneWeather='dry'|'rain'|'snow'|'sleet'|'unknown';
export function sceneForWeather(now:Date,weather:any,demo=false){
 const hour=Number(new Intl.DateTimeFormat('en-GB',{hour:'2-digit',hourCycle:'h23',timeZone:'Asia/Seoul'}).format(now));
 const phase:ScenePhase=hour>=6&&hour<10?'morning':hour>=10&&hour<17?'day':hour>=17&&hour<20?'evening':'night';
 const phaseLabel={morning:'아침',day:'낮',evening:'저녁',night:'밤'}[phase];
 const stamp=weather?.observedAt?.match(/^(\d{4})(\d{2})(\d{2}) (\d{2})(\d{2})$/);
 const observed=stamp?Date.parse(`${stamp[1]}-${stamp[2]}-${stamp[3]}T${stamp[4]}:${stamp[5]}:00+09:00`):NaN;
 const age=now.getTime()-observed;
 const valid=demo||Number.isFinite(age)&&age>=-10*60000&&age<=3*3600000;
 const raw=valid?weather?.values?.PTY:undefined;
 const pty=raw===undefined||raw===null||raw===''?NaN:Number(raw);
 const condition:SceneWeather=pty===0?'dry':[1,4,5].includes(pty)?'rain':[3,7].includes(pty)?'snow':[2,6].includes(pty)?'sleet':'unknown';
 const windy=condition!=='unknown'&&Number(weather?.values?.WSD)>=3;
 const weatherLabel={dry:'강수 없음',rain:'비',snow:'눈',sleet:'비·눈',unknown:'날씨 확인 중'}[condition];
 return {phase,phaseLabel,condition,windy,label:(demo?'예시 · ':'')+phaseLabel+' · '+weatherLabel+(windy?' · 바람':'')};
}
