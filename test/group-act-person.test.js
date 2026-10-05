const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const eng = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");

// 她 2026-10-05：「群里不能改动描人称」
function loadGroupActText(settings, profile) {
  const i = eng.indexOf("const ACT_PAIR ="), j = eng.indexOf("if (typeof window !== \"undefined\") window.ActLine", i);
  assert.ok(i > 0 && j > i, "抠不出 actLineAs");
  const a = comp.indexOf("const groupActText = m => {"), b = comp.indexOf("\n  };", a);
  assert.ok(a > 0 && b > a, "抠不出 groupActText");
  return new Function("settings", "profile", "window",
    eng.slice(i, j) + "\nwindow.ActLine = { as: actLineAs };\n" + comp.slice(a, b + 5) + "\nreturn groupActText;")(settings, profile, {});
}

test("默认：名字 + 原句，她换成你", () => {
  const f = loadGroupActText({}, { name: "Lisa" });
  assert.equal(f({ senderName: "沈清和", content: "我把伞递给她" }), "沈清和 我把伞递给你");
});

test("选名字：我换成名字，前面不再挂一次", () => {
  const f = loadGroupActText({ actPerson: "name", userPerson: "ta" }, { name: "Lisa" });
  assert.equal(f({ senderName: "沈清和", content: "我把伞递给你" }), "沈清和把伞递给她");
});

test("群设置里有两颗旋钮并存下来", () => {
  assert.match(comp, /actDesc: gActDesc, actPerson: gActPerson, userPerson: gUserPerson,/);
  assert.match(comp, /m\.who === "char" \? groupActText\(m\)/);
});
