const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const sc = fs.readFileSync(path.join(root, "js", "screens.js"), "utf8");
const ap = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
const cut = (s, a, b) => { const i = s.indexOf(a); return s.slice(i, s.indexOf(b, i + a.length)); };

// 她 2026-09-01：「1不错」——从「回复我的」直接回过去
test("通知上就能直接回，而且瞄准的是对的人", () => {
  const nl = cut(sc, "function noticeList()", "\n  function pmThread");
  assert.match(nl, /onClick: \(\) => replyFromNotice\(n\)/, "通知行上没有「回复」");
  assert.match(nl, /onClick: \(\) => openNotice\(n\)/, "整行点开看那一层的路没了");
  const rf = cut(sc, "const replyFromNotice = n =>", "\n  const meChar");
  // 两种通知瞄准不同的人：回我帖子的 → 回那一层；回我的 → 回那个人
  assert.match(rf, /toName: n\.kind === "回复了你" \? n\.authorName : ""/, "两种通知没分开瞄准");
  assert.match(rf, /markNoticesRead\(\[n\.id\]\); openPost\(n\.post\);/, "没顺手标已读、没打开那个帖");
  assert.match(rf, /replyInputRef\.current\.focus\(\)/, "跳过去了还得自己点一下输入框");
  assert.match(sc, /h\("input", \{ ref: replyInputRef,/, "输入框没挂 ref，聚不了焦");
});

// 她 2026-09-01：「陆续新回复也是点进去看看不出来哪些是新增的」
test("进门那一刻把「读到哪儿」冻住，新来的那几条标出来", () => {
  // 底下那个 effect 一进帖子就把读到的位置推到最新，不冻的话新回复当场变成旧的
  assert.match(sc, /const openCursorRef = useRef\(0\);/, "没有冻住的那个游标");
  assert.match(sc, /openCursorRef\.current = Number\(forumReadCursors\[p\.id\] \|\| 0\);/, "打开帖子时没冻");
  assert.match(sc, /const isFreshFloor = f => !!f && f\.authorType !== "me" && floorArrivedAt\(f\) > openCursorRef\.current;/,
    "楼层认不出新旧");
  assert.match(sc, /const isFreshReply = r => !!r && r\.authorType !== "me" && Number\(r\.ts \|\| 0\) > openCursorRef\.current;/,
    "楼中楼认不出新旧");
  // 我自己说的不算新
  assert.ok(/isFreshFloor[\s\S]{0,120}authorType !== "me"/.test(sc), "我自己发的也被标成新的了");
  const fr = cut(sc, "function floorRow(post, cm, i)", "\n  const sendReply");
  assert.match(fr, /const fresh = isFreshFloor\(cm\);/, "楼层没算新旧");
  assert.match(fr, /fresh && newTag\(\)/, "楼层上没标出来");
  assert.match(fr, /isFreshReply\(r\) && newTag\(\)/, "楼中楼里没标出来");
  // 不只是一个「新」字：整条的边也要跟着变，扫一眼就找得着
  assert.match(fr, /borderLeft: \(fresh \? "3px solid " \+ FORUM_SKIN\.accent/, "新的那条只有一个小标签，扫不出来");
});

// 她 2026-09-01：「可以再给每个网友增加私信功能，就喂他们发过的帖和回复过的」
test("能主动私信一个网友，开场白从他自己说过的话长出来", () => {
  const st = cut(ap, "const startForumPM = async (npc, lines)", "\n  const sendForumPM");
  assert.match(st, /【TA 在吧里说过的话（开场白必须从这里面长出来/, "没喂他自己说过的话");
  assert.match(st, /【TA 在吧里还没留下什么公开发言】/, "一句都没说过的人没有兜底，会被现编一堆");
  assert.match(st, /是被陌生人主动私信之后的反应\*\*，不是 TA 主动来搭讪/, "写成了他来找我，方向反了");
  // 同一个人不该在列表里躺两遍
  assert.match(st, /const exist = \(forumPMsRef\.current \|\| \[\]\)\.find\(t => t && \(t\.npcId === npc\.id \|\| t\.npcName === npc\.name\)\);/,
    "同一个人会开出第二条会话");
  assert.match(st, /if \(exist\) return exist\.id;/, "已经有会话时没直接开那一条");
  // 聊几轮之后还得是同一个人
  assert.match(ap, /th\.ground \? "\\n【你在吧里说过这些，说话得像同一个人】\\n" \+ th\.ground/, "后续回复没接着吃这份底子");
  const np = cut(sc, "function npcProfileView()", "\n  // ---- 主体分派");
  assert.match(np, /const pmGround = authored\.slice\(0, 3\)/, "主页没把他发过的帖整理出来");
  assert.match(np, /traces\.slice\(0, 5\)/, "主页没把他在别人楼里说的话整理出来");
  assert.match(np, /gen && gen\.forumPM === "start" \? "去敲门…" : "私信 TA"/, "网友主页上没有「私信 TA」");
  assert.match(np, /\.then\(tid => \{ if \(tid\) \{ setNpcProfile\(null\); setNav\("pm"\); setPmId\(tid\); \} \}\)/, "开完不跳过去");
});

// 审计发现：同一条帖转进群里，作者本人一点都认不出是自己发的
test("转发到群聊也带上「这帖是你自己发的」，跟私聊同一份", () => {
  // .claude/rules/four-surfaces-same-context.md：一层写在两处，第二处没跟上
  assert.match(ap, /const forumOwnTags = \(post, charId\) => \{/, "识别标签没抽成一份共用的");
  assert.match(ap, /const forumShareText = \(post, tags\) =>/, "转发正文没抽成一份共用的");
  const fg = cut(ap, "const forwardPostToGroup = (post, groupId)", "\n  // ficshare");
  assert.match(fg, /const tg = forumOwnTags\(post, cid\);/, "群里没给每个人算自己那一份");
  assert.match(fg, /"｜【给" \+ c\.name \+ "】"/, "群里几个人的标签混在一起，分不出是给谁的");
  assert.match(fg, /content: forumShareText\(post, tags\)/, "群聊那条还是没有 content");
  // 群里那行原来只认 m.post、把 content 丢掉了
  assert.match(ap, /m\.kind === "forumshare" \? \(m\.content \|\| \("\[转发了一条贴吧帖\]"/, "群提示词还是不看 content");
  // 老消息没有 content，仍要能拼出来
  assert.match(ap, /m\.post \? "「" \+ \(m\.post\.board \|\| ""\)[\s\S]{0,220}: ""\)\)\)/, "老消息的兜底拼法被删了");
});

// 私信要不要喂进上下文：不自动喂，但要给得出去
test("私信绝不自动进上下文，只有她拿给谁看才进", () => {
  // forumEcho 是唯一一条自动注入的链，它一个字都不许读私信
  const echo = cut(ap, "forumEcho: (() =>", "\n    })(),");
  assert.ok(echo.length > 400, "找不到 forumEcho 那一段");
  ["forumPMs", "forumPMsRef", "x_forumPMs", "attitude"].forEach(k =>
    assert.ok(echo.indexOf(k) < 0, "论坛回声读了私信（" + k + "）——那是她自己的收件箱，自动喂等于开上帝视角"));
  // 但要有一个按钮把它摆出去
  const fp = cut(ap, "const forwardPMToChat = (thread, toChar)", "\n  // ficshare");
  assert.match(fp, /\[给你看一段贴吧私信\]/, "没有拿给角色看的路");
  assert.match(fp, /\*\*这是她主动拿给你看的\*\*，不是你自己翻到的/, "没说清是主动给的还是被撞破的——两种语气完全不一样");
  assert.match(fp, /thread\.attitude === "troll" \? "（这人是来找茬的）" : ""/, "杠精没标出来，他不知道她在被骚扰");
  assert.match(fp, /\.slice\(-6\)/, "整条私信全塞进去了，长了会挤掉别的上下文");
  assert.match(sc, /onForwardPM \(?&& \(characters \|\| \[\]\)\.length > 0/, "会话页上没有「拿给…看」");
});
