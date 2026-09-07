"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const scr = fs.readFileSync("js/screens.js", "utf8");
const cut = (a, b) => scr.slice(scr.indexOf(a), scr.indexOf(b, scr.indexOf(a)));
const TEXT = cut("function ApiConfig({", "\nfunction ");
const IMG = cut("function ImageApiConfig({ toast })", "\n// 独立 embedding API 配置");

// 她 2026-09-07：「现在设置文字和图像 api 都是保存了就会把他变成主要的，能不能搞个
// clear distinction 来选择啊，比如我可能只是想保存个备用的，但是一旦保存就把它变成
// 主用的得再回去重新保存一遍主要的」。
// 两处不同形状、同一个病：【保存／编辑】和【设为主用】被绑成了一个动作。

test("文字 API：保存只保存，不顺手换掉主用", () => {
  // 注释里留着这句话是为了讲清病因，所以只看它是不是还挂在按钮上
  assert.ok(TEXT.indexOf('} }, "保存并设为线上主 API")') < 0, "那颗二合一的按钮还在");
  assert.match(TEXT, /\}, "保存"\), curId !== activeId/);
  // 保存传回去的是原来的 activeId；一条主用都没有时才由当前这条顶上
  assert.match(TEXT, /await onSave\(list, list\.some\(p => p\.id === activeId\) \? activeId : curId\);/);
  // 「设为主用」是另外一颗按钮，而且只在这条还不是主用时才出现
  assert.match(TEXT, /curId !== activeId && \/\*#__PURE__\*\/React\.createElement\("button", \{/);
  assert.match(TEXT, /onClick: async \(\) => \{ await onSave\(list, curId\); toast && toast\("这条现在是线上主 API 了"\); \}/);
});

test("文字 API：列表上主用是一颗单选章，不是「谁最后被保存过」", () => {
  assert.match(TEXT, /p\.id === activeId\n\s+\? h\("span", .*"主用中"\)/s);
  assert.match(TEXT, /onSave\(list, p\.id\); toast && toast\("这条现在是线上主 API 了"\)/);
});

test("图像 API：编辑哪一站 ≠ 主用哪一站", () => {
  // 原来编辑器只认 store.activeId，所以点「编辑」必须先 switchSite——编辑即切换
  assert.match(IMG, /const \[editId, setEditId\] = useState\(null\);/);
  assert.match(IMG, /const c = store\.profiles\.find\(p => p\.id === editId\)/);
  assert.match(IMG, /const openSite = id => \{ setEditId\(id\);/);
  // set() 改的是【正在编辑的那一站】，不是主用那一站
  assert.match(IMG, /store\.profiles\.map\(\(p, i\) => p\.id === c\.id \?/);
  // switchSite 只干一件事：换主用
  assert.match(IMG, /const switchSite = id => \{ persist\(Object\.assign\(\{\}, store, \{ activeId: id \}\)\); toast && toast\("这一站现在是主用的了"\); \};/);
  assert.ok(IMG.indexOf("switchSite(p.id); setEditing(true);") < 0, "还有地方是点一下既切换又编辑");
});

test("图像 API：新增和复制不抢主用，删除也不顺手换主用", () => {
  assert.match(IMG, /const hasActive = store\.profiles\.some\(p => p\.id === store\.activeId\);/);
  assert.match(IMG, /activeId: hasActive \? store\.activeId : id/);
  // 删的不是主用那一站就别动主用（原来一律改成 profiles\[0\]）
  assert.match(IMG, /const nextActive = store\.activeId === target\.id \? profiles\[0\]\.id : store\.activeId;/);
});

test("两处都说清了「这一条是不是主用」", () => {
  assert.match(IMG, /"现在用的是这一站"/);      // 列表卡
  assert.match(IMG, /"现在用的就是这一站"/);    // 编辑页顶上
  assert.match(IMG, /"设为主用"/);
  assert.match(IMG, /改这一站是随手存的，不会动到主用那一站/);
  assert.match(TEXT, /"主用中"/);
  assert.match(TEXT, /"设为主用"/);
});
