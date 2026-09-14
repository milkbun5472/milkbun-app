// 她 2026-09-13 从 DS 那份清单里点名开工的那一条：⑨ 广告／插播彩蛋。
//
// 为什么广告能存在于「他不知道谁在听」的电台里：广告在形式上是【对所有人说的】，
// 所以它不破坏那份不对称，可内容全是私货——这是发糖发刀唯一不越界的口子。
// 安静档还没建，第一版先做在故事台上；建起来之后行类型和提示词原样搬。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = require("../js/radio-timeline.js");
const ui = fs.readFileSync(path.join(__dirname, "..", "js/radio-timeline-ui.js"), "utf8");
const src = fs.readFileSync(path.join(__dirname, "..", "js/radio-timeline.js"), "utf8");

const raw = { lines: [
  { kind: "character", speaker: "沈屿白", text: "第一句。第二句。" },
  { kind: "ad", text: "本节目由「他其实早就喜欢你」公司赞助。" },
  { kind: "character", speaker: "沈屿白", text: "第三句。" }
] };

test("广告是正文里的一种行，收得下也存得住", () => {
  const f = R.accept(raw, "present", "story");
  const ad = f.lines.filter(x => x.kind === "ad");
  assert.equal(ad.length, 1);
  assert.equal(ad[0].speaker, "", "广告不挂在谁名下——它是本台说的");
  assert.equal(ad[0].text, "本节目由「他其实早就喜欢你」公司赞助。");
});

test("广告不拆句：一条插播是一个整的节拍", () => {
  const f = R.accept({ lines: [{ kind: "ad", text: "插播寻人启事。走失者穿着你送的白衬衫。" }] }, "present", "s2");
  assert.equal(f.lines.length, 1, "拆开念就散了");
  // 正文照旧按句界拆
  assert.equal(R.accept(raw, "present", "s3").lines.filter(x => x.kind === "character").length, 3);
});

test("回放里一套标记管两种插播，不为广告再开一个字段", () => {
  let b = R.create({ id: "c", name: "沈屿白", persona: "人设" }, "话题", "", "", "b");
  b.fragments.push(R.accept(raw, "present", "story"));
  b = R.playlist(b, "story").reduce((acc, row) => R.reveal(acc, row.fragmentId, row.index, "c"), b);
  const ps = R.replayParagraphs(b, "story");
  assert.deepEqual(ps.map(x => x.mark), ["", "插播广告", ""]);
  assert.match(src, /mark: row\.kind === "ad" \? "插播广告" : callIds\.has\(row\.fragmentId\) \? "插播连线" : ""/);
  assert.match(ui, /par\.mark && par\.mark !== \(paragraphs\[i - 1\] && paragraphs\[i - 1\]\.mark\)/, "连着同一种插播只标一次");
});

test("提示词：跟这一章一起生成，不另调模型；而且不许直说", () => {
  const b = R.create({ id: "c", name: "沈屿白", persona: "人设" }, "话题", "", "", "b");
  const p = R.storyPrompt(b, "present");
  assert.match(p, /同一章里夹\*\*1~2条插播广告\*\*/);
  assert.match(p, /kind填ad、speaker留空/);
  assert.match(p, /不许放在开头或结尾/);
  assert.match(p, /广告不许直说心事/);
  // 判据式收尾，不是又一条禁令（施工规则/bans-make-it-dumber.md）
  assert.match(p, /这条广告如果真在电台里播出来，别人只会当它是条广告吗/);
  // 上面那句「不要输出kind=narrator的项」得跟它对上口径，不然两条打架
  assert.match(p, /kind=ad是下面单说的插播，不受这一句管/);
});

test("播放屏上广告不挂角色名", () => {
  assert.match(ui, /current\.kind === "ad" \? "插播广告 · " : currentPart\.call \? "插播 · " : ""/);
  assert.match(ui, /current\.kind === "ad" \? "本台" : current\.speaker \|\| branch\.name/);
  assert.match(ui, /fontSize: par\.kind === "ad" \? 14\.5 : 16\.5/);
});
