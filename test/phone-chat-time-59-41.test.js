const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const K = require(path.join(__dirname, "..", "js", "phone.js"));
const ph = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");
const D = 86400000;

// 她 2026-09-01：「这个日期有 bug」。截图里今天 14:45 那条排在 8月30日 23:45 下面，
// 而且「8月30日 23:45」「14:45」「8月29日」三种写法并排站着。两个病，都得治。

// ① 认得出时刻的照排，认不出的沉底——不是「有一条认不出就一条都不排」
test("认不出时刻的沉底，不再拖着整份不排序", () => {
  const N = Date.now();
  const rows = [
    { name: "前天", time: "8月30日", _ts: N - 2 * D },
    { name: "认不出", time: "周一" },
    { name: "刚刚", time: "14:45", _ts: N - 3600000 },
    { name: "认不出2", time: "过些天" },
    { name: "大前天", time: "8月29日", _ts: N - 3 * D }
  ];
  const out = K.phoneGrowList(rows, [], 20, N).map(x => x.name);
  assert.deepEqual(out, ["刚刚", "前天", "大前天", "认不出", "认不出2"],
    "认得出的没按新→旧排，或者认不出的没沉底／被打乱了");
  // 认不出的那几条彼此之间要保持原来的先后
  assert.ok(out.indexOf("认不出") < out.indexOf("认不出2"), "沉底那几条被互相打乱了");
});

// ② 同一屏里必须是同一种写法：今天写几点、昨天写「昨天」、更早写日期
test("会话列表的时刻是现算的，而且一屏一种写法", () => {
  const N = Date.now();
  assert.match(K.phoneChatWhen({ time: "随便写的", _ts: N - 3600000 }), /^\d{2}:\d{2}$/, "今天的没写成几点");
  assert.equal(K.phoneChatWhen({ time: "随便写的", _ts: N - D }), "昨天");
  assert.match(K.phoneChatWhen({ time: "随便写的", _ts: N - 3 * D }), /^\d+月\d+日$/, "更早的没写成日期");
  assert.match(K.phoneChatWhen({ time: "x", _ts: new Date(2024, 2, 11).getTime() }), /^2024年3月11日$/, "跨年丢了年份");
  // ⚠️没有 _ts 的老数据只能退回原话，不许瞎猜
  assert.equal(K.phoneChatWhen({ time: "周一" }), "周一");
  assert.equal(K.phoneChatWhen(null), "");
  // 两处会话列表都要用它，漏一处就还是两种写法并排
  assert.equal((ph.match(/phoneChatWhen\(c\)/g) || []).length, 3, "有一处会话列表还在直接显示模型写回来的那句（桌面组件那一处最容易漏）");
  assert.ok(ph.indexOf('} }, c.time || "")') < 0, "还有地方原样显示存着的那句时间");
});

// ⚠️存那一端排好了只管【下次刷新】，已经存着的那份还是乱的。
// 会话列表乱序一眼就假：今天下午那条掉在前天下面，微信不会长这样。所以显示这端也要排。
test("显示这一端也按时间排，不用等下次刷新", () => {
  const i = ph.indexOf("function WeChatViewFull(");
  const seg = ph.slice(i, ph.indexOf("const meName", i));
  assert.match(seg, /const byWhen = list => \{/, "显示这端没排");
  assert.match(seg, /known\.sort\(\(a, b\) => b\._ts - a\._ts\)/, "没按新→旧");
  assert.match(seg, /return known\.concat\(unknown\)/, "认不出的没沉底");
  // 真实互通那几条不参与排序：那是她跟他此刻正在说的话，永远在最前
  assert.match(seg, /const chats = \[\.\.\.actual, \.\.\.byWhen\(generated\)\]/, "真实那几条被拿去跟推演的比时间了");
});
