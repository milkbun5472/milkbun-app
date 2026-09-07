const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const Clock = require('../js/schedule-clock.js');
const components = fs.readFileSync(__dirname + '/../js/components.js', 'utf8');
const screens = fs.readFileSync(__dirname + '/../js/screens.js', 'utf8');
const app = fs.readFileSync(__dirname + '/../js/app.js', 'utf8');
function fn(src, name) {
  const line = src.split('\n').find(x => x.startsWith('function ' + name + '('));
  assert.ok(line, name);
  return new Function('window', line + '; return ' + name)({ ScheduleClock: Clock });
}

test('日期入口共用实现，旧桶键和补零日期仍各用原格式', () => {
  const date = new Date(2026, 8, 7);
  assert.equal(fn(components, 'calKey')(2026, 8, 7), '2026-9-7');
  assert.equal(fn(components, 'pDK')(date), '2026-9-7');
  assert.equal(fn(components, 'calPadKey')(2026, 8, 7), '2026-09-07');
  assert.equal(fn(screens, 'schedDayKey')(date), '2026-09-07');
  for (const key of ['2026-9-7', '2026-09-07']) {
    for (const parse of [fn(components, 'pKeyDate'), fn(screens, 'schedParseKey')]) {
      assert.equal(Clock.deviceDayKey(parse(key)), '2026-09-07');
    }
  }
  assert.equal(fn(screens, 'schedShiftDayKey')('2026-12-31', 1), '2027-01-01');
});

test('日历写入方保持旧键，读取方能找到同一份事件', () => {
  // addTimelineEvent 把用户日期转换成旧桶键，再交给 saveCalEvent 保存。
  assert.match(app, /saveCalEvent\(char\.id, \(\+pp\[0\]\) \+ "-" \+ \(\+pp\[1\]\) \+ "-" \+ \(\+pp\[2\]\)/);
  const [y, m, d] = '2026-09-07'.split('-').map(Number);
  const keyWritten = y + '-' + m + '-' + d;
  const calendar = { chars: { a: { [keyWritten]: [{ title: '测试事件' }] } } };
  const start = components.indexOf('function calAnyEvent('), end = components.indexOf('// 首页 2x2', start);
  const read = new Function('calKey', components.slice(start, end) + '; return calAnyEvent;')(fn(components, 'calKey'));
  assert.equal(read(calendar, 2026, 8, 7), true);
  assert.equal(read(calendar, 2026, 8, 8), false);
});

for (const zone of ['America/Winnipeg', 'Asia/Shanghai', 'Australia/Sydney']) {
  test(zone + '：夏令时切换、闰年和跨年不跳日', () => {
    const script = `const assert=require('node:assert/strict');const C=require(${JSON.stringify(path.resolve(__dirname, '../js/schedule-clock.js'))});
      for(const [key,n,want] of [['2026-03-08',1,'2026-03-09'],['2026-03-09',-1,'2026-03-08'],['2026-11-01',1,'2026-11-02'],['2026-11-02',-1,'2026-11-01'],['2026-04-05',1,'2026-04-06'],['2026-10-04',1,'2026-10-05'],['2024-02-28',1,'2024-02-29'],['2026-01-01',-1,'2025-12-31']]) {
        assert.equal(C.shiftDayKey(key,n),want);assert.equal(C.deviceDayKey(C.parseDayKey(key)),key);
      }`;
    execFileSync(process.execPath, ['-e', script], { env: { ...process.env, TZ: zone } });
  });
}

test('真实装载顺序先提供日期模块，入口不再有另一套日期算法', () => {
  const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
  assert.ok(html.indexOf('js/schedule-clock.js?') < html.indexOf('js/components.js?'));
  assert.ok(html.indexOf('js/schedule-clock.js?') < html.indexOf('js/screens.js?'));
  for (const [src, names] of [[components, ['calKey', 'calPadKey', 'pKeyDate', 'pDK']], [screens, ['schedDayKey', 'schedLocalDayKey', 'schedShiftDayKey', 'schedParseKey']]]) {
    for (const name of names) {
      const line = src.split('\n').find(x => x.startsWith('function ' + name + '('));
      assert.match(line, /return window\.ScheduleClock\./);
      assert.doesNotMatch(line, /86400000|padStart|split\(/);
    }
  }
});
