// 接着上一版：模型接进来了，这一版给它一张脸能挑（她 2026-09-16「继续吧」）。
// 发型/发色/衣色是【数据】：同一个模型里十二款头发，选哪一款存在各自名下。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const host = rd('js/fairy-garden.js');
const game = rd('apps/fairy-garden/game.mjs');
const trav = rd('apps/fairy-garden/traveler.mjs');

test('发型名单只有一个源头：美术目录导出来的那一份', () => {
  // v69.13 起运行时那份并成了 doll.json（发型名单 ＋ 六个体型参数的范围一起出）
  const art = JSON.parse(rd('art/fairy-garden/hairstyles.json'));
  const runtime = JSON.parse(rd('apps/fairy-garden/doll.json'));
  assert.deepEqual(runtime.hair, art, '运行时那份和美术目录对不上——它是 export_traveler.py 抄过去的，别手改');
  const keys = Object.keys(art);
  const inModel = trav.match(/HAIR_STYLES=\[([^\]]+)\]/)[1].split(',').map(s => s.trim().replace(/'/g, ''));
  assert.deepEqual(keys.slice().sort(), inModel.slice().sort());
  // 界面也去读这一份，不许另抄一张中文名表
  assert.match(host, /fetch\('apps\/fairy-garden\/doll\.json\?v=' \+ BUILD\)/);
  assert.doesNotMatch(host, /韩式碎盖|层次狼尾/, '界面里又写死了一份发型名');
});

test('谁的样貌存在谁名下，而且真的落盘', () => {
  const fn = game.slice(game.indexOf(' setLook:(who,look)=>{'), game.indexOf(' applyAction:'));
  assert.match(fn, /who==='companion'\?companionAvatar:playerAvatar/);
  assert.match(fn, /data=\{\.\.\.data,companion:\{\.\.\.data\.companion,look:/);
  assert.match(fn, /else data=\{\.\.\.data,look:/);
  assert.match(fn, /return save\(\)/, '改完没存＝下次进来白改');
  // 进门时把存着的那份穿上
  assert.match(game, /if\(data\.look\)playerAvatar\.setLook\(data\.look\)/);
  assert.match(game, /data\.companion&&data\.companion\.look\)companionAvatar\.setLook/);
});

test('藏起来的十一款头发也各自一份材质', () => {
  // ⚠️实测过：跳过不克隆，换完发型两个小人共用同一份材质，一起变色
  assert.match(trav, /if\(isHair\(o\)\)o\.visible=o\.name===hairName;/);
  const ctor = trav.slice(trav.indexOf('const mine=new Map()'), trav.indexOf('model.updateMatrixWorld(true)'));
  assert.doesNotMatch(ctor, /o\.visible=false;return;/, '又跳过了藏起来那几款');
  assert.match(ctor, /if\(!mine\.has\(o\.material\)\)mine\.set/);
});

test('第一次进来按角色卡给一身默认，之后听她挑的', () => {
  const seed = host.slice(host.indexOf('ready: () => {'), host.indexOf('const char = (props.characters'));
  assert.match(seed, /if \(!now\.companion \|\| !now\.companion\.hair\)/, '每次进门都覆盖＝她挑的白挑');
  assert.match(seed, /CharacterPronoun\.ta\(c\)/, '性别要读那张唯一的判断表');
  assert.match(seed, /cloth: c\.color \|\| '#729786'/);
});

test('样貌是一整页盖住游戏，不是把 iframe 换掉', () => {
  // ⚠️iframe 一卸载，这一局的进度就没了
  assert.match(host, /dress && h\("div", \{ style: \{ position: "absolute", inset: 0/);
  assert.match(host, /chat && !dress && h\("section"/, '样貌开着的时候聊天面板还压在上面');
  // 两个人那一排是底线 tab，不是一排药丸（施工规则/tabs-not-plain-pills.md）
  assert.match(host, /borderBottom: "2px solid " \+ \(who === k \? G\.deep : "transparent"\)/);
});
