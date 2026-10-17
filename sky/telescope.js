/* Equipment guide: local magnification calculator. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const format=new Intl.NumberFormat('ko-KR',{maximumFractionDigits:1});
  function updatePower(){
    const focal=Number($('scope-focal').value),eyepiece=Number($('scope-eyepiece').value),barlow=Number($('scope-barlow').value);
    const power=focal/eyepiece*barlow;
    if(!Number.isFinite(focal)||!Number.isFinite(eyepiece)||focal<=0||eyepiece<=0||!Number.isFinite(power)||![1,2,3].includes(barlow)){
      $('scope-power').value='—';$('scope-power-detail').textContent='두 초점거리에 0보다 큰 숫자를 입력해 주세요.';return;
    }
    $('scope-power').value=format.format(power)+'배';
    $('scope-power-detail').textContent=format.format(focal)+' ÷ '+format.format(eyepiece)+(barlow===1?'':' × '+barlow)+' = '+format.format(power);
  }
  ['scope-focal','scope-eyepiece','scope-barlow'].forEach(id=>$(id).addEventListener('input',updatePower));
  $('scope-power-form').addEventListener('submit',event=>{event.preventDefault();updatePower();});
  document.querySelectorAll('[data-eyepiece]').forEach(button=>button.addEventListener('click',()=>{$('scope-eyepiece').value=button.dataset.eyepiece;updatePower();}));
  updatePower();

})();
