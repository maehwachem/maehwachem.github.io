/* Local, hand-drawn storyboards: one intentional player, no autoplay or requests. */
(function(){
  'use strict';
  const players=[];
  const interval=8000;
  const reduced=window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  document.querySelectorAll('.illustrated-guide').forEach(card=>{
    const steps=[...card.querySelectorAll('.ill-step-list>li')];
    const img=card.querySelector('.ill-stage img');
    const counter=card.querySelector('.ill-counter');
    const toolbar=card.querySelector('.ill-toolbar');
    const nav=card.querySelector('.ill-step-nav');
    const prev=card.querySelector('.ill-prev');
    const play=card.querySelector('.ill-play');
    const next=card.querySelector('.ill-next');
    const panel=card.closest('[role=tabpanel]');
    if(!steps.length||!img||!toolbar||!panel)return;
    let index=0,timer=null;
    const player={stop};players.push(player);
    const buttons=steps.map((step,i)=>{
      const item=document.createElement('li'),button=document.createElement('button');
      button.type='button';
      button.setAttribute('aria-label',(i+1)+'단계: '+step.dataset.short);
      button.setAttribute('aria-controls',step.id);
      const number=document.createElement('span');number.textContent=String(i+1).padStart(2,'0');
      const title=document.createElement('span');title.textContent=step.dataset.short;
      button.append(number,title);item.append(button);nav.append(item);
      button.addEventListener('click',()=>{stop();show(i);});
      return button;
    });
    function show(i){
      index=i;
      steps.forEach((step,n)=>{step.hidden=n!==i;});
      buttons.forEach((button,n)=>{if(n===i)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');});
      img.style.transform='translateX('+(-100*i/steps.length)+'%)';
      img.alt=steps[i].dataset.alt;
      counter.textContent=String(i+1).padStart(2,'0')+' / '+String(steps.length).padStart(2,'0')+' 단계';
      prev.disabled=i===0;next.disabled=i===steps.length-1;
      if(timer===null)play.textContent=i===steps.length-1?'↻ 다시 재생':'▶ 순서대로 재생';
    }
    function stop(){
      if(timer!==null){clearTimeout(timer);timer=null;}
      play.setAttribute('aria-pressed','false');
      counter.setAttribute('aria-live','polite');
      play.textContent=index===steps.length-1?'↻ 다시 재생':'▶ 순서대로 재생';
    }
    function advance(){
      if(panel.hidden||document.hidden||index===steps.length-1){stop();return;}
      show(index+1);
      timer=setTimeout(advance,interval);
    }
    prev.addEventListener('click',()=>{stop();show(Math.max(0,index-1));});
    next.addEventListener('click',()=>{stop();show(Math.min(steps.length-1,index+1));});
    play.addEventListener('click',()=>{
      if(timer!==null){stop();return;}
      players.forEach(p=>p.stop());
      if(index===steps.length-1)show(0);
      // Repeated live announcements interrupt screen-reader reading during playback.
      counter.setAttribute('aria-live','off');
      play.setAttribute('aria-pressed','true');play.textContent='Ⅱ 잠깐 멈추기';
      timer=setTimeout(advance,interval);
    });
    new MutationObserver(()=>{if(panel.hidden)stop();}).observe(panel,{attributes:true,attributeFilter:['hidden']});
    toolbar.hidden=false;card.classList.add('ill-ready');show(0);
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)players.forEach(p=>p.stop());});
  window.addEventListener('pagehide',()=>players.forEach(p=>p.stop()));
  // CSS omits transitions for reduced motion; preference changes also stop playback.
  if(reduced&&reduced.addEventListener)reduced.addEventListener('change',()=>players.forEach(p=>p.stop()));
})();
