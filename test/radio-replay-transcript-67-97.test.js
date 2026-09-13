// 她 2026-09-13：「电台『已听回放』连成正文」。
//
// 原来回放只有句子：谁在说、哪一段是打进来的连线、中间跳过了哪几句，全看不出来——
// 读起来是一摞句子，不是一份节目文字稿。而这三件事【只有拼段落的那一处知道】：
// 句子进了段落就没有来源了，界面再想补回去只能靠猜。所以段落自己带着它们出来。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = require("../js/radio-timeline.js");
const ui = fs.readFileSync(path.join(__dirname, "..", "js/radio-timeline-ui.js"), "utf8");

const fixture = () => {
  const b = R.create({ id: "c", name: "沈屿白", persona: "人设" }, "话题", "", "", "b");
  b.fragments.push(R.accept({ lines: [
    { kind: "narrator", text: "雨下了一夜。" },
    { kind: "character", speaker: "沈屿白", text: "第一句。第二句。" },
    { kind: "character", speaker: "沈屿白", text: "第三句。" }
  ] }, "present", "story"));
  return b;
};
const call = id => R.acceptCall({ lines: [{ text: "我在。" }] }, "present", id, { name: "马甲" }, "喂，能听见吗。", "沈屿白");
const hearAll = (b, ids) => R.playlist(b, "story").reduce((acc, row, i) =>
  ids.indexOf(i) < 0 ? acc : R.reveal(acc, row.fragmentId, row.index, "c"), b);

test("每一段带着说话人出来，旁白没有名字", () => {
  let b = fixture();
  b = hearAll(b, [0, 1, 2, 3]);
  const ps = R.replayParagraphs(b, "story");
  assert.equal(ps[0].speaker, "");           // 旁白
  assert.equal(ps[0].kind, "narrator");
  assert.equal(ps[1].speaker, "沈屿白");
  assert.deepEqual(ps[1].lines.map(x => x.text), ["第一句。", "第二句。"]);
});

test("插播连线自己报到，回放里看得出这一节是打进来的", () => {
  let b = R.insertCall(fixture(), { fragmentId: "story", index: 0 }, call("call"));
  const queue = R.playlist(b, "story");
  b = queue.reduce((acc, row) => R.reveal(acc, row.fragmentId, row.index, "c"), b);
  const ps = R.replayParagraphs(b, "story");
  const callPars = ps.filter(x => x.call);
  assert.ok(callPars.length >= 2, "打进来的那句和他的回答都该标出来");
  assert.deepEqual(callPars.map(x => x.speaker), ["马甲", "沈屿白"]);
  assert.ok(ps.some(x => !x.call), "正文那几段不许被当成连线");
});

test("中间没听的那几句留着断口，不许悄悄接上", () => {
  let b = fixture();
  b = hearAll(b, [0, 3]);                    // 跳过中间两句
  const ps = R.replayParagraphs(b, "story");
  assert.equal(ps.length, 2);
  assert.equal(ps[0].gap, false, "第一段前面没有东西可跳");
  assert.equal(ps[1].gap, true, "这儿跳过了没听的");
  assert.ok(!JSON.stringify(ps).includes("第一句"), "没听的句子一个字都不许漏出来");
});

test("界面：说话人写在段前，连线单起一节，断口画成省略号", () => {
  assert.match(ui, /par\.speaker \? h\("span", \{ style: \{ color: BRASS, marginRight: 6 \} \}, par\.speaker \+ "："\) : null/);
  assert.match(ui, /"data-radio-callmark": true/);
  assert.match(ui, /par\.call && !\(paragraphs\[i - 1\] && paragraphs\[i - 1\]\.call\)/, "连着的连线段只标一次");
  assert.match(ui, /"data-radio-gap": true/);
  assert.match(ui, /color: par\.kind === "narrator" \? NT\.dim : NT\.ink/, "旁白要比台词淡一档");
  // 句子还是一句一个按钮：点一句回到播放屏重听，这条没变
  assert.match(ui, /par\.lines\.map\(l => h\("button"/);
  assert.match(ui, /const heard = paragraphs\.flatMap\(x => x\.lines\);/);
  assert.match(ui, /"本章已听过的部分，连起来读。/);
});
