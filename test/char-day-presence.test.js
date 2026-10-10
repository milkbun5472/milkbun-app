const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { fixture, wire, evaluate, sections } = require('./_group-background-fixture.cjs');

test('TA一天的日程适配器不再记录或生成进屋通知，宿主与公共提示不接现场状态', () => {
  const link = fs.readFileSync('js/char-day-link.js', 'utf8');
  const env = {}; vm.createContext(env); vm.runInContext(link, env);
  assert.equal(env.CharDayLink.setPresence, undefined);
  assert.equal(env.CharDayLink.presenceFor, undefined);
  for (const file of ['js/app.js', 'js/engine.js', 'js/char-day.js', 'js/char-day-link.js', 'js/chat-rooms.js']) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /charDayPresence|memberCharDayPresence|setPresence|presenceFor|对方已主动进入共同小屋|TA的一天·此刻的小世界画面/, file);
  }
});

for (const surface of ['online', 'call', 'offline']) test(surface + '：旧现场字段不能进入成员提示，原人设、行程和私有档案照常给', () => {
  const env = wire(fixture());
  const marker = '旧小世界现场哨兵';
  env.window.CharDayLink = { presenceFor() { throw Error('聊天仍读取进屋状态'); } };
  env.ctx.memberCharDayPresence = { a: marker, b: marker };
  const collect = env.groupBackgroundFor;
  env.groupBackgroundFor = c => ({ ...collect(c), charDayPresence: marker });
  if (surface === 'offline') env.userName = '读者';
  const text = evaluate(sections[surface], env, 'memberDesc');
  assert.doesNotMatch(text, new RegExp(marker));
  assert.match(text, /甲的人设/); assert.match(text, /乙的人设/);
  assert.match(text, /a私有档案/); assert.match(text, /b私有档案/);
  if (surface !== 'offline') assert.match(text, /a行程/);
});

test('现场互动与样貌仍沿原小人机制，物理动作不另开模型或写聊天', () => {
  const scene = fs.readFileSync('apps/fairy-garden/day/together.mjs', 'utf8');
  const page = fs.readFileSync('js/char-day.js', 'utf8');
  const game = fs.readFileSync('apps/fairy-garden/game.mjs', 'utf8');
  const host = fs.readFileSync('js/fairy-garden.js', 'utf8');
  assert.doesNotMatch(scene, /saveJSON|localStorage|callAI|runProbe|pChat/);
  assert.match(page, /GardenDressControls/); assert.match(page, /saveHomeChange\("me","looks"/);
  assert.match(page, /cdayinteraction/); assert.match(page, /cdayprofessional/);
  assert.match(page, /safe-area-inset-bottom\) \* 0\.4/);
  assert.match(game, /else data=\{\.\.\.data,look:merge\(data\.look\)\}/);
  assert.match(host, /worldOf\(loadJSON\(key,null\)\|\|\{\},"garden"\)\?\.look/);
  assert.match(page, /visibility:mePanel\?"hidden":"visible"/);
});
