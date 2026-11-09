'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { WebSocket, WebSocketServer } = require('ws');
const {randomBytes, randomInt} = require('node:crypto');
const worlds = require('./worlds.json');
const {createBotController} = require('./bots.cjs');
const botsByMap = Object.fromEntries(Object.entries(worlds).map(([id, world]) => [id, createBotController(world)]));
const validMap = id => typeof id === 'string' && Object.hasOwn(worlds, id);
const MAX_HP = 3, MAX_AMMO = 3, BALL_RADIUS = .12, PLAYER_RADIUS = .4;
const WALK_SPEED = 4.6, RUN_SPEED = 6.6;
const BODY = [[.44,.44],[1.02,.35],[1.52,.27]];
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DT = .025, LOST_SEAT_MS = 15000;

const opposing = side => side === 'blue' ? 'red' : 'blue';
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const finite = (value, otherwise = 0) => Number.isFinite(value) ? value : otherwise;
const online = player => player.bot || Boolean(player.socket);
const people = room => [...room.players.values()].filter(player => !player.bot);
const waitingForPlayer = room => people(room).some(player=>!player.socket);
const modes = {team:4,coop:2,duel:2};
const freshInput = () => ({mx:0,my:0,gather:false,crouch:false,run:false});
const nearPile = (world, player) => world.piles.some(pile => Math.hypot(player.x-pile.x, player.z-pile.z) < 1.9);

function resolveWall(player, wall) {
  const dx = player.x - clamp(player.x, wall.minX, wall.maxX);
  const dz = player.z - clamp(player.z, wall.minZ, wall.maxZ);
  const distance = Math.hypot(dx, dz);
  if (distance >= PLAYER_RADIUS) return;
  if (distance > 0) {
    const scale = (PLAYER_RADIUS-distance)/distance;
    player.x += dx*scale; player.z += dz*scale;
    return;
  }
  const distances = [player.x-wall.minX, wall.maxX-player.x, player.z-wall.minZ, wall.maxZ-player.z];
  const side = distances.indexOf(Math.min(...distances));
  if (side===0) player.x=wall.minX-PLAYER_RADIUS;
  if (side===1) player.x=wall.maxX+PLAYER_RADIUS;
  if (side===2) player.z=wall.minZ-PLAYER_RADIUS;
  if (side===3) player.z=wall.maxZ+PLAYER_RADIUS;
}

function separate(player, other, minimum) {
  const dx=player.x-other.x, dz=player.z-other.z, distance=Math.hypot(dx,dz);
  if (distance >= minimum || distance === 0) return;
  const scale=(minimum-distance)/distance;
  player.x += dx*scale; player.z += dz*scale;
}

function begin(room) {
  const {spawn} = worlds[room.mapId];
  room.hp = {blue:MAX_HP, red:MAX_HP};
  room.balls = []; room.winner = null; room.phase = 'play'; room.round++;
  for (const side of ['blue','red']) {
    const members = [...room.players.values()].filter(player => player.side===side);
    members.forEach((player,index) => {
      Object.assign(player,{
        x: spawn[side][index].x, z: spawn[side][index].z,
        yaw: side==='blue' ? 0 : Math.PI, pitch:.3, ammo:MAX_AMMO,
        input:freshInput(), inputAt:0, gatherTime:0, crouch:false, gathering:false,
        stun:0, invulnerable:0, cooldown:0, throwAnim:0, shotUntil:0, shot:0, hit:0,
        route:null, refilling:false, blockedReload:null, nextShotAt:0, station:0,
      });
    });
  }
}

function fire(room, player) {
  const {yaw,pitch}=player, sin=Math.sin(yaw), cos=Math.cos(yaw), speed=15;
  room.balls.push({
    id:++room.ballId, side:player.side, x:player.x+.3*(cos-sin), y:1.55, z:player.z-.3*(sin+cos),
    vx:-sin*Math.cos(pitch)*speed, vy:Math.sin(pitch)*speed, vz:-cos*Math.cos(pitch)*speed, age:0,
  });
  player.ammo--; player.cooldown=.34; player.throwAnim=.28; player.shot++;
  player.gatherTime=0;
}

function movePlayers(room, now) {
  const world = worlds[room.mapId], {obstacles, targets, limits} = world;
  for (const player of room.players.values()) {
    player.cooldown=Math.max(0,player.cooldown-DT);
    player.stun=Math.max(0,player.stun-DT);
    player.invulnerable=Math.max(0,player.invulnerable-DT);
    player.throwAnim=Math.max(0,player.throwAnim-DT);
    if(player.bot) botsByMap[room.mapId](player,now,p => nearPile(world,p));
    const active=player.bot || (Boolean(player.socket) && now-player.inputAt < 400);
    const input=active ? player.input : freshInput();
    if(active && player.shotUntil>now && !player.stun && !player.cooldown && player.ammo){
      fire(room,player);player.shotUntil=0;
    } else if(!active || player.shotUntil<=now || !player.ammo) player.shotUntil=0;
    player.gathering=input.gather && !player.stun && !player.throwAnim && player.ammo<MAX_AMMO && nearPile(world,player);
    player.crouch=input.crouch || player.gathering;
    if (player.gathering) {
      player.gatherTime+=DT;
      if (player.gatherTime>=.75-1e-6) {player.ammo++; player.gatherTime=0;}
    } else player.gatherTime=0;
    if (player.stun || player.gathering) continue;
    const pace=player.bot ? 3.35 : input.run ? RUN_SPEED : WALK_SPEED;
    const speed=(player.crouch ? 2 : pace)*DT, length=Math.max(1,Math.hypot(input.mx,input.my));
    const mx=input.mx/length, my=input.my/length;
    player.x+= (Math.cos(player.yaw)*mx-Math.sin(player.yaw)*my)*speed;
    player.z+= (-Math.sin(player.yaw)*mx-Math.cos(player.yaw)*my)*speed;
    for (const other of room.players.values()) if (other!==player && online(other)) separate(player,other,.8);
    if(room.mode!=='duel') for (const target of Object.values(targets)) separate(player,target,.84);
    for(let pass=0;pass<2;pass++) for(const wall of obstacles) resolveWall(player,wall);
    player.x=clamp(player.x,-limits[0],limits[0]); player.z=clamp(player.z,-limits[1],limits[1]);
  }
}

function hurtSide(room,side,attacker){
  room.hp[side]--;
  if (!room.hp[side]) {room.winner=attacker; room.phase='result'; room.activityAt=Date.now();}
}
function impacts(room, ball) {
  const {obstacles, targets} = worlds[room.mapId];
  for (const player of room.players.values()) {
    if (!online(player) || player.side===ball.side) continue;
    if (Math.hypot(ball.x-player.x,ball.z-player.z)<.48 && ball.y>0 && ball.y<(player.crouch?1:1.62)+BALL_RADIUS) {
      if (!player.invulnerable) {
        player.stun=.45; player.invulnerable=1.25; player.hit++;
        if(room.mode==='duel') hurtSide(room,player.side,ball.side);
      }
      return true;
    }
  }
  const side = opposing(ball.side), target=targets[side];
  if (room.mode!=='duel' && BODY.some(([y,r]) => Math.hypot(ball.x-target.x,ball.y-y,ball.z-target.z)<r+BALL_RADIUS)) {
    hurtSide(room,side,ball.side);
    return true;
  }
  return ball.y<BALL_RADIUS || obstacles.some(o =>
    ball.y<o.h+BALL_RADIUS && ball.x>o.minX-BALL_RADIUS && ball.x<o.maxX+BALL_RADIUS &&
    ball.z>o.minZ-BALL_RADIUS && ball.z<o.maxZ+BALL_RADIUS);
}

function moveBalls(room) {
  const substep=DT/3;
  for (let i=room.balls.length-1; i>=0; i--) {
    const ball=room.balls[i];
    ball.age+=DT;
    let dead=ball.age>6;
    for (let n=0;n<3 && !dead;n++) {
      ball.vy-=9.8*substep;
      ball.x+=ball.vx*substep; ball.y+=ball.vy*substep; ball.z+=ball.vz*substep;
      dead=impacts(room,ball);
      if (room.phase==='result') {room.balls=[]; return;}
    }
    if (dead) room.balls.splice(i,1);
  }
}

function snapshot(room) {
  return {
    code:room.code, mode:room.mode, mapId:room.mapId, targets:worlds[room.mapId].targets, capacity:room.capacity, phase:room.phase, host:room.host, round:room.round, winner:room.winner, hp:room.hp,
    waiting:room.phase==='play' && waitingForPlayer(room),
    players:[...room.players.values()].map(p => ({
      id:p.id,name:p.name,side:p.side,bot:Boolean(p.bot),connected:online(p),x:p.x,z:p.z,yaw:p.yaw,pitch:p.pitch,
      ammo:p.ammo,crouch:p.crouch,gathering:p.gathering,gatherTime:p.gatherTime,throwAnim:p.throwAnim,shot:p.shot,hit:p.hit,
    })),
    balls:room.balls.map(({id,x,y,z})=>({id,x,y,z})),
  };
}

function broadcast(room) {
  const message = JSON.stringify({type:'state', state:snapshot(room)});
  for (const player of people(room)) {
    const socket = player.socket;
    if (socket?.readyState === WebSocket.OPEN && socket.bufferedAmount < 32768) socket.send(message);
  }
}

function removePlayer(room, player) {
  room.players.delete(player.id);
  if (room.phase === 'play') {
    room.phase = 'result';
    room.winner = 'interrupted';
    room.balls = [];
  }
  room.activityAt = Date.now();
  broadcast(room);
}

const ROOM_CODE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ2-9]{8}$/;
const MAX_ROOMS = 32;
const ROOM_IDLE_MS = 30 * 60 * 1000;

function createServer({publicOrigin = ''} = {}) {
  const rooms = new Map();
  function closeRoom(room, code, reason) {
    rooms.delete(room.code);
    const notice = JSON.stringify({type:'room_closed', code});
    for (const player of people(room)) {
      const socket = player.socket;
      player.socket = null;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(notice);
        socket.close(code, reason);
      }
    }
  }

  const html = fs.readFileSync(path.join(__dirname, 'index.html'));
  const server = http.createServer((request, response) => {
    const pathname = request.url.split('?')[0];
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    if (request.method === 'GET' && pathname === '/healthz') {
      response.writeHead(200, {'Content-Type':'text/plain; charset=utf-8'}).end('ok');
    } else if (request.method === 'GET' && ['/', '/snowball-alley.html'].includes(pathname)) {
      response.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}).end(html);
    } else {
      response.writeHead(404).end();
    }
  });
  const wss = new WebSocketServer({
    noServer:true, maxPayload:4096, maxFragments:32, maxBufferedChunks:32, perMessageDeflate:false,
  });

  server.on('upgrade', (request, socket, head) => {
    const port = server.address().port;
    const origins = publicOrigin ? [publicOrigin] : ['http://127.0.0.1:' + port, 'http://localhost:' + port];
    if (request.url !== '/ws' || !origins.includes(request.headers.origin)) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      return;
    }
    if (wss.clients.size >= MAX_ROOMS * 5) {
      socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');
      return;
    }
    wss.handleUpgrade(request, socket, head, client => wss.emit('connection', client));
  });

  let admissionWindow = 0, admissionCount = 0;
  wss.on('connection', socket => {
    let room, player;
    let lastPong = Date.now(), inputWindow = lastPong, messageCount = 0;
    const admissionTimer = setTimeout(() => socket.close(1008, 'Join timeout'), 10000);
    const heartbeat = setInterval(() => {
      if (Date.now() - lastPong > 9500) socket.terminate();
      else if (socket.readyState === WebSocket.OPEN) socket.ping();
    }, 5000);
    const reply = message => socket.send(JSON.stringify(message));
    const reject = (code, message) => reply({type:'error', code, message});

    function attach(nextRoom, nextPlayer) {
      room = nextRoom;
      player = nextPlayer;
      const previous = player.socket;
      player.socket = socket;
      player.input = freshInput();
      player.inputAt = 0;
      player.shotUntil = 0;
      room.activityAt = Date.now();
      clearTimeout(admissionTimer);
      if (previous) previous.close(4001, 'Seat resumed elsewhere');
      reply({type:'seat', seat:{code:room.code, id:player.id, token:player.token}});
      broadcast(room);
    }

    socket.on('error', () => {});
    socket.on('pong', () => { lastPong = Date.now(); });
    socket.on('close', () => {
      clearTimeout(admissionTimer);
      clearInterval(heartbeat);
      if (!player || player.socket !== socket) return;
      player.socket = null;
      player.disconnectedAt = Date.now();
      for (const member of people(room)) {
        member.input = freshInput();
        member.inputAt = 0;
        member.shotUntil = 0;
      }
      broadcast(room);
    });

    socket.on('message', (raw, binary) => {
      if (socket.readyState !== WebSocket.OPEN) return;
      const now = Date.now();
      if (now - inputWindow >= 1000) {
        inputWindow = now;
        messageCount = 0;
      }
      if (++messageCount > 60) {
        socket.close(1008, 'Message limit');
        return;
      }
      let data;
      try { if (!binary) data = JSON.parse(raw.toString()); } catch {}
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return reject('invalid', '요청 형식을 확인해 주세요.');
      }

      if (!player) {
        if (now - admissionWindow >= 10000) {
          admissionWindow = now;
          admissionCount = 0;
        }
        if (++admissionCount > 120) return reject('busy', '잠시 후 다시 연결해 주세요.');
        if (data.type === 'resume') {
          const seat = data.seat;
          const existing = rooms.get(seat?.code);
          const member = existing?.players.get(seat?.id);
          if (!member || member.bot || member.token !== seat.token ||
              (!member.socket && now - member.disconnectedAt > LOST_SEAT_MS)) {
            return reject('expired', '이전 방을 찾을 수 없어요. 다시 입장해 주세요.');
          }
          attach(existing, member);
          return;
        }

        let nextRoom;
        if (data.type === 'create' && typeof data.mode === 'string' && Object.hasOwn(modes, data.mode)) {
          if (!validMap(data.mapId)) return reject('invalid_map', '경기장을 선택해 주세요.');
          if (rooms.size >= MAX_ROOMS) return reject('busy', '지금은 새 방을 열 수 없어요.');
          let code;
          do { code = Array.from({length:8}, () => ALPHABET[randomInt(ALPHABET.length)]).join(''); }
          while (rooms.has(code));
          const mode = data.mode;
          nextRoom = {code, mode, mapId:data.mapId, capacity:modes[mode], host:null, players:new Map(), phase:'lobby',
            round:0, winner:null, hp:{blue:3, red:3}, ballId:0, balls:[], activityAt:now};
          if (mode === 'coop') for (let i = 0; i < 2; i++) {
            const id = 'bot-' + i;
            nextRoom.players.set(id, {id, bot:true, botIndex:i, side:'red', name:'컴퓨터 ' + (i + 1)});
          }
          rooms.set(code, nextRoom);
        } else if (data.type === 'join') {
          const code = typeof data.code === 'string' ? data.code.trim().toUpperCase() : '';
          nextRoom = ROOM_CODE.test(code) ? rooms.get(code) : null;
          if (!nextRoom) return reject('not_found', '방 코드가 맞는지 확인해 주세요.');
        } else {
          return reject('invalid', '경기 방식을 확인해 주세요.');
        }

        const members = people(nextRoom);
        if (members.length >= nextRoom.capacity) return reject('full', '방의 자리가 모두 찼어요.');
        if (nextRoom.phase === 'play') return reject('in_play', '경기가 진행 중이에요.');
        const blue = members.filter(member => member.side === 'blue').length;
        const name = (typeof data.name === 'string' ? data.name.trim() : '').slice(0, 14) || '참가자 ' + (members.length + 1);
        const nextPlayer = {id:randomBytes(6).toString('hex'), token:randomBytes(18).toString('hex'), name,
          side:nextRoom.mode === 'coop' || blue <= members.length - blue ? 'blue' : 'red',
          socket:null, fire:0};
        nextRoom.players.set(nextPlayer.id, nextPlayer);
        nextRoom.host ??= nextPlayer.id;
        attach(nextRoom, nextPlayer);
        return;
      }

      if (player.socket !== socket) return;
      if (data.type === 'map') {
        if (player.id !== room.host) return reject('not_host', '방장만 경기장을 바꿀 수 있어요.');
        if (room.phase === 'play') return reject('in_play', '경기가 끝나면 경기장을 바꿀 수 있어요.');
        if (!validMap(data.mapId)) return reject('invalid_map', '경기장을 선택해 주세요.');
        room.mapId = data.mapId;
        room.activityAt = now;
        broadcast(room);
      } else if (data.type === 'start') {
        if (player.id !== room.host) return reject('not_host', '방장만 경기를 시작할 수 있어요.');
        const members = people(room);
        if (room.phase === 'play' || members.length !== room.capacity || waitingForPlayer(room)) {
          return reject('not_ready', '참가자가 모두 접속하면 시작할 수 있어요.');
        }
        begin(room);
        room.activityAt = now;
        broadcast(room);
      } else if (data.type === 'leave') {
        player.socket = null;
        if (player.id === room.host) closeRoom(room, 4003, 'Host left');
        else removePlayer(room, player);
        socket.close(1000);
      } else if (data.type === 'input') {
        if (room.phase !== 'play' || waitingForPlayer(room) || data.round !== room.round) return;
        player.input = {mx:clamp(finite(data.mx), -1, 1), my:clamp(finite(data.my), -1, 1),
          crouch:data.crouch === true, gather:data.gather === true, run:data.run === true};
        player.yaw = finite(data.yaw, player.yaw) % (2 * Math.PI);
        player.pitch = clamp(finite(data.pitch, player.pitch), -.12, 1.25);
        player.inputAt = now;
        if (Number.isSafeInteger(data.fire) && data.fire > player.fire) {
          player.fire = data.fire;
          player.shotUntil = now + 200;
        }
      } else {
        reject('invalid', '요청 형식을 확인해 주세요.');
      }
    });
  });

  let tick = 0;
  const timer = setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
      const host = room.players.get(room.host);
      if (!host.socket && now - host.disconnectedAt > LOST_SEAT_MS) {
        closeRoom(room, 4003, 'Host left');
        continue;
      }
      for (const player of people(room)) {
        if (!player.socket && now - player.disconnectedAt > LOST_SEAT_MS) removePlayer(room, player);
      }
      if (room.phase !== 'play' && now - room.activityAt > ROOM_IDLE_MS) {
        closeRoom(room, 4002, 'Room closed');
        continue;
      }
      if (room.phase === 'play') {
        if (!waitingForPlayer(room)) {
          movePlayers(room, now);
          moveBalls(room);
        }
        if (tick % 2 === 0 || room.phase === 'result') broadcast(room);
      } else if (tick % 40 === 0) {
        broadcast(room);
      }
    }
    tick++;
  }, DT * 1000);
  timer.unref();
  server.once('close', () => {
    clearInterval(timer);
    for (const socket of wss.clients) socket.terminate();
    wss.close();
  });
  return server;
}

if (require.main === module) {
  const port = Number(process.env.PORT || 8765);
  const configured = process.env.PUBLIC_ORIGIN || process.env.RENDER_EXTERNAL_URL;
  const origin = configured ? new URL(configured) : null;
  if (origin && origin.protocol !== 'https:') throw new Error('PUBLIC_ORIGIN must use https://');
  const server = createServer({publicOrigin:origin?.origin});
  server.listen(port, origin ? '0.0.0.0' : '127.0.0.1', () => {
    console.log('Snowball Alley: ' + (origin?.origin ?? 'http://127.0.0.1:' + port));
  });
}

module.exports = {createServer};
