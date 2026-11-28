// Room discovery uses PeerServer. Game messages travel over reliable WebRTC data channels.
async function makeNet(code, role, name) {
  const isHost = role === 'host';
  const hostId = 'kjelab-eco-v1-' + code;
  const id = isHost ? hostId : 'eco-player-' + crypto.randomUUID();
  const peer = new Peer(id);
  const members = new Map();
  const connections = new Map();
  let incoming, change, closed = false, established = false;
  let ready, fail;
  const started = new Promise((resolve, reject) => { ready = resolve; fail = reject; });
  const timeout = setTimeout(() => fail(new Error('방 연결 시간이 초과됐어요. 방 코드를 확인해 주세요. 학교 Wi-Fi에서 반복되면 다른 네트워크로 접속해 보세요.')), 35000);
  const own = {peer:id, kind:'viewer', presence:{name,role}};
  const list = () => [...members.values()].map(p => ({...p, sameTab:p.peer === id}));

  function setMembers(entries) {
    const old = new Map(members);
    members.clear();
    for (const entry of entries) members.set(entry.peer, entry);
    const current = list();
    const joined = current.filter(p => !old.has(p.peer));
    const left = [...old.values()].filter(p => !members.has(p.peer));
    if (change && (joined.length || left.length)) change({joined,left,updated:[]});
  }
  function shareRoster() {
    for (const c of connections.values()) {
      if (c.open && members.has(c.peer)) c.send({type:'members', entries:[...members.values()]});
    }
  }
  function deliver(body, from) {
    if (incoming && members.has(from)) incoming(body, {peer:from, sameTab:false});
  }
  function close() {
    if (closed) return;
    closed = true;
    clearTimeout(timeout);
    peer.destroy();
  }
  function drop(conn) {
    if (closed || connections.get(conn.peer) !== conn) return;
    connections.delete(conn.peer);
    if (isHost) {
      setMembers([...members.values()].filter(p => p.peer !== conn.peer));
      shareRoster();
    } else if (established) {
      deliver({k:'bye'}, hostId);
      setMembers([own]);
    } else fail(new Error('방과 연결되지 않았어요. 방 코드를 확인한 뒤 다시 들어와 주세요.'));
  }
  function attach(conn) {
    if (connections.has(conn.peer)) { conn.close(); return; }
    connections.set(conn.peer, conn);
    conn.on('open', () => { if (!isHost) conn.send({type:'join',name}); });
    conn.on('data', message => {
      if (closed || !message || typeof message !== 'object') return;
      if (isHost) {
        if (message.type === 'join' && !members.has(conn.peer)) {
          const playerName = cleanName(message.name);
          const reconnect = S && S.players.some(p => p.name === playerName && p.wasHuman && (p.ctrl === 'away' || p.ctrl === 'ai'));
          if (!playerName || members.size >= MAXP || (MODE === 'host' && !reconnect)) {
            conn.send({type:'denied', text: members.size >= MAXP ? '이미 3명이 모인 방이에요.' : '이미 게임을 시작한 방이에요.'});
            return;
          }
          const entry = {peer:conn.peer,kind:'viewer',presence:{name:playerName,role:'guest'}};
          // Announce the new roster before synchronizing the game for a returning guest.
          conn.send({type:'members', entries:[...members.values(),entry]});
          setMembers([...members.values(),entry]); shareRoster();
        } else if (message.type === 'game' && members.has(conn.peer) && ['mine','st','ans'].includes(message.body?.k)) {
          for (const other of connections.values()) {
            if (other !== conn && members.has(other.peer) && other.open) other.send({type:'game',from:conn.peer,body:message.body});
          }
          deliver(message.body, conn.peer);
        }
      } else if (conn.peer === hostId) {
        if (message.type === 'denied') fail(new Error(message.text));
        if (message.type === 'members' && Array.isArray(message.entries) && message.entries.some(p=>p.peer===id)) {
          setMembers(message.entries); ready();
        }
        if (message.type === 'game') deliver(message.body, message.from);
      }
    });
    conn.on('close', () => drop(conn));
    conn.on('error', () => { drop(conn); conn.close(); });
  }
  peer.on('connection', conn => { if (isHost) attach(conn); else conn.close(); });
  peer.on('open', () => {
    if (established) return;
    if (isHost) { setMembers([own]); ready(); }
    else attach(peer.connect(hostId, {reliable:true, serialization:'binary'}));
  });
  peer.on('disconnected', () => {
    if (!closed && established && !peer.destroyed) {
      try { peer.reconnect(); } catch (_) { /* Open data channels continue to work. */ }
    }
  });
  peer.on('error', error => {
    if (!established) fail(new Error(error.type === 'peer-unavailable' ? '열려 있는 방을 찾지 못했어요. 방 코드를 확인해 주세요.' : '연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.'));
  });
  try { await started; established = true; } catch (error) { close(); throw error; }
  clearTimeout(timeout);
  return {
    self:()=>id, peers:list, on:fn=>{ incoming=fn; }, onPeers:fn=>{ change=fn; },
    send(body) {
      for (const conn of connections.values()) {
        if (conn.open && members.has(conn.peer)) conn.send({type:'game', from:id, body});
      }
    }, leave:close
  };
}
