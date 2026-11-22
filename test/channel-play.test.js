// 频道里一起摆弄的小东西（她 2026-11-20「1-7都可以做」）＋顶上压成一行（她截图「顶上太高把聊天挤没了」）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), vm = require("vm");
const en = fs.readFileSync(__dirname + "/../js/engine.js", "utf8"), ap = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), cs = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const ctx = {}; vm.createContext(ctx);
vm.runInContext(en.slice(en.indexOf("const CHP_EMOJI"), en.indexOf("// 一轮里好几个人改同一份")) + ";this.X={chpNorm,chpCount,chpBump,chpFindMsg,chpReactMsg,chpPin,chpUnpin,chpNoteAdd,chpScribble,chpTear,chpTearOk,chpSongAdd,chpSkipVote,chpSkipDue,chpLedgerAdd,chpBalances,chpSettle,chpPetNow,chpCare,chpHint,CHP_CAP};", ctx);
const X = ctx.X;
test("表情回应：再点同一个就是收回；找句子只找最近、逐字", () => {
  const ms = [{ content: "今晚吃火锅", ts: 1 }, { content: "好啊", ts: 2 }];
  assert.equal(X.chpFindMsg(ms, "火锅", 20), 0);
  assert.equal(X.chpFindMsg(ms, "烧烤", 20), -1);
  let m = X.chpReactMsg(ms[0], "a", "😂"); assert.equal(m.reacts.a, "😂");
  m = X.chpReactMsg(m, "a", "😂"); assert.equal(m.reacts.a, undefined);
});
test("置顶最多三条；便利贴撕自己的或贴了一天以上的；每天计数换天清零", () => {
  let s = X.chpNorm(null, "d1");
  for (let i = 1; i <= 4; i++) X.chpPin(s, { content: "第" + i, ts: i }, "me");
  assert.equal(s.pins.length, X.CHP_CAP.pins); assert.equal(s.pins[0].text, "第2");
  X.chpNoteAdd(s, "买牛奶", "a"); const n = s.notes[0];
  assert.equal(X.chpTearOk(n, "b", n.ts + 1000), false);
  assert.equal(X.chpTearOk(n, "b", n.ts + 2 * 86400000), true);
  X.chpScribble(s, "牛奶", "我也要", "b"); assert.equal(s.notes[0].doodles[0].text, "我也要");
  X.chpBump(s, "note"); assert.equal(X.chpCount(s, "note"), 1);
  s = X.chpNorm(s, "d2"); assert.equal(X.chpCount(s, "note"), 0);
});
test("小账本：均摊、两两相抵、结清", () => {
  let s = X.chpNorm(null, "d");
  X.chpLedgerAdd(s, { payer: "a", amount: 30, among: ["a", "b", "c"] });
  X.chpLedgerAdd(s, { payer: "b", amount: 10, among: ["a", "b"] });
  const bal = X.chpBalances(s.ledger);
  assert.deepEqual(bal.find(x => x.from === "b" && x.to === "a").amount, 5);
  assert.equal(bal.find(x => x.from === "c").amount, 10);
  X.chpSettle(s, "c", "a"); assert.equal(X.chpBalances(s.ledger).some(x => x.from === "c"), false);
});
test("歌单切歌过半才提醒；养的东西会掉、照顾会回来", () => {
  let s = X.chpNorm(null, "d"); X.chpSongAdd(s, "晴天", "周杰伦", "a"); X.chpSkipVote(s, "晴天", "a");
  assert.equal(X.chpSkipDue(s.playlist[0], 3), false); X.chpSkipVote(s, "晴天", "b"); assert.equal(X.chpSkipDue(s.playlist[0], 3), true);
  const pet = { name: "小绿", full: 80, ts: 0 };
  assert.equal(X.chpPetNow(pet, 10 * 3600000).full, 40);
  assert.equal(X.chpCare(pet, "浇水", "a", 10 * 3600000).full, 80);
});
test("接线：回复里的字段落地、提示词带着摆着的东西；顶上压成一行，公告、置顶、在听都收成小签", () => {
  assert.match(ap, /gAtHint \+ gListenHint \+ gPlayHint \+/);
  assert.match(ap, /item\.react \|\| item\.rename \|\| item\.pin/);
  assert.match(ap, /h\(ChannelTopRow, \{ onTab: setChannelTab/);
  assert.match(cs, /function ChannelTopRow\(/);
  assert.match(cs, /"data-wk": "chtabs", className: "shrink-0 flex items-end", style: \{ gap: 2, height: 38/);
  assert.match(cs, /!channelTabs && gs\.notice && String/);
  assert.doesNotMatch(ap, /h\(ChannelListenBar, \{/);
  assert.match(ap, /onReact: activeGroup\.spaceId && !groupSpectating\(activeGroup\)/);
});
test("歌单能从她的歌库挑、点「放这首」走播放器、「让他们各挑一首」回聊天跑一轮", () => {
  const fs = require("fs"), ap = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), cs = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
  assert.match(cs, /"data-wk": "chsonglib"/);
  assert.match(cs, /"data-wk": "chsongask"/);
  assert.match(ap, /onAskSongs: groupSpectating\(_g\) \? null : \(\) => \{ window\.__chAskSongs = _g\.id; setChannelTab\("chat"\); replyGroup\(_g\.id\); \}/);
  assert.match(ap, /if \(window\.__chAskSongs === groupId\) \{ window\.__chAskSongs = null;/);
});
test("歌单一天十首；小家伙能先不起名，让大家定一个", () => {
  const fs = require("fs"), en = fs.readFileSync(__dirname + "/../js/engine.js", "utf8"), ap = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
  assert.match(en, /const CHP_CAP = \{ rename: 1, note: 4, song: 10, pins: 3 \};/);
  assert.match(ap, /if \(item\.petName && _st\.pet && _st\.pet\.naming\)/);
  assert.match(ap, /onAskPetName: groupSpectating\(_g\) \? null :/);
});
test("账本连着钱包：只有动过钱的几笔算欠款；记账从付钱人钱包扣，结清在两边钱包挪", () => {
  const fs = require("fs"), vm = require("vm"), en = fs.readFileSync(__dirname + "/../js/engine.js", "utf8"), ap = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
  const i = en.indexOf("function chpBalances("), j = en.indexOf("// 养的东西：每过一小时");
  const ctx = {}; vm.createContext(ctx); vm.runInContext(en.slice(i, j) + ";this.owe=chpOwe;", ctx);
  const L = [{ payer: "a", amount: 30, among: ["a", "b", "me"], moneyMoved: true }, { payer: "b", amount: 100, among: ["b", "me"] }];
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.owe(L, "me", "a"))), { from: "me", to: "a", amount: 10 });
  assert.equal(ctx.owe(L, "me", "b"), null);   // 旧账没动过钱，不算
  assert.match(ap, /const chLedgerPay = \(gid, payer, amount, what\) =>/);
  assert.match(ap, /chLedgerMove\(gid, owe\.from, -amt,/);
  assert.match(ap, /chLedgerMove\(gid, owe\.to, amt,/);
  assert.match(ap, /moneyMoved: true/);
});
test("小家伙三条状态：饱腹按小时掉、心情陪玩才涨得多、精神照钟点；最黏的是七天里照顾最多的；见底三天只提醒", () => {
  const fs = require("fs"), vm = require("vm"), en = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
  const i = en.indexOf("const PET_DOING = {"), j = en.indexOf("// 给模型看的那几行：只说现在是什么样，谁动过");
  const ctx = {}; vm.createContext(ctx); vm.runInContext(en.slice(i, j) + ";this.now=chpPetNow;this.care=chpCare;this.plant=chpPetIsPlant;", ctx);
  const H = 3600000, t0 = 1000 * H;
  let p = { name: "团子", kind: "仓鼠", full: 80, joy: 70, ts: t0, joyTs: t0, born: t0, log: [] };
  const a = ctx.now(p, t0 + 5 * H, 14);
  assert.equal(a.full, 60); assert.equal(a.joy, 55); assert.equal(a.energy, 90);
  assert.ok(ctx.now(p, t0, 3).energy < 35);
  const fed = ctx.care(p, "喂食", "a", t0), played = ctx.care(p, "陪它玩", "b", t0);
  assert.ok(fed.full > played.full && played.joy > fed.joy);
  p = ctx.care(ctx.care(ctx.care(p, "喂食", "a", t0), "陪它玩", "b", t0 + H), "喂食", "a", t0 + 2 * H);
  assert.equal(ctx.now(p, t0 + 3 * H, 12).fondest, "a");
  const starved = ctx.now({ name: "x", kind: "绿萝", full: 0, joy: 0, ts: t0, joyTs: t0, born: t0, last: { by: "a", ts: t0 } }, t0 + 80 * H, 12);
  assert.equal(starved.neglectDays, 3); assert.equal(ctx.plant("绿萝"), true);
  assert.ok(typeof starved.doing === "string" && starved.doing.length > 0);
});
test("小家伙：拍照只她能按、存进图片栏；送走收进养过的并让大家告别一轮；养什么也能让大家定", () => {
  const fs = require("fs"), ap = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), cs = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
  assert.match(ap, /const key = "img_chf_pet_" \+ Date\.now\(\)\.toString\(36\);\s*await idbImgPut\(key, blob\);/);
  assert.match(ap, /lookRef: s2\.pet\.lookRef \|\| key/);
  assert.match(ap, /s2\.petsPast = \(s2\.petsPast \|\| \[\]\)\.concat/);
  assert.match(ap, /window\.__chPetBye = \{ gid: g\.id/);
  assert.match(ap, /if \(item\.petKind && _st\.pet && _st\.pet\.kindPending\)/);
  assert.match(cs, /function ChfImg\(\{ k, style \}\) \{[\s\S]{0,200}useIdbImgUrl\(isIdb \? k : null\)/);
});
test("小家伙页她能喂它、陪它玩，各一天一次", () => {
  const cs = require("fs").readFileSync(__dirname + "/../js/components.js", "utf8");
  assert.match(cs, /\[\["feed", "喂它", "喂食"\], \["play", "陪它玩", "陪它玩"\]\]/);
  assert.match(cs, /chpBump\(s0, "care_" \+ k, "me"\)/);
});

test("chpPetMentioned：说到它的名字/是什么/合照才把它拍进去", () => {
  const src = require("fs").readFileSync(require("path").join(__dirname, "../js/engine.js"), "utf8");
  const a = src.indexOf("function chpPetMentioned("), b = src.indexOf("function chpPetNow(");
  const ctx = {}; require("vm").runInNewContext(src.slice(a, b) + ";this.f=chpPetMentioned;", ctx);
  const pet = { name: "团子", kind: "一只橘猫" };
  assert.equal(ctx.f(pet, "抱着团子在窗边"), true);
  assert.equal(ctx.f(pet, "橘猫趴在桌上"), true);
  assert.equal(ctx.f(pet, "大家合照，把它也抱上"), true);
  assert.equal(ctx.f(pet, "在海边散步"), false);
  assert.equal(ctx.f(null, "团子"), false);
});
test("和它合照：接线、旁观不给、钩子登记", () => {
  const rd = f => require("fs").readFileSync(require("path").join(__dirname, "../js/" + f), "utf8");
  assert.match(rd("app.js"), /onPetGroupPhoto: groupSpectating\(_g\) \? null :/);
  assert.match(rd("app.js"), /chpPetMentioned\(_pt, gPhotoScene\)/);
  assert.match(rd("components.js"), /"data-wk": "chpetcast"/);
  assert.match(rd("theme-studio.js"), /\["chpetcast",/);
});

test("频道长按菜单不放点个表情、收藏、收进时刻", () => {
  const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "../js/components.js"), "utf8");
  assert.match(src, /const plus = \[onGem \? "gem"/);
  assert.match(src, /k !== "fav" && k !== "shike"/);
});

test("歌名对歌库认得宽一点；歌单不再手写加一首", () => {
  const c = {}; vm.createContext(c);
  vm.runInContext(en.slice(en.indexOf("function chpSongNorm"), en.indexOf("function chpSongAdd")) + ";this.M=chpSongMatch;", c);
  const lib = [{ title: "晴天 (Live)", artist: "周杰伦" }, { title: "Shape of You", artist: "Ed Sheeran" }];
  assert.equal(c.M(lib, { title: "《晴天》" }).artist, "周杰伦");
  assert.equal(c.M(lib, { title: "shape of you" }).title, "Shape of You");
  assert.equal(c.M(lib, { title: "Shape" }).title, "Shape of You");
  assert.equal(c.M(lib, { title: "稻香" }), null);
  assert.doesNotMatch(cs, /"data-wk": "chsongadd"/);
  assert.match(cs, /"data-wk": "chsongq"/);
});

test("按了让他们各挑一首：这一轮的正题放在最后", () => {
  assert.match(ap, /_askSongs \? "\\n\\n【这一轮的正题】"/);
  assert.match(ap, /_askSongs \|\| chpCount\(st, "song"\) < CHP_CAP\.song/);
});

test("叫大家起名／商量养什么：也是这一轮的正题", () => {
  assert.match(ap, /window\.__chAskPet = _g\.id; setChannelTab\("chat"\)/);
  assert.match(ap, /_askPet \? "\\n\\n【这一轮的正题】"/);
});

test("送走小家伙、新人进来：也放到最后当正题", () => {
  assert.match(ap, /_petBye \? "\\n\\n【这一轮的正题】"/);
  assert.match(ap, /gWelcomeHint \? "\\n\\n【这一轮的正题】先招呼刚进来的/);
});

test("单聊页不引用群里才有的 settings／group（v89.935 白屏）", () => {
  const a = cs.indexOf("function ChatThread("), b = cs.indexOf("\nfunction ", a + 10);
  assert.doesNotMatch(cs.slice(a, b), /const _gSpect/);
});

test("一轮只摆几样：墙每轮都有，剩下的跟眼下有关的加一样轮流的；墙和文件每轮提一句", () => {
  assert.match(ap, /const _keep = can\.filter\(x => _hot\[x\[0\]\]\)/);
  assert.match(ap, /_hot = \{ w: true, f: true/);
  assert.match(ap, /【墙和文件】/);
});

test("她贴墙、在便利贴上写、新建／改文件：聊天里留一行；他们写便利贴也留一行", () => {
  assert.match(ap, /你往墙上贴了张便利贴：「/);
  assert.match(ap, /那张上写了：「/);
  assert.match(ap, /kind: "chfile", fileId: x\.f\.id, content: "你" \+ x\.op/);
  assert.match(ap, /_say\(spk\.name \+ " 在墙上一张便利贴上写了一句"\)/);
});

test("她记账、结账、加歌、拿掉歌、照顾小家伙、改名、置顶：聊天里都留一行", () => {
  for (const re of [/你在账本上记了一笔/, /你在账本上结了一笔/, /你往歌单里加了《/, /从歌单里拿掉了/, /你去照顾了「/, /你给它改名叫「/, /」置顶了", ts/]) assert.match(ap, re);
});

test("小家伙大图默认定妆照，拍过的排在底下能点回去", () => {
  assert.match(cs, /_ref = pet\.lookRef \|\| pet\.photo/);
  assert.match(cs, /"data-wk": "chpetphotos"/);
});

test("小家伙合照发进聊天用相册引用（iv_），气泡才认得", () => {
  assert.match(ap, /_ref = await imgToVault\(await blobToDataUrl\(blob\)\)/);
  assert.doesNotMatch(ap, /kind: "photo", imageRef: key, photoMode: "real", desc, content: "\[照片\] " \+ desc/);
});

test("聊天照片气泡 img_ 键也认（ChfImg）；图片改说明不冒「编辑了」", () => {
  assert.match(cs, /\? h\(ChfImg, \{ k: m\.imageRef,/);
  assert.match(ap, /f\.kind !== "image" && \(f\.updatedTs/);
});

test("挂机房不自己聊起来，除非特意开了自动聊天", () => {
  assert.match(ap, /if \(group\.chKind === "lounge" && gs\.autoChat !== true\) continue;/);
});

test("小频每日一问、称号不贴进挂机房", () => {
  assert.match(ap, /!groupSpectating\(g\) && g\.chKind !== "lounge"\);\n    return chs\.find/);
});

test("树洞里她也是代号；存群设置不把每周称号当成封的头衔", () => {
  assert.match(cs, /const meAv = _thMe \? \{ name: "树"/);
  assert.match(cs, /_thMe \|\| meName\)/);
  assert.match(ap, /!\(v && _wk\[id\] === v && !_own\[id\]\)/);
});

test("不满一周评出来的称号不挂", () => {
  assert.match(ap, /\(Number\(sp\.titlesTs\) \|\| 0\) - Math\.max\(Number\(sp\.botOnTs\) \|\| 0, Number\(sp\.ts\) \|\| 0\) < 6 \* 86400000\) return gs0;/);
});

test("树洞：提醒只露代号；提示里说清大家来树洞是不顶着自己说话", () => {
  assert.match(ap, /chAnonName\(g, groupChatsRef\.current\[g\.id\], last\.senderId, last\.senderName\)/);
  assert.match(ap, /大家来树洞，就是因为在这儿说话不用顶着自己/);
});

test("树洞长图只露代号、不放头像", () => {
  assert.match(ap, /const msgs = chAnonMsgs\(/);
  assert.match(ap, /avatarSrcOf: id => _th \? null/);
});

test("树洞锁屏通知只露代号", () => {
  assert.match(ap, /chAnonName\(group, groupChatsRef\.current\[groupId\], spk\.id, spk\.name\)/);
});

test("树洞代号每个号一张固定的匿名脸", () => {
  assert.match(cs, /if \(s0\.indexOf\("th:"\) === 0\) \{ const n = parseInt/);
});

test("树洞里不私聊她", () => {
  assert.match(ap, /const gDmMembers = gs\.memoryInterop && !\(group && group\.chKind === "treehole"\)/);
});

test("状态挂久了或空着：一半的轮次点一个人换状态", () => {
  assert.match(ap, /名字底下的状态】/);
  assert.match(ap, /Date\.now\(\) - \(Number\(_sa\[c\.id\]\.ts\) \|\| 0\) > 6 \* 3600000/);
});

test("文件每行按谁写的分颜色：顺着历史算", () => {
  const c = {}; vm.createContext(c);
  vm.runInContext(en.slice(en.indexOf("function chfBlame"), en.indexOf("// 给模型看的这一块")) + ";this.B=chfBlame;", c);
  const f = { createdBy: "me", text: "a\nb\nc", history: [{ by: "me", before: "", after: "a" }, { by: "x", before: "a", after: "a\nb" }, { by: "y", before: "a\nb", after: "a\nb\nc" }] };
  assert.equal(c.B(f).map(r => r.by).join(","), "me,x,y");
  assert.match(cs, /"data-wk": "chfline"/);
});

test("文档能导出成 txt", () => {
  assert.match(cs, /"data-wk": "chfexport", onClick: async \(\) => \{ try \{ await saveTextFile\(/);
});

test("树洞：频道列表、消息列表、空间搜索里也只露代号", () => {
  assert.match(cs, /const last = channelLast\(chAnonMsgs\(g, groupChats\[g\.id\]\), userLabel\)/);
  assert.match(cs, /const l = channelLast\(chAnonMsgs\(g, groupChats\[g\.id\]\), "我"\)/);
  assert.match(ap, /chatsOf: id => chAnonMsgs\(/);
  // 公共口子只有一份，别处不再各写一套 thView 判断
  assert.doesNotMatch(ap + cs, /chKind === "treehole"[^\n]{0,40}\? thView\(/);
});

test("树洞的话不流到别处", () => {
  assert.match(ap, /if \(g\.chKind === "treehole"\) return false;/);
});

test("墙：纸条、胶带、写的一句、底下一行各有挂点；频道能挑一个图标", () => {
  for (const k of ["chnotetape", "chnotetext", "chnotedoodle", "chnotemeta", "chicon"]) assert.match(cs, new RegExp('"data-wk": "' + k + '"'));
  assert.match(cs, /g\.chIcon \|\| "#"/);
  assert.match(ap, /patch\.chIcon != null \? \{ chIcon: patch\.chIcon \}/);
});

test("频道首页成员／约定／精华并成一排三格", () => {
  assert.match(cs, /"data-wk": "spacestats"/);
  assert.doesNotMatch(cs, /borderRadius: 14, borderLeft: "4px solid " \+ tone/);
});

test("@ 名单：中文后面、已经 @ 过一个人后面都能弹", () => {
  const re = /(^|[^A-Za-z0-9_.])@$/;
  for (const x of ["@", "你好@", "@顾朝 @", "@顾朝@", "看这个，@"]) assert.ok(re.test(x), x);
  assert.ok(!re.test("abc@"));
  assert.match(cs, /\(\^\|\[\^A-Za-z0-9_\.\]\)@\$/);
});

test("状态像签名，不一定是在干嘛；一轮点最多三个人", () => {
  assert.match(ap, /像个签名/);
  assert.match(ap, /_stale\.slice\(\)\.sort\(\(\) => Math\.random\(\) - 0\.5\)\.slice\(0, 3\)/);
});

test("空间成员把她也算进去：成员页第一个、人数加一", () => {
  assert.match(cs, /\[\{ id: "me", _me: true, \.\.\.\(herFace/);
  assert.match(cs, /people\.length \+ 1\), h\("span", \{ className: "truncate", style: lab \}, "成员 · " \+ \(online \+ 1\)/);
});

test("他们发起的投票带头像和名字", () => {
  assert.match(cs, /"data-kind": "poll", className: "py-1 flex items-start gap-2 justify-start" \},\n\s+mAvatar\(memberById\(m\.senderId\)/);
});

test("串门：三分之一的轮次点一个能去别的频道的人", () => {
  assert.match(ap, /【串门】/);
  assert.match(ap, /Math\.random\(\) > 0\.35\) return "";/);
});

test("最近那张投票连票数摆在最后，说清改票就是再投一次", () => {
  assert.match(ap, /【还开着的投票】/);
  assert.match(ap, /改票就是再投一次别的序号/);
});
