const test = require("node:test");
const assert = require("node:assert/strict");
const { loadPhone, SRC } = require("./helpers/phone-render.js");
const P = loadPhone();
const SLOTS = P.HEALTH_SLOTS, KEYS = P.HEALTH_GROUPS.map(g => g.key);
const ins = P.phoneProbeSpec("health", { name: "裴照川" }, [], "", [], null).instruction;

// 她 2026-08-30：「改一下每一个人的数据类型统一一下不然有点抽象，
// 统一了但是实际名称可以跟人设改」
test("格位定死：每一项都有 slot、归档、顺序，四档都摆得满", () => {
  assert.ok(SLOTS.length >= 14, "格位太少了，只有 " + SLOTS.length + " 项");
  const seen = new Set();
  SLOTS.forEach(x => {
    assert.ok(x.slot && /^[a-z]+$/.test(x.slot), "slot 得是纯小写英文 key：" + x.slot);
    assert.ok(!seen.has(x.slot), "slot 重复了：" + x.slot);
    seen.add(x.slot);
    assert.ok(x.zh, x.slot + " 没有标准含义");
    assert.ok(KEYS.indexOf(x.group) >= 0, x.slot + " 归到了不存在的档：" + x.group);
  });
  // 每一档都得有格位，不然那个 tab 天生就是空的
  KEYS.forEach(g => {
    const n = SLOTS.filter(x => x.group === g).length;
    assert.ok(n >= 3, g + " 这一档只有 " + n + " 项，撑不起一整页");
    assert.ok(SLOTS.some(x => x.group === g && x.wide), g + " 这一档没有整宽卡，一页全是窄卡很单调");
  });
});

test("归档看 slot，模型的 group 字段说了不算", () => {
  // 故意把 group 写反：定死的格位必须赢
  assert.equal(P.healthGroupOf({ slot: "intimacy", group: "body" }), "private");
  assert.equal(P.healthGroupOf({ slot: "steps", group: "private" }), "body");
  assert.equal(P.healthGroupOf({ slot: "STEPS ", group: "mind" }), "body", "slot 没做大小写/空格归一化");
  // 老存档没有 slot，还得能按 group 的别名归位（不能一升级就全掉进兜底档）
  assert.equal(P.healthGroupOf({ group: "私密" }), "private");
  assert.equal(P.healthGroupOf({ group: "摄入" }), "intake");
  assert.equal(P.healthGroupOf({ name: "什么都没写" }), KEYS[0]);
});

test("提示词把这套格位原样发出去，并说明白名字可以改、项数不能改", () => {
  SLOTS.forEach(x => {
    assert.ok(ins.indexOf("slot: " + x.slot) > 0, "提示词里少了格位 " + x.slot);
    assert.ok(ins.indexOf(x.zh) > 0, "提示词里少了 " + x.slot + " 的标准含义");
  });
  assert.match(ins, /一项不多一项不少/, "没说清项数是死的，模型会自己增删");
  assert.match(ins, /原样照抄，不要翻译不要改/, "没要求 slot 照抄，回来就对不上号了");
  assert.match(ins, /格位是死的，名字是活的/, "没讲清这一层的规矩");
  assert.match(ins, /换个角色还照样成立的名字，就是没改/, "没给改名的判据");
  // 旧的「group 分四档各几张」配额已经由格位表接管，不许两处同时说
  assert.ok(!/group 分四档/.test(ins), "旧配额还留着，跟格位表打架");
  assert.equal((ins.match(/不要照搬现代体检报告的词/g) || []).length, 1, "改名那段说了两遍");
  assert.match(P.phoneProbeSpec("health", { name: "x" }, [], "", [], null).schemaHint, /"slot"/, "schemaHint 里没有 slot");
});

// 「统一」的意思是：谁的手机翻开都是同一个阅读顺序、同一个排版
test("同一档里按格位顺序排，整宽也由格位定，模型给的 wide 不算", () => {
  const view = SRC.slice(SRC.indexOf("const byGroup = g =>"), SRC.indexOf("const PAGES = HEALTH_GROUPS.map"));
  assert.match(view, /sort\(\(a, b\) => a\.o - b\.o\)/, "同一档里没有按格位排序，每个人的顺序会不一样");
  assert.match(view, /wide: !!x\.sl\.wide/, "整宽还听模型的，排版会各长各的");
  assert.match(view, /900 \+ i/, "认不出格位的卡没兜住，会插进定死的那几项中间");
});

// 名字改了之后，得能看出它到底是哪一项
test("角色给它改了名，就用小字标出标准含义；没改名就不标", () => {
  const view = SRC.slice(SRC.indexOf("const stdSub = c =>"), SRC.indexOf("const labRow = "));
  assert.ok(view.length > 40, "找不到那个小字副标题");
  assert.match(view, /c\._zh && String\(c\.name \|\| ""\)\.trim\(\) !== c\._zh/, "改没改名都标，会出现「步数 / 步数」这种重复");
  // v62.53 读数从「一项一张卡」改成「一档一张化验单」之后，这一句判的是化验单那一行：
  // 同一个条件必须还在，否则改没改名都标。
  const row = SRC.slice(SRC.indexOf("const labRow = "), SRC.indexOf("const labSheet = "));
  assert.match(row, /c\._zh && String\(c\.name \|\| ""\)\.trim\(\) !== c\._zh/, "化验单那一行没带上这个条件");
});
