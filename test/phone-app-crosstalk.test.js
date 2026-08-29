// 同一部手机不许复读（她 2026-08-29：「差不多同一时间刷新的话素材都差不多，
// 就算功能不一样还是会说的大差不差的」）。
// 病因不是某个 app 的提示词，是 runProbe 给十二个 app 发的 buildBundle 逐字相同，
// 模型只能抓住最显眼的那件事换十二种格式重讲。这里钉住两层修法：
// ① 每个 app 有自己的取材层和时间窗；② 生成时把别人写过的东西回喂当避重清单。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const phoneSrc = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");
const appSrc = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

const P = new Function(phoneSrc + `
  return { phoneRoundDigest, phoneAvoidBlock, phoneProbeSpec, PHONE_ANGLE, PHONE_APPS, PHONE_DIGEST_PICK, PHONE_LIVE_KEYS };
`)();

const char = { id: "c1", name: "裴照川" };

test("每个可查 App 都有自己的取材层和时间窗，没有一个漏网", () => {
  // 接真数据的 app 不由模型生成，本来就没有取材层
  const keys = P.PHONE_APPS.filter(x => P.PHONE_LIVE_KEYS.indexOf(x.key) < 0)
    .map(x => x.key);   // v57.54 起视频拆成 bili / latenight 两个独立 app，不再有子键
  keys.forEach(k => {
    assert.ok(P.PHONE_ANGLE[k], k + " 没有取材层");
    assert.match(P.PHONE_ANGLE[k], /【取材层】/);
  });
  // 时间窗：除了纯数字的设置页，其余都必须写明往回捞多久
  keys.filter(k => k !== "settings").forEach(k => {
    assert.match(P.PHONE_ANGLE[k], /【时间窗】/, k + " 没有时间窗");
  });
});

test("时间窗真的把 App 岔开了，不是全挤在「这几天」", () => {
  // 相册要跨月跨年，购物按月，通话按周——它们同时刷新时取的不是同一段日子
  assert.match(P.PHONE_ANGLE.album, /跨月跨年/);
  assert.match(P.PHONE_ANGLE.shopping, /这一个月/);
  assert.match(P.PHONE_ANGLE.calls, /这一周/);
  assert.doesNotMatch(P.PHONE_ANGLE.album, /【时间窗】这几天/);
});

test("便签里打字的和录下来的有明确分界，不是同一件事写两遍", () => {
  // v57.56 合成一个 app 了；分界从「两个 app」变成「同一个 app 里的两种 kind」
  assert.match(P.PHONE_ANGLE.notes, /打字的和说出口的都在这儿/);
  assert.match(P.PHONE_ANGLE.notes, /只能说出来/);
  assert.equal(P.PHONE_ANGLE.recordings, undefined, "录音的取材层该跟着 app 一起删掉");
});

test("phoneRoundDigest 从各 App 已存数据里抽出代表行", () => {
  const lines = P.phoneRoundDigest({
    browser: { searches: [{ q: "失眠怎么办" }] },
    notes: { items: [{ title: "凌晨三点" }] }
  }, "shopping");
  const joined = lines.join("\n");
  assert.match(joined, /浏览器：失眠怎么办/);
  assert.match(joined, /便签：凌晨三点/);
});

test("正在生成的那个 App 自己不进避重清单", () => {
  const lines = P.phoneRoundDigest({ notes: { items: [{ title: "买猫粮" }] } }, "notes");
  assert.equal(lines.length, 0);
});

test("避重清单有字数上限，不会把整部手机塞进 prompt", () => {
  const long = n => ({ items: Array.from({ length: 40 }, (_, i) => ({ title: "一条很长很长的标题".repeat(6) + i, name: "x" + i, caption: "c" + i })) });
  const lines = P.phoneRoundDigest({
    notes: long(), browser: long(), shopping: long(), forum: long(),
    recordings: long(), album: long(), video_day: long(), video_night: long()
  }, "calls");
  const total = lines.join("\n").length;
  assert.ok(total <= 900, "避重清单 " + total + " 字，超了 900 上限");
  assert.ok(lines.length > 0, "上限不该把清单整个砍空");
  lines.forEach(l => assert.ok(l.length <= 120, "单行没截断：" + l.length));
});

test("数据缺失或形状不对时不炸，返回空清单", () => {
  assert.deepEqual(P.phoneRoundDigest(null, "notes"), []);
  assert.deepEqual(P.phoneRoundDigest({}, "notes"), []);
  assert.deepEqual(P.phoneRoundDigest({ notes: { items: "不是数组" } }, "browser"), []);
  assert.deepEqual(P.phoneRoundDigest({ browser: {} }, "notes"), []);
});

test("有避重清单时，instruction 里带上禁止复读的硬话", () => {
  const spec = P.phoneProbeSpec("notes", char, [], "", ["- 微信：老张：明天到"]);
  assert.match(spec.instruction, /不许复读/);
  assert.match(spec.instruction, /老张：明天到/);
  assert.match(spec.instruction, /只能写它的侧面或后果/);
  assert.match(spec.instruction, /换一件别的事写/);
});

test("没有避重清单时不拼空块，只带取材层", () => {
  const spec = P.phoneProbeSpec("notes", char, [], "", []);
  assert.doesNotMatch(spec.instruction, /不许复读/);
  assert.match(spec.instruction, /【取材层】/);
  // schemaHint 原样保留，没被包装弄丢；maxTokens 则统一给满
  //（v57.50：max_tokens 是天花板不是预付款，按次计费下压小了只会截断正文）
  assert.match(spec.schemaHint, /"items"/);
  assert.equal(P.phoneProbeSpec("album", char, [], "", []).maxTokens, 65535);
});

test("未知 key 仍返回可用的兜底 spec", () => {
  const spec = P.phoneProbeSpec("没这个app", char, [], "", ["- 备忘录：x"]);
  assert.equal(typeof spec.instruction, "string");
  assert.equal(spec.schemaHint, "{}");
  assert.match(spec.instruction, /不许复读/);
});

test("全刷是边生成边攒清单，且从空开始而不是拿旧数据避重", () => {
  const block = appSrc.match(/const genPhoneAll = async char => \{[\s\S]*?\n  \};/);
  assert.ok(block, "找不到 genPhoneAll");
  const s = block[0];
  assert.match(s, /const fresh = \{\}/);
  assert.match(s, /const avoid = phoneRoundDigest\(fresh, key\)/);
  assert.match(s, /fresh\[key\] = d/);
  // 攒进 fresh 必须发生在下一轮取 avoid 之前（同一个 for 体内、赋值在 runProbe 之后）
  assert.ok(s.indexOf("phoneRoundDigest(fresh, key)") < s.indexOf("fresh[key] = d"));
});

test("单个 App 重刷拿手机里已存的别的 App 避重", () => {
  const block = appSrc.match(/const genPhoneApp = async \(char, key\) => \{[\s\S]*?\n  \};/);
  assert.ok(block, "找不到 genPhoneApp");
  assert.match(block[0], /phoneRoundDigest\(\(phones \|\| \{\}\)\[char\.id\] \|\| \{\}, key\)/);
  // v57.66 起最后还多一个 known（上一轮那份，用来沿用身份）
  assert.match(block[0], /phoneWechatDigest\(char\) : "", avoid, known\)/);
});
