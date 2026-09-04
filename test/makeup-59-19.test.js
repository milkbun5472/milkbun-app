// 和好间（言秋提，她 2026-08-31 拍板「和好间我觉得可以，就先松了吧」）。
// ⚠️它凭什么存在：主聊天里拿不到的只有一样——**他没说出口的那一半**。
// 别的都是「把聊天挪个地方摆第二遍」，她当天刚因为这个撤掉了外卖那栏「写给陌生人」。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const K = require("../js/makeup.js");
const app = R("app.js"), scr = R("screens.js"), eng = R("engine.js");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const cut = (s, a, b) => { const i = s.indexOf(a); return s.slice(i, s.indexOf(b, i + a.length)); };
const now = 1700000000000;

test("别扭的门槛给得松，但不许被无关的坏心情点亮", () => {
  // ① 此刻心情朝着人去
  assert.equal(K.signalOf({ mood: { label: "闷", ts: now - 3600000 }, now }).on, true);
  assert.match(K.signalOf({ mood: { label: "闷", ts: now - 3600000 }, now }).why, /心情一直是「闷」/, "没说清为什么亮");
  // ② 冷战也算——不出声也是别扭
  assert.equal(K.signalOf({ mood: { label: "高兴", ts: now }, lastTalkTs: now - 4 * 86400000, now }).kind, "cold");
  // ③ 心情旧了也还给一档：她说了要松
  assert.equal(K.signalOf({ mood: { label: "委屈", ts: now - 10 * 86400000 }, lastTalkTs: now - 3600000, now }).kind, "stale");
  // ④ ⚠️最要紧的一条：他自己累了不算你俩有事。
  //    这份词表跟 app.js 里那份 MOOD_NEG【故意不一样】，不是漏抄。
  ["累", "疲惫", "焦虑", "害怕", "不安"].forEach(w =>
    assert.equal(K.signalOf({ mood: { label: w, ts: now }, lastTalkTs: now - 3600000, now }).on, false, w + "也把和好间点亮了，那是噪音"));
  assert.ok(K.NEG.indexOf("累") < 0 && K.NEG.indexOf("疲惫") < 0, "词表里还留着他自己的状态");
  // ⑤ 什么都没有就不亮
  assert.equal(K.signalOf({ mood: { label: "高兴", ts: now }, lastTalkTs: now - 3600000, now }).on, false);
  assert.equal(K.signalOf({}).on, false);
  // ⑥ 零调用：signalOf 只吃已经存着的两样
  const sig = cut(R("makeup.js"), "function signalOf(o) {", "\n  }\n");
  assert.ok(sig.indexOf("fetch") < 0 && sig.indexOf("callAI") < 0, "检测这一步不许花钱");
});

test("他那一半不许提前和好，也不许写成道歉信", () => {
  const p = K.hisPrompt("裴照川", "Lisa", "他心情一直是「闷」", "裴照川：随便你");
  assert.match(p, /绝不许在这儿把架吵完、也绝不许提前和好/, "最容易写坏的那个方向没挡住");
  assert.match(p, /还在气头上就写还在气头上/, "没许他继续生气");
  assert.match(p, /「我知道我错了」「我只是太在乎你了」/, "没点名那几句现成的软话");
  assert.match(p, /也不许滑到另一头去演冷酷/, "只挡了一头");
  // 必须指得回一件具体的事——不然写出来换个角色照样成立
  assert.match(p, /不是「最近有点不对劲」这种谁都能说的话/, "没挡住那种通用句");
  assert.match(p, /他现在能不能低头——\*\*照实写\*\*/, "第三段没要求照实");
  // ⚠️这一段是【她翻他的心】，不是他讲给她听——口气写错就变成了道歉信
  assert.match(p, /不要写成对她说话的口气/, "没说清这不是说给她听的");
});

test("他回那一句要接住她说的，且只往前挪半步", () => {
  const p = K.replyPrompt("裴照川", "Lisa", "why", "gist", "他那一半", "那我去给你带碗汤");
  assert.match(p, /那我去给你带碗汤/, "她那句没发过去");
  assert.match(p, /【他心里那一半（他自己没说出口的）】\n他那一半/, "他自己那一半没带上，他会答非所问");
  assert.match(p, /她软下来了就别再端着，她还带着刺就别装没听见/, "没要求接住她真正说的那句");
  assert.match(p, /真实的和好是【往前挪半步】/, "一句话就没事了，那不叫和好");
});

test("四条线都接上了：格子、路由、主线上下文、回流", () => {
  // ① 格子在——而且【不别扭的时候也在】，藏起来她永远找不着
  // v59.24：网格换成三个面之后，和好间是「今天」那一块底下的一条纸，不再是格子
  const tile = cut(scr, 'const mkSig = makeupSignalFor ? makeupSignalFor(bCid)', 'eyebrow("墙上"');   // v62.12 英文眉标清掉后锚中文
  assert.match(tile, /openSub\("makeup"\)/, "情侣空间里进不去和好间");  // v62.22 起走 openSub
  assert.match(tile, /mkCur \? "和好间 · 还没了结的那一段" : mkSig\.on \? mkSig\.why : "和好间 · 这会儿没什么事"/, "上面不写为什么亮，跟没亮一样");
  // 没事时不该跟别的一样重：不上底、不抬起
  assert.match(tile, /background: \(mkSig\.on \|\| mkCur\) \? "#f7ebe7" : "transparent"/, "没事时它也占着一整块");
  // ② 整页，不是半窗（.claude/rules/no-half-sheet.md）
  const room = cut(scr, "function MakeupRoom({", "\n}\n");
  assert.match(room, /className: "h-full flex flex-col"/, "没按整页做");
  assert.ok(room.indexOf("h(Sheet") < 0, "用了半窗");
  assert.match(room, /className: "flex-1 min-h-0 overflow-y-auto/, "正文不是那个主滚动容器");
  // ③ ⚠️和好是【主线】的事，不是平行时空——记忆、印象、好感、心情该给的全给
  const open = cut(app, "  const makeupOpen = async char => {", "\n  };");
  assert.match(open, /runProbe\(bgActive \|\| active, ctxFor\(char\)/, "没吃主线上下文，或者没兜住 bgActive 为 null");
  // ⚠️runProbe 的第三个参数是 {instruction, schemaHint}，不是一整串提示词：
  // 传字符串的话 probe.instruction 是 undefined，请求照发、内容全丢，测试和 node --check 都不会说
  assert.match(open, /\{\n\s*instruction: K\.hisPrompt\([\s\S]*?schemaHint: K\.HIS_SHAPE\n\s*\}\)/, "runProbe 的第三个参数形状不对");
  // ④ 回流主线：和好本来就该算数，但只动一点点——不是刷分
  const close = cut(app, "  const makeupClose = (charId, how) => {", "\n  };");
  assert.match(close, /tags: \["和好"\]/, "过去了没写进记忆库");
  assert.match(close, /affOf\(charId\) \+ 1\)/, "好感一点没动，或者动太多了");
  assert.match(close, /how === "mem"/, "「先收起来」那一档也回流了，主线就该一个字都不知道");
  // ⑤ 存的那一份登记了 durable
  assert.match(eng, /"x_makeup"/, "没登记进 durable，攒多了会把 localStorage 写满");
  assert.match(html, /js\/makeup\.js\?v=/, "index.html 没加载这个模块");
  // ⑥ 全局别撞名（如果馆那次 React #130 白屏就是这么来的）
  assert.match(R("makeup.js"), /root\.MakeupKit = api/, "全局叫法不对");
  assert.ok(scr.indexOf("function MakeupKit") < 0, "组件跟模块撞名了，会白屏");
});
