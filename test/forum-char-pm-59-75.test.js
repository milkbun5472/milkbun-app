const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const sc = fs.readFileSync(path.join(root, "js", "screens.js"), "utf8");
const ap = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
const en = fs.readFileSync(path.join(root, "js", "engine.js"), "utf8");
const cut = (s, a, b) => { const i = s.indexOf(a); return s.slice(i, s.indexOf(b, i + a.length)); };

// 她 2026-09-01：「如果是私信角色的话要不要喂回去做聊天线的一部分跟线上线下一起」→ 做。
test("能私信角色的大号，不为开场白多花一次调用", () => {
  const st = cut(ap, "const startCharPM = char => {", "\n  const sendForumPM");
  assert.match(st, /charId: char\.id/, "会话没记是哪个角色的");
  assert.match(st, /messages: \[\]/, "还替她编了一句开场白——是她去敲门，她先说话才对");
  assert.ok(st.indexOf("runProbe") < 0 && st.indexOf("await") < 0, "开一条会话还调了一次模型");
  assert.match(st, /const exist = \(forumPMsRef\.current \|\| \[\]\)\.find\(t => t && t\.charId === char\.id\);/, "同一个角色会开出第二条");
  assert.match(st, /if \(exist\) return exist\.id;/, "已经有会话时没直接开那一条");
});

test("角色回私信走他自己那份上下文，不是网友那套提示词", () => {
  const sd = cut(ap, "const sendForumPM = async (threadId, text)", "\n  // 帖子回复数");
  assert.match(sd, /const pmChar = th\.charId \? \(characters \|\| \[\]\)\.find\(c => c\.id === th\.charId\) : null;/, "没认出这条是角色的");
  assert.match(sd, /runProbe\(apiFor\(pmChar\.id\), ctxFor\(pmChar\)/,
    "拿通用的网友提示词去演他，出来的是个顶着他网名的陌生人");
  assert.match(sd, /\*\*你俩都知道对面是谁\*\*——这不是陌生人搭讪/, "没说清两边都不藏");
  // 私信是打字，不是当面
  assert.match(sd, /\*\*别写任何动作描写或旁白\*\*/, "私信框里冒出动作描写");
  assert.match(sd, /return;\n      \}/, "角色那条走完没返回，会接着跑网友那套");
});

test("这条线喂回聊天，跟线上线下一起算同一段关系", () => {
  const fb = cut(ap, "forumPmLog: (() => {", "\n    })(),");
  assert.match(fb, /\(forumPMsRef\.current \|\| \[\]\)\.find\(t => t && t\.charId === char\.id\)/, "喂回去的不是这个角色那条");
  assert.match(fb, /Date\.now\(\) - 3 \* 86400000/, "没有时间窗，三个月前的也喂");
  assert.match(fb, /\.slice\(-12\)/, "整条私信全塞进去，会把别的上下文挤掉");
  assert.match(fb, /engineerEyes\) return ""/, "工程师视角那条没关掉");
  // engine 那边接得上
  assert.match(en, /ctx\.forumPmLog && ctx\.forumPmLog\.trim\(\)\) parts\.push\("【贴吧私信 · 你和 " \+ uName/, "engine 没有这一块");
  assert.match(en, /!ctx\.notRoleplay && ctx\.forumPmLog/, "数字生命也发了扮演类的块");
  // 跟别的面同口径：精简写作路要清掉
  assert.match(en, /momentLog: "", forumEcho: "", forumPmLog: "", listenLog: "",/, "精简写作路没清掉它");
  assert.match(ap, /_roomCtx\.forumEcho = ""; _roomCtx\.forumPmLog = "";/, "分身/房间那个认知开关没管它");
});

// 那一整个玩法建立在「他知道两边是同一个人、她不知道」上面
test("小号和匿名的私信一个字都不许沾", () => {
  const alt = cut(sc, "function altProfileView()", "function npcProfileView()");
  assert.ok(alt.indexOf("私信 TA") < 0, "小号主页上挂了私信按钮");
  assert.ok(alt.indexOf("onStartCharPM") < 0, "小号主页接上了角色私信");
  // 喂回去那一份只认 charId：小号会话压根没有 charId，进不来
  const fb = cut(ap, "forumPmLog: (() => {", "\n    })(),");
  ["altName", "altHandle", "character_alt", "character_anon"].forEach(k =>
    assert.ok(fb.indexOf(k) < 0, "喂回去的那一份沾了小号/匿名（" + k + "）"));
  // 代码里得写着为什么，不然下一个人顺手就加上了
  assert.match(sc, /小号私信一旦喂回聊天/, "小号为什么不给，代码里没写");
  assert.match(ap, /「他知道两边是同一个人、她不知道」/, "这条界线的理由没落在代码里");
});

test("入口只长在角色的论坛主页上，点完就跳过去", () => {
  const pv = cut(sc, "function profileView(isMe)", "function altProfileView()");
  assert.match(pv, /onStartCharPM \? h\("button"/, "角色主页上没有私信入口");
  assert.match(pv, /const tid = onStartCharPM\(c\); if \(tid\) \{ setProfileId\(null\); setNav\("pm"\); setPmId\(tid\); \}/, "开完不跳过去");
  // 我自己的主页不该有：isMe 那一支还是「编辑资料」，私信按钮在 !isMe 那一支里
  assert.ok(pv.indexOf('"编辑资料"') > 0, "我自己的主页那一支被改坏了");
  assert.ok(pv.indexOf('"私信 TA"') > pv.indexOf('"编辑资料"'), "私信按钮跑到我自己那一支去了");
  assert.match(ap, /onStartCharPM: startCharPM,/, "handler 没发给论坛");
  assert.match(sc, /onStartPM, onStartCharPM, onDelPM, onClearPMs,/, "论坛没收这个 prop");
});
