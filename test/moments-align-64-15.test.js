// 她 2026-09-05：「对齐吧宝宝，时光胶囊在情侣空间已经做好了，生活方式我也不知道是啥」。
//
// 朋友圈个人页原来是 t.bg2（偏白），而它所属的【消息】那个 app 是 t.bg（灰）——
// 同一个 app 里两种底，从列表点进个人页颜色会跳一下。
//
// ⚠️这一处**不是给它铺纸**：消息那一页的平色是【有意的】，代码里写着理由
//   （「它现实里就是手机上那种聊天 app，地是灰的、格子是白的」）。
//   给它铺纸会跟它所属的那个 app 打架。要修的只是那个不一致。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");

const cut = (from, to) => { const i = comp.indexOf(from); assert.ok(i > 0, "找不到 " + from);
  const j = comp.indexOf(to, i + 10); return comp.slice(i, j > i ? j : i + 20000); };

test("朋友圈个人页跟消息同一种底", () => {
  const mp = cut("function MomentsProfile({ isMe, character", "\nfunction ");
  assert.match(mp, /return h\("div", \{ className: "h-full flex flex-col", style: msgAppBg\(t\) \},/,
    "个人页的底没跟消息对齐");
  assert.ok(!/className: "h-full flex flex-col", style: \{ background: t\.bg2 \} \}/.test(mp), "还是 t.bg2");
  // 对齐的那一头也得钉住：消息那一页要是哪天改了色，这一处得跟着走
  const ms = cut("function Messages({", "\nfunction ");
  assert.match(ms, /className: "h-full flex flex-col",\s*style: msgAppBg\(t\)/, "消息那一页没走那块共用的地");
  // ⚠️两处共用【同一个函数】，所以改一处另一处自动跟着走——
  //   这正是「一层写在两处，第二处没跟上」的解法：让它只有一处。
  assert.equal((comp.match(/style: msgAppBg\(t\)/g) || []).length, 2, "用它的地方不是两处");
  assert.match(comp, /function msgAppBg\(t\) \{ return \{ background: t\.bg \}; \}/);
  // ⚠️那个平色是有意的，理由写在代码里——别哪天有人当成漏掉的去铺纸
  assert.match(ms, /地是灰的、格子是白的/, "那句写明理由的注释没了，下一个人会以为这是漏的");
});
