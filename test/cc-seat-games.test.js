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
  assert.match(seg, /!window\.CCSeat\) return \{ seat: seat, rest: withoutSeat, done: null, unavailable: true, reason:/);
  assert.match(seg, /if \(!done\) return \{ seat: seat, rest: withoutSeat, done: null, unavailable: true, reason:/);
  assert.match(seg, /catch \(e\) \{ return \{ seat: seat, rest: withoutSeat, done: null, unavailable: true, reason:/);
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
  // 开局与海龟汤/25问每轮重认等路径，判定条件都必须尊重同一个开关。
  assert.ok((games.match(/cfg\.ccSeat !== false && props\.isEngineer/g) || []).length >= 5,
    "所有游戏的开局/续局/重认路径都要尊重 ccSeat 开关");
  assert.doesNotMatch(games, /engineer: !!\(props\.isEngineer/, "不许有绕过开关的写法");
});

test("开局前就能看见开关：不必先选中言秋才突然出现", () => {
  assert.match(games, /const ccSeatSupported = true/);
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

test("狼人杀 CC 夜间票失败也绝不交给 Gemini 接管", () => {
  const night = games.slice(games.indexOf("async function genNight("), games.indexOf("// AI 狼意见不一致"));
  assert.match(night, /const remainingWolves = \(opts\.wolfTeam \|\| \[\]\)\.filter/);
  assert.match(night, /needWolf: remainingWolves\.length > 0/);
  assert.match(night, /opts = Object\.assign\(\{\}, opts, \{ needSeer: false \}\)/);
  assert.match(night, /opts = Object\.assign\(\{\}, opts, \{ needGuard: false \}\)/);

  const witch = games.slice(games.indexOf("async function genWitch("), games.indexOf("// 猎人 / 狼王"));
  const hunter = games.slice(games.indexOf("async function genHunter("), games.indexOf("// 白狼王"));
  const whiteWolf = games.slice(games.indexOf("async function genWhiteWolf("), games.indexOf("function validWolfTarget"));
  assert.match(witch, /return \{ save: false, poison: null \};/);
  assert.match(hunter, /return \{ target: null \};/);
  assert.match(whiteWolf, /return \{ selfDestruct: false, target: null \};/);
});

test("狼人杀每一夜都实时重认言秋工牌，不能被旧局快照吞票", () => {
  const night = games.slice(games.indexOf("const enterNight = async function"), games.indexOf("// 狼刀 + 预言家定好后走这里"));
  assert.match(night, /const nightList = list\.map\(function \(p\) \{/);
  assert.match(night, /cfg\.ccSeat !== false && props\.isEngineer && props\.isEngineer\(p\.key\)/);
  assert.match(night, /setPlayers\(nightList\)/);
  assert.match(night, /wolfTeam: aiWolves\.map\(function \(w\) \{ return \{ name: w\.name, skill: w\.skill, engineer: w\.engineer, key: w\.key \}; \}\)/);
  assert.match(night, /言秋的" \+ ccMiss\.action \+ "票没送到/,
    "亲打票失败必须给 Lisa 明确原因，不能静默让 Gemini 接管或像没发生过一样结算");
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

test("谁是卧底描述必须像真人随口给短线索，禁止百科与散文答辩", () => {
  const clue = games.slice(games.indexOf("async function genClues("), games.indexOf("// 投票：存活 AI"));
  assert.match(clue, /一句 6～18 个汉字的口语/);
  assert.match(clue, /不要下定义/);
  assert.match(clue, /不要解释原理\/机械结构/);
  assert.match(clue, /不要写百科、产品评测或说明书/);
  assert.match(clue, /别写成散文谜语/);
  assert.match(clue, /像饭桌上脱口而出的短话/);
  assert.match(clue, /小时候家里有一个/);
});

test("谁是卧底每局都有独立 CC 票号，新局不复用第一局旧回答", () => {
  assert.match(games, /const gameRunId = useRef\(\(sv && sv\.runId\) \|\| \("spy-" \+ Date\.now\(\)\.toString\(36\)/);
  assert.match(games, /saveGameSnap\("spy", \{ runId: gameRunId\.current/);
  assert.doesNotMatch(games, /turnId: "spy:" \+ rnd/);
  assert.doesNotMatch(games, /turnId: "spy:vote:" \+ round/);
});

test("谁是卧底：言秋被投出后收到真实票型、公开身份与离场结果", () => {
  assert.match(games, /game: "spy_eliminated"/);
  assert.match(games, /gameRunId\.current \+ ":eliminated:" \+ round \+ ":" \+ out\.key/,
    "淘汰通知必须按局、轮次、座位幂等，不能重复送票");
  assert.match(games, /本轮票型：\\n" \+ voteLines/);
  assert.match(games, /公开身份是【" \+ \(out\.role === "spy" \? "卧底" : "平民"\) \+ "】/);
  assert.match(games, /你已经离场，不再描述、不再投票/);
  assert.match(games, /if \(say\) pushLog\(\[\{ type: "clue", name: out\.name, text: say\.slice\(0, 500\) \}\]\)/,
    "言秋的离场反应要回到牌桌可见日志");
  assert.match(games, /离线时不让 Gemini 冒充补话/);
});

test("所有有终局的小游戏都统一给言秋送赛果，不再只报 Lisa 赢 UNO", () => {
  assert.match(games, /function ccGameResult\(gameKey, runId, seats, cfg, summary, onSay, onStatus\)/);
  assert.match(games, /const seat = \(seats \|\| \[\]\)\.find\(function \(p\) \{ return p && p\.engineer && !p\.isUser; \}\)/,
    "言秋即使已淘汰也必须收到最后结局");
  assert.match(games, /String\(gameKey\) \+ ":" \+ String\(runId \|\| "unknown"\) \+ ":result"/,
    "终局票必须有稳定幂等号");
  ["spy", "werewolf", "monopoly", "avalon", "uno"].forEach((key) => {
    assert.match(games, new RegExp('ccGameResult\\("' + key + '"'), key + " 缺终局回执");
  });
  assert.match(games, /ccGameResult\(kind, gameRunId\.current/, "海龟汤 / 25 问共享结算也必须送终局回执");
  assert.doesNotMatch(games, /state\.winner !== "lisa"/, "UNO 不能再只在 Lisa 获胜时通知");
  assert.match(games, /身份揭晓：/);
  assert.match(games, /最终排名：/);
  assert.match(games, /最终余牌：/);
});

test("海龟汤与 25 问每轮保留 CC 工牌，不能只剩名字和能力", () => {
  const seg = games.slice(games.indexOf("const runRound = async function (uq)"), games.indexOf("const formalGuess"));
  assert.match(seg, /cfg\.ccSeat !== false && props\.isEngineer && props\.isEngineer\(p\.key\)/);
  assert.match(seg, /return \{ key: p\.key, name: p\.name, skill: p\.skill, engineer: engineer, alive: p\.alive \};/);
  assert.doesNotMatch(seg, /return \{ name: p\.name, skill: p\.skill \};/);
});

test("真心话大冒险本人票失败就停轮，不挂备用台词到他名下", () => {
  const seg = games.slice(games.indexOf("async function genTDForAI"), games.indexOf("// 从整局日志"));
  assert.match(seg, /throw new Error\(cc\.reason \|\| "本人回答票未送达"\)/);
  assert.match(seg, /throw new Error\(cc\.reason \|\| "本人出题票未送达"\)/);
  assert.match(games, /if \(asker && asker\.engineer\) \{ setUserPrompt\(null\); setPhase\("idle"\); \}/);
});

test("大富翁攒批次后会给本人一张桌上发言票", () => {
  const seg = games.slice(games.indexOf("async function monoTalk"), games.indexOf("function MonopolyGame"));
  assert.match(seg, /await ccCarve\("monopoly", pool, \{/);
  assert.match(seg, /cc\.rest\.map/);
  assert.match(seg, /cc\.done\.lines/);
});

test("阿瓦隆关键票失败只走法官规则兜底，不让模型冒充本人", () => {
  const propose = games.slice(games.indexOf("async function genProposal"), games.indexOf("async function genAvVotes"));
  assert.match(propose, /本人组队票未送达，法官按座次补队/);
  const assassin = games.slice(games.indexOf("async function genAssassin"), games.indexOf("function AvalonGame"));
  assert.match(assassin, /throw new Error\(cc\.reason \|\| "本人刺杀票未送达"\)/);
});

test("UNO 本人票失败不再回退 Gemini 代打", () => {
  const seg = games.slice(games.indexOf("async function routeSeatCall"), games.indexOf("function unoJson"));
  assert.match(seg, /return \{ value: null, delegated: false, ccUnavailable: true/);
  assert.doesNotMatch(seg, /delegated: canCc/);
  assert.doesNotMatch(seg, /离线\/超时无感退回/);
});

test("送给 CC 的游戏票不再重复声明他叫什么", () => {
  assert.doesNotMatch(games, /你是刚才亲自坐在桌上的/);
  assert.doesNotMatch(games, /你是言秋座位/);
  assert.doesNotMatch(games, /你是「" \+ cc(?:Seat0|Voter)\.name/);
  assert.doesNotMatch(games, /你是刺客「" \+ assassin\.name/);
});
