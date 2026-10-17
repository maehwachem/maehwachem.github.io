/* Equipment guide: local magnification calculator and on-demand official videos. */
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

  // Do not contact YouTube until the visitor chooses a video. Only one plays at a time.
  const videos=[];
  function stopVideo(video,restoreFocus=false){
    if(!video.frame)return;
    video.frame.remove();video.frame=null;
    video.button.hidden=false;video.close.hidden=true;
    if(restoreFocus)video.button.focus();
  }
  document.querySelectorAll('.scope-video-load').forEach(button=>{
    if(!/^[\w-]{11}$/.test(button.dataset.youtube))return;
    const card=button.closest('.scope-video'),screen=button.parentElement;
    const close=document.createElement('button');
    close.type='button';close.className='text-button scope-video-close';close.textContent='영상 닫기';close.hidden=true;
    close.setAttribute('aria-label',button.dataset.videoTitle+' 영상 닫기');
    card.querySelector('.scope-video-caption').append(close);
    const video={button,close,frame:null};videos.push(video);
    close.addEventListener('click',()=>stopVideo(video,true));
    button.addEventListener('click',()=>{
      videos.forEach(item=>stopVideo(item));
      const frame=document.createElement('iframe');
      frame.title=button.dataset.videoTitle;
      frame.src='https://www.youtube-nocookie.com/embed/'+button.dataset.youtube+'?autoplay=1&rel=0&playsinline=1';
      frame.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';
      frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';
      video.frame=frame;button.hidden=true;close.hidden=false;
      screen.append(frame);frame.focus();
    });
  });
  new MutationObserver(()=>{
    if($('panel-telescope').hidden)videos.forEach(video=>stopVideo(video));
  }).observe($('panel-telescope'),{attributes:true,attributeFilter:['hidden']});
})();
