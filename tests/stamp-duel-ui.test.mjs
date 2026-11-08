import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const ui = readFileSync(new URL("../js/stamp-duel-ui.js", import.meta.url), "utf8");
const st = readFileSync(new URL("../js/stamps.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const ts = readFileSync(new URL("../js/theme-studio.js", import.meta.url), "utf8");
const idx = readFileSync(new URL("../index.html", import.meta.url), "utf8");
test("邮票册右上「对局」进对局页；打完先选再来一把／结束，结束才问记不记", () => {
  assert.match(st, /tab === "duel"\) return !window\.StampDuelPage/);
  assert.match(st, /onRemember: props\.onDuelRemember, closeOf: props\.duelCloseOf/);
  assert.match(app, /onDuelRemember: \(charId, line\) =>/);
  assert.match(app, /duelCloseOf: charId =>/);
  assert.match(ui, /D\(\)\.addGame\(series, st\)/);
  assert.match(ui, /onRemember\(foeId, D\(\)\.memoryLine\(sr, foeName, meName\)\)/);
  assert.match(idx, /data-lazy="stamps" data-src="js\/stamp-duel-ui\.js/);
  for (const k of ["stampgoduel", "duelpage", "duelcell", "duelhand", "duelsend", "duelintent", "duelremember"]) assert.ok(ts.includes('"' + k + '"'), k);
});
test("票上放卡面（走邮票册那份缩略图）、写是谁的卡；有撤回键", () => {
  assert.match(st, /useThumb: useStampThumb \}\);/);
  assert.match(ui, /ownerOf = id => id && nameOf\(id\) \? nameOf\(id\) \+ "的卡"/);
  assert.match(ui, /"data-wk": "duelundo", onClick: back1, disabled: !D\(\)\.canUndo\(st\)/);
});
test("明牌摊开对面手牌、标要贴；寄出后照这一回合的记录放特效，放完才能再寄", () => {
  assert.match(ui, /!st\.blind && them\.hand\.length \? h\("div", \{ "data-wk": "duelfoehand"/);
  assert.match(ui, /const evs = st\.log\.slice\(n0\)/);
  assert.match(ui, /"data-wk": "duelsend", onClick: send, disabled: !!fx/);
});
test("没打完退出去留存档：开局页出「接着打／放弃」，打完或放弃才清", () => {
  assert.match(ui, /const SAVE_KEY = "x_stampDuelSave"/);
  assert.match(ui, /if \(x && !x\.over\) saveJSON\(SAVE_KEY/);
  assert.match(ui, /"data-wk": "duelresume"/);
  assert.match(ui, /setSeries\(null\); setSt\(null\); persist\(null\);/);
});
test("边打边聊：她发一句才叫一次 TA，带着眼下局面；聊天跟着这一局存", () => {
  assert.match(st, /onChat: props\.onDuelChat/);
  assert.match(app, /onDuelChat: async \(charId, d\) =>/);
  assert.match(app, /tag: "stampduel", maxTokens: 8000/);
  assert.match(ui, /const lines = await onChat\(foeId, \{ text, board: boardLine\(\), history: hist \}\)/);
  assert.match(ui, /st\.chat = st\.chat \|\| \[\]/);
});
test("带谁上场、长按看底细、她自己那一下也慢放", () => {
  assert.match(ui, /D\(\)\.deckFrom\(pool, s, D\(\)\.DECK_SIZE, core\)/);
  assert.match(ui, /newDuel\(me, them, s, \{ blind, bonds: bondsOf\(\), foeId, hard, rule/);
  assert.match(ui, /function useLongPress\(onLong, onTap\)/);
  assert.match(ui, /"data-wk": "duelinfo"/);
  assert.match(ui, /const doMine = fn =>/);
});
test("对局页里有人话版「怎么玩」：右上角随时点开，整页", () => {
  assert.match(ui, /const GUIDE = \[/);
  assert.match(ui, /if \(guide\) \{/);
  assert.ok((ui.match(/right: guideBtn/g) || []).length >= 3);
  assert.match(ts, /"duelguide"/);
});
test("跟 TA 聊时带上两边信封上的票和卡上那句；长按不弹系统菜单", () => {
  assert.match(ui, /"。你信封上贴着："/);
  assert.match(ui, /"。她信封上贴着："/);
  assert.match(ui, /WebkitTouchCallout: "none"/);
});
test("新手教学关：开局页能进、九步教练条、不存档；对面会说话、有打法；能跳过动画", () => {
  assert.match(ui, /const TUT = \[/);
  assert.match(ui, /modeCard\("duelturorial", GREEN, "新手教学关"/);
  assert.match(ui, /\(x && \(x\.tutorial \|\| x\.run\)\) \|\| runBattle\) return;/);
  assert.match(ui, /"data-wk": "duelsay"/);
  assert.match(ui, /"data-wk": "duelskip", onClick: skip/);
  // 钩子不许放在提前 return 后面（React #310）
  const ret = ui.indexOf("if (guide) {");
  assert.ok(ui.indexOf("const lastBubble = useRef(0)") < ret && ui.indexOf("const [tut, setTut] = useState(-1)") < ret);
});
test("彩头、复盘、战绩、难度、规则局、快捷表情、动手那张拿起来", () => {
  assert.match(ui, /const WAGERS = \[/);
  assert.match(ui, /onChat\(foeId, \{ mode, wager: st\.wager, winner: over\.winner/);
  assert.match(app, /d\.mode === "wager"/);
  assert.match(app, /tags: \["邮票对局", "彩头"\]/);
  assert.match(ui, /const STATS_KEY = "x_stampDuelStats"/);
  assert.match(ui, /meHp: handi === "meMore"/);
  assert.match(ui, /const ruleOfWeek = \(\) =>/);
  assert.match(ui, /const EMOTES = \[/);
  assert.match(ui, /const liftOf = i =>/);
});
test("滑到下面点寄出不跳回顶上：寄出、贴票、回放那一阵守住她滑到的位置", () => {
  assert.match(ui, /const bodyEl = useRef\(null\), keepY = useRef\(0\), touchAt = useRef\(0\), guard = useRef\(0\)/);
  assert.match(ui, /guard\.current = Date\.now\(\) \+ 15000;/);
  assert.match(ui, /key: "bd", ref: bodyEl/);
});
const cmp = readFileSync(new URL("../js/components.js", import.meta.url), "utf8");
test("跟聊天连着：战报卡发进聊天、TA 发对局邀请、点卡带着对手和彩头进对局页", () => {
  assert.match(app, /kind: "duelreport"/);
  assert.match(app, /openCaps\.push\("duelAsk"\)/);
  assert.match(app, /kind: "duelask", say, wager, state: "pending"/);
  assert.match(app, /window\.__stampsDuel = \{ foeId: charId, wager:/);
  assert.match(cmp, /if \(m\.kind === "duelask" \|\| m\.kind === "duelreport"\) return h\(DuelChatCard/);
  assert.match(st, /const \[tab, setTab\] = useState\(duelPreset \? "duel" : "pull"\)/);
  assert.match(ui, /"data-wk": "duelreportgo"/);
  // 战报卡点完不替 TA 开口（施工规则/wait-for-her.md）
  const i = app.indexOf("const duelReport = "), body = app.slice(i, i + 600);
  assert.doesNotMatch(body, /replyNow|runProbe|callAI/);
});
test("点对战先挑玩法：对局／远信／新手教学关，挑了对局再进设定；从聊天进来直接到对局", () => {
  assert.match(ui, /if \(!st && !mode\) return shell\(/);
  assert.match(ui, /useState\(\(\) => \(preset \|\| runBattle\) \? "duel" : ""\)/);
  for (const k of ["duelmodeduel", "duelgorun", "duelturorial"]) assert.ok(ui.includes('"' + k + '"'), k);
});
test("明牌虚线和上手提示：对面要打哪儿画线、空格写贴这儿会打谁、手牌上一行现在能干嘛", () => {
  assert.match(ui, /function AimLayer\(/);
  assert.match(ui, /foeAims: st\.blind \? \[\] : D\(\)\.aims\(st, "foe"\)/);
  assert.match(ui, /D\(\)\.previewPlace\(st, "me", handSel, i\)/);
  assert.match(ui, /"data-wk": "dueltip"/);
  assert.match(ts, /"duelaims"/); assert.match(ts, /"dueltip"/);
});
test("明牌两边都标：每张票这回合干什么、你能打到的绿框", () => {
  assert.match(ui, /meActs: D\(\)\.actsOf\(st, "me"\)/);
  assert.match(ui, /"data-wk": "duelact"/);
  assert.match(ui, /const Seal = \(label/);
});
