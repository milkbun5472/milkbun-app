// 用户反馈（她 2026-09-16 转来）：「照片里面可不可以弄个删除呀，因为有些生成的不是很合心意」
// 她拍板要【真删】：连那条消息带 IndexedDB 里的图一起走，不是从墙上滤掉。
// ⚠️难点是合照墙不是一个相册，是四个地方拼的——删一张必须回到它真正住的那一处。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const app = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
const screens = fs.readFileSync(path.join(__dirname, '../js/screens.js'), 'utf8');
const del = app.slice(app.indexOf('  const deleteDuoPhoto = (cid, photo) => {'), app.indexOf('  const confirmDeleteDuoPhoto'));

test('四个来源都带着出处上墙，删的时候才找得回它住哪儿', () => {
  ['"chat"', '"offline"', '"studio"', '"couple"'].forEach(src => {
    assert.match(app, new RegExp('src: ' + src.replace(/"/g, '"')), '少了来源 ' + src);
  });
  const fn = app.slice(app.indexOf('  const duoPhotosOf = cid =>'), app.indexOf('  const deleteDuoPhoto'));
  assert.equal((fn.match(/src: "/g) || []).length, 4, '四个来源一个都不能漏');
});

test('四个来源各回各家删，一处都不能只在墙上滤掉', () => {
  assert.match(del, /if \(src === "chat"\) pChat\(cid, p => p\.filter/);
  assert.match(del, /saveJSON\("x_offline:" \+ cid, next\)/);
  assert.match(del, /saveJSON\("x_studio", next\)/);
  assert.match(del, /saveJSON\("x_coupleShots", next\)/);
  // 图本身也要删（本机/原生壳/远端三处都在 idbImgDel 里）
  assert.match(del, /idbImgDel\(photo\.imgKey\)/);
});

test('线下那一路不许走 pOffline——没加载过会把整份线下记录清空', () => {
  // ⚠️pOffline 的 updater 拿到的是 prev[scopeKey] || []，这个角色的线下没进过就是空数组，
  //   一保存就把存档里那一整份覆盖成 []。所以这里必须先读实档。
  assert.doesNotMatch(del, /pOffline\(/);
  assert.match(del, /offlinesRef\.current\[cid\] \|\| loadJSON\("x_offline:" \+ cid, \[\]\)/);
});

test('不可逆的动作必须先让她看见「不可逆」', () => {
  const cf = app.slice(app.indexOf('  const confirmDeleteDuoPhoto'), app.indexOf('  const confirmDeleteDuoPhoto') + 600);
  assert.match(cf, /requestAppConfirm\(/);
  assert.match(cf, /生成的图没有第二份，删了就找不回来了/);
  // 界面上挂的必须是带确认的那一个，不是光秃秃的 deleteDuoPhoto
  assert.match(app, /onDeletePhoto: confirmDeleteDuoPhoto,/);
  assert.doesNotMatch(app, /onDeletePhoto: deleteDuoPhoto/);
});

test('删除挂在看大图那一层，合照墙和照相馆两处都有', () => {
  assert.match(screens, /onClick: e => \{ e\.stopPropagation\(\); onDelete\(zoom\); setZoom\(null\); \}/);
  assert.match(screens, /onClick: \(\) => \{ onDelete\(big\); setBig\(null\); \}/);
  assert.equal((screens.match(/onDelete: onDeletePhoto \?/g) || []).length, 2);
  // 照相馆那张本来就只住在 x_studio 里，出处要补上（它不是从墙上点进来的）
  assert.match(screens, /onDeletePhoto\(partner\.id, \{ \.\.\.shot, src: "studio" \}\)/);
});

test('「已了结」的提示要说去哪看', () => {
  // 她转来的原话：「显示什么什么东西已了结，心愿已了结。这个是在哪里看呀？没有情侣空间」
  assert.match(app, /已自动了结 " \+ applied\.closed \+ " 条约定\/心事，旧记录仍在：设置 → 记忆库 → 未了/);
});
