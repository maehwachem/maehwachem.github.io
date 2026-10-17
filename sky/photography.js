/* Photography guide: geometric framing and a downloadable observing note. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const format=new Intl.NumberFormat('ko-KR',{maximumFractionDigits:2});
  const presets={wide:[36,24,24],normal:[36,24,50],telescope:[6.4,3.6,250],long:[6.4,3.6,2000]};
  const inputIds=['photo-sensor-width','photo-sensor-height','photo-focal'];
  function setAttributes(element,attributes){Object.entries(attributes).forEach(([key,value])=>element.setAttribute(key,String(value)));}
  function updateField(){
    const [width,height,focal]=inputIds.map(id=>Number($(id).value));
    if(!inputIds.every(id=>$(id).checkValidity())||![width,height,focal].every(n=>Number.isFinite(n)&&n>0)){
      $('photo-fov-output').value='—';$('photo-fov-fit').textContent='센서 크기는 0.1~100 mm, 초점거리는 0.1~100,000 mm로 입력해 주세요.';
      $('photo-fov-svg').setAttribute('hidden','');return;
    }
    const horizontal=2*Math.atan(width/(2*focal))*180/Math.PI;
    const vertical=2*Math.atan(height/(2*focal))*180/Math.PI;
    const angle=n=>n<0.01?n.toFixed(4)+'°':format.format(n)+'°';
    $('photo-fov-output').value=angle(horizontal)+' × '+angle(vertical);
    const moonFits=horizontal>=0.5&&vertical>=0.5;
    $('photo-fov-fit').textContent=(moonFits?'달 전체가 들어오는 화각이에요. ':'달 전체를 담기에는 화각이 좁아요. ')+(horizontal>=3?'안드로메다은하의 긴 쪽 약 3°도 가로 폭 안에 들어와요. 세로 크기와 기울기는 따로 확인하세요.':'안드로메다은하의 긴 쪽 약 3°는 가로 폭을 넘어요.');
    const scale=Math.min(460/width,270/height),frameWidth=width*scale,frameHeight=height*scale;
    const x=(560-frameWidth)/2,y=(360-frameHeight)/2;
    setAttributes($('photo-frame'),{x,y,width:frameWidth,height:frameHeight});
    setAttributes($('photo-clip-rect'),{x,y,width:frameWidth,height:frameHeight});
    // Size on the focal plane: 2f tan(angular diameter / 2). No minimum dot size.
    const moonRadius=focal*Math.tan(0.25*Math.PI/180)*scale;
    setAttributes($('photo-moon-scale'),{cx:280,cy:180,r:moonRadius});
    const halfGalaxy=focal*Math.tan(1.5*Math.PI/180)*scale,galaxyY=180+frameHeight*0.3;
    setAttributes($('photo-m31-scale'),{x1:280-halfGalaxy,y1:galaxyY,x2:280+halfGalaxy,y2:galaxyY});
    setAttributes($('photo-m31-left'),{x1:280-halfGalaxy,x2:280-halfGalaxy,y1:galaxyY-5,y2:galaxyY+5});
    setAttributes($('photo-m31-right'),{x1:280+halfGalaxy,x2:280+halfGalaxy,y1:galaxyY-5,y2:galaxyY+5});
    setAttributes($('photo-frame-label'),{y:Math.max(16,y-12)});
    $('photo-fov-svg-desc').textContent='사진 범위는 가로 '+angle(horizontal)+', 세로 '+angle(vertical)+'. '+$('photo-fov-fit').textContent+' 실제 천체 배치가 아닌 크기 비교 모식도입니다.';
    $('photo-fov-svg').removeAttribute('hidden');
  }
  inputIds.forEach(id=>$(id).addEventListener('input',updateField));
  $('photo-fov-form').addEventListener('submit',event=>{event.preventDefault();updateField();});
  document.querySelectorAll('[data-fov]').forEach(button=>button.addEventListener('click',()=>{
    const values=presets[button.dataset.fov];if(!values)return;
    inputIds.forEach((id,index)=>{$(id).value=values[index];});updateField();
  }));
  updateField();

  const kstParts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
  const time=Object.fromEntries(kstParts.map(part=>[part.type,part.value]));
  $('photo-log-date').value=time.year+'-'+time.month+'-'+time.day+'T'+time.hour+':'+time.minute;
  const logFields=[['photo-log-target','촬영 대상'],['photo-log-date','촬영 시작 시각(KST)'],['photo-log-place','장소와 하늘 상태'],['photo-log-gear','장비와 촬영 모드'],['photo-log-settings','노출과 촬영 조건'],['photo-log-notes','결과·처리 과정·다음 시도']];
  $('photo-log-form').addEventListener('submit',event=>{
    event.preventDefault();
    const lines=['하늘 관측실 · 촬영 기록',''];
    logFields.forEach(([id,label])=>{const value=$(id).value.trim();lines.push(label,(id==='photo-log-date'?value.replace('T',' '):value)||'(미기록)','');});
    lines.push('사진 원본과 함께 보관하세요.','https://kjelab.kr/sky/#photo');
    const blob=new Blob(['\uFEFF'+lines.join('\n')],{type:'text/plain;charset=utf-8'});
    let url;
    try{
      url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download='sky-photo-log-'+($('photo-log-date').value.slice(0,10)||time.year+'-'+time.month+'-'+time.day)+'.txt';
      document.body.append(a);a.click();a.remove();
      $('photo-log-status').textContent='기록 파일을 만들었어요. 다운로드한 파일을 확인해 주세요.';
      setTimeout(()=>URL.revokeObjectURL(url),60000);
    }catch(_){if(url)URL.revokeObjectURL(url);$('photo-log-status').textContent='파일을 만들지 못했어요. 입력한 내용을 복사해 보관해 주세요.';}
  });
})();
