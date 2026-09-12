// 她 2026-09-12：「现在群聊是好了，可以 a 回复我然后 b 先接 a 的话继续说，
//                   但是说完了 a 不会再说，是因为没话可说还是还是不行」
//
// 不是没话可说。下限那一行写的是 Math.min(3, members.length)——
// **把「这一轮几条」当成了「几个人开口」**。可这两个数不一样，因为同一个人
// 一轮里可以说好几次。两个人的群，下限就成了 2：A 回她一句、B 接 A 一句，
// 正好两条，模型交差了。一来一回的那个「回」压根没算进下限里。
//
// 跟 v67.20 那个「50 条」是同一类：把两个单位不同的数当成同一个数
// （那次是「条」和「行」，这次是「条」和「人」）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const strip = s => s.split("\n").map(l => l.split("//")[0]).join("\n");
const A = strip(app);

// 那三行是自成一体的：给它人数和 rgOpts 就能算
// ⚠️抠那几行时别钉死它现在长什么样：钉死了，改坏它就成了「测试自己跑不起来」，
//   下面那些断言反而没机会说话。认 const nMin 这一行本身就够。
const _a = app.indexOf("      let nMax = Math.min(14, Math.max(5, members.length * 2));");
const _b = app.indexOf("      const nMin = ", _a);
assert.ok(_a > 0 && _b > _a, "抠不出算条数那几行");
const seg = app.slice(_a, app.indexOf("\n", _b));
const nOf = (memberCount, rgOpts) => new Function("members", "rgOpts",
  seg + "\nreturn { nMin: nMin, nMax: nMax };")({ length: memberCount }, rgOpts || {});

test("两个人的群：下限得留得下【有来有回】，不是一个来回", () => {
  const r = nOf(2);
  // ⚠️第一版改成 3，她当场又报：「现在又变成 a 几句 b 几句 a 一句收尾了」——
  //   3 条正好是 A→B→A，而每条还要拆成两三泡，看上去就是一人一坨。
  //   3 条是【一个来回】，不是【有来有回】。
  assert.ok(r.nMin >= 4, "下限是 " + r.nMin + "＝A→B→A 就交差了，看上去还是一人一坨");
  assert.ok(r.nMax >= r.nMin, "上限不能比下限还小");
});

test("下限说的是【条】，不是【人】", () => {
  // 人越少下限越低，正是把条数当成人数的那个形状
  assert.equal(nOf(1).nMin, nOf(2).nMin, "一个人和两个人的群，下限不该因为人少就掉下去");
  assert.equal(nOf(2).nMin, nOf(8).nMin, "人多人少，一来一回的那个底是一样的");
  assert.ok(A.indexOf("Math.min(3, members.length)") < 0, "把条数当人数的那一行还在");
  assert.match(A, /const nMin = Math\.min\(nMax, 4\);/);
});

test("人多的时候上限跟着放宽，别把人挤掉", () => {
  assert.ok(nOf(8).nMax > nOf(2).nMax, "人多就该多聊几个来回");
  assert.ok(nOf(8).nMax <= 14, "也不能没边");
});

// 自发那一段预算紧的时候，下限不许把上限顶穿
test("自发轮预算只剩一两条时，下限跟着降，不许超过上限", () => {
  [1, 2, 3].forEach(b => {
    const r = nOf(5, { auto: true, msgBudget: b });
    assert.equal(r.nMax, b, "上限得听预算的");
    assert.ok(r.nMin <= r.nMax, "预算只剩 " + b + " 条，下限却要 " + r.nMin + " 条");
    assert.ok(r.nMin >= 1, "也不能变成 0 条");
  });
});

// 光把数字改了没用：它还得当面说出来【同一个人可以再开口】
test("提示词要当面挡住【一人一坨】那个形状", () => {
  const i = A.indexOf("const common = ");
  const blk = A.slice(i, i + 1400);
  // 她的原话就是这个形状，直接钉在这儿
  assert.match(blk, /别把一个人的话攒成一坨/);
  assert.match(blk, /A 一口气把想说的说完、再轮到 B 说完、A 最后补一句收尾/, "得把她看到的那个形状原样点出来");
  assert.match(blk, /话头要来回过手/);
  assert.match(blk, /一个人连着最多两条/, "光说「别一坨」太虚，得给个数");
});

test("提示词要当面说：同一个人一轮里可以说好几次", () => {
  const i = A.indexOf("const common = ");
  assert.ok(i > 0, "那一段没了");
  const blk = A.slice(i, i + 1200);
  assert.match(blk, /同一个人一轮里可以说好几次/, "不说的话，「按情境选合适的人发言」读起来就是一人一句");
  assert.match(blk, /A 当然可以再回 B/, "得把那个形状说出来，不是只给一句抽象规矩");
  assert.match(blk, /一人发一句就散场那不是群聊/);
  // 原来那句「选合适的人发言」留着没问题，但不能只剩它
  assert.match(blk, /按情境选合适的人发言/);
});

test("v67.18 那两条不许被顺手改掉", () => {
  assert.match(A, /const G_EACH_OTHER = "接彼此的话/, "「接彼此的话」那一份");
  assert.equal((A.match(/\bG_EACH_OTHER\b/g) || []).length, 3, "一处定义、两条分支各取一次");
  assert.match(A, /不是点名提问/, "她开口那一轮的那一段");
});
