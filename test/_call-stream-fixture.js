const fs = require('node:fs');
// 实跑引擎发送方 postOpenAI：响应桩使用它请求的 chat/completions SSE 协议。
exports.streamFixture = (chunks, options = {}) => {
  const src = fs.readFileSync('js/engine.js', 'utf8');
  const code = src.slice(src.indexOf('  const postOpenAI = async'), src.indexOf('  const _ntKey2 ='));
  let reads = 0, cancels = 0;
  const encoder = new TextEncoder();
  const reader = {
    read: async () => {
      reads++;
      if (chunks.length) return { value: encoder.encode(chunks.shift()), done: false };
      return new Promise(() => {}); // 故意永不 EOF，复现“说完了还在等”。
    },
    cancel: () => { cancels++; return Promise.reject(new Error('网关取消失败')); }
  };
  const request = opts => new Function('opts', 'fetchT', 'TextDecoder', `
    const model='fixture', maxTokens=100000, wireMessages=[], system='', root='https://fixture.invalid/v1',
      temp=0.7, _mcpTools=null, viaProxy=null, reqTimeout=1000, p={apiKey:'fake'}, captureWirePayload=()=>{},
      // v74.873 起 postOpenAI 会问一句「这枪是不是走秋秋的礼物那条线」（engine.js giftHeaders）。
      //   这份桩只测流式收发，跟那条线无关，所以给个空的（施工规则/stub-from-the-writer）。
      giftHeaders=()=>({});
    ${code}; return postOpenAI(true);
  `)({ stream: true, streamSilenceMs: 30, ...options, ...opts }, async () => ({
    headers: { get: () => 'text/event-stream' }, body: { getReader: () => reader }
  }), TextDecoder);
  return { request, reads: () => reads, cancels: () => cancels };
};
exports.delta = text => 'data: ' + JSON.stringify({ choices: [{ index: 0, delta: { content: text }, finish_reason: null }] }) + '\n\n';
