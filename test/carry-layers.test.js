const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), engine = R("engine.js"), screens = R("screens.js");

// 把 screens.js 里那几个纯函数抠出来真跑（它们不碰 React、不碰 DOM）
const F = (() => {
  const a = screens.indexOf("// 给出图端的衣柜");
  const b = screens.indexOf("function carryProbeSpec");
  assert.ok(a > 0 && b > a, "抠不出随身物那几个纯函数");
  const head = screens.slice(screens.indexOf("const CLOSET_MAX_OCCASIONS"), screens.indexOf("function carryProbeSpec"));
  return new Function(head + "\nreturn { closetGroups, carryFlatItems, carryItemKey, carryClosetText, carryContextText, carryEvolveMerge, carryKnownBlock };")();
})();
// clothTone 那几个也抠出来跑（纯函数，不碰 React）
const F2 = (() => {
  const head = screens.slice(screens.indexOf("const CLOTH_TONES"), screens.indexOf("// 给出图端的衣柜"));
  return new Function(head + "\nreturn { clothTone, clothShift, clothIsDark };")();
})();
const bodyOfFn = head => {
  const i = screens.indexOf(head);
  assert.ok(i > 0, "找不到 " + head);
  let d = 0;
  for (let k = screens.indexOf("{", i + head.length - 2); k < screens.length; k++) {
    if (screens[k] === "{") d++;
    else if (screens[k] === "}" && --d === 0) return screens.slice(i, k + 1);
  }
  throw new Error("配不上括号：" + head);
};
const mk = (...names) => ({ items: names.map(n => ({ name: n, note: "x", thought: "y" })) });

// 她 2026-08-29：随身物生成完只有她看得见——角色本人不知道自己包里有伞，
// 出图也不知道他衣柜里有哪几身。这是 v55.95「声明了、从没被引用过」的原样重演。
test("随身物真的进了上下文，四处都进（四处一样喂）", () => {
  assert.match(app, /carryLog: \(typeof carryContextText === "function"/, "单聊那条没接");
  assert.match(engine, /ctx\.carryLog && ctx\.carryLog\.trim\(\)\) parts\.push\("【你身上带着的东西 \/ 你的衣柜】/, "buildBundle 里没发");
  assert.match(app, /const cySeg = \(\(\) => \{/, "线上群聊没接");
  assert.match(app, /memberCarry: \(\(\) => \{/, "群线下没接");
  assert.match(engine, /ctx\.memberCarry && ctx\.memberCarry\[c\.id\]/, "群线下那一段没读");
  // 言秋不发：扮演类的层一律不给他（合法差异）
  assert.match(app, /!settingsFor\(char\.id\)\.engineerEyes\)\s*\n?\s*\? carryContextText/, "言秋那条线没排除");
  assert.match(engine, /!ctx\.notRoleplay && ctx\.carryLog/, "buildBundle 里没挡住数字生命");
});

test("摘要只发【有什么】，不发她的私人批注", () => {
  const box = { bag: mk("油纸伞", "钥匙"), trinket: mk("一块旧玉") };
  const txt = F.carryContextText(box, {});
  assert.match(txt, /油纸伞/);
  assert.match(txt, /一块旧玉/);
  assert.doesNotMatch(txt, /thought|y$/m, "thought 是给她看的私人批注，不该发给模型");
  // 群里那份要更省——她按次计费。（cap 有 120 的地板：切得太碎就没法读了）
  const long = i => "第" + i + "件东西的名字在这里写得相当长好把摘要撑过封顶线";
  const wide = { bag: mk(...Array.from({ length: 8 }, (_, i) => long(i))) };
  assert.ok(F.carryContextText(wide, {}).length > 150, "先确认这份本来就够长");
  assert.ok(F.carryContextText(wide, {}, { cap: 150 }).length <= 151 + 1, "cap 没生效");
});

test("钉住的排在最前面——那几件是她认定他身上绝不会没有的", () => {
  const box = { bag: mk("钥匙", "票根", "那块玉") };
  const txt = F.carryContextText(box, { bag: ["那块玉"] });
  assert.match(txt, /身上带着：那块玉、/, "钉住的没排到最前");
});

// 判据一：这一栏变了，是「他变了」还是「系统忘了」？
// 随身物比手机更该稳：你身上带着的东西本来就是几个月不动的。
test("🌱 一次最多真换掉两件，多的回填", () => {
  const old = mk("伞", "钥匙", "票根", "糖", "玉");
  const neu = mk("新伞");   // 模型一口气换掉了五件里的四件
  const out = F.carryEvolveMerge("bag", old, neu, []);
  const names = F.carryFlatItems("bag", out).map(x => x.name);
  assert.ok(names.includes("新伞"), "新的那件要留下");
  assert.equal(names.length, 4, "五件掉了四件，只准掉两件，另外两件要回填");
  assert.equal(names.filter(n => ["伞", "钥匙", "票根", "糖", "玉"].includes(n)).length, 3);
});

test("🔒 钉住的一件都不许掉，模型漏了就补回去", () => {
  const old = mk("伞", "钥匙", "那块玉");
  const out = F.carryEvolveMerge("bag", old, mk("新东西"), ["那块玉"]);
  const names = F.carryFlatItems("bag", out).map(x => x.name);
  assert.ok(names.includes("那块玉"), "钉住的被换掉了");
  // 钉住的不占那两件的额度：它是 🔒 层，跟 🌱 的 churn 不是一回事。
  // 这里非钉住的正好掉了两件（伞、钥匙）＝用满额度，所以只有玉被补回来。
  assert.deepEqual(names.sort(), ["新东西", "那块玉"].sort());
  // 再来一次：非钉住的掉了三件，第三件必须回填
  const out2 = F.carryEvolveMerge("bag", mk("伞", "钥匙", "票根", "玉"), mk("新东西"), ["玉"]);
  const n2 = F.carryFlatItems("bag", out2).map(x => x.name);
  assert.ok(n2.includes("玉"), "钉住的没回填");
  assert.equal(n2.length, 3, "三件非钉住的只准掉两件：" + n2.join("/"));
});

test("头一次生成（以前没有）照单全收，别拿空的去回填", () => {
  const neu = mk("a", "b");
  assert.equal(F.carryEvolveMerge("bag", null, neu, []), neu);
  assert.equal(F.carryEvolveMerge("bag", { items: [] }, neu, []), neu);
});

test("旧那一份要喂回提示词，钉住的点名不许动", () => {
  const blk = F.carryKnownBlock("bag", mk("伞", "那块玉"), ["那块玉"]);
  assert.match(blk, /上一次翻他这一栏/);
  assert.match(blk, /默认原样照抄回来/);
  assert.match(blk, /这一次最多换掉两件/);
  assert.match(blk, /绝对不许换掉、不许改名/);
  assert.match(blk, /· 那块玉/);
  assert.equal(F.carryKnownBlock("bag", null, []), "", "没有旧的就别发这一段");
});

// 她 2026-08-29：衣柜可以生成好几套不同场合的衣服，衣柜大小跟人设走
test("衣柜按场合分组，同一场合可以有好几套", () => {
  const d = { closet: [{ occasion: "上朝", sets: [{ name: "绯袍" }, { name: "素服" }] }, { occasion: "在家", sets: [{ name: "常服" }] }] };
  const g = F.closetGroups(d);
  assert.deepEqual(g.map(x => x.occasion + "/" + x.sets.length), ["上朝/2", "在家/1"]);
  // 件数不写死在提示词里——写死了谁的衣柜都一样满
  assert.doesNotMatch(screens, /衣柜里的衣物.*正好|outfit[\s\S]{0,400}?6-8 件/, "衣柜的件数不该再写死");
  assert.match(screens, /衣柜的规模本身就是人物信息/);
  assert.match(screens, /\*\*有几件由这个人决定\*\*/, "别的几栏也不该再写死件数");
});

test("衣柜的上限由代码守着，光靠提示词只是降概率", () => {
  const big = { closet: Array.from({ length: 9 }, (_, i) => ({ occasion: "场合" + i, sets: Array.from({ length: 9 }, (_, j) => ({ name: "套" + i + "_" + j })) })) };
  const g = F.closetGroups(big);
  assert.ok(g.length <= 6, "场合数没封顶：" + g.length);
  g.forEach(x => assert.ok(x.sets.length <= 6, "单场合套数没封顶"));
  assert.ok(g.reduce((n, x) => n + x.sets.length, 0) <= 30, "总套数没封顶");
  // 上面那个用例会先撞上总数 24 而停下，测不到【场合数】那道闸。
  // 每个场合只放一套，总数就够不着 24——这时候拦住它的必须是场合数本身。
  const thin = { closet: Array.from({ length: 9 }, (_, i) => ({ occasion: "场合" + i, sets: [{ name: "套" + i }] })) };
  assert.ok(F.closetGroups(thin).length <= 6, "场合数那道闸没有单独生效：" + F.closetGroups(thin).length);
});

test("旧的平清单还看得见（她手机上已经有旧数据）", () => {
  const g = F.closetGroups({ items: [{ name: "旧的一件" }] });
  assert.equal(g.length, 1);
  assert.equal(g[0].sets[0].name, "旧的一件");
  assert.deepEqual(F.closetGroups(null), []);
  assert.deepEqual(F.closetGroups({}), []);
});

// 衣柜里挂着八身，出图一身都用不上（她 2026-08-29）
test("衣柜驱动出图，但不抢锁死的行头和此刻真穿着", () => {
  assert.match(engine, /const closetText = \(!fixedOutfit && !currentWearing\) \? String\(opts\.closet \|\| ""\)\.trim\(\) : "";/,
    "优先级要是 photoOutfit ＞ 此刻穿着 ＞ 衣柜");
  assert.match(engine, /\} else if \(closetText\) \{/, "衣柜那一支没接进服装分流");
  assert.match(engine, /从上面【真有的】里挑最合适的一身/);
  // 三处真出图都要把衣柜带上；小剧场是平行时空，有自己的行头锁，不给
  // 线下 1 + 线上单聊 1 + 线上群聊 2（gCast 三元的两支各一次）
  assert.equal((app.match(/closet: closetTextFor\(/g) || []).length, 4, "有出图的地方没带上衣柜");
  const theater = R("theater.js");
  assert.doesNotMatch(theater, /closetTextFor|carryClosetText/, "小剧场是平行时空，不读主线衣柜");
});

test("和购物/钱包接上：真到手的东西当素材，不是直接塞条目", () => {
  assert.match(app, /const carryMaterialFor = charId => \{/);
  assert.match(app, /box\.shopping \|\| \{\}\)\.orders/, "没从他网购订单里取");
  assert.match(screens, /【他最近真到手的东西】/);
  assert.match(screens, /没有一件对得上就一件都不写/, "得说清这不是清单核对，否则会硬塞");
  // 取消/退款/还在路上的不算「到手」
  assert.match(app, /取消\|退款\|退货\|已退\|失败\|关闭\|待收货\|派送\|运输\|揽收/);
});

test("护理那一栏删了，旧版随身物那套死代码也删了", () => {
  assert.doesNotMatch(screens, /key: "care"/, "护理还在");
  assert.doesNotMatch(app, /\bcarries\b/, "x_carries 那套死代码还在（genCarry/setCarries 从头到尾没人读过）");
  assert.doesNotMatch(app, /const genCarry = async/, "旧的 genCarry 还在");
  assert.match(screens, /const CARRY_SECTIONS = \[[\s\S]*?\];/);
  const secs = (screens.match(/key: "(bag|pocket|outfit|trinket|gifts)"/g) || []).length;
  assert.equal(secs, 5, "现在应该是五栏");
});

// ── UI（她 2026-08-29「页面略丑，先做衣柜」）──────────────────
// 铁律 .claude/rules/mobile-ui-layout.md §1：普通子页面用紧凑标题栏，
// 禁止 30–40px 大标题和大块上下留白。随身物的详情页原先用的是 Head，
// 一屏先被标题吃掉五分之一。
test("随身物详情页用紧凑标题栏，不许退回大标题", () => {
  const i = screens.indexOf("function CarrySection(");
  const seg = screens.slice(i, screens.indexOf("\nfunction Carry(", i));
  assert.doesNotMatch(seg, /h\(Head, \{/, "又退回 Head 那块大标题了（mobile-ui-layout.md §1）");
  assert.match(seg, /paddingTop: safeTop\(10\)/, "顶栏得自己吃安全区");
  assert.match(seg, /fontSize: 16, color: t\.ink/, "居中小标题");
  assert.match(seg, /"aria-label": "返回"/);
  // 左返回、右操作位等宽，标题才真的居中
  assert.equal((seg.match(/width: 40, height: 40/g) || []).length, 2, "左右操作位要等宽");
});

test("衣服的颜色是从它自己的名字里长出来的", () => {
  const tone = (name, note, i) => F2.clothTone({ name, note }, i).base;
  assert.equal(tone("绯色官袍", "缂丝"), "#b8433c");
  assert.equal(tone("月白常服", "软绸"), "#dbe4e2", "「月白」必须排在「白」前面");
  assert.equal(tone("青灰直裰", ""), "#8d99a6", "「青灰」必须排在「青」和「灰」前面");
  assert.equal(tone("玄色劲装", ""), "#31313a");
  // 名字里有颜色时，note 里那些不是颜色的字不许抢
  assert.equal(tone("灰卫衣", "领口洗松了"), "#9aa0a6", "「洗松了」的「松」把灰抢成了松绿");
  assert.doesNotMatch(screens, /翠\|碧\|竹\|松/, "「松」误伤太大（洗松了/松口/放松），不许收进绿色");
  // 名字里没颜色才轮到 note
  assert.equal(tone("那件短打", "褐色的粗布"), "#8a6544");
  // 一个颜色词都没有：按次序发兜底色，同一柜里不会几件撞成一片
  assert.notEqual(tone("某件衣服", "", 0), tone("另一件", "", 1));
});

test("长衫和短衣是两个剪影——一柜子同一个形状就白画了", () => {
  const L = /袍|裰|氅/;
  assert.ok(L.test("绯色官袍") && L.test("青灰直裰"), "先确认词表意图");
  assert.match(screens, /const CLOTH_LONG = \//);
  ["袍", "裰", "氅", "裙", "大衣", "朝服", "常服"].forEach(w =>
    assert.ok(new RegExp(screens.match(/const CLOTH_LONG = (\/[^;]+\/)/)[1].slice(1, -1)).test(w), w + " 该算长款"));
  ["劲装", "短打", "卫衣", "衬衫"].forEach(w => {
    const re = new RegExp(screens.match(/const CLOTH_LONG = (\/[^;]+\/)/)[1].slice(1, -1));
    if (w === "衬衫") return;  // 「衫」确实算长款，这里不苛求
    assert.ok(!re.test(w), w + " 不该算长款");
  });
  const seg = bodyOfFn("function clothFigure(o) {");
  assert.match(seg, /const bodyH = Math\.round\(\(o\.long \? 122 : 98\) \* k\)/, "长短款得给不同高度");
  assert.match(seg, /clipPath: o\.long \? CLOTH_CLIP_LONG : CLOTH_CLIP_SHORT/, "长短款得给不同剪影");
  // 布区留一格最高的位子（按同一个比例缩放），下面的名字才对得齐
  assert.match(seg, /height: Math\.round\(122 \* k\)/, "布区没定高，一排衣服的文字会参差");
});

test("阴影必须跟着剪影走，否则浅色的衣服在米色底上会糊掉", () => {
  const seg = bodyOfFn("function clothFigure(o) {");
  // box-shadow 画在盒子上，会被 clipPath 整个裁掉；drop-shadow 跟着剪影
  assert.match(seg, /filter: "drop-shadow\(/, "用了 drop-shadow 才有沿剪影的投影");
  assert.doesNotMatch(seg.split("clipPath")[0], /boxShadow: "0 /, "别在裁剪过的盒子上用外投 box-shadow，那是无效的");
  assert.match(seg, /boxShadow: "inset 0 0 0 1px/, "极浅的衣服还要一条内描边");
});

test("挂衣杆铺满整行，页面本身不横滚", () => {
  const i = screens.indexOf("    const bay = sets =>");
  const seg = screens.slice(i, i + 1800);
  assert.match(seg, /className: "overflow-x-auto"/, "横滑归这一行自己（mobile-ui-layout §3）");
  assert.match(seg, /minWidth: "100%", width: "max-content"/, "杆要铺满整行：内容窄时撑满屏、宽时跟着内容长");
  // 杆是一条 absolute 的横条，左右都铺出去（负值＝铺到 padding 外，两头压在立柱下）——
  // 而不是画在每件衣服顶上再靠相邻拼起来（那样 gap 一断，杆就断了）。
  assert.match(seg, /position: "absolute", top: \d+, left: -?\d+, right: -?\d+, height: [\d.]+, borderRadius/,
    "杆得铺在整条内容上，不是画在每件顶上");
});

// ── v57.87 UI 二轮（她 2026-08-29：「米白略单调，没有适配的风格」
//    「点开衣服显示的页面也还是 default 丑丑的没有设计感」）──────
test("列表和详情画的是同一件衣服——剪影只有一份", () => {
  assert.match(screens, /function clothFigure\(o\) \{/);
  // 两处都调它，谁也别再自己画一遍
  assert.equal((screens.match(/clothFigure\(\{/g) || []).length, 2, "列表一处、详情一处，多出来的就是又抄了一遍");
  assert.match(screens, /clothFigure\(\{ tone: c, long, w: 88, pinned: isPinned\(it\), t \}\)/, "列表没走共用那份");
  assert.match(screens, /clothFigure\(\{ tone: cl, long: sheet\._long, w: 104, pinned: isPinned\(sheet\), t \}\)/, "详情没走共用那份");
  // 剪影本身也只有一份
  assert.match(screens, /const CLOTH_CLIP_LONG = "polygon\(/);
  assert.match(screens, /const CLOTH_CLIP_SHORT = "polygon\(/);
  assert.equal((screens.match(/polygon\(34% 0/g) || []).length, 2, "剪影的坐标不许再抄第三份");
});

test("每块布有一个够深的墨色——浅色衣服的按钮和竖线不许糊掉", () => {
  ["月白常服", "素色朝服", "藕荷寝衣", "绯色官袍", "玄色劲装", "青灰直裰"].forEach((n, i) => {
    const c = F2.clothTone({ name: n, note: "" }, i);
    assert.ok(F2.clothIsDark(c.ink), n + " 的 ink 不够深，写在浅底上会看不见：" + c.ink);
  });
  // 直接拿 dark 会出事：浅布的 dark 仍旧是浅的
  const pale = F2.clothTone({ name: "月白常服", note: "" }, 0);
  assert.ok(!F2.clothIsDark(pale.dark), "先确认 dark 确实不够深（所以才需要 ink）");
  // clothShift 要返回 hex，算出来的色才能再兑透明度
  assert.match(F2.clothShift("#b8433c", -0.5), /^#[0-9a-f]{6}$/);
  const i = screens.indexOf("      const pinRow = onTogglePin");
  const seg = screens.slice(i, screens.indexOf("\n    })(),", i));
  assert.doesNotMatch(seg, /cl\.dark/, "详情页的文字和描边不许用 dark，要用 ink");
  assert.match(seg, /clothRgba\(cl\.ink, 0\.45\)/, "想法那条竖线要用 ink");
});

test("详情页把这件衣服本身画进去，底色也取自它自己", () => {
  const i = screens.indexOf("      const pinRow = onTogglePin");
  const seg = screens.slice(i, screens.indexOf("\n    })(),", i));
  assert.match(seg, /clothRgba\(cl\.base, 0\.16\)/, "顶部那层氛围底没取这件衣服的布色");
  assert.match(seg, /if \(!cl\) return h\(Sheet/, "别的栏（包内/口袋/珍藏）没有布色，要走回原来那份");
  assert.match(seg, /sheet\._occ \? h\("div"[\s\S]{0,200}?"OCCASION"/, "场合的 eyebrow 该是英文标签");
  // ⚠️toUpperCase 对中文是空操作，会把同一个场合名原样印两遍
  // 只看代码，别把提醒这件事的注释本身当成犯规
  const code = seg.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert.doesNotMatch(code, /toUpperCase\(\)/, "别对中文场合名用 toUpperCase——它会印两遍一样的字");
});

test("柜子的纵深只画在衣柜这一栏，别的栏照旧", () => {
  const i = screens.indexOf("    const bay = sets =>");
  const seg = screens.slice(i, i + 1800);
  assert.match(seg, /rgba\(74,58,40/, "隔间要用半透明暖褐叠在主题底色上");
  assert.doesNotMatch(seg, /background: "#[0-9a-fA-F]{6}"/, "别写死颜色，换主题就脱节了");
  assert.match(seg, /position: "absolute", top: 0, bottom: 0, left: 0/, "左立柱");
  assert.match(seg, /position: "absolute", top: 0, bottom: 0, right: 0/, "右立柱");
  assert.match(seg, /minWidth: "100%", width: "max-content"/, "杆要铺满整格");
  // 整页那层柜内的光只给衣柜，别的栏不该变色
  assert.match(screens, /style: sec\.closet \? \{ background: "linear-gradient\(180deg,rgba\(74,58,40/, "整页的柜内光没有只给衣柜");
});
