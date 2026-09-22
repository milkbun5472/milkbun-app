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

test("段数跟着在场人数走，不再写死 2~5", () => {
  assert.doesNotMatch(fn, /一次产出 2~5 个 beat/, "还是那个写死的 5");
  assert.match(fn, /一次产出 2~" \+ gBeatMax \+ " 个 beat（在场 " \+ members\.length \+ " 个人）/);
  const line = /const gBeatMax = .+;/.exec(fn);
  assert.ok(line, "没有 gBeatMax");
  const at = n => { const c = { members: { length: n }, Math: Math }; vm.runInNewContext(line[0].replace("members.length", "members.length") + "\nthis.out = gBeatMax;", c); return c.out; };
  assert.equal(at(2), 5, "两个人还是给到 5，别比原来少");
  assert.equal(at(3), 5);
  assert.equal(at(7), 9, "七个人的时候还是只能四个说话");
  assert.equal(at(12), 10, "没封顶，一轮会变成点名册");
});

test("镜头轮到没出声的人身上，不等她点名", () => {
  assert.match(fn, /const gQuiet = members\.map\(c => c\.name\)\.filter\(n => gLastSpoke\.indexOf\(n\) < 0\)/);
  assert.match(fn, /别老是同几个人开口/);
  assert.match(fn, /优先把镜头给还没出过声的/);
  assert.match(fn, /谁开口不该等用户点名/, "没说清「点名」这件事本身就是病");
  // 上一轮＝最后一批连着的 char 消息（中间隔了用户就不算同一轮）
  assert.match(fn, /if \(arr\[i\]\.role !== "char"\) break;/);
  // 人少的时候不啰嗦
  assert.match(fn, /members\.length >= 4 && gLastSpoke\.length && gQuiet\.length/);
  assert.match(fn, /gRotateLine/, "拼好了却没发出去");
  assert.equal((fn.match(/\+ gRotateLine \+/g) || []).length, 1, "轮换那句没挂进 system，或者挂了两遍");
});

// ⚠️「让他们都发言」不等于「每个人都必须说话」：真实的多人相处里有人安静在场是对的。
// 这一条防的是把一条规矩改过头，变成每轮点名册（施工规则/bans-make-it-dumber）。
test("没改成每个人都必须开口", () => {
  assert.match(fn, /没有反应必要的人可以安静在场/, "把「可以不说话」删掉了 —— 那就是另一种八股");
  assert.match(fn, /不是每个人都必须说话/);
});
