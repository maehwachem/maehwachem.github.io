const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../note.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const part=(from,to)=>{const i=source.indexOf(from);return i<0?'':source.slice(i,source.indexOf(to,i));};
const clone=v=>JSON.parse(JSON.stringify(v));
function setup(){const c={width:760,height:1010,paperTypes:['plain'],clamp:(v,a,b)=>Math.max(a,Math.min(v,b))};vm.createContext(c);vm.runInContext(part('function validDate(','let lastStored'),c);return c;}
const tape=()=>({id:'tape-a',x:40,y:60,width:160,height:40,color:'#5143a4'});
const data=()=>({active:'n',notes:[{id:'n',title:'study',folder:'personal',created:1,updated:2,active:'p',pages:[{id:'p',type:'plain',strokes:[],texts:[],tapes:[tape()]}]}]});
test('tape validation accepts legacy pages but rejects invalid geometry, IDs and oversized lists',()=>{
 const c=setup();const legacy=data();delete legacy.notes[0].pages[0].tapes;assert.doesNotThrow(()=>c.parseState(legacy));assert.doesNotThrow(()=>c.parseState(data()));
 for(const props of [{x:-1},{width:0},{x:750,width:50},{height:Infinity},{color:'red'},{id:'p'}]){const bad=data();Object.assign(bad.notes[0].pages[0].tapes[0],props);assert.throws(()=>c.parseState(bad));}
 const bad=data();bad.notes[0].pages[0].tapes=Array.from({length:301},(_,i)=>({...tape(),id:'t'+i}));assert.throws(()=>c.parseState(bad));
});
test('tape creation and moving/resizing clamp to paper without changing saved originals',()=>{
 const c=setup();assert.equal(typeof c.tapeFromPoints,'function');const a=c.tapeFromPoints([900,1100],[730,980],'#5143a4');assert.equal(a.x,730);assert.equal(a.width,30);assert.equal(a.y,980);assert.equal(a.height,30);
 assert.equal(c.tapeFromPoints([10,10],[12,12],'#5143a4'),null);const old=tape();const moved=c.transformTape(old,900,1000,'move');assert.equal(moved.x,600);assert.equal(moved.y,970);assert.equal(old.x,40);
 const sized=c.transformTape(old,900,-100,'resize');assert.equal(sized.width,720);assert.equal(sized.height,8);
});
test('tapes have a stable reading order and backup identity excludes regenerated tape IDs',()=>{
 const c=setup();assert.equal(typeof c.orderedTapes,'function');const p={tapes:[{...tape(),id:'c',x:200,y:60},{...tape(),id:'b',x:20,y:60},{...tape(),id:'a',y:10}]};assert.deepEqual(Array.from(c.orderedTapes(p),t=>t.id),['a','b','c']);
 vm.runInContext(part('function restoredContent(','async function equalAssetBytes('),c);const a=data().notes[0],b=clone(a);b.pages[0].tapes[0].id='restored';assert.equal(c.restoredContent(a),c.restoredContent(b));b.pages[0].tapes[0].width=100;assert.notEqual(c.restoredContent(a),c.restoredContent(b));
});
test('page copying regenerates tape IDs and history snapshots preserve tape edits',()=>{
 const c=setup();let i=0;c.id=()=>`copy-${++i}`;vm.runInContext(part('function duplicatePageData(','async function copyPageToNote(')+part('function snapshot(','function pageHistory('),c);
 const p=data().notes[0].pages[0],copy=c.duplicatePageData(p);assert.notEqual(copy.tapes[0].id,p.tapes[0].id);copy.tapes[0].x=80;assert.equal(p.tapes[0].x,40);
 const before=c.snapshot(p);p.tapes=[];Object.assign(p,before);assert.equal(p.tapes[0].id,'tape-a');
});
test('recent colors are normalized, deduplicated and bounded; named favorites survive validation',()=>{
 const c=setup();const p=c.parseToolPreferences({recentColors:['#ABCDEF','#abcdef','bad','#123456'],favorites:[{tool:'pen',color:'#123456',size:3,name:'  풀이용  '}]});assert.deepEqual(Array.from(p.recentColors),['#abcdef','#123456']);assert.equal(p.favorites[0].name,'풀이용');
 assert.equal(typeof c.rememberRecentColor,'function');c.rememberRecentColor(p,'#fedcba');c.rememberRecentColor(p,'#abcdef');assert.equal(p.recentColors[0],'#abcdef');for(let i=0;i<10;i++)c.rememberRecentColor(p,'#00000'+i);assert.equal(p.recentColors.length,6);
});
test('worksheet compositor paints opaque tapes after ink and text; answer export leaves them out',()=>{
 const c=setup();const calls=[];const ctx={scale(){},drawImage(){calls.push('ink');},fillRect(...v){calls.push({color:this.fillStyle,v});},fillText(){calls.push('text');},measureText(){return {width:10};}};
 Object.assign(c,{document:{createElement:()=>({getContext:()=>ctx})},paintInk(){},configureTextContext:()=>({}),textLineLayout:()=>[{text:'answer',x:40,y:70}],currentPage:()=>data().notes[0].pages[0]});
 vm.runInContext(part('function compositePage(','async function pageImage('),c);const p=data().notes[0].pages[0];p.texts=[{color:'#000000',size:20}];
 c.compositePage(p,1,null,'worksheet');assert.equal(calls.at(-1).color,'#5143a4');assert.deepEqual(calls.at(-1).v,[40,60,160,40]);calls.length=0;c.compositePage(p,1,null,'answers');assert.equal(calls.some(v=>v.color==='#5143a4'),false);
});
test('only the explicit answer tool can reveal a tape and reveal never edits notebook data',()=>{
 const c=setup();const p=data().notes[0].pages[0];let writes=0;Object.assign(c,{document:{activeElement:null},practiceMode:true,tool:'pen',revealedTapes:new Set(),currentPage:()=>p,renderTapes(){},renderStudyUI(){},updateNote(){writes++;}});
 vm.runInContext(part('function toggleTapeReveal(','function nextTapeAnswer('),c);assert.equal(typeof c.toggleTapeReveal,'function');
 c.toggleTapeReveal('tape-a');assert.equal(c.revealedTapes.size,0);c.tool='reveal';c.toggleTapeReveal('tape-a');assert.equal(c.revealedTapes.has('tape-a'),true);c.toggleTapeReveal('missing');assert.equal(c.revealedTapes.size,1);assert.equal(writes,0);
});
test('keyboard answer toggling retains focus on the replaced tape button',()=>{
 const c=setup();let focused=0;const button={dataset:{tape:'tape-a'},focus(){focused++;}};
 Object.assign(c,{document:{activeElement:button},practiceMode:true,tool:'reveal',revealedTapes:new Set(),currentPage:()=>data().notes[0].pages[0],
  $:()=>({children:[button]}),renderTapes(){},renderStudyUI(){}});
 vm.runInContext(part('function toggleTapeReveal(','function nextTapeAnswer('),c);c.toggleTapeReveal('tape-a');assert.equal(focused,1);
});
test('a new page clears ephemeral answers and selections while a render of the same page preserves answers',()=>{
 const c=setup();Object.assign(c,{practicePage:'n/p',currentNote:()=>({id:'n'}),currentPage:()=>({id:'p'}),revealedTapes:new Set(['a']),selectedTape:'a',practiceUndo:new Set([{}]),practiceRedo:new Set(),tapeDrag:null,finishTapeGesture(){}});
 vm.runInContext(part('function syncStudyPage(','function renderStudyUI('),c);assert.equal(typeof c.syncStudyPage,'function');c.syncStudyPage();assert.equal(c.revealedTapes.size,1);
 c.currentPage=()=>({id:'q'});c.syncStudyPage();assert.equal(c.revealedTapes.size,0);assert.equal(c.selectedTape,null);assert.equal(c.practiceUndo.size,0);
});
test('practice undo cannot cross into original edits while current practice ink remains undoable',()=>{
 const c=setup();const p=data().notes[0].pages[0],old={type:'plain',strokes:['original'],texts:[],tapes:[]};p.strokes=['original'];
 Object.assign(c,{practiceMode:true,practiceUndo:new Set(),practiceRedo:new Set(),histories:new Map([['p',{undo:[old],redo:[]}]]),currentPage:()=>p,
  active:null,drag:null,lasso:null,tapeDrag:null,selected:null,updateNote(){},renderPage(){},$:()=>({})});
 vm.runInContext(part('function snapshot(','function line('),c);c.undoRedo('undo','redo');assert.equal(p.tapes.length,1);assert.equal(p.strokes[0],'original');
 const before=c.snapshot(p);p.strokes=['original','practice'];c.record(before);c.undoRedo('undo','redo');assert.equal(p.strokes.length,1);assert.equal(p.tapes.length,1);
 c.undoRedo('undo','redo');assert.equal(p.tapes.length,1);c.undoRedo('redo','undo');assert.equal(p.strokes.length,2);assert.equal(p.tapes[0].id,'tape-a');
});
test('canceling a tape transform changes no data and a committed transform records only one edit',()=>{
 const c=setup();const p=data().notes[0].pages[0];let writes=0;
 Object.assign(c,{practicePage:'n/p',tapeDrag:{context:'n/p',mode:'move',id:'tape-a',moved:true,preview:{...tape(),x:80}},practiceMode:false,
 currentPage:()=>p,renderTapes(){},renderStudyUI(){},changePage(update){writes++;Object.assign(p,update);},toast(){}});
 vm.runInContext(part('function finishTapeGesture(','function openTapeEditor('),c);c.finishTapeGesture(false);assert.equal(p.tapes[0].x,40);assert.equal(writes,0);
 c.tapeDrag={context:'n/p',mode:'move',id:'tape-a',moved:true,preview:{...tape(),x:80}};c.finishTapeGesture(true);assert.equal(p.tapes[0].x,80);assert.equal(writes,1);
});
test('conflicting backup restores regenerate tape IDs and repeating the same restore is idempotent',async()=>{
 const c=setup();let n=0;Object.assign(c,{id:()=>`restored-${++n}`,titleOf:note=>note.title,checkFileCancellation(){}});
 vm.runInContext(part('function restoredContent(','function snapshotForBackup('),c);
 const incoming=data().notes[0],existing=clone(incoming);existing.title='edited original';
 const first=await c.planBackupRestore([incoming],new Map(),[existing],()=>{},new AbortController().signal);
 assert.equal(first.imported.length,1);assert.notEqual(first.imported[0].pages[0].tapes[0].id,'tape-a');assert.equal(first.imported[0].pages[0].tapes[0].width,160);
 const second=await c.planBackupRestore([incoming],new Map(),[existing,...first.imported],()=>{},new AbortController().signal);assert.equal(second.imported.length,0);
});
test('length and thickness handles resize one axis without moving or rounding the original tape',()=>{
 const c=setup(),old={...tape(),x:7.889471,width:105.12295,height:156.48394};
 const horizontal=c.transformTape(old,30,100,'resize-x');assert.equal(horizontal.width,old.width+30);assert.equal(horizontal.height,old.height);assert.equal(horizontal.x,old.x);
 const vertical=c.transformTape(old,100,-20,'resize-y');assert.equal(vertical.width,old.width);assert.equal(vertical.height,old.height-20);
 assert.equal(old.width,105.12295);
});
test('appearance controls preserve exact position and untouched dimensions while clamping slider edits',()=>{
 const c=setup();assert.equal(typeof c.tapeAppearance,'function');const old={...tape(),x:7.889471,y:543.113,width:105.12295,height:156.48394};
 const color=c.tapeAppearance(old,{color:'#377058',x:600});assert.equal(color.x,old.x);assert.equal(color.y,old.y);assert.equal(color.width,old.width);assert.equal(color.height,old.height);
 const large=c.tapeAppearance(old,{width:9999,height:9999});assert.equal(large.width,760-old.x);assert.equal(large.height,1010-old.y);assert.equal(old.color,'#5143a4');
});
test('nearby tape actions remain inside the visible paper at edges and after zooming',()=>{
 const c=setup();assert.equal(typeof c.tapeMenuPosition,'function');
 for(const view of [{left:0,top:0,right:760,bottom:1010},{left:90,top:350,right:730,bottom:600}]){
   const size={width:Math.min(320,view.right-view.left),height:68};
   const at=c.tapeMenuPosition({...tape(),x:700,y:590},size,view,6);assert.ok(at.left>=view.left);assert.ok(at.left+size.width<=view.right);assert.ok(at.top>=view.top);assert.ok(at.top+size.height<=view.bottom);
 }
});
test('visual editor applies a draft once without changing coordinates and rejects stale or canceled edits',()=>{
 const c=setup(),p=data().notes[0].pages[0];p.tapes[0].x=7.889471;p.tapes[0].width=105.12295;const old=p.tapes[0];let writes=0;
 Object.assign(c,{practiceMode:false,tapeTarget:{note:'n',page:'p',id:old.id,original:JSON.stringify(old)},tapeDraft:{...old,color:'#377058'},
 currentNote:()=>({id:'n'}),currentPage:()=>p,changePage(update){writes++;Object.assign(p,update);},toast(){}});
 vm.runInContext(part('function applyTapeAppearance(','function removeSelectedTape('),c);assert.equal(typeof c.applyTapeAppearance,'function');
 assert.equal(c.applyTapeAppearance(),true);assert.equal(writes,1);assert.equal(p.tapes[0].x,7.889471);assert.equal(p.tapes[0].width,105.12295);assert.equal(old.color,'#5143a4');
 assert.equal(c.applyTapeAppearance(),false);assert.equal(writes,1);c.tapeDraft=null;assert.equal(c.applyTapeAppearance(),false);
});
test('thin tape grips sit outside the movable body and flip sides near paper edges',()=>{
 const c=setup();assert.equal(typeof c.tapeGripPositions,'function');const tape={x:100,y:100,width:160,height:26};const a=c.tapeGripPositions(tape,36,6);
 assert.ok(a.x.left>=tape.x+tape.width);assert.ok(a.y.top>=tape.y+tape.height);
 const edge={x:600,y:984,width:160,height:26};const b=c.tapeGripPositions(edge,36,6);assert.ok(b.x.left+36<=edge.x);assert.ok(b.y.top+36<=edge.y);
});
