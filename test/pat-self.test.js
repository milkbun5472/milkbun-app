// 双击自己的头像拍拍自己（她 2026-11-04）：单聊带「他拍我时的后缀」，模型看到的是「拍了拍她自己」
const test = require("node:test");
const assert = require("node:assert/strict");
const R = f => require("fs").readFileSync(require("path").join(__dirname, "..", "js", f), "utf8");
const a = R("app.js"), c = R("components.js");
test("头像双击接到 onPatSelf", () => {
  assert.match(c, /h\("span", \{ onClick: meTap, "data-wk": "avatar"/);
  assert.match(c, /h\("span", \{ onClick: gMeTap, "data-wk": "avatar"/);
  assert.match(a, /onPatSelf: \(\) => patSelf\(activeChar\.id/);
  assert.match(a, /onPatSelf: \(\) => patGroupSelf\(activeGroup\.id\)/);
});
test("消息带 patSelf、后缀用 myPatSig，模型那边写成拍她自己", () => {
  assert.match(a, /kind: "pat", patSelf: true, content: "你拍了拍自己" \+ \(char\.myPatSig/);
  assert.match(a, /m\.kind === "pat" && m\.patSelf \? "【对方（之前）用微信「拍一拍」拍了拍【她自己】/);
  assert.match(a, /m\.kind === "pat" && m\.patSelf\n\s*\? "【" \+ userName\(profile\) \+ " 用「拍一拍」拍了拍自己/);
});
