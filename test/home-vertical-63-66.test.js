// 她 2026-09-05 两件事：
//   ①「上面那个一起听挡着不给他变矮。下面的播放键也太低了。」
//   ②「装饰里再做点竖着的装饰吧，现在都是横的。」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const bare = s => s.split("\n").filter(l => !/^\s*(\/\/|\*)/.test(l)).join("\n");
const cut = (from, to) => comp.slice(comp.indexOf(from), comp.indexOf(to, comp.indexOf(from)));
const mw = bare(cut("function MusicWidget(", "// 一起听那张卡的【背面】"));

// ── 一起听：让它真的能变矮 ────────────────────────────────────
test("有播放键的那一档不发「一起听」那行眉标", () => {
  // 碟在转、键就在下面，这行字不告诉任何人任何事——它唯一的作用是把卡撑高一截
  assert.match(mw, /const showEyebrow = square \|\| tall \? false :/);
  // 但矮到没有键、光剩歌名的时候还是要它说一句这是什么
  assert.match(mw, /avail >= 76/);
});

test("撑着这张卡的是【碟】不是那行字——碟不许比旁边那一列还高", () => {
  // ⚠️这条是这一轮真正的修法：撤掉眉标之后卡只矮了 3px，因为高度是碟定的。
  assert.match(mw, /const discCap = \(!square && colH\) \? Math\.max\(64, colH\) : Infinity;/);
  assert.match(mw, /Math\.min\(130, avail, Math\.round\(room \* 0\.36\), discCap\)/);
  // 竖排（2×2）那一档碟在字上面，不存在「比旁边那列高」，不加这道盖
  assert.match(mw, /square \? Math\.min\(Math\.round\(avail \* 0\.45\), room, 110\)/);
  // 量的是那一列，而且【不会循环】：那一列里没有一样东西跟碟的大小有关
  assert.match(mw, /const colRef = useRef\(null\);/);
  assert.match(mw, /h\("div", \{ ref: colRef, style: \{ flex: 1, minWidth: 0 \} \}/);
  assert.match(comp, /这一量【不会循环】/, "为什么量它不会循环，得写在代码里");
});

test("播放键跟进度条是一组，中间不留一整行", () => {
  assert.match(mw, /tall && !editMode \? h\("div", \{ className: "flex items-center", style: \{ gap: 8, marginTop: 3 \} \}/);
});

// ── 竖着的格子 ───────────────────────────────────────────────
test("尺寸档里得有高比宽大的——不然装饰画得再竖，摆进横格子还是横的", () => {
  const seg = cut("const HOME_SIZE_PRESETS = [", "\n];");
  assert.match(seg, /\{ id: "slim", name: "竖条", note: "1 × 2", cols: 1, rows: 2/);
  assert.match(seg, /\{ id: "column", name: "竖块", note: "2 × 3", cols: 2, rows: 3/);
  // 原来六档一档都不是竖的
  const tallOnes = [...seg.matchAll(/cols: (\d+), rows: (\d+)/g)].filter(m => Number(m[2]) > Number(m[1]));
  assert.ok(tallOnes.length >= 2, "还是没有高比宽大的档");
  // 挑尺寸那一页是整份铺开的，加了就看得见
  assert.match(comp, /HOME_SIZE_PRESETS\.map\(function \(p\)/);
});

// ── 两种竖装饰 ───────────────────────────────────────────────
test("书签和挂轴都在，而且默认就占竖格子", () => {
  const seg = cut("const HOME_DECOR_TYPES = [", "\n];");
  assert.match(seg, /\{ id: "bookmark", glyph: "▯", name: "书签"/);
  assert.match(seg, /\{ id: "scroll", glyph: "▐", name: "挂轴"/);
  assert.match(comp, /if \(it\.which === "bookmark"\) return \[1, 2\];/);
  assert.match(comp, /if \(it\.which === "scroll"\) return \[2, 3\];/);
  // 新建时自动挑那个竖档，别让她建完还得自己去改尺寸
  assert.match(comp, /decorDraftType === "bookmark" \? "slim" : decorDraftType === "scroll" \? "column" : "square"/);
  // 没被退役，选得到
  const ret = cut("const HOME_DECOR_RETIRED =", ";");
  assert.ok(ret.indexOf("bookmark") < 0 && ret.indexOf("scroll") < 0, "刚做出来就被退役了");
});

test("形状照现实里那个东西来，不是把横的转 90 度", () => {
  const bm = cut('if (item.type === "bookmark")', 'if (item.type === "scroll")');
  // 书签：底下剪成燕尾，顶上打孔穿绳
  assert.match(bm, /clipPath: "polygon\(0 0,100% 0,100% 100%,50% 84%,0 100%\)"/, "燕尾没了，那就只是个长条");
  assert.match(bm, /borderRadius: 999, border: "1px solid " \+ bmEdge/, "穿绳那个孔没了");
  const sc = cut('if (item.type === "scroll")', 'if (item.type === "letter")');
  // 挂轴：上下各一根杆 + 顶上两条绳收进一个结
  assert.equal((sc.match(/rod\(\{ width: "88%" \}\)/g) || []).length, 2, "上下两根杆不齐");
  assert.match(sc, /d: "M23 2 6 13M23 2 40 13"/, "挂绳没了");
});

// ── 竖排文字那个坑 ────────────────────────────────────────────
test("竖排的字自己排，不许交给 CSS 的 writing-mode", () => {
  // ⚠️writing-mode 靠字体自带的【竖排度量】。字体没有那份度量时每个字的前进量是 0，
  //   四个字叠成一坨墨——而**量出来的盒子是对的**（22×172），糊的是画出来的字。
  //   这种事只有真跑一次截图才看得见。换字体/加字距/改行高/去 text-orientation 全试过，一样。
  const bm = cut('if (item.type === "bookmark")', 'if (item.type === "letter")');
  assert.equal(bm.indexOf("writingMode"), -1, "竖装饰又回去用 writing-mode 了");
  assert.equal(bm.indexOf("textOrientation"), -1);
  assert.match(comp, /var vtext = function \(txt, st\) \{/);
  assert.match(comp, /Array\.from\(String\(txt \|\| ""\)\)/, "得一个字一个字自己排");
  assert.match(comp, /flexDirection: "column", alignItems: "center"/);
  // 两样都走这一份，别一样一个写法
  assert.equal((bm.match(/vtext\(/g) || []).length, 4, "书签和挂轴各两条字，共四处");
  assert.match(comp, /糊的是【画出来的字】/, "这个坑要写下来，不然下一个人还会踩");
});
