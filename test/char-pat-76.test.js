// 群友 2026-10-25：「char 的拍一拍只能气泡吗」——他也能真拍她（单聊、群里），她能填「他拍我时的后缀」
const assert = require("node:assert/strict"), fs = require("fs");
const app = fs.readFileSync("js/app.js", "utf8"), cp = fs.readFileSync("js/components.js", "utf8");
assert.match(app, /"momentComment", "call", "laterPromise", "pat"/);
assert.match(app, /pat:true=用微信「拍一拍」戳她一下/);
assert.match(app, /if \(parsed\.pat === true \|\| parsed\.pat === "true"\) \{/);
assert.match(app, /content: _pn \+ " 拍了拍我" \+ \(_ps \? " " \+ _ps : ""\)/);
assert.match(app, /parsed\.pat = null; parsed\.patSig = null; parsed\.listenInvite = null;/, "不回她那一轮也不拍");
assert.match(app, /if \(m\.kind === "pat" && m\.role === "assistant"\) \{/, "他拍过她，历史里写成动作，不当成他说的话");
assert.match(app, /gCallField \+ gPatField \+ ""/);
assert.match(app, /const groupHistLine = m => m\.kind === "pat" && m\.role === "assistant"/);
assert.match(app, /myPatSig: String\(s\.myPatSig \|\| ""\)\.trim\(\)\.slice\(0, 20\)/);
assert.match(cp, /zh: characterText\(character, "他拍我时的后缀"\)/);
console.log("ok");
// 第二轮：他看得到两边的后缀、自己起签名、自己改后缀
assert.match(app, /"laterPromise", "pat", "patSig"\];/);
assert.match(app, /patSig:"新后缀"=把你自己的拍一拍后缀换掉/);
assert.match(app, /（屏幕上那一行：「" \+ String\(m\.content \|\| ""\)\.replace\(\/\^你拍了拍\\s\*\/, uName \+ " 拍了拍 "\)/);
assert.match(app, /kind: "patsig", patSig: _np/);
assert.match(app, /if \(m\.kind === "patsig"\) \{/);
assert.match(app, /onGenPatSig: async \(\) => \{/);
assert.match(cp, /"data-wk": "patsiggen"/);
assert.match(cp, /if \(m\.kind === "pat" \|\| m\.kind === "patsig"\) return h\("div", \{/);
console.log("ok2");
assert.match(cp, /"在聊天里双击他的头像就能拍他，群里双击成员头像也一样。"/); console.log("ok3");
