// v63.49 她 2026-09-05：「群聊和单聊的所有系统提示包括 ooc 改成同一个样式，
// 并且可以点 ❌ 从屏幕删掉」
// 在这之前是五处各写各的：单聊 system 是一整块居中斜体大字（发送失败那种能占半屏）、
// 单聊 OOC 是右对齐虚线气泡、群聊 system 是一颗小药丸（连删都删不掉）、
// 群聊 OOC 和线下 OOC 又各一份——同一层东西五个实现，改一处只会漏四处。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const note = comp.slice(comp.indexOf("function SysNote("), comp.indexOf("// 气泡角落贴纸"));

test("只有一个长相：五处全走 SysNote，没有第二份实现", () => {
  assert.match(comp, /function SysNote\(\{ label, text, tone, onClose, title \}\)/);
  assert.equal((comp.match(/h\(SysNote, \{/g) || []).length, 5,
    "五处：单聊 system / 单聊 OOC / 群聊 system / 群聊 OOC / 线下 OOC");
  // 旧的那几份不许留着
  assert.doesNotMatch(comp, /"OOC · " \+ m\.content/, "还有一处在自己拼 OOC 气泡");
  assert.doesNotMatch(comp, /}, "系统消息",/, "单聊那块「系统消息」大字还在");
  assert.doesNotMatch(comp, /background: t\.bg2,\n\s*padding: "3px 12px",\n\s*borderRadius: 999/,
    "群聊那颗系统药丸还在");
});

test("每一条都能 ✕ 掉，包括原来删不掉的群聊系统行", () => {
  assert.match(note, /onClose \? h\("button", \{ onClick: function \(e\) \{ e\.preventDefault\(\); e\.stopPropagation\(\); onClose\(\); \}/);
  assert.match(note, /title: title \|\| "从屏幕上拿掉"/);
  // 五处都得把关闭口接上（有删除能力时）
  for (const re of [
    /if \(m\.kind === "ooc"\) return h\(SysNote, \{ key: i,[\s\S]{0,200}?onDeleteMessages\(\[i\]\)/,
    /if \(m\.kind === "system"\) return h\(SysNote, \{ key: i,[\s\S]{0,200}?onDeleteMessages\(\[i\]\)/,
    /if \(m\.role === "system"\) return h\(SysNote, \{ key: i,[\s\S]{0,200}?onDeleteMessages\(\[i\]\)/,
    /return h\(SysNote, \{ label:[\s\S]{0,200}?onDelete\(m\.id, msgIndex\)/
  ]) assert.match(comp, re);
  // ⚠️不许走 confirm：iOS/PWA 会吞掉原生 confirm，看着像点了没反应（旧账）
  assert.doesNotMatch(note, /confirm\(/);
});

test("它不是一颗药丸，是一张夹进来的纸条", () => {
  // tabs-not-plain-pills.md 同一条判据：换个 app 还成立的形状就是没设计
  assert.doesNotMatch(note, /borderRadius: 999/);
  assert.match(note, /borderRadius: "2px 8px 8px 2px"/, "撕下来那一条：贴着装订线那边是方的");
  assert.match(note, /border: "1px dashed "/);
  assert.match(note, /borderLeft: "2px solid "/, "左边压一道墨线");
  // 颜色一律从 t 兑：深色主题里写死的白纸黑字会翻车
  assert.doesNotMatch(note, /#fff|#000|rgba\(255,255,255/);
  assert.match(note, /background: skinAlpha\(t\.bg2, "e6"\)/, "压在壁纸上得挡得住");
});

test("系统和 OOC 只差一个记号，不是两种设计", () => {
  // tone 只换那道墨线和标签的颜色，形状一个字不改
  assert.match(note, /const col = tone === "warn" \? t\.accent : t\.fog;/);
  assert.match(comp, /label: "系统", text: m\.content, tone: "warn"/);
  assert.match(comp, /label: m\.role === "user" \? "OOC · 我问" : "OOC · 回"/);
});
