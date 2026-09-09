const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
const src = fs.readFileSync('js/components.js', 'utf8');
const fn = name => { const i = src.indexOf('function ' + name + '('); return src.slice(i, src.indexOf('\n}\n', i) + 3); };
test('全局译文默认手动，沿用旧通话偏好，新设置 false 也有优先权', () => {
  const data = {}, events = []; let fail = false;
  const api = new Function('loadJSON', 'saveJSON', 'window', 'Event', fn('onlineTranslationAuto') + fn('setOnlineTranslationAuto') + ';return {read:onlineTranslationAuto,set:setOnlineTranslationAuto};')(
    (key, fallback) => data[key] ?? fallback, (key, value) => { if (fail) return false; data[key] = value; return true; },
    { dispatchEvent: e => events.push(e.type) }, class { constructor(type) { this.type = type; } });
  assert.equal(api.read(), false);
  data.x_callAutoZh = true; assert.equal(api.read(), true);
  assert.equal(api.set(false), true); assert.equal(api.read(), false);
  assert.equal(data.x_onlineAutoZh, false); assert.equal(data.x_callAutoZh, true);
  assert.deepEqual(events, ['archive-translation-display']);
  fail = true; assert.equal(api.set(true), false); assert.equal(api.read(), false); assert.equal(events.length, 1);
});
test('六个线上气泡/语音消息/转录入口都经公共 TransText，不再有通话专属显示状态', () => {
  assert.equal((src.match(/h\(TransText, \{ text: [ml]\.content/g) || []).length, 6);
  assert.match(fn('TransText'), /useOnlineTranslationAuto\(\)/);
  assert.equal((src.match(/h\(OnlineTranslationControl,/g) || []).length, 1);
  assert.equal((src.match(/h\(OnlineMediaSettings,/g) || []).length, 2);
  assert.doesNotMatch(src, /saveJSON\("x_callAutoZh"|autoShow: autoZh|\[autoZh, setAutoZh\]/);
  assert.equal((src.match(/saveJSON\("x_onlineAutoZh"/g) || []).length, 1);
});
