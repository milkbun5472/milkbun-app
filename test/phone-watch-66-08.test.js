"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const W = require("../js/phone-watch.js");
const app = fs.readFileSync("js/app.js", "utf8");
const phone = fs.readFileSync("js/phone.js", "utf8");
const watchSrc = fs.readFileSync("js/phone-watch.js", "utf8");

// 她 2026-09-09 提、2026-09-10 定案：「查手机」的另一面——他在，我旁观他自己玩手机。

test("认不出来的动作丢掉、不猜；心声整段封顶", () => {
  const r = W.normalizeActs([
    { kind: "wake" }, { kind: "open", app: "wechat" }, { kind: "openChat", name: "老张" },
    { kind: "think", text: "a" }, { kind: "think", text: "b" }, { kind: "think", text: "c" },
    { kind: "think", text: "d" }, { kind: "think", text: "e" },
    { kind: "think", text: "  " }, { kind: "飞起来" }, null, "x"
  ]);
  assert.equal(r.acts.filter(a => a.kind === "think").length, W.THOUGHT_CAP);
  assert.ok(r.dropped.some(x => /飞起来/.test(x)), "认不出的动作没被丢掉——猜就是演出一件他没做的事");
  // ⚠️超额的心声是【扔掉】不是往后挪：往后挪等于还是发了 8 句，只是晚一点
  assert.ok(r.dropped.some(x => /超过 4 句/.test(x)));
  assert.equal(W.THOUGHT_CAP, 4, "她要的是三四句就够，多了变成配旁白的 PPT");
});

// ⚠️桩照着【写存档的那段】写：微信会话在 phone.js 里读的是 name/type/last/messages[{from,text}]/_ts
// （施工规则/stub-from-the-writer.md）
test("落盘：真发出去的那一条接进去，_ts 跟着重算", () => {
  assert.match(phone, /const chats = \[\.\.\.actual, \.\.\.byWhen\(generated\)\];/, "会话列表的读法变了，这份桩要跟着改");
  assert.match(phone, /known\.sort\(\(a, b\) => b\._ts - a\._ts\)/, "排序不再按 _ts 了？");
  const d = { me: { wechatName: "屿白" }, chats: [{ name: "老张", last: "晚上来不来", _ts: 1, messages: [{ from: "老张", text: "晚上来不来" }] }] };
  const r = W.applyWrite("wechat", d, "老张", "晚点说", 999);
  assert.equal(r.wrote, true);
  assert.equal(r.d.chats.length, 1, "同一个人被写成了两行");
  assert.equal(r.d.chats[0].messages.length, 2);
  assert.equal(r.d.chats[0].last, "晚点说");
  // ⚠️不重算的话，刚说完话的会话会被排到列表最底下（v59.41 那个病从这儿能漏回来）
  assert.equal(r.d.chats[0]._ts, 999);
  // 没打字就按发送＝什么也没发生
  assert.equal(W.applyWrite("wechat", d, "老张", "   ", 999).wrote, false);
  assert.equal(W.applyWrite("wechat", d, "", "在吗", 999).wrote, false);
  // 原来那份不许被就地改坏
  assert.equal(d.chats[0].messages.length, 1);
});

test("「打了又删」不在落盘这一头：到这儿的只有真按下发送的那句", () => {
  // 草稿是播放器手里的（type/erase 边演边攒）。各记一份草稿就有两个真相。
  assert.ok(watchSrc.indexOf("function applyActs") < 0, "又冒出一份从动作串里推草稿的实现");
  assert.match(watchSrc, /到这儿的只有【真按下那一下】的最终结果/);
  assert.match(phone, /a\.kind === "erase"/, "播放器里没有删字那一支");
});

test("敲一下：本次递进 + 跨次三天半衰", () => {
  const now = Date.now();
  assert.match(W.knockStep(1).hint, /第一下/);
  assert.match(W.knockStep(2).hint, /第二下/);
  assert.match(W.knockStep(5).hint, /第 5 下/);
  assert.equal(W.knockOver(W.KNOCK_CAP), true, "敲到上限还在调模型＝白花钱");
  // 三天前敲的那一下，今天只算半下
  assert.ok(Math.abs(W.knockDecayed([now - W.KNOCK_HALFLIFE_MS], now) - 0.5) < 0.02);
  assert.ok(Math.abs(W.knockDecayed([now], now) - 1) < 0.02);
  assert.equal(W.knockDecayed([now - W.KNOCK_HALFLIFE_MS * 40], now), 0, "太久远的还在算");
  assert.equal(W.knockPush([], now).length, 1);
});

test("好感：封顶 ±1，而且不写死成负的", () => {
  assert.equal(W.clampWatchAff(5), 1);
  assert.equal(W.clampWatchAff(-9), -1);
  assert.equal(W.clampWatchAff(0), 0);
  // ⚠️他被你撞见在翻你的照片，完全可以是加分的——方向交给人设，这儿只兜幅度
  assert.match(watchSrc, /方向不写死成负的/);
  assert.match(app, /不是默认不高兴/);
  // 连着敲不叠加
  assert.match(app, /if \(d && nth === 1\) bumpAff\(char\.id, d\);/);
});

test("冷却：同一个角色 30 分钟（测试期间闸是关着的）", () => {
  assert.equal(W.WATCH_COOLDOWN_MS, 30 * 60000, "数别丢了——闸关着不代表这个数没用了");
  // ⚠️她 2026-09-10：「测试这段时间先把 30 分钟限制 disable 一下吧」。
  //   关的是【闸】不是【数】；要开回来把 WATCH_COOLDOWN_OFF 改成 false 就行。
  //   记在 屎山台账-2026-09-06.md 里，别忘了它现在是关着的。
  assert.equal(W.WATCH_COOLDOWN_OFF, true, "闸开回来了？那就把这条断言和台账那一行一起改掉");
  assert.equal(W.cooldownLeft(Date.now(), Date.now()), 0, "闸关着的时候不该还挡");
  assert.equal(W.cooldownLeft(0, Date.now()), 0, "从来没看过的时候应该能看");
  // 先记时刻再刷（跟查手机那条链同一个形状）：中途失败也不该下次又整份重来
  assert.match(app, /先记时刻再刷/);
});

test("写盘走现成的 savePhoneApp，不另开一条路", () => {
  assert.match(app, /savePhoneApp\(char\.id, where, r\.d, \{ noArchive: true, patched: true \}\)/);
  // ⚠️patched：这一份本来就是在旧那份上改出来的，再过一遍累积层就会重复——
  //   _ts 变了，而 phoneGrowList 对日志类按【名字＋时刻】认人，于是同一个人出现两次。
  assert.match(app, /let merged = \(opts && opts\.patched\) \? d/);
  assert.match(app, /微信「只问 updates」那一路（v59\.54）绕开 phoneGrowList，正是同一个理由/);
  // ⚠️noArchive：归档是给【整份覆盖】准备的；他刷手机是接着往下写，旧的还在
  assert.match(app, /if \(!\(opts && opts\.noArchive\)\) archivePhoneApp/);
});

test("提示词：给词表和判据，一个内容示范都不给", () => {
  const s = W.watchInstruction({ char: { name: "某某" }, uName: "她", apps: ["wechat"], phone: { wechat: { chats: [{ name: "甲", last: "乙" }] } } });
  W.ACT_KEYS.forEach(k => assert.ok(s.indexOf("· " + k) >= 0, "词表里少了 " + k));
  assert.match(s, /大部分时候你什么也没干成/);
  assert.match(s, /没发出去的那句才是最像你的/);
  // ⚠️施工规则/prompt-no-content-samples.md：写一段「他给老张发『晚点说』」当例子，
  //   出来的就是每个角色都在给老张发晚点说
  assert.ok(watchSrc.indexOf("一个内容示范都不给") > 0);
  // schemaHint 里的占位值是【说明】不是【样例内容】
  const hint = W.watchSchemaHint();
  assert.match(hint, /"text":"你打的字，或者 think 时你心里那一句"/);
  assert.ok(hint.indexOf("晚点说") < 0);
});

test("这一处也接上了公共那几层，maxTokens 给足", () => {
  const seg = app.slice(app.indexOf("const genWatchSession = async char =>"), app.indexOf("const watchSend ="));
  // 走 runProbe({voice:true}) ＝ buildBundle 整份白得（人设/心情/好感/反八股…）
  assert.match(seg, /voice: true/);
  assert.match(seg, /instruction: WK\.watchInstruction/);
  assert.match(seg, /maxTokens: 20000/);
  // 料全在 system、user 只留一句触发——runProbe 本来就是这个形状（prompt-send-shape.md）
  assert.match(fs.readFileSync("js/engine.js", "utf8"), /\[\{ role: "user", content: "开始。" \}\]/);
  // 报错要带着模型真回的那个东西本身
  assert.match(seg, /模型回的是：/);
});

test("界面：三处 return 套同一个罩子，hook 在所有早返回上面", () => {
  assert.equal((phone.match(/const watchSkin = view =>/g) || []).length, 1, "罩子写了不止一份");
  assert.equal((phone.match(/return watchSkin\(/g) || []).length, 3, "三处 return（app 里／锁屏／桌面）没都套上");
  // ⚠️这个组件下面有好几处早返回，hook 挂在它们后面就是条件调用，整页会白
  const iHook = phone.indexOf("  useEffect(() => {\n    if (!watch || watch.done || !WK) return;");
  const iRet = phone.indexOf("  if (!char) return h(\"div\", {");
  assert.ok(iHook > 0 && iRet > iHook, "播放器那串 hook 跑到早返回后面去了");
  // 他操作的就是她平时翻的那一屏，不另做一套
  assert.match(phone, /不另做一份「他的微信」/);
  assert.match(phone, /drive: ctx\.drive/);
  // 「看他玩」开着时不许顺手再生成一次（那是另一枪，还会把正在演的那份盖掉）
  assert.match(phone, /if \(drive \|\| isLive \|\| charData\[appKey\]\) return;/);
});

test("光标靠挂点量出来，不猜坐标", () => {
  assert.equal(W.watchTargetSel({ kind: "openItem", name: "甲" }), '[data-watch="item:甲"]');
  assert.equal(W.watchTargetSel({ kind: "tab", name: "moments" }), '[data-watch="tab:moments"]');
  // 会话／照片／便签统一成 item:xxx——各挂一种前缀的话，播放器那头要认三种
  assert.match(phone, /"data-watch": "item:" \+ \(c\.name \|\| ""\)/, "微信会话");
  assert.match(phone, /"data-watch": "item:" \+ \(it\.caption \|\| ""\)/, "相册照片");
  assert.match(phone, /"data-watch": "item:" \+ \(it\.title \|\| ""\)/, "便签");
  assert.match(phone, /"data-watch": "tab:" \+ k/);
  assert.match(phone, /猜出来的点会落在空处/);
});

// ── 第二批：相册（纯看）+ 便签（改）──────────────────────────────
// 她 2026-09-10：「不一定是每次要加新东西，可以是比如说点开一张已有的照片然后
// 屏幕某处有他的想法之类的，或者是要删的备忘录他划掉重新写」。

test("一个动词管所有 app 里「点开一样东西」", () => {
  // openChat / openPhoto / openNote 各写一个的话，第三批加浏览器就是第四个，
  // 播放器那头要 if 四次（一层写在四处）
  assert.ok(W.ACT_KEYS.indexOf("openItem") >= 0);
  assert.ok(W.ACT_KEYS.indexOf("openChat") < 0, "旧名字还留在正式词表里");
  // 旧名字和几个模型爱写的同义词照收不误
  ["openChat", "openPhoto", "openNote"].forEach(k =>
    assert.equal(W.normalizeActs([{ kind: k, name: "甲" }]).acts[0].kind, "openItem", k + " 没被收进来"));
  assert.equal(W.normalizeActs([{ kind: "save" }]).acts[0].kind, "send");
});

test("便签是【改】不是【新写一条】：按标题认人", () => {
  const d = { items: [{ title: "周四交稿", body: "记得改开头", time: "昨天" }, { title: "买牙膏", body: "" }] };
  const r = W.applyWrite("notes", d, "周四交稿", "改开头，再补一段结尾", 999);
  assert.equal(r.wrote, true);
  assert.equal(r.d.items.length, 2, "改一条变成了两条");
  assert.equal(r.d.items[0].body, "改开头，再补一段结尾");
  assert.equal(r.d.items[0].title, "周四交稿", "标题被改掉了——那就不是同一条便签了");
  // 便签是名册（PHONE_RETIRE 里登记着），身份就是标题
  assert.match(fs.readFileSync("js/phone.js", "utf8"), /notes: \{ items: "便签" \}/);
  // 原来那份不许被就地改坏
  assert.equal(d.items[0].body, "记得改开头");
  // 认不到就当新写一条（他确实可能随手记一句）
  assert.equal(W.applyWrite("notes", d, "", "随手记一句", 999).d.items[0].title, "随手记一句");
});

test("相册那一路零写入：只演不落", () => {
  assert.equal(W.applyWrite("album", { items: [{ caption: "海边那天" }] }, "海边那天", "什么", 1).wrote, false);
  // 还没接的 app 也一样——绝不乱写
  assert.equal(W.applyWrite("browser", {}, "x", "y", 1).wrote, false);
  assert.match(watchSrc, /还没接的 app：只演不落，绝不乱写/);
  // 提示词里也说死了
  const s = W.watchInstruction({ char: {}, uName: "她", apps: ["album"], phone: { album: { items: [{ caption: "甲" }] } } });
  assert.match(s, /这一路你什么都改不了，也不该改/);
});

test("打得开哪几个 app 只此一份名单", () => {
  assert.match(app, /const WATCH_APPS = \["wechat", "album", "notes"\]/);
  // 提示词、归一、播放器都读它，不各写一份
  assert.match(app, /WATCH_APPS\.indexOf\(a\.key\) >= 0/);
  assert.match(app, /apps: WATCH_APPS/);
  const s = W.watchInstruction({ char: {}, uName: "她", apps: ["wechat", "album", "notes"], phone: {} });
  assert.match(s, /\*\*能打开的只有这几个\*\*：wechat \/ album \/ notes/);
  // 空的 app 要明说别点进去，不然他会点开一个空相册愣着
  assert.match(s, /相册还是空的，那就别点进去/);
});

test("落盘一个入口按 app 分流，不是每个 app 一个函数", () => {
  assert.equal((watchSrc.match(/function applyWrite\(/g) || []).length, 1);
  assert.match(app, /const r = WK\.applyWrite\(where, cur, to, text, Date\.now\(\)\);/);
  // 那个 app 还没生成过就没有底稿可接
  assert.match(app, /if \(!cur\) return;/);
});

test("界面：相册和便签也接了 drive，一份 drive 三个 app 共用", () => {
  assert.match(phone, /function AlbumView\(\{ d, char, t, onBack, onRefresh, refreshing, onPeek, onDrawPhoto, drawing, drive \}\)/);
  assert.match(phone, /function StickyView\(\{ d, char, t, onBack, onRefresh, refreshing, onPeek, drive \}\)/);
  assert.match(phone, /h\(AlbumView, \{ drive: ctx\.drive/);
  assert.match(phone, /h\(StickyView, \{ drive: ctx\.drive/);
  // 一份 drive 递给所有被驱动的 app——各拼一份的话，第三批又要多一支
  assert.match(phone, /drive: watch \? \{ tab: watch\.tab, item: watch\.item, typing: watch\.typing,/);
  // 同一个 openItem/send 在微信和便签里做的事不一样，所以播放器要知道此刻开着哪个 app
  assert.match(phone, /const openRef = useRef\(null\);/);
  assert.match(phone, /openRef\.current === "wechat" \? ""/);
  // 便签里点开一条，手上那份草稿就是它现在的正文（不然没东西可划）
  assert.match(phone, /const noteBodyOf = title =>/);
});
