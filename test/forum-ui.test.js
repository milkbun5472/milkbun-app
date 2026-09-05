const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadPhone, LIVE } = require("./helpers/phone-render.js");

const screens = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
const phone = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");
const forum = screens.slice(screens.indexOf("function Forum({"), screens.indexOf("function CoupleQALog("));

test("主论坛有自己的社区纸张主题，不再是通用白底列表", () => {
  assert.match(screens, /const FORUM_SKIN = \{/);
  assert.match(screens, /const FORUM_BOARD_SKIN = \{/);
  assert.match(forum, /background: FORUM_SKIN\.bg/);
  assert.match(forum, /borderLeft: "3px solid " \+ bs\[0\]/);
  assert.match(forum, /NEIGHBORHOOD BOARD/);
  assert.match(forum, /公告栏上剪角、钉住的分类纸签/);
  assert.match(forum, /时间线像公告栏上三张钉着的排序便笺/);
  assert.match(forum, /minHeight: 44/, "排序便笺的点击高度不够");
});

test("主论坛顶栏、底栏和详情返回遵守移动端布局铁律", () => {
  assert.match(forum, /paddingTop: safeTop\(10\)/, "顶栏没吃安全区");
  assert.match(forum, /gridTemplateColumns: "72px 1fr 72px"/, "标题没有真正居中");
  assert.match(forum, /paddingBottom: COMPOSER_PAD_BOTTOM/, "底栏没跟主聊天输入栏用同一把尺");
  assert.match(forum, /ref: feedScrollRef, className: "flex-1 min-h-0 overflow-y-auto"/, "主页没有唯一主滚动容器");
  assert.match(forum, /feedScrollTopRef\.current = feedScrollRef\.current\.scrollTop/);
  assert.match(forum, /feedScrollRef\.current\.scrollTop = feedScrollTopRef\.current/, "帖子返回后没恢复列表位置");
});

test("查手机论坛是全屏三身份主题页，并且能真渲染", () => {
  assert.match(phone, /const FULL_BLEED_KEYS = \[[^\]]*"forum"[^\]]*\]/);
  assert.match(phone, /const PHONE_FORUM_SKINS = \{[\s\S]*?main:[\s\S]*?alt:[\s\S]*?anon:/);
  assert.match(phone, /if \(key === "forum"\) return h\(PhoneForumView, \{/);
  assert.match(phone, /paddingTop: safeTop\(10\)/);
  assert.match(phone, /className: "flex-1 min-h-0 overflow-y-auto px-4"/);
  assert.match(phone, /三个账号是三副身份面具/);
  assert.match(phone, /minHeight: active \? 58 : 50/, "身份面具的点击高度不够");
  assert.match(phone, /borderRadius: "50% 50% 42% 42% \/ 72% 72% 38% 38%"/);

  const P = loadPhone();
  P.resetStateIdx();
  const tree = P.PhoneForumView({ accounts: LIVE.forumAccounts, char: { id: "c1", name: "沈屿白" }, onBack() {}, onPeek() {}, tab: "main", onTab() {} });
  const text = JSON.stringify(tree);
  // v62.73 no-english-titles：THREE IDENTITIES → 「同一个人的三副面孔」
  assert.match(text, /"同一个人的三副面孔"/);
  assert.match(text, /公开身份/);
  assert.match(text, /沈屿白/);
  assert.match(text, /今天/);
});

test("查手机论坛帖子详情退回时恢复账号列表位置", () => {
  const P = loadPhone({ 0: { kind: "post", item: LIVE.forumAccounts[0].posts[0] } });
  P.resetStateIdx();
  const tree = P.PhoneForumView({ accounts: LIVE.forumAccounts, char: { id: "c1", name: "沈屿白" }, onBack() {}, onPeek() {}, tab: "main", onTab() {} });
  const text = JSON.stringify(tree);
  assert.match(text, /转发给 TA/);
  assert.match(phone, /savedScrollRef\.current = scrollRef\.current \? scrollRef\.current\.scrollTop : 0/);
  assert.match(phone, /scrollRef\.current\.scrollTop = savedScrollRef\.current/);
});
