// 同人文那几份老提示词里的【内容示范】清掉（施工规则/prompt-no-content-samples.md）。
// 判据一句话：这个例子如果被逐字照抄，是对的还是错的？
// 「食咗饭未」被照抄没问题——它是词汇，说的是粤语长什么样。
// 「他背过身去摸烟，摸到一半想起对方讨厌烟味」被照抄就是灾难——它是内容，
// 而内容必须由这一篇、这两个人长出来。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "fanfic.js"), "utf8");

test("正面示例那一栏不再给成句：✓ 那半边是判据，不是范文", () => {
  const seg = src.slice(src.indexOf("  const FANFIC_GOOD_EXAMPLES ="), src.indexOf("  const INTIMACY_WORLDNOTE ="));
  ["旧毛衣", "够了两次", "摸烟", "打火机", "泼出来的水"].forEach(x =>
    assert.ok(!seg.includes(x), "✓ 那半边还留着可以照抄的范句：" + x));
  assert.match(seg, /✓ 换成一个【只有这两个人/, "✓ 那半边没改成判据");
  assert.match(seg, /上面的 ✓ 是判据不是范文/, "没有把这件事对模型说明白");
  // 换个角色还照样成立的，就是写坏了——这条判据要在场
  assert.match(seg, /换成任何别的角色也照样成立，就是写坏了/);
  // ✗ 那半边是禁令，照抄禁令没问题，得留着
  assert.match(seg, /✗ 把脸埋进颈窝/);
});

test("借骨不借皮那一段改成认【病句的形状】，不再给一对原创对照句", () => {
  const seg = src.slice(src.indexOf("  const STYLE_DEEP_IMITATION ="), src.indexOf("  const STYLE_FIDELITY_TAIL"));
  ["水壶在桌角", "她收回手", "仍属于人类"].forEach(x =>
    assert.ok(!seg.includes(x), "还留着可以照抄的对照句：" + x));
  assert.match(seg, /病句的形状（认这个形状，不是背例句）/);
  assert.match(seg, /这里不给范句/);
});

test("版块的世界观说明里不许再有整句的场景示范", () => {
  const seg = src.slice(src.indexOf("  const SEED_TABS = ["), src.indexOf("  const K_TABS"));
  ["加热柜里最后一个包子", "草稿纸角落的名字", "半瓶水怎么分", "留一碗云吞面",
    "奶香/松木香", "电话亭响了没人接", "借橡皮时碰到手"].forEach(x =>
    assert.ok(!seg.includes(x), "版块说明里还留着能被照抄的场景：" + x));
  // 词表要留着：那是「这个年代/这个地方的话长什么样」，照抄是对的
  assert.match(seg, /妾身\/在下\/郎君\/娘子/, "古风的称谓词表被误删了");
  assert.match(seg, /粤语常用词照用/, "港片的粤味没了");
});
