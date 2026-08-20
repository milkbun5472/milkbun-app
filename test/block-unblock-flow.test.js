const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const components = fs.readFileSync(path.join(root, "js/components.js"), "utf8");

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
  assert.match(app, /if \(!tail\.length\) userContent \+= "\\n\\n【重要·别演成被冷落】/);
  const seg = app.slice(app.indexOf("【重要·别演成被冷落】"), app.indexOf("【重要·别演成被冷落】") + 900);
  assert.match(seg, /【不是】不理你们、不是已读不回、不是在生气/);
  assert.match(seg, /怎么不说话/, "要点名禁掉这几句口头禅");
  assert.match(seg, /是不是不理我了/);
  assert.match(seg, /这一轮就当 TA 不在场/, "得给出替代演法，不能只禁不给");
});

test("拉黑时要把原因和时刻存下来，判定才有尺子", () => {
  assert.match(app, /setBlockFor\(charId, \{ theyBlocked: true, reason: String\(parsed\.blockreason \|\| ""\)\.trim\(\), blockedTs: Date\.now\(\), tries: 0 \}\)/);
});

test("解除判定要拿到证据：原因、隔了多久、第几次、之前说过什么", () => {
  const seg = app.slice(app.indexOf("const sendMyUnblockReq"), app.indexOf("const clearChat"));
  assert.match(seg, /const tries = Number\(bk\.tries \|\| 0\) \+ 1;/);
  assert.match(seg, /const pastPleas =/);
  assert.match(seg, /m\.kind === "unblock_req" && m\.from === "me" && m\.plea/);
  assert.match(seg, /const hoursSince =/);
  assert.match(seg, /【你当初为什么拉黑】/);
  assert.match(seg, /【这是 TA 第 " \+ tries \+ " 次来求你】/);
  // 被拒也要记次数，否则永远停在第一次
  assert.match(seg, /setBlockFor\(charId, \{ tries: tries \}\); toast\("TA 拒绝了/);
});

test("判定标准：按性格、看有没有说到点子上，但明确不许太难", () => {
  const seg = app.slice(app.indexOf("const sendMyUnblockReq"), app.indexOf("const clearChat"));
  assert.match(seg, /按【你自己的性格】决定接不接受/);
  assert.match(seg, /有没有真的碰到【你当初生气的那件事】/);
  assert.match(seg, /和上几次几乎一样地再说一遍，不该管用/);
  assert.match(seg, /【松紧】这不是闯关，别为难 TA/, "她要的是有分量，不是难");
  assert.match(seg, /求到第三次以上、时间也过去挺久了/, "得有个会松动的出口，别拖死");
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
