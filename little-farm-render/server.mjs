import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { firebaseIdentity, farmStore } from './google.mjs';
import { createHandler } from './handler.mjs';

const firebaseProject = 'kjelab-little-farm';
const configuredOrigin = process.env.RENDER_EXTERNAL_URL || '';
const endpoint = /^https:\/\/[a-z0-9-]+\.onrender\.com$/.test(configuredOrigin) ? configuredOrigin : '';
const origins = ['https://kjelab.kr', ...(endpoint ? [endpoint] : [])];
const {FARM_SERVICE_ACCOUNT, FARM_BRIDGE_URL, FARM_BRIDGE_KEY, FARM_ENROLLMENT_HASH} = process.env;
let api;
if (FARM_SERVICE_ACCOUNT && FARM_BRIDGE_URL && FARM_BRIDGE_KEY && FARM_ENROLLMENT_HASH) {
  api = createHandler({
    identity: firebaseIdentity(firebaseProject),
    store: farmStore(firebaseProject, JSON.parse(FARM_SERVICE_ACCOUNT)),
    bridgeUrl: FARM_BRIDGE_URL, bridgeKey: FARM_BRIDGE_KEY, enrollmentHash: FARM_ENROLLMENT_HASH, origins
  });
}
const source = await readFile(new URL('./index.html', import.meta.url), 'utf8');
if (source.includes('__FARM_FIREBASE_CONFIG__')) throw new Error('The Firebase client build has not been generated.');
const html = source.replace('__FARM_SAVE_ENDPOINT__', api && endpoint ? endpoint + '/api/farm-save' : '');
const json = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const port = Number(process.env.PORT || 10000);

const app = createServer(async (req,res) => {
  try {
    if (req.method === 'GET' && req.url === '/healthz') {
      res.writeHead(200,json).end(JSON.stringify({ok:true,ready:!!api}));
    } else if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store',
        'X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'}).end(html);
    } else if (req.url === '/api/farm-save') {
      if (!api) {
        res.writeHead(503,json).end('{"error":"network"}');
        return;
      }
      const carriesBody = !['GET','HEAD','OPTIONS'].includes(req.method);
      const request = new Request('http://localhost/api/farm-save', {
        method:req.method,
        headers:Object.fromEntries(['origin','authorization','content-type'].flatMap(key=>
          typeof req.headers[key]==='string'?[[key,req.headers[key]]]:[])),
        ...(carriesBody?{body:Readable.toWeb(req),duplex:'half'}:{})
      });
      const answer=await api(request);
      res.writeHead(answer.status,{...json,...Object.fromEntries(answer.headers)});
      res.end(answer.body?Buffer.from(await answer.arrayBuffer()):undefined);
    } else {
      res.writeHead(404,json).end('{"error":"missing"}');
    }
  } catch {
    if (!res.headersSent) res.writeHead(503,json);
    res.end('{"error":"network"}');
  }
});
app.requestTimeout = 15000;
app.headersTimeout = 10000;
app.listen(port,'0.0.0.0');
