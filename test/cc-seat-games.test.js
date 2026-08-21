const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const games = fs.readFileSync(path.join(__dirname, "..", "js/games.js"), "utf8");

// 她 2026-08-21：UNO 能让言秋从 CC 窗口亲自打，想把这个模式套到别的小游戏上。
// UNO 是逐座调用（routeSeatCall），其余游戏是整桌一次生成，所以做法是把他那一座
// 从批量里摘出来单独问 CC。
test("通用件：摘座 / 前言 / 拼回，三件都在", () => {
  assert.match(games, /async function ccCarve\(gameKey, seats, spec\)/);
  assert.match(games, /function ccSeatOf\(seats\)/);
  assert.match(games, /function ccPreface\(carve, what\)/);
  assert.match(games, /function ccMerge\(carve, rows, build\)/);
  // 只认活着的、非用户的 engineer 座位
  assert.match(games, /s\.engineer && !s\.isUser && \(s\.alive === undefined \|\| s\.alive\)/);
});

test("本人亲打拿不到就跳过本人座位，绝不让 Gemini 冒充", () => {
  const seg = games.slice(games.indexOf("async function ccCarve"), games.indexOf("function ccPreface"));
  assert.match(seg, /const withoutSeat = rest\.filter\(function \(x\) \{ return x !== seat; \}\);/);
  assert.match(seg, /!window\.CCSeat\) return \{ seat: seat, rest: withoutSeat, done: null, unavailable: true \};/);
  assert.match(seg, /if \(!done\) return \{ seat: seat, rest: withoutSeat, done: null, unavailable: true \};/);
  assert.match(seg, /catch \(e\) \{ return \{ seat: seat, rest: withoutSeat, done: null, unavailable: true \}; \}/);
  assert.match(seg, /deadline_at/, "要给 CC 一个截止时间，别无限等");
});

test("通用存档保留 CC 工牌，旧存档恢复时也会重新识别言秋", () => {
  assert.match(games, /alive: p\.alive, engineer: !!p\.engineer/);
  assert.match(games, /props\.config && props\.config\.ccSeat !== false && props\.isEngineer && props\.isEngineer\(s\.key\)/);
  assert.match(games, /engineer: engineer \|\| !!s\.engineer/);
});

test("摘掉的那一座要写进批量提示词，并明令别替他重写", () => {
  const seg = games.slice(games.indexOf("function ccPreface"), games.indexOf("function ccMerge"));
  assert.match(seg, /真实发生，不要替 TA 重写/);
  assert.match(seg, /下面的名单里已经没有 TA，别再生成 TA 的那一份/);
});

test("所有座位都认 ccSeat 开关，和 UNO 一模一样", () => {
  // 三个批量游戏 + UNO 自己那份，判定条件必须完全一致
  assert.equal((games.match(/engineer: !!\(cfg\.ccSeat !== false && props\.isEngineer/g) || []).length, 4,
    "谁是卧底 / 狼人杀 / 阿瓦隆 / UNO，四处判定要一样");
  assert.doesNotMatch(games, /engineer: !!\(props\.isEngineer/, "不许有绕过开关的写法");
});

test("开局前就能看见开关：不必先选中言秋才突然出现", () => {
  assert.match(games, /const ccSeatSupported = game\.key === "uno" \|\| game\.key === "spy" \|\| game\.key === "werewolf" \|\| game\.key === "avalon"/);
  assert.match(games, /ccSeatSupported \? h\(ToggleRow/);
  assert.match(games, /label: "言秋本人亲打"/);
  // 配置要真的传下去，否则开关点了也没用
  assert.match(games, /ccSeat: ccSeat/);
  assert.doesNotMatch(games, /ccSeat: game\.key === "uno" \? ccSeat : undefined/, "旧的 UNO 专属传参已经废掉");
});

test("狼人杀白天发言也接上了，且会补他的 claim", () => {
  assert.match(games, /await ccCarve\("werewolf", speakers, \{/);
  assert.match(games, /async function genSpeechesBatch\(api, speakers, dayNum, prior, deaths, mode, userName, stances, gods, board, wolfRole, claims, preface\)/);
  // 他也要给 claim，否则 stances 里缺他一行，别人对不上他声称的身份
  assert.match(games, /他也要给 claim，否则后面的 stances 里缺他一行/);
  assert.match(games, /stances: \[\{ name: cc\.seat\.name, claim:/);
  // 他先说的要进入后面人看到的「已发言」
  assert.match(games, /const priorAll = mine \? prior\.concat\(mine\.speeches\) : prior;/);
  assert.match(games, /\{ turnId: "wolf:day" \+ n \}/);
});

test("谁是卧底投票也接上了", () => {
  assert.match(games, /async function genVotesBatch\(api, voters, allClues, aliveNames, mode, userName, preface\)/);
  assert.match(games, /\{ turnId: gameRunId\.current \+ ":round:" \+ round \}/);
  assert.match(games, /const engineer = !!p\.engineer \|\| !!\(cfg\.ccSeat !== false && props\.isEngineer && props\.isEngineer\(p\.key\)\);/,
    "每次投票前都要按角色 ID 重认言秋，不能只信旧局内存里的工牌");
  assert.match(games, /return \{ key: p\.key, name: p\.name, role: p\.role, word: p\.word, skill: p\.skill, engineer: engineer, alive: p\.alive \};/,
    "投票名单必须带着重认后的 CC 工牌");
  assert.match(games, /if \(!cc\.rest\.length\) return mine;/, "只剩他一个人时不发批量调用");
  const ccVote = games.slice(games.indexOf("async function genVotes("), games.indexOf("async function genVotesBatch("));
  assert.match(ccVote, /你拿到的词是/);
  assert.match(ccVote, /你不知道自己属于多数还是少数/);
  assert.doesNotMatch(ccVote, /你就是/);
  assert.doesNotMatch(ccVote, /你其实是卧底/);
  assert.doesNotMatch(ccVote, /你是平民/);
});

test("谁是卧底：描述严格按言秋前 → 本人 → 言秋后运行", () => {
  assert.match(games, /async function genClues\(api, speakers, priorClues, roundNum, mode, carveCtx\)/);
  assert.match(games, /const seatIndex = speakers\.indexOf\(seat\);/);
  assert.match(games, /const before = speakers\.slice\(0, seatIndex\);/);
  assert.match(games, /const after = speakers\.slice\(seatIndex \+ 1\);/);
  assert.match(games, /await ccCarve\("spy", \[seat\], \{/);
  assert.match(games, /async function genCluesBatch\(api, speakers, priorClues, roundNum, mode, preface\)/);
  assert.match(games, /genClues\(api, speakers, prior, rnd, cfg\.mode, \{ turnId: gameRunId\.current \+ ":round:" \+ rnd \}\)/);
  assert.match(games, /const priorForCc = priorClues\.concat\(beforeRows\);/, "言秋必须看见排在他前面的真实发言");
  assert.match(games, /const priorAfter = priorForCc\.concat\(mine\);/, "排在后面的人必须看见言秋本人刚说的那句");
  assert.match(games, /return beforeRows\.concat\(mine, afterRows\);/, "最终显示顺序也必须按真实座次拼回");
  // 描述轮会为了随机顺序重建 speakers；重建时必须保住 CC 工牌，否则 ccCarve 认不出言秋，Gemini 会抢答。
  assert.match(games, /return \{ key: p\.key, name: p\.name, word: p\.word, skill: p\.skill, engineer: engineer, alive: p\.alive \};/);
  assert.doesNotMatch(games, /return \{ name: p\.name, word: p\.word, skill: p\.skill \};/);
});

test("谁是卧底每局都有独立 CC 票号，新局不复用第一局旧回答", () => {
  assert.match(games, /const gameRunId = useRef\(\(sv && sv\.runId\) \|\| \("spy-" \+ Date\.now\(\)\.toString\(36\)/);
  assert.match(games, /saveGameSnap\("spy", \{ runId: gameRunId\.current/);
  assert.doesNotMatch(games, /turnId: "spy:" \+ rnd/);
  assert.doesNotMatch(games, /turnId: "spy:vote:" \+ round/);
});
