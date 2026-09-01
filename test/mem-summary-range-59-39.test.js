const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const cut = (a, b) => { const i = app.indexOf(a); return app.slice(i, app.indexOf(b, i)); };
const seg = cut("  const maybeSummarize = async charId => {", "  // ---- single chat ----");

// 她 2026-09-01：「每天浓缩一段，有几天是断层的但是明明每天都在聊」。
// 一条都没少——浓缩是【攒够 sumThresh 条消息】才跑一次，不是一天一次；
// 聊得少的那几天会并进下一次跑出来的那一段里。错的是戳：原来盖的是「今天」。
test("那一段的日期写的是它覆盖到哪几天，不是浓缩发生在哪天", () => {
  assert.ok(seg.indexOf('const d = new Date();\n            const seg = "【" + (d.getMonth()') < 0, "还在盖「今天」的戳");
  assert.match(seg, /const stamps = toSummarize\.map\(m => m && m\.ts\)/, "没去读这段消息自己的时间");
  assert.match(seg, /Math\.min\.apply\(null, stamps\)/, "没取这段的最早那条");
  assert.match(seg, /Math\.max\.apply\(null, stamps\)/, "没取这段的最晚那条");
  // 同一天就只写一天，跨天才写区间——不然满屏都是「7月8日–7月8日」
  assert.match(seg, /from && from !== to \? from \+ "–" \+ to : to/, "同一天也写成了区间");
  // 一条时间戳都没有时也得有个戳，不能写出「【】」
  assert.match(seg, /stamps\.length \? dz\(Math\.max\.apply\(null, stamps\)\) : dz\(Date\.now\(\)\)/, "没有时间戳时会写出空日期");
});

// 满仓 8000 字时原来直接 slice(-8000)，最上面那一段永远是半句开头、连日期都没有。
test("满仓时整段整段地掉，不拦腰砍", () => {
  assert.ok(!/if \(merged\.length > 8000\) merged = merged\.slice\(merged\.length - 8000\);\n            setMemFor/.test(seg),
    "还在按字数拦腰砍");
  assert.match(seg, /const segs = merged\.split\("\\n\\n"\)/, "没按段切开");
  assert.match(seg, /while \(segs\.length > 1 && segs\.join\("\\n\\n"\)\.length > 8000\) segs\.shift\(\)/, "没有从最老的那一段开始掉");
  // ⚠️单独一段就超过 8000 时还是得有个兜底，否则死循环或者整份留着撑爆
  assert.match(seg, /if \(merged\.length > 8000\) merged = merged\.slice\(merged\.length - 8000\);\s*\/\/ 单段就超仓/, "单段超仓没有兜底");
});

// 行为核一遍：把那一段逻辑抠出来真跑
test("真跑一遍：跨天写区间、同天写一天、满仓掉整段", () => {
  const dz = ts => { const x = new Date(ts); return (x.getMonth() + 1) + "月" + x.getDate() + "日"; };
  const label = list => {
    const stamps = list.map(m => m && m.ts).filter(x => typeof x === "number" && x > 0);
    const from = stamps.length ? dz(Math.min.apply(null, stamps)) : "";
    const to = stamps.length ? dz(Math.max.apply(null, stamps)) : dz(Date.now());
    return "【" + (from && from !== to ? from + "–" + to : to) + "】";
  };
  const D = 86400000, base = new Date(2026, 6, 3, 10).getTime();
  assert.equal(label([{ ts: base }, { ts: base + 5 * D }]), "【7月3日–7月8日】");
  assert.equal(label([{ ts: base }, { ts: base + 3600000 }]), "【7月3日】");
  assert.equal(label([{}, {}]).length > 2, true, "没时间戳时也得有个戳");
  const trim = merged => {
    if (merged.length > 8000) {
      const segs = merged.split("\n\n");
      while (segs.length > 1 && segs.join("\n\n").length > 8000) segs.shift();
      merged = segs.join("\n\n");
      if (merged.length > 8000) merged = merged.slice(merged.length - 8000);
    }
    return merged;
  };
  const blocks = Array.from({ length: 30 }, (_, i) => "【" + (i + 1) + "日】" + "字".repeat(400));
  const out = trim(blocks.join("\n\n"));
  assert.ok(out.length <= 8000, "没收进仓");
  assert.ok(out.startsWith("【"), "最上面那一段被拦腰砍了，开头不是日期");
  assert.ok(out.endsWith("字"), "掉的是新的那头，应该掉最老的");
});
