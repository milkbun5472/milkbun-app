const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const scr = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");
test("封面：挑过用挑的、挑的那张揭掉了退回第一张；底栏过 stickerSrc", () => {
  const src = comp.slice(comp.indexOf("function packCoverOf"), comp.indexOf("function StickerPanel"));
  const f = new Function(src + "; return packCoverOf;")();
  const a = { id: "a" }, b = { id: "b" };
  assert.strictEqual(f({ emotes: [a, b] }), a);
  assert.strictEqual(f({ emotes: [a, b], cover: "b" }), b);
  assert.strictEqual(f({ emotes: [a], cover: "b" }), a);
  assert.ok(comp.includes("src: stickerSrc((packCoverOf(pk) || {}).url)"));
  assert.ok(scr.includes("onUpdatePack(pack.id, { cover: selEmotes[0] })"));
});
test("「挑几张」和「设成封面」包在 note 右边那一格里，不许把挑几张挤掉", () => {
  const i = scr.indexOf('note("这一版上贴着的"');
  const seg = scr.slice(i, scr.indexOf('"挑几张"', i) + 10);
  assert.ok(seg.includes('className: "flex items-center shrink-0" }'));
});

// ⚠️她 2026-09-30 拿两张截图来问：「为啥设了表情包封面实际不会变」「这两处都要」。
//   两处都坏了，而且**病根不一样**——所以下面分开钉，别合成一条：
//     ① 管理页那一排版面缩略图：压根没看 cover，写死拿 (p.emotes||[])[0]，
//        而且是裸 url（v74.382 修裂图只修了聊天那一格，这边漏了）。
//        她就是在这一页设的封面、也在这一页看结果，当然一点变化都没有。
//     ② 聊天面板底栏：代码是对的（走 packCoverOf），但 cover 在
//        emotePacksForChar 那一步【被整形掉了】——那儿只捡 id/name/emotes
//        重捏一个对象，新字段天生被留在门外，而且不报任何错。
//   桩照【写存档的那一段】写：updateEmotePack 就是 {...x, ...patch}，
//   存进去的是 em.id（施工规则/stub-from-the-writer）。
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");

test("① 管理页那一排缩略图跟着封面走，而且过 stickerSrc", () => {
  const i = scr.indexOf('// ── 一排「那一版贴纸的角」');
  const seg = scr.slice(i, scr.indexOf('!pack ?', i));
  assert.ok(i > 0 && seg.length > 200, "抠不出管理页那一排");
  assert.ok(seg.includes("const first = packCoverOf(p);"),
    "这一排必须走 packCoverOf，不许自己再写一遍「拿第一张」");
  assert.ok(!/\(p\.emotes \|\| \[\]\)\[0\]/.test(seg), "不许还留着写死拿第一张");
  assert.ok(seg.includes("src: stickerSrc(first.url)"),
    "必须过 stickerSrc，不然从相册贴的那些是一张裂图");
});

test("② 送进聊天面板的 packs 必须把 cover 带上（原来在这一步被整形掉了）", () => {
  const i = app.indexOf("const emotePacksForChar =");
  const seg = app.slice(i, app.indexOf("const emotePacksForGroup", i));
  assert.ok(i > 0 && seg.length > 100, "抠不出 emotePacksForChar");
  assert.match(seg, /cover: pk\.cover \|\| ""/,
    "只捡 id/name/emotes 重捏对象＝她挑的封面永远到不了聊天面板");
  // 真跑一遍那个 mapper：只切 .map( 的那一个箭头函数，别把后面的 .filter 也吃进来
  const a = seg.indexOf(".map(") + ".map(".length;
  const b = seg.indexOf("\n    .filter(pk => pk.emotes.length)");
  assert.ok(a > 5 && b > a, "抠不出 .map 那一个箭头函数");
  const f = new Function("pk", "return (" + seg.slice(a, b).trim().replace(/\)$/, "") + ")(pk);");
  const out = f({ id: "ep_1", name: "新字典 2", cover: "e9", emotes: [{ id: "e1", url: "u1" }, { id: "e9", url: "u9" }] });
  assert.strictEqual(out.cover, "e9");
  // 再接上 packCoverOf：端到端必须落在她挑的那张上
  const cov = new Function(comp.slice(comp.indexOf("function packCoverOf"), comp.indexOf("function StickerPanel")) + "; return packCoverOf;")();
  assert.strictEqual(cov(out).id, "e9", "端到端：她挑哪张，底栏就该画哪张");
});

test("③ 封面徽标按 id 比，不靠对象是同一个引用", () => {
  assert.ok(scr.includes("(packCoverOf(pack) || {}).id === em.id"),
    "用 === 比对象，中间谁 map 一下克隆了，徽标就无声地不见了");
});
