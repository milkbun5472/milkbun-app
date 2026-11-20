// 成员状态（她 2026-11-20「每个人的状态」「第二层我也想聊天里面能看到」）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), vm = require("vm");
const en = fs.readFileSync(__dirname + "/../js/engine.js", "utf8"), ap = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), cs = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const i = en.indexOf("const CHAR_STATUS_KEY"), j = en.indexOf("function chpHint(");
const ctx = {}; vm.createContext(ctx); vm.runInContext(en.slice(i, j) + ";this.p=presenceOf;this.can=charStatusCanSet;this.set=charStatusSet;this.hint=charStatusHint;", ctx);
test("在线状态：一小时内说过话＝在线并写在哪个频道；不然日程睡觉＝睡了，上班上课＝勿扰，其余＝离开", () => {
  const now = 10 * 3600000;
  assert.deepEqual([ctx.p(now - 600000, "深夜", { type: "sleep" }, now).k, ctx.p(now - 600000, "深夜", null, now).where], ["online", "深夜"]);
  assert.equal(ctx.p(now - 7200000, "", { type: "sleep" }, now).k, "sleep");
  assert.equal(ctx.p(0, "", { type: "work", title: "上班" }, now).k, "dnd");
  assert.equal(ctx.p(0, "", { type: "study" }, now).k, "dnd");
  assert.equal(ctx.p(0, "", { type: "meal" }, now).k, "idle");
});
test("状态一人一天最多换三回；一样的不算换", () => {
  let a = {};
  for (let k = 0; k < 3; k++) { assert.equal(ctx.can(a, "c1", "d1"), true); a = ctx.set(a, "c1", { text: "第" + k }, "d1", k + 1).all; }
  assert.equal(ctx.can(a, "c1", "d1"), false);
  assert.equal(ctx.can(a, "c1", "d2"), true);
  assert.equal(ctx.set(a, "c1", { text: "第2" }, "d2", 9).changed, false);
  assert.match(ctx.hint({ c1: { text: "别找我", emoji: "🎮" }, me: { text: "困" } }, [{ id: "c1", name: "顾朝" }], "她", true), /顾朝「🎮 别找我」；她「困」/);
  assert.doesNotMatch(ctx.hint({ me: { text: "困" } }, [], "她", false), /困/);
});
test("接线：回复里的 status 落盘并冒一行；提示带状态；旁观不提她；聊天名字旁带状态，树洞不带", () => {
  assert.match(ap, /charStatusCanSet\(_sAll, spk\.id, _dk\)/);
  assert.match(ap, /把状态改成了「/);
  assert.match(ap, /charStatusHint\(_all, group\.chKind === "treehole" \? \[\] : members, userName\(profile\), !groupSpectating\(group\)\)/);
  assert.match(ap, /gPlayHint \+ gStatusHint \+/);
  assert.match(cs, /m\.senderName, gRoleTag\(m\), gStatusTag\(m\)\)/);
  assert.match(cs, /group\.chKind !== "treehole" && typeof CHAR_STATUS_KEY/);
  assert.match(cs, /function SpaceMembersPage\(/);
  assert.match(ap, /const spacePresence = spId =>/);
});
