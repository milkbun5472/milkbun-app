const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const components = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const unblockStart = app.indexOf("const sendMyUnblockReq =");
const unblockEnd = app.indexOf("const clearChat =", unblockStart);
assert.ok(unblockStart >= 0 && unblockEnd > unblockStart, "解除申请函数边界缺失");
const unblock = app.slice(unblockStart, unblockEnd);

// 她 2026-08-20 报的四件事
test("群红包要有头像和发的人是谁", () => {
  // 注意：forumshare 在单聊和群聊里各有一处，得从红包那行【往后】切，别用全文 indexOf
  const at = components.indexOf('if (m.kind === "redpacket") return');
  const seg = components.slice(at, components.indexOf('if (m.kind === "forumshare")', at));
  assert.match(seg, /mAvatar\(memberById\(m\.senderId\)/, "非本人发的要有头像");
  assert.match(seg, /m\.senderName && h\("div"/, "上面要有名字");
  assert.match(seg, /m\.role === "user" && gsp\.showMyAvatar/, "自己发的按设置显示我的头像");
  assert.match(seg, /h\(RedPacketCard, \{ rp: m/, "卡片本身不动");
});

test("自发轮不许把「用户没说话」演成被冷落", () => {
  assert.match(app, /if \(!tail\.length\) userContent \+= "\\n\\n【重要·别演成被冷落，也别把 TA 从场面里挪走】/);
  const seg = app.slice(app.indexOf("【重要·别演成被冷落"), app.indexOf("【重要·别演成被冷落") + 1200);
  assert.match(seg, /【不是】不理你们、不是已读不回、不是在生气/);
  assert.match(seg, /怎么不说话/, "要点名禁掉这几句口头禅");
  assert.match(seg, /是不是不理我了/);
  // v66.48：替代演法还是要给，但不能再是「就当 TA 不在场」——她本来就在那个场面里，
  // 把她挪走，剩下的人只能另起一摊（她 2026-09-11 报的那次正是这样）。
  // 现在给的替代演法是【顺着上面那件事往下推】，禁的那几句一个没少。
  assert.ok(seg.indexOf("这一轮就当 TA 不在场") < 0, "那句话把她从场面里删掉了");
  assert.match(seg, /这一轮由你们几个把话往下推/, "只禁不给，他们会自己脑补一个演法");
});

test("拉黑时要把原因和时刻存下来，判定才有尺子", () => {
  assert.match(app, /setBlockFor\(chatKey, \{ theyBlocked: true, reason: String\(parsed\.blockreason \|\| ""\)\.trim\(\), blockedTs: Date\.now\(\), tries: 0 \}\)/);
});

test("解除判定要拿到证据：原因、隔了多久、第几次、之前说过什么", () => {
  const seg = unblock;
  assert.match(seg, /const tries = Number\(bk\.tries \|\| 0\) \+ 1;/);
  assert.match(seg, /const pastPleas =/);
  assert.match(seg, /m\.kind === "unblock_req" && m\.from === "me" && m\.plea/);
  assert.match(seg, /const hoursSince =/);
  assert.match(seg, /【你当初为什么拉黑】/);
  assert.match(seg, /【这是 TA 第 " \+ tries \+ " 次来求你】/);
  // 被拒也要记次数，否则永远停在第一次
  assert.match(seg, /setBlockFor\(chatKey, \{ tries: tries \}\); toast\("TA 拒绝了/);
});

test("判定标准：按性格、看有没有说到点子上，但明确不许太难", () => {
  const seg = unblock;
  assert.match(seg, /按【你自己的性格】决定接不接受/);
  assert.match(seg, /有没有真的碰到【你当初生气的那件事】/);
  assert.match(seg, /和上几次几乎一样地再说一遍，不该管用/);
  assert.match(seg, /【松紧】这不是闯关，别为难 TA/, "她要的是有分量，不是难");
  assert.match(seg, /求得越多、隔得越久，越该松/, "得有个会松动的出口，别拖死");
  // v74.503：光靠提示词松不动（群里有人求了 20 多次）——拒到第 6 次由代码定下「解」，怎么解还是他说
  assert.match(app, /const UNBLOCK_FLOOR_TRIES = 6;/);
  assert.match(seg, /const floor = tries >= UNBLOCK_FLOOR_TRIES;/);
  assert.match(seg, /const r = floor \? \{ \.\.\.r0, accept: true \} : r0;/, "地板得是代码的，不能又交回模型");
  assert.ok(!/除非当初那事真的很重/.test(seg), "那句「除非」就是死路的出口，删了别再加回来");
  assert.match(seg, /拒绝时要说清【你到底在意什么、想听到什么】/, "拒绝要给方向，不能让她瞎猜");
});

test("点感叹号打开写话框，不再直接把那条消息当申请发出去", () => {
  assert.match(components, /onClick: \(isU && bk\.theyBlocked\) \? \(\) => setUnblockDraft\(String\(m\.content \|\| ""\)\) : undefined/,
    "点击只是把它当草稿预填，发不发由她定");
  assert.doesNotMatch(components, /onSendUnblockReq\(m\.content\)/, "不许再一点就发");
  assert.match(components, /const \[unblockDraft, setUnblockDraft\] = useState\(null\)/);
  assert.match(components, /unblockDraft !== null && h\("div"/);
  assert.match(components, /setUnblockDraft\(null\); onSendUnblockReq\(txt\);/, "发出去之后要关掉框");
  assert.match(components, /if \(!txt\) return;/, "空的不许发");
  assert.match(components, /点消息旁的 ! 写一句话求 TA/, "横幅说明要跟着改");
});

// 她 2026-10-03 转群里那张：拉黑期间按「回复」，他一轮轮原地打转，OOC 立了准则也没用。
test("被拉黑那条链有进度：过了多久、已经说过的那几句摆给他，场景接着往下走", () => {
  const a = app.indexOf("const blockedReaction = async"), b = app.indexOf("const respondUnblockFromChar", a);
  const fn = app.slice(a, b);
  assert.match(fn, /m\.role === "assistant" && m\.blocked/, "拿的是他拉黑期间自己发的那几句");
  assert.match(fn, /saidWhileBlocked\.slice\(-6\)/);
  assert.match(fn, /不是刚被拉黑的那一刻/);
  assert.match(fn, /"\\n\\n【场景】用户把你拉黑了——你发的消息 Ta 暂时收不到，而你知道自己被拉黑了。" \+ progress/);
  assert.match(app, /setBlockFor\(chatKey, \{ iBlocked: true, blockedTs: Date\.now\(\) \}\)/, "她拉黑他也要记开始时间，不然算不出过了多久");
});

// 她 2026-10-03：「我拉黑他的时候能不能加一个我也可以说话的功能」
test("她拉黑他时自己也能说：打的字先落进聊天，他读到再接；她的话不挂红感叹号", () => {
  assert.match(app, /if \(b\.iBlocked\) \{\n\s*const extra = String\(extraText \|\| ""\)\.trim\(\);\n\s*if \(extra\) pushUser\(activeChar\.id, extra, blockChatKey\(activeChar\.id\)\);/);
  const a = app.indexOf("const blockedReaction = async"), b = app.indexOf("const respondUnblockFromChar", a);
  const fn = app.slice(a, b);
  assert.match(fn, /【她拉黑你之后，自己给你发来了】/);
  assert.match(fn, /\+ progress \+ herLine \+/);
  assert.match(app, /blocked: !!b\.theyBlocked,/, "她拉黑他时她发的话是送得到的");
});
