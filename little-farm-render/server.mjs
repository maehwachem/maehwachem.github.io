import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { firebaseIdentity, farmStore } from './google.mjs';
import { createHandler } from './handler.mjs';

const firebaseProject = 'kjelab-little-farm';
const configuredOrigin = process.env.RENDER_EXTERNAL_URL || '';
const endpoint = /^https:\/\/[a-z0-9-]+\.onrender\.com$/.test(configuredOrigin) ? configuredOrigin : '';
const origins = ['https://kjelab.kr', ...(endpoint ? [endpoint] : [])];
const {FARM_SERVICE_ACCOUNT, FARM_BRIDGE_URL, FARM_BRIDGE_KEY, FARM_OPERATOR_EMAIL} = process.env;
let api;
if (FARM_SERVICE_ACCOUNT && FARM_BRIDGE_URL && FARM_BRIDGE_KEY) {
  api = createHandler({
    identity: firebaseIdentity(firebaseProject),
    store: farmStore(firebaseProject, JSON.parse(FARM_SERVICE_ACCOUNT)),
    bridgeUrl: FARM_BRIDGE_URL, bridgeKey: FARM_BRIDGE_KEY, operatorEmail: FARM_OPERATOR_EMAIL?.trim().toLowerCase(), origins
  });
}
const [source, dashboard] = await Promise.all(['index.html','admin.html'].map(name =>
  readFile(new URL(name, import.meta.url), 'utf8')));
const configMarker = '/* __FARM_FIREBASE_CONFIG__ */ {}';
if (!source.includes(configMarker) || !dashboard.includes(configMarker)) throw new Error('The Firebase web config placeholder is missing.');

const firebaseWebApiKey = process.env.FARM_FIREBASE_WEB_API_KEY || '';
const firebaseConfig = api && endpoint && /^AIza[A-Za-z0-9_-]{35}$/.test(firebaseWebApiKey)
  ? {
      apiKey: firebaseWebApiKey,
      authDomain: firebaseProject + '.firebaseapp.com',
      projectId: firebaseProject,
      appId: '1:125750963712:web:4a3637f7e2d086b99df2e5'
    }
  : {};
const html = source
  .replace(configMarker, JSON.stringify(firebaseConfig))
  .replace('__FARM_SAVE_ENDPOINT__', firebaseConfig.apiKey ? endpoint + '/api/farm-save' : '');
const adminHtml = dashboard.replace(configMarker, JSON.stringify(firebaseConfig));
const json = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const port = Number(process.env.PORT || 10000);

const app = createServer(async (req,res) => {
  try {
    const art = req.method === 'GET' && /^\/art\/v1\/(lettuce|carrot|tomato|strawberry|sunflower|paprika|plots9|plots12|greenhouse)\.webp$/.exec(req.url);
    if (req.method === 'GET' && req.url === '/healthz') {
      res.writeHead(200,json).end(JSON.stringify({ok:true,ready:!!api}));
    } else if (req.method === 'GET' && ['/', '/admin', '/admin/'].includes(req.url)) {
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store',
        'X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow', ...(req.url === '/' ? {} : {'X-Frame-Options':'DENY'})}).end(req.url === '/' ? html : adminHtml);
    } else if (art) {
      const image = await readFile(new URL('./art/' + art[1] + '.webp', import.meta.url));
      res.writeHead(200,{'Content-Type':'image/webp','Cache-Control':'public, max-age=31536000, immutable',
        'X-Content-Type-Options':'nosniff'}).end(image);
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
