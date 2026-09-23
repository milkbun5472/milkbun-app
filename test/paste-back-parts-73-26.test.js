// 她 2026-09-23 转来：「这个别人分段复制数据怎么粘不回来」——
// 读者一段一段贴完，最后一句「这几段拼不回去——中间少了一段，或者贴的时候被改动过」。
//
// 两个病，原来分不出来：
//   ① 某一段在粘贴路上被截掉一截（微信、备忘录、输入框各有上限，截了不吭声）——
//      要等全贴完才报错，而且不说是哪一段，她只能从头再来；
//   ② 拼的那一步是 fetch("data:…base64," + 整份)：几 MB 的 data: 地址，
//      QQ／微信内置浏览器（腾讯自己那套内核）会直接失败——走这条路的恰恰全是内置浏览器里的人。
// 这里【真跑】导出切段和贴回去那两段代码，不是只看字面。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");

// 桩照【写的那一段】来（stub-from-the-writer）：段头用 app.js 里那份 partHead 现拼，
// base64 用跟导出那头同样的转法（整份 UTF-8 字节 → base64 → 按 COPY_PART 切）。
function harness() {
  const grab = (a, b) => { const i = app.indexOf(a); const j = app.indexOf(b, i); assert.ok(i > 0 && j > i, "抠不出 " + a); return app.slice(i, j); };
  const toasts = [], imported = [];
  const ctx = { atob: s => Buffer.from(s, "base64").toString("binary"), TextDecoder, Uint8Array, Number, String, Object, Math,
    toast: m => toasts.push(m), useRef: v => ({ current: v }), doImportText: async t => { imported.push(t); return true; } };
  vm.createContext(ctx);
  vm.runInContext([
    grab("const COPY_PART = ", "\n"),
    grab("const partHead = ", "\n"),
    grab("const pasteBinRef = useRef(null);", "\n"),
    grab("const b64ToText = b64 => {", "\n  };") + "\n  };",
    grab("const doImportPasted = async raw => {", "\n  // ⚠️导入分两条路")
  ].join("\n") + "\nthis.head = partHead; this.paste = doImportPasted; this.PART = COPY_PART; this.dec = b64ToText;", ctx);
  return { ctx, toasts, imported };
}
function exportParts(ctx, text, id) {
  const b64 = Buffer.from(text, "utf8").toString("base64"), parts = [];
  for (let i = 0; i < b64.length; i += ctx.PART) parts.push(b64.slice(i, i + ctx.PART));
  return parts.map((p, k) => ctx.head(k + 1, parts.length, id, p.length) + "\n" + p);
}
// 一份跨了好几段的备份，中文字的几个字节还会落在段口上
const BIG = JSON.stringify({ __archive: 1, data: { x_chat: Array.from({ length: 9000 }, (_, i) => ({ role: "user", content: "第" + i + "句：今晚的月亮好圆，你看见了吗🌙" })) } });

test("整份切成几段，乱序贴回来，一个字不差", async () => {
  const { ctx, toasts, imported } = harness();
  const bodies = exportParts(ctx, BIG, "bT1");
  assert.ok(bodies.length >= 3, "测试备份不够大，没跨段");
  const order = bodies.map((_, i) => i).reverse();
  for (const k of order) {
    // 粘贴路上被加的空白：头尾换行、中间插一个空格
    const b = bodies[k];
    const cut = b.indexOf("\n") + 50;
    assert.equal(await ctx.paste("\n  " + b.slice(0, cut) + " \n" + b.slice(cut) + "\n\n"), true);
  }
  assert.equal(imported.length, 1, "齐了却没导进去：" + toasts.join(" | "));
  assert.equal(imported[0], BIG, "拼回去跟原来不一样");
});

test("某一段在粘贴路上被截了：贴进来那一刻就说是第几段，不收它", async () => {
  const { ctx, toasts, imported } = harness();
  const bodies = exportParts(ctx, BIG, "bT2");
  await ctx.paste(bodies[0]);
  assert.equal(await ctx.paste(bodies[1].slice(0, bodies[1].length - 3000)), false, "截断的那段被收下了");
  assert.match(toasts[toasts.length - 1], new RegExp("第 2/" + bodies.length + " 段被截断了"));
  assert.match(toasts[toasts.length - 1], /长按复制第 2 段/);
  assert.match(toasts[toasts.length - 1], /输入法的剪贴板/, "没点破最常见的那个截断来源");
  // 重新贴对了就接着走
  for (let k = 1; k < bodies.length; k++) await ctx.paste(bodies[k]);
  assert.equal(imported[0], BIG);
});

test("聊天软件往里塞了别的字：当场说是哪一段", async () => {
  const { ctx, toasts } = harness();
  const bodies = exportParts(ctx, BIG, "bT3");
  const bad = bodies[0].replace(/(\n[A-Za-z0-9+/]{40})/, "$1[长文本已折叠]");
  assert.equal(await ctx.paste(bad), false);
  assert.match(toasts[0], /第 1\/\d+ 段里混进了不是备份的字/);
});

test("老段头（没有长度那一格）照样认；除了最后一段都按整段验", async () => {
  const { ctx, toasts, imported } = harness();
  const b64 = Buffer.from(BIG, "utf8").toString("base64"), parts = [];
  for (let i = 0; i < b64.length; i += ctx.PART) parts.push(b64.slice(i, i + ctx.PART));
  const n = parts.length;
  assert.equal(await ctx.paste("QQJ-BACKUP 1/" + n + " old1\n" + parts[0].slice(0, 1000)), false, "老格式截断了没发现");
  for (let k = 0; k < n; k++) await ctx.paste("QQJ-BACKUP " + (k + 1) + "/" + n + " old1\n" + parts[k]);
  assert.equal(imported[0], BIG, toasts.join(" | "));
});

test("拼的那一步不再走几 MB 的 data: 地址", () => {
  // 数的是代码不是注释：旁边那段注释就写着原来那句 fetch
  const seg = app.slice(app.indexOf("const doImportPasted = "), app.indexOf("// ⚠️导入分两条路"))
    .split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert.doesNotMatch(seg, /fetch\("data:/, "又把整份塞进 data: 地址了——内置浏览器会直接失败");
  assert.match(seg, /whole = b64ToText\(joined\.join\(""\)\)/);
});

// 她 2026-09-23 第二张截图：输入法剪贴板里 1/3、2/3、3/3 是 bmudoiuig 那次导出，
// 底下还有一段 3/3 bmud2wwy0——另一次的。原来「编号一换就另起一个」，贴错一段前面的全扔了。
test("贴进一段别的导出的：前面攒好的不扔，当面说清是两次导出", async () => {
  const { ctx, toasts, imported } = harness();
  const a = exportParts(ctx, BIG, "bmudoiuig"), b = exportParts(ctx, BIG.replace("月亮", "星星"), "bmud2wwy0");
  await ctx.paste(a[0]);
  await ctx.paste(a[1]);
  await ctx.paste(b[b.length - 1]);                       // 手滑点到另一次导出的最后一段
  assert.match(toasts[toasts.length - 1] + toasts[toasts.length - 2], /另一次导出的/);
  for (let k = 2; k < a.length; k++) await ctx.paste(a[k]); // 接着把这一次的贴完
  assert.equal(imported.length, 1, toasts.join(" | "));
  assert.equal(imported[0], BIG, "前面贴好的那几段被扔了");
});

test("段头被删了、只剩 base64：直说那一行别删，不当成整份去解", async () => {
  const { ctx, toasts, imported } = harness();
  const a = exportParts(ctx, BIG, "bX1");
  const bodyOnly = a[0].slice(a[0].indexOf("\n") + 1);
  assert.equal(await ctx.paste(bodyOnly), false);
  assert.match(toasts[0], /开头那行「QQJ-BACKUP …」被删掉了——那一行别删/);
  assert.equal(imported.length, 0, "没段头的 base64 被当成 JSON 送去导入了");
});

test("贴之前就说清：段头别删、别从输入法剪贴板点、几段要同一次导出", () => {
  const screens = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");
  assert.match(screens, /每段开头那一行段头原样带着，别删/);
  assert.match(screens, /别从输入法的剪贴板列表里点/);
  assert.match(screens, /几段得是同一次导出的/);
});
