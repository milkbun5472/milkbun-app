const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../js/phone.js");
const NOW = Date.now(), D = 86400000;
const char = { id: "c1", name: "沈屿白", persona: "男" };
const many = n => Array.from({ length: n }, (_, i) => ({ name: "会话" + (i + 1), last: "上次那句", messages: [{ from: "他", text: "旧的一句" }] }));

// 她 2026-09-01：「微信联系人，一开始只生成几个但是后续封顶了不应该生成新的，
// 而是在他已有的联系人和群聊里更新说的话而已」。
// 原来每刷一次都要「另外生成正好 5 个互不相同的新会话」，三轮之后他微信里
// 就有十五个互不相干的会话、十五拨人——那不是一个人的微信。
test("会话够多之后只问「又说了什么」", () => {
  const full = P.phoneProbeSpec("wechat", char, [], "摘要", [], { chats: many(3) });
  assert.match(full.instruction, /另外生成正好 5 个互不相同的新会话/, "人还没认全就该正常生成");
  const upd = P.phoneProbeSpec("wechat", char, [], "摘要", [], { chats: many(9) });
  assert.match(upd.instruction, /这一轮不要另开新会话、不要新增联系人/, "封顶了还在开新会话");
  assert.match(upd.instruction, /没动静的一个都别写/, "会把没动静的也报一遍");
  assert.match(upd.instruction, /会话1/, "没把现有会话名单发回去，name 照抄不了");
  assert.match(upd.instruction, /接得上原来那段话的走向/, "没要求接着往下说，会变成换个话题重开");
  assert.match(upd.schemaHint, /^\{"updates":/, "schema 没换成只回 updates");
  // 朋友圈是真发生的事，该有新的
  assert.match(upd.instruction, /moments 照旧给 1-2 条新的朋友圈/);
  assert.match(upd.schemaHint, /"moments"/);
});

test("只接新说的话：会话和联系人一个不增", () => {
  const old = {
    chats: [{ name: "林欣师姐", last: "行", time: "8月29日", _ts: NOW - 3 * D, _abs: 1, messages: [{ from: "他", text: "明早打印" }, { from: "林欣", text: "行" }] },
            { name: "老张", last: "嗯", time: "8月30日", _ts: NOW - 2 * D, _abs: 1, messages: [{ from: "他", text: "嗯" }] }],
    contacts: [{ name: "林欣" }], moments: [{ content: "旧朋友圈", time: "昨天" }], me: { wechatName: "不想说话" }
  };
  const out = P.phoneGrowMerge("wechat", old, { updates: [
    { name: "林欣师姐", messages: [{ from: "林欣", text: "打印好了吗" }, { from: "他", text: "在排队" }, { from: "他", text: "明早打印" }], last: "在排队", time: "14:45" },
    { name: "查无此会话", messages: [{ from: "x", text: "y" }] }
  ], moments: [{ content: "新朋友圈", time: "刚刚" }] }, NOW);
  assert.equal(out.chats.length, 2, "会话被加进来了——这一路一个都不许增");
  assert.equal(out.contacts.length, 1, "联系人被加进来了");
  // 接着往下说，同一句不重复攒
  assert.deepEqual(out.chats[0].messages.map(m => m.text), ["明早打印", "行", "打印好了吗", "在排队"], "新消息没接在后面，或者把说过的又抄了一遍");
  assert.equal(out.chats[0].last, "在排队");
  assert.equal(out.chats[0]._upd, NOW, "动过的那个没盖时间戳");
  assert.deepEqual(out.chats[1].messages, [{ from: "他", text: "嗯" }], "没动静的那个被改了");
  assert.equal(out.chats[1]._upd, undefined, "没动静的也盖了戳");
  // ⚠️时刻变了 _ts 必须重算，否则刚说完话的会话会排到列表底下（v59.41 那个病会从这儿漏回来）
  assert.equal(new Date(out.chats[0]._ts).toDateString(), new Date().toDateString(), "_ts 没跟着新时刻重算");
  assert.equal(out.chats[0]._abs, undefined, "_abs 没清掉，下次还会被当成绝对日期");
  assert.equal(out.chats[1]._ts, NOW - 2 * D, "没动静的那个 _ts 被碰了");
  // 朋友圈是日志，照旧并进来
  assert.deepEqual(out.moments.map(m => m.content), ["新朋友圈", "旧朋友圈"], "朋友圈没并进来");
});
