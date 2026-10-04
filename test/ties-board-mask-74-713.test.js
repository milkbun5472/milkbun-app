// 关系网上「我」那个节点戴哪张脸（群友 2026-10-03 在秋秋机群里报的）
//
// 她原话：「聊天里 u 和 c 绑专属面具的话，关系网上 u 显示的头像也是主面具」。
//
// 病根：关系网是【一人一页】的（v60.47 她要的），可这一页只拿到一张全局 profile；
//   而「这个人认识的是我哪一张脸」那一层走的是 profileFor——它是 ctxFor 那一口的
//   公共件，单聊线上/线下、通话、日记、查手机、穿书、匿名箱、解梦馆八处都接着，
//   偏偏关系网没接（four-surfaces-same-context 那个老形状）。
//
// 这儿不另算一遍换脸逻辑（one-public-mechanism）：把 profileFor 递下去就行。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync("js/app.js", "utf8");
const scr = fs.readFileSync("js/screens.js", "utf8");
const live = s => s.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");

test("① app.js 把公共件递给关系网，不是另造一份", () => {
  const i = app.indexOf('screen === "ties") body =');
  const j = app.indexOf("else if (screen ===", i + 10);
  const call = app.slice(i, j > i ? j : i + 2000);
  assert.match(call, /profileFor: profileFor/, "关系网没拿到 profileFor");
  assert.match(live(app), /const profileFor = charId =>/, "公共件本身不见了");
});

test("② 板子上的「我」戴的是这一页这个人认识的那张脸", () => {
  assert.match(live(scr), /const boardProfile = /, "没按这一页算过脸");
  const line = live(scr).split("\n").find(l => l.includes("const boardProfile"));
  assert.ok(/boardId !== "me"/.test(line), "「我」自己那一页该照旧用主面具");
  assert.ok(/profileFor\(boardId\)/.test(line), "要按这一页的人取脸");
  assert.ok(/\|\| profile/.test(line), "那张脸被删了要退回主面具，不能炸");
  assert.match(live(scr), /centerId: boardId, me: meBoardMe, profile: meBoardProfile/,
    "板子拿到的还是全局 profile，等于没改");
});

// 她 2026-10-03 第二轮：「面具那边不能只改头像名字也得改」——
//   一张面具上名字和脸是一个人，只换一半出来的是个四不像：
//   板子上写着主面具的名字、配着另一张脸。
test("③ 换脸连名字一起换，不是只换头像", () => {
  assert.match(live(scr), /const boardMe = boardProfile\.name \|\| me;/, "板子那一页名字没跟着面具走");
  assert.match(live(scr), /centerId: boardId, me: meBoardMe, profile: meBoardProfile/, "名字没递下去");
  // 「走一圈」问的是同一个问题：站在谁身上，「我」就是那个人认识的那张脸和那个名字
  assert.match(live(scr), /const walkProfile = \(centerId !== "me"/, "走一圈那一页没跟上");
  assert.match(live(scr), /const walkMe = walkProfile\.name \|\| me;/, "走一圈的名字没跟着面具走");
  assert.match(live(scr), /id === "me" \? walkMe :/, "走一圈里「我」的名字还是主面具那个");
  assert.ok(live(scr).includes('h(TiesBoard, { key: centerId, centerId, me: walkMe, profile: walkProfile'),
    "走一圈里那张板子还在用主面具");
  assert.ok(live(scr).includes('me: walkMe, profile: walkProfile, allChars: all, rels,'),
    "走一圈里整网图还在用主面具");
  assert.match(live(scr), /^\s*startId: walkAt, me, profile, profileFor,/m, "走一圈没收到 profileFor");
});

test("④ profileFor 没传也不许炸（它是可选 prop）", () => {
  const line = live(scr).split("\n").find(l => l.includes("const boardProfile"));
  assert.ok(/typeof profileFor === "function"/.test(line), "没做函数判断");
  assert.match(live(scr), /^\s*profileFor,$/m, "Ties 的形参表里没收这一项");
});

// 「我」自己那一页：面具筛子（她 2026-10-03 拍板）
//
// 她问的是：「如果有面具，在 user 关系界面还是显示主面具，这种咋算，
//            难道 user 页面也还要单独分每个面具的关系网吗」。
//
// 答：别人那一页问「这个人眼里的我是谁」，所以戴他认识的脸；
//     「我」自己那一页没有「对谁」，中心就该是我本人。
// 但这个 app 里面具本来就被当成【另一台手机、另一个她】（查手机那儿
//     「跟 TA 不是同一张面具聊的，他默认查不到」），两圈人画在同一张网上
//     等于把两个社交圈画成一个。所以给【筛子】——怎么看，不是存几份。
// ⚠️不给每张面具建独立的网：面具没有「自己认识的人」，人还是那些人，
//     分叉等于把一套关系拆成两套各自维护。
test("⑤ 「我」那一页按面具筛，但不给面具分叉出第二套关系", () => {
  const S = live(scr);
  assert.match(S, /const \[maskPick, setMaskPick\] = useState\(""\);/, "没有筛子状态（\"\"＝全部）");
  assert.match(S, /maskPick === "_main" \? \(!cur \|\| cur === maskPrimary\) : cur === maskPick/,
    "主面具那一档要把【没挑过面具的】也算进来，否则选主面具时一个人都不剩");
  // 筛的是【画哪些人】，不是另存一份关系
  assert.match(S, /if \(typeof keepId === "function" && !keepId\(other\)\) return;/, "板子没按筛子过滤");
  assert.match(S, /keepId: boardId === "me" \? maskHit : null/, "筛子漏到别人那一页去了（那几页该按人，不按面具）");
  assert.ok(!/x_maskRels|relsByMask/.test(S + live(app)), "给面具分叉出了第二套关系");
  // 换筛子要真的换一页：节点位置和选中状态不许留在上一张筛子里
  assert.match(S, /key: boardId \+ "\|" \+ maskPick/, "换面具没换 key");
  // 选了面具，这一页讲的就是那张面具：脸、名字、顶栏、段数都要跟着
  assert.match(S, /const maskProfile = maskPick && maskPick !== "_main"/, "中心那张脸没跟着筛子走");
  assert.match(S, /const meBoardMe = boardId === "me" \? \(maskProfile\.name \|\| me\) : boardMe;/, "名字没跟着筛子走");
  assert.match(S, /\? partnersOf\("me"\)\.filter\(c => maskHit\(c\.a === "me" \? c\.b : c\.a\)\)/, "顶栏那个「N 段」还数着全部人");
  // 只有一张面具（＝没分身）时不摆这条，省得平白多一行
  assert.match(S, /const maskStrip = \(boardId === "me" && maskList\.length\)/, "没面具的时候也摆了这条");
});
