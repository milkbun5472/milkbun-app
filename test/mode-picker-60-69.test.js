const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
// ⚠️只扫代码，不扫注释：底下那句「它们当初长什么样」本身就写着那几行字，
// 连注释一起扫的话，这条永远是红的（或者更糟：为了让它绿而把病历删掉）。
const codeOnly = comp.split("\n").filter(l => !l.trim().startsWith("//")).join("\n");
const _i = comp.indexOf("const MODE_SW =");
const pick = comp.slice(_i, comp.indexOf("\n// 代付请求卡", _i));

// 她 2026-09-03 把两张截图并排放着问：「这俩会不会太像了嘤」。
// 是像：另一个 app 那张「输入模式」和我们这张，四行的名字和说明一个字都不差，
// 连「图标 + 名字 + 小字 + 右边一个勾」的排法都一样。

test("那一整套照抄来的说法，一个都不许再留着", () => {
  for (const s of ["输入模式", "与角色直接交流", "进入线下模式", "设定背景与环境",
                   "越过角色下达指令", "旁白注入", "OOC 指令", "越过所有角色直接和模型说",
                   "在群里正常收发消息", "进入多人线下模式"]) {
    assert.equal(codeOnly.indexOf(s), -1, "还留着照抄来的那句：" + s);
  }
});

test("不再描述这几档，而是把每一档的样子画出来", () => {
  // 线上那一片用的是她自己设的那套气泡颜色——换个 app 这一片就不成立了
  assert.match(pick, /background: BUBBLE_SKIN\.charBg/);
  assert.match(pick, /background: BUBBLE_SKIN\.myBg/);
  // 线下是带头像的一张叙述卡；旁白是居中两行；出戏是括号里的一句话
  assert.match(pick, /if \(k === "offline"\)[\s\S]{0,400}borderRadius: 999/, "线下那一片要有个头像");
  assert.match(pick, /if \(k === "narr"\)[\s\S]{0,300}justifyContent: "center"/, "旁白那一片要居中");
  assert.match(pick, /"\(", h\("div"/, "出戏那一片要套一对括号");
});

test("选中不靠右边打个勾：自己上墨、纸色垫起来、左边立一道墨条", () => {
  assert.equal((pick.match(/ICheck/g) || []).length, 0, "又回到打勾了");
  assert.match(pick, /background: on \? t\.bg : "transparent"/, "选中那一行要用纸色垫起来");
  assert.match(pick, /background: on \? t\.ink : "transparent"/, "左边那道墨条没了");
  assert.match(pick, /opacity: on \? 1 : 0\.42/, "没选中的样张要压暗");
  // 样张比单子那张纸亮一档，否则整片糊在一起看不见
  assert.match(pick, /const paper = \{ background: t\.bg, border: "1px solid " \+ t\.line \}/);
});

test("单聊和群聊是同一张单子——不许一处改了另一处没跟上", () => {
  assert.equal((comp.match(/h\(ModePicker, \{/g) || []).length, 2,
    "单聊线上 / 群聊线上，两处都得走这一张");
  assert.match(comp, /\["narr", "旁白"/, "单聊那张要有旁白这一档");
  assert.match(comp, /\["chat", "群里说话"/, "群聊那张的第一档是群里说话");
});

test("档位的键一个没动，点下去做的事也没动", () => {
  assert.match(comp, /cur: chatMode,\n\s*onPick: mk => \{ setModeOpen\(false\); onModeTap\(mk\); \}/, "单聊照旧交给 onModeTap");
  assert.match(comp, /if \(mk === "offline"\) onOffline && onOffline\(\);\n\s*else setChatMode\(mk\);/, "群聊照旧：见面走 onOffline，别的换 chatMode");
});

test("顶栏和输入框那几处说法跟着一起换了", () => {
  // 一层写在四处、第四处没跟上，是这个仓库最常犯的病
  assert.match(comp, /chatMode === "narr" \? "旁白" : chatMode === "ooc" \? "出戏" : "说话"/, "单聊顶栏");
  assert.match(comp, /chatMode === "ooc" \? "出戏 · 轻触切回群聊"/, "群聊顶栏");
  assert.equal((comp.match(/OOC：直接和模型说/g) || []).length, 0, "输入框里还留着旧说法");
  assert.equal((comp.match(/出戏说：/g) || []).length, 3, "单聊线上 / 单人线下 / 群聊线上，三个输入框都要改");
});
