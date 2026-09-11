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
  assert.equal(r.acts.filter(a => a.kind === "think").length, 1, "连着的心声只留第一句：连在一起就是旁白");
  assert.ok(r.dropped.some(x => /飞起来/.test(x)), "认不出的动作没被丢掉——猜就是演出一件他没做的事");
  // ⚠️超额的心声是【扔掉】不是往后挪：往后挪等于还是发了 8 句，只是晚一点
  const many = W.normalizeActs([].concat(...Array.from({ length: 9 }, (_, i) =>
    [{ kind: "pause" }, { kind: "think", text: "t" + i }])));
  assert.equal(many.acts.filter(a => a.kind === "think").length, 4, "一次都没点开，就只有底数那几句");
  assert.ok(many.dropped.some(x => /超过 4 句/.test(x)));
  // ⚠️「三四句就够」是我自己编的、还写成了她的原话——她从没说过（2026-09-10 当场指出来）。
  //   她定的是「每点开一样东西就想一句」，所以这个数只是【一次都没点开时】的底数。
  assert.equal(W.THOUGHT_CAP, 4);
  assert.ok(!/她要的是「三四句/.test(watchSrc), "别再把自己的判断写成她的原话");
  assert.ok(watchSrc.indexOf("是我自己编的") > 0, "记着这一次：她的原话是记录，编一句安在她头上比写错代码更糟");
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
  // ⚠️她 2026-09-10 改了口径：微信【点开就得发】，所以这一句从「没发出去的那句」
  //   改成「改到一半的那句」——反悔照旧要演，但最后那一下不能省。
  assert.match(s, /改到一半的那句才是最像你的/);
  assert.match(s, /\*\*点开一个会话就是要跟这个人说话\*\*/);
  assert.match(s, /不许点开看两秒就退出去/);
  assert.match(s, /打完删光不发出去也算数/);
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
  // ⚠️她按【次】计费，token 给足不多花钱；两万在一段一百来个动作时会写到一半就收着写
  assert.match(seg, /maxTokens: 65535/);
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

test("相册：只有【挪去哪一摞】那一下写得动，别的一律只演不落", () => {
  // 她 2026-09-10：「照片换相册我是说【看他玩让他弄】，而不是给我加一个键」。
  // 翻照片仍然是零写入；挪进／挪出回收站是他自己按那几颗真键，走的还是同一条落盘路。
  assert.equal(W.applyWrite("album", { items: [{ caption: "海边那天" }] }, "海边那天", "什么", 1).wrote, false);
  const mv = W.applyWrite("album", { items: [{ caption: "海边那天" }, { caption: "楼下的猫" }] }, "海边那天。", "deleted", 1);
  assert.equal(mv.wrote, true);
  assert.equal(mv.d.items[0].category, "deleted");
  assert.equal(mv.d.items[1].category, undefined, "顺手把别的照片也挪了");
  // 中文也认（模型两种都会写）；「真的删掉」是真从这份 items 里拿掉
  assert.equal(W.applyWrite("album", { items: [{ caption: "甲" }] }, "甲", "捞回来", 1).d.items[0].category, "memory");
  assert.equal(W.applyWrite("album", { items: [{ caption: "甲" }, { caption: "乙" }] }, "甲", "gone", 1).d.items.length, 1);
  // 认不出这张照片、或者没说挪去哪儿：什么也不写，绝不猜
  assert.equal(W.applyWrite("album", { items: [{ caption: "甲" }] }, "不存在的", "deleted", 1).wrote, false);
  assert.equal(W.applyWrite("album", { items: [{ caption: "甲" }] }, "甲", "随便哪儿", 1).wrote, false);
  // 圆点落在详情页那三颗真键上，不是另挂一套假挂点
  assert.match(phone, /"data-watch": "move:deleted"/);
  assert.match(phone, /"data-watch": "move:memory"/);
  assert.match(phone, /"data-watch": "move:gone"/);
  assert.match(watchSrc, /if \(a\.kind === "move"\) return '\[data-watch="move:'/);
  // 还没接的 app 也一样——绝不乱写
  assert.equal(W.applyWrite("bili", {}, "x", "y", 1).wrote, false);
  assert.match(watchSrc, /还没接的 app：只演不落，绝不乱写/);
  // 提示词里也说死了
  const s = W.watchInstruction({ char: {}, uName: "她", apps: ["album"], phone: { album: { items: [{ caption: "甲" }] } } });
  assert.match(s, /move to:"deleted" 是扔进「删了又没真删的」/);
});

test("打得开哪几个 app 只此一份名单", () => {
  // 论坛和匿名信箱在名单里（她 2026-09-10：「可以点开看但是不改」），
  // ⚠️但 applyWrite 里一个分支都不许有——它们接的是真数据，发一帖就是真发出去。
  assert.match(app, /"calls", "mail", "reading", "tally", "bili", "latenight", "health", "calendar", "clipboard",\s*\n\s*"forum", "anon"\]/);
  assert.equal(W.applyWrite("forum", { posts: [] }, "帖子", "他要发的话", 1).wrote, false);
  assert.equal(W.applyWrite("anon", { records: [] }, "一封", "他要回的话", 1).wrote, false);
  // 提示词、归一、播放器都读它，不各写一份
  assert.match(app, /canApps\.indexOf\(a\.key\) >= 0/);
  // 名单先按【真有东西】筛一道：没生成过的 app 点进去是一屏转圈（看他玩不替他生成）
  assert.match(app, /apps: canApps/);
  assert.match(app, /const has = WATCH_APPS\.filter\(k => live\.indexOf\(k\) >= 0 \|\| \(ph\[k\] && typeof ph\[k\] === "object"\)\)/);
  const s = W.watchInstruction({ char: {}, uName: "她", apps: ["wechat", "album", "notes"], phone: {} });
  assert.match(s, /\*\*能打开的只有这几个\*\*：wechat \/ album \/ notes/);
  // 空的 app 要明说别点进去，不然他会点开一个空相册愣着
  assert.match(s, /相册还是空的，那就别点进去/);
});

test("落盘一个入口按 app 分流，不是每个 app 一个函数", () => {
  assert.equal((watchSrc.match(/function applyWrite\(/g) || []).length, 1);
  assert.match(app, /const r = WK\.applyWrite\(where, cur, to, text, Date\.now\(\), extra\);/);
  // 那个 app 还没生成过就没有底稿可接
  assert.match(app, /if \(!cur\) return;/);
});

test("界面：相册和便签也接了 drive，一份 drive 三个 app 共用", () => {
  assert.match(phone, /function AlbumView\(\{ d, char, t, onBack, onRefresh, refreshing, onPeek, onDrawPhoto, drawing, drive, onPhotoEdit \}\)/);
  assert.match(phone, /function StickyView\(\{ d, char, t, onBack, onRefresh, refreshing, onPeek, drive \}\)/);
  assert.match(phone, /h\(AlbumView, \{ drive: ctx\.drive/);
  assert.match(phone, /h\(StickyView, \{ drive: ctx\.drive/);
  // 一份 drive 递给所有被驱动的 app——各拼一份的话，第三批又要多一支
  assert.match(phone, /drive: watch \? \{ tab: watch\.tab, item: watch\.item, page: watch\.page, typing: watch\.typing,/);
  // 同一个 openItem/send 在微信和便签里做的事不一样，所以播放器要知道此刻开着哪个 app
  assert.match(phone, /const openRef = useRef\(null\);/);
  assert.match(phone, /\(openRef\.current === "wechat" \|\| openRef\.current === "calls" \|\| openRef\.current === "mail"\) \? ""/);
  // 便签里点开一条，手上那份草稿就是它现在的正文（不然没东西可划）
  assert.match(phone, /const noteBodyOf = title =>/);
});

// ── 第三批：浏览器（第一次现编新内容）+ 音乐（真数据）────────────────
test("浏览器：搜一次＝两层各动各的", () => {
  // searches 是【发生过什么】→ 📚 累积；tabs 是【现在开着哪几个】→ ♻️ 快照，新的顶到最前
  const b0 = { searches: [{ q: "旧的" }], tabs: [{ title: "旧标签" }] };
  const r = W.applyWrite("browser", b0, "怎么让开头不绕", "写作课", 999, { site: "知乎", gist: "先删第一段" });
  assert.equal(r.d.searches[0].q, "怎么让开头不绕");
  assert.equal(r.d.tabs[0].title, "写作课", "刚打开那一页没顶到最前面");
  assert.equal(r.d.tabs.length, 2, "旧标签页被抹掉了——tabs 是快照不是清空重来");
  // tabs 不在 PHONE_GROW 里＝它本来就是 ♻️（这份桩钉在写入方上）
  assert.match(fs.readFileSync("js/phone.js", "utf8"), /browser: \{ searches: 44, marks: 14, private: 10 \}/);
  // 搜了但什么都没点开，也是真会发生的一下
  assert.equal(W.applyWrite("browser", b0, "半夜睡不着", "", 999).d.searches[0].opened, "");
});

test("一次搜索来两下（send + openPage），不许记成两条", () => {
  let b = { searches: [], tabs: [] };
  b = W.applyWrite("browser", b, "怎么让开头不绕", "", 1000).d;
  b = W.applyWrite("browser", b, "怎么让开头不绕", "写作课", 1600, { site: "知乎" }).d;
  assert.equal(b.searches.length, 1, "同一句搜索词记了两遍（真机上一眼看见的）");
  assert.equal(b.searches[0].opened, "写作课", "第二下没把「点开了哪条」补上去");
  // 换一句、或者隔太久，就该是新的一条
  assert.equal(W.applyWrite("browser", b, "另一句", "", 1700).d.searches.length, 2);
  assert.equal(W.applyWrite("browser", b, "怎么让开头不绕", "", 99999999).d.searches.length, 2);
});

test("openPage 跟 openItem 分得开", () => {
  // openItem 打开【已经有的】，openPage 是【刚搜出来的那一页】。揉成一个词模型分不清
  assert.ok(W.ACT_KEYS.indexOf("openPage") >= 0);
  assert.equal(W.watchTargetSel({ kind: "openPage", name: "x" }), '[data-watch="result"]');
  // ⚠️这一页四个 app 共用一份（v66.22 搬进 PhoneWatch.WatchPage）：挂点长在组件身上，
  //   各屏只负责把 drive 和自己的配色递进去。
  assert.match(watchSrc, /h\("div", \{ "data-watch": "result", className: "absolute inset-0 flex flex-col"/);
  assert.match(phone, /const watchPageNode = \(drive, skin\)/);
  assert.equal((phone.match(/watchPageNode\(drive, \{/g) || []).length, 4, "浏览器/购物/外卖/小红书四屏都要摆这一页");
});

test("音乐不落 x_phone：它是真数据，点一首就真的放", () => {
  assert.equal(W.applyWrite("music", { songs: [] }, "Intro", "x", 1).wrote, false, "音乐不该写进 x_phone");
  assert.match(phone, /setOpen\(list\[i\]\.id \|\| \("s" \+ i\)\)/);
  assert.match(phone, /if \(onPlay\) onPlay\(list\[i\]\);/);
  // ⚠️open 存的是【那一行的 key】不是歌对象——照这一屏自己的写法来
  assert.match(phone, /open 存的是【那一行的 key】/);
  // 歌单单独递进提示词（它不在 x_phone 里）
  assert.match(app, /playlist: \(listenRef\.current\.playlists \|\| \[\]\)\.find/);
});

// ── 她 2026-09-10 真跑之后报的三条 ──────────────────────────────
test("微信：对面会回一句", () => {
  assert.ok(W.ACT_KEYS.indexOf("reply") >= 0);
  const d = { me: { wechatName: "屿白" }, chats: [{ name: "老张", messages: [{ from: "老张", text: "来不来" }], _ts: 1 }] };
  const r = W.applyReply(d, "老张", "行吧 那我先订着", 999);
  assert.equal(r.d.chats[0].messages.length, 2);
  assert.equal(r.d.chats[0].messages[1].from, "老张", "对面那条的 from 写成了他自己");
  assert.equal(r.d.chats[0]._ts, 999);
  // 对面得是已经存在的那个人
  assert.equal(W.applyReply(d, "陌生人", "喂", 1).wrote, false);
  // ⚠️跟 applyWrite 分开：那个写的是他自己发的话，from 不一样
  assert.match(watchSrc, /混在一个函数里迟早把 from 写错人/);
  assert.match(app, /const r = WK\.applyReply\(cur, name, text, Date\.now\(\), key\);/);
});

test("新消息要滚到屏幕最底下，而且有冒出来那一下", () => {
  // 她 2026-09-10：「发微信不会显示屏幕最底下，发出去的动画也没用」
  assert.match(phone, /const threadRef = useRef\(null\);/);
  assert.match(phone, /el\.scrollTop = el\.scrollHeight;/);
  // ⚠️两拍：这一帧 React 刚插进气泡，下一帧才量得到新的 scrollHeight
  assert.match(phone, /requestAnimationFrame\(\(\) => requestAnimationFrame\(\(\) => \{ el\.scrollTop = el\.scrollHeight; \}\)\);/);
  assert.match(phone, /animation: m\._new \? "wkpop/);
  assert.match(fs.readFileSync("index.html", "utf8"), /@keyframes wkpop/);
});

// ══════════════════════════════════════════════════════════════
// 第四批：购物 / 外卖 / 小红书（她 2026-09-10「都做了吧」）
// ══════════════════════════════════════════════════════════════
const PK = require("../js/phone.js");

test("购物：看过和买下是两回事", () => {
  // ⚠️桩照【写存档的那段】写：购物车那一行在 phone.js 里读的是 title/shop/price/qty/why，
  //   看过的那一行读的是 title/shop/price/time（施工规则/stub-from-the-writer.md）。
  const d0 = { viewed: [], cart: [] };
  const seen = W.applyWrite("shopping", d0, "一把椅子", "", 1000, { act: "openPage", site: "木作店", gist: "描述", price: 880 });
  assert.equal(seen.wrote, true);
  assert.equal(seen.d.viewed[0].title, "一把椅子");
  assert.equal(seen.d.viewed[0].price, 880);
  assert.equal(seen.d.cart.length, 0, "只是点进去看看，不该自己跳进购物车");

  const buy = W.applyWrite("shopping", seen.d, "一把椅子", "", 1000, { act: "send", site: "木作店", gist: "他终于点了", price: 880 });
  assert.equal(buy.d.cart[0].title, "一把椅子");
  assert.equal(buy.d.cart[0].qty, 1);
  assert.equal(buy.d.cart[0]._wk, 1, "♻️ 那一行要盖戳，不然周刷把它洗掉（走乙认的就是这枚戳）");
  // 同一件东西按两下不该在车里出现两遍
  assert.equal(W.applyWrite("shopping", buy.d, "一把椅子", "", 1001, { act: "send" }).wrote, false);
});

test("外卖：翻店不写，真下单才落，而且一下落两层", () => {
  const r = W.applyWrite("takeout", { live: [], orders: [] }, "一碗牛肉面", "", 2000, { act: "send", site: "老陈面馆", gist: "不要香菜", price: 28 });
  assert.equal(r.wrote, true);
  // 📚 这一顿是发生过的事
  assert.equal(r.d.orders[0].shop, "老陈面馆");
  assert.equal(r.d.orders[0].main, "一碗牛肉面");
  assert.equal(r.d.orders[0].amount, 28);
  // ♻️ 「他这会儿等着的」是当前状态——她要的「刷了外卖就把旧的顶掉」正是这一层
  assert.equal(r.d.live[0].shop, "老陈面馆");
  assert.equal(r.d.live[0].items, "一碗牛肉面");
  assert.equal(r.d.live[0]._wk, 1);
  assert.equal(W.applyWrite("takeout", { live: [], orders: [] }, "一碗牛肉面", "", 2000, { act: "openPage" }).wrote, false,
    "翻半天没点也很像他——那一下不许写进订单");
});

test("小红书：看过不等于赞过", () => {
  assert.equal(W.applyWrite("liked", { items: [] }, "一条笔记", "", 3000, { act: "openPage", site: "作者" }).wrote, false);
  const r = W.applyWrite("liked", { items: [] }, "一条笔记", "", 3000, { act: "send", site: "作者", gist: "正文" });
  assert.equal(r.d.items[0].act, "收藏");
  assert.equal(r.d.items[0].author, "作者");
  assert.equal(W.applyWrite("liked", r.d, "一条笔记", "", 3001, { act: "send" }).wrote, false, "同一条收藏两遍");
});

test("多少钱是单独一栏，不许拿滑动距离顶替", () => {
  const r = W.normalizeActs([{ kind: "openPage", name: "x", price: "88.5" }, { kind: "scroll", amount: 300 }]);
  assert.equal(r.acts[0].price, 88.5);
  assert.equal(r.acts[0].amount, undefined);
  assert.equal(r.acts[1].price, undefined);
  assert.match(watchSrc, /price 是标价/);
});

test("买东西那三个 app 没有输入框：send 按的是屏幕上那一页", () => {
  assert.match(phone, /const WATCH_BUY_APPS = \["shopping", "takeout", "liked"\]/);
  assert.match(phone, /else if \(WATCH_BUY_APPS\.indexOf\(where\) >= 0\)/);
  // 三屏都要接 drive，不然演了半天屏幕不动
  ["ShoppingView", "TakeoutView", "PlazaView"].forEach(v => {
    assert.match(phone, new RegExp("h\\(" + v + ", \\{ drive: ctx\\.drive"), v + " 没接上 drive");
  });
  // 挂点：切栏和点开一样东西都要抓得住，不然圆点落在空处
  ["tab:\" + pg.key", "item:\" + (it.title || \"\")"].forEach(x => assert.ok(phone.indexOf('"data-watch": "' + x) >= 0, "少了挂点：" + x));
});

// ══════════════════════════════════════════════════════════════
// 走乙：他自己刷出来的那几行，周刷不许凭空重编
// ══════════════════════════════════════════════════════════════
test("走乙：♻️ 那几栏里他做过的那几行，周刷之后还在", () => {
  const now = Date.now();
  const old = { tabs: [
    { title: "他刚开的那一页", _wk: 1, _wkAt: now - 3600000 },
    { title: "上一轮编出来的", site: "x" }
  ] };
  // 周刷是【整份重生成】：模型这一轮写的 tabs 里压根没有他刚开的那一页
  const merged = PK.phoneMergeSaved("browser", old, { tabs: [{ title: "模型新编的" }] }, now);
  const names = merged.tabs.map(x => x.title);
  assert.equal(names[0], "他刚开的那一页", "他做过的排最前面——那是刚刚发生的");
  assert.ok(names.indexOf("模型新编的") >= 0, "别的照旧重写，走乙只保他那几行");
  assert.ok(names.indexOf("上一轮编出来的") < 0, "没盖戳的旧行不该跟着留下——那一栏还是 ♻️");
});

test("走乙会过期，而且同名不许出现两遍", () => {
  const now = Date.now();
  const stale = { tabs: [{ title: "九天前那一页", _wk: 1, _wkAt: now - 9 * 86400000 }] };
  assert.ok(PK.phoneMergeSaved("browser", stale, { tabs: [] }, now).tabs.every(x => x.title !== "九天前那一页"),
    "留过 " + PK.PHONE_WATCH_KEEP_DAYS + " 天的还留着就是坟场了");
  assert.equal(PK.PHONE_WATCH_KEEP_DAYS >= 8, true, "得比一周长一点，下一次周刷才认得上一周他干的事");
  const dup = { cart: [{ title: "一把椅子", _wk: 1, _wkAt: now }] };
  const m = PK.phoneMergeSaved("shopping", dup, { cart: [{ title: "一把椅子", shop: "模型又写了一遍" }] }, now);
  assert.equal(m.cart.filter(x => x.title === "一把椅子").length, 1);
  assert.equal(m.cart[0]._wk, 1, "同名的以他那一行为准");
});

test("走乙也要说给模型听（代码兜死 + 提示词降概率，两头都要）", () => {
  const now = Date.now();
  const blk = PK.phoneWatchDraftBlock("takeout", { live: [{ shop: "老陈面馆", _wk: 1, _wkAt: now }] }, now);
  assert.match(blk, /他自己刚在手机上弄出来的/);
  assert.match(blk, /老陈面馆/);
  assert.equal(PK.phoneWatchDraftBlock("takeout", { live: [{ shop: "老陈面馆" }] }, now), "", "不是他刷出来的就别说");
  // 接进那一整段提示词里了（漏接的话这一层等于没有）
  assert.match(phone, /phoneRosterBlock\(key, known\) \+ phoneWatchDraftBlock\(key, known\)/);
  // ⚠️顺序：走乙必须排在 ♻️ 重写之后，排前面会被随后那一步抹掉
  assert.match(phone, /return phoneWatchKeep\(appKey, oldData, phoneGrowMerge\(/);
});

// ══════════════════════════════════════════════════════════════
// 第五批：剩下那些（她 2026-09-10「论坛匿名信箱都不要动其他都做了吧」）
// ══════════════════════════════════════════════════════════════
test("短信：跟微信同一个形状，只是那一屏认的键不一样", () => {
  // ⚠️桩照【画它那一屏】写：短信气泡认的是 from === "me"，不是 __me__
  assert.match(phone, /const mine = m2\.from === "me";/, "短信那一屏认人的写法变了，这份桩要跟着改");
  const d0 = { sms: [{ name: "老张", kind: "人", msgs: [{ from: "they", text: "在吗" }] }] };
  const r = W.applyWrite("calls", d0, "老张", "在", 1000);
  assert.equal(r.d.sms[0].msgs[1].from, "me");
  assert.equal(r.d.sms[0].unread, false, "他自己发完那一串就不该还标着未读");
  const back = W.applyReply(r.d, "老张", "那出来", 1001, "calls");
  assert.equal(back.d.sms[0].msgs[2].from, "they");
  assert.equal(back.d.sms[0].unread, true);
  // 不许凭空多出一个号码
  assert.equal(W.applyWrite("calls", d0, "谁也不是", "喂", 1000).wrote, false);
  // 通话记录只看不写
  assert.equal(W.applyWrite("calls", { calls: [{ name: "老张" }] }, "老张", "", 1000).wrote, false);
});

test("邮件：回信落进发件箱，收件人是原来那封的发件人", () => {
  const d0 = { inbox: [{ subject: "关于下周的稿子", from: "编辑 林" }], sent: [] };
  const r = W.applyWrite("mail", d0, "关于下周的稿子", "周四之前给您", 2000);
  assert.equal(r.d.sent[0].to, "编辑 林", "收件人写成标题就是回给了一个不存在的人");
  assert.match(r.d.sent[0].subject, /^回复：/);
  assert.equal(r.d.inbox.length, 1, "收件箱不该被动");
});

test("阅读：只动读到哪儿和那一条批注，书目一本不增不减", () => {
  const d0 = { shelves: [{ name: "床头", books: [{ title: "《长夜》", readAt: "读到 42%", note: "旧的" }] }] };
  const r = W.applyWrite("reading", d0, "《长夜》", "这一段写得真狠", 3000);
  assert.equal(r.d.shelves[0].books[0].note, "这一段写得真狠");
  assert.equal(r.d.shelves[0].books[0].readAt, "读到 42%", "他写批注不该把进度冲掉");
  // 红点认的是【同一个时间戳】（照 phoneApplyBookUpdates 那段来）
  assert.equal(r.d.shelves[0].books[0]._upd, 3000);
  assert.equal(r.d._lastUpd, 3000);
  assert.equal(W.applyWrite("reading", d0, "《架上没有这本》", "x", 3000).wrote, false, "不许凭空添一本书");
});

test("只能看的那几个：一个字都不许写进去", () => {
  // 账本、视频、深夜台、健康、日历、剪贴板——刷手机改不了这些
  // ⚠️视频、深夜台、剪贴板后来各自开了一条口子（看过的视频／深夜台那一条／复制的那段字），
  //   这一条钉的是剩下那几个「刷手机改不了」的。
  // ⚠️账本后来也开了口子（她 2026-09-10「开账本吧」）：只有健康／日历／时间线／
  //   论坛／匿名信箱是真的一个字都写不进去。
  ["health", "calendar", "timeline", "forum", "anon"].forEach(k => {
    assert.equal(W.applyWrite(k, { items: [{ title: "x" }] }, "x", "他写了点什么", 1).wrote, false, k + " 不该被写");
  });
  // 提示词里也要明说，不然模型会去试
  const s = W.watchInstruction({ char: {}, uName: "她", apps: ["forum", "health", "calendar"], phone: {} });
  assert.match(s, /这两处一个字都不许写/);
  // 论坛／匿名信箱这两处：看得见楼下的回复，也值得配一句心声
  assert.match(s, /点开能看见楼下那些回复/);
  assert.match(s, /看完可以想一句/);
  // ⚠️剪贴板后来开了一条口子（copy 随时随地能用），所以这句从「一个字都改不了」
  //   收成「点开只能看」——改的那一下不在这个 app 里发生。
  assert.match(s, /这三处点开只能看/);
});

test("十七个 app 各自的样子都发回去了，一个都不能漏", () => {
  const apps = ["wechat", "album", "notes", "browser", "music", "shopping", "takeout", "liked",
    "calls", "mail", "reading", "tally", "bili", "latenight", "health", "calendar", "clipboard"];
  const phoneState = { calls: { sms: [{ name: "老张", kind: "人" }] }, mail: { inbox: [{ subject: "稿子", from: "林" }] },
    reading: { shelves: [{ books: [{ title: "《长夜》" }] }] }, tally: { debts: [{ title: "欠着的那顿饭" }] },
    bili: { items: [{ title: "一条视频" }] }, latenight: { items: [{ title: "深夜那条" }] },
    health: { cards: [{ name: "睡眠" }] }, clipboard: { items: [{ text: "一串复制过的字" }] } };
  const s = W.watchInstruction({ char: {}, uName: "她", apps: apps, phone: phoneState,
    calendar: { items: [{ title: "周四交稿", date: "2026-09-11" }] } });
  ["老张", "稿子", "《长夜》", "欠着的那顿饭", "一条视频", "深夜那条", "睡眠", "一串复制过的字", "周四交稿"]
    .forEach(x => assert.ok(s.indexOf(x) >= 0, "这一段没发回去：" + x));
  // ⚠️日历跟音乐一样是真数据，不在 x_phone 里——得单独递进去
  assert.match(app, /calendar: \(typeof phoneCalendarFor === "function"/);
});

test("这一批的每一屏都接上了 drive，一屏都不许漏", () => {
  [["PhoneCallsView", "calls"], ["MailView", "mail"], ["ReadingView", "reading"], ["TallyView", "tally"],
   ["BiliView", "bili"], ["LateNightView", "latenight"], ["HealthView", "health"],
   ["ClipView", "clipboard"]].forEach(([v, k]) => {
    assert.match(phone, new RegExp("h\\(" + v + ", \\{ drive: ctx\\.drive"), v + " 没接上 drive");
  });
  assert.match(phone, /h\(CalendarView, \{ drive: ctx\.drive/);
  // 打字那三处：短信、邮件、批注各有一条只在看他玩时出现的输入条
  assert.equal((phone.match(/"data-watch": "input"/g) || []).length, 6,
    "微信 / 便签 / 浏览器 / 短信 / 邮件 / 批注 —— 有输入条的每一处都要挂 input");
});

test("切到别的 app 时那一栏要清掉，不然它跟着串门", () => {
  // 真机上抓到的：在电话里切到 sms，进邮件之后邮件也去找「sms」那一栏，整页空着
  assert.match(phone, /const go = \(\) => \{ if \(opened\) return; opened = true; setOpen\(app\.key\); setWatch\(w => w \? \{ \.\.\.w, item: null, page: null, tab: null,/);
  // ⚠️图标在桌面第二页时，先看着它翻过去再点开——瞬移等于「没翻页就开了」
  // ⚠️420 毫秒是拍出来的，平滑滚常常还没走完：改成【等它真停下来】再点开
  assert.match(phone, /if \(still >= 2 \|\| Date\.now\(\) - t0 > 380\) \{ go\(\); return; \}/);
  assert.match(phone, /a\.kind === "home"\) \{ setOpen\(null\); setWatch\(w => w \? \{ \.\.\.w, item: null, page: null, tab: null,/);
});

test("「他自己」在两屏上叫的名字不一样，别一律换成微信昵称", () => {
  // 真机上抓到的：短信里他自己发的那条被画成了对面的灰气泡——
  // 病根是递给各屏的 drive.sent 一律把 from 换成微信昵称，而短信那屏认的是死字符串 "me"。
  assert.match(phone, /from: x\.them \? x\.from : \(x\.from === "me" \? "me" :/);
});

// ══════════════════════════════════════════════════════════════
// 她 2026-09-10 报的那一串：点不开、写不了、光标不动
// ══════════════════════════════════════════════════════════════
test("认名字只此一份规矩：标点飘了也得认出来", () => {
  // 病根：模型回写的名字标点常常飘，严格等号的后果是【一声不响什么也没发生】
  //（她：「他打开相册图片点不开」）——页面没开、圆点也落不下去。
  assert.equal(W.sameName("《长夜》", "长夜"), true);
  assert.equal(W.sameName("海边那天", "海边 那天"), true);
  assert.equal(W.sameName("周四交稿。", "周四交稿"), true);
  assert.equal(W.sameName("甲", "乙"), false);
  assert.equal(W.sameName("一条视频", ""), false, "空名字不许乱认一个");
  // ⚠️两处必须用同一条：圆点找挂点用它，各屏找那一行也用它
  assert.match(phone, /const watchSame = \(a, b\) => \(typeof window !== "undefined" && window\.PhoneWatch && window\.PhoneWatch\.sameName\)/);
  assert.match(phone, /WK\.pickName\(all, name, el => String\(el\.getAttribute\("data-watch"\)\)\.slice\(5\)\)/);
  // ⚠️「像不像」不够，屏幕上要的是【挑哪一个】：两条都像的时候必须挑出同一条，
  //   否则圆点点在这一条上、点进去却是另一条（她 2026-09-10 在视频里看见的）。
  const list = [{ t: "夏天" }, { t: "夏天的海边" }];
  assert.equal(W.pickName(list, "夏天", x => x.t).t, "夏天", "有完全一样的就不许挑那条更长的");
  assert.equal(W.pickName(list, "夏天的海", x => x.t).t, "夏天的海边");
  assert.equal(W.pickName(list, "别的", x => x.t), null);
  assert.ok((phone.match(/watchPick\(/g) || []).length > 15, "各屏都要走同一条挑人规矩");
  assert.doesNotMatch(phone, /=== String\(driveItem\)/, "还有哪一屏在用严格等号认名字");
});

test("便签新写一条：正文不能是空的", () => {
  // 她：「便签现在也是只能在已有的加一句不能新写」——病根是他没点开任何一条时
  // who 是空的，于是抬头有了、正文写成了空串。
  const r = W.applyWrite("notes", { items: [] }, "", "明天记得取快递", 1);
  assert.equal(r.d.items[0].title, "明天记得取快递");
  assert.equal(r.d.items[0].body, "明天记得取快递", "新写的便签正文不许是空的");
  // 长的那种：抬头取前一截，正文还是整段
  const long = "先去取快递\n然后把稿子的开头改一遍，编辑说太绕";
  const r2 = W.applyWrite("notes", { items: [] }, "", long, 1);
  assert.equal(r2.d.items[0].title, "先去取快递");
  assert.equal(r2.d.items[0].body, long);
  // 点开已有的那条改正文，还是就地改（不许变成第二条）
  const r3 = W.applyWrite("notes", { items: [{ title: "周四交稿", body: "旧的" }] }, "周四交稿", "新的", 1);
  assert.equal(r3.d.items.length, 1);
  assert.equal(r3.d.items[0].body, "新的");
});

test("视频也能刷出一条新的点进去，看了就是看过了", () => {
  const r = W.applyWrite("bili", { items: [] }, "一条新视频", "", 1, { act: "openPage", site: "某人", gist: "讲了点什么" });
  assert.equal(r.d.items[0].title, "一条新视频");
  assert.equal(r.d.items[0].up, "某人");
  // ⚠️跟小红书分得开：那边点进去只是看，按了收藏才留
  assert.equal(W.applyWrite("liked", { items: [] }, "一条笔记", "", 1, { act: "openPage" }).wrote, false);
  const s = W.watchInstruction({ char: {}, uName: "她", apps: ["browser", "bili", "liked"], phone: {} });
  assert.match(s, /\*\*搜了就要点开一条\*\*/, "浏览器搜完不点开，屏幕上就是一片空白");
  assert.match(s, /视频：scroll 往下刷/);
});

test("圆点：先量后动，量不到再试几拍，翻不到就先把它翻出来", () => {
  // 她：「整体光标都不会移动」。三个病根，一个一个钉住：
  // ① 点开 app 那一下压根没有挂点
  assert.match(phone, /"data-watch": "app:" \+ a\.key/);
  assert.match(phone, /"data-watch": "app:" \+ jump/);
  // ② 返回键没有挂点（九十来页的顶栏都走公共 Head）
  assert.match(fs.readFileSync("js/components.js", "utf8"), /"data-watch": "back",\n\s*onClick: onBack/);
  // ③ 量的时机反了：手指按的是【按下去之前】那一屏，所以第一下必须当场同步量
  assert.match(phone, /attempt\(\);\n\s*\/\/ 按完才出现的那几样/);
  assert.match(phone, /const stopDot = watchDotTo\(WK\.watchTargetSel\(a\), a\.name \|\| a\.at \|\| ""\);[\s\S]{0,400}\/\/ ② 这一下的效果/);
  // 屏幕外的东西先翻出来再点，别把圆点甩到 x=630 那种看不见的地方
  assert.match(phone, /el\.scrollIntoView\(\{ block: "center", inline: "center", behavior: "smooth" \}\)/);
  // look 落在那样东西身上，不另挂一套 look: 的点
  assert.equal(W.watchTargetSel({ kind: "look", at: "海边那天" }), '[data-watch="item:海边那天"]');
});

test("他刷手机的时候，她那几颗按钮要收起来", () => {
  // 她 2026-09-10：「点开会显示转发给他看比如便签之类的，在他玩的时候能不能 hide」。
  // 这一屏此刻扮的是【他手里的手机】——屏幕上冒出一颗「转发给他，他会知道你翻了手机」就穿帮了。
  // ⚠️收在一处：二十来屏都是 `onPeek ? h("button"…) : null`，给它 null 就整片消失。
  assert.match(phone, /onPeek: drive \? null : \(live \|\| \{\}\)\.onPeek/);
  assert.ok((phone.match(/onPeek \? h\("button"/g) || []).length > 10, "各屏还是靠 onPeek 在不在来决定画不画");
  // 顶栏那颗「重新推演」不吃 null，就按住它（点一下是一枪真钱，还会盖掉正在演的这一份）
  assert.match(phone, /refreshing: drive \? true : !!busyKey/);
});

test("别老在同几个 app 之间来回", () => {
  // 她 2026-09-10：「为什么都在照片便签音乐来回看都不看别的」。
  // 病根一半是【名单顺序每次都一样】——模型总挑排在前面那几个，那是位置偏好不是他的性格。
  const s = W.watchInstruction({ char: {}, uName: "她", apps: ["wechat", "album", "notes"], phone: {}, recent: ["album", "notes"] });
  assert.match(s, /\*\*这一段里至少进 3 个不一样的 app\*\*/);
  assert.match(s, /上一次你刷的是：album、notes/);
  assert.doesNotMatch(W.watchInstruction({ char: {}, uName: "她", apps: ["wechat"], phone: {} }), /上一次你刷的是/,
    "第一次看他玩不该凭空说「上一次」");
  // 代码这一头：上次刷过的排到队尾，并且真的记下来
  assert.match(app, /const canApps = has\.filter\(k => seen\.indexOf\(k\) < 0\)\.concat\(has\.filter\(k => seen\.indexOf\(k\) >= 0\)\)/);
  assert.match(app, /saveJSON\("x_phoneWatchSeen", n\)/);
});

test("心声自己会退场，不许一直压在屏幕上", () => {
  // 她 2026-09-10：「台词显示太久了太碍眼了看不到屏幕」。
  // 原来它只在【演到下一个 think】才清掉；敲一下回的那句更糟，能挂到整段结束。
  // v66.38：加了暂停之后这一支改成【到点先看一眼旗子】（停着的时候那句话得留在屏幕上），
  // 所以别冻 setTimeout 那一行的形状，冻的是「到点会把它清掉」这件事本身。
  assert.match(phone, /setWatch\(w => \(w && w\.thought === thought\) \? \{ \.\.\.w, thought: "" \} : w\)/);
  assert.match(phone, /id = setTimeout\(bye, ms\)/, "没按那条命排退场");
  assert.match(phone, /Math\.min\(2600, 900 \+ String\(thought\)\.length \* 55\)/);
  // 倍速要跟着走：跳到最后的时候还慢慢念就更碍眼了
  assert.match(phone, /\/ \(\(watch && watch\.speed\) \|\| 1\)/);
});

test("敲一下：失败要说出来，而且不许白扣一次", () => {
  // 她 2026-09-10：「敲一敲有时候卡住了一直没反应」。三个哑口：
  // 没配线路直接 return ""、模型那一枪失败也 return ""（外面照样把这一下算掉）、卡住不返回。
  assert.match(app, /if \(!p\) throw new Error\("先去设置里配一条 API"\)/);
  assert.match(app, /他没抬头（超时）/);
  assert.match(app, /if \(!say\) throw new Error\("他这一下没吭声"\)/);
  const knockFn = app.slice(app.indexOf("const watchKnock = async"), app.indexOf("const genMoment"));
  assert.doesNotMatch(knockFn, /catch \(e\) \{ return ""; \}/, "又把敲一下的错吞回去了");
  assert.match(knockFn, /throw new Error\(e && e\.message/);
  // 真出声了才算这一下；没出声要报出来
  assert.match(phone, /const n = \(p\.knocks \|\| 0\) \+ \(say \? 1 : 0\);/);
  assert.match(phone, /onWatchToast\("没敲动："/);
  assert.match(app, /onWatchToast: toast/);
});

// ══════════════════════════════════════════════════════════════
// 另一个窗口报的那几条（2026-09-10 审计）
// ══════════════════════════════════════════════════════════════
test("scroll 不是个空动作：他刷的时候屏幕要真的动", () => {
  // ⚠️词表里有、提示词里三处让他用（小红书／视频／深夜台这三个「只能刷」的 app
  //   里他几乎只能干这个），可播放器原来一个分支都没有——屏幕纹丝不动地停 700 毫秒。
  assert.match(phone, /else if \(a\.kind === "scroll"\) \{/);
  assert.match(phone, /el\.scrollBy\(\{ top: px, behavior: "smooth" \}\)/);
  // 找的是【此刻真正在滚的那一块】，不写死某个 ref（二十来屏各有各的容器）
  assert.match(phone, /const watchScroller = \(\) => \{/);
  assert.match(phone, /if \(st !== "auto" && st !== "scroll"\) continue;/);
});

test("认名字：四处漏网的严格等号补上了", () => {
  // 后果是「点开了，然后什么也没发生」：effect 用模糊认名开了聊天，
  // 输入框和气泡却用严格等号，一个都不显示。
  assert.match(phone, /const driveOn = !!\(drive && drive\.item && thread && watchSame\(thread\.name, drive\.item\)\)/);
  assert.match(phone, /watchSame\(\(open\.x \|\| \{\}\)\.name, drive\.item\)/);
  assert.match(phone, /const hit = watchPick\(flat, title, b => b && b\.title\)/, "阅读的草稿取正文");
  assert.match(phone, /const hit = watchPick\(Array\.isArray\(it\) \? it : \[\], title, x => x && x\.title\)/, "便签的草稿取正文");
  // ⚠️便签那一处最阴：草稿取不到正文＝他划掉了一片空白，可落盘照样覆盖了那条便签
  assert.ok(phone.indexOf("演的和写的两回事") > 0);
});

test("他刚搜的那句不许跟着他串到别的 app 里", () => {
  // 先在浏览器搜「怎么煮溏心蛋」，后来点开购物点一件商品——那件商品会被存成那句搜索词
  assert.match(phone, /const q = openRef\.current === "browser" \? String\(\(watchRef\.current && watchRef\.current\.lastQ\) \|\| ""\) : "";/);
  // 换 app / 回桌面 / 锁屏都要把它清掉（一句话不能只堵一头）
  assert.equal((phone.match(/lastQ: ""/g) || []).length, 3);
});

test("群里回话的那个人，不能是他自己", () => {
  const d0 = { me: { wechatName: "屿白" }, chats: [{ name: "老同学群", type: "group",
    messages: [{ from: "屿白", text: "我先走了" }, { from: "阿松", text: "行" }] }] };
  const r = W.applyReply(d0, "老同学群", "那明天见", 1, "wechat");
  const last = r.d.chats[0].messages[2];
  assert.equal(last.from, "阿松", "拿群里第一条的发言人当回话的人，撞上他自己就把「对面的回复」落成了他的话");
  assert.notEqual(last.from, "屿白");
});

test("敲一下失败：跨次那一笔也不许记", () => {
  // 敲了没反应、次数少一下、跨次记忆还多一笔——第三个哑口
  assert.match(app, /const markKnock = \(\) => setKnockLog/);
  const knockFn = app.slice(app.indexOf("const watchKnock = async"), app.indexOf("const genMoment"));
  assert.ok(knockFn.indexOf("markKnock();") > knockFn.indexOf("await Promise.race"), "跨次那一笔要排在这一枪成了之后");
});

test("朋友圈那一栏也挂得住", () => {
  // 「看他半夜翻谁的朋友圈」是这个玩法里最有戏的一幕，可那一栏原来一个挂点都没有
  assert.match(phone, /const momentCard = \(m, i\) => h\("div", \{ key: i, "data-watch": "item:" \+ \(m\.author \|\| ""\)/);
  const s = W.watchInstruction({ char: {}, uName: "她", apps: ["wechat"], phone: {} });
  assert.match(s, /切到 moments 就是翻朋友圈/);
});

test("他在看他玩里发给她的那一条，是真的发到她手机上", () => {
  // 她 2026-09-10：「看他玩发了消息给我我这边也能显示出来吧」。
  // ⚠️不许写进 x_phone：手机里那一屏本来就把真聊天并进来显示（actualChats），
  //   写进去会多出一条假的、跟真的那条并排站着——真话只该有一份。
  assert.match(app, /if \(where === "wechat" && watchIsMe\(char, to\) && String\(text \|\| ""\)\.trim\(\)\) \{/);
  assert.match(app, /pChat\(char\.id, p => \[\.\.\.p, \{ role: "assistant", content: String\(text\)\.trim\(\), ts: Date\.now\(\), fromWatch: true \}\]\)/);
  // ⚠️落进真聊天要回一个「真」字：那一屏上她那条聊天是活的，播放器再挂一条演出气泡
  //   就是同一句话出现两遍（她 2026-09-10：「看他玩那会会显示同样的发了两条」）
  assert.match(app, /\/\/ ⚠️回一个「真」字/);
  assert.match(phone, /let toReal = false;/);
  assert.match(phone, /if \(!toReal && \(where === "wechat" \|\| where === "calls"\) && to\)/);
  // 认她认的是【她的本名 + 他给她起的备注】，走公共那条认名字规矩
  assert.match(app, /\[userName\(profile\), profile && profile\.name, uc\.name, uc\.remark\]/);
  assert.match(app, /watchMeNames\(char\)\.some\(n => WK\.sameName\(n, to\)\)/);
  // ⚠️「对面回一句」永远不能是她：她要回什么由她自己说
  assert.match(app, /if \(watchIsMe\(char, name\)\) return;/);
  // 提示词里得点出来，不然他永远想不到可以给她发
  const s = W.watchInstruction({ char: {}, uName: "Lisa", uRemark: "小笨蛋", apps: ["wechat"], phone: { wechat: { chats: [{ name: "老张" }] } } });
  // ⚠️这一句留着，但压回【偶尔】：写得太响的话他每次一开微信就直奔她
  //   （她 2026-09-10：「微信变成只会在我的聊天框动手，不看朋友圈也不和别人发消息」）。
  assert.match(s, /给她发消息是\*\*真的发到她手机上\*\*，所以\*\*不是每次都发\*\*/);
  assert.match(s, /\*\*这个 app 里绝大多数时候你刷的是别人\*\*/);
  assert.match(s, /你给她的备注：小笨蛋/);
});

test("他打的字不许写一半就没了", () => {
  // 她 2026-09-10：「为啥备忘录写一半会截断」。200 字是给「发一条微信」定的，
  // 可 type 也用来写便签、写批注、写回信。
  const long = "字".repeat(400);
  assert.equal(W.normalizeActs([{ kind: "type", text: long }]).acts[0].text.length, 400);
  // 心声照旧另有一道 60 字的闸
  assert.equal(W.normalizeActs([{ kind: "think", text: "字".repeat(200) }]).acts[0].text.length, 60);
  // ⚠️长了要打得快些，不然一条三百字的便签能演二十七秒——那一屏就卡在那儿不动了
  // ⚠️这一下演多久 = 字数 × 每字的节拍，同一条算法算出来（两处各定一个数就会对不上）
  assert.equal(W.actDuration({ kind: "type", text: long }), 400 * W.typeTick(long));
  assert.ok(W.actDuration({ kind: "type", text: long }) <= 7000, "四百字不该演成半分钟");
  assert.equal(W.typeTick("短"), 90);
  // 抬头断在一句话结束的地方，不是硬砍十四个字
  const r = W.applyWrite("notes", { items: [] }, "", "先去取快递，然后把稿子的开头改一遍", 1);
  assert.equal(r.d.items[0].title, "先去取快递");
  assert.equal(r.d.items[0].body, "先去取快递，然后把稿子的开头改一遍");
});

test("底下那条是悬浮的，不占屏幕一寸", () => {
  // 她 2026-09-10：「按键是实的会把手机屏幕往上推一节」——让位等于他的手机
  // 凭空矮了一截，那才是真穿帮。
  assert.doesNotMatch(phone, /paddingBottom: 54, boxSizing: "border-box"/, "又给它让位了");
  assert.match(phone, /h\("div", \{ style: \{ height: "100%" \} \}, view\)/);
  // 压住打字那一栏的问题另解：演到他打字那几下自己变淡，手指按上去再亮回来
  assert.match(phone, /dim: watch\.typing != null && !watch\.done && !barWake/);
  assert.match(watchSrc, /opacity: p\.dim \? 0\.34 : 1/);
  assert.match(watchSrc, /onPointerDown: p\.onWake/);
});

test("心声：每点开一样东西就想一句（她 2026-09-10 定的）", () => {
  // ⚠️配额跟着【他点开了几样东西】走，不是拍一个数字：
  //   看的人只看得见他点了什么，看不见他为什么点它——那一下没有一句话，就是「他点进去了，然后呢？」
  const runs = o => [].concat(...Array.from({ length: o }, () => [{ kind: "openItem", name: "x" }, { kind: "think", text: "t" }, { kind: "pause" }]));
  assert.equal(W.thoughtCapFor(runs(0)), W.THOUGHT_CAP, "一次都没点开时还有个底数，免得整段一句话都没有");
  assert.equal(W.thoughtCapFor(runs(8)), 8 + W.THOUGHT_FREE, "点开八样就该有八句，外加两句自由的");
  assert.equal(W.normalizeActs(runs(8)).acts.filter(a => a.kind === "think").length, 8);
  // 两句连在一起是旁白，不是想法
  const r = W.normalizeActs([{ kind: "think", text: "a" }, { kind: "think", text: "b" }]);
  assert.equal(r.acts.length, 1);
  assert.ok(r.dropped.some(x => /连着的第二句心声/.test(x)));
  const s2 = W.watchInstruction({ char: {}, uName: "她", apps: ["album"], phone: {} });
  assert.match(s2, /\*\*每点开一样东西，就想一句\*\*/);
  assert.match(s2, /亮屏、回桌面、滑动、退出去这种一看就懂的，一句都别配/);
  assert.match(s2, /点开一样东西之后\*\*至少 pause 一下\*\*/);
});

test("浏览器：敲完回车先看见搜出来的那一列，再点进去一条", () => {
  // 她 2026-09-10：「搜浏览器顺序错了，现在是先打开了搜索后的页面退出才显示搜索」。
  // ⚠️原来 send 那一下只把地址栏清空，屏幕还停在标签页那一栏，于是下一下 openPage
  //   直接盖上来——看着就是「凭空冒出一页，退出来才看见他搜了什么」。
  assert.match(phone, /setWatch\(w => w \? \{ \.\.\.w, lastQ: text, typing: "", page: null, tab: "search" \} : w\)/);
});

test("小红书和视频也一样：先搜，再点进去", () => {
  // 她 2026-09-10：「那小红书视频之类的搜索类能不能也如果要搜新玩意也先搜再点进去」。
  // 顺序是浏览器那次立的：凭空冒出一页，看的人不知道他为什么看见它。
  assert.match(phone, /const WATCH_SEARCH_APPS = \["browser", "liked", "bili", "shopping", "takeout"\]/);
  // 进这几个 app 就有一张空草稿（他要能往搜索框里敲字）
  assert.match(phone, /typing: \(WATCH_SEARCH_APPS\.indexOf\(app\.key\) >= 0 \|\| app\.key === "tally"\) \? "" : null/);
  // ⚠️同一颗 send，两件事，靠【手上有没有草稿】分：有草稿＝搜索，没草稿＝这个 app 的动作
  assert.match(phone, /else if \(text && WATCH_SEARCH_APPS\.indexOf\(where\) >= 0\) \{/);
  assert.match(phone, /searchQ: text, typing: "", page: null/);
  // 搜索条只此一份（小红书和视频各画一套的话，改一处必漏一处）
  assert.match(watchSrc, /function WatchSearchPill/);
  // 四屏共用同一个零件，各穿各的衣服（药丸／墨围／白盘子）
  assert.equal((phone.match(/window\.PhoneWatch\.WatchSearchPill/g) || []).length, 4);
  assert.match(watchSrc, /const rad = sk\.radius != null \? sk\.radius : 99;/);
  assert.match(phone, /radius: 0, border: "1px solid " \+ SHOP_FRAME/, "册页上不摆药丸");
  // ⚠️回车之后草稿是空串不是 null：照原样画就是搜索框空着，而那一刻正是要看见他搜了什么
  assert.match(watchSrc, /const shown = draft \|\| q;/);
  const s = W.watchInstruction({ char: {}, uName: "她", apps: ["liked", "bili"], phone: {} });
  assert.equal((s.match(/\*\*想看新东西就先搜\*\*/g) || []).length, 2);
  const s3 = W.watchInstruction({ char: {}, uName: "她", apps: ["shopping", "takeout"], phone: {} });
  assert.match(s3, /\*\*想买新东西就先搜\*\*/);
  assert.match(s3, /\*\*想吃点别的就先搜\*\*/);
});

test("退出来再点下一张：圆点不许赖在返回键上", () => {
  // 她 2026-09-10：「看了一张照片点退出后光标还在后退键第二张照片就出来了」。
  // ⚠️病根在【他的几摞】那一屏：那几张缩略图一个挂点都没有，退回来之后圆点
  //   没有任何东西可落，就赖在上一处不动。
  assert.match(phone, /key: sig\(p2\), "data-watch": "item:" \+ \(p2\.caption \|\| ""\), onClick: \(\) => openPhoto\(p2\)/);
  // 几拍都没量到就把圆点收起来——手指停在返回键上、屏幕却翻开了下一张，比没有手指还假
  // ⚠️这道兜底原来挂在 780 毫秒上——**那一枪永远打不响**：一下动作才 620 毫秒，
  //   到点之前清理函数就把它清了。于是没找着挂点时圆点赖在上一下那儿不动
  //   （她 2026-09-10 第二次报：「看第二条便签光标还是停在后退键」，而且每个 app 都会犯）。
  assert.match(phone, /return \(\) => \{ shots\.forEach\(clearTimeout\); if \(!done\) setDot\(null\); \};/);
  assert.doesNotMatch(phone, /setDot\(null\); \}, 780\)/, "又把它挂回一个永远打不响的定时器上了");
});

test("论坛：楼下那几条也挂得住，不然点着一个帖子开的是另一个", () => {
  // 她 2026-09-10：「刷论坛也是对着一个不一样的帖子点进去是另一个」。
  // 病根：楼下那几条没有挂点，模型说的名字落在某条回复上时，页面按 comment 打开，
  // 圆点却只能在帖子堆里模糊找一个。
  assert.match(phone, /const commentCard = \(it, i\) => h\("button", \{ key: "c" \+ i, "data-watch": "item:" \+ \(it\.postTitle \|\| ""\)/);
});

test("桌面第二页的 app：先看着它翻过去，再点开", () => {
  // 她 2026-09-10：「第二页的app没有翻页动作就开了」——瞬移过去等于没翻页。
  assert.match(phone, /scrolledRef\.current = true;/);
  assert.match(phone, /behavior: "smooth"/);
  // ⚠️420 毫秒是拍出来的，平滑滚常常还没走完：改成【等它真停下来】再点开
  assert.match(phone, /if \(still >= 2 \|\| Date\.now\(\) - t0 > 380\) \{ go\(\); return; \}/);
  // 这一下的定时器也要跟着清，不然退出去之后还有一个在往没了的 state 里写
  assert.match(phone, /if \(openTid\) clearTimeout\(openTid\);/);
});

test("别来来回回翻同两张", () => {
  // 她 2026-09-10（第二次报）：「还是爱来来回回翻相册而且还是来来回回那两张」。
  // 上一次改的是 app 名单的顺序，可【app 里头那几样】的顺序一直没动——同一个病换了一层。
  // ① 代码兜死：同一样东西一段里点开两次，第二次丢掉
  const r = W.normalizeActs([{ kind: "openItem", name: "海边那天" }, { kind: "back" },
    { kind: "openItem", name: "海边那天。" }, { kind: "openItem", name: "楼下的猫" }]);
  assert.equal(r.acts.filter(a => a.kind === "openItem").length, 2);
  assert.ok(r.dropped.some(x => /又点了一次/.test(x)));
  // ② 上次翻过的那几样排到队尾（名单顺序每次一样，模型就总挑排在前面那几个）
  const s2 = W.watchInstruction({ char: {}, uName: "她", apps: ["album"], recentItems: ["海边那天"],
    phone: { album: { items: [{ caption: "海边那天" }, { caption: "新的一张" }] } } });
  assert.ok(s2.indexOf("· 新的一张") < s2.indexOf("· 海边那天"), "上次翻过的还排在前面");
  assert.match(s2, /这几样你最近几次已经翻过了：海边那天/);
  assert.match(s2, /\*\*多半只是翻旧照片，翻一两张就够了，翻完去别处\*\*/);
  // ③ 记的是两样：开过哪几个 app，和翻过哪几样东西
  // ⚠️只记上一段不够：两段之间来回换等于什么都没记住。滚动记最近几段。
  assert.match(app, /const merged = its\.concat\(prevIts\.filter\(x => its\.indexOf\(x\) < 0\)\)\.slice\(0, 24\);/);
  assert.match(app, /const seen = Array\.isArray\(seen0\) \? seen0 : \(\(seen0 && seen0\.a\) \|\| \[\]\)/, "老存档那一格是数组，两种都得认");
});

test("他这会儿为什么拿起手机：给这一段一个由头", () => {
  // 她 2026-09-10：他每次都像从零开始刷，于是永远是那几个 app、那两张照片。
  // ⚠️他此刻在做什么本来就在上下文里（ctxFor.schedNow），可从没有人让他把两件事接上。
  const s = W.watchInstruction({ char: {}, uName: "她", apps: ["wechat"], phone: {},
    whyNow: "深夜", charHour: 1, sinceLast: 190 });
  assert.match(s, /【你这会儿为什么拿起手机】/);
  assert.match(s, /你那边现在大约 1 点。这是深夜——你本该睡了/);
  assert.match(s, /离你上次放下手机过了 3 个多小时——\*\*别把上次做过的事再做一遍\*\*/);
  assert.match(s, /\*\*这一段里做的每一下都要跟这个由头对得上\*\*/);
  // 第一次看他玩时不该凭空说「离上次」
  assert.doesNotMatch(W.watchInstruction({ char: {}, uName: "她", apps: ["wechat"], phone: {} }), /离你上次放下手机/);
  // ⚠️几点走现成的 charLocalMin（他自己的时区），不另写一套算时区的
  assert.match(app, /whyNow: watchWhyNow\(char\), charHour: Math\.floor\(charLocalMin\(char\) \/ 60\)/);
  // ⚠️入口那颗提示点不归这一层管——那是 PhoneWatch.watchHintOn，别开第二处
  assert.match(app, /watchHintOn: \(\(\) => \{/);
  assert.doesNotMatch(app, /const watchHintFor =/);
});

test("他手机里那条真聊天是活的，不用退出去再进来", () => {
  // 她 2026-09-10：「微信消息能不能做实时联动……而不是只有刷新才有」。
  // ⚠️病根：thread 存的是【点开那一刻的那个对象】，一张快照。真聊天那几条每次渲染
  //   都从最新的消息重算，可快照不会跟着长——于是她刚说的话要退出去再点进来才看得见。
  assert.match(phone, /const liveThread = thread \? \(watchPick\(chats, thread\.name, c => c && c\.name\) \|\| thread\) : null;/);
  assert.match(phone, /const th = liveThread \|\| thread;/);
  assert.match(phone, /innerHead\(th\.name, th\.type === "group"/);
  assert.match(phone, /arr\(th\.messages\)\.concat\(driveSent\)/);
  assert.doesNotMatch(phone, /arr\(thread\.messages\)/, "又读回那张快照了");
  // 截多少条：太短的话一进去只看得见半截对话
  assert.match(app, /\.slice\(-20\);/);
});

test("他手机里不许有两条跟她的对话（一条真的活着，一条推演出来的停在那儿）", () => {
  // 她 2026-09-10：「我发睡了吗他回了，我查手机，然后就一直被固定住在那儿了，
  // 下次再聊几轮进去都不会显示，除非我再刷一次微信。」
  // ⚠️病根：避重名单里只有她的本名，模型照着【他给她的备注】另造了一条跟她的私聊——
  //   于是他手机里两条：真的那条是活的，编的那条永远停在刷新那一刻。她点开的是后面那条。
  // ① 落盘那头：备注也进避重名单
  assert.match(app, /add\(userName\(profile\)\); add\(profile && profile\.name\);/);
  assert.match(app, /add\(uc\.remark\); add\(uc\.name\);/);
  // ② 已经存着的那些得在【显示】这一头挡住，否则她真得「再刷一次微信」才好
  assert.match(phone, /const meLike = \[userName\(profile\), profile && profile\.name,/);
  assert.match(phone, /const generated = arr\(d\.chats\)\.filter\(c => !\(c && c\.type !== "group"/);
});

test("音乐不是死的：显示的是正在放的那一首", () => {
  // 她 2026-09-10：「音乐是死的永远只能显示歌单第一首就算播放的是其他歌也不会变」。
  // ⚠️桌面那块组件和时间线那一行原来都写死 songs[0]——正在放哪一首是播放器说了算。
  assert.match(app, /nowSongId: player\.songId/);
  assert.equal((phone.match(/\(nowSongId && sgs\.find\(x => x && x\.id === nowSongId\)\) \|\| sgs\[0\]/g) || []).length, 2,
    "桌面组件和时间线那一行都要跟着在放的那首走");
  // 歌单那一屏展开的那一行也跟着换歌走（她手动点开别的以她点的为准）
  assert.match(phone, /useEffect\(\(\) => \{ if \(nowSongId\) setOpen\(nowSongId\); \}, \[nowSongId\]\);/);
});

test("他玩手机得有自己的料，不能全围着跟她的聊天转", () => {
  // 她 2026-09-10：「模型现在还是会依赖已有的东西而不是主动去搜索新的落进来……
  // 他玩手机本身也还太依赖我们的聊天了，而不是根据日程有自己真的新鲜料想去搜的」。
  // ⚠️日程那整段本来就在上下文里，可它离得远、又长——读到的最响的还是「跟她的聊天」
  //   和「手机里已经有的那些」。所以：把今天他自己那一摊拎到跟前来，并且要求用它。
  assert.match(app, /const watchTodayLine = char => \{/);
  assert.match(app, /today: watchTodayLine\(char\)/);
  const s = W.watchInstruction({ char: {}, uName: "她", apps: ["browser"], phone: {},
    whyNow: "睡前", charHour: 22, today: "此刻（你当地约 21:30）Ta 正在：改稿子，在家" });
  assert.match(s, /【你今天自己这一摊】/);
  assert.match(s, /改稿子/);
  assert.match(s, /\*\*这一段里至少有一件事是从【你今天自己这一摊】里长出来的\*\*/);
  assert.match(s, /\*\*绝大多数事跟她无关。\*\*/);
  // ⚠️那一长串「手机现在的样子」读起来就是「从这些里挑」——得挑明它不是菜单
  assert.match(s, /不是让你从里面挑事做/);
  assert.match(s, /\*\*这一段里至少要有一次真的去看新东西\*\*/);
  // 没日程的角色不该凭空多出一段空标题
  assert.doesNotMatch(W.watchInstruction({ char: {}, uName: "她", apps: ["browser"], phone: {} }), /【你今天自己这一摊】/);
});

test("每个 app 都得有一条能落新东西的路（她 2026-09-10 逐个点名的那几处）", () => {
  const now = 1;
  // 剪贴板：copy 随时随地能用，不属于任何一个 app
  const cb = W.applyWrite("clipboard", { items: [] }, "浏览器", "一串地址", now);
  assert.equal(cb.d.items[0].text, "一串地址");
  assert.equal(cb.d.items[0].sent, false, "照这一屏自己的写法来：捏在手里没发出去的那几张");
  // 小红书草稿箱 / 邮件草稿：两个箱子字段不一样，各按各屏来
  assert.equal(W.applyWrite("_draft_liked", { drafts: [] }, "", "写了一半", now).d.drafts[0].excerpt, "写了一半");
  assert.equal(W.applyWrite("_draft_mail", { drafts: [] }, "编辑 林", "回一半", now).d.drafts[0].to, "编辑 林");
  // 深夜台：跟视频一样，刷出新的一条点进去就是看过了
  assert.equal(W.applyWrite("latenight", { items: [] }, "深夜那条新的", "", now, { act: "openPage", site: "谁" }).wrote, true);
  // 浏览器：收藏进书签（名册，按文件夹分组）；无痕那一路什么都不留
  const mk = W.applyWrite("browser", { searches: [], tabs: [], marks: [] }, "", "某一页", now, { act: "mark", site: "x" });
  assert.equal(mk.d.marks[0].items[0].title, "某一页");
  const pv = W.applyWrite("browser", { searches: [], tabs: [], private: [] }, "", "见不得人那一页", now, { act: "openPage", priv: true });
  assert.equal(pv.d.private[0].title, "见不得人那一页");
  assert.equal(pv.d.tabs.length, 0, "无痕不进标签页");
  assert.equal(pv.d.searches.length, 0, "无痕不进搜索记录");
  // ⚠️无痕不是「另存一格」，是【不留痕迹】：刚才搜的那句也要从历史里抹掉
  const before = { searches: [{ q: "睡不着", time: "刚刚", _ts: now }], tabs: [], private: [] };
  const pv2 = W.applyWrite("browser", before, "睡不着", "那一页", now + 10, { act: "openPage", priv: true });
  assert.equal(pv2.d.searches.length, 0, "无痕开完，刚才那句搜索还挂在历史里");
  // 收藏那一支要长在 browser 分支【里面】，写在外面永远走不到（真机上书签一直是空的）
  assert.match(phone, /if \(!text && w0 && w0\.page\) \{[\s\S]{0,220}act: "mark"/);
  // 词表和提示词都要跟上
  assert.ok(W.ACT_KEYS.indexOf("copy") >= 0 && W.ACT_KEYS.indexOf("draft") >= 0);
  const s = W.watchInstruction({ char: {}, uName: "她", apps: ["browser", "latenight", "liked", "clipboard", "reading"], phone: {} });
  ["收藏进书签", "无痕开的那一页", "用 draft 写", "copy 随时随地都能用", "别一次都不进去"]
    .forEach(k => assert.ok(s.indexOf(k) >= 0, "提示词里少了：" + k));
});

test("一段里能干的事得够多：动作上限和 token 都给足", () => {
  // 她 2026-09-10：「现在只有四十几还是包括了点进来和后退，真正能干的动作没几个」
  assert.equal(W.ACT_CAP, 120);
  assert.match(app, /maxTokens: 65535/);
});

test("账本能记一笔了（她 2026-09-10：「开账本吧」）", () => {
  // ⚠️五栏字段各不相同，所以按【他此刻翻开的那一栏】分流，各按各栏自己的写法来
  const d1 = W.applyWrite("tally", { debts: [] }, "老张", "欠他一顿饭，从三月拖到现在", 1, { tab: "debts" });
  assert.equal(d1.d.debts[0].who, "老张");
  assert.equal(d1.d.debts[0].title, "欠他一顿饭", "抬头断在一句话结束的地方");
  assert.equal(W.applyWrite("tally", { statements: [] }, "", "说了再也不管他", 1, { tab: "statements" }).d.statements[0].text, "说了再也不管他");
  assert.equal(W.applyWrite("tally", { treasures: [] }, "", "那张票根", 1, { tab: "treasures" }).d.treasures[0].title, "那张票根");
  // 条款和自问自答不接：那两栏是成段的问答，不是手机上随手记的一笔
  assert.equal(W.applyWrite("tally", { appraisals: [] }, "", "x", 1, { tab: "appraisals" }).wrote, false);
  assert.equal(W.applyWrite("tally", { policies: [] }, "", "x", 1, { tab: "policies" }).wrote, false);
  // 记在哪一栏，靠播放器把【他此刻在哪一栏】带下去
  assert.match(phone, /onWatchSend\(char, "tally", \(w0 && w0\.item\) \|\| "", text, \{ act: "send", tab: \(w0 && w0\.tab\) \|\| "debts" \}\)/);
});

test("相册：看他玩时开在「全部」，回收站能进能出，我收着的不许动", () => {
  // 她 2026-09-10：「照片也是打开显示全部而不是他的几摞……删了又没真删的可以真的删除
  // 或者移出删除，或者把其他相册里的放进删除（我收藏的永远不会删除）」
  assert.match(phone, /useEffect\(\(\) => \{ if \(drive\) \{ setTab\("library"\); setOpened\(null\); \} \}, \[!!drive\]\);/);
  assert.match(phone, /const editPhoto = \(p, how\) => \{/);
  assert.match(phone, /how === "gone"\s*\n?\s*\? all\.filter\(x => sig\(x\) !== sig\(p\)\)/);
  assert.match(phone, /\(onPhotoEdit && tab !== "saved"\)/, "「我收着的」那一摞不该有这几颗键");
  assert.match(phone, /"真的删掉"/);
  assert.match(phone, /"捞回来"/);
  // ⚠️就地改一条：不过累积层、也不归档
  assert.match(app, /savePhoneApp\(char\.id, "album", \{ \.\.\.cur, items: items \}, \{ noArchive: true, patched: true \}\)/);
});

test("匿名信箱：点得着、想得出来", () => {
  // 它没有详情页，整串摊在一屏上——所以挂点直接长在每一条上
  assert.match(fs.readFileSync("js/components.js", "utf8"),
    /"data-watch": "item:" \+ String\(r\.q \|\| ""\)\.slice\(0, 24\)/);
  const s = W.watchInstruction({ char: {}, uName: "她", apps: ["anon"], phone: {},
    anon: [{ q: "你其实一直在等一个人吧" }] });
  assert.match(s, /〔匿名信箱 anon〕/);
  assert.match(s, /你其实一直在等一个人吧/);
});

// ── 2026-09-11 审计：她报的三样 ────────────────────────────────────
test("卡在主屏那一下：等翻页的 open 一定会发生", () => {
  // 她 2026-09-11：「有一次卡在主页然后出了个心声，我猜是不是有一个页面打不开卡着了」。
  // ⚠️病根是【两个时钟】：等翻页最多等 900ms，可 open 这一下只演 620ms——
  //   时候一到 advance 把这一步推走，清理函数顺手清掉 openTid，go() 一辈子没跑。
  assert.equal(W.actDuration({ kind: "open", app: "album" }), 620);
  assert.match(phone, /let opened = false;\s*\n\s*const go = \(\) => \{ if \(opened\) return; opened = true;/,
    "open 那一下没有「只跑一次」的闸");
  assert.match(phone, /Date\.now\(\) - t0 > 380/, "等翻页还是等到了这一下之外");
  assert.ok(phone.indexOf("Date.now() - t0 > 900") < 0, "900ms 比这一下本身还长，等于没等到就被推走");
  assert.match(phone, /if \(openFallback\) openFallback\(\);/, "被推走时没有补开那一下");
});

test("切栏：模型写中文栏名也要对上真正那一栏", () => {
  // 名字对不上时【两处一起哑】：圆点找不着挂点，而那一屏被切到一个不存在的栏、整页空着。
  assert.match(phone, /const watchTabKey = name => \{/);
  assert.match(phone, /document\.querySelectorAll\('\[data-watch\^="tab:"\]'\)/);
  assert.match(phone, /WK\.pickName\(all, want, keyOf\) \|\| WK\.pickName\(all, want, el => String\(el\.textContent \|\| ""\)\.trim\(\)\)/,
    "只按 key 对，没按那颗键上写的字对");
  // 圆点和切栏读的是同一个 a：一处对上两处都对
  assert.match(phone, /const a = a0\.kind === "tab" \? Object\.assign\(\{\}, a0, \{ name: watchTabKey\(a0\.name\) \}\) : a0;/);
});

test("搜索记录每一行也认名字", () => {
  // 审计时先以为 openPage 的 result 挂点不存在——其实它长在 WatchPage 那个组件身上
  // （现编的那一页自己就是挂点），所以那一下是【等页面出来再落】，不是消失。
  // 这儿补的是另一半：他回头点开自己搜过的那一句时，圆点也得落得下去。
  assert.match(phone, /"data-watch": "item:" \+ \(x\.q \|\| ""\)/, "搜索记录那几行没有挂点");
});

test("一段有多长这件事，提示词里得有个数", () => {
  // 她 2026-09-11：「看他玩现在还是只有 30 40 个动作」——查下来这一段从来没说过要写多少下。
  assert.match(watchSrc, /const ACT_TARGET_LO = 70, ACT_TARGET_HI = 110;/);
  const s = W.watchInstruction({ char: {}, uName: "她", apps: ["album"], phone: { album: { items: [{ caption: "甲" }] } } });
  assert.match(s, /【这一段有多长】70～110 下/);
  assert.match(s, /别只写三四十下就收/);
  // 上限仍然是代码那头的事，两个数不许混成一个
  assert.match(watchSrc, /const ACT_CAP = 120;/);
});
