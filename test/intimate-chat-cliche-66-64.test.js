// 她 2026-09-11：「你看单聊也是这样的八股」——截图里两句：
//   「这可是你说的」「等下要是求饶，我可当听不见」。
//
// ⚠️先查「这件事已经有人管了吗」（她同一轮立的判据：一堆禁令会变笨，先别急着加）：
//   管了。INTIMATE_CHAT_ANTI_CLICHE 就是 v60.45 专为【线上气泡】写的那一份，
//   而且它【确实发到了】单聊线上（buildBundle 里 push 着，不是挂在 narrativeCore 那条线下路上）。
//   毛病在于那一族靠【三个例句】认人：她抓到这两句一个都没长成那个样子——
//   一句只有前半截（把责任记到对方头上），一句只有后半截（预告一场惩罚）。
//   所以补的是【判据】，不是又一条禁令，也不是再堆几个例句。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const eng = fs.readFileSync(path.resolve(__dirname, "..", "js/engine.js"), "utf8");

test("这一族靠判据认人，不是靠例句", () => {
  const seg = eng.slice(eng.indexOf("const INTIMATE_CHAT_ANTI_CLICHE = "), eng.indexOf("// 隐私围栏一直只挡"));
  assert.match(seg, /认这一族靠判据，不是靠上面那三个例句/);
  assert.match(seg, /这句话是不是在为等下要发生的事先立个据/, "判据那一句没写出来");
  assert.match(seg, /骨架拆开说、换个词说，照样是同一族/, "没说清拆开说也算");
  // 原来那三个例句一个都不许删——判据是补上去的，不是替换
  ["等你X了看我怎么收拾你", "回头有你好受的", "我看你怎么Y"].forEach(x =>
    assert.ok(seg.indexOf(x) > 0, "原来那个例句没了：" + x));
  assert.match(seg, /反问式表功／翻旧账/, "另一族被顺手删了");
});

test("那一份【确实】发到单聊线上——不是漏发（查过才动手）", () => {
  // ⚠️这条不许删：下次再报八股时，第一件事仍然是确认它到底有没有发出去
  const bb = eng.slice(eng.indexOf("      parts.push(ANTI_CLICHE);"), eng.indexOf("      parts.push(STOCK_REPLY_BAN);"));
  assert.match(bb, /parts\.push\(INTIMATE_CHAT_ANTI_CLICHE\);/, "线上那条路上没有它——那才是漏发，改法就完全不同了");
  assert.match(eng, /P\.push\(INTIMATE_CHAT_ANTI_CLICHE\);/, "线下那条路上的那一份也不许丢");
});
