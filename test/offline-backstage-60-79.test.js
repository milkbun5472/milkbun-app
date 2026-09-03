const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const codeOnly = comp.split("\n").filter(l => !l.trim().startsWith("//")).join("\n");
const slice = (a, b) => { const i = comp.indexOf(a); assert.ok(i > 0, "抠不出：" + a); const j = comp.indexOf(b, i); assert.ok(j > i); return comp.slice(i, j); };
const offline = slice("function OfflineMode(", "function OffCard(");
const goffline = slice("function GroupOfflineMode(", "\nfunction GroupThread(");

// 她 2026-09-03：「ooc 在这下面有点拥挤了，把它放到加号里吧，
// 现在加号是写导演拍刚好 ooc 放那边」——导演便签和出戏说本来就是同一类事。

test("OOC 从输入栏搬进「幕后」，两处线下都搬", () => {
  [["单人线下", offline], ["群线下", goffline]].forEach(([zh, seg]) => {
    assert.equal(seg.split("\n").filter(l => !l.trim().startsWith("//")).join("\n").indexOf('} }, "OOC"),'), -1, zh + "：输入栏里还挂着 OOC 那颗药丸");
    assert.match(seg, /noteOpen && sheet\("幕后 · 只有你和模型看得见"/, zh + "：那张单子还叫「临时导演」");
    assert.match(seg, /h\(Eyebrow, \{ style: \{ marginBottom: 7 \} \}, "出戏说 · OOC"\)/, zh + "：幕后里没有出戏说这一条");
    assert.match(seg, /setNoteOpen\(false\); setOocMode\(true\);/, zh + "：点了切不过去");
    assert.match(seg, /h\(Eyebrow, \{ style: \{ marginBottom: 7 \} \}, "导演便签"\)/, zh + "：导演便签得留着，两件事并排放");
  });
});

test("⚠出戏时输入栏必须留一个退出口——不然进去了出不来", () => {
  [["单人线下", offline], ["群线下", goffline]].forEach(([zh, seg]) => {
    assert.match(seg, /oocMode \? h\("button", \{ onClick: \(\) => setOocMode\(false\), title: "退出出戏说"/, zh);
    assert.match(seg, /\}, "出戏中 ✕"\) : null,/, zh + "：那颗键只在出戏时出现");
  });
});

// 她同一天报的另外两件（第二次报了）：名字堆成两行；线下那张「切换」还是旧样子。

test("线下卡头上的名字不许再堆成两行", () => {
  // flex 项默认 min-width:auto，右边图标一多它不会变省略号，会换行
  // ⚠结尾那个锚点必须在 OffCard【后面】：CotReveal 定义在它前面，
  // 拿它当结尾会切出一段空的，然后这条测试永远说不清是真绿还是切飞了
  const off = slice("function OffCard(", "\nfunction GroupOfflineMode(");
  const nameLines = off.split("\n").filter(l => l.indexOf('className: "flex-1"') >= 0 && l.indexOf("F_DISPLAY") >= 0);
  assert.ok(nameLines.length >= 2, "线下卡上的名字有两处（正文卡 + 自拍卡），都要治");
  nameLines.forEach(l => {
    assert.ok(/minWidth: 0/.test(l), "少了 minWidth:0：" + l.trim().slice(0, 60));
    assert.ok(/whiteSpace: "nowrap"/.test(l) && /textOverflow: "ellipsis"/.test(l), "挤不下要变省略号，不是换行：" + l.trim().slice(0, 60));
  });
});

test("线下那张「切换」换成和输入档位同一张单子", () => {
  [["单人线下", offline, '["chat", "说话", "回到手机上，一条一条发"]'],
   ["群线下", goffline, '["chat", "群里说话", "回到手机上，照常在群里发"]']].forEach(([zh, seg, first]) => {
    assert.match(seg, /modeOpen && sheet\("", h\(ModePicker, \{/, zh + "：还是旧的那排 emoji 行");
    assert.ok(seg.indexOf(first) > 0, zh + "：第一档写得不对");
    assert.match(seg, /head: "你们现在在哪"/, zh);
    assert.match(seg, /cur: "offline"/, zh + "：当前这一档要亮着");
    assert.match(seg, /onPick: mk => \{ setModeOpen\(false\); if \(mk === "chat"\) onClose\(\); \}/, zh + "：点回线上要真的回得去");
    assert.match(seg, /tail: "回看"/, zh + "：往期记录挪到下半截");
  });
  assert.equal(codeOnly.indexOf('"🎬 赴约 · 线下相处（当前）✓"'), -1, "旧的那几行该整个删掉");
  assert.equal(codeOnly.indexOf('"🎬 多人线下（当前）✓"'), -1, "旧的那几行该整个删掉");
});

test("单子的抬头能换，下半截没东西就整段不画", () => {
  const pick = slice("function ModePicker({", "\n\n// 代付请求卡");
  assert.match(pick, /eyebrow\(head \|\| "这一条发进这个聊天"\)/);
  assert.match(pick, /const hasTail = \(\(elsewhere \|\| \[\]\)\.length > 0\) \|\| !!children;/);
  // 空标题的 sheet 别再垫一条空标题栏
  // ⚠两处 sheet（单人线下、群线下）各有一份：只钉一处的话，改了一处另一处照样漏
  assert.equal((comp.match(/title \? h\("div", \{ style: \{ fontFamily: F_DISPLAY, fontSize: 16, color: t\.ink, marginBottom: 12 \} \}, title\) : null/g) || []).length, 2);
});
