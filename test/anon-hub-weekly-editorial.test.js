const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const components = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const weekly = fs.readFileSync(path.join(root, "js/weekly.js"), "utf8");

test("匿名问答成为全局 app，旧档案沿用且聊天加号不再藏入口", () => {
  assert.match(components, /anon:\s*\{ kind: "app", zh: "匿名问答"/);
  assert.match(components, /function AnonHub\(/);
  assert.match(app, /screen === "anon"[\s\S]*h\(AnonHub/);
  assert.match(components, /function AnonBox\(/);
  const panel = components.match(/const PANEL = \[(.*?)\]\.filter/s)?.[1] || "";
  assert.doesNotMatch(panel, /"anon"/);
});

test("匿名问答遵守移动端安全区、单滚动容器与返回位置恢复", () => {
  const hub = components.slice(components.indexOf("function AnonHub"), components.indexOf("function AnonBox"));
  assert.match(hub, /paddingTop: "env\(safe-area-inset-top\)"/);
  assert.match(hub, /height: 62/);
  assert.match(hub, /flex-1 min-h-0 overflow-y-auto/);
  assert.match(hub, /x_anonHubScroll/);
  assert.match(hub, /onScroll:/);
  assert.match(hub, /paddingBottom: "calc\(env\(safe-area-inset-bottom\) \+ 20px\)"/);
});

test("周刊减去重复英文帽子、长稿加入金句并拉开标题层级", () => {
  assert.match(weekly, /function pullQuoteFor\(/);
  // ⚠️冻的是「长稿有金句」，不是「金句长什么样」。v60.01 起金句不再在段落底下
  //   单独印一遍（那是同一句话在同一屏出现两次），改成把正文里那一句【就地】放大加粗。
  //   撤掉的那个 blockquote 不许再回来。
  assert.ok(weekly.indexOf('h("blockquote"') < 0, "金句又回到「在下面单独重复一遍」了");
  assert.match(weekly, /const before = hit \? p\.slice\(0, hitIdx\) : p;/, "金句没有就地放大");
  assert.match(weekly, /fontSize: 30/);
  assert.match(weekly, /fontSize: 16/);
  assert.doesNotMatch(weekly, /SHORT READ/);
  assert.doesNotMatch(weekly, /FEATURE 0/);
  assert.match(weekly, /头条 · 01/);
});
