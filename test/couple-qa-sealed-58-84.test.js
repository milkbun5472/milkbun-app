const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), scr = R("screens.js");
const grab = (src, a, b, cap) => {
  const i = src.indexOf(a), j = src.indexOf(b, i);
  assert.ok(i > 0 && j > i && (!cap || j - i < cap), "抠不出：" + a);
  return src.slice(i, j);
};
const nocomment = s => s.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
const seal = grab(app, "  const sealCoupleQA = (char, item) => {", "  const answerCoupleQA = async (char, item) => {");
const ans = grab(app, "  const answerCoupleQA = async (char, item) => {", "  const rerollCoupleQA");
const book = grab(scr, "function CoupleQABook({", "// 情侣空间·交换日记");

// 她 2026-08-31：「a 这不就是问答小本我想要的效果嘛」。
// 看了一眼它原来根本不是双答——提示词里明写着「顺着用户的回答接话（呼应 TA 说的，
// 不是各答各的）」，而且把【用户的回答】直接递给了他。他不是在答题，是在回话。
test("他那一枪里【没有】她的答案——隔离靠调用结构，不靠提示词写「别看」", () => {
  const body = nocomment(ans);
  const instr = grab(ans, '        instruction: "你们是恋人。', "        schemaHint:");
  assert.ok(!/myAnswer/.test(instr), "又把她的答案递进去了——他就变回在回话了");
  assert.ok(!/顺着用户的回答接话|呼应 TA 说的/.test(body), "旧那句「顺着用户的回答接话」还留着");
  assert.match(instr, /各写各的、两边都写完才互相看/, "没把规矩说清");
  assert.match(instr, /她那一份已经封着了，你看不到，也不用去猜她会怎么写/, "没挑明不许猜她");
});

test("她写完只是封起来，一次调用都不花", () => {
  assert.ok(!/runProbe|callAI|await /.test(nocomment(seal)), "封存这一步去调模型了");
  assert.match(seal, /charAnswer: "", source: item\.source \|\| "题库", sealed: true/, "没标成封着的");
  assert.match(seal, /if \(!t0\) \{ toast\("先写你自己的那一份"\); return false; \}/, "空的也给封");
  // 交卷按钮走的是封存，不是作答
  const sub = grab(scr, "  const submit = () => {", "  // —— 翻一张新题作答 ——");
  assert.ok(!/await onAnswer|onAnswer\(/.test(sub), "交卷还在直接叫他作答");
  assert.match(sub, /const ok = onSeal\(partner, \{ qid: cur\.id/, "交卷没走封存");
  assert.match(book, /"写好了 · 封起来"/, "按钮上看不出这一下只是封起来");
});

test("揭晓是把原来那条填上，不是再插一条", () => {
  assert.match(ans, /const hit = item\.id && p\.some\(x => x\.id === item\.id\);/, "没认原来那条");
  assert.match(ans, /p\.map\(x => x\.id !== item\.id \? x : \{ \.\.\.x, charAnswer: d\.answer \|\| "", sealed: false/, "没就地揭晓——会变成两条同题");
  // CC 票那一路（言秋是真人在答）同样就地揭晓；她的答案给不给他看是他自己的事，那一段不动
  assert.equal((app.match(/const hit = item\.id && p\.some\(x => x\.id === item\.id\);/g) || []).length, 2, "两条路里有一条还在插新条");
  assert.match(app, /her_answer: item\.myAnswer \|\| "（她还没写）"/, "把言秋那条票据改了——那是他的东西");
});

test("封着的时候：盖住他那栏、给一个揭晓的口子、不给「重答」", () => {
  assert.match(book, /\(e\.sealed && !e\.charAnswer\)\n *\? h\("div", \{ style: \{ borderRadius: 12, border: "1px dashed "/, "封着的时候没盖住");
  assert.match(book, /写的时候看不到你写了什么——两份都写完才一起打开/, "界面上没跟她说清这一层");
  assert.match(book, /onClick: \(\) => onAnswer\(partner, e\)/, "没有让 TA 也写一份的口子");
  // v62.10 起封条有两种（她翻题等他写 / 他出题等她写），封着的一律不给「重答」
  assert.match(book, /e\.sealed \? null : h\("button", \{ onClick: \(\) => onReroll/, "封着还给「重答」,点了会乱");
  assert.match(scr, /onAnswer: onAnswerQA, onSeal: onSealQA,/, "封存那条没接下来");
  assert.match(app, /onSealQA: sealCoupleQA,/, "props 没递出去");
});
