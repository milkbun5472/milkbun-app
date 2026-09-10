// 她 2026-09-09：「群聊和旁观群能不能也做锁屏通知啊」。
//
// ⚠️查下来是【只有单聊那一路在报】：Notify.chatBubble 全库只有一处调用点，
//    就在单聊那个气泡循环里。群聊和旁观群一条都不报——切出去就等于没发生。
//    旁观群不用另写一支：她在旁观群里也是从同一条路收成员发言的。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const app = R("js/app.js"), notify = R("js/notify.js"), sw = R("sw.js");

test("群里那几条真的报出去了，旁观群走同一条路", () => {
  const i = app.indexOf("if (window.Notify && window.Notify.groupBubble)");
  assert.ok(i > 0, "群那一路没报");
  const seg = app.slice(i, i + 500);
  assert.match(seg, /title: \(group && group\.name\) \|\| "群聊"/, "标题不是群名，锁屏上认不出是哪个群");
  assert.match(seg, /body: \(spk\.name \? spk\.name \+ "：" : ""\) \+ gBubbles\[j\]/, "正文没带是谁说的");
  assert.match(seg, /groupId: groupId/, "没带群 id，点开落不到那个群");
  // ⚠️它必须挂在【逐泡真的冒出来】那一处，不是攒完一起报
  assert.ok(app.indexOf("ReactDOM.flushSync(reveal); else reveal();") < i, "没挂在逐泡提交之后");
  assert.ok(i < app.indexOf("// 群照片：该成员这条发言带了 photo 对象"), "跑到气泡循环外面去了");
});

test("tag 的形状跟单聊共用一份：同一个气泡重报不堆重复", () => {
  assert.match(notify, /function groupBubble\(opts\) \{\s*\n\s*return chatBubble\(\{ \.\.\.opts, screen: "gthread" \}\);/,
    "群那一支自己另写了 tag——那就会跟单聊走散");
  assert.match(notify, /tag: "bubble-" \+ JSON\.stringify\(\[opts\.chatKey, opts\.turnId, opts\.bubbleId\]\)/);
  assert.equal((notify.match(/tag: "bubble-"/g) || []).length, 1, "tag 的算法只许有一份");
  assert.match(notify, /window\.Notify = \{[^}]*groupBubble/);
});

test("groupId 一路传到底：payload → sw → 点开落进那个群", () => {
  // 前端 payload
  assert.match(notify, /groupId: opts\.groupId \|\| "",/);
  assert.match(notify, /data: \{charId: payload\.charId, groupId: payload\.groupId,/);
  // service worker 两头
  assert.match(sw, /data: \{ charId: d\.charId \|\| "", groupId: d\.groupId \|\| "",/);
  assert.match(sw, /const groupId = \(event\.notification\.data && event\.notification\.data\.groupId\) \|\| "";/);
  assert.match(sw, /postMessage\(\{ type: "OPEN_FROM_NOTIF", charId, groupId, screen, roomId \}\)/);
  // 冷启动那一路（app 还没开时点通知）
  assert.match(sw, /url\.searchParams\.set\("notifGroup", groupId\)/);
  assert.match(notify, /url\.searchParams\.has\("notifGroup"\)/);
  assert.match(notify, /groupId: url\.searchParams\.get\("notifGroup"\) \|\| ""/);
  assert.match(notify, /\["notifChar", "notifGroup", "notifScreen", "notifRoom"\]/, "冷启动那几个参数没清干净会留在地址栏里");
});

test("点开真的落进那个群，而且未读用对了键", () => {
  const i = app.indexOf("window.__openFromNotif = (charId, screen, roomId, groupId) => {");
  assert.ok(i > 0, "__openFromNotif 没收 groupId");
  const seg = app.slice(i, i + 900);
  // 群找不到时【先不动】，跟单聊同一个形状（冷启动资料还没到，等下次重试）
  assert.match(seg, /if \(groupId && !g\) return;/, "群没找到就乱跳了");
  assert.match(seg, /setActiveGroup\(g\);/);
  assert.match(seg, /setScreen\("gthread"\);/);
  // ⚠️群未读的键就是 g.id 本身（pGChat 里 bumpUnread(id, added)），"g:"+id 那个是 lane 的键
  assert.match(seg, /clearUnread\(g\.id\);/, "清未读用错了键，红点不会消");
  assert.match(app, /setTimeout\(\(\) => bumpUnread\(id, added\), 0\);/, "群未读那头的键变了，上面那条要跟着重看");
  assert.match(app, /window\.__openFromNotif\(d\.charId, d\.screen, d\.roomId, d\.groupId\);/, "sw 那条消息没把 groupId 转进来");
});

// 她 2026-09-09：「还有不知道为啥现在我的 xcode 壳开不了锁屏通知嘤」。
// ⚠️病根：**WKWebView 根本不暴露 Notification API**。supported() 第一句
//    "Notification" in window 在壳里恒为 false，那个开关点了永远打不开。
//    iOS 上的 Web 通知只在 Safari 和「添加到主屏」的 PWA 里有。壳的头注释还写着
//    「推送仍走 Web Push(站内已有)」——那句话本身就是错的，一并改掉。
test("壳里走原生那座桥，桥不在才回到 Web 那条老路", () => {
  const shell = R("tools/ios-shell/LisaPhone/LisaPhone/AppDelegate.swift");
  // 两条路对外是同一套 API：调用方一个字都不用改
  assert.match(notify, /const bridge = \(\) => \{[\s\S]{0,160}messageHandlers\.nativeNotify/);
  assert.match(notify, /const supported = \(\) => !!bridge\(\) \|\| webSupported\(\);/, "壳里 supported 还是 false，开关打不开");
  assert.match(notify, /if \(bridge\(\)\) \{\s*\n\s*const r = await ask\(\{ action: "permission" \}\);/, "壳里没走原生授权");
  assert.match(notify, /if \(bridge\(\)\) \{ const r = await ask\(\{ \.\.\.payload, action: "show" \}\); return !!\(r && r\.ok\); \}/, "壳里没走原生弹通知");
  // 桥不在时那条老路一个字都不许改
  assert.match(notify, /const webSupported = \(\) => typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;/);
  assert.match(notify, /perm = await Notification\.requestPermission\(\)/);

  // 壳那一头：注册 + 三个 action + 点开交回网页
  assert.match(shell, /import UserNotifications/);
  assert.match(shell, /addScriptMessageHandler\(self, contentWorld: \.page, name: "nativeNotify"\)/);
  assert.match(shell, /if message\.name == "nativeNotify" \{/);
  ["status", "permission", "show"].forEach(a =>
    assert.match(shell, new RegExp('case "' + a + '":'), a + " 这个 action 没实现"));
  // identifier 就是站内那个 tag：同一个气泡重报会覆盖，不堆重复（跟 Web 那条同一个规矩）
  assert.match(shell, /let id = \(d\["tag"\] as\? String\)/, "没用站内的 tag 当 identifier，重报会堆一串");
  // 点开落哪儿全在网页那头，壳不许自己再判一套
  assert.match(shell, /window\.__openFromNotif\(/);
  assert.match(shell, /"groupId": \(d\["groupId"\] as\? String\) \?\? ""/, "壳没把 groupId 带上，点开落不进群");
  // 那句错话不许再留着
  assert.ok(!/推送仍走 Web Push\(站内已有\)。/.test(shell), "头注释还写着「推送走 Web Push」——壳里根本没有");
});

// v66.23 她 2026-09-10：「壳开不了通知宝宝」——她点的时候弹的是「此设备/浏览器不支持通知」，
// 那句话把她引到死路上：旧壳不是不支持，是那座桥 v66.22 才加、她还没在 Xcode 里重 build。
// 旧壳认得出来：nativeMedia 那座桥 v1 就有，nativeNotify 没有＝壳是旧的。
test("旧壳弹的是「去 Xcode 重 build」，不是「不支持」", () => {
  assert.match(notify, /const oldShell = \(\) => \{[\s\S]{0,200}!bridge\(\)[\s\S]{0,120}messageHandlers\.nativeMedia/,
    "认不出旧壳——nativeMedia 在、nativeNotify 不在，才是「壳旧了」");
  assert.match(notify, /if \(supported\(\)\) return "";/, "能用的时候还给理由，那就会乱弹");
  assert.match(notify, /return oldShell\(\) \? "壳还是旧的：在 Xcode 里重新 build 一次就有通知了" : "此设备\/浏览器不支持通知";/);
  assert.match(notify, /window\.Notify = \{[^}]*whyUnsupported/, "没挂出去，界面拿不到");
  // 界面那头必须用它，而且拿不到时还能退回原来那句
  const s = R("js/screens.js");
  assert.match(s, /if \(!window\.Notify \|\| !window\.Notify\.supported\(\)\) \{ toast && toast\(\(window\.Notify && window\.Notify\.whyUnsupported && window\.Notify\.whyUnsupported\(\)\) \|\| "此设备\/浏览器不支持通知"\); return; \}/,
    "开关那儿还在硬写「不支持」");
  assert.equal((s.match(/"此设备\/浏览器不支持通知"/g) || []).length, 1, "这句话在界面里不止一处");
});
