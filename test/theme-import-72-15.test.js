// 她 2026-09-20：「主题工作台导入主题包是死的按钮按不动」。
//
// 那一颗写的是 `importFile.current.click()`——没有那一道 `&&`。ref 还没挂上的那一下，
// 点下去就是一个抛在事件回调里的 TypeError：页面不报错、什么也不发生，
// 长相和「按钮是死的」一模一样。全库别处四个文件口子都写着那一道 &&，只有这一颗漏了。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const ui = P("js/theme-studio-ui.js"), screens = P("js/screens.js");

test("所有文件口子点之前都先看 ref 在不在", () => {
  const hits = ui.match(/([A-Za-z]+)\.current\.click\(\)/g) || [];
  assert.ok(hits.length >= 4, "文件口子少了几个？抠错地方了");
  (ui.match(/([A-Za-z]+)\.current\.click\(\)/g) || []).forEach(hit => {
    const name = hit.split(".")[0];
    const guarded = new RegExp(name + "\\.current && " + name + "\\.current\\.click\\(\\)");
    assert.ok(guarded.test(ui), name + " 那一颗没写 ref 守卫——ref 没挂上时点下去就是一颗死按钮");
  });
});

// ⚠️iOS 上 accept 的第一个 token 要是它认不出的扩展名，选择器可能整个弹不出来。
//   备份恢复那一处（一直能用的那一处）就是 MIME 在前——照它写。
test("主题包那个 file input 跟能用的那一处同形", () => {
  const i = ui.indexOf('ref: importFile, type: "file"');
  assert.ok(i > 0, "抠不出主题包那个 file input");
  const seg = ui.slice(i, i + 200);
  assert.ok(/accept: "application\/json,\.json"/.test(seg), "accept 不是 MIME 在前");
  assert.ok(screens.includes('accept: "application/json,.json"'), "备份恢复那一处的写法变了，两处又不一样了");
});

// 文件挑不开的时候还有一条路——而且两条路必须汇到同一处，不许各写一份解析
test("贴一份 JSON 也能导入，而且跟选文件走同一处", () => {
  assert.ok(ui.includes("const applyPack = async text => {"), "没有公共那一处");
  assert.equal((ui.match(/studio\.importPackage\(/g) || []).length, 1, "解析写成了两份");
  assert.ok(/await applyPack\(text\)/.test(ui), "选文件那一路没走公共那处");
  assert.ok(/if \(await applyPack\(pasteText\)\)/.test(ui), "贴上去那一路没走公共那处");
  assert.ok(/挑不开文件？把主题包 JSON 贴进来/.test(ui), "没有贴一份的入口");
  // 贴失败了不许把她贴的那一大段清掉
  assert.ok(/\{ setPasteText\(""\); setPasting\(false\); \}/.test(ui), "成功才清空、失败要留着她贴的那份");
});

test("读文件本身失败也要说一句，不许闷着", () => {
  assert.ok(/这份文件读不出来/.test(ui), "f.text() 抛了之后没有任何提示——又是一颗看着像死的按钮");
});
