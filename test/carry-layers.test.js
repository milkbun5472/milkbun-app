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
  // 左返回、右操作位等宽，标题才真的居中。
  // ⚠️只在顶栏那一段里数——整个 CarrySection 里 40×40 的东西不止顶栏
  //（礼盒那个方块正好也是 40×40，v57.100 撞上过）。
  const bar = seg.slice(seg.indexOf("    // 紧凑标题栏"), seg.indexOf("    // 衣柜整页比别的栏暖一档"));
  assert.ok(bar, "找不到顶栏那一段");
  assert.equal((bar.match(/width: 40, height: 40/g) || []).length, 2, "左右操作位要等宽");
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
  // 别冻宽度——两处的尺寸以后还会调。守的是【都走同一个 clothFigure、都把钉住态传进去】。
  assert.match(screens, /clothFigure\(\{ tone: c, long, w: \d+, pinned: isPinned\(it\), t \}\)/, "列表没走共用那份");
  assert.match(screens, /clothFigure\(\{ tone, long: sheet\._long, w: \d+, pinned: isPinned\(sheet\), t \}\)/, "详情没走共用那份");
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
  const i = screens.indexOf("      const pinRow = (onTogglePin || onPeek)");
  const seg = screens.slice(i, screens.indexOf("\n    })(),", i));
  assert.doesNotMatch(seg, /tone\.dark\b/, "详情页的文字和描边不许用 dark，要用 ink");
  assert.match(seg, /clothRgba\(tone\.ink, 0?\.\d+\)/, "想法那条竖线要用 ink");
});

test("详情页把这件衣服本身画进去，底色也取自它自己", () => {
  const i = screens.indexOf("      const pinRow = (onTogglePin || onPeek)");
  const seg = screens.slice(i, screens.indexOf("\n    })(),", i));
  assert.match(seg, /clothRgba\(tone\.base, 0?\.\d+\)/, "顶部那层氛围底没取这件东西自己的色");
  assert.match(seg, /if \(!tone\) return h\(Sheet/, "没有色的（收到的礼物那种）要走回原来那份半页");
  assert.match(seg, /label\("OCCASION", sheet\._occ\)/, "衣柜那一路的 eyebrow 是场合");
  assert.match(seg, /label\("MATERIAL", tone\.word\)/, "东西那一路的 eyebrow 是材质");
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
  // v57.97 起每一栏都有整页底色，但各用各的 tint（她：「背景都是一样的米色有点单调」）
  // v58.02 起底色铺在【最外层】：铺在滚动容器上的话顶栏在它外面，顶上会留一条没上色的米白带
  // v58.03 换成公共的 pageSkin。⚠️这里认的是【这一栏的色相真的传进去了】，
  // 不是某一串具体的 CSS——冻长相的测试，换个画法就红，什么也没守住。
  assert.match(screens, /style: pageSkin\([^)]*t,\s*\n?\s*\{ tint: CARRY_TINT\[sectionKey\]/, "整页底色没走这一栏自己的 tint");
});

// 她 2026-08-29：「现在页面还是这种半页式，改成整个框在中间然后框样式也像衣柜」
test("随身物详情是居中的一扇柜门，不是从底下滑上来的半页", () => {
  const i = screens.indexOf("      const pinRow = (onTogglePin || onPeek)");
  assert.ok(i > 0, "找不到详情那一段");
  const seg = screens.slice(i, screens.indexOf("\n    })(),", i));
  // 有色的那一路一律走居中的柜门框；半页 Sheet 只剩【没有色时】那一条退路，
  // 所以这一段里 h(Sheet 至多出现一次，多了就是又退回半页了。
  assert.ok((seg.match(/h\(Sheet, \{/g) || []).length <= 1, "又退回半页式 Sheet 了");
  assert.match(seg, /className: "absolute inset-0 flex items-center justify-center/, "框要居中");
  assert.match(seg, /animation: "caseOpen/, "开门那下动画");
  // 框本身要像柜门：木框 + 内板 + 门把手，且颜色一律叠在主题色上
  assert.match(seg, /repeating-linear-gradient\(90deg/, "木纹");
  assert.match(seg, /borderRadius: 4, background: "linear-gradient\(90deg,rgba\(56,42,28/, "门把手");
  assert.match(seg, /inset 0 0 0 1px rgba\(56,42,28/, "内板的镶板凹槽");
  assert.doesNotMatch(seg, /background: "#[0-9a-fA-F]{6}"/, "别写死颜色，换主题就脱节了");
  // 长文本要能滚，别把内容顶出屏幕
  assert.match(seg, /className: "overflow-y-auto"[\s\S]{0,140}?maxHeight: "calc\(\d+vh/, "内容得能滚");
  // 别的栏仍旧走原来那份半页
  assert.match(screens, /if \(!tone\) return h\(Sheet, \{ onClose: \(\) => setSheet\(null\), tall: true \}/, "没有色的那一路该有个退路");
});

test("caseOpen 这个动画真的定义过（只写在 style 里等于没有）", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /@keyframes caseOpen/, "index.html 里没定义 caseOpen，动画就是空转的");
});

// ── 包内（她 2026-08-29：「下一个做包内吧」）────────────────
// 衣柜能成立是因为「衣服」有唯一原型（一件衣服的剪影）＋ 颜色变化。
// 包里的东西没有共同形状——伞、钥匙、糖、纸条、药瓶画不完也画不像。
// 所以这一栏认的不是【它长什么样】，是【它是什么做的】。
test("包内认材质，不认形状", () => {
  const F3 = (() => {
    const head = screens.slice(screens.indexOf("const STUFF_TONES"), screens.indexOf("// 一件挂着的衣服"));
    const pre = screens.slice(screens.indexOf("const CLOTH_TONES"), screens.indexOf("const STUFF_TONES"));
    return new Function(pre + head + "\nreturn { stuffTone, stuffTilt };")();
  })();
  const w = (n, note) => F3.stuffTone({ name: n, note: note || "" }, 0).word;
  assert.equal(w("油纸伞", "伞骨断过一根"), "纸");
  assert.equal(w("一串钥匙", "铜的"), "铜", "名字里没材质就该退到 note");
  assert.equal(w("素绢帕子", ""), "绢");
  assert.equal(w("一小瓶伤药", ""), "瓶");
  assert.equal(w("一颗饴糖", ""), "糖");
  assert.equal(w("旧怀表", ""), "", "认不出来就别硬安一个");
  // 认不出的按次序发兜底色，一屏里不会几件撞成一片
  const a = F3.stuffTone({ name: "甲", note: "" }, 0), b = F3.stuffTone({ name: "乙", note: "" }, 1);
  assert.notEqual(a.base, b.base);
  // 歪斜要按名字稳定：真随机的话每次重排都会跳
  assert.equal(F3.stuffTilt("油纸伞"), F3.stuffTilt("油纸伞"));
  assert.ok(Math.abs(F3.stuffTilt("一串钥匙")) <= 0.9);
});

test("包内是一只倒出来的包：拉链、内衬、错落的牌子", () => {
  assert.match(screens, /function zipper\(t, tint\) \{/, "包最有辨识度的是拉链");
  assert.match(screens, /const tooth = "repeating-linear-gradient\(90deg," \+ c \+ /, "拉链的齿");
  assert.match(screens, /\{ key: "bag", zh: "包内", en: "Bag", stuff: true, zip: true \}/, "包内才有拉链");
  assert.match(screens, /\{ key: "pocket", zh: "口袋", en: "Pocket", stuff: true \}/, "口袋走同一套但没拉链");
  assert.match(screens, /\{ key: "trinket", zh: "珍藏小物", en: "Trinkets", stuff: true \}/, "珍藏也走同一套");
  const i = screens.indexOf("  } else if (sec.stuff) {");
  assert.ok(i > 0, "找不到包内那一路");
  const seg = screens.slice(i, screens.indexOf("\n  } else {", i));
  assert.match(seg, /sec\.zip \? zipper\(t, carryTint\(sectionKey, \.42\)\) : null/, "拉链只给包内，颜色跟着这一栏走");
  assert.match(seg, /transform: "rotate\(" \+ stuffTilt\(it\.name\) \+ "deg\)"/, "牌子要歪着摆才像倒出来的");
  assert.match(seg, /clothRgba\(c\.base, 0?\.\d+\)/, "牌子要染上它的材质色");
  assert.match(seg, /grid grid-cols-2/, "两列错落");
  assert.doesNotMatch(seg, /background: "#[0-9a-fA-F]{6}"/, "别写死颜色，换主题就脱节了");
  // 内衬走这一栏自己的 tint（v57.97 起五栏各有各的调子）
  assert.match(seg, /boxShadow: "inset 0 2px 8px " \+ carryTint\(sectionKey/, "内衬");
});

test("认色这件事只写一处，衣柜和包内共用", () => {
  assert.match(screens, /function toneFrom\(table, fallback, it, i\) \{/);
  assert.match(screens, /const clothTone = \(set, i\) => toneFrom\(CLOTH_TONES, CLOTH_FALLBACK, set, i\)/);
  assert.match(screens, /const stuffTone = \(it, i\) => toneFrom\(STUFF_TONES, STUFF_FALLBACK, it, i\)/);
  // 「名字优先于 note」这条规则只该有一份实现
  assert.equal((screens.match(/pick\(String\(\(it && it\.name\) \|\| ""\), true\)/g) || []).length, 1,
    "认色的规则又被抄了一遍——改了一处另一处就跟不上");
});

// ── 入口两屏（她 2026-08-29「做吧宝宝」）────────────────────
// 原先：进随身物先看到一个盒子，点开是五个白方块写着斜体英文，
// 下面空着三分之二屏——谁也不知道每一栏里装的是什么。
test("版块页是一个立着的柜子，每一格露出那一栏真实的颜色", () => {
  const i = screens.indexOf("  // 一格一格的抽屉，摞成一个立着的柜子");
  assert.ok(i > 0, "找不到柜子那一屏");
  const seg = screens.slice(i, screens.indexOf("\n    // ⚠️这个弹层以前写在滚动容器", i));
  // 颜色来自真数据，衣柜用布色、别的用材质色——不是我另配的一组装饰色
  assert.match(seg, /const tone = sec\.closet \? clothTone : stuffTone/, "预览色没按栏取对");
  assert.match(seg, /carryFlatItems\(sec\.key, data\[sec\.key\]\)/, "预览色没从真数据取");
  assert.match(seg, /const namesOf = sec =>/, "光有颜色不知道装着什么，得念几个名字");
  assert.match(seg, /const countOf = sec =>/);
  // 抽屉：拉手、柜脚、落地的影
  assert.match(seg, /borderRadius: 4, background: "linear-gradient\(90deg,rgba\(56,42,28/, "抽屉拉手");
  assert.match(seg, /柜脚/, "柜脚");
  assert.match(seg, /落地的影/, "落地的影");
  // 空的那几格也要有节奏，别只剩一行灰字
  assert.match(seg, /border: "1px dashed rgba\(74,58,40/, "空槽");
  // 抽屉给固定高度、柜子不硬撑满屏（撑满的话内容只占上面一半，下面全空）
  assert.doesNotMatch(seg, /className: "flex-1 min-h-0 w-full text-left/, "抽屉又被 flex-1 撑高了");
  assert.doesNotMatch(seg, /background: "#[0-9a-fA-F]{6}"/, "别写死颜色，换主题就脱节了");
});

test("进随身物是一扇对开的柜门，不是盒子", () => {
  const i = screens.indexOf("  // 进随身物的第一屏：一扇关着的对开柜门");
  assert.ok(i > 0, "找不到柜门那一屏");
  const seg = screens.slice(i, screens.indexOf("\n  const data = carry[char.id]", i));
  assert.doesNotMatch(seg, /CARRY"\)\)\),\s*\n\s*h\("div", \{ style: \{ fontFamily: F_BODY, fontSize: 12/, "旧的盒子还在");
  assert.match(seg, /transform: boxOpen \? "rotateY\(" \+ \(side === "left" \? "-\d+deg" : "\d+deg"\)/, "两扇门要往两边转开");
  assert.match(seg, /transformOrigin: side \+ " center"/, "门轴在外侧边");
  assert.match(seg, /pointerEvents: boxOpen \? "none" : "auto"/, "门开了就不该再挡住里面的头像");
  assert.match(seg, /tabIndex: boxOpen \? -1 : 0/, "开了的门也不该再被键盘选中");
  // ⚠️内壁必须不透光，否则外框那层竖木纹会从柜子里透上来，门一开看到的还是门
  assert.match(seg, /background: t\.bg2,\s*\n\s*backgroundImage: "linear-gradient\(180deg,rgba\(74,58,40/, "柜内壁透光了");
  assert.match(seg, /inset 13px 0 18px -14px/, "内壁的侧影——柜子是有深度的");
});

test("两处入口也用紧凑标题栏（mobile-ui-layout §1）", () => {
  const box = screens.slice(screens.indexOf("  // 进随身物的第一屏"), screens.indexOf("\n  const data = carry[char.id]"));
  const cab = screens.slice(screens.indexOf("  // 一格一格的抽屉"), screens.indexOf("\n    // ⚠️这个弹层以前写在滚动容器"));
  [["柜门屏", box], ["柜子屏", cab]].forEach(([name, seg]) => {
    assert.doesNotMatch(seg, /h\(Head, \{/, name + " 又退回 Head 那块大标题了");
    assert.match(seg, /paddingTop: safeTop\(10\)/, name + " 顶栏得自己吃安全区");
    assert.equal((seg.match(/width: 40, height: 40/g) || []).length, 2, name + " 左右操作位要等宽，标题才真居中");
  });
});

test("切换角色那个弹层挪出了滚动容器", () => {
  // 遮罩是 absolute inset-0：写在 overflow-y-auto 里面的话，它只盖得住内容区、盖不住顶栏
  assert.match(screens, /⚠️这个弹层以前写在滚动容器【里面】/);
  const i = screens.indexOf("    // ⚠️这个弹层以前写在滚动容器");
  const before = screens.slice(screens.indexOf("  // 一格一格的抽屉"), i);
  assert.doesNotMatch(before, /overflow-y-auto/, "柜子那一屏不该再套一层滚动容器把弹层困在里面");
});

// ── 摆到他面前（她 2026-08-29：「再做跟查手机一样可以发给他的功能吧」）──
test("随身物也能摆到他面前，和查手机共用同一张卡", () => {
  assert.match(app, /const CARRY_PEEK = \{/);
  assert.match(app, /const forwardCarryToChat = \(charId, sectionKey, item\) => \{/);
  assert.match(app, /forwardPhonePeekToChat\(char, \{/, "没走查手机那条现成的链，等于又抄了一套");
  assert.match(screens, /onPeek\(char\.id, sectionKey, sheet\); setSheet\(null\)/, "详情里没有这个按钮");
  // 五栏各自的档位：包/口袋/衣柜是「你翻的」，珍藏是「他藏着的」，礼物是「你送的」
  const conf = app.match(/const CARRY_PEEK = \{[\s\S]*?\n  \};/)[0];
  assert.match(conf, /bag:\s+\{ what: "包",\s+tier: "quiet"/);
  assert.match(conf, /outfit:\s+\{ what: "衣柜", tier: "quiet"/);
  assert.match(conf, /trinket: \{ what: "东西", tier: "hidden"/, "珍藏是他藏着的东西");
  assert.match(conf, /gifts:\s+\{ what: "东西", tier: "open"/, "礼物是你送的，他本来就知道你知道");
  // 珍藏那一档的「藏起来」不能沿用手机那套说法（小号／深夜／删掉的）
  assert.match(conf, /hiddenWhat: "他一直贴身收着的/);
});

test("摆过去的只有东西本身，绝不带他的心声", () => {
  const i = app.indexOf("  const forwardCarryToChat = (charId, sectionKey, item) => {");
  const seg = app.slice(i, app.indexOf("\n  };", i));
  assert.match(seg, /title: item\.name/);
  assert.match(seg, /text: item\.note \|\| ""/);
  assert.doesNotMatch(seg, /thought/, "thought 是他对这件东西没说出口的想法，摆过去就把张力泄了");
  // 界面那边传进来的是整个 sheet 对象，所以这一层必须自己挑字段，不能整份转发
  assert.doesNotMatch(seg, /Object\.assign\(\{\}, item\)|\.\.\.item/, "别整份转发，会把 thought 一起带过去");
});

test("判词跟着翻的是什么走，不再写死「手机」", () => {
  assert.match(app, /const phonePeekTag = \(tier, what, hiddenWhat\) =>/);
  assert.doesNotMatch(app, /const PHONE_PEEK_TAG = \{/, "旧的写死版还在");
  assert.match(app, /是她自己翻你" \+ what \+ "翻到的/);
  // 卡片上那行小字同理
  assert.match(R("components.js"), /"翻他" \+ \(p\.what \|\| "手机"\) \+ " · "/);
});

// 她 2026-08-29 真机截图抓出来的三个
test("材质词表认得现代的东西，「金属」不是「金」", () => {
  const F4 = (() => {
    const pre = screens.slice(screens.indexOf("const CLOTH_TONES"), screens.indexOf("const STUFF_TONES"));
    const head = screens.slice(screens.indexOf("const STUFF_TONES"), screens.indexOf("// 一件挂着的衣服"));
    return new Function(pre + head + "\nreturn { stuffTone, stuffColumns };")();
  })();
  const w = (n, note) => F4.stuffTone({ name: n, note: note || "" }, 0).word;
  // ⚠️「金属」必须排在「金」前面，否则金属徽章会被判成鎏金色
  assert.equal(w("冷门动画金属徽章", ""), "金属");
  assert.equal(w("亚克力立牌", ""), "亚克力");
  assert.equal(w("AirPods耳机盒", ""), "电子", "命中英文牌子名时该显示中文");
  assert.equal(w("帆布托特包", ""), "帆布");
  // note 里说的常是「它在哪／谁给的」，不是「它什么做的」：这两条是真机截图里的原样
  assert.equal(w("兵头九门的亚克力立牌", "未拆封，静静躺在包内侧口袋"), "亚克力", "被 note 里的「口袋」抢走了");
  assert.equal(w("旧怀表", "外壳贴着低调的动画联名贴纸"), "", "被 note 里的「贴纸」抢走了");
  // 但明确的材质词仍旧可以从 note 里读——「一串钥匙／铜的」那种
  assert.equal(w("一串钥匙", "铜的"), "铜");
});

test("两列按高度分，不是按奇偶分", () => {
  const F5 = (() => {
    const pre = screens.slice(screens.indexOf("const CLOTH_TONES"), screens.indexOf("const STUFF_TONES"));
    const head = screens.slice(screens.indexOf("const STUFF_TONES"), screens.indexOf("// 一件挂着的衣服"));
    return new Function(pre + head + "\nreturn stuffColumns;")();
  })();
  const it = n => ({ name: n, note: "一句差不多长的说明文字" });
  // 奇偶分列的话三件会变成左二右一、右边空一大块（她 2026-08-29 真机截图）
  const three = F5([it("甲"), it("乙"), it("丙")]).map(c => c.length);
  assert.deepEqual(three, [2, 1]);
  // 区分度在这里：第一件很长、后两件很短。
  // 奇偶分列会得到 [长,短乙] / [短甲]（左边更高更歪）；按高度分该是 [长] / [短甲,短乙]。
  const cols = F5([
    { name: "名字很长很长很长的一件东西要占好几行", note: "说明也很长很长很长很长很长很长很长很长很长很长" },
    { name: "甲", note: "" }, { name: "乙", note: "" }
  ]).map(c => c.map(x => x.it.name));
  assert.deepEqual(cols, [["名字很长很长很长的一件东西要占好几行"], ["甲", "乙"]],
    "两列还是按奇偶分的——长的那件后面不该再堆东西");
});

// ── 同一件东西不许在两处（她 2026-08-29 真机截图：包内和珍藏里都有
//    立牌、徽章、小本子）。四栏各自生成、谁也不知道别栏写过什么。
const F6 = (() => {
  const head = screens.slice(screens.indexOf("const CLOSET_MAX_OCCASIONS"), screens.indexOf("function carryProbeSpec"));
  return new Function(head + "\nreturn { carrySameThing, carryDedupe, carryElsewhere, carryAvoidBlock, carryNameNorm };")();
})();

test("认得出「是不是同一件东西」，又不至于把不同的东西并掉", () => {
  // 她截图里那三对
  assert.ok(F6.carrySameThing("兵头九门的亚克力立牌", "兵头九门的亚克力立牌（未拆封）"));
  assert.ok(F6.carrySameThing("冷门动画金属徽章", "帆布包上的冷门动画金属徽章"));
  assert.ok(F6.carrySameThing("随身记词小本子", "随身记词小本子"));
  // 短名字不做包含判断，否则一件会吃掉好几件不同的东西
  assert.ok(!F6.carrySameThing("伞", "油纸伞"));
  assert.ok(!F6.carrySameThing("玉", "玉佩"));
  assert.ok(!F6.carrySameThing("", "什么"));
});

test("生成时把别栏已有的喂过去，写回来之前再删一道", () => {
  const box = { bag: { items: [{ name: "随身记词小本子" }, { name: "油纸伞" }] } };
  const el = F6.carryElsewhere("trinket", box, [{ name: "羊毛围巾" }]);
  assert.deepEqual(el.map(r => r.where + ":" + r.name),
    ["bag:随身记词小本子", "bag:油纸伞", "gifts:羊毛围巾"], "礼物也该算在「别处」里");
  // 提示词那一半
  const blk = F6.carryAvoidBlock(el);
  assert.match(blk, /这些东西已经在他别处了，一件都别再写/);
  assert.match(blk, /同一件东西只能待在一个地方/);
  assert.match(blk, /· 包内：随身记词小本子、油纸伞/);
  assert.match(blk, /· 收到的礼物：羊毛围巾/);
  assert.equal(F6.carryAvoidBlock([]), "", "别处什么都没有时别发这一段");
  // 代码那一半：规则降概率，代码才保证
  const out = F6.carryDedupe("trinket", { items: [{ name: "随身记词小本子" }, { name: "一块旧玉" }, { name: "羊毛围巾" }] }, el);
  assert.deepEqual(out.items.map(x => x.name), ["一块旧玉"]);
  // 衣柜是分组的，去重不能把它拍平
  const closet = { closet: [{ occasion: "上朝", sets: [{ name: "绯色官袍" }, { name: "油纸伞" }] }, { occasion: "在家", sets: [{ name: "油纸伞" }] }] };
  const c2 = F6.carryDedupe("outfit", closet, el);
  assert.deepEqual(c2.closet.map(g => g.occasion + "/" + g.sets.length), ["上朝/1"], "整组空了就该整组去掉");
});

test("三栏的分工用判据说死，不再是三句意思差不多的话", () => {
  const i = screens.indexOf("    bag: {\n      instruction:");
  assert.ok(i > 0, "找不到三栏的 instruction");
  const seg = screens.slice(i, screens.indexOf("    // 衣柜按【场合】分组", i));
  assert.match(seg, /他【出门要用】的东西/, "包内：要用");
  assert.match(seg, /伸手就摸得到/, "口袋：摸得到");
  assert.match(seg, /一点用都没有，他还是带着/, "珍藏：舍不得");
  // 三条判据要互相点名，模型才知道该把一件东西放哪
  assert.match(seg, /那些归「珍藏小物」/);
  assert.match(seg, /那些归「包内」或「口袋」/);
  assert.match(seg, /宁可只有两三件，也不许拿有用的东西凑数/);
});

test("刷新全部时用本地攒的账，不读还没落地的 carryRef", () => {
  // v58.14 起四栏是【一次调用】拿回来的，串行那个成因没了；
  // 但这条不变量还在：落盘那一圈仍然是一栏一栏写的，carryRef 要下一帧才更新，
  // 所以 carryElsewhere 照样只能读本地这份边写边攒的账。
  const i = app.indexOf("  const genCarryAll = async char => {");
  const seg = app.slice(i, app.indexOf("\n  };", i));
  assert.match(seg, /const sofar = \{ \.\.\.\(carryRef\.current\[char\.id\] \|\| \{\}\) \};/);
  assert.match(seg, /carryElsewhere\(k, sofar,/, "读 carryRef 的话，写到第二栏时读到的还是上一帧");
  assert.match(seg, /sofar\[k\] = merged;/, "写完一栏要记进本地这份账，下一栏才避得开");
  assert.doesNotMatch(seg, /carryElsewhere\(k, carryRef\.current/, "直接读 carryRef 就是那个坑");
});

// 她 2026-08-29：「里面的背景都是一样的米色有点单调」
test("每一栏有自己的调子，而且都是叠色不写死", () => {
  assert.match(screens, /const CARRY_TINT = \{/);
  const tint = screens.match(/const CARRY_TINT = \{[\s\S]*?\n\};/)[0];
  ["bag", "pocket", "trinket", "outfit", "gifts"].forEach(k => assert.ok(tint.includes(k + ":"), k + " 没有自己的色"));
  // 五栏不能全是同一个值（那就等于没分）
  const vals = new Set((tint.match(/"(\d+,\d+,\d+)"/g) || []));
  assert.ok(vals.size >= 3, "至少要分出三种调子，现在只有 " + vals.size + " 种");
  assert.match(screens, /const carryTint = \(key, a\) => "rgba\("/);
  // 整页底色不再只给衣柜，而且要铺在最外层（顶栏也吃得到）
  assert.match(screens, /\{ tint: CARRY_TINT\[sectionKey\], word: sec\.en \}/, "每一栏要带上自己的色相和自己的英文名");
  assert.doesNotMatch(screens, /style: sec\.closet \? \{ background: "linear-gradient/, "整页底色又只剩衣柜有了");
  const shell = screens.slice(screens.indexOf("  // ⚠️这一栏的底色要铺在【最外层】"), screens.indexOf("    h(\"div\", { className: \"flex-1 overflow-y-auto px-5 pt-2 pb-8\" }"));
  assert.ok(shell, "找不到最外层那一层");
  assert.doesNotMatch(shell, /shrink-0 flex items-center px-4 pb-2", style: \{ background:/, "顶栏自己又上色了，会把外层那层底挡住");
  // 珍藏的内衬是绒：斜纹，和包里的帆布、口袋的布不一样
  assert.match(screens, /sectionKey === "trinket"\s*\n?\s*\? "repeating-linear-gradient\(48deg/);
});
