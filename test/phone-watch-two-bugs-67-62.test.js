// 她 2026-09-12 点名「看他玩那两个 bug 一直没修」，查出来是这两条：
//   ① 点不开她那条对话——她跟这个角色一条消息都没聊过时，他手机里压根没有跟她的那条，
//      于是他想点开也点不着，而且屏幕上一声不响。
//   ② 还是来回翻同几张／同几个 app——她 2026-09-10 连报三次，里头那几样修到了，
//      **app 那一头和只是「看着」的那几样没跟上**。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const W = require("../js/phone-watch.js");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const phone = fs.readFileSync(path.join(root, "js/phone.js"), "utf8");

test("app 那一头的记性只记上一段＝严格轮流，在两拨之间来回倒", () => {
  const has = ["wechat", "album", "notes", "music", "mail", "bili"];
  // 只记上一段是什么样（v67.62 之前）：开了后三个，下一段前三个回到队首，再下一段又倒回去
  const onlyLast = (list, last) => list.filter(k => last.indexOf(k) < 0).concat(list.filter(k => last.indexOf(k) >= 0));
  const r1 = onlyLast(has, ["wechat", "album", "notes"]);
  const r2 = onlyLast(has, r1.slice(0, 3));
  assert.deepEqual(r2.slice(0, 3), ["wechat", "album", "notes"], "这条基线要是不成立，下面那条就白测了");
  // 滚动记着最近几段之后：刚开过的那几个不会两段之后就回到队首
  const q1 = W.appQueue(has, ["wechat", "album", "notes"]);          // 最近开过前三个
  assert.deepEqual(q1.slice(0, 3), ["music", "mail", "bili"]);
  const q2 = W.appQueue(has, q1.slice(0, 3).concat(["wechat", "album", "notes"]));
  assert.notDeepEqual(q2.slice(0, 3), ["wechat", "album", "notes"], "两段之后又整拨倒回去了");
  // 队首留下的那两个是【最久没碰过的】：album、notes（wechat 排第四，跟着沉了）
  assert.deepEqual(q2.slice(0, 2), ["album", "notes"]);
});

test("全都刷过了也得有一半排在前面：全沉底＝谁也没沉底", () => {
  const has = ["a", "b", "c", "d"];
  const q = W.appQueue(has, ["a", "b", "c", "d"]);
  assert.equal(q.length, 4);
  assert.deepEqual(q.slice(0, 2), ["c", "d"], "一个都没给他留下");
  // 统共就两个 app 的时候不动名单：再沉就没得开了
  assert.deepEqual(W.appQueue(["a", "b"], ["a", "b"]), ["a", "b"]);
  // 一次都没看过的时候不动名单
  assert.deepEqual(W.appQueue(has, []), has);
  assert.deepEqual(W.appQueue([], ["a"]), []);
});

test("只是「看着」的那几样，从来没被记下来过", () => {
  // 桩钉在【词表】那一头：look 带的是 at，不是 name（施工规则/stub-from-the-writer.md）
  assert.deepEqual(W.WATCH_ACTS.look.args, ["at"]);
  const got = W.normalizeActs([{ kind: "look", at: "海边那张" }, { kind: "openItem", name: "他妈发的那条" }], null);
  assert.equal(got.acts[0].at, "海边那张");
  assert.equal(got.acts[0].name, undefined, "look 那一支居然带着 name——那这条 bug 就不是这么回事了");
  // 收料那一头要按 at 取，按 name 取等于这一支一次都没记下来过（而且不报错）
  assert.match(app, /const nm = a\.kind === "look" \? a\.at : a\.name;/);
  assert.match(app, /if \(\(a\.kind === "openItem" \|\| a\.kind === "look"\) && nm && its\.indexOf\(nm\) < 0\) its\.push\(nm\);/);
});

test("两样记性各存各的：上一段那份给提示词，滚动那份给排队", () => {
  assert.match(app, /const n = \{ \.\.\.m, \[char\.id\]: \{ a: opened, ra: mergedApps, i: merged \} \}/);
  assert.match(app, /const mergedApps = opened\.concat\(prevRa\.filter\(x => opened\.indexOf\(x\) < 0\)\)\.slice\(0, 12\)/);
  assert.match(app, /const seenApps = Array\.isArray\(seen0\) \? seen0 : \(\(seen0 && seen0\.ra\) \|\| seen \|\| \[\]\)/,
    "老存档（数组／只有 a 的那种）得接得住");
  // 「上一次你刷的是」说的就是上一次，不许拿滚动那份去顶
  assert.match(app, /const seen = Array\.isArray\(seen0\) \? seen0 : \(\(seen0 && seen0\.a\) \|\| \[\]\)/);
  assert.match(app, /recent: seen, recentItems: seenIts/);
});

test("她那条对话：一条消息都没聊过也得有，空的也得在那儿", () => {
  // 真聊天是从消息里长出来的：没消息就不 push（这是写的那一头，桩钉在它身上）
  assert.match(app, /const direct = clean\(chatsRef\.current\[char\.id\]\);\n\s*if \(direct\.length\) \{/);
  // 推演出来的那条会被 meLike 那道闸滤掉——所以补的这一条不能靠模型给
  assert.match(phone, /const meRow = \{ id: "actual:private:" \+ char\.id, type: "private", name: userName\(profile\),/);
  // 补在 actual 里，不另开一条名单：下游（排序、liveThread、看他玩认名字）一个字都不用改
  assert.match(phone, /const actual = \(hasMe \|\| !meRow\.name\) \? actual0 : actual0\.concat\(\[meRow\]\)/);
  // 已经有真的那条时不许再补一条（两条跟她的对话正是 v66 那次的老账）
  assert.match(phone, /const hasMe = actual0\.some\(c => c && c\.type !== "group"/);
  assert.match(phone, /phoneSamePerson\(c\.name, meRow\.name\)/);
  // 列表里那一行看得出来是空的
  assert.match(phone, /c\.last \|\| \(c\._empty \? "还没说过话" : ""\)/);
  // 他在这条空对话里打的字发出去仍然是【真的发到她手机上】：那条路一个字没动
  assert.match(app, /if \(where === "wechat" && watchIsMe\(char, to\) && String\(text \|\| ""\)\.trim\(\)\) \{/);
});
