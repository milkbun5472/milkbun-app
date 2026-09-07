// 她 2026-09-06：「那你现在去把文风台的页面分批弄好吧，要发链接的话，这个得弄好」。
//
// 判据还是那一句（施工规则/tabs-not-plain-pills.md）：
// **这一组东西原样搬到另一个 app 里还成立吗？成立就是写坏了。**
// 文风台现实里是【打样台】：台边搁着几块排好的版，中间一条排字槽，边上一排字盘。
// 原来这三处分别是：一排填色药丸、几张一模一样的圆角灰卡、一个「○ / ✓」复选框——
// 三样搬到任何 app 里都成立。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const SL = fs.readFileSync(path.resolve(__dirname, "..", "js/style-lab.js"), "utf8");

test("预设＝台边那几块版：压下去的那块上了墨，不是一颗填色药丸", () => {
  // ⚠️「一块版」只画在一处（plate），搭预设那一排和测试台「印哪几块」共用——
  //   各画一份的话改一处永远漏另一处（施工规则/one-public-mechanism.md）。
  const p = SL.slice(SL.indexOf("const plate = (o) =>"), SL.indexOf("// ---- 搭预设 ----"));
  assert.ok(p.length > 300, "抠不出那一块版");
  // 选中态同时变【底色、位置、版边、投影】，不只靠一个色差
  assert.match(p, /background: o\.on \? t\.bg2 : "rgba\(127,127,127,\.05\)"/);
  assert.match(p, /transform: o\.on \? "translateY\(1px\)" : "none"/, "压下去那一下没了");
  assert.match(p, /borderRadius: "3px 0 0 3px", background: o\.on \? \(o\.edge \|\| t\.accent\) : t\.line/, "版边那道墨没了");
  assert.match(p, /boxShadow: o\.on \? "inset 0 2px 6px -5px/, "压进台面的那层内影没了");
  assert.match(p, /minHeight: 44/, "整块版的可点区不够");
  assert.match(SL, /presets\.map\(p => plate\(\{ key: p\.id, on: p\.id === curId/, "预设那一排没用它");
  // 药丸那一套彻底删掉，不是留着不用（撤掉东西要删除）
  assert.ok(!/dash: \{ padding: "6px 12px", borderRadius: 999/.test(SL), "虚线药丸还留在那儿");
  assert.ok(!/style: S\.dash/.test(SL), "还有人在用虚线药丸");
});

test("家伙什跟版分开摆：不混在同一排里", () => {
  assert.match(SL, /borderTop: "1px dashed " \+ t\.line/, "工具那一行没跟版分开");
  assert.match(SL, /tool: \{ minHeight: 40, padding: "9px 12px", borderRadius: 6/, "家伙什长得跟版一样就分不开了");
  ["＋ 新建", "⇧ 导入文件", "粘贴模块包", "搬旧文风"].forEach(n =>
    assert.ok(SL.indexOf('["' + n + '"') >= 0, "少了一件家伙什：" + n));
});

test("已选＝一条排字槽：墨轨从头连到尾，号码印在轨上", () => {
  // ⚠️收尾找的是【那一段注释的标题】，不是「模块库」三个字——那三个字在文件前面
  //   的提示文案里就出现过（抠出来会是负数长度的空串，断言全部空转）。
  const g = SL.slice(SL.indexOf("已选 · 按这个顺序喂进去"), SL.indexOf("模块库＝字盘"));
  assert.ok(g.length > 500, "抠不出排字槽那一段");
  assert.match(g, /width: 26, flexShrink: 0, background: t\.ink, color: t\.bg2/, "轨不是连着的一条墨");
  assert.match(g, /borderTop: i \? "1px solid " \+ t\.line : "none"/, "字条之间还留着缝，那就不是卡在槽里");
  assert.ok(!/S\.card/.test(g), "还在用那张通用圆角灰卡（几张一模一样的卡片摞着，搬哪儿都成立）");
  // 方向感在槽底那一行，不在标题里——「越靠后越重」是有方向的事
  assert.match(g, /越往下，模型看得越重/);
  assert.match(g, /\(cur\.mods \|\| \[\]\)\.length > 1/, "只有一条时也画方向条，那是废话");
  // 空槽也要长得像槽（不是一张灰卡）
  assert.match(g, /槽是空的。下面按分类勾，勾上的会卡进这里。/);
  assert.match(g, /border: "1px dashed " \+ t\.line, borderRadius: 3/, "空槽里那个空位不见了");
  // 三颗操作键都要说得出自己是干嘛的
  ["往前挪一格", "往后挪一格", "从槽里取出来"].forEach(x => assert.ok(g.indexOf(x) >= 0, "少了 aria-label：" + x));
});

test("模块库＝字盘：拉开的那一格上墨，挑中的字条是实心墨块", () => {
  const c = SL.slice(SL.indexOf("模块库＝字盘"), SL.indexOf("// 手写 / 导入"));
  assert.ok(c.length > 500, "抠不出字盘那一段");
  assert.match(c, /background: open \? t\.accent : "transparent"/, "指槽拉开了不上墨，看不出开的是哪一格");
  assert.match(c, /borderRadius: open \? "6px 6px 0 0" : 6/, "拉开之后没跟底下那一格连成一体");
  assert.match(c, /borderBottom: open \? "none" : "1px solid "/, "中间还横着一道线，等于没连上");
  // 字条：上了墨＝实心块＋往右让开一道压痕
  assert.match(c, /background: on \? t\.ink : "transparent", border: "1px solid " \+ \(on \? t\.ink : t\.line\)/, "字面不是墨块");
  assert.match(c, /marginLeft: on \? 6 : 0/, "挑中的字条没让开那一道");
  assert.match(c, /boxShadow: on \? "inset 3px 0 0 " \+ t\.ink : "none"/, "压痕没了");
  // 通用复选框那一套删掉
  assert.ok(!/on \? "✓" : "○"/.test(SL), "还在用「○ / ✓」——那是任何 app 都能用的复选框");
  assert.match(c, /minHeight: 44/, "字条的可点区不够");
});

test("点得着：这一页自己的按钮不许低于 40（padding 算进去）", () => {
  assert.match(SL, /tapIcon: color => \(\{ minWidth: 40, minHeight: 40/);
  // v65.11：药丸那一套（S.chip）也删干净了——测试台那三处各自长成了自己的东西
  assert.ok(!/chip: on =>/.test(SL), "通用药丸还留在那儿");
  assert.ok(!/S\.chip/.test(SL), "还有人在用通用药丸");
});
