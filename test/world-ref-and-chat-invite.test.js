// 她 2026-10-02 转群友的三张图：① 世界加一张生图参考 ② 聊天＋面板里能直接邀约
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const app = R("js/app.js"), comp = R("js/components.js"), map = R("js/map.js"), engine = R("js/engine.js");

test("世界表单的生图参考：最多六张风景照、每张标注；重画不丢图", () => {
  assert.match(map, /"生图参考"/);
  assert.match(map, /onGen\(name\.trim\(\), brief\.trim\(\), picked, refs\.length \? refs : null\)/);
  assert.match(map, /placeholder: "这张是哪儿"/);
  assert.match(app, /refImgs !== undefined \? \{ refImgs: Array\.isArray\(refImgs\) \? refImgs\.slice\(0, 6\)/);
  assert.match(app, /refImgs: \(old && old\.refImgs\) \|\| null/);
  const M = require("../js/map.js");
  const w = { refImgs: [{ img: "a", label: "花街" }, { img: "b", label: "旧港码头·傍晚" }] };
  assert.equal(M.pickWorldRef(w, "在旧港码头吹风").img, "b", "按画面挑对得上的那张");
  assert.equal(M.pickWorldRef(w, "随便哪").img, "a", "都对不上就第一张");
  assert.equal(M.worldRefList({ refImg: "old" })[0].img, "old", "旧版单张照样认");
  assert.match(app, /const saveWorlds = list => \{ worldsRef\.current = list;/, "新世界刚画完就存图，要读得到");
});

test("住在世界里的人拍照：人像和风景照都喂世界参考，只露一截身体那档不喂", () => {
  assert.equal((engine.match(/worldRefLine\(opts\.worldRefIndex, opts\.worldRefLabel\)/g) || []).length, 2);
  assert.equal((app.match(/const wRef = /g) || []).length, 2);
  assert.match(app, /const wRef = isPart \? null : worldRefFor\(char, /);
  assert.match(app, /buildScenePrompt\(char, photoScene, \{ forText: false, worldRefIndex: wRef/);
});

test("＋面板有邀约：挑地方（我们的城市＋TA的世界）或自己写，发约会卡", () => {
  assert.match(comp, /\["dateinvite", "邀约", "invite"\]/);
  assert.match(comp, /function DateComposeDialog\(\{ place, places, members, who, onCancel, onSend \}\)/);
  assert.match(comp, /disabled: !finalPlace/);
  assert.match(app, /onDateInvite: \(place, v\) => sendDateInvite\(activeChar, place, v\)/);
  const i = app.indexOf("const invitePlacesFor");
  const seg = app.slice(i, app.indexOf("const pendingInviteOf", i));
  assert.match(seg, /DatePlaces/);
  assert.match(seg, /charRealm/);
});

test("群里也能邀约：挑请谁，带答应了的人出发进群线下", () => {
  assert.match(comp, /\["rp", "红包", "packet"\], \.\.\.\(onGroupDateInvite \? \[\["dateinvite", "邀约", "invite"\]\] : \[\]\)/);
  assert.match(comp, /function DateComposeDialog\(\{ place, places, members, who, onCancel, onSend \}\)/);
  assert.match(comp, /"带答应的人出发 →"/);
  assert.match(app, /const sendGroupDateInvite = /);
  const i = app.indexOf("const groupDateGo");
  const seg = app.slice(i, app.indexOf("const groupInvitePlacesFor", i));
  assert.match(seg, /some\(x => x && !x\.endTs\)/, "还有一场没结束就别盖掉");
  assert.match(seg, /\(inv\.replies \|\| \{\}\)\[x\.id\] === "yes"/, "只带答应了的人");
  assert.match(seg, /startGroupOffline\(groupId, \{ autoGen: true, present: going\.map/);
  // 没选、没答应的人进不了那一场：群线下一开头就把成员表收窄
  assert.match(app, /memberIds: \(groupIn\.memberIds \|\| \[\]\)\.filter\(id => workSess\.present\.includes\(id\)\)/);
});

test("回执单聊群聊共用一套：问法、认去不去、回执长相各一份", () => {
  assert.equal((app.match(/const rsvpReceipt = /g) || []).length, 1);
  assert.match(app, /capState\.push\("dateReply：" \+ inviteAskText\(_inv, "她"\)\)/);
  assert.match(app, /pChat\(charId, p => \[\.\.\.p, rsvpReceipt\(inv, null, rsvpSay\(parsed\.dateReply\)\)\]\)/);
  assert.match(app, /pushGroupRich\(groupId, rsvpReceipt\(_gInv, spk, rsvpSay\(item\.dateReply\)\)\)/);
  assert.match(app, /const rsvpSay = v => /, "回执上那一句：单聊群里共用");
  assert.match(app, /gTfHint \+ gInviteHint \+ gPollHint/);
  assert.match(app, /没被约到的人不填/);
  assert.match(comp, /if \(m\.kind === "datereceipt"\) return h\(DateInviteCard/);
  assert.match(comp, /grp \? "想约大家一起出去。" : "想和你一起去约会。"/, "群里那张不叫约会");
});

test("群聊＋面板在输入框下面", () => {
  const i = comp.indexOf("function GroupThread");
  const composer = comp.indexOf('"data-wk": "composer"', i), panel = comp.indexOf("}, CHAT_PANEL_SCROLL)", i);
  assert.ok(composer > 0 && panel > composer, "面板又跑到输入框上面去了");
});

test("＋面板单聊群聊共用一个矮高度，能往下滑", () => {
  assert.match(comp, /const CHAT_PANEL_SCROLL = \{ maxHeight: \d+, overflowY: "auto"/);
  assert.equal((comp.match(/\}, CHAT_PANEL_SCROLL\)/g) || []).length, 2);
});

test("我们的城市能切手绘/现实/架空，现实架空就是好友地图那两张，不另画", () => {
  const dw = R("js/dwell.js");
  assert.match(dw, /\[\["draw", "手绘"\], \["real", "现实"\], \["story", "架空"\]\]/);
  assert.match(dw, /h\(K\.MapWidget, \{ characters: \[char\]/);
  assert.match(dw, /h\(K\.WorldMapEmbed, \{ world: r\.world/);
  assert.match(map, /function WorldMapEmbed\(\{ world, characters, status, me, ops \}\) \{\n    const o = ops \|\| \{\};\n    return h\(WorldMap, \{/, "嵌进去的就是同一个 WorldMap");
  assert.match(app, /worldOps: \{ busy: worldBusy, onPin: pinWorld/);
});

test("我们的城市每个人一份：换人就换城，旧版共用的按来往认领、认不出的留着让她捡", () => {
  global.localStorage = (() => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; })();
  global.window = global.window || {};
  const src = R("js/dwell.js");
  const i = src.indexOf("  const DP_KEY"), j = src.indexOf("  window.DatePlaces = DatePlaces;");
  const DatePlaces = new Function("localStorage", src.slice(i, j) + "\nreturn DatePlaces;")(global.localStorage);
  localStorage.setItem("x_datePlaces", JSON.stringify([{ id: "a", name: "御马监跑马场", note: "", by: "" }, { id: "b", name: "面馆", by: "qz" }, { id: "c", name: "无主", by: "" }]));
  localStorage.setItem("x_dateVisits", JSON.stringify({ "御马监跑马场": [{ charId: "wy", ts: 1 }] }));
  DatePlaces.migrate(() => []);
  assert.deepEqual(DatePlaces.list("wy").map(x => x.name), ["御马监跑马场"]);
  assert.deepEqual(DatePlaces.list("qz").map(x => x.name), ["面馆"], "王爷的地点不许跑到齐周这里");
  assert.deepEqual(DatePlaces.unclaimed().map(x => x.name), ["无主"], "认不出的不丢");
  assert.equal(DatePlaces.list(undefined).length, 0);
  assert.equal(DatePlaces.visits("御马监跑马场", "qz").length, 0, "去过几次也只数跟这个人的");
});

test("群邀约散场：在场的人各记一次去过、群里留「那天」；手写的地方钉进去了的人的城；没来的人不记得这一场", () => {
  const i = app.indexOf("const endGroupOffline = async groupId => {");
  const seg = app.slice(i, app.indexOf("\n  };\n", i));
  assert.match(seg, /memberIds: \(groupAll\.memberIds \|\| \[\]\)\.filter\(id => sess\.present\.includes\(id\)\)/, "总结和记忆只算在场的人");
  assert.match(seg, /saveJSON\("x_dateVisits", v\)/);
  assert.match(seg, /kind: "datememory"/);
  const g = app.slice(app.indexOf("const groupDateGo"), app.indexOf("const groupInvitePlacesFor"));
  assert.match(g, /window\.DatePlaces\.add\(pl\.name, pl\.note \|\| "", "", x\.id\)/);
  assert.match(g, /datePlace: pl\.name \?/);
  const gt = comp.slice(comp.indexOf("function GroupThread"));
  assert.ok(gt.indexOf('m.kind === "datememory"') > 0 && gt.indexOf('m.kind === "datememory"') < gt.indexOf('if (m.kind === "system" || m.role === "system")'), "「那天」要排在系统提示前面，不然被吞成一行字");
});

test("线下＋里换衣服：单聊群线下共用一份；TA那身进状态卡，我那身管这一场出图、可固定；都落旁白", () => {
  const i = app.indexOf("const wearScene = ");
  const seg = app.slice(i, app.indexOf("const wardrobeFor = ", i));
  assert.match(seg, /putLiveField\(patch, live, "wearing", v, now\)/, "TA那身写进状态卡的穿着");
  assert.match(seg, /meOutfit: v/);
  assert.match(seg, /photoOutfit: v/, "勾了以后都这样就写进固定服装锁");
  assert.match(seg, /if \(scope\.groupId\) pushGOffMsg\(scope\.groupId, line\); else pushOffMsg\(scope\.scopeKey, line\);/);
  assert.match(app, /if \(sess\.meOutfit\) me\.outfit = sess\.meOutfit;/);
  assert.equal((app.match(/outfit: sceneMeOutfit\(\{ groupId/g) || []).length, 2, "群线下两处拍照也认这一场的那身");
  assert.match(app, /wearScene\(\{ scopeKey: activeOfflineScopeKey \}, who, text, forever\)/);
  assert.match(app, /wearScene\(\{ groupId: offlineGroup\.id \}, who, text, forever\)/);
  assert.equal((comp.match(/h\(OfflineWardrobe, \{ t, wardrobe,/g) || []).length, 2, "单聊群线下都接同一段");
  assert.equal((comp.match(/^function OfflineWardrobe\(/gm) || []).length, 1);
});

test("TA主动约她：偶尔给、不闹别扭时给、三天一回、挂着没回的不再约；同一张卡，她点好／改天，答应了钉进你俩的城", () => {
  const i = app.indexOf('openCaps.push("dateAsk")');
  const gate = app.slice(app.lastIndexOf("if (", i), i);
  assert.match(gate, /!_moodNeg && !_harsh/);
  assert.match(gate, /!charInviteOf\(charId\) && dateAskReady\(charId\) && Math\.random\(\) < 0\.1/);
  assert.match(app, /kind: "dateask", place: \{ name: nm, note: nt \}/);
  assert.match(app, /saveJSON\("x_dateAskLast", a\)/);
  const ans = app.slice(app.indexOf("const answerDateAsk"), app.indexOf("const pendingInviteOf"));
  assert.match(ans, /（她答应了）/, "她怎么回的要留在记录里，TA下一轮看得到");
  assert.match(ans, /window\.DatePlaces\.add\(pl\.name, pl\.note \|\| "", charId, charId\)/);
  assert.match(comp, /ask \? "想带你去个地方。"/);
  assert.match(comp, /m\.kind === "dateinvite" \|\| m\.kind === "datereceipt" \|\| m\.kind === "dateask"/);
});

test("邀约小框能直接选「现在」，单聊群里同一个小框", () => {
  assert.match(comp, /\[\[true, "现在"\], \[false, "定个时间"\]\]/);
  assert.match(comp, /now: true \}; \}\)\(\) : \{ date, time \}\)/);
  assert.match(app, /if \(w\.now\) return "现在";/);
  assert.equal((app.match(/\.\.\.\(v\.now \? \{ now: true \} : \{\}\)/g) || []).length, 2, "单聊群里两头都带上「现在」");
});

test("邀约卡只印亲口说的那句；世界地点不把地图描述当备注带进来", () => {
  assert.ok(comp.indexOf("pl.note ? row(I.pen, pl.note") < 0, "没写话时又拿地点备注顶上了");
  assert.match(app, /put\(nd && nd\.name, "", r\.world\.name\)/);
});

test("群里约好的到点也弹赴约卡，点出发＝带答应的人进群见面", () => {
  assert.match(app, /setDateArrive\(\{ groupId: g\.id, m \}\)/);
  assert.match(app, /if \(d\.groupId\) groupDateGo\(d\.groupId, d\.m\); else dateGo\(d\.charId, d\.m\);/);
});

test("「我换」里配一身：参考在场的人此刻穿的，挂进我的衣柜（跟照相馆同一个柜子）再换上；单聊群里都接", () => {
  const i = app.indexOf("const wearMatch = ");
  const seg = app.slice(i, app.indexOf("const wardrobeFor = ", i));
  assert.match(seg, /【一起的人此刻穿着】/);
  assert.match(seg, /saveMyCloset\(myClosetPut\(myClosetRef\.current,/);
  assert.match(seg, /wearScene\(scope, "me",/);
  assert.equal((app.match(/return wearMatch\(sc, kw, wardrobeFor\(sc,/g) || []).length, 2);
  assert.equal((comp.match(/h\(OfflineWardrobe, \{ t, wardrobe, onMatch, matchBusy,/g) || []).length, 2);
});

test("长名字、长地名、一串人都不冲出框（她 2026-10-02：群邀约弹出来的框文字超出框了）", () => {
  const pop = comp.slice(comp.indexOf("function DateArrivePop("), comp.indexOf("function DateInviteCard("));
  assert.match(pop, /const manyWho = who\.indexOf\("、"\) >= 0, longWho = manyWho \|\| who\.length > 6;/);
  assert.match(pop, /longWho \? \(manyWho \? "他们在等你了。" : "在等你了。"\)/, "一行手写里不许塞一串名字");
  assert.match(pop, /wordBreak: "break-word" \} \}, pl\.name/, "长地名要能换行");
  const dlg = comp.slice(comp.indexOf("function DateComposeDialog("), comp.indexOf("function DateComposeDialog(") + 3000);
  assert.match(dlg, /maxHeight: "88vh", overflowY: "auto"/, "小框比屏幕高时要能在框里滚");
});

test("不互通的群：约过的地方不进各人的城、不记去过、挑地方时也不读各人的城", () => {
  const g = app.slice(app.indexOf("const groupDateGo"), app.indexOf("const groupInvitePlacesFor"));
  assert.match(g, /window\.DatePlaces && gsFor\(groupId\)\.memoryInterop\) going\.forEach/);
  const e = app.slice(app.indexOf("const endGroupOffline = async groupId => {"));
  assert.match(e.slice(0, 6000), /if \(interopOn\) try \{\n\s*const v = loadJSON\("x_dateVisits"/);
  const pl = app.slice(app.indexOf("const groupInvitePlacesFor"), app.indexOf("const groupInvitePlacesFor") + 900);
  assert.match(pl, /if \(!interop && p\.from === "我们的城市"\) return;/);
});

test("从邀约出发、场子上却没记地方的那场：散场时从聊天里认回来；开机给近三天漏掉的补卡，聊天没载进来不碰", () => {
  const dp = app.slice(app.indexOf("const datePlaceOf = "), app.indexOf("const endOffline = async"));
  assert.match(dp, /x\.state === "gone"/);
  assert.match(app, /const _dp = sideRoom \? null : datePlaceOf\(charId, sess\);/);
  const fix = app.slice(app.indexOf("const dateMemFixRef"), app.indexOf("// 约到点了：不管她在哪一页"));
  assert.match(fix, /!Array\.isArray\(chatsRef\.current\[c\.id\]\) \|\| !chatsRef\.current\[c\.id\]\.length\) return;/, "聊天没载进来就往上追加会盖掉整段");
  assert.match(fix, /chat\.some\(m => m && m\.kind === "datememory" && m\.startTs === x\.startTs\)/, "补过的不再补");
});

test("「那天」收纳册：只收约过的（单聊的「那天」＋互通群里他去了的），翻面看总结，点开借线下往期记录页", () => {
  const al = app.slice(app.indexOf("const dateAlbumFor = "), app.indexOf("const endOffline = async"));
  assert.match(al, /m\.kind !== "datememory"/, "只收留过「那天」的，没走邀约的线下不收");
  assert.match(al, /gsFor\(g\.id\)\.memoryInterop/, "不互通的群不收");
  assert.match(al, /Array\.isArray\(m\.ids\) \? m\.ids\.includes\(charId\)/);
  assert.match(app, /kind: "datememory", place: sess\.datePlace, startTs: sess\.startTs, ids: /);
  const dw = R("js/dwell.js");
  assert.match(dw, /function DateAlbumCard\(/);
  assert.match(dw, /h\(DateMemoryCard, \{ m: m, character: \{ name: e\.who \}, fill: true \}\)/, "正面就是聊天里那张「那天」，不另画");
  assert.ok(dw.indexOf("THAT DAY") < 0, "dwell 里又抄了一份卡面");
  assert.match(dw, /h\(OfflineSessionReader, \{ session: albumRead\.session/, "完整经过用现成那页");
  assert.match(dw, /pointerEvents: flipped \? "none" : "auto"/);
});
