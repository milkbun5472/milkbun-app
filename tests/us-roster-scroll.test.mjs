import { test } from "node:test"; import assert from "node:assert/strict"; import { readFileSync } from "node:fs";
const r = f => readFileSync(new URL("../js/" + f, import.meta.url), "utf8");
// 「点进去再出来停在原处」只有 core.js 的 keepScroll 一份；这些页原来各自手写过一份，都换成它了
const USES = {
  "screens.js": ['keepScroll("us:roster")', 'keepScroll("us:" + partner.id, bodyRef)'],
  "screens-ui.js": ['keepScroll("forum:feed", feedScrollRef)', 'keepScroll("takeout:list", listRef)'],
  "nest.js": ['keepScroll("nest:wall", listRef)'],
  "tarot.js": ['keepScroll("tarot:home", homeScrollRef)'],
  "pomodoro.js": ['keepScroll("pomo:setup")', 'keepScroll("pomo:archive:" + archWho)'],
  "video-api.js": ['keepScroll("vidimg:" + character.id, scroller)'],
  "weekly.js": ['keepScroll("weekly:shelf", scrollRef)'],
  "study.js": ['keepScroll("study:home:" + tab, homeScrollRef)', 'keepScroll("study:console:" + (cur && cur.id), consoleScrollRef)'],
};
test("这些页都接公共的 keepScroll", () => {
  for (const [f, list] of Object.entries(USES)) { const s = r(f); for (const k of list) assert.ok(s.includes(k), f + " 没接 " + k); }
});
test("手写的那几份记位置都拆掉了，没有第二份", () => {
  const old = /subScrollRef|rosterScrollRef|feedScrollTopRef|listTop\b|scrollAt\b|homeScrollTop\b|homeScrollTopRef|consoleScrollTopRef|archScroll\b|setupScroll\b|savedScroll\b|Shelf\.scrollTop/;
  for (const f of Object.keys(USES).concat(["phone-ui.js"])) assert.doesNotMatch(r(f), old, f);
  assert.doesNotMatch(r("phone-ui.js"), /savedScrollRef/);
});
