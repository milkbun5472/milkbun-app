// 他出题（v62.10，她 2026-09-04 同意）：问答小本原来只有她翻题这一个方向。
// 现在 leaveInCoupleSpace 多一档 qa——他出一道题、他那半先写好【封着】，
// 她写完她那半才一起打开（跟她翻题的 sealed 机制同一套，方向反过来）。揭晓零调用。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const screens = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");

test("揭晓走 revealCoupleQA：零调用、写完才开、顺手凝一条记忆", () => {
  const i = app.indexOf("const revealCoupleQA = ");
  assert.ok(i > 0, "没有揭晓函数");
  const fn = app.slice(i, app.indexOf("\n  const answerCoupleQA", i));
  assert.ok(fn.indexOf("runProbe") < 0 && fn.indexOf("callAI") < 0, "揭晓不该花调用——他那半早封在里面了");
  assert.match(fn, /if \(!t0\) \{ toast\("先写你自己的那一份"\); return false; \}/, "空答案也能揭");
  assert.match(fn, /sealed: false, openedAt: Date\.now\(\)/, "没解封");
  assert.match(fn, /coupleKeep\(charId, "情侣问答小本里"/, "揭晓没凝记忆——这是两人真答过的题");
});

test("界面认得「他出的题」：她那半直接写、他那半标着封；编辑/重答让位", () => {
  assert.match(screens, /e\.sealed && e\.byCharacter && !e\.myAnswer/, "没有「他出的、她还没写」这个态");
  assert.match(screens, /写好了 · 一起打开/, "没有她写完揭晓的按钮");
  assert.match(screens, /TA 那半已经写好、封着/, "没告诉她他那半在等");
  // 封着的（无论谁出的）都不该有「重答」——那会当着封条重生成
  assert.match(screens, /e\.sealed \? null : h\("button", \{ onClick: \(\) => onReroll/, "封着还能重答");
});

test("他出的题有人叫她来看：红点、书脊、最近发生三处都接了", () => {
  assert.match(screens, /e\.sealed && e\.byCharacter && !e\.myAnswer\)\) a\.push\("问答小本"\)/, "名册红点没接");
  assert.match(screens, /bQaAsk \? "TA 出了道题等你答"/, "书脊没把等答的那道排最前");
  assert.match(screens, /label: "他出的题", text: cleanSnippet\(x\.question\)/, "最近发生没接");
  // 她自己翻题答题不进「最近发生」——那是她自己干的，不是「发生在她身上的事」
  assert.match(screens, /x\.characterId === bCid && x\.byCharacter\)\.forEach\(x => recentItems\.push\(\{ id: "q_"/, "把她自己答的题也当成通知推了");
});

test("书脊不再读不存在的 e.answer / e.q（跟情书那行同一个病）", () => {
  assert.ok(screens.indexOf("e.characterId === bCid && e.answer)[0]") < 0, "还在读不存在的 e.answer");
  assert.match(screens, /\(e\.myAnswer \|\| e\.charAnswer\)\)\[0\]/, "该按真字段挑最近一条");
});
