// 她 2026-09-22 转群里读者：「桌面小组件还有聊天界面里的转账和照片样式看看能不能改」。
//
// 小组件那一问答案是「已经能改」：组件里的字读的是 useTheme() 那份 token，
// 主题工作台 → 页面 CSS → 选「主屏」→ 换几支色，字就跟着变（那一层不需要挂点）。
// 转账和照片是真缺：那张纸上原来只有印章一个挂点，相纸压根没有——
// 而想换样式的人第一眼要改的正是纸本身、金额、配文。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const comps = P("js/components.js"), studio = P("js/theme-studio.js");

test("转账卡三处都挂上了，名单也跟着", () => {
  ["transfercard", "transferamount", "transfernote", "transferseal"].forEach(k => {
    assert.ok(comps.includes('"data-wk": "' + k + '"'), "转账卡少了挂点：" + k);
    assert.ok(studio.includes('["' + k + '", "'), "工作台名单里没有：" + k);
  });
  // ⚠️整张那一个要落在【那张纸】上，不是落在外层那个 flex 行上（挂错了改底色会糊一整行）
  const i = comps.indexOf('"data-wk": "transfercard"');
  assert.ok(/data-wk": "transfercard",\s*\n\s*style: \{\s*\n\s*width: 250,\s*\n\s*background: PAPER,/.test(comps.slice(i - 40, i + 260)),
    "transfercard 没挂在那张纸上");
});

test("照片卡两处都挂上了，名单也跟着", () => {
  ["photocard", "photocap"].forEach(k => {
    assert.ok(comps.includes('"data-wk": "' + k + '"'), "照片卡少了挂点：" + k);
    assert.ok(studio.includes('["' + k + '", "'), "工作台名单里没有：" + k);
  });
  assert.match(comps, /h\("button", \{ onClick: onOpen, "data-wk": "photocard"/, "photocard 没挂在相纸那一层");
});

// 挂点只许是写死的名字（theme-hooks-61-00 那条闸），这儿顺手挡一道：别把变量拼进去
test("新挂的这几个都是写死的名字", () => {
  ["transfercard", "transferamount", "transfernote", "photocard", "photocap"].forEach(k => {
    const re = new RegExp('"data-wk": "' + k + '"');
    assert.match(comps, re, k + " 不是字面量");
  });
});
