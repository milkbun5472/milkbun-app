// AI 配衣服挂进现有分类，分类满了也不拒收（2026-10-31）
const test = require("node:test"), assert = require("node:assert");
const s = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
test("提示词带上现有分类，叫它照抄", () => {
  assert.match(s, /【柜子里现有的分类】/);
});
test("分类满了挂进最空的那一格", () => {
  const a = s.indexOf("const myClosetPut = "), body = s.slice(a, a + 1600);
  const MYCLOSET_MAX_OCC = 2, MYCLOSET_MAX_SETS = 3;
  const put = new Function("MYCLOSET_MAX_OCC", "MYCLOSET_MAX_SETS", "return " + body.slice(body.indexOf("(box, occ, set) =>"), body.indexOf("\n  };") + 4).replace(/;\s*$/, ""))(MYCLOSET_MAX_OCC, MYCLOSET_MAX_SETS);
  const box = { closet: [{ occasion: "日常", sets: [{ name: "a" }, { name: "b" }] }, { occasion: "上班", sets: [{ name: "c" }] }] };
  const out = put(box, "约会", { name: "新的" });
  assert.equal(out.closet.length, 2);
  assert.equal(out.closet[1].sets[0].name, "新的");
});
