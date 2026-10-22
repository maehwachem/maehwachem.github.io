import fs from 'node:fs/promises';
import {build} from 'esbuild';
const result=await build({entryPoints:['src/main.tsx'],bundle:true,write:false,format:'iife',platform:'browser',target:['es2020'],jsx:'automatic',minify:true,legalComments:'inline',define:{'process.env.NODE_ENV':'"production"'}});
const css=await fs.readFile('src/style.css','utf8');
const js=result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
const html='<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="description" content="시간표·급식·학사일정과 날씨·대기질을 한눈에 보는 KJE의 학급 게시판"><title>우리 반의 하루 · KJE의 작업실</title><link rel="canonical" href="https://kjelab.kr/classroom-day/"><style>'+css+'</style></head><body><div id="root"></div><noscript>이 게시판은 자바스크립트를 사용합니다. 브라우저에서 자바스크립트를 켜 주세요.</noscript><script>'+js+'</script></body></html>\n';
await fs.writeFile('index.html',html);
console.log('Built index.html: '+Buffer.byteLength(html)+' bytes');
