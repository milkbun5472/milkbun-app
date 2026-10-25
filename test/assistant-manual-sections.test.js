// 秋秋读攻略：特别长的条目只给跟这句沾边的那几小节（她 2026-10-25「你改进一下吧」）
//   原来小世界三万多字，一沾边整条塞进去，挤掉别的条目；切成一句一句又会丢前因后果，所以按小节切。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

function load() {
  const g = {}; new Function("window", R("js/assistant-manual.js"))(g);
  const a = R("js/assistant.js");
  const memG = a.slice(a.indexOf("const memGrams = "), a.indexOf("\n", a.indexOf("const memGrams = ")));
  const seg = a.slice(a.indexOf("const SECTION_FROM"), a.indexOf("  // ── 更新日志"));
  return { M: g.AssistantManual, sectionText: new Function(memG + "\n" + seg + "\nreturn sectionText;")() };
}

test("长条目挑对小节：问绒绒小镇的猫，给的是小镇照料那节；问转账卡美化，给的是主题工作台的挂点那节", () => {
  const { M, sectionText } = load();
  const fg = sectionText(M, M.byId("fairyGarden"), "绒绒小镇的猫怎么喂");
  assert.ok(fg.length < M.textOf(M.byId("fairyGarden")).length / 4, "没瘦下来");
  assert.match(fg, /添粮/, "该给的照料那节没给");
  assert.match(fg, /其余小节：[\s\S]*要用就 lookup「fairyGarden」/, "剩下的小节名字和翻法没报");
  // 美化挂点都收进了主题工作台那一条（她 2026-10-26）
  const ch = sectionText(M, M.byId("theme"), "转账卡怎么美化");
  assert.match(ch, /挂点/);
  assert.match(ch, /transfercard/);
});

test("短条目、点名翻的照旧给全文；问句虚词不算沾边", () => {
  const { M, sectionText } = load();
  const short = M.entries.find(e => M.textOf(e).length < 3000);
  assert.equal(sectionText(M, short, "随便问点什么"), M.textOf(short));
  const a = R("js/assistant.js");
  assert.match(a, /const tx = asked \? M\.textOf\(x\) : sectionText\(M, x, question\);/, "lookup 点名要的那条不该被切");
  assert.match(a, /replace\(\/为什么\|怎么办\|怎么\|什么\|/);
});
