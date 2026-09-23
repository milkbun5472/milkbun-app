// 一起研究 + 三人课堂改进（她 2026-09-23：「都做宝宝」）。
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const st = fs.readFileSync(__dirname + "/../js/study.js", "utf8");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const bare = s => s.split("\n").map(l => l.replace(/^\s*\/\/.*$/, "")).join("\n");
const fnSrc = name => { const i = st.indexOf("function " + name + "("); assert(i > 0, name); return st.slice(i, st.indexOf("\n  }\n", i) + 4); };

// 一起研究：从自己出发、每轮推一步
const scene = bare(fnSrc("sceneFor"));
assert(/从你的职业、经历、手艺、偏好里找这件事的切入点/.test(scene));
assert(/每一轮都试着把研究往前推一小步/.test(scene));
// 三人课堂同学不再是模板
assert(!/会答错、会提问、会和用户讨论、偶尔走神/.test(scene), "同学不许写死模板");
assert(/按【你自己】来学/.test(scene));

// 笔记板：解析 + 回写 + 注入
const box = { extractJSON: s => { try { return JSON.parse(s); } catch (e) { return null; } } };
vm.createContext(box);
vm.runInContext(fnSrc("parseBoard") + fnSrc("boardText") + fnSrc("parseSay").replace(/stripName|guardOverspeak|sayFallback/g, "(x=>x)"), box);
const b = box.parseBoard(JSON.stringify({ say: ["嗯"], board: { question: "为什么面包会塌", guesses: ["发酵过头"], confirmed: [], open: ["烤温"] } }));
assert.strictEqual(b.question, "为什么面包会塌");
assert(/猜测（未验证）\n· 发酵过头/.test(box.boardText(b)));
assert.strictEqual(box.parseBoard('{"say":["x"]}'), null);
assert.strictEqual(box.parseSay('{"say":[]}').length, 0, "接话那位可以明说不开口");
const build = fnSrc("buildStudyPrompt");
assert(/boardText\(session\.progress && session\.progress\.board\)/.test(build));
assert(/parts\.push\(BOARD_FMT\)/.test(build));
assert(/progress: Object\.assign\(\{\}, cur\.progress \|\| \{\}, \{ board: res\.board \}\)/.test(st), "板子要回写进度");

// 三人课堂：看得见对方 + 关系
assert(/【同堂的另一位 · " \+ oc\.name \+ "】/.test(build));
assert(/ctx\.relFor \? ctx\.relFor\(char\.id, oc\.id\)/.test(build));
assert(/relFor: \(a, b\) => \(\{ mine: /.test(app));
// 三人课堂一次写两个人（v73.15：「为什么不是一棒两个人说」）
box.tail = (a, n) => a.slice(-n);
vm.runInContext(fnSrc("directNv1") + fnSrc("peerTurnsFirst"), box);
const T = { id: "t", name: "陆老师" }, P = { id: "p", name: "小周" };
const d1 = box.directNv1(null, { transcript: [{ role: "user", content: "这题为什么这样" }] }, T, P, {});
assert.strictEqual(d1.lead + "/" + d1.named, "teacher/false");
const d2 = box.directNv1(null, { transcript: [{ role: "user", content: "小周你说呢" }] }, T, P, {});
assert.strictEqual(d2.lead + "/" + d2.named, "peer/true");
box.stripName = x => String(x || "").trim(); box.guardOverspeak = x => x;
vm.runInContext(fnSrc("parseTurns"), box);
const turns = box.parseTurns(JSON.stringify({ turns: [{ name: "陆老师", say: ["先看这一步"] }, { name: "小周", say: ["哦！"] }, { name: "陆老师", say: [] }] }), T, P);
assert.strictEqual(turns.map(t => t.char.id + ":" + t.says.join("|")).join(","), "t:先看这一步,p:哦！", "按先后落泡，空的那段不出现");
const tail = fnSrc("nv1JointTail");
assert(/不是每个人都得开口/.test(tail) && /只能是「" \+ teacher\.name \+ "」出的/.test(tail));
const rn = st.slice(st.indexOf("async function runNv1("), st.indexOf("async function runChar("));
assert(/applyTeacherExtras\(teacher, teacherRole, res, answerEntry\)/.test(rn), "题卡/证据只挂老师名下");
assert(/await runNv1\(teacher, peer, teacherRole,/.test(st));
assert(!/followUp/.test(st), "两棒那套拆干净");
console.log("study-costudy-nv1-73-14 ok");
