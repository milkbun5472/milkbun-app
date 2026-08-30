const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const map = R("map.js"), app = R("app.js"), trpg = R("trpg.js");
const grab = (src, a, b, cap) => {
  const i = src.indexOf(a), j = src.indexOf(b, i);
  assert.ok(i > 0 && j > i && (!cap || j - i < cap), "抠不出：" + a);
  return src.slice(i, j);
};
const nocomment = s => s.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
const gen = grab(app, "  const genWorld = async (id, name, brief, done) => {", "  const saveWorld = (id, name, brief)", 4200);
const wm = grab(map, "  function WorldMap({", "  // 开世界：整页表单");

// ── 地图引擎只有一份 ───────────────────────────────────────────────────────
test("架空地图借跑团那份引擎，不另写一份", () => {
  assert.match(trpg, /window\.TrpgMap = \{ normRegions, mapBuild, mapAdjacent, findNode \}/, "跑团那边没把引擎导出来");
  assert.match(wm, /K\.mapBuild\(world\.id, world\.regions/, "架空地图没用共享引擎");
  assert.match(map, /window\.TrpgMap\.mapAdjacent\(built\.edges/, "「从这里可以去」没用共享的连通图");
  // 自己抄一份力导向/团块就是「一层写在两处，第二处没跟上」
  assert.ok(!/forceLayout|chaikinClosed|regionBlob/.test(map), "map.js 自己抄了一份布局算法");
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.ok(html.indexOf("js/trpg.js") < html.indexOf("js/map.js"), "trpg.js 必须先于 map.js 加载，否则 TrpgMap 还不存在");
});

// ── 造世界那一枪什么角色都不认识 ───────────────────────────────────────────
test("造世界不喂任何角色人设——喂了它就把世界往那个人身上拧", () => {
  assert.ok(!/runProbe|ctxFor|buildBundle|persona/.test(nocomment(gen)), "造世界那一枪混进了角色上下文");
  assert.match(gen, /await callAI\(active, sys/, "没有走裸调用");
  assert.match(gen, /maxTokens: 65535/, "天花板没给满");
  assert.match(gen, /【他写的设定】/, "没把她写的那段递进去");
});

test("模型只宣告骨架，坐标一概不存——地图每次现算", () => {
  assert.match(gen, /const regions = K \? K\.normRegions\(d\.regions\) : null;/, "骨架没过 normRegions 这道校验");
  assert.match(gen, /if \(!regions\) throw/, "骨架不合格还照写进去");
  const saved = grab(gen, "const next = {", "saveWorlds(", 400);
  ["x:", "y:", "blob", "svg", "dataURL", "image"].forEach(k =>
    assert.ok(saved.indexOf(k) < 0, "把画出来的东西存盘了：" + k));
  assert.match(saved, /regions/, "没存骨架");
  assert.match(saved, /prompt: brief/, "没留下她写的原文，改一改重画就没了底稿");
});

test("重画：站在没了的地点上的人掉下来，还在的照旧", () => {
  assert.match(gen, /Object\.keys\(\(old && old\.pins\) \|\| \{\}\)\.forEach\(k => \{ if \(names\[old\.pins\[k\]\]\) pins\[k\] = old\.pins\[k\]; \}\)/,
    "重画后旧的钉子没按「这个地点还在不在」筛一遍");
  assert.match(gen, /const wid = id \|\| \("w_" \+ Date\.now\(\)\);/, "重画没沿用同一个世界 id——换 id 等于换一张图");
});

// ── 界面铁律 ──────────────────────────────────────────────────────────────
test("地点页是整页，不是半窗", () => {
  const np = grab(map, "    const nodePage = sel ?", "    return h(\"div\", { className: \"flex-1 flex flex-col\"");
  assert.ok(!/h\(Sheet/.test(np), "地点页用了半窗——见 .claude/rules/no-half-sheet.md");
  assert.match(np, /position: "fixed", inset: 0/, "整页没铺满");
  assert.match(np, /flex-1 min-h-0 overflow-y-auto/, "正文不是那一个主滚动容器");
});

test("好友地图这一页用紧凑标题栏，不用 40px 大标题", () => {
  const cm = grab(map, "  function CharMap({", "    const t = useTheme();", 400) + grab(map, "    return h(\"div\", { className: \"h-full flex flex-col\" },", "      (mode || \"real\") === \"story\"", 2000);
  assert.ok(!/h\(Head,/.test(cm), "又用回了大标题 Head——见 .claude/rules/mobile-ui-layout.md §1");
  assert.match(cm, /paddingTop: safeTop\(10\)/, "顶栏没自己吃安全区");
  assert.match(cm, /fontSize: 16/, "标题不是紧凑那一档");
});

// ── 画出来的东西读得清 ────────────────────────────────────────────────────
test("区域名挂在团块上边缘，不压在中心那个节点上", () => {
  const lbl = grab(map, "          built.regions.map(function (r) {\n            // 区域名", "          built.roads.map", 1200);
  assert.match(lbl, /Math\.min\.apply\(null, ys\)/, "没从团块路径里抠出上边缘，又会压在首府节点上");
  assert.match(lbl, /paintOrder: "stroke"/, "没描边，压在色块上读不清");
});

test("视口按画出来的内容收紧，不按 360×620 的画布收", () => {
  const fit = grab(map, "    const fit = (function () {", "    const V = vb || fit;", 1600);
  assert.match(fit, /built\.regions\.forEach/, "没量区域");
  assert.match(fit, /built\.nodes\.forEach/, "没量节点——名字会被切掉");
  assert.match(wm, /const V = vb \|\| fit;/, "默认视口不是内容框");
  assert.match(wm, /Math\.max\(fit\.w \/ 6, Math\.min\(fit\.w, v\.w\)\)/, "缩放没夹住,能拖出画外");
});

test("钉人：存的是地点名，谁在哪儿画在那个点旁边", () => {
  const pin = grab(app, "  const pinWorld = (wid, charId, node) =>", "  const genAnonMe", 700);
  assert.match(pin, /if \(node\) pins\[charId\] = node; else delete pins\[charId\];/, "取消钉住没把这一栏删掉");
  assert.match(wm, /const n = pins\[c\.id\]; if \(n\) \(atNode\[n\] = atNode\[n\] \|\| \[\]\)\.push\(c\)/, "没把人归到各自的地点上");
  assert.match(wm, /here \? "挪走" : "钉过来"/, "地点页上不能把人挪走");
});
