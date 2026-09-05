// 她 2026-09-05：「那这些批注是喂了全部人设和那一堆吗宝宝，还有要不要喂回去呢」。
//
// 答案原来是【没有】。一起读自己拼 sys 走 callAI，不走 buildBundle 也不走 runProbe，
// 于是只白得了它自己 push 的反陈词滥调和内容边界；心情、好感、印象卡、长期记忆、
// 情侣状态、用户人设，还有那三条【靠调用点一条条 push】的禁令，一条都没有。
//
// ⚠️病因跟解梦馆(v61.47)/匿名信箱(v61.37)/穿书(v61.16)/通话(v60.27) 一字不差：
//   **它当初就没在那张名单上**。名单从今天起是【九处】。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = fs.readFileSync(path.join(__dirname, "..", "js", "read.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const eng = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const code = read.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");

test("上下文这条线真的接进来了——一路从 App 传到 Reader", () => {
  // ⚠️「换个入口就什么都没有」往往就是因为这一处压根没接上下文这条线（解梦馆那次的原话）
  assert.match(app, /ctxFor: ctxFor,\s*\n\s*toast: toast,/, "App 没把 ctxFor 递给一起读");
  // ⚠️ReadTogether → Reader 是【一条条列名字】往下传的：漏一个不报错，
  //   只会让里头静默退回兜底路（第一版就漏了这一个，浏览器里量出 sys 只有 2544 字才发现）
  assert.match(code, /ctxFor: props\.ctxFor,/, "ReadTogether 没把 ctxFor 往下传给 Reader");
  // 五枪都得接上
  // 七处：批注 / 讲这页 / 讲这段 / 讲这句 / 讨论 / 讨论完总结 / 批注册那一下
  assert.equal((code.match(/props\.ctxFor\)/g) || []).length, 7, "有调用点没把 ctxFor 传进去");
});

test("readHead 只此一份：接得上就发整份 bundle，接不上才退回老两条", () => {
  const fn = code.slice(code.indexOf("function readHead(ctxFor, char)"), code.indexOf("async function genAnnotations"));
  assert.match(fn, /head = buildBundle\(ctxFor\(char\)\) \+ "\\n\\n";/);
  assert.match(fn, /try \{[\s\S]*\} catch \(e\) \{ head = ""; \}/, "buildBundle 抛了就该退回兜底，不该把整个批注弄挂");
  assert.match(fn, /if \(!head\) head = \(typeof ANTI_CLICHE/, "没有兜底路");
  // 那三条 bundle 不白送、只能调用点 push 的
  assert.match(fn, /ECHO_QUESTION_BAN/);
  assert.match(fn, /REGISTER_FOLLOWS_SCENE/);
  assert.match(fn, /ReplyPacing\.reading\(\)/);
  // ⚠️反过来，bundle 已经带的别再拼一遍
  assert.ok(!/ECHO_QUESTION_BAN/.test(eng.slice(eng.indexOf("function buildBundle(ctx, opts)"), eng.indexOf("function buildBundle(ctx, opts)") + 12000)),
    "buildBundle 现在也带回声禁令了，这儿就该撤掉，别发两遍");
  // 五枪共用这一份，没人再自己拼 ANTI_CLICHE + CB()
  assert.equal((code.match(/= readHead\(ctxFor, char\)/g) || []).length, 5, "五枪没都走这一份");
  assert.ok(!/const sys = \(typeof ANTI_CLICHE !== "undefined"/.test(code), "还有人自己拼那两条");
});

test("人设只发一遍，而且不许再截断", () => {
  // bundle 里本来就有人设；五处提示词再写一遍等于把人设发两份
  assert.equal((code.match(/【你的人设】/g) || []).length, 1, "人设块不止一处——bundle 里已经有了");
  // ⚠️总结那一枪原来是 .slice(0, 300)。这是 v55.87「群里的王爷变霸总」同一个数量级
  //   （那次 200 字），而这一枪写的是【要进记忆库、以后一直被读到】的东西。
  assert.ok(!/char\.persona \|\| ""\)\.slice\(0, 300\)/.test(read), "总结那一枪的人设又被截了");
  assert.ok(!/persona.*slice\(0, [1-9]\d{0,2}\)/.test(code), "还有哪一处在按字数截人设");
});

test("喂回去：只写记忆库，不动好感心情——而且不必走讨论才喂得回去", () => {
  const fn = code.slice(code.indexOf("const rememberBook = async function"), code.indexOf("// ---- 顶栏 ----"));
  assert.ok(fn, "没有「把这本记住」这一路");
  assert.match(fn, /props\.onAddMemory && props\.onAddMemory\(summary, partner\.id\)/);
  // 光有批注也能浓缩（原来只有走过讨论才喂得回去：结束那一步藏在讨论抽屉里）
  assert.match(fn, /summarizeSession\(bg, partner, props\.profile, book,\s*\(book\.annotations \|\| \[\]\)\.filter[\s\S]{0,80}, \[\], props\.ctxFor\)/,
    "没有「只凭批注也能记住」那一路");
  assert.match(fn, /props\.onPatch\(\{ rememberedAt: Date\.now\(\), rememberedCount: annoCount \}\)/, "没记下这次记到哪儿，界面上就说不出「上次记住是什么时候」");
  // ⚠️只写记忆库：不许在这条路上动好感 / 心情 / 状态卡
  assert.ok(!/onAffinity|setAff|onMood|setMood|affDelta/.test(fn), "这条路上动了好感或心情——先问过她再说");
  // 入口在批注册底下（那一册就是「一起读过这本书」的全部证据）
  assert.match(code, /onRemember: rememberBook,/);
  assert.match(code, /"让 " \+ \(\(props\.partner && props\.partner\.name\) \|\| "Ta"\) \+ " 把这本记住"/);
  assert.match(code, /只写记忆，不动好感和心情/, "界面上没跟她交代这一下会动什么");
});
