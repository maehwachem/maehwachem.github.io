const {test}=require('node:test');
const assert=require('node:assert/strict');
const {normalizeURL,filename}=require('../core.js');
test('preserves reference queries and slide fragments',()=>{
  assert.equal(normalizeURL(' https://kjelab.kr/lectures/energy-efficiency.html?s=1#2.1 '),'https://kjelab.kr/lectures/energy-efficiency.html?s=1#2.1');
  assert.equal(normalizeURL('example.com/resource?a=1&b=2'),'https://example.com/resource?a=1&b=2');
});
test('encodes Korean links without losing their text',()=>{
  const url=normalizeURL('https://example.com/참고자료?q=에너지');
  assert.equal(decodeURI(url),'https://example.com/참고자료?q=에너지');
});
test('rejects non-web payloads, incomplete addresses and credentials',()=>{
  for(const value of ['', 'javascript:alert(1)','data:text/html,hello','file:///tmp/file','mailto:a@example.com','https://','자료 주소','https://name:password@example.com'])assert.throws(()=>normalizeURL(value),undefined,value);
});
test('checks encoded byte length, not just the visible Korean text length',()=>{
  assert.throws(()=>normalizeURL('https://example.com/'+ '가'.repeat(250)),/너무 깁니다/);
});
test('download filenames remain usable',()=>{
  assert.equal(filename('자료: 1/2?'),'자료 12-QR');
  assert.equal(filename('???'),'참고자료-QR');
});
