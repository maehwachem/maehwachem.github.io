/* Public reader only. All writes and authentication happen on Pages CMS/GitHub. */
(() => {
  'use strict';
  const root = document.getElementById('kje-portfolio');
  const categories = {
    lab: ['가상실험', '현상과 변화를 화면에서 살펴보는 실험 콘텐츠.'],
    game: ['학습 게임', '탐험과 미션, 선택을 통해 과학을 만나는 게임.'],
    tool: ['교육 도구', '학습과 지도, 실험 기록에 활용하는 도구.'],
    lesson: ['수업·탐구 자료', '과학 개념을 이해하고 탐구로 이어가는 자료.']
  };
  const art = {lab:'<div class="kje-lab-ring"></div>',battery:'<div class="kje-battery-art"></div>',island:'<div class="kje-contour"></div>',power:'<div class="kje-power-art">kWh</div>',solution:'<svg class="kje-solution-art" viewBox="0 0 150 130" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M56 34H64V64Q93 75 93 100Q93 122 60 122Q27 122 27 100Q27 75 56 64Z M118 30H122V41Q130 45 130 58Q130 69 122 73V111L120 119L118 111V73Q110 69 110 58Q110 45 118 41Z" fill="currentColor" fill-opacity=".22" stroke="none"/><path d="M51 8H69M54 8V62Q24 74 24 100Q24 125 60 125Q96 125 96 100Q96 74 66 62V8"/><path d="M49 34H71" stroke-width="2.5"/><path d="M117 4H123V40Q132 44 132 58Q132 70 123 74V112L120 124L117 112V74Q108 70 108 58Q108 44 117 40Z"/><path d="M112 22H128" stroke-width="2.5"/></svg>',glass:'<svg class="kje-glass-art" viewBox="0 0 150 130" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M10 90H49V120Q49 124 45 124H14Q10 124 10 120Z M70 95H100L107 117Q109 123 102 123H68Q61 123 63 117Z M122 60H136V115H122Z" fill="currentColor" fill-opacity=".22" stroke="none"/><path d="M6 45H50L55 50L50 53V120Q50 125 45 125H14Q9 125 9 120V50Z"/><path d="M15 70H24M15 82H21M15 94H24"/><path d="M77 18H93M79 18V58L61 117Q59 125 67 125H103Q111 125 109 117L91 58V18"/><path d="M121 8H137V117H121Z M113 117H145V125H113Z M137 25H132M137 40H132M137 55H129M137 70H132M137 85H132M137 100H129"/></svg>',note:'<div class="kje-notepaper"><b>Q.</b><span></span><span></span><span></span></div>',earth:'<div class="kje-earth-art"></div>',acid:'<div class="kje-acid-art">H⁺ + OH⁻</div>'};
  const own = (object,key) => Object.prototype.hasOwnProperty.call(object,key);
  const text = value => typeof value === 'string' ? value : '';
  function node(tag, className, value) {
    const el = document.createElement(tag);
    if(className) el.className=className;
    if(value !== undefined) el.textContent=text(value);
    return el;
  }
  function safeURL(value, image=false) {
    if(!text(value).trim()) return null;
    try {
      const url=new URL(value, location.origin+'/');
      if(url.username || url.password) return null;
      if(url.protocol==='https:' || (url.protocol==='http:' && !image) || (url.origin===location.origin && url.protocol==='http:') || (!image && url.protocol==='mailto:')) return url.href;
    } catch (_) { /* Ignore malformed links. */ }
    return null;
  }
  function setText(selector,value) { const el=root.querySelector(selector);if(el && typeof value==='string')el.textContent=value; }
  function addLink(parent,label,url,className='kje-project-go') {
    const href=safeURL(url);if(!href)return false;
    const el=node('a',className,label||'열기');el.href=href;
    if(new URL(href).origin!==location.origin && !href.startsWith('mailto:')){el.target='_blank';el.rel='noopener noreferrer';}
    parent.append(el);return true;
  }
  function applySite(site) {
    if(!site || typeof site!=='object')return;
    setText('.kje-brand-name',site.title);setText('.kje-footer strong',site.title);
    setText('#about h1',site.name);setText('.kje-profile-lead',site.lead);setText('.kje-profile-text',site.bio);
    if(text(site.background_title).trim()){
      setText('.kje-background h2',site.background_title);
      root.querySelector('.kje-background').setAttribute('aria-label',site.background_title);
    }
    if(text(site.title))document.title=site.title+' · 과학교육과 탐구';
    if(text(site.lead))document.querySelector('meta[name="description"]').content=site.lead.replace(/\n/g,' ');
    const brand=root.querySelector('.kje-brand');if(text(site.title))brand.setAttribute('aria-label',site.title+' 홈');
    const image=safeURL(site.character,true);
    if(image)root.style.setProperty('--kje-student-image','url('+JSON.stringify(image)+')');
    const email=text(site.email).trim();
    if(/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))root.querySelectorAll('a[href^="mailto:"]').forEach(el=>{el.href='mailto:'+email;if(el.classList.contains('kje-contact-email'))el.textContent=email;});
    if(Array.isArray(site.background)) {
      const dl=root.querySelector('.kje-background dl');dl.replaceChildren();
      site.background.forEach(item=>{if(!item)return;const row=node('div');row.append(node('dt','',item.label),node('dd','',item.text));dl.append(row);});
    }
    if(Array.isArray(site.explorations)) {
      const list=root.querySelector('.kje-explore-list');list.replaceChildren();
      site.explorations.forEach(item=>{if(!item)return;const article=node('article');article.append(node('h3','',item.title),node('p','',item.text));addLink(article,item.link_label,item.link);list.append(article);});
    }
    setText('#journal-title',site.interests_title);setText('.kje-about-copy',site.interests_text);
    if(Array.isArray(site.interests)){const list=root.querySelector('.kje-interests');list.replaceChildren(...site.interests.map(value=>node('span','',value)));}
  }
  let selectedCategory='lab';
  function selectCategory(key,writeHash=false) {
    if(!own(categories,key))return;
    selectedCategory=key;
    root.querySelectorAll('[data-category]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.category===key)));
    let count=0;
    root.querySelectorAll('.kje-project[data-kind]').forEach(card=>{card.hidden=card.dataset.kind!==key;if(!card.hidden)count++;});
    setText('#kje-category-description',categories[key][1]);setText('#kje-category-status',categories[key][0]+' · '+count+'개');
    if(writeHash)history.replaceState(null,'','#projects-'+key);
  }
  function renderProjects(data) {
    if(!data || !Array.isArray(data.projects))throw new Error('Invalid project data');
    const list=root.querySelector('#kje-project-list');const fragment=document.createDocumentFragment();
    for(const item of orderedItems(data.projects,data.display_order)) {
      if(!item || !text(item.title) || !own(categories,item.kind))continue;
      const card=node('article','kje-project');card.dataset.kind=item.kind;
      const posterName=own(art,item.poster)?item.poster:'note';const poster=node('div','kje-poster kje-poster-'+posterName);poster.setAttribute('aria-hidden','true');
      const cover=safeURL(item.cover,true);
      if(cover){const img=node('img','kje-project-cover');img.src=cover;img.alt='';img.loading='lazy';poster.append(img);}
      else{poster.innerHTML=art[posterName];poster.prepend(node('span','kje-poster-cap',categories[item.kind][0]));poster.append(node('span','kje-poster-word',item.words||item.title));}
      card.append(poster,node('p','kje-project-tag',item.tag),node('h3','kje-project-title',item.title),node('p','kje-project-desc',item.desc));
      if(data.show_dates!==false && dateKey(item.date))card.append(postMeta(item,false));
      const links=node('div','kje-project-links');
      (Array.isArray(item.links)?item.links:[]).forEach(link=>{if(link)addLink(links,link.label,link.url);});
      if(!links.children.length)links.append(node('span','kje-project-status','공개 준비 중'));
      card.append(links);fragment.append(card);
    }
    list.replaceChildren(fragment);selectCategory(selectedCategory);
  }
  /* Rebuild rich text from an explicit allowlist; no scripts, event handlers, forms or embeds. */
  function safeRichText(html) {
    const source=new DOMParser().parseFromString(text(html),'text/html');
    const allowed=new Set(['P','BR','H1','H2','H3','H4','H5','H6','STRONG','B','EM','I','U','S','DEL','BLOCKQUOTE','UL','OL','LI','A','IMG','FIGURE','FIGCAPTION','PRE','CODE','HR','TABLE','THEAD','TBODY','TFOOT','TR','TH','TD','SUB','SUP']);
    const drop=new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH','FORM','INPUT','BUTTON','TEXTAREA','SELECT','TEMPLATE','LINK','META','BASE']);
    function copy(src) {
      if(src.nodeType===3)return document.createTextNode(src.textContent);
      const out=document.createDocumentFragment();if(src.nodeType!==1||drop.has(src.tagName))return out;
      let target=out;
      if(allowed.has(src.tagName)) {
        target=document.createElement(src.tagName==='H1'?'h2':src.tagName.toLowerCase());
        if(src.tagName==='A'){const href=safeURL(src.getAttribute('href'));if(href){target.href=href;target.rel='noopener noreferrer';if(new URL(href).origin!==location.origin)target.target='_blank';}}
        if(src.tagName==='IMG'){const url=safeURL(src.getAttribute('src'),true);if(!url)return out;target.src=url;target.alt=src.getAttribute('alt')||'';target.loading='lazy';}
        if(['TD','TH'].includes(src.tagName))['colspan','rowspan'].forEach(key=>{const n=Number(src.getAttribute(key));if(Number.isInteger(n)&&n>0&&n<=20)target.setAttribute(key,String(n));});
        if(src.tagName==='OL'){const start=Number(src.getAttribute('start'));if(Number.isInteger(start)&&start>0)target.setAttribute('start',String(start));}
      }
      for(const child of src.childNodes)target.append(copy(child));return target;
    }
    const result=document.createDocumentFragment();for(const child of source.body.childNodes)result.append(copy(child));return result;
  }
  let posts=[];let postCategory='전체';let postsReady=false;let showPostDates=true;
  function orderedItems(items,order){
    const result=items.slice();
    return order==='newest'?result.sort((a,b)=>dateKey(b?.date).localeCompare(dateKey(a?.date))):result;
  }
  function sortedPosts(data) {
    if(!data||!Array.isArray(data.posts))throw new Error('Invalid post data');
    const ids=new Set();
    const valid=data.posts.filter(item=>{if(!item||!text(item.title)||!text(item.id)||ids.has(item.id))return false;ids.add(item.id);return true;});
    return orderedItems(valid,data.display_order);
  }
  function dateKey(value){
    const date=text(value).slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return '';
    const parsed=new Date(date+'T00:00:00Z');
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10)===date?date:'';
  }
  function postMeta(item,withCategory=true){
    const meta=node('p','kje-post-meta');const date=dateKey(item.date);
    if(date && (!withCategory || showPostDates)){
      const time=node('time','','게시일 '+date.replaceAll('-','.'));
      time.setAttribute('datetime',date);meta.append(time);
    }
    if(withCategory && text(item.category)){
      if(meta.childNodes.length)meta.append(document.createTextNode(' · '));
      meta.append(document.createTextNode(item.category));
    }
    meta.hidden=!meta.childNodes.length;return meta;
  }
  function postURL(id) {const url=new URL(location.href);url.searchParams.set('post',id);url.hash='journal';return url;}
  function postLink(post){const link=node('a');link.href=postURL(post.id);link.addEventListener('click',event=>{if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();history.pushState(null,'',link.href);showPost(true);});return link;}
  function renderPostList() {
    const list=root.querySelector('#kje-post-list');list.replaceChildren();
    const visible=posts.filter(post=>postCategory==='전체'||post.category===postCategory);
    for(const post of visible){
      const card=node('article','kje-post-card');const link=postLink(post);const cover=safeURL(post.cover,true);
      if(cover){const img=node('img','kje-post-cover');img.src=cover;img.alt=text(post.cover_alt);img.loading='lazy';link.append(img);}
      link.append(postMeta(post),node('h3','kje-post-title',post.title));
      if(text(post.summary))link.append(node('p','kje-post-summary',post.summary));card.append(link);list.append(card);
    }
    const empty=root.querySelector('#kje-post-empty');empty.hidden=visible.length>0;empty.textContent=posts.length?'이 분류에는 아직 글이 없습니다.':'아직 등록된 글이 없습니다.';
  }
  function renderPostFilters() {
    const wrap=root.querySelector('#kje-post-filters');wrap.replaceChildren();
    const values=['전체',...new Set(posts.map(post=>text(post.category)).filter(Boolean))];
    if(!values.includes(postCategory))postCategory='전체';
    values.forEach(value=>{const button=node('button','kje-post-filter',value);button.type='button';button.setAttribute('aria-pressed',String(value===postCategory));button.addEventListener('click',()=>{postCategory=value;renderPostFilters();renderPostList();});wrap.append(button);});wrap.hidden=posts.length===0;
  }
  function showPost(scroll=false) {
    if(!postsReady)return;
    const id=new URL(location.href).searchParams.get('post');const reader=root.querySelector('#kje-post-reader');const listing=root.querySelector('#kje-post-listing');
    if(!id){reader.hidden=true;listing.hidden=false;return;}
    const post=posts.find(item=>item.id===id);reader.replaceChildren();
    const back=node('a','kje-reader-back','← 글 목록으로');const url=new URL(location.href);url.searchParams.delete('post');url.hash='journal';back.href=url;
    back.addEventListener('click',event=>{if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();history.pushState(null,'',back.href);showPost();});reader.append(back);
    if(!post){reader.append(node('h2','','글을 찾을 수 없습니다.'),node('p','','글이 삭제되었거나 주소가 변경되었습니다.'));}
    else{
      reader.append(postMeta(post),node('h2','',post.title));
      const cover=safeURL(post.cover,true);if(cover){const img=node('img','kje-post-cover');img.src=cover;img.alt=text(post.cover_alt);reader.append(img);}
      const body=node('div','kje-rich-content');body.append(safeRichText(post.body));reader.append(body);
    }
    listing.hidden=true;reader.hidden=false;if(scroll)reader.scrollIntoView({block:'start'});
  }
  function applyHash() {
    const hash=location.hash.slice(1);
    if(hash.startsWith('projects-')&&own(categories,hash.slice(9))){selectCategory(hash.slice(9));document.getElementById('projects').scrollIntoView({block:'start'});}
    const old={works:'projects',career:'about'};if(own(old,hash))document.getElementById(old[hash]).scrollIntoView({block:'start'});
  }
  root.querySelectorAll('[data-category]').forEach(button=>button.addEventListener('click',()=>selectCategory(button.dataset.category,true)));
  root.addEventListener('click',event=>{const link=event.target.closest('a[data-select-category]');if(link)selectCategory(link.dataset.selectCategory);});
  window.addEventListener('hashchange',applyHash);window.addEventListener('popstate',()=>{applyHash();showPost();});
  selectCategory('lab');applyHash();
  async function read(path){const response=await fetch(path,{cache:'no-cache',credentials:'omit'});if(!response.ok)throw new Error('Content load failed');return response.json();}
  Promise.allSettled([
    read('content/site.json').then(applySite),
    read('content/projects.json').then(renderProjects),
    read('content/posts.json').then(data=>{posts=sortedPosts(data);showPostDates=data.show_dates!==false;postsReady=true;renderPostFilters();renderPostList();showPost(Boolean(new URL(location.href).searchParams.get('post')));}).catch(()=>{setText('#kje-post-empty','글을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.');})
  ]);
})();
