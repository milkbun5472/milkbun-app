const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const sc = fs.readFileSync(path.join(root, "js", "screens.js"), "utf8");
const ap = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
const cut = (s, a, b) => { const i = s.indexOf(a); return s.slice(i, s.indexOf(b, i + a.length)); };
const floorRow = cut(sc, "function floorRow(post, cm, i)", "\n  const sendReply");
const pmList = cut(sc, "function pmList()", "\n  // ---- 回复我的");
const sub = cut(ap, "const addForumSubReply = (post, floorId, text, toName)", "\n  // 生成回复");
const genMe = cut(ap, "const genRepliesToMe = async (post, floorId, myText, toName)", "\n  const genForumPost");

// 她 2026-09-01：「我回复了帖子然后有楼中楼我就没办法回复了，别人的楼中楼也不行」
test("楼中楼里每一条都能回，不只是楼层那一行", () => {
  // 原来只有楼层有「回复」，楼里的人回了我之后就再也接不上话
  const inReplies = cut(floorRow, "(cm.replies || []).map((r, j)", "(gen && gen.forumReplyMe === cm.id)");
  assert.match(inReplies, /setReplyTo\(\{ floorId: cm\.id, name: \(r\.authorType === "me" \? meChar\.name : r\.authorName\), toName:/,
    "楼中楼那一条没有自己的「回复」");
  // 回的是谁要看得出来
  assert.match(inReplies, /r\.toName && h\("span"[\s\S]{0,120}" 回复 @" \+ r\.toName/, "楼里谁在跟谁说话看不出来");
});

test("回楼中楼仍然落在同一层，用 @ 标对象，不做第三层嵌套", () => {
  // 真做三层嵌套在手机上没法读，老数据也要迁
  assert.ok(floorRow.indexOf("r.replies") < 0, "开始渲染第三层了");
  assert.match(sc, /if \(replyTo\) onReplySub\(open, replyTo\.floorId, rTxt\.trim\(\), replyTo\.toName \|\| ""\); else onReplyFloor/,
    "发送时没把「回的是谁」带过去");
  assert.match(sub, /content: text, toName: to, ts: Date\.now\(\)/, "我那条没记下回的是谁");
  assert.match(sub, /genRepliesToMe\(post, floorId, text, to\)/, "生成那一轮不知道我回的是谁");
});

test("被我 @ 的那个人才是必回我的人，不是永远层主", () => {
  // 原来一律强制层主回：我明明在回三楼的路人乙，跳出来答话的却永远是层主
  assert.match(genMe, /const atRow = at \? \(floor\.replies \|\| \[\]\)\.slice\(\)\.reverse\(\)\s*\.find\(r => r && r\.authorType !== "me" && String\(r\.authorName \|\| ""\) === at\) : null;/,
    "没有按 @ 的名字去楼里找人");
  assert.match(genMe, /const resp = atRow \? \{[\s\S]{0,200}inFloor: true\s*\} : \{/, "找到了也没换成那个人");
  // 找不着要退回层主——总得有人接话
  assert.match(genMe, /name: floor\.authorName \|\| "层主"/, "找不着人时没退回层主");
  // 提示词里那句「必须恰有一条是…回 TA 的」要跟着换称呼
  assert.match(genMe, /"① \*\*必须恰有一条是" \+ \(resp\.inFloor \? "被 TA 回的那个人" : "层主"\)/, "提示词还写死了层主");
  // 还原身份时用被 @ 的那个人，不是楼层作者
  assert.match(genMe, /authorName: resp\.name, authorHandle: resp\.handle, authorType: resp\.type/, "回我的那条还挂着楼层作者的身份");
});

// 她 2026-09-01：「私信刷出来的人数放大点」
test("私信一次多刷几个人，封顶跟着一起放大", () => {
  assert.match(ap, /const FORUM_PM_ASK = "6-9";/, "问的人数没放大");
  assert.match(ap, /const FORUM_PM_KEEP = 24;/, "封顶没放大");
  assert.match(ap, /"贴吧里有 " \+ FORUM_PM_ASK \+ " 个陌生网友私信了你/, "提示词没用这个数");
  assert.match(ap, /\.slice\(0, FORUM_PM_KEEP\)/, "封顶还是写死的数");
  // 只放大问的人数、封顶不动的话，新的一进来就把上一批挤没了
  assert.ok(ap.indexOf(".slice(0, 10); saveJSON(\"x_forumPMs\"") < 0, "封顶还留着 10");
});

// 她 2026-09-01：「也不需要每次刷新都有杠精了」
test("杠精由代码兜死，不是只在提示词里说说", () => {
  // 「规则降概率，代码才保证」：原来只写「最多只安排一个」——那是上限不是配额，
  // 而且一提杠精模型就必给一个
  assert.match(ap, /const aliveTroll = \(forumPMsRef\.current \|\| \[\]\)\.some\(t => t && t\.attitude === "troll"\);/,
    "没看手上还挂着没挂着杠精");
  assert.match(ap, /let trollLeft = aliveTroll \? 0 : 1;/, "杠精没有配额");
  assert.match(ap, /if \(att === "troll"\) \{ if \(trollLeft > 0\) trollLeft--; else att = "curious"; \}/,
    "超配额的杠精没被降成普通网友");
  // 提示词那句也要反过来说
  assert.match(ap, /\*\*默认一个杠精都不要\*\*/, "提示词还在主动提杠精");
  assert.ok(ap.indexOf("最多只安排一个杠精喷子") < 0, "旧那句上限还留着——撤掉要删掉");
});

// 她 2026-09-01：「加一个清理可以清掉私信」
test("私信能一条条删，也能一次清光", () => {
  assert.match(ap, /const delForumPM = threadId => setForumPMs\(prev => \{ const n = prev\.filter\(t => t && t\.id !== threadId\);/, "没有删一条");
  assert.match(ap, /const clearForumPMs = \(\) => setForumPMs\(\(\) => \{ saveJSON\("x_forumPMs", \[\]\); return \[\]; \}\);/, "没有全部清掉");
  assert.match(ap, /onDelPM: delForumPM,\n\s*onClearPMs: clearForumPMs,/, "两个 handler 没发给论坛");
  assert.match(sc, /onDelPM, onClearPMs,/, "论坛没收这两个 prop");
  assert.match(pmList, /setPmClean\(v => !v\)/, "没有「清理」这一档");
  assert.match(pmList, /pmClean && h\("button", \{ onClick: \(\) => onDelPM && onDelPM\(th\.id\)/, "清理档里没有每条的 ✕");
  assert.match(pmList, /"全部清掉 " \+ list\.length \+ " 条"/, "没有一次清光");
  // 一条都没有时不摆清理按钮
  assert.match(pmList, /list\.length > 0 && h\("button", \{ onClick: \(\) => setPmClean/, "一条私信都没有也摆着「清理」");
});

// 她 2026-09-01 截图：整张卡片超出屏幕、整页跟着往右滑，头像和返回键都被推出去了
test("帖子底部那条挤得下，页面不许横着滑", () => {
  const actBar = cut(sc, "function actBar(p)", "\n  // ---- 帖子行");
  // 注释里会提到旧写法，只看真代码
  const code = actBar.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert.ok(code.indexOf("gap-5") < 0, "还是固定 20px 的间距，数字一大就顶出去");
  assert.match(actBar, /justifyContent: "space-between", gap: 6, minWidth: 0/, "没改成挤得下就收间距");
  assert.match(actBar, /flexShrink: 0, whiteSpace: "nowrap"/, "数字会被折断");
  assert.ok(actBar.indexOf("ml-auto") < 0, "space-between 之外还留着 ml-auto");
  // 兜底：里头再顶宽，整页也不许横着滑
  assert.match(sc, /color: FORUM_SKIN\.ink, overflowX: "hidden" \} \}/, "论坛整页没拦住横向滚动");
});

test("主页那一行统计能折行，长名字也挤不掉「编辑资料」", () => {
  assert.equal((sc.match(/flex items-center flex-wrap gap-x-4 gap-y-1 mt-3/g) || []).length, 2,
    "我的主页和小号主页那两行没都改成能折行");
  assert.equal((sc.match(/fontSize: 12\.5, color: t\.ink, whiteSpace: "nowrap" \} \}, h\("b", null, fmtNum\(/g) || []).length, 3,
    "关注／粉丝那几个数会被折断");
  assert.match(sc, /className: "shrink-0 px-3\.5 py-1\.5 active:opacity-70"[\s\S]{0,180}"编辑资料"/, "长名字会把「编辑资料」挤扁");
});
