// 她 2026-09-14：「角色发朋友圈是原名，我回复后他们回复显示的是备注名，
// 能不能统一显示备注名」。
//
// 病根：点赞和评论存的是【一个名字字符串】，而那个字符串有三条来路——
// 模型报回来的（原名）、兜底那一条（备注名）、代码直接写的 char.name（原名）。
// 三条各写各的，于是同一个人在同一张卡上有两种叫法。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");

// 真跑显示那一份
const disp = (() => {
  const i = comp.indexOf("function momentDisplayName(characters, who) {");
  const j = comp.indexOf("function MomentsFeed({");
  assert.ok(i > 0 && j > i, "抠不出那个函数");
  return new Function(comp.slice(i, j) + "\nreturn momentDisplayName;")();
})();
const CHARS = [{ id: "c1", name: "沈屿白", remark: "白白" }, { id: "c2", name: "裴照川" }];

test("认得出是谁就用备注名", () => {
  assert.equal(disp(CHARS, "沈屿白"), "白白", "存的是原名，显示也该是备注名");
  assert.equal(disp(CHARS, "白白"), "白白", "存的已经是备注名，原样");
});

test("没设备注的照旧用本名", () => {
  assert.equal(disp(CHARS, "裴照川"), "裴照川");
});

test("认不出来的原样留着，别乱改名", () => {
  // 旁人、NPC、路人、模型现编的名字
  assert.equal(disp(CHARS, "楼下便利店老板"), "楼下便利店老板");
  assert.equal(disp(CHARS, ""), "");
  assert.equal(disp(CHARS, null), "");
  assert.equal(disp(null, "谁"), "谁");
});

test("写入那一头也收成一处：三条来路都过同一个函数", () => {
  assert.match(app, /const momentWho = who => \{/);
  // 模型报回来的点赞/评论/回复
  assert.match(app, /\.filter\(r => r\.liked\)\.map\(r => momentWho\(r\.name\)\)/);
  assert.equal((app.match(/author: momentWho\(r\.name\)/g) || []).length, 2, "评论和回复两处");
  assert.match(app, /"回复 " \+ momentWho\(r\.replyTo\) \+ "："/, "「回复 XX」里那个名字也得跟着变");
  // 代码直接写的 char.name（聊天里顺手评论那一条）
  assert.match(app, /author: momentWho\(char\.name\), text: String\(parsed\.momentComment\)/);
  // 兜底那一赞
  assert.match(app, /if \(top\) likers\.push\(momentWho\(top\.name\)\);/);
  // 定向回复她的那几条
  assert.match(app, /author: momentWho\(r\.author\)/);
});

test("显示那一头也要认一次，不然老卡永远停在原名上", () => {
  assert.match(comp, /m\.likers\.map\(x => momentDisplayName\(characters, x\)\)\.join\("、"\)/);
  assert.equal((comp.match(/momentDisplayName\(characters, cm\.author\)/g) || []).length, 2, "信息流和个人页两处");
  assert.ok(!/\} \}, cm\.author\)/.test(comp), "还有一处在直接画存下来的那个字符串");
});
