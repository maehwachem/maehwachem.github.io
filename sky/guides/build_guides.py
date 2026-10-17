"""Build KJE LAB's original equipment drawings and the guide data (standard library only).
No traced photographs, manufacturer artwork, external fonts or network dependencies.
Coordinates describe explanatory schematics, not model-specific dimensions.
Run from any directory: python sky/guides/build_guides.py
"""
from pathlib import Path
from html import escape
import json

HERE = Path(__file__).resolve().parent
INK, PAPER, MINT, WHITE, ORANGE, GOLD, MUTED = '#294653', '#f7f4eb', '#d8e7df', '#fffef8', '#b95732', '#efc16e', '#6b7e80'

def path(d, fill='none', stroke=INK, width=3, extra=''):
    return f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{width}" {extra}/>'
def rect(x,y,w,h,fill=WHITE,r=8,stroke=INK,width=3,extra=''):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{width}" {extra}/>'
def circle(x,y,r,fill=WHITE,stroke=INK,width=3,extra=''):
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{width}" {extra}/>'
def ellipse(x,y,rx,ry,fill=MINT,stroke='none',width=3,extra=''):
    return f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{fill}" stroke="{stroke}" stroke-width="{width}" {extra}/>'
def text(x,y,value,size=24,fill=INK,anchor='middle',weight=500):
    return f'<text x="{x}" y="{y}" fill="{fill}" font-size="{size}" text-anchor="{anchor}" font-weight="{weight}">{escape(value)}</text>'
def group(s,x=0,y=0,scale=1,rotate=0):
    return f'<g transform="translate({x} {y}) scale({scale}) rotate({rotate})">{s}</g>'
def arrow(d, color=ORANGE):
    return path(d,stroke=color,width=3,extra='marker-end="url(#arrow)"')
def leader(d):
    return path(d,stroke=MUTED,width=2,extra='stroke-dasharray="4 5"')
def label(x,y,value,side='middle'):
    return text(x,y,value,24,INK,side,600)
def badge(x,y,value,w=120):
    return rect(x-w/2,y-24,w,36,MINT,18,'none')+text(x,y,value,20,INK)
def check(x,y):
    return circle(x,y,15,MINT,'none')+path(f'M{x-7} {y}l5 5 10-11',stroke='#3d6c5a',width=3)
def star(x,y,r=5,color=INK):
    return path(f'M{x-r} {y}h{r*2}M{x} {y-r}v{r*2}',stroke=color,width=2)
def ground():
    return ellipse(320,350,196,13,MINT)+path('M60 364H580',stroke='#d3dbd3',width=2)
def tripod(x=320,y=230,scale=1,highlight=False):
    color=ORANGE if highlight else INK
    s=path('M0 0L-90 120M0 0L90 120M0 0V126',stroke=color,width=7)
    s+=path('M-50 66H50M-50 66L0 87 50 66',stroke=INK,width=3)
    for a,b in [(-57,76),(57,76),(0,82)]:s+=rect(a-8,b-4,16,13,MINT,3,INK,2)
    s+=rect(-25,-15,50,23,MINT,7)+path('M-98 122h17M82 122h17M-8 128h16',width=4)
    return group(s,x,y,scale)
def mount(x=320,y=200,scale=1):
    return group(path('M-22 30V-12H22V7H5V30Z',MINT)+circle(1,1,13,WHITE)+rect(-25,-25,50,13,INK,4)+path('M12 5L58 27',width=5)+circle(61,29,6,INK),x,y,scale)
def tube(x=300,y=140,scale=1,accessories=False,cap=True):
    s=rect(-132,-27,246,54,WHITE,12)+rect(-143,-34,36,68,MINT,5)
    s+=ellipse(-142,0,8,28,MINT if cap else '#8baeb9',INK)
    s+=rect(-12,-30,25,60,MINT,3)+path('M-2 31V43H45V31',MINT)
    s+=rect(114,-13,32,26,MINT,2)+circle(116,28,10,INK)+path('M116 28h23',width=4)
    if accessories:
        s+=path('M145-8h33v-27h18v45h-51Z',MINT)+rect(174,-63,26,30,WHITE,3)
        s+=path('M-24-27v-22M18-27v-22')+rect(-48,-65,83,20,MINT,4)+ellipse(-48,-55,4,10,'#8baeb9',INK,2)
    return group(s,x,y,scale)
def hand(x,y,flip=False):
    s=path('M-26 30L-21 11Q-22 0-13 2L1 10 27-1Q37-1 33 7L9 23 5 39', '#e4c4a3',INK,2.5)
    s+=path('M-9 7L4 15M-13 13l12 10',stroke='#9e795e',width=2)
    return f'<g transform="translate({x} {y}) scale({-1 if flip else 1} 1)">{s}</g>'
def eyepiece(x,y,scale=1,value='25'):
    s=rect(-23,-37,46,60,WHITE,5)+rect(-18,23,36,32,MINT,2)+rect(-26,-44,52,14,INK,4)
    return group(s+text(0,-1,value,20),x,y,scale)
def antenna(x,y,scale=1):
    return group(path('M0 38V-34M-30-23H30M-22-8H22M-13 7H13',width=3),x,y,scale)
def lamp(x,y,scale=1):
    return group(path('M0 40V-8Q0-30 24-30M12-25H37',width=3),x,y,scale)
def field(x,y,r=92,target='antenna',offset=(0,0),cross=False,active=False):
    s=circle(x,y,r,WHITE,ORANGE if active else INK,4)+path(f'M{x-r+10} {y+40}Q{x} {y+24} {x+r-10} {y+40}',stroke='#d0ded4',width=2)
    s+=(antenna if target=='antenna' else lamp)(x+offset[0],y+offset[1],.85)
    if cross:s+=path(f'M{x-r+9} {y}H{x-12}M{x+12} {y}H{x+r-9}M{x} {y-r+9}V{y-12}M{x} {y+12}V{y+r-9}',stroke=ORANGE,width=2)+circle(x,y,7,'none',ORANGE,2)
    return s

def bino_front(x=320,y=185,scale=1):
    s=path('M-101-49L-122 30Q-126 72-79 75H-39Q-4 71-14 31L-30-46Z',MINT)
    s+=path('M101-49L122 30Q126 72 79 75H39Q4 71 14 31L30-46Z',MINT)
    for q in [-67,67]:
        s+=rect(q-27,-79,54,37,INK,6)+ellipse(q,30,46,47,'#9dbac3',INK)+ellipse(q,30,30,32,'#cfdfdf','none')
    s+=rect(-34,-34,68,22,WHITE,6)+circle(0,-22,9,MINT)+path('M0-13V33',width=6)+circle(0,34,10,WHITE)
    return group(s,x,y,scale)
def bino_top(cap=None,focus=False,diopter=False,cups=False):
    s=''
    for side,x in [('left',232),('right',408)]:
        s+=path(f'M{x-40} 112L{x-33} 246Q{x} 265 {x+33} 246L{x+40} 112Z',MINT)
        s+=rect(x-45,87,90,31,ORANGE if cap==side else '#8baeb9',6,ORANGE if cap==side else INK)
        if cap==side:s+=path(f'M{x-29} 97H{x+29}M{x-29} 106H{x+29}',stroke='#f7e2ce',width=2)
        s+=rect(x-28,244,56,18,GOLD if diopter and side=='right' else WHITE,3,ORANGE if diopter and side=='right' else INK)
        s+=rect(x-27,262,54,28,WHITE,5)+rect(x-30,282,60,14,ORANGE if cups else INK,4)
        s+=path(f'M{x-13} 322Q{x} 310 {x+13} 322',stroke=MUTED,width=2)
    s+=path('M265 185H375M265 215H375',width=7)+rect(303,166,34,64,GOLD if focus else WHITE,6,ORANGE if focus else INK)
    for y in [178,190,202,214]:s+=path(f'M310 {y}H330',stroke=ORANGE if focus else INK,width=2)
    return s

def smart(x=250,y=190,scale=1):
    s=rect(-57,-70,114,107,WHITE,20)+path('M-58-10L-58-64Q-55-86-34-83L36-57Q53-52 52-31V-8Z',MINT)
    s+=ellipse(-30,-48,27,18,'#86a6b3',INK)+ellipse(-30,-48,16,10,'#c9dfe4','none')
    s+=rect(-43,32,86,28,INK,10)+circle(24,12,5,MINT,'none')+path('M-42 60L-75 145M42 60L75 145M0 60V151',width=6)
    return group(s,x,y,scale)
def phone(x=460,y=200,scale=1,content='',landscape=False):
    if landscape:
        s=rect(-140,-85,280,170,INK,18)+rect(-126,-73,244,146,'#e8eeea',7,'none')+circle(129,0,5,MINT,'none')+content
    else:
        s=rect(-65,-116,130,232,INK,18)+rect(-55,-102,110,199,'#e8eeea',8,'none')+rect(-15,-109,30,5,MINT,2,'none')+path('M-17 105h34',stroke=MINT,width=3)+content
    return group(s,x,y,scale)
def sky_dots(x=0,y=0,color=INK):
    return ''.join(star(x+a,y+b,r,color) for a,b,r in [(-31,-47,4),(24,-60,3),(38,4,3),(-26,42,3),(12,31,4),(4,-20,3)])
def moon(x,y,r=50,detail=True):
    s=circle(x,y,r,'#efd9a5','none')
    if detail:
        for a,b,q in [(-.3,-.25,.18),(.24,.28,.16),(-.2,.38,.09),(.4,-.3,.11)]:s+=circle(x+a*r,y+b*r,q*r,'#cfb779','none')
    return s

GUIDES=[]
def add(key,id,title,kicker,note,steps):
    GUIDES.append(dict(key=key,id=id,title=title,kicker=kicker,note=note,steps=steps))
def step(short,title,body,alt,art,tip=''):
    return dict(short=short,title=title,body=body,alt=alt,art=art,tip=tip)

assembly=[]
assembly.append(step('부품','부품을 나눠 놓아요','삼각대·가대·경통·파인더·접안렌즈를 확인해요. 조립 중에는 렌즈 덮개를 닫고 유리 면에 손을 대지 않아요.','위에 경통, 가운데 가대, 아래 삼각대가 분리되어 있고 옆에 접안렌즈가 놓인 그림.', ground()+tripod(275,239,.8)+mount(275,170,.9)+tube(270,79,.75)+eyepiece(498,240,.8)+leader('M275 125V140M275 200V219')+label(74,87,'경통')+leader('M103 82H153')+label(118,180,'가대')+leader('M150 174H242')+label(112,310,'삼각대')+label(495,320,'접안렌즈')+rect(450,82,80,20,MINT,4)+path('M467 102v17M510 102v17')+label(490,155,'파인더')))
assembly.append(step('삼각대','다리를 펼치고 잠가요','단단하고 평평한 바닥에서 다리를 벌려요. 높이를 맞춘 뒤 다리 잠금과 벌림대·받침대의 고정을 확인해요.','삼각대의 세 다리와 잠금부가 강조되어 있고 양옆 화살표가 다리를 펼치는 방향을 가리킨다.', ground()+tripod(320,165,1.35,True)+arrow('M224 226Q190 240 174 275')+arrow('M416 226Q450 240 466 275')+label(320,83,'펼치고, 잠그기')+label(112,188,'다리 잠금')+leader('M150 201L242 266')+label(520,326,'벌림대')+leader('M482 311L350 267')))
assembly.append(step('가대','가대를 삼각대에 고정해요','가대를 정해진 방향으로 놓고 지정된 연결 볼트로 고정해요. 일체형은 체결 상태를 확인하면 돼요.','삼각대 위로 가대가 내려오는 화살표와 아래에서 조이는 연결 볼트의 확대 표시.', ground()+tripod(320,229,1)+mount(320,115,1.2)+arrow('M320 165V200')+rect(311,252,18,24,GOLD,3,ORANGE)+path('M296 279h48',stroke=ORANGE,width=5)+label(157,106,'가대')+leader('M192 102H281')+label(496,248,'연결 볼트')+leader('M440 252L337 270'),'적도의는 경통을 올리기 전에 무게추 설치 순서를 확인해요.'))
assembly.append(step('경통','경통을 받친 채 잠가요','두 손으로 경통을 받치고 레일이나 경통 밴드를 가대에 결합해요. 고정·안전 나사를 확인한 뒤 천천히 손의 힘을 줄여요.','두 손으로 경통 아래를 받치고, 중앙 장착 레일을 가대에 결합하는 그림.', ground()+tripod()+mount(320,200)+tube(320,144,1)+hand(225,169)+hand(423,169,True)+arrow('M313 188V203')+label(320,70,'두 손으로 받쳐요')+circle(350,209,10,GOLD,ORANGE)+label(515,278,'고정 확인')+leader('M462 260L362 214'),'파인더나 초점 손잡이를 잡고 경통을 들어 올리지 않아요.'))
assembly.append(step('접안부','파인더와 접안부를 연결해요','지정된 받침에 파인더를 고정해요. 굴절망원경은 보통 천정미러와 긴 초점거리 접안렌즈를 연결해 시작해요.','경통 위에 파인더, 뒤쪽 천정미러 위에 25밀리미터 접안렌즈를 끼우는 화살표.', ground()+tripod(280,235,.9)+mount(280,204,.9)+tube(270,173,.88)+rect(210,70,86,22,MINT,4)+path('M230 92v23M274 92v23')+arrow('M252 117V144')+path('M399 167h49v-29h22v49h-71Z',MINT)+eyepiece(459,70,.65)+arrow('M459 110V129')+label(251,49,'파인더')+label(475,30,'접안렌즈')+label(487,242,'천정미러')+leader('M476 224L458 185'),'그림은 굴절망원경 예시예요. 뉴턴식은 보통 옆 초점부에 접안렌즈를 직접 끼워요.'))
assembly.append(step('점검','움직임과 균형을 확인해요','관측할 부속품을 끼운 상태로 경통을 받치며 천천히 움직여요. 기울어짐·충돌·케이블 걸림을 확인해요.','완성된 경위대 망원경에서 위아래와 좌우 방향이 화살표로 표시되어 있다.', ground()+tripod()+mount(320,200)+tube(318,150,.9,True)+arrow('M116 127Q92 168 119 209')+arrow('M235 291Q320 321 399 291')+check(470,89)+label(103,240,'위아래')+label(464,306,'좌우')+label(320,52,'관측 준비 완료'),'전동형은 잠긴 축을 억지로 밀지 않아요. 기종별 잠금·균형 절차를 따라요.'))
assembly[2]['tip']='가대와 삼각대의 결합을 확인하기 전에는 경통을 올리지 않아요.'
add('telescope-assembly','scope-video-assembly','경위대 설치 · 준비부터 점검까지','망원경 설치 · 무게추 없는 경위대','일반적인 수동 경위대와 굴절망원경을 단순화한 그림이에요. 실제 연결 방식은 기종 설명서로 확인하세요.',assembly)

finder=[]
finder.append(step('낮은 배율','긴 초점거리부터 시작해요','25 mm와 10 mm가 있다면 25 mm부터 끼워요. 낮은 배율의 넓은 시야에서 먼 고정 표적을 찾기 쉬워요.','25밀리미터 접안렌즈가 강조되고 10밀리미터 접안렌즈와 비교되어 있다.',ellipse(320,330,215,15,MINT)+eyepiece(220,203,1.8,'25')+eyepiece(450,219,1.25,'10')+badge(220,90,'먼저 사용',132)+label(220,355,'25 mm')+label(450,355,'10 mm')+check(292,139),'낮 연습은 태양과 충분히 떨어진 방향의 지상 표적으로 해요.'))
finder.append(step('본망원경','본망원경 중앙에 먼저 놓아요','본망원경으로 표적을 찾아 초점을 맞추고 시야 가운데 놓아요. 이때 파인더의 중심과는 어긋나 있어도 괜찮아요.','본망원경의 안테나는 중앙에, 파인더의 안테나는 십자선에서 벗어나 있다.',field(183,206,100,active=True)+field(462,206,79,offset=(-26,-21),cross=True)+label(183,65,'먼저 본망원경')+label(462,65,'파인더는 아직')+label(183,345,'표적을 중앙에')+label(462,345,'어긋나 있어요')))
finder.append(step('파인더','경통은 그대로, 파인더만 조절해요','경통을 움직이지 않아요. 파인더의 조절 나사로 십자선이나 붉은 점을 같은 표적에 맞춰요.','본망원경의 표적은 고정되어 있고 파인더 십자선도 같은 표적 중앙에 맞춰져 있다.',field(183,206,100)+field(462,206,79,cross=True,active=True)+badge(183,77,'경통 고정',140)+label(462,70,'파인더 조절')+arrow('M417 104Q468 84 503 112')+label(183,345,'본망원경')+label(462,345,'같은 표적 중앙')))
finder.append(step('재확인','다른 표적으로 한 번 더 확인해요','다른 먼 표적을 파인더 중앙에 놓고 본망원경에도 들어오는지 봐요. 운반한 뒤에는 정렬이 유지되는지 다시 확인해요.','다른 표적인 가로등이 본망원경과 파인더 양쪽 중앙에 들어와 있고 확인 표시가 있다.',field(183,206,100,target='lamp')+field(462,206,79,target='lamp',cross=True)+check(260,110)+check(525,115)+label(320,61,'다른 표적으로 재확인')+label(183,345,'본망원경')+label(462,345,'파인더'),'상하·좌우 방향은 광학 구성에 따라 달라요. 그림은 중심을 맞추는 원리만 보여 줘요.'))
add('telescope-finder','scope-video-finder','두 시야의 중심 맞추기','망원경 · 파인더 사용','낮의 지상 표적으로 연습한 뒤 밤에는 달이나 밝은 별을 찾아보세요.',finder)

prep=[]
prep.append(step('스트랩','스트랩을 연결하고 확인해요','양쪽 고리에 스트랩을 설명서대로 연결해요. 낮은 높이에서 본체를 받친 채 살짝 당겨 빠지지 않는지 확인해요.','쌍안경 양옆 고리에 스트랩이 연결되고 아래에서 손이 본체를 받치는 그림.',ground()+bino_front(320,167,1.25)+path('M167 150Q61 141 113 291Q320 410 526 291Q573 145 472 150',stroke=ORANGE,width=5)+hand(235,275)+hand(410,275,True)+label(320,53,'양쪽 고리와 버클')+check(153,139)+check(485,139)))
prep.append(step('어댑터','호환되는 연결부를 확인해요','삼각대 연결을 지원하는지 확인해요. 나사 소켓형은 보호 캡을 열고 호환 어댑터를 연결해요. 본체를 분해하지 않아요.','쌍안경 중앙 앞쪽의 삼각대 소켓과 아래의 L자 어댑터가 분리되어 있고 연결 방향이 표시되어 있다.',bino_front(320,144,1.05)+circle(320,180,14,GOLD,ORANGE)+path('M312 253H328V314H395V331H312Z',MINT)+circle(320,260,7,WHITE)+arrow('M320 238V205')+label(500,187,'소켓')+leader('M463 181H348')+label(475,322,'어댑터')+label(320,37,'앞에서 본 모습'),'중앙 지지봉·전용 홀더 방식도 있어요. 맞지 않는 나사를 억지로 끼우지 않아요.'))
prep.append(step('삼각대','받친 채 고정하고 기울여 봐요','안정된 삼각대에 어댑터를 고정해요. 본체를 받치며 잠금과 이탈 방지 장치를 확인하고 위쪽 하늘을 볼 수 있는지 살펴요.','쌍안경이 어댑터와 삼각대 위에 연결되어 있고 연결부에 확인 표시가 있다.',ground()+tripod(320,241,.85)+mount(320,219,.8)+path('M314 178H327V211H359V222H314Z',MINT)+bino_front(320,132,.8)+hand(219,182)+hand(420,182,True)+check(374,224)+label(320,50,'고정 후, 천천히 각도 확인')+label(499,287,'잠금 확인')+leader('M450 276L365 230'),'본체·어댑터·헤드의 호환 규격과 삼각대의 허용 하중을 함께 확인해요.'))
add('binocular-setup','scope-video-binocular-mount','쌍안경도 차근차근 준비해요','쌍안경 · 준비','쌍안경 본체는 보통 조립되어 있어요. 광학부를 열지 않고 스트랩과 필요한 지지대를 준비해요.',prep)

focus=[]
focus.append(step('아이컵','눈과 렌즈 사이 거리를 맞춰요','안경을 썼다면 보통 아이컵을 낮추고, 안경이 없다면 올려서 시작해요. 검은 테두리 없이 시야가 보이는 거리를 찾아요.','위에서 본 쌍안경. 아래쪽 두 접안부의 아이컵과 높이 조절 방향이 강조되어 있다.',bino_top(cups=True)+label(320,44,'아이컵 높이')+arrow('M470 312V268')+label(320,373,'그림 아래쪽이 눈을 대는 쪽'),'그림은 위에서 본 방향이에요. 왼쪽·오른쪽은 사용하는 사람을 기준으로 해요.'))
focus.append(step('눈 간격','시야가 하나의 원이 되게 해요','양쪽 경통을 조금씩 접거나 벌려 두 눈 사이 간격에 맞춰요. 시야가 하나의 원으로 보이는 위치를 찾아요.','쌍안경 중앙에서 좌우 간격 조절 화살표가 나타나며 오른쪽 위에는 하나의 원형 시야가 있다.',bino_top()+arrow('M292 144H264')+arrow('M348 144H376')+circle(535,79,41,WHITE)+antenna(535,78,.45)+label(320,44,'눈 간격 조절')+text(535,145,'하나의 원',20)+label(320,373,'겹친 두 원으로 보지 않아요')))
focus.append(step('왼쪽 눈','왼쪽 눈은 중앙 손잡이로 맞춰요','오른쪽 앞 렌즈를 덮개로 가려요. 왼쪽 눈으로 먼 표적을 보며 중앙 초점 손잡이를 돌려 또렷하게 맞춰요.','오른쪽 대물렌즈에 주황색 덮개가 있고 중앙 초점 손잡이가 강조되어 있다.',bino_top(cap='right',focus=True)+label(320,44,'오른쪽 앞 렌즈를 가려요')+label(94,196,'중앙 초점')+leader('M156 191H292')+arrow('M340 163Q369 186 348 217')+badge(232,366,'왼쪽 눈',100),'눈을 찡그리기보다 앞 렌즈를 덮개로 가려요. 유리 면을 손으로 누르지 않아요.'))
focus.append(step('오른쪽 눈','오른쪽 눈은 시도 링으로 맞춰요','왼쪽 앞 렌즈를 가리고 오른쪽을 열어요. 중앙 손잡이는 그대로 두고 오른쪽 시도 조절 링만 돌려 같은 표적을 선명하게 해요.','왼쪽 대물렌즈가 가려지고 오른쪽 접안부의 시도 조절 링이 주황색으로 강조된다.',bino_top(cap='left',diopter=True)+label(320,44,'이번에는 왼쪽 앞 렌즈')+label(94,195,'그대로')+leader('M139 191H293')+label(530,252,'시도 링')+leader('M490 247H444')+arrow('M376 270Q405 282 438 270')+badge(408,366,'오른쪽 눈',120)))
focus.append(step('두 눈','양쪽을 열고 함께 확인해요','두 눈의 차이를 맞춘 뒤에는 보통 중앙 손잡이로 대상의 거리에 따른 초점을 조절해요. 두 손으로 잡고 팔을 받쳐 흔들림을 줄여요.','양쪽 렌즈가 열려 있고 중앙 손잡이만 강조되어 있으며 두 눈에 확인 표시가 있다.',bino_top(focus=True)+label(320,44,'이후에는 중앙 초점')+check(232,350)+check(408,350)+arrow('M342 163Q368 185 349 217'),'오른쪽 시도 링이 있는 중앙 초점식 예시예요. 개별 초점식은 양쪽 접안부를 각각 맞춰요.'))
add('binocular-focus','scope-video-binocular-focus','내 눈에 맞추는 다섯 단계','쌍안경 · 사용','아이컵 → 눈 간격 → 왼쪽 초점 → 오른쪽 시도 보정 → 두 눈 순서로 따라 해요.',focus)

sm=[]
sm.append(step('설치','본체를 고정하고 수평을 맞춰요','하늘이 트인 곳에서 삼각대와 본체를 고정해요. 전원·배터리와 경통이 움직일 공간을 확인해요.','브랜드 표시가 없는 카메라 일체형 망원경과 삼각대, 수평계가 그려져 있다.',ground()+smart(270,190)+rect(430,220,132,43,WHITE,12)+rect(452,235,90,12,MINT,6,'none')+circle(497,241,8,GOLD,ORANGE,2)+path('M485 230v22M509 230v22',width=2)+label(495,193,'수평 확인')+label(270,64,'하늘이 트인 자리'),'적도의 모드를 쓰는 기종은 전용 설치와 극축 정렬을 추가로 해요.'))
sm.append(step('연결','앱을 연결하고 위치·시각을 확인해요','공식 앱으로 연결한 뒤 관측 위치와 시각, 저장 공간을 확인해요. 덮개와 초기 보정은 기종 안내를 따라요.','스마트망원경과 휴대폰 사이 연결이 표시되고 휴대폰 화면에 위치와 시각 확인 표시가 있다.',ground()+smart(214,190,.9)+phone(479,205,.95, text(0,-44,'연결됨',20)+text(0,0,'위치',20)+check(29,-5)+text(0,44,'시각',20)+check(29,39))+leader('M273 172H382')+path('M306 145Q330 126 354 145M315 157Q330 144 345 157',stroke=ORANGE)+label(320,51,'망원경과 앱 연결'),'인터넷 없이 쓸 수 있는 기능과 연결 방식은 기종마다 달라요.'))
sm.append(step('초점','대상을 찾고 별의 초점을 확인해요','가려지지 않은 대상을 골라 자동 정렬·도입·초점 절차를 진행해요. 별이 퍼지지 않는지, 대상 전체가 화각에 드는지 살펴요.','망원경이 별이 있는 하늘을 향하고 휴대폰 화면의 별을 중심으로 초점 확인 표시가 있다.',smart(210,200,.9)+star(110,67,9)+star(155,87,4)+leader('M179 151L117 81')+phone(477,213,.95,sky_dots()+circle(4,-20,20,'none',ORANGE,2))+label(424,50,'별이 또렷한지 확인')+badge(475,362,'초점 확인',138)))
sm.append(step('누적','여러 장을 쌓고 원본도 저장해요','딥스카이 촬영은 여러 장을 정렬해 합치며 신호를 모아요. 결과 이미지와 지원되는 원본을 저장하고 정해진 순서로 종료해요.','세 장의 별 사진을 겹친 그림에서 한 장의 결과 이미지와 저장 화살표로 이어진다.',rect(89,94,150,188,WHITE,10)+rect(109,114,150,188,WHITE,10)+rect(129,134,150,188,WHITE,10)+group(sky_dots(),203,225)+arrow('M298 221H343')+phone(449,220,.97,ellipse(0,-2,35,20,'#bdd0c8')+ellipse(0,-2,21,11,'#e4cf98')+sky_dots()+path('M0 54v25m-10-10 10 10 10-10M-22 82h44',stroke=ORANGE))+label(320,53,'여러 장을 정렬해 한 장으로'),'그림은 합성 원리예요. 구름·흔들림으로 제외되는 장이 있고, 결과는 하늘·노출·장비에 따라 달라요.'))
add('smart-telescope','scope-smart-guide','화면에 빛을 모으는 순서','스마트망원경 · 준비와 촬영','빛을 받는 곳은 망원경의 카메라예요. 휴대폰은 조작과 결과 확인에 사용해요.',sm)

ph=[]
ph.append(step('고정','휴대폰을 단단히 받쳐요','삼각대나 안정된 받침을 사용해요. 플래시를 끄고 타이머나 원격 셔터로 손이 만드는 흔들림을 줄여요.','풍경을 향한 휴대폰이 삼각대 위에 놓여 있고 타이머 아이콘이 있다.',ground()+tripod(320,239,.85)+rect(279,209,82,26,MINT,5)+phone(320,160,.68,sky_dots())+circle(500,139,32,WHITE)+path('M500 119v22l13 10M489 99h22',stroke=ORANGE)+label(500,207,'타이머')+label(185,71,'고정이 먼저')))
ph.append(step('초점','주 카메라로 먼 곳에 초점을 맞춰요','주 카메라의 기본 화각에서 시작해요. 밝은 별이나 먼 불빛으로 초점을 확인하고, 가능하면 초점을 고정해요.','가로 휴대폰 화면의 별에 초점 사각형이 놓이고 1배 기본 화각이 표시되어 있다.',phone(320,205,1.5,sky_dots()+rect(-18,-39,44,40,'none',2,ORANGE,2)+text(81,52,'1×',18)+text(-87,51,'야간',16),True)+label(320,60,'밝은 별 · 먼 불빛')+arrow('M327 88V119')+label(320,374,'화면과 기능은 기종마다 달라요')))
ph.append(step('시험 촬영','설정은 한 번에 하나씩 바꿔요','야간·천체 모드가 있다면 활용해요. 수동 촬영이 가능하면 5초·ISO 800을 시험해 보고 하늘과 별의 모양에 맞춰 조절해요.','휴대폰 화면 옆에 5초와 ISO 800이 시험값으로 표시되고 조절 화살표가 있다.',phone(217,209,1,sky_dots()+text(0,74,'촬영',18))+badge(448,103,'수동 촬영 예시',182)+label(448,170,'5초')+label(448,223,'ISO 800')+arrow('M393 263H496')+text(448,314,'시험 후 조절',22),'모든 기종에 공통인 정답 설정은 아니에요. 야간 모드 전체 처리 시간과 한 장의 노출 시간도 구분해요.'))
ph.append(step('결과 확인','확대해서 별의 모양을 살펴요','별이 작은 점인지 확인해요. 길게 늘어지면 한 장의 노출을 줄이고, 흔들렸다면 고정과 타이머를 점검해 다시 찍어요.','왼쪽 확대 화면의 별은 점이고 오른쪽 화면의 별은 길게 늘어진 선으로 비교되어 있다.',rect(69,109,220,194,WHITE,20)+rect(351,109,220,194,WHITE,20)+''.join(circle(x,y,3,INK,'none') for x,y in [(113,151),(203,167),(166,239),(246,265)])+''.join(path(f'M{x} {y}l22-9',stroke=INK,width=3) for x,y in [(388,155),(479,173),(444,239),(518,265)])+label(180,70,'점으로 맺힌 별')+label(462,70,'늘어진 별')+check(180,342)+text(462,351,'노출·고정 점검',22)))
add('phone-wide','photo-phone-wide-guide','휴대폰만으로 별 찍기','휴대폰 · 삼각대 촬영','은하수·별자리·하늘 풍경을 넓게 담는 방법이에요. 그림의 화면은 특정 앱을 재현한 것이 아니에요.',ph)

af=[]
af.append(step('달 찾기','먼저 눈으로 달을 가운데 놓아요','휴대폰을 연결하기 전에 낮은 배율로 달을 찾아 초점을 맞춰요. 중앙에 놓고 시작하면 카메라를 연결한 뒤 찾기 쉬워요.','완성된 망원경과 그 원형 시야 한가운데 있는 달이 그려져 있다.',ground()+tripod(242,239,.8)+mount(242,215,.8)+tube(237,163,.72,True,False)+circle(498,172,75,WHITE)+moon(498,172,43)+leader('M389 151L424 153')+label(498,289,'먼저 달을 중앙에')+label(237,61,'낮은 배율부터')))
af.append(step('연결','어댑터로 휴대폰을 받쳐요','휴대폰과 접안렌즈에 맞는 어댑터를 연결해요. 휴대폰을 손으로 받친 채 잠금과 경통의 균형을 확인해요.','옆에서 본 접안렌즈와 휴대폰. 어댑터가 접안렌즈를 감싸고 휴대폰을 지지한다.',rect(60,166,190,68,WHITE,12)+rect(245,185,44,30,MINT,3)+rect(284,176,68,49,INK,5)+rect(300,168,19,68,GOLD,3,ORANGE)+path('M309 235v36H465v-25',stroke=ORANGE,width=8)+rect(452,120,24,147,MINT,5)+rect(446,181,9,17,INK,2)+hand(482,264,True)+leader('M354 199H441')+label(170,123,'접안부')+label(467,75,'휴대폰')+label(310,334,'어댑터로 지지')+text(320,383,'옆에서 본 연결 원리',20),'그림은 연결 원리예요. 어댑터 구조와 카메라 위치는 기종마다 달라요.'))
af.append(step('중심 맞추기','카메라 렌즈를 중심에 맞춰요','실제로 사용하는 휴대폰 카메라를 접안렌즈의 중심에 맞춰요. 좌우·높이·앞뒤 거리를 조금씩 조절해 검은 시야 가림을 줄여요.','접안렌즈의 큰 원과 휴대폰 카메라의 작은 원이 왼쪽에서는 어긋나 있고 오른쪽에서는 동심원으로 맞춰져 있다.',circle(179,202,82,MINT)+circle(212,180,32,GOLD,ORANGE)+circle(461,202,82,MINT)+circle(461,202,32,GOLD,ORANGE)+path('M451 202h20M461 192v20',stroke=ORANGE,width=2)+arrow('M286 202H349')+label(179,70,'어긋난 중심')+label(461,70,'같은 중심')+check(461,325)+rect(133,353,18,18,MINT,9)+text(165,369,'접안렌즈',20,INK,'start')+rect(342,353,18,18,GOLD,9,ORANGE,2)+text(374,369,'카메라 렌즈',20,INK,'start'),'멀티 카메라가 자동으로 바뀌면 사용할 렌즈를 고정할 수 있는지 확인해요.'))
af.append(step('노출·촬영','달 무늬가 보이게 노출을 낮춰요','화면에서 초점을 다시 확인해요. 달이 하얗게 날아가지 않도록 노출을 낮추고 타이머나 원격 셔터로 촬영해요.','휴대폰 화면에 무늬가 있는 달이 보이고 노출 조절 막대가 아래쪽으로 내려와 있다.',phone(320,205,1.55,moon(-27,-3,48)+path('M81-51V36',stroke=MUTED,width=2)+circle(81,21,7,GOLD,ORANGE,2)+text(81,-57,'+',16)+text(81,56,'−',16),True)+label(320,55,'밝은 부분의 무늬를 살려요')+text(320,372,'초점 확인 → 노출 조절 → 타이머',23),'추적하지 않는 망원경은 달이 시야에서 움직여요. 필요할 때 다시 중앙으로 옮겨 주세요.'))
add('phone-eyepiece','photo-phone-eyepiece-guide','휴대폰을 망원경에 연결하기','휴대폰 · 접안 촬영','밝고 찾기 쉬운 달부터 연습해 보세요. 접안렌즈를 통해 휴대폰 카메라로 촬영하는 방식이에요.',af)

# Counterweights: original close-up schematics. Axis directions/dimensions are not a setup template.
def cw(y=210,x=320,scale=1,highlight=False):
    edge=ORANGE if highlight else INK
    s=rect(-56,-20,112,40,MINT,4,edge)+ellipse(0,-20,56,13,WHITE,edge)+ellipse(0,-20,8,4,WHITE,edge,2)+ellipse(0,20,56,13,MINT,edge)
    s+=path('M56 0H78',stroke=edge,width=5)+rect(76,-11,17,22,GOLD if highlight else INK,4,edge,2)
    return group(s,x,y,scale)
def eq_saddle(x,y,scale=1):
    s=rect(-37,-8,74,18,MINT,5)+path('M-21 10V42H21V10Z',MINT)+circle(0,26,14,WHITE)
    s+=path('M38 0H55',width=4)+rect(53,-8,10,16,GOLD,3,ORANGE)
    return group(s,x,y,scale)
def cw_shaft(end=284,stop=True):
    s=rect(285,51,70,47,MINT,10)+rect(305,91,30,21,INK,4)+rect(314,110,12,end-110,WHITE,2)
    if stop:s+=rect(298,end,44,12,GOLD,4,ORANGE,3)
    return s

def shoe(x,y,flip=False):
    s=path('M-23-23H-3L4-4 30 2Q42 6 36 17H-25Z',WHITE,INK,2.5)+path('M-26 18H37M-6-14l12-2',width=2)
    return f'<g transform="translate({x} {y}) scale({-1 if flip else 1} 1)">{s}</g>'

def lock(x,y):
    return path(f'M{x-9} {y-2}v-10a9 9 0 0 1 18 0v10',stroke=INK,width=3)+rect(x-15,y-2,30,23,GOLD,4)+circle(x,y+8,3,INK,'none')

cw_install=[]
cw_install.append(step('자리','추 아래에 발이 놓이지 않게 해요','삼각대와 가대를 단단히 고정해요. 추를 다루기 전에 발을 낙하 경로 밖에 두고 주변을 비워요. 설치 자세와 축 고정은 기종 설명서를 따라요.','무게추 아래 낙하 경로가 빗금으로 표시되고 두 발은 양옆에 떨어져 있다. 상단에는 축을 고정하라는 자물쇠가 있다.',cw_shaft()+cw(205)+rect(268,305,104,63,'#f1ddc9',5,'none')+''.join(path(f'M{x} 363l32-53',stroke='#d5ab88',width=2) for x in [270,290,310,330])+shoe(161,342)+shoe(479,342,True)+arrow('M318 311V350')+label(320,35,'발은 추 바로 아래에서 비켜요')+lock(469,103)+text(469,155,'축 고정',22)+path('M70 370H570',stroke=MUTED,width=2),'혼자 안전하게 받치기 무거우면 도움을 받아요. 학생이 조립할 때는 지도자가 함께해요.'))
cw_install.append(step('추 끼우기','봉을 고정한 뒤, 추를 받쳐 끼워요','무게추 봉을 지정된 방식으로 고정하고 아래쪽으로 향하게 해요. 끝 안전장치를 잠시 분리한 뒤 추를 하나씩 받쳐 끼우고, 추의 고정 나사를 조여요.','가대에 고정된 봉 끝으로 무게추를 들어 올리는 그림. 양손이 추를 받치고 분리한 끝 안전장치는 옆에 놓여 있다.',cw_shaft(end=237,stop=False)+cw(284)+hand(277,305)+hand(363,305,True)+arrow('M444 292V232')+label(320,34,'추를 받친 채 천천히')+rect(479,190,44,12,GOLD,4,ORANGE)+text(501,151,'끝 안전장치',21)+leader('M500 169V184')+text(154,209,'봉 고정',22)+leader('M195 203L306 115'),'추가 여러 개면 각 추를 고정한 다음 다음 추를 끼워요. 추와 추 사이에 손가락이 끼이지 않게 해요.'))
cw_install.append(step('안전장치','고정 나사와 봉 끝 장치를 모두 확인해요','추의 고정 나사를 조이고, 봉 끝의 이탈 방지 나사·캡을 다시 단단히 체결해요. 두 곳을 확인할 때까지 추를 받쳐요.','추 옆 고정 나사와 봉 끝의 안전장치가 각각 강조되고 손이 추를 지지한다.',cw_shaft(end=291)+cw(208,highlight=True)+hand(277,230)+hand(365,230,True)+label(320,34,'고정 나사 + 끝 안전장치')+text(508,196,'추 고정',23)+leader('M463 191L414 205')+check(430,232)+text(146,308,'이탈 방지',23)+leader('M211 300H289')+check(363,297),'봉 끝 장치만으로 추를 지지하지 않아요. 부품이 없거나 나사산이 손상됐다면 설치를 멈추고 맞는 부품부터 준비해요.'))
cw_install.append(step('경통','무게추를 고정한 다음 경통을 올려요','봉·추·끝 안전장치와 가대의 축 고정을 확인해요. 그다음 경통을 두 손으로 받쳐 장착하고 경통 잠금을 확인해요.','왼쪽은 고정된 무게추와 확인 표시, 오른쪽은 두 손으로 받치는 경통이다. 화살표가 무게추에서 경통으로 이어진다.',group(cw_shaft()+cw(209),-83,18,.78)+check(226,134)+tube(462,191,.58)+hand(402,210)+hand(528,210,True)+eq_saddle(460,264,.7)+arrow('M270 197H336')+label(167,334,'① 추 고정')+label(462,334,'② 경통 장착')+text(320,39,'순서를 바꾸지 않아요',24),'일반적인 무게추형 독일식 적도의 예시예요. 균형을 맞추기 전에는 축 잠금을 함부로 풀지 않아요.'))
cw_install.append(step('적경 균형','적경축 균형은 추의 위치로 맞춰요','관측할 부속품을 모두 장착한 상태로 설명서의 균형 절차를 따라요. 경통과 추를 받친 뒤 필요한 축만 풀고, 추를 옮긴 뒤 고정 나사를 다시 조여요.','적경축을 보는 개념도에서 경통은 왼쪽, 무게추는 오른쪽에 있다. 추를 봉을 따라 이동하는 방향과 두 쪽을 받치는 손이 표시되어 있다.',path('M320 250V185M180 185H538',stroke=INK,width=10)+circle(320,185,26,MINT)+circle(320,185,9,WHITE)+circle(168,185,55,WHITE)+circle(168,185,43,'#a9c5cb')+group(cw(0,0,1,True),454,185,1,-90)+rect(537,164,12,42,GOLD,3,ORANGE)+hand(160,245)+hand(456,249,True)+arrow('M409 60H495')+arrow('M495 80H409')+label(320,38,'적경축 RA · 추 위치 조절')+text(168,309,'경통을 받쳐요',22)+text(458,309,'추를 받쳐요',22)+text(320,367,'균형 원리를 단순화한 그림',20),'한 축씩 점검해요. 잠금 해제 순간 갑자기 회전할 수 있어요. 균형 조절 중에도 봉 끝 안전장치는 유지해요.'))
cw_install.append(step('적위 균형','적위축 균형은 경통 위치로 맞춰요','경통과 부속품을 받친 채 기종의 절차에 따라 경통을 앞뒤로 옮겨요. 장착 레일·밴드와 축의 잠금을 다시 확인한 뒤 다른 축의 균형도 재확인해요.','두 손이 경통을 받치고 경통의 앞뒤 이동 방향이 표시된다. 가운데 장착부와 잠금 확인 표시가 있다.',tube(306,176,1,True)+hand(205,201)+hand(415,201,True)+eq_saddle(308,233)+path('M309 265v54',width=9)+rect(282,319,54,17,MINT,4)+arrow('M238 79H375')+arrow('M375 101H238')+check(356,238)+label(320,37,'적위축 DEC · 경통 위치 조절')+text(320,375,'받친 채 조절 → 다시 고정',23),'그림은 경통 위치 조절 부분만 보여 줘요. 무게추를 임의로 빼거나, 모든 잠금을 한꺼번에 풀지 않아요.'))
def eq_head(x,y,scale=1):
    """Simplified equatorial head, with the counterweight shaft detached."""
    s=rect(-31,0,62,17,MINT,5)+path('M-24 0L-19-43 12-58 26 0Z',MINT)
    s+=group(rect(-20,-47,40,76,MINT,8)+circle(0,-21,12,WHITE),-5,-48,1,-35)
    s+=path('M-26-81L6-101 28-72-3-51Z',WHITE)+rect(-29,-105,63,15,INK,4)
    s+=circle(25,-59,12,MINT)+path('M32-51l13 15',width=7)
    return group(s,x,y,scale)

# Installation is one complete route per mount, not a generic guide followed by
# a counterweight add-on. Copy reused frames before the export removes the art.
eq_assembly=[]
eq_assembly.append(step('부품','무게추와 안전장치도 함께 확인해요','삼각대·적도의 가대·경통·접안부와 무게추 봉·추·끝 안전장치를 나눠 놓아요. 설명서를 펼치고 경통을 내려놓을 안정된 자리를 준비해요.','삼각대, 적도의 가대, 경통과 접안렌즈 옆에 무게추·봉·끝 안전장치가 따로 놓여 있다.',ground()+tripod(170,263,.62)+eq_head(170,207,.73)+tube(176,70,.65)+eyepiece(330,222,.65)+cw(233,485,.68)+rect(417,99,10,112,WHITE,2)+rect(407,213,30,9,GOLD,3,ORANGE)+label(166,27,'경통')+label(169,244,'적도의 가대')+text(170,382,'삼각대',21)+text(343,305,'접안부',21)+text(479,291,'추 · 봉 · 안전장치',21),'렌즈 덮개는 닫아 둬요. 무게추의 필요 여부는 신형·구형보다 가대 구조와 허용 하중 조건에 따라 달라요.'))
eq_assembly.append(dict(assembly[1]))
eq_assembly.append(step('가대','적도의 가대를 삼각대에 고정해요','기종에서 정한 방향으로 가대를 올리고 연결 볼트를 단단히 조여요. 설명서의 설치 자세와 축 잠금 상태를 확인한 뒤 봉과 무게추를 준비해요.','삼각대 위로 적도의 가대가 내려오며, 연결 볼트와 잠긴 축을 나타내는 자물쇠가 강조되어 있다.',ground()+tripod(320,245,.85)+eq_head(320,161,.88)+arrow('M320 183V216')+rect(312,263,16,24,GOLD,3,ORANGE)+path('M296 291h48',stroke=ORANGE,width=5)+label(145,103,'적도의 가대')+leader('M218 108L286 110')+lock(489,112)+text(489,163,'축 고정',21)+text(482,281,'연결 볼트',22)+leader('M425 278L340 282'),'가대가 기울거나 흔들리면 다음 단계로 넘어가지 않아요. 아직 경통은 올리지 않아요.'))
eq_assembly.extend(dict(s) for s in cw_install[:4])
eq_assembly.append(step('접안부','균형을 맞추기 전에 부속품을 연결해요','파인더와 사용할 접안렌즈·천정미러 또는 카메라를 설명서대로 고정해요. 실제 관측할 때의 무게와 배치로 준비한 다음 균형을 맞춰요.','이미 고정된 경통에 파인더와 접안부를 연결하는 부분 확대도. 아래에는 축 고정 유지라는 안내가 있다.',tube(276,199,.87)+rect(217,81,78,20,MINT,4)+path('M235 101v21M276 101v21')+arrow('M255 126V162')+path('M404 192h45v-29h20v48h-65Z',MINT)+eyepiece(459,93,.65)+arrow('M459 133V154')+eq_saddle(296,251,.8)+label(253,54,'파인더')+label(471,46,'접안렌즈')+lock(194,338)+text(344,352,'연결 중에는 축 고정 유지',22),'굴절망원경의 접안부 예시예요. 뉴턴식은 보통 옆 초점부에 직접 연결해요. 부속품을 바꾸면 균형도 다시 점검해요.'))
eq_assembly.extend(dict(s) for s in cw_install[4:])
eq_assembly.append(step('최종 점검','잠금과 케이블을 확인하고 정렬로 넘어가요','균형 조절을 마치면 추·봉 끝 안전장치·경통 장착부를 다시 확인해요. 설명서대로 경통과 추를 지지하며 움직일 범위의 충돌·케이블 걸림을 점검하고, 전동형은 지정된 순서로 전원을 연결해요.','추의 고정과 끝 안전장치, 경통 장착부, 여유 있게 정리한 케이블을 각각 확인하는 세 개의 점검 그림.',group(cw_shaft()+cw(209),-74,69,.66)+check(151,76)+tube(402,136,.55,True)+eq_saddle(404,178,.57)+check(516,111)+path('M369 261v20q0 34 34 34h24q34 0 34-34v-20',stroke=INK,width=5)+rect(356,246,26,23,MINT,4)+rect(448,246,26,23,MINT,4)+check(509,284)+text(138,325,'추 · 끝 장치',21)+text(410,230,'경통 잠금',21)+text(417,356,'케이블 여유',21)+label(320,34,'설치 후 마지막 점검'),'잠긴 축을 억지로 밀지 않아요. 기계적인 설치를 마친 뒤에는 기종에 맞는 극축 정렬·파인더 정렬을 진행해요.'))
add('counterweight-install','scope-counterweight-install','적도의 설치 · 준비부터 균형까지','망원경 설치 · 무게추형 적도의','무게추형 독일식 적도의의 전체 설치 흐름이에요. 설치 자세·축 잠금·균형 조절 순서는 사용하는 가대의 설명서를 우선하세요.',eq_assembly)

cw_remove=[]
cw_remove.append(step('경통 먼저','철수할 때는 경통부터 내려요','전동형은 설명서대로 종료·수납 자세로 옮긴 뒤 전원을 꺼요. 지정된 자세에서 축을 고정하고, 경통을 확실히 받친 채 장착부를 풀어 안전한 받침에 내려놓아요.','왼쪽의 경통을 두 손으로 먼저 내려놓는 그림과, 오른쪽에서 계속 고정되어 있는 무게추가 함께 보인다.',tube(201,159,.71)+hand(134,185)+hand(275,185,True)+arrow('M200 238V280')+rect(74,308,253,27,MINT,8)+group(cw_shaft()+cw(209),253,25,.75)+lock(553,133)+label(200,64,'경통 먼저')+text(487,315,'추는 고정 유지',21),'경통이 달린 채 무게추부터 빼면 균형이 무너져 경통이 급회전하거나 장비가 넘어질 수 있어요.'))
cw_remove.append(step('추 내리기','추는 하나씩 받쳐서 빼요','경통을 내린 다음 진행해요. 남은 추의 고정을 확인하고, 빼낼 추를 받친 상태에서 끝 안전장치를 분리해요. 그 추의 고정 나사를 풀어 봉에서 천천히 내려 빼요.','경통이 없는 봉에서 무게추 한 개를 두 손으로 받쳐 내린다. 끝 안전장치는 옆에 분리되어 있고 아래로 향한 화살표가 있다.',cw_shaft(end=224,stop=False)+cw(287)+hand(277,309)+hand(365,309,True)+arrow('M444 223V288')+rect(479,165,44,12,GOLD,4,ORANGE)+text(500,134,'안전장치 분리',20)+label(320,35,'경통을 내린 다음, 한 개씩')+text(320,383,'발은 추 바로 아래에 두지 않아요',22),'추를 다룰 때 계속 지지해요. 여러 추를 한꺼번에 풀지 않고, 한 손으로 버거우면 도움을 받아요.'))
cw_remove.append(step('봉 정리','모든 추를 내린 뒤 봉을 정리해요','추는 굴러가거나 넘어지지 않게 낮고 안정된 곳에 놓아요. 모든 추를 뺀 것을 확인한 다음, 설명서대로 봉을 분리하거나 수납해요.','무게추 두 개가 바닥에 안정적으로 놓여 있고, 비어 있는 봉을 가대에서 분리하는 화살표가 있다.',rect(285,51,70,47,MINT,10)+rect(305,91,30,21,INK,4)+rect(314,155,12,142,WHITE,2)+rect(298,297,44,12,GOLD,4,ORANGE)+arrow('M376 142V210')+cw(329,158,.8)+cw(329,482,.8)+check(158,277)+check(482,277)+path('M65 359H575',stroke=MUTED,width=2)+label(320,34,'추를 모두 내린 뒤')+text(467,176,'봉 분리·수납',22)+text(320,392,'추가 달린 채 봉을 빼지 않아요',22),'끝 안전장치와 고정 부품은 잃어버리지 않도록 함께 보관해요.'))
add('counterweight-remove','scope-counterweight-remove','철수할 때는 경통부터 내려요','적도의 · 무게추 분리와 보관','일반적인 분리 순서는 경통 → 무게추 → 무게추 봉이에요. 각 부품을 받친 상태로 기종의 분해 절차를 따라요.',cw_remove)


# Counterweighted alt-azimuth route: upright azimuth axis, horizontal altitude axis.
# These original schematics show a side-mounted tube and a horizontal weight shaft.
def az_cw_head(x=320,y=240,scale=1,shaft=True,stop=True):
    s=rect(-37,-64,74,72,MINT,9)+rect(-44,5,88,19,INK,5)
    s+=rect(-78,-84,117,36,MINT,8)+ellipse(-78,-66,9,18,WHITE,INK)
    s+=rect(-94,-93,18,54,WHITE,4)+circle(4,-65,12,WHITE)
    if shaft:
        s+=path('M39-66H210',width=10)
        if stop:s+=rect(207,-86,10,40,GOLD,3,ORANGE)
    return group(s,x,y,scale)

def az_weight(x,y,scale=1,highlight=False):
    return group(cw(0,0,1,highlight),x,y,scale,-90)

def az_front(x=320,y=240,scale=1,weight=True,scope=True):
    s=tripod(0,30,.85)+az_cw_head(0,0)
    if scope:s+=circle(-139,-66,53,WHITE)+circle(-139,-66,42,'#a9c5cb')
    if weight:s+=az_weight(164,-66,.8)
    return group(s,x,y,scale)

def az_altitude(x=320,y=227,scale=1,accessories=True):
    s=rect(-25,26,50,52,MINT,6)+circle(0,23,18,WHITE)
    s+=tube(-8,-16,.85,accessories)+circle(0,23,7,MINT)
    return group(s,x,y,scale)

az_cw=[]
az_cw.append(step('형식·부품','무게추가 있어도 경위대일 수 있어요','경위대는 고도(위아래)와 방위(좌우)로 움직여요. 가대·삼각대·경통·접안부와 무게추의 규격, 고정부, 기종의 장착 순서를 먼저 확인해요.','정면에서 본 경위대의 왼쪽에는 경통 앞면, 오른쪽 수평 봉에는 무게추가 있다. 가운데 가대는 삼각대 위에 수직으로 서 있다.',ground()+az_front(320,244,.85)+label(320,38,'무게추형 경위대')+text(156,97,'경통',22)+leader('M167 108L183 150')+text(487,89,'무게추',22)+leader('M483 104V124')+text(320,388,'정면에서 본 구조 예시',20),'이 그림은 옆으로 봉이 나오는 형태예요. 고정형 추·아래로 향한 봉 등 구조가 다르면 해당 기종의 절차를 따라요.'))
az_cw.append(dict(assembly[1]))
az_cw.append(step('가대·수평','가대를 고정하고 수평을 확인해요','삼각대에 가대를 올려 지정된 연결부를 고정해요. 다리와 벌림대의 잠금을 확인하고, 기종의 수평계와 조절부로 수평을 맞춰요.','삼각대 위로 수직 형태의 경위대 가대가 내려오는 그림. 옆의 수평계 확대도에서 기포는 중앙에 있다.',ground()+tripod(289,250,.8)+az_cw_head(289,166,.85,False)+arrow('M289 202V225')+rect(281,271,16,22,GOLD,3,ORANGE)+circle(479,162,43,WHITE)+circle(479,162,20,'none',MUTED,2)+circle(479,162,10,MINT)+check(521,201)+label(320,35,'고정한 뒤 수평 확인')+text(481,239,'기포를 중앙으로',21)+text(141,287,'연결부 고정',21)+leader('M202 280H272'),'장비를 올린 뒤에도 수평을 다시 확인해요. 전동형은 균형과 간섭 점검을 마친 뒤 설명서대로 전원을 켜요.'))
az_cw.append(step('봉 준비','무게추 봉을 체결하고 잠가요','지정된 봉을 가대에 단단히 연결해요. 수납식 봉은 허용된 길이까지 꺼내 잠그고, 추를 넣기 전에 봉의 체결과 고정부를 확인해요.','경위대 가대 오른쪽으로 뻗은 빈 무게추 봉과 봉의 체결부가 확대되어 있다. 봉 끝 안전장치는 옆에 따로 표시되어 있다.',az_cw_head(232,239,1,True,False)+circle(277,173,22,'none',ORANGE,3)+check(300,129)+arrow('M362 130H440')+text(182,88,'봉 체결·잠금',23)+leader('M194 100L269 151')+rect(484,156,11,40,GOLD,3,ORANGE)+text(491,237,'끝 장치',21)+label(320,35,'봉부터 안전하게 준비')+text(320,344,'추를 받칠 자리와 발 위치도 확인해요',22),'추를 끼우기 위해 끝 장치를 분리하는 기종은 분실하지 않게 놓고, 추 장착 직후 다시 체결해요.'))
az_cw.append(step('경통·추','기종의 순서대로 경통과 추를 장착해요','경통은 두 손으로 받쳐 장착 레일을 안착시키고 잠가요. 무게추는 하나씩 받쳐 봉에 끼운 채 고정 나사를 조여요. 어느 쪽을 먼저 장착하는지는 해당 가대의 설명서를 따라요.','왼쪽에는 두 손으로 받쳐 장착하는 경통, 오른쪽에는 수평 봉에 끼우는 무게추가 각각 보인다. 두 동작 사이에 순서를 정하는 화살표는 없다.',tube(163,164,.6)+hand(96,184)+hand(238,184,True)+eq_saddle(169,232,.6)+rect(347,128,35,92,MINT,7)+path('M382 171H530',width=9)+az_weight(490,171,.75)+hand(468,215)+hand(520,215,True)+arrow('M535 91H465')+label(320,36,'장착 순서는 기종마다 달라요')+text(168,307,'경통을 받쳐 고정',22)+text(477,307,'추를 받쳐 고정',22)+text(320,379,'한 부품을 고정한 뒤 다음 부품으로',20),'추 아래에 발을 두지 않아요. 한쪽에 무게가 실리는 동안 삼각대가 기울지 않게 확인하고, 혼자 받치기 무거우면 도움을 받아요.'))
az_cw.append(step('안전 확인','추 고정과 이탈 방지 구조를 확인해요','추의 고정 나사와 봉의 잠금을 다시 확인해요. 봉 끝 안전나사·캡이 있는 기종은 반드시 체결하고, 다른 구조라면 제조사가 정한 이탈 방지 방법을 확인해요.','수평 무게추 봉에서 추의 고정 나사와 봉 끝 안전장치가 주황색으로 강조되어 있다. 두 손이 무게추를 받치고 있다.',rect(104,106,62,125,MINT,10)+path('M166 164H514',width=10)+az_weight(366,164,1,True)+rect(512,141,12,46,GOLD,3,ORANGE)+hand(345,221)+hand(398,221,True)+text(366,45,'추 고정 나사',22)+leader('M366 57V70')+check(414,94)+text(514,277,'끝 장치',21)+leader('M514 250V195')+check(555,169)+text(184,311,'봉 잠금도 확인',22)+leader('M186 289L171 181')+text(320,376,'그림은 봉 끝 안전장치가 있는 예시',20),'끝 장치만 믿고 추의 고정 나사를 느슨하게 두지 않아요. 안전을 확인할 때까지 추를 받쳐요.'))
az_cw.append(step('접안부','관측할 부속품까지 모두 연결해요','경통을 지지한 상태에서 파인더와 사용할 접안렌즈·천정미러 또는 카메라를 고정해요. 실제 관측할 때의 무게와 배치로 준비한 뒤 균형을 맞춰요.','경통 위에 파인더, 뒤쪽에 접안렌즈를 연결하는 확대 그림. 경통 아래를 받친 손이 함께 보인다.',tube(276,199,.87)+rect(217,81,78,20,MINT,4)+path('M235 101v21M276 101v21')+arrow('M255 126V162')+path('M404 192h45v-29h20v48h-65Z',MINT)+eyepiece(459,93,.65)+arrow('M459 133V154')+hand(245,225)+hand(341,225,True)+label(253,54,'파인더')+label(471,46,'접안렌즈')+text(320,347,'경통을 지지한 채 연결해요',22),'굴절망원경의 접안부 예시예요. 부속품을 바꾸면 앞뒤 무게중심이 달라져 균형을 다시 점검해야 해요.'))
az_cw.append(step('고도 균형','앞뒤 균형은 경통 위치로 맞춰요','경통을 받치고 고도축의 잠금·마찰을 기종의 방법대로 조절해요. 조절 가능한 레일이나 밴드에서 경통을 조금씩 앞뒤로 옮긴 뒤 다시 고정해요.','옆에서 본 경통을 두 손이 받치고 있다. 위에는 앞뒤 이동 화살표, 아래에는 고도축 중심과 고정 확인 표시가 있다.',az_altitude(308,231,1)+hand(204,241)+hand(408,241,True)+arrow('M237 97H375')+arrow('M375 119H237')+check(360,258)+label(320,35,'고도 균형 · 경통의 앞뒤 위치')+text(320,373,'옆에서 본 모습 · 받친 채 조절해요',20),'잠금을 푸는 순간 경통이 숙여질 수 있어요. 레일을 과도하게 풀지 말고, 지정된 범위와 기종별 균형 절차를 지켜요.'))
az_cw.append(step('좌우 하중','좌우 하중은 추의 질량과 위치로 맞춰요','기종이 허용하는 추의 질량·위치로 한쪽 쏠림을 줄여요. 이동형 추는 받친 채 조절한 다음 다시 잠그고, 봉 체결과 가대 수평도 재확인해요.','정면에서 본 경통과 무게추가 가대 양쪽에 배치되어 있다. 무게추 위에는 봉을 따라 움직이는 양방향 화살표가 있고 손이 추를 받친다.',ground()+az_front(320,245,.84)+hand(465,234,True)+arrow('M431 87H483')+arrow('M483 108H431')+label(320,34,'좌우 쏠림 · 추의 질량과 거리')+text(183,142,'경통',21)+text(493,292,'추를 받쳐요',21)+text(320,388,'정면에서 본 모습',20),'경통과 추의 질량이 꼭 같을 필요는 없어요. 중심에서 떨어진 거리도 중요해요. 고정형 추는 기종이 지정한 구성으로 사용해요.'))
az_cw.append(step('움직임','고도와 방위 움직임을 각각 확인해요','경통을 받치며 위아래와 좌우의 움직임을 확인해요. 기종의 마찰·미동 장치를 조절하고, 경통·추·삼각대의 충돌이나 케이블 걸림을 살펴요.','왼쪽 옆모습에는 경통의 위아래 회전, 오른쪽 윗모습에는 수직 방위축 주위로 도는 좌우 회전이 표시되어 있다.',path('M320 86V325',stroke='#d3dbd3',width=2)+az_altitude(159,194,.62)+arrow('M71 130Q42 188 79 243')+circle(478,190,70,'none',MUTED,2,extra='stroke-dasharray="4 6"')+rect(429,121,29,138,WHITE,7)+rect(424,111,39,28,MINT,4)+path('M458 190H502',width=7)+circle(478,190,13,MINT)+arrow('M493 99Q554 110 569 168')+label(320,35,'두 방향으로 움직여요')+text(159,316,'고도 · 위아래',23)+text(479,316,'방위 · 좌우',23)+text(159,353,'옆에서 본 모습',18)+text(479,353,'위에서 본 모습',18),'전동형의 잠긴 축을 손으로 억지로 밀지 않아요. 전원을 켜면 자동으로 움직이는 기종은 먼저 회전 범위를 비워요.'))
az_cw.append(step('첫 관측','기종에 맞게 정렬하고 낮은 배율로 시작해요','수동형은 파인더를 맞추고 낮은 배율로 목표를 찾아요. 전동형은 경위대 모드와 위치·시각을 확인한 뒤 기종이 안내하는 별 정렬·자동 보정을 진행해요.','왼쪽에는 접안부가 달린 경통과 파인더, 오른쪽에는 별을 시야 중앙에 맞추는 원형 그림이 있다.',tube(178,211,.58,True)+rect(120,264,133,26,MINT,5)+circle(475,187,80,WHITE)+path('M407 187H459M491 187H543M475 119V171M475 203V255',stroke=MUTED,width=2)+star(475,187,10,ORANGE)+check(534,110)+label(320,35,'설치 완료 · 첫 관측으로')+text(180,330,'낮은 배율부터',22)+text(475,330,'시야 중앙에 맞추기',21),'경위대 모드에서는 적도의의 극축 정렬을 적용하지 않아요. 낮에 파인더를 맞출 때는 태양과 충분히 떨어진 지상 표적을 사용해요.'))
add('altaz-counterweight-install','scope-altaz-counterweight-install','무게추형 경위대 · 준비부터 첫 관측까지','망원경 설치 · 무게추형 경위대','수평 봉에 추를 다는 경위대의 구조·안전 동작을 단순화했어요. 경통과 추의 장착 순서, 잠금·균형 방법은 기종 설명서를 따르세요.',az_cw)

az_pack=[]
az_pack.append(step('철수 준비','멈추고, 분리할 부품을 받칠 자리를 준비해요','전동형은 지정된 종료·수납 자세에서 전원을 꺼요. 경통을 지지하며 필요한 축 잠금·마찰 상태를 만들고, 부품을 내려놓을 낮고 안정된 자리를 마련해요.','완성된 무게추형 경위대 옆에 꺼진 전원 표시와 부품을 놓을 받침이 있다.',ground()+az_front(288,235,.75)+circle(534,91,32,WHITE)+path('M534 62V91M519 73a23 23 0 1 0 30 0',stroke=ORANGE,width=4)+text(534,152,'전원 끄기',20)+rect(418,304,155,28,MINT,6)+label(320,35,'철수 전 자세와 지지 확인'),'잠금·마찰만 믿고 무거운 부품에서 손을 떼지 않아요. 발은 무게추 바로 아래에서 비켜 둬요.'))
az_pack.append(step('받쳐 분리','경통과 추는 기종의 순서대로 하나씩 내려요','설명서의 철수 순서에 따라 경통과 추를 각각 받쳐 분리해요. 추를 뺄 때는 추를 먼저 지지한 뒤 필요한 끝 장치와 고정 나사를 풀고, 봉을 따라 천천히 빼요.','왼쪽의 경통과 오른쪽 수평 봉의 무게추를 각각 손으로 받쳐 분리하는 두 동작. 추는 봉 바깥쪽 화살표 방향으로 빠진다.',tube(167,157,.6)+hand(97,177)+hand(243,177,True)+rect(68,292,206,27,MINT,6)+arrow('M166 233V272')+rect(347,121,32,80,MINT,7)+path('M379 160H529',width=9)+az_weight(486,160,.75)+hand(465,204)+hand(521,204,True)+arrow('M463 83H536')+label(320,35,'분리 순서도 기종 설명서대로')+text(167,351,'경통을 받쳐 내려요',21)+text(474,302,'추는 하나씩 받쳐요',21),'한쪽을 분리할 때 전체 장비가 기울지 않도록 지지해요. 추 여러 개나 모든 잠금을 한꺼번에 풀지 않아요.'))
az_pack.append(step('봉·보관','추가 없는 봉을 정리하고 안정되게 보관해요','추를 모두 내린 뒤 빈 봉을 분리하거나 수납해요. 추는 굴러가거나 넘어지지 않는 낮은 곳에 놓고, 안전나사·캡 등 작은 고정 부품을 함께 챙겨요.','왼쪽 경위대의 빈 수평 봉이 분리되고, 아래에는 무게추 두 개가 낮은 받침 위에 놓여 있다.',az_cw_head(174,173,.75,False)+path('M271 124H431',width=9)+rect(431,109,9,30,GOLD,3,ORANGE)+arrow('M327 83H411')+cw(303,195,.68)+cw(303,457,.68)+rect(112,329,430,18,MINT,4)+check(194,248)+check(456,248)+label(320,35,'추를 모두 내린 뒤 봉 정리')+text(493,154,'빈 봉',22)+text(320,386,'추가 달린 채 봉을 빼지 않아요',21),'봉이 없는 고정형 추는 해당 연결 구조의 분리·보관 절차를 따라요.'))
add('altaz-counterweight-remove','scope-altaz-counterweight-remove','무게추형 경위대 · 철수와 보관','경위대 · 무게추 분리와 보관','경통과 추의 분리 순서는 가대마다 달라요. 부품을 하나씩 지지하며 설명서에 맞게 분리하세요.',az_pack)


# Each self-contained SVG is a horizontal storyboard. The viewer clips one frame;
# images remain sharp at every size, work offline and contain no external resources.
css='text{font-family:"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif}path,rect,circle,ellipse{stroke-linecap:round;stroke-linejoin:round}'
for guide in GUIDES:
    n=len(guide['steps'])
    frames=''.join(f'<g transform="translate({640*i} 0)">{rect(0,0,640,400,PAPER,0,"none")}{s["art"]}</g>' for i,s in enumerate(guide['steps']))
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{640*n}" height="400" viewBox="0 0 {640*n} 400"><title>{escape(guide["title"])}</title><desc>KJE LAB original explanatory drawings. {n} steps. Not to scale.</desc><style>{css}</style><defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1L8 5 1 9" fill="none" stroke="{ORANGE}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>{frames}</svg>'
    (HERE/(guide['key']+'.svg')).write_text(svg,encoding='utf-8')
    for s in guide['steps']:s.pop('art')
(HERE/'guide-data.json').write_text(json.dumps(GUIDES,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'Built {len(GUIDES)} original storyboards, {sum(len(g["steps"]) for g in GUIDES)} illustrated steps.')
