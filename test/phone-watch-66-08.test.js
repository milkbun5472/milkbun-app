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
  assert.equal(W.applyWrite("bili", {}, "x", "y", 1).wrote, false);
  assert.match(watchSrc, /还没接的 app：只演不落，绝不乱写/);
  // 提示词里也说死了
  const s = W.watchInstruction({ char: {}, uName: "她", apps: ["album"], phone: { album: { items: [{ caption: "甲" }] } } });
  assert.match(s, /这一路你什么都改不了，也不该改/);
});

test("打得开哪几个 app 只此一份名单", () => {
  assert.match(app, /const WATCH_APPS = \["wechat", "album", "notes", "browser", "music", "shopping", "takeout", "liked"\]/);
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
  assert.match(app, /const r = WK\.applyWrite\(where, cur, to, text, Date\.now\(\), extra\);/);
  // 那个 app 还没生成过就没有底稿可接
  assert.match(app, /if \(!cur\) return;/);
});

test("界面：相册和便签也接了 drive，一份 drive 三个 app 共用", () => {
  assert.match(phone, /function AlbumView\(\{ d, char, t, onBack, onRefresh, refreshing, onPeek, onDrawPhoto, drawing, drive \}\)/);
  assert.match(phone, /function StickyView\(\{ d, char, t, onBack, onRefresh, refreshing, onPeek, drive \}\)/);
  assert.match(phone, /h\(AlbumView, \{ drive: ctx\.drive/);
  assert.match(phone, /h\(StickyView, \{ drive: ctx\.drive/);
  // 一份 drive 递给所有被驱动的 app——各拼一份的话，第三批又要多一支
  assert.match(phone, /drive: watch \? \{ tab: watch\.tab, item: watch\.item, page: watch\.page, typing: watch\.typing,/);
  // 同一个 openItem/send 在微信和便签里做的事不一样，所以播放器要知道此刻开着哪个 app
  assert.match(phone, /const openRef = useRef\(null\);/);
  assert.match(phone, /openRef\.current === "wechat" \? ""/);
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
  assert.match(app, /const r = WK\.applyReply\(cur, name, text, Date\.now\(\)\);/);
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
