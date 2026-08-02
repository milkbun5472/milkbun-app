"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Gate = require("../js/memory-near-duplicate.js");

const now = Date.UTC(2026, 7, 2, 12);
const row = (text, extra = {}) => ({ text, charIds: ["a"], ts: now - 3600000, source: "auto", ...extra });

test("同角色近时段换句话说的同一事实被拦", () => {
  assert.equal(Gate.evaluate(row("沈屿白最喜欢的关东煮食材是萝卜和魔芋丝", { ts: now }), row("沈屿白最喜欢的关东煮配料是萝卜和魔芋丝"), now).duplicate, true);
});

test("不同角色、超过窗口或只有泛泛主题相似都不拦", () => {
  assert.equal(Gate.evaluate(row("今晚一起去吃饭", { ts: now }), row("今晚一起去吃饭", { charIds: ["b"] }), now).duplicate, false);
  assert.equal(Gate.evaluate(row("今晚一起去吃饭", { ts: now }), row("今晚一起去吃饭", { ts: now - Gate.WINDOW_MS - 1 }), now).duplicate, false);
  assert.equal(Gate.evaluate(row("Lisa 今天去温哥华出差", { ts: now }), row("Lisa 喜欢温哥华的海鲜"), now).duplicate, false);
});

test("同一批原消息产生的高度重叠版本被拦，证据碰巧重叠但事实不同不拦", () => {
  assert.equal(Gate.evaluate(
    row("Lisa 的父母徒步时捡回一只死猫头鹰，后来在许言秋劝阻下放弃食用", { ts: now, evidenceMessageIds: ["1", "2"] }),
    row("Lisa 父母徒步捡回一只死猫头鹰，许言秋说明风险后劝阻他们食用", { evidenceMessageIds: ["2", "3"] }), now
  ).duplicate, true);
  assert.equal(Gate.evaluate(
    row("Lisa 主动结清了超市账单", { ts: now, evidenceMessageIds: ["1"] }),
    row("陆衍已经把衣服搬进 Lisa 的衣柜", { evidenceMessageIds: ["1"] }), now
  ).duplicate, false);
});

test("计划后来完成、取消和数字变化都是新进展，不能吞", () => {
  assert.equal(Gate.evaluate(row("Lisa 和陆衍已经完成超市采购", { ts: now }), row("Lisa 和陆衍约好下午去超市采购"), now).duplicate, false);
  assert.equal(Gate.evaluate(row("本地存储已达到95%", { ts: now }), row("本地存储已达到85%"), now).duplicate, false);
});

test("旧库扫描只给自动普通记忆分组，并保留信息最完整的一条", () => {
  const rows = [
    row("沈屿白最喜欢的关东煮食材是萝卜和魔芋丝", { id: "short", ts: now - 1000, evidenceMessageIds: ["same-turn"] }),
    row("沈屿白最喜欢的关东煮配料是萝卜和魔芋丝，而且这两样最先吃", { id: "rich", ts: now, evidenceMessageIds: ["same-turn"] }),
    row("沈屿白最喜欢的关东煮食材是萝卜和魔芋丝", { id: "manual", source: "manual", ts: now }),
    row("沈屿白最喜欢的关东煮食材是萝卜和魔芋丝", { id: "open", open: true, ts: now })
  ];
  const groups = Gate.scan(rows);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].keep.id, "rich");
  assert.deepEqual(groups[0].archive.map(x => x.id), ["short"]);
});

test("跨很久的完全相同自动记忆仍进候选，但不同角色和受保护条目不混入", () => {
  const old = now - 400 * 86400000;
  const rows = [
    row("Lisa 和沈屿白第一次一起吃了关东煮。", { id: "old", ts: old }),
    row("Lisa和沈屿白第一次一起吃了关东煮", { id: "new", ts: now }),
    row("Lisa和沈屿白第一次一起吃了关东煮", { id: "other-role", charIds: ["b"], ts: now }),
    row("Lisa和沈屿白第一次一起吃了关东煮", { id: "pinned", pinned: true, ts: now }),
    row("Lisa和沈屿白第一次一起吃了关东煮", { id: "manual", source: "manual", ts: now })
  ];
  const groups = Gate.scan(rows);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].matchKind, "exact_all_time");
  assert.equal(groups[0].confidence, "high");
  assert.deepEqual(new Set([groups[0].keep.id, ...groups[0].archive.map(x => x.id)]), new Set(["old", "new"]));
});
