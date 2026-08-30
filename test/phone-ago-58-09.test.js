const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const phone = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const F = (() => {
  const a = phone.indexOf("const phoneNum = v => {");
  const b = phone.indexOf("// 新的并进旧的：新的在前");
  assert.ok(a > 0 && b > a, "抠不出时间那几个函数");
  return new Function(phone.slice(a, b) + "\nreturn { phoneAgo, phoneFreezeTime, phoneWhenTs };")();
})();
const DAY = 86400000;
// 存进去时是「1小时前」，agoDays 天之前存的
const stored = (txt, agoDays, now) => F.phoneFreezeTime({ author: "老张", time: txt, content: "x" }, now - agoDays * DAY);

// 她 2026-08-30：「我都没刷新过他就自己出来的」
test("相对时间按 _ts 现算，不刷新也会自己变老", () => {
  const now = new Date(2026, 7, 30, 14, 0, 0).getTime();
  assert.equal(F.phoneAgo(stored("1小时前", 0, now), now), "1小时前");
  assert.equal(F.phoneAgo(stored("1小时前", 1, now), now), "昨天", "昨天存的今天还写「1小时前」，看起来就像刚发生");
  assert.equal(F.phoneAgo(stored("1小时前", 5, now), now), "5天前");
  assert.match(F.phoneAgo(stored("1小时前", 40, now), now), /月\d+日/);
  // 刚存下来的那一分钟
  assert.equal(F.phoneAgo({ time: "刚刚", _ts: now - 5000 }, now), "刚刚");
  assert.equal(F.phoneAgo({ time: "x", _ts: now - 20 * 60000 }, now), "20分钟前");
});

test("认不出来的照原样，绝不瞎编", () => {
  const now = Date.now();
  // 老数据没有 _ts
  assert.equal(F.phoneAgo({ time: "1小时前" }, now), "1小时前");
  // 已经被冻成绝对日期的（_abs）不许再算
  assert.equal(F.phoneAgo({ time: "8月29日", _ts: now - 3 * DAY, _abs: 1 }, now), "8月29日");
  // 时间戳在未来：不猜
  assert.equal(F.phoneAgo({ time: "明天", _ts: now + DAY }, now), "明天");
  assert.equal(F.phoneAgo(null, now), "");
  assert.equal(F.phoneAgo({ content: "没有时间字段" }, now), "");
});

test("朋友圈那一栏真的用上了它", () => {
  assert.match(phone, /phoneAgo\(m\) \|\| m\.time \|\| ""/, "朋友圈还在直接显示存着的那句话");
  assert.doesNotMatch(phone, /marginTop: 7 \} \}, m\.time \|\| ""\)/, "旧写法还在");
});

test("会写手机数据的只有生成那两条路，没有别的东西在偷偷刷", () => {
  // 这条是她那个问题的底：既然只有这两处能写，那「自己变了」就只可能是它们跑了
  assert.equal((app.match(/saveJSON\("x_phone", n\);/g) || []).length, 1, "手机数据的写入口不止一个了");
  assert.equal((app.match(/savePhoneApp\(char\.id, key, d\);/g) || []).length, 2, "只该有 genPhoneApp 和 genPhoneAll 两个调用方");
  // 朋友圈是累积层：刷新是【并进去】不是整份重写，所以旧的还在、新的在上面
  assert.match(phone, /wechat: \{ chats: 14, moments: 14,/);
});
