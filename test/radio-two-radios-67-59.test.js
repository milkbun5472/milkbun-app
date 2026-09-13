// 她 2026-09-12 排的第二条：「把两台电台接起来」。
//
// 旧电台（js/radio.js）三个距离里，远景和生活半径都有料（这片地方／他的生活半径／
// 今天有人打进来说的话），**只有「痕迹」那一档空着手**——它要的是「他真的在这个台上
// 留下过一点东西」，可 bed 里唯一跟他沾边的那一份还写着「不是让你写他」。
// 时间线电台那边满手是料，而且那边已经定好了什么叫真的发生过：**播出去的才算数**（v67.58）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
globalThis.Axes = require("../js/axes.js");   // 掷轴搬去公共那一层了（js/axes.js）
const R = require("../js/radio.js");
const RT = require("../js/radio-timeline.js");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const radio = fs.readFileSync(path.join(root, "js/radio.js"), "utf8");

const st = { id: "s1", name: "台", callSign: "呼", freq: 92.0, area: "这一片", habit: "什么都播" };
const bed = { places: ["老码头"], lore: "", orbit: ["修船（在老码头）"], hotline: [], traces: ["有人把一只搪瓷缸忘在了播音室"] };
const sched = (dists, b) => R.buildScheduleInstruction(st, Date.now(), R.readSeen(), b, dists, "");

test("今天掷到了痕迹：那一档终于有料了，而且只许取最小的一样", () => {
  const p = sched(["trace", "far"], bed);
  assert.ok(p.includes("有人把一只搪瓷缸忘在了播音室"));
  assert.ok(p.includes("【「他留下的痕迹」那一档能用的料】"));
  assert.ok(p.includes("别把它当故事讲出来"), "整段情节搬上去就等于坐实了这是谁，这一句不能少");
  assert.ok(p.includes("不署名、不点名、不暗示"));
  // 生活半径那一份照旧在，两份不许互相顶替
  assert.ok(p.includes("【他的生活半径】"));
});

test("今天一条痕迹都没掷到，这一份就不发", () => {
  const p = sched(["far", "orbit", "orbit"], bed);
  assert.ok(!p.includes("【「他留下的痕迹」那一档能用的料】"));
  assert.ok(!p.includes("有人把一只搪瓷缸忘在了播音室"));
  // 掷到了痕迹、可那边一句都没播出去过——照样不发这一栏，不许硬造
  const empty = sched(["trace"], { ...bed, traces: [] });
  assert.ok(!empty.includes("【「他留下的痕迹」那一档能用的料】"));
  // 三个距离那条规矩本身跟料无关，一直都在
  assert.ok(empty.includes("他留下的痕迹"));
});

test("临时台不吃这一份：它是飘过来的，凭什么知道这儿住着谁", () => {
  const p = R.buildDriftInstruction(R.rollAxes("slot", "92.0", 1), 92.0, R.readSeen(), bed);
  assert.ok(!p.includes("有人把一只搪瓷缸忘在了播音室"));
});

test("接的是【播出去的那几句】，不是那边的全稿", () => {
  // 桩钉在写的那一头：heard 是 reveal() 一句句记下来的，text 从当时展示的原文复制
  //（施工规则/stub-from-the-writer.md）
  const rt = fs.readFileSync(path.join(root, "js/radio-timeline.js"), "utf8");
  assert.match(rt, /heard: branch\.heard\.concat\(\{ fragmentId, index, companionId: who, era: f\.era, \.\.\.f\.lines\[index\] \}\)/);
  let b = RT.create({ id: "he", name: "广播里那个", persona: "人设" }, "分岔", "", "", "b");
  b.fragments.push(RT.accept({ title: "章", lines: [{ kind: "character", speaker: "广播里那个", text: "播出去的那句。还没播的那句。" }] }, "past", "f"));
  b = RT.reveal(b, "f", 0, "");
  assert.deepEqual(b.heard.map(x => x.text), ["播出去的那句。"], "heard 里进的不是当时展示的那一句原文");

  assert.match(app, /const branches = loadJSON\(window\.RadioTimeline\.KEY, \[\]\)/);
  assert.match(app, /\(b && Array\.isArray\(b\.heard\) \? b\.heard : \[\]\)\.forEach/,
    "读的不是 heard——她还没放出去的那几句会从另一个台漏出去");
  assert.ok(!/traces[\s\S]{0,400}b\.fragments/.test(app), "痕迹那一份去读了全稿");
  assert.match(app, /hotline: hotline, traces: traces/);
  // 人名一条都不许过去：痕迹的规矩是不署名、不点名、不暗示
  assert.match(app, /rows\.slice\(-40\)\.reverse\(\)\.forEach\(t => \{ if \(t\.length >= 6\) push\(traces, t\.slice\(0, 90\), 8\); \}\)/);
  assert.match(app, /const clean = v => \{ const x = T\(v\); return \(x && !names\.some\(n => x\.indexOf\(n\) >= 0\)\) \? x : ""; \}/);
});

test("痕迹这一份只挂在排节目那一枪上，建台那一枪不吃它", () => {
  const p = R.buildWorldInstruction(R.readSeen(), bed);
  assert.ok(!p.includes("有人把一只搪瓷缸忘在了播音室"));
  assert.match(radio, /list\.indexOf\(DISTANCE\.TRACE\) >= 0 \? traceBedText\(bed\) : ""/);
});
