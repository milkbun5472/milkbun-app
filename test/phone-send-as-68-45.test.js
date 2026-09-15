// 她 2026-09-14：「查手机他的真实聊天……能不能做我可以真实通过他的手机给这些群发消息
// 然后收到另一边的回复并且能存在真的聊天记录里面」，紧接着划了范围：
// 「不不不那些生成出来的聊天记录不动，只动那些真的我创建的旁观群或者有他的群聊，
//   这些在我的聊天里都已经有记录了」。
// 所以这一份钉的就是那条界线：能写的只有 actual:* 那几条，推演出来的一个字都不许动。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const phone = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");

test("落盘那一头：只认 actual: 开头的会话", () => {
  assert.match(app, /const phoneSendAs = \(char, session, text\) => \{/);
  // 推演出来的会话没有 actual: 这个前缀，这一句就是那道闸
  assert.match(app, /if \(!char \|\| !body \|\| id\.indexOf\("actual:"\) !== 0\) return false;/);
});

test("两条路都不另开写入口", () => {
  // 私聊：走「看他玩」发给她那条现成的路（施工规则/one-public-mechanism.md）
  assert.match(app, /if \(id === "actual:private:" \+ char\.id\) \{\s*\n\s*watchSend\(char, "wechat", userName\(profile\), body, \{ byUser: true \}\);/);
  // 群：落进 x_gchat 之后让群回复那条链自己去挑谁接话
  assert.match(app, /pGChat\(gid, p => \[\.\.\.p, \{\s*\n\s*role: "assistant", senderId: char\.id, senderName: char\.name, content: body,/);
  assert.match(app, /Promise\.resolve\(\)\.then\(\(\) => replyGroup\(gid\)\)/);
});

test("他不在这个群里就不能以他的名义说话", () => {
  assert.match(app, /if \(!group \|\| !\(group\.memberIds \|\| \[\]\)\.includes\(char\.id\)\) return false;/);
});

test("这一条留得下记号：是她替他发的", () => {
  assert.match(app, /\.\.\.\(extra && extra\.byUser \? \{ byUser: true \} : \{\}\)/);
  assert.match(app, /ts: Date\.now\(\), byUser: true/);
});

test("界面那一头：输入栏只画在真实会话上，且看他玩时收起来", () => {
  assert.match(phone, /const asCanSend = !!\(onSendAs && th && String\(th\.id \|\| ""\)\.indexOf\("actual:"\) === 0/);
  assert.match(phone, /!drive && asCanSend \? h\("div"/);
  // 「按了没反应的按钮比没有按钮更糟」：推演会话那儿一栏都不画
  assert.match(phone, /推演出来的会话给不了真回复，所以那儿一栏都不画/);
});

test("发完要滚到底，不然等于没发", () => {
  assert.match(phone, /const asSend = \(\) => \{/);
  assert.match(phone, /setAsDraft\(""\);[\s\S]{0,180}threadRef\.current\.scrollTop = threadRef\.current\.scrollHeight/);
});

test("这条口子一路递得到微信那一屏", () => {
  assert.match(app, /onSendAs: phoneSendAs,/);
  assert.match(phone, /onSendAs: \(sess, text\) => onSendAs \? onSendAs\(char, sess, text\) : false,/);
  assert.match(phone, /h\(WeChatViewFull, \{[^\n]*onSendAs: ctx\.onSendAs,/);
});

// ── 真跑一遍那一屏（v67.04 白屏那次的教训：正则断言拦不住 ReferenceError）──
const { loadPhone } = require("./helpers/phone-render.js");
const t = { ink: "#111", bg: "#fff", bg2: "#eee", line: "#ddd", fog: "#999", sub: "#555", tint: "#c90", accent: "#c90" };
const charFix = { id: "c1", name: "沈屿白" };
const profFix = { name: "Lisa" };
// useState 的顺序：0 tab / 1 thread / 2 asDraft / 3 publicPage / 4 article
const openThread = (sess, props) => loadPhone({ 1: sess }).WeChatViewFull({
  d: { chats: [], actualChats: [sess] }, char: charFix, t, profile: profFix,
  onBack() {}, onRefresh() {}, refreshing: false, drive: null, ...(props || {})
});
const flat = node => {
  const out = [];
  (function walk(n) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(walk);
    out.push(n);
    walk(n.kids); walk(n.props && n.props.children);
  })(node);
  return out;
};
// ⚠️认的是【真能按的那颗】：看他玩里TA那条演出用的「发送」是个死 div，没有 onClick
const sendBtn = node => flat(node).find(n => n.type === "button" && n.props && n.props.onClick && n.kids && n.kids.indexOf("发送") >= 0);

test("真实会话的那一屏跑得起来，而且有她的发送键", () => {
  const sess = { id: "actual:group:g_1", type: "group", name: "水榭", messages: [{ from: "沈屿白", text: "在", ts: 1 }] };
  let node;
  assert.doesNotThrow(() => { node = openThread(sess, { onSendAs: () => true }); }, "真实会话那一屏炸了");
  assert.ok(sendBtn(node), "真实会话上没有发送键");
});

test("推演出来的会话没有这条口子", () => {
  const sess = { type: "private", name: "老张", messages: [{ from: "老张", text: "在吗", ts: 1 }] };
  const node = openThread(sess, { onSendAs: () => true });
  assert.equal(sendBtn(node), undefined, "推演会话上不该有发送键");
});

test("没有 onSendAs 时也不炸，只是没有那一栏", () => {
  const sess = { id: "actual:private:c1", type: "private", name: "Lisa", messages: [] };
  let node;
  assert.doesNotThrow(() => { node = openThread(sess); });
  assert.equal(sendBtn(node), undefined);
});

test("看他玩开着的时候她那一栏收起来", () => {
  const sess = { id: "actual:private:c1", type: "private", name: "Lisa", messages: [] };
  const node = openThread(sess, { onSendAs: () => true, drive: { tab: "chats", item: "Lisa", typing: "在" } });
  assert.equal(sendBtn(node), undefined, "看他玩里不该出现她自己的输入栏");
});

// ── v68.46：他得知道这不是他发的；等回话时要有三个点 ──────────────────
test("她替他发的那一条，模型看见的是「这不是你打的」", () => {
  const engine = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
  // 只写在一处，三条载体共用
  assert.match(engine, /const bySomeoneElseMark = \(uName, who\) =>/);
  assert.equal((engine.match(/const bySomeoneElseMark = /g) || []).length, 1);
  // 给出口不给判决（施工规则/bans-make-it-dumber）：认／戳穿／将错就错都成立
  assert.match(engine, /没有标准答案，也不必每次都提/);
  // ① 单聊线上 ② 群聊那一行 ③ recentChat（线下/通话/穿书/匿名箱/解梦馆都从这儿拿）
  assert.match(app, /const byU = m\.byUser \? bySomeoneElseMark\(uName, char\.name\) : "";/);
  assert.match(app, /const ac = stp \+ byU \+/);
  assert.match(app, /const groupHistLine = m => \(m\.byUser \? bySomeoneElseMark\(userName\(profile\), m\.senderName \|\| "TA"\) : ""\)/);
  assert.match(app, /\+ \(m\.byUser \? bySomeoneElseMark\(uName, m\.senderName \|\| char\.name\) : ""\);/);
});

test("等对面回话的时候，末尾挂三个点", () => {
  assert.match(app, /const \[phoneAsWait, setPhoneAsWait\] = useState\(""\);/);
  assert.match(app, /setPhoneAsWait\(id\);/);
  // 跑完就灭，而且只灭自己那一条（她中途换了会话不该被抹掉）
  assert.match(app, /const done = \(\) => setPhoneAsWait\(w => \(w === id \? "" : w\)\);/);
  // 成败都要灭：失败了还转着圈比不转更糟
  assert.match(app, /\.then\(\(\) => replyGroup\(gid\)\)\.then\(done, done\);/);
  assert.match(app, /sendAsWaiting: phoneAsWait,/);
  // 那三个点是公共的那一颗（施工规则/one-public-mechanism）
  const comps = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
  assert.match(comps, /function TypingDots\(\{ color, size, gap \}\)/);
  // 原来全库散着六份（Spinner、通话「正在说」、两处 sending、群聊、主聊天）——
  // 抽公共的时候已有的那几处也一起搬了（施工规则/one-public-mechanism）
  assert.equal((comps.match(/rounded-full animate-pulse/g) || []).length, 1, "三个点只该有一份");
  assert.equal((fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8").match(/rounded-full animate-pulse/g) || []).length, 0);
  assert.match(phone, /h\(TypingDots, \{ color: "#9a9a9a" \}\)/);
  // 新气泡要滚得到（她 2026-09-10 报过的老毛病）
  assert.match(phone, /\}, \[driveCount, driveChat, actualCount, sendAsWaiting\]\);/);
});

test("私聊那一条不挂三个点：她自己的回话由她自己说", () => {
  const sess = { id: "actual:private:c1", type: "private", name: "Lisa", messages: [] };
  const node = openThread(sess, { onSendAs: () => true, sendAsWaiting: "actual:group:g_1" });
  assert.equal(flat(node).find(n => n.props && n.props["aria-label"] === "对面正在回复"), undefined);
});

test("群里那一枪跑着的时候，那一屏真的画得出三个点", () => {
  const sess = { id: "actual:group:g_1", type: "group", name: "水榭", messages: [{ from: "沈屿白", text: "在", ts: 1 }] };
  let node;
  assert.doesNotThrow(() => { node = openThread(sess, { onSendAs: () => true, sendAsWaiting: "actual:group:g_1" }); });
  assert.ok(flat(node).find(n => n.props && n.props["aria-label"] === "对面正在回复"), "没画出三个点");
});
