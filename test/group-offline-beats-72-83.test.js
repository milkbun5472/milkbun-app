// 她 2026-09-22 转来群里读者：「多人群聊线下怎么能让他们都发言呀」「还得点名」，
// 她自己补了一句：「7 个人上限拉满一次最多只有 4 个」。
//
// 病根：那句输出规格写死成「一次产出 2~5 个 beat」，跟在场几个人一点关系都没有。
// 七个人里去掉旁白，最多也就四个开得了口 —— 她把字数上限拉满也没用，拦她的根本不是字数。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");

const i = eng.indexOf("async function generateOfflineGroup("), j = eng.indexOf("\nasync function ", i + 10);
assert.ok(i > 0 && j > i, "抠不出 generateOfflineGroup");
const fn = eng.slice(i, j);
// ⚠️注释里引用被删掉的旧句子，会让「它没了」这种断言永远红（反过来也会假绿）。
//   所以凡是「某句话不许再出现」的判断，一律对【去掉注释的代码】来问。
const bare = src => src.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
const fnCode = bare(fn);

test("段数跟着在场人数走，不再写死 2~5", () => {
  assert.doesNotMatch(fnCode, /一次产出 2~5 个 beat/, "还是那个写死的 5");
  // v73.00：不只给上限，还给下限 —— 她 2026-09-22 第三次报「线下还是只有四个人说话」。
  // 光把天花板抬到 9，模型照样写 4：没人跟它说【下限】是多少。
  assert.match(fn, /一次产出 " \+ Math\.min\(members\.length, gBeatMax\) \+ "~" \+ gBeatMax \+ " 个 beat（在场 " \+ members\.length \+ " 个人）/);
  assert.match(fn, /在场每个人至少占一段/);
  const line = /const gBeatMax = .+;/.exec(fn);
  assert.ok(line, "没有 gBeatMax");
  const at = n => { const c = { members: { length: n }, Math: Math }; vm.runInNewContext(line[0].replace("members.length", "members.length") + "\nthis.out = gBeatMax;", c); return c.out; };
  assert.equal(at(2), 5, "两个人还是给到 5，别比原来少");
  assert.equal(at(3), 6);
  assert.equal(at(7), 10, "七个人的时候还是只能四个说话");
  assert.equal(at(12), 12, "没封顶，一轮会变成点名册");
});

// v72.90：这一条搬成了公共的 rotateSpeakersNote，群线上也接上了
// （她 2026-09-22：「为啥还是只有四个人说话」—— 原来只给线下接了）
test("镜头轮到没出声的人身上，不等她点名", () => {
  assert.match(fn, /const gRotateLine = rotateSpeakersNote\(members, session\.msgs\)/, "线下没走公共那一份");
  assert.equal((fn.match(/\+ gRotateLine \+/g) || []).length, 1, "轮换那句没挂进 system，或者挂了两遍");
  const i = eng.indexOf("function rotateSpeakersNote(members, msgs) {"), j = eng.indexOf("// 模型回填的那个名字", i);
  assert.ok(i > 0 && j > i, "抠不出 rotateSpeakersNote");
  const note = eng.slice(i, j);
  assert.match(note, /别老是同几个人开口/);
  assert.match(note, /优先把镜头给还没出过声的/);
  assert.match(note, /谁开口不该等用户点名/, "没说清「点名」这件事本身就是病");
  assert.match(note, /if \(arr\.length < 4\) return "";/, "人少的时候还啰嗦");
  // 上一轮＝最后一批连着的 char 消息（中间隔了用户就不算同一轮）
  assert.match(eng, /if \(arr\[i\]\.role !== "char"\) break;/);
  // 认人优先按 id：重名的两位不会被算成同一个人
  assert.match(eng, /const k = arr\[i\]\.senderId \|\| arr\[i\]\.senderName;/);
});

test("群线上也接上了这一条（原来只有线下有）", () => {
  const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
  assert.match(app, /hist \+ rotateSpeakersNote\(members, groupChatsRef\.current\[groupId\]\)/, "群线上没接");
});

// ⚠️「让他们都发言」不等于「每个人都必须说话」：真实的多人相处里有人安静在场是对的。
// 这一条防的是把一条规矩改过头，变成每轮点名册（施工规则/bans-make-it-dumber）。
// ⚠️「都出现」不等于「都开口」。这一条防的是把规矩改过头，变成每轮点名册。
// v73.00 改了口径：原来那句「没有反应必要的人可以安静在场」等于发了一张【跳过谁】的
// 许可证，模型每轮都拿它省事。按 no-yes-unless，那句直接重写，没在后面挂「但是」。
test("要求的是都【出现】，不是都【开口】", () => {
  assert.doesNotMatch(fnCode, /没有反应必要的人可以安静在场/, "那张跳过许可证还在");
  assert.match(fn, /在场的每个人这一轮都得出现在画面里/);
  assert.match(fn, /没什么话要说的人就写 TA 此刻在做什么/, "没给「不说话的人怎么写」的出口");
  assert.match(fn, /别为了凑数给谁硬安一句台词/, "没挡住为了凑数硬编台词");
  // 线上是另一回事：微信群里没人每轮都冒泡，那份共用提醒照旧留着出口
  assert.match(eng, /不是每个人都必须说话/, "线上那份共用提醒里的出口没了");
});
