// 主页名片（她 2026-09-03 两轮：先说「太单调」，看过第一版又说「和这个太像了……
// 可以重组位置和能填的东西，不要的也能删。还有那仨数字能不能搞点别的和恋爱无关的」）。
//
// 第一版只换了皮，骨架还是那家的：圆头像在左 → 名字/斜体引号一句/两颗药丸 → 圆铅笔在右。
// 所以这条钉的是【骨架真的换了】+【数字跟恋爱无关】+【不许把主屏撑坏】。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const card = comp.slice(comp.indexOf("function HomeCard("), comp.indexOf("function HomeCardSheet("));

test("骨架换掉了：方头像在右、名字当主角、标签不是药丸", () => {
  // 头像：方的，而且排在名字后面＝在右边。v61.31 放大一档（48→53）当右侧主角
  assert.match(card, /h\(Avatar, \{ character: \{ name: profile\.name[\s\S]{0,90}size: 53, radius: 13 \}\)/);
  assert.ok(card.indexOf("fontSize: 23") < card.indexOf("radius: 13 }"), "名字要排在头像前面（名字左、头像右）");
  // 标签不再是药丸：仍是一行用「/」隔开的小字。v61.31 起拆成节点（斜杠要更淡），
  // 所以认的是「有这个隔法」，不是那一句 join
  assert.match(card, /"　\/　"/);
  assert.doesNotMatch(card, /borderRadius: 999[^}]*}[^}]*tags/, "标签又变回药丸了");
  // 签名不再加引号、不再斜体
  assert.doesNotMatch(card, /"“" \+ sign/);
  assert.doesNotMatch(card, /fontStyle: "italic"/);
  // v60.85 她让去掉眉批：那一行没了，两颗键压到右上角，省下的高度还给这一屏
  assert.doesNotMatch(card, /"ARCHIVE"/);
  // v60.88 两颗键改到【右下角】：放右上角要给它让位，头像就被挤到中间去了
  assert.match(card, /position: "absolute", bottom: 9, right: 12/);
  assert.doesNotMatch(card, /paddingRight: 62/, "头像那一行不许再为按键留位");
});

test("那仨数跟恋爱无关，也不是 Following/Follower/Like", () => {
  assert.match(card, /\[\(characters \|\| \[\]\)\.length, "认识"\], \[memN, "记忆"\], \[dayN, "天"\]/);
  // ⚠️x_memLib 住在 IDB 文字仓，localStorage 里那份迁移后是被删掉的：
  // 直接 getItem 会让记忆恒为 0、天数恒为 1（她 2026-09-03 报，这坑犯过第二遍）
  assert.match(card, /loadJSON\(k, d\)/, "必须走 loadJSON");
  // 只看真的执行的那一句（注释里提到 getItem 是在解释为什么不能那么读）
  assert.doesNotMatch(card, /localStorage\.getItem\("x_/, "不许直接读 localStorage");
  assert.doesNotMatch(card, /"(Following|Follower|Like)"/i, "抄成社交数据就又成了任何 app");
  assert.doesNotMatch(card, /couples/, "名片不该再读情侣数据");
  // 底下那排是左对齐的一行，不是社交资料页那种三等分格子
  assert.doesNotMatch(card, /borderLeft: i \?/);
  assert.match(card, /className: "flex items-baseline", style: \{ marginTop: "auto"/);
});

test("卡有自己的封面，没设封面也不是一块白板", () => {
  assert.match(card, /const cover = c\.cover/);
  assert.match(card, /linear-gradient\(100deg,rgba\(0,0,0,\.5\)/, "有图时要压暗角，字才读得清");
  assert.match(card, /linear-gradient\(135deg," \+ accent \+ "2e/, "没图时用她头像的颜色调一层光");
  assert.match(card, /const ink = onCover \? "#fff" : t\.ink/);
});

test("绝不许给里面那层写 height:100%——那会把卡撑到整屏高", () => {
  assert.doesNotMatch(card, /height: "100%"/);
  assert.match(card, /display: "flex", flexDirection: "column" \}, skin\)/, "卡自己是 flex 列");
  assert.match(card, /flex: 1, minHeight: 0/, "里面那层用 flex:1，不是 100%");
  assert.match(card, /marginTop: "auto"/, "被行拉高时那排数贴着底边");
});

// v61.31 她拿了一份视觉意见回来（只调样式，不动数据/交互）：卡片瘦一圈、
// 名字别用纯黑、签名太浅、底下那排数权重太重、头像放大、两颗小键缩小。
test("层次靠【同一种墨的浓淡】分，不写死暖棕色", () => {
  assert.match(card, /const inkA = function \(a\)/, "没有那支从 t.ink 兑浓淡的函数");
  assert.match(card, /skinRGB\(t\.ink\)/, "墨色不是从主题算的");
  assert.ok(!/#(?:3|4|5|6)[0-9a-f]{5}/i.test(card), "写死了某个棕色，换主题就废");
  // 第一眼名字、第二眼签名与标签、第三眼那排数
  assert.match(card, /color: onCover \? ink : inkA\(\.92\)/, "名字还是纯墨");
  assert.match(card, /color: onCover \? dim : inkA\(\.62\)/, "签名还压在 t.fog 上，玻璃底上读不清");
  assert.match(card, /fontSize: 14\.5, lineHeight: 1, color: onCover \? ink : inkA\(\.76\)/, "那排数还是又大又黑");
  assert.match(card, /fontSize: 8\.5, letterSpacing: "0\.1em", color: onCover \? dim : inkA\(\.44\)/);
  // 斜杠比标签本身更淡
  assert.match(card, /inkA\(\.3\) \} \}, "　\/　"\)/);
});

test("瘦一圈：内边距和两颗键都收了，但卡还是自动高（不许写死高度）", () => {
  assert.match(card, /padding: "10px 14px 9px"/);
  assert.match(card, /width: 23, height: 23, borderRadius: 999/, "两颗小键没缩");
  assert.match(card, /bottom: 9, right: 12, gap: 9/, "两颗键之间没拉开");
  // ⚠️主屏铁律：里面这层不许写 height:100%（.claude/rules/home-screen-layout.md）
  assert.doesNotMatch(card, /height: "100%"/);
});
