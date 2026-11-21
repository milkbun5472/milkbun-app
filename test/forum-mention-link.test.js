// 论坛里 @ 人、贴帖子（她 2026-11-21）：
//   ① 发帖、回楼、楼中楼打「@」弹名单（跟群聊频道同一份 useAtPicker），挑中的 id 存在那条记录的 mentions 上；
//   ② 被 @ 的角色／熟面孔下一波一定来，而且知道自己被点了名——拼进本来就有的那几路生成，不另花调用；
//   ③ 贴帖子存成正文里的 [[post:ID]]，界面画成小卡，喂给模型时换成《标题》再挂一句它讲什么。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const scr = R("screens.js"), ui = R("screens-ui.js"), app = R("app.js"), comp = R("components.js"), ts = R("theme-studio.js");
const cut = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b, i + a.length); assert.ok(i >= 0 && j > i, "抠不出 " + a); return s.slice(i, j); };

// screens.js 那几个公共函数真跑
const helpers = new Function("forumOwnerRegulars", cut(scr, "const FORUM_LINK_RE", "function forumBoardRulesOf(")
  + ";return { forumLinkToken, forumLinkIds, forumLinkSource, forumLinkPlain, forumLinkNotes, forumAtCandidates, forumMentionIds };")(
  () => [{ id: "npc_regular_moyu", name: "摸鱼办主任", handle: "moyu_office" }]);

test("@ 名单：公共的 useAtPicker，论坛三个框都接上；新挂点都登记了", () => {
  // 群聊频道原来写在 DraftInput 里的那份搬成公共的，DraftInput 自己也用它
  const hook = cut(comp, "function useAtPicker(", "\nfunction ReplyKey(");
  assert.match(hook, /"data-wk": "atlist"/);
  assert.match(hook, /"data-wk": "atitem"/);
  assert.match(cut(comp, "function DraftInput(", "function useAtPicker("), /useAtPicker\(draft, setDraft, ref, atList\)/);
  assert.equal((comp.match(/"data-wk": "atlist"/g) || []).length, 1, "@ 名单只许有一份");
  assert.match(ui, /useAtPicker\(cbBody, setCbBody, cbBodyRef, composer \? atItems : null/);
  assert.match(ui, /useAtPicker\(rTxt, setRtxt, replyInputRef, open \? atItems : null/);
  ["fomention", "folinkbtn", "folinkpick", "folinksearch", "folinkrow", "folinkcard"].forEach(k => {
    assert.ok(ui.indexOf('"' + k + '"') > 0, "界面里没有 " + k);
    assert.ok(ts.indexOf('["' + k + '"') > 0, "theme-studio 没登记 " + k);
  });
  // 名单：没收起来、论坛没关的角色＋熟面孔
  const c = helpers.forumAtCandidates([{ id: "c1", name: "沈屿白" }, { id: "c2", name: "陆闻", shelved: true }, { id: "c3", name: "江识" }, { id: "n1", name: "配角", npc: true }], ["c3"]);
  assert.deepEqual(c.map(x => x.key), ["c1", "npc_regular_moyu"]);
});

test("@ 的 id 存在记录上：发出去那一下按正文里还在的「@名字」认", () => {
  const c = [{ key: "a", label: "阿" }, { key: "ay", label: "阿远" }, { key: "m", label: "摸鱼办主任" }];
  assert.deepEqual(helpers.forumMentionIds("@阿远 你看看 @摸鱼办主任", c), ["m", "ay"]);
  assert.deepEqual(helpers.forumMentionIds("@阿远 你看", c), ["ay"], "「阿」不许吃掉「阿远」");
  assert.deepEqual(helpers.forumMentionIds("没点名", c), []);
  // 写存档的那三处（stub-from-the-writer）
  assert.match(cut(app, "const postMyForum = (", "const genForumSearch"), /mentions: mentions\.slice\(0, 12\)/);
  assert.match(cut(app, "const addForumFloor = (", "const addForumSubReply"), /content: text, \.\.\.\(Array\.isArray\(mentions\) && mentions\.length \? \{ mentions: mentions\.slice\(0, 12\) \}/);
  assert.match(cut(app, "const addForumSubReply = (", "const forumPmKnow"), /mentions: mentions\.slice\(0, 12\)/);
  // 界面把认出来的 id 递过去
  assert.match(ui, /cbMore\.map\(photoAttachValue\)\.filter\(Boolean\), forumMentionIds\(cbBody, atCands\)\)/);
  assert.match(ui, /const ments = forumMentionIds\(rTxt, atCands\)/);
});

test("被 @ 的角色下一波一定来、知道自己被点了名；回过了就不再欠", () => {
  const due = new Function("forumActiveChars", "forumInWorld", "FORUM_NPC_REGISTRY",
    cut(app, "  const forumMentionsDue = ", "  const forumMyCrowdRule = ") + ";return { forumMentionsDue, forumMentionRule };")(
    () => [{ id: "c1", name: "沈屿白" }, { id: "c2", name: "陆闻" }], () => true, [{ id: "npc_regular_moyu", name: "摸鱼办主任" }]);
  // 桩照写入方：postMyForum 的 rec、addForumFloor 的 floor、模型那几路写的楼（authorId＝角色 id，ts／visibleAt）
  const post = { id: "fp_me_1", authorType: "me", authorName: "小鱼", mentions: ["c1", "npc_regular_moyu"], ts: 1000, triggerSource: "我发帖" };
  let list = due.forumMentionsDue(post, []);
  assert.deepEqual(list.map(x => x.id), ["c1", "npc_regular_moyu"]);
  const rule = due.forumMentionRule(list);
  assert.match(rule, /「沈屿白」：「小鱼」在帖子正文里 @ 了你，你知道自己被点了名；这一轮你一定来回一条（char 填「沈屿白」）/);
  assert.match(rule, /常驻熟面孔「摸鱼办主任」：「小鱼」在帖子正文里 @ 了你；这一轮你一定来回一条（npcId 填 npc_regular_moyu）/);
  // 沈屿白来过了：只剩熟面孔还欠着
  list = due.forumMentionsDue(post, [{ id: "f1", floor: 2, authorType: "character", authorId: "c1", authorName: "沈屿白", content: "来了", ts: 2000, replies: [] }]);
  assert.deepEqual(list.map(x => x.id), ["npc_regular_moyu"]);
  // 她楼里 @ 的也算；刚发出去还没进楼的那条走 extra
  list = due.forumMentionsDue({ id: "p2", authorType: "npc", ts: 1 }, [{ id: "f2", floor: 3, authorType: "me", authorName: "小鱼", mentions: ["c2"], ts: 3000, replies: [] }], [{ ids: ["c1"], ts: 4000, where: "这一楼的楼中楼", who: "小鱼" }]);
  assert.deepEqual(list.map(x => x.id + "@" + x.where), ["c2@3楼", "c1@这一楼的楼中楼"]);
  assert.equal(due.forumMentionRule([]), "", "没人被点名就一个字都不加");
  // 拼进本来就有的几路生成：首轮刷楼、继续刷楼（发帖后那几波）、回她那一条
  const probe = cut(app, "const forumCommentProbe = ", "const FORUM_EMPTY_FLOOR");
  assert.match(probe, /opRule2Full = [^\n]*forumMentionRule\(forumMentionsDue\(post, floors\)\)/);
  assert.match(probe, /relBlock \+ forumMentionRule\(forumMentionsDue\(post, forumCommentsRef\.current\[post\.id\] \|\| \[\]\)\)/);
  assert.match(cut(app, "const genRepliesToMe = async (", "const postMyForum = ("), /"③ " \+ others \+ forumMentionRule\(forumMentionsDue\(post, /);
  assert.match(cut(app, "const forumMineTick", "const forumMineBumpSocial"), /\.slice\(0, 2 \+ forumMentionsDue\(post, existing\)\.length\)/, "点了名的人不被一波一两条截掉");
});

test("贴帖子：token 画成小卡；喂模型换成《标题》再挂一句它讲什么；帖子没了写已删除", () => {
  const posts = [{ id: "fp_a", title: "楼下新开的面馆", board: "日常吧", body: "汤头很浓".repeat(30) }];
  helpers.forumLinkSource(() => posts);
  const txt = "你们看这个 " + helpers.forumLinkToken("fp_a") + " 还有 " + helpers.forumLinkToken("fp_gone");
  assert.deepEqual(helpers.forumLinkIds(txt), ["fp_a", "fp_gone"]);
  const plain = helpers.forumLinkPlain(txt);
  assert.equal(plain, "你们看这个 《楼下新开的面馆》 还有 《帖子已删除》");
  assert.ok(!/\[\[post:/.test(plain));
  const notes = helpers.forumLinkNotes(txt);
  assert.match(notes, /〔贴了一个帖子《楼下新开的面馆》（日常吧）：汤头很浓/);
  assert.equal(notes.split("：")[1].replace("〕", "").length, 60, "正文只带开头 60 字");
  // 所有喂模型的正文和楼都过 forumWithPhoto：它先把 token 换掉
  const fw = new Function("forumLinkPlain", "forumLinkNotes", cut(scr, "function forumPhotoOf(", "const forumStamp") + ";return forumWithPhoto;")(helpers.forumLinkPlain, helpers.forumLinkNotes);
  const sent = fw(txt, {});
  assert.ok(!/\[\[post:/.test(sent) && /《楼下新开的面馆》/.test(sent) && /〔贴了一个帖子/.test(sent));
  assert.match(cut(app, "const addForumSubReply = (", "const forumPmKnow"), /genRepliesToMe\(post, floorId, forumWithPhoto\(text, null\)/, "楼中楼那句也换掉 token");
  // 转发、她的帖子进聊天上下文：也先换成标题
  assert.match(app, /forumWithPhoto\(forumLinkPlain\(post\.body\)\.replace/);
  assert.match(app, /body: forumLinkPlain\(post\.body\), authorName: post\.authorName/);
  // 界面：正文、楼、楼中楼都走 rich；小卡点了开帖，帖子没了灰着写「帖子已删除」
  const rich = cut(ui, "  const rich = (who, txt) => {", "  const insertLink = ");
  assert.match(rich, /if \(lm\) return linkToken\(lm\[1\], k\)/);
  assert.match(rich, /"data-wk": "fomention"/);
  const tok = cut(ui, "  const linkToken = (id, key) => {", "  const rich = ");
  assert.match(tok, /"data-gone": "1"[\s\S]*"帖子已删除"/);
  assert.match(tok, /linkCard\(lp, \(\) => openPost\(lp\), "folinkcard", key\)/);
  assert.match(ui, /rich\(cm, atClean\(cm\.content, cm\)\)/);
  assert.match(ui, /rich\(r, atClean\(r\.content, r\)\)/);
  assert.match(ui, /rich\(p, p\.body\)/);
  // 小卡在窄屏上不撑出横向滚动：标题省略号、整张卡 maxWidth 100%
  const card = cut(ui, "  const linkCard = (", "  const linkToken = ");
  assert.match(card, /maxWidth: "100%", minWidth: 0/);
  assert.match(card, /textOverflow: "ellipsis", whiteSpace: "nowrap"/);
});
