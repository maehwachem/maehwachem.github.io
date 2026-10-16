"""Deterministic, reviewable scientific cover diagrams. Coordinates are schematic."""
from pathlib import Path
from xml.sax.saxutils import escape
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/covers'; OUT.mkdir(exist_ok=True)
N='#17394c'; P='#f8f1df'; BLUE='#6fabc0'; RED='#c56d50'; GREEN='#7b9b83'; GOLD='#cfac60'
def text(x,y,s,size=23,anchor='start',fill=N,weight=500):return f'<text x="{x}" y="{y}" font-size="{size}" text-anchor="{anchor}" fill="{fill}" font-weight="{weight}">{escape(s)}</text>'
def path(d,color=N,w=4,extra=''):return f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round" {extra}/>'
def arrow(x1,y1,x2,y2,color=N,w=5):return path(f'M{x1} {y1} L{x2} {y2}',color,w,f'marker-end="url(#{"r" if color==RED else "b" if color==BLUE else "n"})"')
def rect(x,y,w,h,fill=P,stroke=N,rx=8):return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="3"/>'
def circle(x,y,r,fill=P,stroke=N):return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}" stroke="{stroke}" stroke-width="3"/>'
def beaker(x,y,w=160,h=190,color=None,frac=.6):
 s=''
 s+=rect(x+5,y+int(h*(1-frac)),w-10,int(h*frac)-5,color or '#efeee4','none',0)
 s+=path(f'M{x+5} {y+int(h*(1-frac))} H{x+w-5}',color or '#a3b4b3',2)
 s+=path(f'M{x-8} {y} H{x+w+8} M{x} {y} V{y+h-12} Q{x} {y+h} {x+12} {y+h} H{x+w-12} Q{x+w} {y+h} {x+w} {y+h-12} V{y}')
 for dy in [45,75,105,135]:
  if dy<h-10:s+=path(f'M{x+w-12} {y+dy} h-15',N,2)
 return s

def base(slug,title,subtitle,body):
 defs=''.join(f'<marker id="{id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="{c}"/></marker>' for id,c in [('n',N),('r',RED),('b',BLUE)])
 # Texture is confined to the paper. Lines, labels and arrows stay crisp.
 svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600" role="img" aria-labelledby="title desc"><title id="title">{escape(title)}</title><desc id="desc">{escape(subtitle)}</desc><defs>{defs}<filter id="paper"><feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="2" seed="8"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".035"/></feComponentTransfer><feBlend in="SourceGraphic" mode="multiply"/></filter></defs><g font-family="Noto Sans CJK KR, Noto Sans KR, sans-serif">{rect(0,0,900,600,P,'none',0)}<rect x="0" y="0" width="900" height="600" fill="{P}" filter="url(#paper)"/>{rect(17,17,866,566,'none',N,3)}{text(48,82,title,38,weight=700)}{text(49,121,subtitle,20,fill='#516570')}{path('M49 146 H145',RED,4)}{body}</g></svg>'''
 (OUT/f'{slug}-verified.svg').write_text(svg)
 return svg

# Latitude-height section: northward is to the right. Both horizontal branches and all vertical branches are explicit.
s=''
xs=[105,335,565,795]
for i,name in enumerate(['해들리 순환','페렐 순환','극 순환']):
 s+=rect(xs[i]+12,215,206,224,['#ece2c8','#e7ece3','#e1eced'][i],'none',25)+text((xs[i]+xs[i+1])/2,337,name,23,'middle')
 a,b=xs[i]+34,xs[i+1]-34
 if i in [0,2]:s+=arrow(a,251,b,251,RED)+arrow(b,410,a,410,BLUE)
 else:s+=arrow(b,251,a,251,BLUE)+arrow(a,410,b,410,RED)
for i,x in enumerate(xs):
 up=i in [0,2]
 s+=arrow(x,416 if up else 248,x,248 if up else 416,RED if up else BLUE)
 s+=text(x,199,'상승' if up else '하강',20,'middle')+text(x,490,['0°','약 30°N','약 60°N','90°N'][i],21,'middle')
s+=path('M73 449 H827',GREEN,7)+text(104,526,'적도',20,'middle')+text(795,526,'북극',20,'middle')+text(450,562,'북반구의 위도–높이 단면 · 이상화한 평균 순환',18,'middle')
base('circulation','대기 대순환','각 반구에 세 순환 · 지표와 상층의 흐름',s)

# SST anomalies, not absolute temperature. Geographic direction and legend explicitly defined.
s=''
for y,name,color in [(217,'엘니뇨',RED),(390,'라니냐',BLUE)]:
 s+=text(75,y+40,name,27,weight=700)+rect(240,y,580,110,'#e6ece5','none',18)
 s+=rect(450,y+20,340,70,color,'none',35)+text(620,y+64,'평년보다 '+('따뜻함' if name=='엘니뇨' else '차가움'),23,'middle',P,600)
 s+=path(f'M260 {y+24} l25 14 -13 34 20 17',GREEN,12)+path(f'M806 {y+15} l-18 24 9 43 -16 18',GREEN,12)
s+=text(270,187,'서태평양',20)+text(806,187,'동태평양',20,'end')+text(530,540,'적도 태평양 중·동부의 해수면 온도 편차 모식도',19,'middle')
base('el-nino','엘니뇨와 라니냐','평년과 비교한 적도 태평양의 해수면 온도',s)

# Daniell cell: copper / blue CuSO4; zinc / colorless ZnSO4. Salt bridge contacts both liquids.
s=beaker(120,325,210,185,BLUE)+beaker(570,325,210,185,None)
s+=rect(177,290,28,168,'#c58153',N,1)+rect(695,290,28,168,'#a5afb1',N,1)
s+=path('M285 438 V300 Q285 253 332 253 H568 Q615 253 615 300 V438','#a8b6ac',18)
s+=path('M191 290 V215 H383 M709 290 V215 H517',N,5)+rect(383,182,134,67,'#e3e9dd')+text(450,226,'V',30,'middle')
s+=text(245,284,'염다리',20)+text(225,550,'Cu / CuSO₄(aq)',23,'middle')+text(675,550,'Zn / ZnSO₄(aq)',23,'middle')
base('lab-redox','산화·환원 가상 실험실','구리–아연 전지 · 전극, 전해질, 염다리의 연결',s)

# Paper-cell workbench. Electrodes separated by wet paper, neither dry nor mutually shorted.
for slug,title in [('battery-team','배터리 시험팀'),('lab-battery','배터리 가상 시험동')]:
 s=rect(135,288,320,32,'#c58153',N,1)+rect(135,333,320,35,'#d8e4cf',N,1)+rect(135,381,320,32,'#acb5b5',N,1)
 s+=text(480,313,'전극 A',21)+text(480,359,'전해질을 머금은 거름종이',21)+text(480,407,'전극 B',21)
 s+=path('M155 288 V221 H624 V251',RED,5)+path('M155 413 V485 H739 V251',N,5)
 s+=rect(599,177,166,99,'#e1e8df')+text(681,225,'V',32,'middle')+circle(624,253,8,RED,RED)+circle(739,253,8,N,N)
 s+=text(450,542,'분리된 두 전극의 전위차 측정 · 층 구조를 벌려 표시한 모식도',18,'middle')
 base(slug,title,'전극과 젖은 거름종이로 구성한 종이 전지',s)

# Burette with graduated tube, clamp, actual stopcock and tip; stand behind, not through title.
s=path('M623 190 V523 M535 530 H716',N,8)+path('M448 221 H623',N,5)
s+=rect(435,177,25,234,'#d5e8eb',N,0)
for y in range(194,392,19):s+=path(f'M449 {y} h10',N,2)
s+=path('M448 411 V427 M429 421 H472',N,5)+circle(448,421,6,P,N)+path('M448 430 V449',N,3)
s+=f'<path d="M448 461 Q434 479 448 484 Q462 479 448 461" fill="{BLUE}"/>'
s+=path('M417 483 V501 L367 548 Q364 558 378 558 H518 Q530 558 526 548 L478 501 V483 M417 483 H478',N,4)
s+=f'<path d="M398 524 H497 L519 551 H377Z" fill="#e8b3bc"/>'+text(510,433,'콕',20)+text(488,210,'뷰렛',21)
base('lab-acid-base','산·염기 가상 실험실','뷰렛의 콕으로 적정액을 조금씩 떨어뜨리기',s)

# Two valid measurement traces; no unsupported faster/slower comparison.
s=path('M115 462 H760 M115 462 V211',N,4)+text(75,218,'부피',22)+text(748,500,'시간',22)
s+=path('M118 460 C190 345 258 288 338 263 S508 240 739 240',RED,7)
s+=path('M118 460 C240 410 353 340 466 295 S628 251 739 243',BLUE,7)
s+=text(570,208,'같은 최종 부피',21)+text(450,547,'기체 발생량의 시간 변화 · 수치 없는 개념 그래프',19,'middle')
base('lab-kinetics','반응 속도 가상 실험실','반응의 빠르기는 시간에 따른 변화로 비교',s)

# Insulated calorimeter: no fictitious external heat-loss arrows.
s=rect(258,276,306,32,'#dce2d2',N,9)+path('M278 308 L309 512 Q310 524 327 524 H495 Q510 524 513 512 L543 308',N,5)
s+=f'<path d="M302 336 L329 501 H492 L518 336Z" fill="#b9d7dc"/>'+path('M283 316 L313 509 M535 316 L507 509',GOLD,9)
s+=rect(376,187,17,241,'#edf0e6',N,8)+path('M384 236 V419',RED,5)+circle(384,427,10,RED,RED)
s+=path('M461 232 V453',N,5)+text(414,202,'온도계',22)+text(486,251,'젓개',21)+text(578,393,'단열 용기',22)+text(578,426,'뚜껑',22)+path('M564 417 L528 298',N,2)
s+=text(450,558,'수용액의 온도 변화로 출입한 열을 추정',20,'middle')
base('lab-thermochem','열화학 가상 실험실','간이 열량계 · 열손실을 줄이고 온도 변화를 측정',s)

# Colorless strong acid / base; no implication that acid is red and base blue.
s=beaker(85,293,155,190,None,.3)+beaker(330,293,155,190,None,.3)+beaker(615,293,155,190,None,.6)
s+=text(162,251,'HCl(aq)',25,'middle')+text(407,251,'NaOH(aq)',25,'middle')+text(692,251,'혼합 용액',24,'middle')
s+=text(286,393,'+',44,'middle')+arrow(514,385,579,385)
s+=text(450,538,'H⁺ + OH⁻ → H₂O',30,'middle')+text(450,570,'무색의 산·염기 수용액을 예로 든 모식도',17,'middle')
base('neutralization','산·염기 중화 반응','수소 이온과 수산화 이온의 반응',s)

# Two boards, exactly 25 LEDs and five large pin rings. V1 front schematic.
def board(x,y):
 s=rect(x,y,290,210,N,N,18)+rect(x+120,y-13,50,23,'#c4ceca',N,3)
 for row in range(5):
  for col in range(5):s+=rect(x+95+col*23,y+36+row*23,10,12,RED,'none',2)
 for bx in [x+27,x+239]:s+=rect(bx,y+67,25,25,'#b4c0bd',P,2)
 for i,label in enumerate(['0','1','2','3V','GND']):
  xx=x+29+i*58;s+=circle(xx,y+182,17,GOLD,GOLD)+circle(xx,y+182,8,N,N)+text(xx,y+159,label,13,'middle',P)
 return s
for slug,title in [('microbit-start','마이크로비트 처음 시작하기'),('sensor-recorder','마이크로비트 센서 기록기')]:
 s=board(110,264)+rect(514,233,260,212,'#d3ddd4')+rect(533,253,222,161,P,N,3)+path('M493 458 H795',N,9)
 if slug=='microbit-start':
  s+=path('M255 251 V209 H466 Q487 209 487 230 V331 Q487 354 514 354',N,7)
  s+=text(644,318,'첫 연결',27,'middle')+text(644,360,'USB',24,'middle')+text(450,537,'보드 앞면 모식도 · 5 × 5 LED와 두 버튼',19,'middle')
 else:
  s+=path('M550 386 V279 M550 386 H735',N,3)+path('M555 365 L581 351 607 356 633 321 659 330 685 295 716 305',RED,4)
  s+=path('M414 301 Q460 265 499 301 M431 319 Q460 294 482 319',BLUE,4)
  s+=text(458,356,'무선',19,'middle')+text(644,488,'시간에 따른 기록',20,'middle')+text(450,540,'웹 블루투스로 전송 · 측정값 그래프는 개념 예시',18,'middle')
 base(slug,title,'실제 보드 구조를 단순화한 마이크로비트 그림',s)

# Whole Earth-system energy budget. All three fluxes cross the same top-of-atmosphere boundary.
s=circle(462,430,111,BLUE,N)+circle(462,430,129,'none','#b6c7bf')
s+=f'<path d="M390 365 L421 341 449 357 439 388 468 410 448 442 414 430 405 400 383 389Z M484 451 L517 438 542 459 537 496 511 526 488 501Z" fill="{GREEN}"/>'
s+=circle(121,224,34,GOLD,'none')
for dx,dy in [(0,-49),(0,49),(-49,0),(49,0),(-35,-35),(35,-35)]:s+=path(f'M{121+dx*.85} {224+dy*.85} l{dx*.3} {dy*.3}',GOLD,3)
s+=arrow(225,221,345,364,N,8)+text(194,190,'태양 복사 100',24)
s+=arrow(383,330,431,199,N,6)+text(439,203,'반사 30',25)
s+=arrow(560,345,685,202,RED,8)+text(682,190,'복사 70',25,'middle',RED)
s+=text(690,230,'우주로 방출',19,'middle')+text(462,440,'지구',28,'middle',P,700)
s+=text(462,480,'지표 + 대기',19,'middle',P)+text(452,569,'지구 전체의 평균 열수지 · 100 = 30 + 70',21,'middle')
base('heat-budget','지구의 열수지','들어오는 에너지와 나가는 에너지의 균형',s)

if __name__=='__main__':print(f'Built {len(list(OUT.glob("*-verified.svg")))} reviewable SVG covers')
