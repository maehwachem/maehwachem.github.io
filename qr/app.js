(()=>{'use strict';
  const $=id=>document.getElementById(id),form=$('qr-form'),urlInput=$('url'),titleInput=$('title');let result=null;
  const status=text=>{$('status').textContent=text;};
  function invalidate(){result=null;$('result').hidden=true;$('empty').hidden=false;$('badge').textContent='준비';$('error').hidden=true;urlInput.removeAttribute('aria-invalid');}
  function fail(message){$('error').textContent=message;$('error').hidden=false;urlInput.setAttribute('aria-invalid','true');urlInput.focus();}
  function generate(event){if(event)event.preventDefault();invalidate();try{
    const url=QRTool.normalizeURL(urlInput.value),title=titleInput.value.trim()||'참고 자료';
    const matrix=QRTool.matrixFor(url,qrcode),svg=QRTool.svgFor(matrix);result={url,title,matrix,svg};
    const canvas=document.createElement('canvas');QRTool.drawCanvas(canvas,matrix);
    $('png').href=canvas.toDataURL('image/png');$('png').download=QRTool.filename(title)+'.png';
    $('svg').href='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);$('svg').download=QRTool.filename(title)+'.svg';
    $('qr-image').innerHTML=svg;$('result-title').textContent=title;$('result-link').textContent=url;
    for(const id of ['result-link','open-link'])$(id).href=url;
    $('empty').hidden=true;$('result').hidden=false;$('badge').textContent='완성';status('QR코드를 만들었습니다. 이미지 저장 또는 크게 보기를 선택하세요.');
    if(window.matchMedia('(max-width:760px)').matches)$('result').scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});
  }catch(error){fail(error instanceof ReferenceError?'QR 도구를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.':error.message||'QR코드를 만들지 못했습니다. 주소를 확인해 주세요.');}}
  form.addEventListener('submit',generate);urlInput.addEventListener('input',invalidate);titleInput.addEventListener('input',invalidate);
  $('example').addEventListener('click',()=>{urlInput.value='https://kjelab.kr/lectures/energy-efficiency.html?s=1';titleInput.value='에너지 효율과 신재생 에너지';generate();});
  $('reset').addEventListener('click',()=>{form.reset();invalidate();status('입력을 지웠습니다.');urlInput.focus();});
  $('enlarge').addEventListener('click',()=>{if(!result)return;$('large-title').textContent=result.title;$('large-qr').innerHTML=result.svg;$('large-link').href=result.url;$('large-link').textContent=result.url;$('large-view').showModal();});
  $('close-large').addEventListener('click',()=>$('large-view').close());
  $('print').addEventListener('click',()=>{if(result)window.print();});
})();
