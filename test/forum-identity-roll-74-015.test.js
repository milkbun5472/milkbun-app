// 角色发帖的身份由代码掷，不由模型挑（她 2026-09-24：「论坛角色又很少开小号发帖了还有匿名也是」）。
const assert = require("assert");
const app = require("fs").readFileSync(__dirname + "/../js/app.js", "utf8");
const i = app.indexOf("const idRoll = Math.random()");
assert(i > 0);
const roll = app.slice(i, app.indexOf("\n", app.indexOf("const rolledId", i)));
const f = new Function("forumHabit", "Math", roll + "\nreturn rolledId;");
const count = bias => { const c = { main: 0, alt: 0, anonymous: 0 }; let x = 0;
  const M = { random: () => { x = (x * 9301 + 49297) % 233280; return x / 233280; } };
  for (let k = 0; k < 6000; k++) c[f({ identityBias: bias }, M)]++; return c; };
const c = count("main");
assert(c.alt / 6000 > 0.2 && c.anonymous / 6000 > 0.12, "小号和匿名都得有像样的份额：" + JSON.stringify(c));
assert(c.main / 6000 > 0.45, "大号仍是最多的");
assert(count("alt").alt > c.alt, "爱用小号的人小号更多");
assert(/identity: rolledId, photo: d\.photo \}, manual \? "手动发帖" : "auto"\)/.test(app), "落盘用掷出来的身份");
assert(!/十次里有七八次都该是 main/.test(app), "旧的一边倒说法撤了");
assert(/别全用大号/.test(app), "楼里冒泡也提一句");
console.log("forum-identity-roll ok");
