const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// 资料室(2026-08-18 Lisa):专访一直只喂角色卡、没有声纹样本(日记有);
// 四个媒体腔换的是戏服不是视角，所以补两块靠真实数据说话的版面。
test("专访接入声纹样本，资料室语录逐字验真、数据本地统计", () => {
  const w = fs.readFileSync(path.join(__dirname, "..", "js", "weekly.js"), "utf8");
  assert.match(w, /function ownVoiceLines\(material, name\)/, "要能从素材里抽出本人原话");
  assert.match(w, /本周真实说过的话 · 声纹最高优先/, "专访要有声纹样本块");
  assert.match(w, /function weeklyStats\(mat, characters, uName\)/, "统计必须本地算");
  assert.match(w, /数字、人名、词全部照抄，一个都不许改/, "模型只配文，不碰数字");
  assert.match(w, /hay\.indexOf\(q\.text\) > -1/, "语录必须逐字来自真实记录");
  assert.match(w, /type: "desk"/, "资料室要成为一个版块");
  assert.match(w, /QUOTED · 本周语录/);
  assert.match(w, /BY THE NUMBERS/);
});

// 第二步(2026-08-18):四个媒体腔换的是戏服不是视角 → 扩池到 6 个、每期抽 3，
// 并补一块真正换立场的「读者来信」，外加更正启事与中缝广告(搭资料室的便车，不额外调用)。
test("媒体腔按周抽签，来信/更正/中缝到位", () => {
  const w = fs.readFileSync(path.join(__dirname, "..", "js", "weekly.js"), "utf8");
  const seg = w.slice(w.indexOf("const VOICES = ["), w.indexOf("// ---- 报道周窗口"));
  const mod = new Function("function seeded(){ return function(){ return .37; }; }\nfunction issueStart(x){ return Number(x&&x.weekOf&&x.weekOf.start)||0; }\n" + seg + "; return { VOICES: VOICES, voicesForWeek: voicesForWeek };")();
  assert.ok(mod.VOICES.length >= 6, "池子要够抽");
  assert.equal(mod.voicesForWeek("2026-W31", [], 1).length, 3, "每期只出三块");
  assert.deepEqual(mod.voicesForWeek("2026-W31", [], 1).map(v => v.id), mod.voicesForWeek("2026-W31", [], 1).map(v => v.id),
    "同一周重抽必须一致，否则重刷会换掉整本刊物的构成");
  const first = mod.voicesForWeek("W1", [], 1);
  const past = [{ weekOf: { start: 1 }, sections: first.map(v => ({ type: "media", voiceId: v.id, auto: true })) }];
  const second = mod.voicesForWeek("W2", past, 2);
  assert.equal(first.concat(second).slice(0, mod.VOICES.length).map(v => v.id).length,
    new Set(first.concat(second).slice(0, mod.VOICES.length).map(v => v.id)).size,
    "整池抽完以前不得重复文风");
  past[0].sections.push({ type: "media", voiceId: mod.VOICES[5].id, auto: false });
  assert.deepEqual(mod.voicesForWeek("W2", past, 2).map(v => v.id), second.map(v => v.id), "手动补版不得消耗抽签池");
  assert.match(w, /async function genLetters/, "读者来信要换立场而不是换口音");
  assert.match(w, /type: "letters"/);
  assert.match(w, /CORRECTION · 更正/);
  assert.match(w, /CLASSIFIEDS · 中缝/);
  assert.match(w, /genMediaBatch\(active, weekVoices,/, "出刊要用抽签结果而不是全量 VOICES");
});

// 排版与省钱(2026-08-18 Lisa:一页光秃秃只有文字；每次点进版块还停在上一页的滚动位置)
test("周刊有纸感与分版视觉，换版回顶，且资料室只调一次", () => {
  const w = fs.readFileSync(path.join(__dirname, "..", "js", "weekly.js"), "utf8");
  assert.match(w, /const VOICE_LOOK = \{/, "每个媒体腔要有自己的视觉，不能排成一个样");
  assert.match(w, /function paperStyle\(t\)/, "要有纸感底，不是纯色背景");
  assert.match(w, /float: "left"/, "首段要有落款首字（drop cap）");
  assert.match(w, /transform: "rotate\(-7deg\)"/, "期数做成盖歪的印章");
  assert.match(w, /function CoverPage\(props\)/, "主页面是一本杂志封面，不是目录列表");
  assert.match(w, /TAP A HEADLINE/);
  assert.match(w, /scrollRef\.current\.scrollTop = 0/, "换版必须回到顶部");
  // 资料室一次调用出五块，别再各调各的
  assert.match(w, /genDeskPage\(active, globalText, stats, userName, personasFor/);
  assert.match(w, /const total = 1 \+ Math\.min\(3, interviewPool\.length\) \+ weekVoices\.length \+ 1;/, "有足够角色时每期固定采访三人");
});

// 采访轮换(2026-08-18 Lisa):每期至多 3 人，抽完一轮才允许重复；
// 手动补的那些不算被抽过，下一轮照样能抽到。
test("采访洗牌袋：满一轮才重复，手动补的不占轮次", () => {
  const w = fs.readFileSync(path.join(__dirname, "..", "js", "weekly.js"), "utf8");
  const grab = name => {
    const i = w.indexOf("  function " + name);
    let d = 0, j = i;
    for (; j < w.length; j++) { if (w[j] === "{") d++; else if (w[j] === "}") { d--; if (!d) { j++; break; } } }
    return w.slice(i, j);
  };
  const m = new Function("function issueStart(x){ return Number(x&&x.weekOf&&x.weekOf.start)||0; }\n" + grab("seeded") + "\n" + grab("interviewPickFor") + "\n; return { interviewPickFor };")();
  const all = ["a", "b", "c", "d", "e"], past = [];
  const seen = {};
  for (let k = 1; k <= 4; k++) {
    const pick = m.interviewPickFor("W" + k, all, past, k);
    assert.equal(pick.length, 3, "每期抽三人");
    assert.equal(new Set(pick).size, 3, "同一期不重复同一个人");
    pick.forEach(id => { seen[id] = (seen[id] || 0) + 1; });
    past.push({ key: "W" + k, weekOf: { start: k }, sections: [{ type: "interview", entries: pick.map(id => ({ charId: id, auto: true })) }] });
  }
  // 12 个名额发给 5 个人：满一轮才重复 → 没有人能比别人多两轮以上
  const counts = all.map(id => seen[id] || 0);
  assert.ok(Math.max.apply(null, counts) - Math.min.apply(null, counts) <= 1, "轮次要均匀：" + JSON.stringify(seen));
  // 重生成旧的一期，结果必须不变（回放只看这一期之前）
  const again = m.interviewPickFor("W2", all, past, 2).join("");
  assert.equal(again, past[1].sections[0].entries.map(e => e.charId).join(""), "重生成不该改变历史轮次");
  // 手动补一位（auto:false）不影响后续抽签
  const before = m.interviewPickFor("W5", all, past, 5).join("");
  past[0].sections[0].entries.push({ charId: "e", auto: false });
  assert.equal(m.interviewPickFor("W5", all, past, 5).join(""), before, "手动补的不占轮次");
  assert.match(w, /auto: false/, "手动补的条目要标出来");
});

test("补刊按实际报道周归位，并显示期号与装订进度", () => {
  const w = fs.readFileSync(path.join(__dirname, "..", "js", "weekly.js"), "utf8");
  assert.match(w, /function orderedIssues\(list\)/);
  assert.match(w, /issueStart\(a\) - issueStart\(b\)/, "书架必须按报道周而非补做时间排序");
  assert.match(w, /补到第 /, "补刊中要显示正在补哪一期");
  assert.match(w, /props\.progress\.done \+ "\/" \+ props\.progress\.total/, "补刊中要显示版块进度");
  assert.match(w, /voiceId: v\.id, auto: false/, "手动补文风必须标记为不占轮抽");
  assert.match(w, /NOT IN THIS ISSUE · 本期未抽中/, "本期目录要能选择补齐未抽中的文风");
});
