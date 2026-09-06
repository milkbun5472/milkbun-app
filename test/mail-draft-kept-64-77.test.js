// 「什么叫已经存了9月3日」（她 2026-09-06）。
// 病根：savedAt 问的是【存了多久】（一段时长），可 phoneFreezeTime 会把
// 「存了三天」这种相对写法冻成绝对日期——冻是对的（放两周之后「存了三天」就是谎话），
// 错的是【冻完之后那句话没跟着变】：时长的句式套在日期上就成了病句。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const { phoneKeptLine } = require("../js/phone.js");
const ph = fs.readFileSync(__dirname + "/../js/phone.js", "utf8");
const D = 86400000;

test("冻过的行有 _ts，就现算天数", () => {
  const now = Date.now();
  assert.equal(phoneKeptLine({ savedAt: "9月3日", _ts: now - 3 * D }, now), "已经存了 3 天。");
  assert.equal(phoneKeptLine({ savedAt: "9月3日", _ts: now - 30 * D }, now), "已经存了 30 天。");
  // 当天存的别说「存了 0 天」
  assert.equal(phoneKeptLine({ savedAt: "刚刚", _ts: now - 1000 }, now), "今天存下的，还没发。");
});

test("没有 _ts 时按 savedAt 长什么样挑句式", () => {
  const now = Date.now();
  // 她抓到的那一句：日期就得用日期的说法
  assert.equal(phoneKeptLine({ savedAt: "9月3日" }, now), "9月3日写下的，一直没发。");
  assert.equal(phoneKeptLine({ savedAt: "2025年3月1日" }, now), "2025年3月1日写下的，一直没发。");
  // 模型自己带了「存了」就别拼成「已经存了存了三天」
  assert.equal(phoneKeptLine({ savedAt: "存了三天" }, now), "已经存了三天。");
  assert.equal(phoneKeptLine({ savedAt: "放了两周" }, now), "已经放了两周。");
  assert.equal(phoneKeptLine({ savedAt: "三天" }, now), "已经存了三天。");
  assert.equal(phoneKeptLine({ savedAt: "11 天" }, now), "已经存了 11 天。");
  // 什么都没有就一个字都别说
  assert.equal(phoneKeptLine({}, now), "");
  assert.equal(phoneKeptLine(null, now), "");
});

test("界面上走的是这一支，不是自己拼字符串", () => {
  assert.match(ph, /"这封一直没发出去。" \+ phoneKeptLine\(open, Date\.now\(\)\)/, "邮件那句没换过来");
  assert.equal((ph.match(/"已经存了 " \+ S\(open\.savedAt\)/g) || []).length, 0, "老那句还在");
});

test("冻时间那一层没动——它是对的", () => {
  // 「存了三天」放两周之后就是谎话，所以该冻。错的从来不是它
  assert.match(ph, /存了\|放了\|开了\|过了/, "冻时间认的那几个词变了");
  assert.match(ph, /const PHONE_TIME_FIELDS = \["time", "date", "savedAt", "lastAt"\];/, "savedAt 被踢出冻结名单了——那它放久了会说谎");
});
