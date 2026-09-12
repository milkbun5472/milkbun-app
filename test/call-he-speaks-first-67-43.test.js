// 她 2026-09-12（看着一条未接来电）：
//  ①「不知道是打了我没看到还是只是显示未接但是根本没播」
//  ②「现在他打过来也是要我开口第一句，能不能搞他说第一句话」
//  ③「连续播放的时候要是他说最后一句然后主动挂，他最后一句也来不及播放就挂了」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const app = R("js/app.js"), comp = R("js/components.js");
const strip = s => s.split("\n").map(l => l.split("//")[0]).join("\n");
const A = strip(app), C = strip(comp);

// ── ① 补记的未接 ≠ 响过你没接 ────────────────────────────────
test("来得太晚没响的那一通，界面上说得出自己没响过", () => {
  const i = A.indexOf("const ringFromChar = (char, mode, whenTs, lateMin) => {");
  const body = A.slice(i, A.indexOf("\n  };", i));
  assert.match(body, /if \(missed\) \{ inv\.answered = "missed"; inv\.lateMissed = true; \}/);
  assert.match(body, /if \(!missed\) setRinging\(/, "迟到很久的还是不许响——那一条没动");
  // 回执两种说法要不一样，不然她还是分不出来
  assert.match(C, /m\.lateMissed \? "他当时打过来了 · 补记（手机没响）" : "未接" \+ \(video \? "视频" : "语音"\) \+ "通话"/);
});

// ── ② 他打来的，他先开口 ────────────────────────────────────
test("他拨过来、她接起来之后，由他先说第一句", () => {
  assert.match(A, /if \(next\.caller && next\.caller !== "me"\) setTimeout\(/, "接起来之后没有人去开这一枪");
  const i = A.indexOf('if (next.caller && next.caller !== "me") setTimeout(');
  const blk = A.slice(i, i + 340);
  assert.match(blk, /c0 && c0\.sessionId === next\.sessionId/, "不认这一通就开枪：挂了再接会串到上一通");
  assert.match(blk, /callSend\("", \{ opening: true \}\)/);
});

test("她自己拨出去的那一路不变——那本来就该她先开口", () => {
  const i = A.indexOf("const startCall = (participants, mode, groupId, caller, chatKey) => {");
  const blk = A.slice(i, A.indexOf("\n  };", i));
  assert.ok(blk.indexOf('caller !== "me"') > 0, "条件写反了就会变成她拨过去也由他先说");
  assert.match(blk, /caller: caller \|\| "me"/);
});

test("opening 这一轮不往对话里塞一条她没说过的话", () => {
  const i = A.indexOf("const callSend = async (text, opts) => {");
  assert.ok(i > 0, "callSend 没收这个参数");
  const blk = A.slice(i, i + 800);
  assert.match(blk, /const opening = !!\(opts && opts\.opening\);/);
  assert.match(blk, /if \(!opening && \(!text \|\| !text\.trim\(\)\)\) return;/, "普通那一路照旧要有话才发");
  assert.match(blk, /let withUser = cur\.msgs;\n\s*if \(!opening\) \{/, "opening 还是把空字符串当成她的一条消息了");
  assert.match(blk, /if \(laneBusy\("call"\)\) return;/, "并发闸不许拆");
});

test("user 那一栏只放一句触发，料全在 system（prompt-send-shape）", () => {
  assert.match(A, /const callOpenTrigger = \(\) => \(\{ role: "user", content: "（电话接通了）" \}\);/);
  // 单人和群通话两支都要补，空 messages 有的上游直接打回来
  assert.equal((A.match(/hist\.push\(callOpenTrigger\(\)\)/g) || []).length, 2, "两支都要接（四处一样喂）");
});

test("告诉他这是接通后的第一句，别反过来问「你怎么不说话」", () => {
  const i = A.indexOf("+ (opening ? ");
  assert.ok(i > 0, "那一句没发下去");
  const blk = A.slice(i, i + 420);
  assert.match(blk, /【这是接通后的第一句】/);
  assert.match(blk, /\*\*你先开口\*\*/);
  assert.match(blk, /别问「喂？怎么不说话」/);
  assert.match(blk, /别当成是 Ta 打给你的/, "这一句在 whoCalled 里已经有一次，接通那一下最容易搞反");
});

// ── ③ 他最后那句得说完再挂 ──────────────────────────────────
test("他要挂的时候，自动播报不许当场失效", () => {
  assert.match(C, /audioRef\.current\.enabled = autoVoice && audioReady;/);
  assert.ok(!/audioRef\.current\.enabled = autoVoice && audioReady && !bye;/.test(C), "bye 又被挂回这一行了");
  assert.match(C, /if \(!autoVoice \|\| !audioReady\) return;/, "播放循环的早退里也不许有 bye");
});

test("等他把话说完再收线，而且不许永远挂不掉", () => {
  const i = C.indexOf("const byeRef = useRef(false);");
  assert.ok(i > 0, "挂断那一段没了");
  const blk = C.slice(i, i + 1100);
  assert.match(blk, /lvStop\(\);/, "他要挂了就别再录她说话");
  assert.match(blk, /const quiet = \(\) => !audioRef\.current\.enabled \|\| \(!st\.speaking && !st\.busy && st\.played >= msgsRef\.current\.length\)/,
    "「说完了没有」要同时看：队列空了、没在念、也没在合成");
  assert.match(blk, /if \(quiet\(\)\) \{\n\s*const tm = setTimeout\(\(\) => onHangup\(secRef\.current, "them"\), 1800\);/,
    "没开自动播报时照旧留 1.8 秒给她看完");
  assert.match(blk, /setInterval\(\(\) => \{ if \(quiet\(\)\) \{ clearInterval\(poll\); setTimeout\(finish, 900\); \} \}, 250\)/);
  assert.match(blk, /setTimeout\(\(\) => \{ clearInterval\(poll\); finish\(\); \}, 90000\)/, "合成卡住就永远挂不掉了");
  assert.match(blk, /if \(done\) return; done = true;/, "兜底和轮询可能同时到，收线只许一次");
});

test("病历留在代码里", () => {
  const i = comp.indexOf("const byeRef = useRef(false);");
  const doc = comp.slice(Math.max(0, i - 1400), i);
  assert.match(doc, /最后那句【一个字都没念出来】/);
  assert.match(doc, /2026-09-12/);
});
