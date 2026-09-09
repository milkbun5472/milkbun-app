const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
const src = fs.readFileSync('js/components.js', 'utf8');
const call = src.slice(src.indexOf('function CallScreen('), src.indexOf('// 匿名问答的夜色'));
test('通话声音走媒体通道，开麦兼容录音，释放按 context 所有权恢复', async () => {
  const extract = name => { const i = src.indexOf('function ' + name + '('); return src.slice(i, src.indexOf('\n}\n', i) + 3); };
  const session = { type: 'ambient' }, events = [];
  class Context {
    constructor() { this.state = 'suspended'; }
    resume() { events.push(session.type); this.state = 'running'; return Promise.resolve(); }
    createBuffer() { return {}; }
    createBufferSource() { return { connect() {}, start() {} }; }
  }
  const make = navigator => new Function('navigator', 'window', extract('routeCallAudio') + extract('prepareCallAudio') + '; return {routeCallAudio, prepareCallAudio};')(navigator, { AudioContext: Context });
  const { routeCallAudio: route, prepareCallAudio: prepare } = make({ audioSession: session });
  const first = prepare(); assert.equal(await first.ready, '');
  assert.deepEqual(events, ['playback']); // 先选通道再解锁，而不是 running 就当作可听见。
  route(first.ctx, 'play-and-record'); assert.equal(session.type, 'play-and-record');
  const second = prepare(); assert.equal(session.type, 'play-and-record');
  route(first.ctx, null); assert.equal(session.type, 'playback'); // 旧通话清理不能静音新通话。
  route(second.ctx, null); assert.equal(session.type, 'ambient');
  route(second.ctx, null); assert.equal(session.type, 'ambient');
  prepare(first.ctx); session.type = 'transient'; route(first.ctx, null);
  assert.equal(session.type, 'transient'); // 不覆盖别的媒体后来选择的模式。
  assert.equal(await make({}).prepareCallAudio().ready, '');
  assert.equal(await make({ get audioSession() { throw new Error('不支持'); } }).prepareCallAudio().ready, '');
  assert.match(call, /routeCallAudio\(st.ttsCtx, "play-and-record"\)/);
  assert.match(call, /routeCallAudio\(st.ttsCtx, audioRef.current.mounted && autoVoice && !bye \? "playback" : null\)/);
});
test('通话播放默认手动，播放偏好独立保存；语音和视频用同一队列', () => {
  for (const [key, state] of [['x_callAutoVoice', 'autoVoice']]) {
    assert.ok(src.includes('loadJSON("' + key + '", false)'));
    assert.ok(src.includes('saveJSON("' + key + '"'));
    assert.ok(call.includes(state));
  }
  assert.match(call, /if \(!autoVoice \|\| !audioReady \|\| bye\) return/);
  assert.match(call, /st.played = msgsRef.current.length/);
  assert.match(call, /m.role === "user" \|\| m.act \|\| !m.content/);
  assert.match(call, /audioRef.current.epoch === epoch/);
  assert.match(call, /min-h-0 overflow-y-auto/);
  // 沿实际写入方确认队列读取的角色与动作字段，而不是虚构消息 ID。
  const app = fs.readFileSync('js/app.js', 'utf8');
  assert.match(app, /const audioSession = callAutoVoice\(\) \? prepareCallAudio\(\) : null/);
  assert.match(app, /audioSession: call.audioSession/);
  assert.doesNotMatch(call, /data-call-options|h\(OnlineTranslationControl|toggleAutoVoice/);
  assert.match(call, /Promise.resolve\(session.ready\)/);
  assert.match(app, /msgs: \[\.\.\.c.msgs, \{ ts: Date.now\(\), \.\.\.line \}\]/);
});
test('公共手动播放器：停止或卸载后，迟到的合成不能播放', async () => {
  const i = src.indexOf('function useTtsPlayer('), body = src.slice(i, src.indexOf('\n}\n', i) + 3);
  for (const unmount of [false, true]) {
    let resolve, urls = 0, plays = 0, done = 0; const cleanup = [];
    const player = new Function('useState', 'useRef', 'useEffect', 'Audio', 'ttsSpeak', 'markTtsCached', 'URL', body + ';return useTtsPlayer();')(
      v => [v, () => {}], v => ({ current: v }), f => cleanup.push(f()),
      class { play() { plays++; return Promise.resolve(); } pause() {} },
      () => new Promise(r => resolve = r), () => {}, { createObjectURL() { urls++; return 'fixture'; }, revokeObjectURL() {} });
    const pending = player.toggle(1, '测试', 'voice', undefined, () => done++);
    if (unmount) cleanup.forEach(f => f()); else player.stop();
    resolve({}); await pending;
    assert.equal(urls, 0); assert.equal(plays, 1); // 只有手势解锁那次，没有真实音频播放
    assert.equal(done, 1);
  }
});
