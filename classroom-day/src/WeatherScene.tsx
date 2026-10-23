import {useEffect,useId,useState} from 'react';
import {sceneForWeather} from './weather-scene';
import type {ScenePhase,SceneWeather} from './weather-scene';
type Scene={phase:ScenePhase;condition:SceneWeather;windy:boolean;label:string};
export function SceneArtwork({scene,paused=false}:{scene:Scene;paused?:boolean}){
 const id=useId().replace(/:/g,'');const night=scene.phase==='night';
 const sunX=scene.phase==='morning'?129:scene.phase==='evening'?223:218,sunY=scene.phase==='day'?55:83;
 const wet=['rain','sleet'].includes(scene.condition),snowy=['snow','sleet'].includes(scene.condition);
 const sky={morning:['#f7e8c5','#e4eddf'],day:['#f7f0d8','#e5efdc'],evening:['#d8c4d7','#f2d3b7'],night:['#34455e','#617285']}[scene.phase];
 const colors=scene.condition==='unknown'?sky:wet||snowy?(night?['#3c4b61','#687c89']:['#c6d8dc','#e7e9df']):sky;
 return <svg viewBox="0 0 340 190" role="img" aria-label={scene.label+'의 교실 창가'} className={'scene-art scene-'+scene.phase+(scene.windy?' scene-windy':'')+(paused?' scene-paused':'')}>
 <defs><linearGradient id={'sky-'+id} x2="0" y2="1"><stop stopColor={colors[0]}/><stop offset="1" stopColor={colors[1]}/></linearGradient><clipPath id={'window-'+id}><path d="M86 164V92a87 80 0 0 1 174 0v72z"/></clipPath></defs>
 <g clipPath={'url(#window-'+id+')'}>
 <rect x="85" y="10" width="176" height="155" fill={'url(#sky-'+id+')'}/>
 {night?<><g fill="#f6edcc" className="scene-stars"><circle cx="119" cy="51" r="1.6"/><circle cx="163" cy="31" r="1.3"/><circle cx="229" cy="86" r="1.6"/><path d="M146 75v6m-3-3h6" stroke="#f6edcc" strokeWidth="1.4"/></g><path d="M220 35a22 22 0 1 0 21 30 20 20 0 0 1-21-30" fill="#f3e6b8" className="scene-moon"/></>:
 scene.condition!=='unknown'&&<g className="scene-sun" opacity={wet||snowy?'.4':'1'}><g className="scene-rays" style={{transformOrigin:`${sunX}px ${sunY}px`}} stroke="#e2ba59" strokeWidth="2.4" strokeLinecap="round">{[0,45,90,135,180,225,270,315].map(angle=><path key={angle} d={`M${sunX} ${sunY-28}v-6`} transform={`rotate(${angle} ${sunX} ${sunY})`}/>)}</g><circle cx={sunX} cy={sunY} r="22" fill={scene.phase==='evening'?'#e8a078':'#edc76e'}/></g>}
 <path d="M85 134q42-37 86-8t92-10v49H85z" fill={night?'#5c7777':'#bbcaaa'}/><path d="M85 151q58-30 104-3t75-13v31H85z" fill={night?'#426461':'#94ae87'}/>
 {scene.condition==='dry'&&!scene.windy&&<g className="scene-cloud scene-fair-cloud" fill={night?'#c4d1d5':'#fffef3'} opacity=".75"><path d="M100 84a9 9 0 0 1 9-13 13 13 0 0 1 24-1 9 9 0 0 1 9 14z"/></g>}
 {(wet||snowy||scene.windy)&&<g className="scene-cloud" fill={night?'#93a4ad':'#eef1eb'} opacity=".9"><path d="M108 80a13 13 0 0 1 10-20 18 18 0 0 1 34-1 12 12 0 0 1 10 21z"/><path d="M196 59a10 10 0 0 1 9-15 14 14 0 0 1 26-2 10 10 0 0 1 12 17z"/></g>}
 {wet&&<g stroke={night?'#a4c5d1':'#7dabb6'} strokeWidth="2" strokeLinecap="round">{[0,1,2,3,4,5,6,7].map(i=><path key={i} d={`M${98+i*21} ${65+(i%3)*22}l-6 16`} className="scene-rain" style={{animationDelay:`${-i*.39}s`}}/>)}</g>}
 {snowy&&<g fill="#fffdf1">{[0,1,2,3,4,5,6,7,8].map(i=><circle key={i} cx={100+i*18} cy={54+(i%4)*23} r={i%2?2:2.7} className="scene-snow" style={{animationDelay:`${-i*.9}s`}}/>)}</g>}
 </g>
 <path d="M88 96h170M173 13v150" stroke={night?'#b5c2ad':'#ced6b9'} strokeWidth="7"/>
 <rect x="41" y="158" width="249" height="9" rx="4" fill="#ab7d54"/>
 <rect x="73" y="145" width="83" height="12" rx="3" fill="#da9b7e"/><rect x="79" y="132" width="71" height="11" rx="3" fill="#f0d28e"/><rect x="91" y="118" width="60" height="12" rx="3" fill="#779488"/>
 <g className="scene-plant"><path d="M232 139v-39" stroke="#40664b" strokeWidth="4"/><ellipse cx="218" cy="107" rx="17" ry="9" transform="rotate(35 218 107)" fill="#5c815b"/><ellipse cx="245" cy="92" rx="17" ry="9" transform="rotate(-38 245 92)" fill="#759465"/></g>
 <path d="M213 132h39l-6 26h-27z" fill="#d6a478"/>
 <path d="M165 147h24l-2 10h-20z" fill="#eee3ce"/><path d="M188 148q10-1 5 6h-5" fill="none" stroke="#d8c9ac" strokeWidth="2"/>
 <g fill="none" stroke="#8da08c" strokeWidth="2.2" strokeLinecap="round">{[0,1,2].map(i=><path key={i} className="scene-steam" d={`M${170+i*7} 140q-5-5 0-10t0-10`} style={{animationDelay:`${-i*1.1}s`}}/>)}</g>
 <circle cx="51" cy="72" r="3" fill="#8ea382"/><path d="M282 111v12m-6-6h12" stroke="#d9ba70" strokeWidth="3"/>
 </svg>
}
export function WeatherScene({weather,demo,sceneKey}:{weather:any;demo:boolean;sceneKey:string}){
 const [now,setNow]=useState(()=>new Date()),[paused,setPaused]=useState(false),[hidden,setHidden]=useState(false),[reduced,setReduced]=useState(false);
 const [last,setLast]=useState<{key:string;weather:any}|null>(null);
 useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),60000);const media=window.matchMedia('(prefers-reduced-motion: reduce)');const change=()=>setReduced(media.matches);const visibility=()=>{setHidden(document.hidden);if(!document.hidden)setNow(new Date())};change();visibility();media.addEventListener('change',change);document.addEventListener('visibilitychange',visibility);try{setPaused(localStorage.getItem('classday-scene-paused')==='true')}catch{}return()=>{clearInterval(timer);media.removeEventListener('change',change);document.removeEventListener('visibilitychange',visibility)}},[]);
 const validWeather=demo||weather?.sceneKey===sceneKey?weather:undefined;
 useEffect(()=>{if(!demo&&validWeather?.values)setLast({key:sceneKey,weather:validWeather})},[validWeather,sceneKey,demo]);
 const current=validWeather?.values?validWeather:last?.key===sceneKey?last.weather:undefined;
 const scene=sceneForWeather(now,current,demo);
 function toggle(){const next=!paused;setPaused(next);try{localStorage.setItem('classday-scene-paused',String(next))}catch{}}
 return <div className="scene-wrap" data-phase={scene.phase} data-weather={scene.condition}>
 <SceneArtwork scene={scene} paused={paused||hidden||reduced}/>
 <div className="scene-caption"><span>{scene.label}</span><button type="button" onClick={toggle} disabled={reduced} aria-pressed={paused||reduced} aria-label={reduced?'기기의 동작 줄이기 설정 적용 중':paused?'창가 그림 움직임 켜기':'창가 그림 움직임 끄기'}>{reduced?'동작 줄임':paused?'움직임 켜기':'움직임 끄기'}</button></div>
 </div>
}
