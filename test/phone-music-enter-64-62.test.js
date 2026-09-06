// 两件事（她 2026-09-06）：
// ① 「查手机也改成和情侣空间一样点进去就会播放吧」
// ② 「这个全刷的时间戳很怪，明明是昨天晚上刷的还是显示今天刚刷」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const phone = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");

// ── ① 进他手机就落针 ───────────────────────────────────────────────────────
test("落针/收针那套礼数只有一份，两处共用", () => {
  assert.match(app, /const roomMusicEnter = \(isMine, play\) => \{/);
  assert.match(app, /const roomMusicLeave = async isMine => \{/);
  // 情侣唱片和查手机都得走这一份——各写一份的话，第二处必然漏掉「暂借要还」那一半
  assert.match(app, /roomMusicEnter\(discSpinning, \(\) => discPlay\(cid, discNextId\(cid\)\)\)/);
  assert.match(app, /const discLeave = \(\) => roomMusicLeave\(discSpinning\);/);
  assert.match(app, /roomMusicEnter\(phoneMusicMine\(cid\), \(\) => playSong\(from, ss\.map\(x => x\.id\)\)\)/);
  assert.match(app, /const phoneMusicLeave = cid => roomMusicLeave\(phoneMusicMine\(cid\)\);/);
  // 那一半（进来前在放什么、放到哪儿、当时是不是真在放）必须留在共用那份里
  const seg = app.slice(app.indexOf("const roomMusicEnter"), app.indexOf("const discEnter = cid =>"));
  ["queue:", "t: (el && el.currentTime)", "playing: !!(el && !el.paused)"].forEach(k =>
    assert.ok(seg.indexOf(k) > 0, "共用那份里少了「暂借要还」的一样：" + k));
  assert.match(seg, /if \(!prev \|\| !resolveSong\(prev\.id\)\) \{ stopPlayer\(\); return; \}/,
    "进来前没在放的，出去该停干净");
});

test("认「现在响的是他那张」靠单子本身，不是靠 id 前缀", () => {
  // 唱片能看 sgd_ 前缀，手机歌单用的是普通的 sg_——照抄前缀那招会永远判成 false，
  // 于是每进一次都重新落针、还把她原来那首反复覆盖
  const f = app.slice(app.indexOf("const phoneMusicMine = cid => () => {"), app.indexOf("const phoneMusicNextId"));
  assert.match(f, /\(pl\.songs \|\| \[\]\)\.some\(x => x && x\.id === cur\)/, "没去问单子");
  assert.equal(f.indexOf('indexOf("sgd_")'), -1, "照抄了唱片那招前缀判断");
});

test("下次进来接着上次那首的下一首，不是从头再来", () => {
  // 唱片那边正因为写死第一首，她进出十次就把第一首听了十遍（她 2026-09-02 报的）
  const f = app.slice(app.indexOf("const phoneMusicNextId = cid => {"), app.indexOf("const phoneMusicEnter"));
  assert.match(f, /findIndex\(x => x && x\.id === \(pl\.lastId \|\| ""\)\)/, "没读针位");
  assert.match(f, /ss\[k < 0 \? 0 : \(k \+ 1\) % ss\.length\]\.id/, "不是「下一首」，或者到底了不回头");
  assert.equal(f.indexOf("ss[0].id;"), -1, "还是写死第一首");
  // 算得出下一首、落针那一步却没用它——第一版就是这么漏过去的
  const e = app.slice(app.indexOf("const phoneMusicEnter = cid => {"), app.indexOf("const phoneMusicLeave"));
  assert.match(e, /const from = phoneMusicNextId\(cid\);/, "落针那一步没读针位，还是从头放");
  // 针位得真的有人记
  const eff = app.slice(app.indexOf("useEffect(() => {\n    const sid = player.songId;"), app.indexOf("}, [player.songId]);"));
  assert.match(eff, /lastId: sid/, "手机歌单的针位没人记，下次还是从头");
  assert.match(eff, /x\.charId && \(x\.songs \|\| \[\]\)\.some/, "记针位时没认出这首属于谁那张单子");
});

test("只在真进了某个人的手机时才落针，通讯录那一屏不算", () => {
  assert.match(phone, /const inPhoneOf = !inList && char \? char\.id : null;/, "没分清「名单」和「他的手机」");
  const seg = phone.slice(phone.indexOf("const inPhoneOf ="), phone.indexOf("}, [inPhoneOf]);") + 16);
  assert.match(seg, /onPhoneMusicEnter\(inPhoneOf\);/);
  assert.match(seg, /return \(\) => \{ if \(onPhoneMusicLeave\) onPhoneMusicLeave\(inPhoneOf\); \};/, "退出去没收针");
  // ⚠️这个 effect 必须待在所有 return 上面（这份文件为这条摔过两次 #310）
  assert.ok(phone.indexOf("const inPhoneOf =") < phone.indexOf("  if (inList) {"),
    "落针那个 effect 掉到 return 下面了——列表页会少调一次 hook，点进某人手机当场白屏");
  assert.ok(phone.indexOf("const [inList") < phone.indexOf("const inPhoneOf ="),
    "inPhoneOf 用到了还没声明的 inList（const 有暂时性死区，一渲染就抛）");
});

// ── ② 「今天/昨天」比的是日历上的那一天 ────────────────────────────────────
test("昨晚刷的，今天中午看就该写「昨天」", () => {
  const seg = phone.slice(phone.indexOf("function phoneLastAllLabel(ts) {"), phone.indexOf("function phoneSearch("));
  const L = new Function("T", seg + "\nreturn phoneLastAllLabel;")(x => x);
  const at = (dayOffset, h, m) => { const d = new Date(); d.setDate(d.getDate() + dayOffset); d.setHours(h, m, 0, 0); return d.getTime(); };
  // 她那一屏：中午 12:01 看着「今天 20:42 刷过」——一个还没到的时刻
  const now = new Date();
  const y2042 = at(-1, 20, 42);
  assert.match(L(y2042), /^昨天 20:42 刷过$/, "昨晚 20:42 还被写成今天（按小时算才过了十几个钟头）");
  // 今天真刷过的仍然是「今天」
  if (now.getHours() >= 1) assert.match(L(at(0, 0, 30)), /^今天 00:30 刷过$/);
  // 前天、上周照旧
  assert.equal(L(at(-2, 20, 0)), "2 天前刷过");
  assert.match(L(at(-40, 9, 0)), /^\d+月\d+日刷过$/);
  assert.equal(L(0), "还没全刷过");
});
