/* The west survey and mail railway share the voyage inventory and journal. */
(() => {
  'use strict';
  const choice=(id,label)=>({id,label});
  const view=(title,text,choices=[],kind)=>({title,text,choices:[...choices,choice('close','닫기')],kind});
  const log=(s,text)=>{if(!s.log.includes(text))s.log.push(text);};
  const contents={
    chipLeft:{name:'왼쪽 표지석 가루',detail:'왼쪽 갱구 표지석에서 떨어진 흰 가루. 종이 봉투에 따로 담았다.'},
    chipRight:{name:'오른쪽 표지석 가루',detail:'오른쪽 갱구 표지석 아래에서 모은 흰 가루.'},
    acidKit:{name:'식초와 유리 스포이트',detail:'종지에 담은 돌가루에 식초를 떨어뜨릴 수 있다.'},
    mailCard:{name:'준이 보낸 엽서',detail:'물결 소인이 찍힌 엽서. 수신인은 석 어르신이다.'},
    westStamp:{name:'서안 우편 소인',detail:'물결과 수레바퀴가 새겨진 기념 소인.'}
  };
  const defaults={chartRead:false,elderMet:false,chipLeft:false,chipRight:false,acidKit:false,leftWet:false,rightWet:false,westFound:false,caseLoaded:false,cartSent:false,mailCard:false,westStamp:false};
  const isField=id=>id==='quarry'||id==='mailcave';
  function take(s,id,text){if(s[id])return null;s[id]=true;return {pickup:id,text};}
  const note='석 어르신의 작은 글씨가 보인다. “짐칸으로 가는 길에는 석영 표지석, 우편을 내리던 길에는 방해석 표지석을 세웠다.” 지도 모서리가 찢어져 두 입구의 좌우 표시는 남아 있지 않다.';
  function survey(s){
    if(s.northDelivered){s.chartRead=true;log(s,'측량도 여백 · 방해석 표지석이 선 입구가 옛 우편길이다.');}
    return view('석 어르신의 측량도',s.northDelivered?note:'광업소에서 서쪽 해안으로 이어지는 선이 그려져 있다.',[],'survey');
  }
  function goal(s){
    if(s.westStamp)return isField(s.scene)?'서쪽 우편길이 열렸다. 우편굴의 해안길과 북암 부두를 오갈 수 있다.':'서안 우편 소인이 가방에 있다. 북암의 해안길을 자유롭게 둘러보자.';
    if(s.scene==='mailcave'){
      if(s.mailCard)return '엽서의 수신인은 석 어르신이다. 광업소 마당으로 돌아가자.';
      if(s.cartSent)return '오른쪽 인도대에 도착한 수레의 함에서 우편물을 꺼내자.';
      if(s.caseLoaded)return '황동 전환기로 선로를 인도대 쪽에 맞춰 수레를 보내자.';
      return '기울어진 우편차 안에 남은 우편물을 찾아보자.';
    }
    if(s.scene==='quarry'){
      if(s.mailCard)return '작업대 곁에 기다리는 석 어르신에게 준의 엽서를 전하자.';
      if(s.westFound)return '우편굴은 오른쪽 갱구로 이어진다. 선로를 따라 들어가자.';
      if(!s.elderMet)return '작업대 앞 석 어르신이 두 갱구 쪽을 바라보고 있다. 말을 걸어 보자.';
      if(!s.chartRead)return '가방에서 측량도를 펼쳐 석 어르신이 남긴 표시를 읽자.';
      if(!s.chipLeft||!s.chipRight)return '두 갱구의 흰 표지석 아래에서 가루를 따로 모으자.';
      if(!s.acidKit)return '광업소 사무실 문가에서 식초와 스포이트를 챙기자.';
      if(!s.leftWet||!s.rightWet)return '작업대에서 두 표지석 가루에 식초를 떨어뜨려 비교하자.';
      return '두 종지에서 본 차이와 측량도의 메모를 대조해 우편굴 입구를 찾자.';
    }
    return s.scene==='north'?'우체소 옆 오르막의 광업소 이정표를 따라가자.':'북암의 서쪽 갱구로 가는 길이 열렸다. 우편정을 타고 북암으로 가자.';
  }
  function elder(s){
    if(s.westStamp)return view('석 어르신','어르신은 엽서를 접어 넣고, 손수레가 다니는 소리에 고개를 든다. “이제 저 소리만 들으면 우편 올 때인 줄 알겠구나.”',[choice('west_optics','결정으로 글씨 다시 보기')]);
    if(s.mailCard)return view('받는 사람 · 석 선생님','석 어르신이 돋보기를 꺼낸다. “누가 이 옛 주소로 보냈을까.”',[choice('west_deliver','준의 엽서 건네기')]);
    s.elderMet=true;
    return view('광업소 측량사였던 석 어르신','“여기서 일할 땐 배 대신 작은 수레로 우편을 날랐어. 마지막 우편차가 들어오던 날 문을 닫았지. 내 앞으로 온 것도 한 장 있었는데.”\n두 갱구의 나무 간판은 글씨가 다 벗겨졌다. 어르신이 접힌 측량도 귀퉁이를 짚는다.',[choice('west_chart','측량도 펼치기')]);
  }
  function marker(s,right){
    const id=right?'chipRight':'chipLeft',side=right?'오른쪽':'왼쪽';
    if(!s[id])return take(s,id,side+' 표지석 밑의 가루를 작은 종이 봉투에 담았다.');
    return view(side+' 표지석','비에 씻긴 흰 표지석이다. 이곳에서 챙긴 가루는 '+side+' 봉투에 넣어 두었다.');
  }
  function testing(s){
    if(!s.chipLeft||!s.chipRight||!s.acidKit)return view('광업소 작업대','빈 종지가 두 개 있다. 갱구마다 표지석에서 떨어진 가루를 따로 모아 놓고, 사무실 문가의 식초로 비교할 수 있다.');
    return view('두 표지석의 흔적','두 종지에 같은 양의 가루를 놓았다. 같은 식초를 한 방울씩 떨어뜨려 보자.',[],'west-assay');
  }
  function portal(s,right){
    if(right&&s.westFound)return view('물결 소인이 남은 통로','밝은 출구까지 작은 우편 수레의 선로가 이어진다.',[choice('west_enter','우편굴로 걷기')]);
    if(!s.chartRead||!s.leftWet||!s.rightWet)return view('바랜 갱구 간판','양쪽 나무 간판의 글씨가 지워졌다. 측량도의 메모와 두 표지석 가루의 관찰 기록을 대조하면 옛 우편길을 알아볼 수 있다.',[choice('west_chart','측량도 읽기')]);
    return view(right?'오른쪽 갱구':'왼쪽 갱구',right?'이쪽 가루에 식초를 떨어뜨리자 작은 기포가 올라왔다.':'이쪽 가루에 식초를 떨어뜨렸을 때 눈에 띄는 기포가 없었다.',[choice(right?'west_enter':'west_siding','이 입구의 선로 따라가기'),choice('west_chart','지도와 대조하기')]);
  }
  function spot(s,id){
    if(s.scene==='north'&&id==='westTrail')return view('북암 서쪽 갈림길',s.westStamp?'새 우편 깃발이 바닷바람에 펄럭인다. 산길과 우편굴 해안길이 여기서 갈라진다.':'우체소 옆 돌층계가 석 어르신의 옛 광업소로 이어진다.',[choice('west_climb','광업소로 걷기'),...(s.westStamp?[choice('west_coastIn','해안길로 우편굴 가기')]:[])]);
    if(s.scene==='quarry'){
      switch(id){
        case 'elder':return elder(s);
        case 'bench':return testing(s);
        case 'leftPile':return marker(s,false);
        case 'rightPile':return marker(s,true);
        case 'supply':return s.acidKit?view('사무실 공구함','스포이트와 식초는 가방에 있다. 작업대에 깨끗한 종지 두 개가 놓여 있다.'):take(s,'acidKit','새로 가져다 둔 식초와 유리 스포이트를 챙겼다.');
        case 'leftDoor':return portal(s,false);
        case 'rightDoor':return portal(s,true);
        case 'downhill':return view('북암으로 내려가는 길','바람우체소 지붕 너머로 물새호가 보인다.',[choice('west_descend','북암 부두로 걷기')]);
      }
    }
    if(s.scene==='mailcave'){
      switch(id){
        case 'exit':return view('광업소로 난 출구','어르신이 기다리는 광업소 마당으로 이어진다.',[choice('west_leave','광업소로 돌아가기')]);
        case 'rack':return view('낡은 배달 칸','나무 칸마다 주소 대신 그림이 새겨져 있다. 맨 오른쪽 칸의 물결은 서안 우편 인도대 표시다. 낡은 운송표 아래 “보관선은 왼쪽, 인도대는 오른쪽”이라는 글씨가 남았다.');
        case 'wreck':return s.caseLoaded?view('빈 우편차','무거운 우편함이 놓였던 자리에 네모난 먼지 자국이 남았다.'):view('기울어진 우편차','방수 덮개 속에서 묵직한 우편함이 나왔다. 위에는 “인도대에서 개봉”이라는 납작한 꼬리표가 달렸다. 바로 곁에 낮은 수레가 서 있다.',[choice('west_load','우편함을 손수레로 옮기기')]);
        case 'switch':return s.cartSent?view('인도대로 맞춘 선로','오른쪽 인도대에서 수레를 열 수 있다.'):s.caseLoaded?view('선로 전환기','분기점의 손잡이를 움직여 수레가 갈 선로를 잇고, 감개를 돌리자.',[],'west-switch'):view('황동 선로 전환기','빈 수레의 바퀴가 제동쇠에 걸려 있다. 먼저 옛 우편차의 짐을 실어야 한다.');
        case 'delivery':return s.mailCard||s.westStamp?view('서쪽 인도대','우편함 뚜껑이 열려 있다. 오래된 소인만 바닥에 찍혀 있다.'):view('우편함의 마지막 한 통','젖은 바깥 덮개를 걷자, 마른 안쪽 칸에 물결 소인이 찍힌 엽서 한 장이 붙어 있다.',[choice('west_unseal','엽서 꺼내 뒤집기')]);
        case 'coast':return s.westStamp?view('다시 열린 해안길','물결 깃발 아래로 내려가면 북암 부두다.',[choice('west_coastOut','북암 부두로 걷기')]):view('서안 해안길','빗장이 걸려 있다. 석 어르신의 허리춤에 이 문과 같은 물결 표식의 열쇠가 달려 있었다.');
      }
    }
    return null;
  }
  function act(s,id){
    if(!s.northDelivered)return null;
    const q=s.scene==='quarry',c=s.scene==='mailcave',n=s.scene==='north';
    switch(id){
      case 'west_chart':return survey(s);
      case 'west_climb':if(!n)return null;s.scene='quarry';return view('셋째 장 · 서쪽 갱구의 우편함','선로는 마당 끝에서 둘로 갈라진다. 작업대 옆에서 석 어르신이 빛바랜 표지판을 들여다본다.');
      case 'west_descend':if(!q)return null;s.scene='north';return null;
      case 'west_left':case 'west_right':{
        if(!q||!s.acidKit||!s.chipLeft||!s.chipRight)return null;
        const right=id==='west_right';s[right?'rightWet':'leftWet']=true;
        log(s,right?'오른쪽 표지석 가루 · 식초를 떨어뜨리자 작은 기포가 올라왔다.':'왼쪽 표지석 가루 · 같은 식초를 떨어뜨려도 눈에 띄는 기포가 없었다.');
        return testing(s);
      }
      case 'west_siding':if(!q||!s.chartRead||!s.leftWet||!s.rightWet)return null;
        return view('막다른 적재선','석탄을 달던 저울에서 선로가 끝난다. 뒤집힌 운임표에는 짐 무게만 적혀 있다. 바깥으로 몇 걸음 돌아오니 다른 갱구가 보인다.');
      case 'west_enter':if(!q||!(s.westFound||(s.chartRead&&s.leftWet&&s.rightWet)))return null;
        s.westFound=true;s.scene='mailcave';log(s,'두 표지석을 대조해 방해석 표지가 있는 옛 우편굴을 찾았다.');
        return view('서쪽 우편굴','옛 우편차의 천 덮개가 바람에 들썩인다. 한쪽에는 배달 칸들이, 반대편에는 선로 전환기가 남아 있다.');
      case 'west_load':if(!c||s.caseLoaded)return null;s.caseLoaded=true;return {fieldNotice:'우편함을 실었다. 전환기에서 인도대 쪽 선로를 잇자.'};
      case 'west_park':if(!c||!s.caseLoaded||s.cartSent)return null;return {fieldNotice:'수레가 보관선 끝에서 멈췄다. 줄을 되감아 다시 보낼 수 있다.',shunt:true};
      case 'west_send':if(!c||!s.caseLoaded||s.cartSent)return null;s.cartSent=true;log(s,'손수레로 봉인한 우편함을 서안 인도대까지 옮겼다.');return {fieldNotice:'감개가 풀리며 우편함을 실은 수레가 오른쪽으로 굴러간다.'};
      case 'west_unseal':if(!c||!s.cartSent||s.mailCard||s.westStamp)return null;s.mailCard=true;
        return view('준의 엽서','받는 사람은 북암 광업소의 석 선생님. 서른 해 전 소인이 찍혀 있다.',[],'west-postcard');
      case 'west_leave':if(!c)return null;s.scene='quarry';return null;
      case 'west_deliver':if(!q||!s.mailCard||s.westStamp)return null;
        s.mailCard=false;s.westStamp=true;log(s,'서른 해 전의 엽서를 석 어르신에게 전했다. 어르신에게서 서안 해안길의 열쇠를 받았다.');
        return view('셋째 장 끝 · 서른 해 만의 배달','“식초엔 안 넣었다. 서른 해 동안.” 어르신이 주머니에서 엄지만 한 투명한 방해석을 꺼내 엽서 위에 올린다. 열 살짜리 준이 갱 입구에서 주워 준 돌이다.\n어르신은 항해일지에 물결 소인을 찍고 해안길 열쇠를 건넨다.',[choice('west_optics','어르신의 결정으로 글씨 보기')],'west-postcard');
      case 'west_optics':if(!q||!s.westStamp)return null;return view('석 어르신의 방해석','엽서의 글씨에 결정을 올리고 천천히 돌려 보자.',[],'west-optics');
      case 'west_coastOut':if(!c||!s.westStamp)return null;s.scene='north';return null;
      case 'west_coastIn':if(!n||!s.westStamp)return null;s.scene='mailcave';return null;
    }
    return null;
  }
  window.WestStory={defaults,contents,isField,survey,spot,act,goal};
})();
