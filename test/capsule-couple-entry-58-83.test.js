const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("时光胶囊只搬入口、不搬数据，并从情侣空间原路返回", () => {
  const screens = read("js/screens.js");
  const app = read("js/app.js");
  const capsule = read("js/capsule.js");

  // ⚠️v62.41：胶囊不再是【另一个屏】。原来点进去是 setScreen("capsule")，退出来
  //   Us 整个重挂、view 和 sub 全归零，人被扔回情侣名册——她 2026-09-04 报
  //   「时光胶囊点进去退出会整个页面退出」。「原路返回」这半句一直是假的。
  //   现在它跟这一页别的十几扇门同一个形状：openSub 进、setSub(null) 退一层。
  assert.match(screens, /function Us\(\{[^\n]*\bcapsuleProps\b[^\n]*\}\) \{/);
  assert.match(screens, /capsuleDueCount\(bCid, partner\.name\)/);
  // 书脊不许再自己 onClick 跳走：走 spine 默认的 openSub 才会记住滚动位置
  assert.match(screens, /spine\("capsule", \{ zh: "时光胶囊"/);
  assert.doesNotMatch(screens, /onOpenCapsule/, "旧那条跳屏的线还留着");
  assert.match(screens, /sub === "capsule" && typeof window !== "undefined" && window\.CapsuleApp\)/);
  assert.match(screens, /characters: characters, characterId: partner\.id, profile: profile, onBack: \(\) => setSub\(null\)/,
    "退出来没有只退一层");
  assert.match(app, /capsuleProps: \{ active: active, apiFor: apiFor, ctxFor: ctxFor, toast: toast \}/);
  // 旧那一屏整块删掉，不是留在原地打个叉（她 2026-08-30）
  assert.doesNotMatch(app, /screen === "capsule"/, "那一屏还留着——两条路进同一个页面");
  assert.doesNotMatch(app, /capsuleCharId/, "只给那一屏用的 state 还留着");
  assert.match(capsule, /x_capsules/);
  assert.match(capsule, /const list = allList\.filter\(c => belongsTo\(c, props\.characterId/);
  assert.match(capsule, /charId: c\.id, charName: c\.name/);
  assert.doesNotMatch(capsule, /chars\.map\(c => chip/);
});

test("角色隔离只过滤显示，不覆盖或删除其他人的胶囊", () => {
  const capsule = read("js/capsule.js");
  assert.match(capsule, /const \[allList, setAllList\] = useState\(load\)/);
  assert.match(capsule, /updateAll\(prev => \[entry, \.\.\.prev\]\)/);
  assert.match(capsule, /const next = allList\.filter\(x => x\.id !== id\)/, "必须从未过滤的完整列表删除，不能拿当前角色的可见列表覆盖全库");
  assert.match(capsule, /if \(!save\(next\)\) return[\s\S]{0,120}setAllList\(next\)/, "落盘失败时不能先从页面消失");
  assert.doesNotMatch(capsule, /persist\(\[entry, \.\.\.list\]\)/);
});

test("主屏注册表和默认布局不再提供时光胶囊图标", () => {
  const components = read("js/components.js");
  const regStart = components.indexOf("  const REG = {");
  const regEnd = components.indexOf("\n  };", regStart);
  const layoutStart = components.indexOf("  const DEFAULT_LAYOUT = [", regEnd);
  const layoutEnd = components.indexOf("\n  ];", layoutStart);
  const reg = components.slice(regStart, regEnd);
  const layout = components.slice(layoutStart, layoutEnd);

  assert.doesNotMatch(reg, /capsule:\s*\{\s*kind:\s*"app"/);
  assert.doesNotMatch(layout, /"capsule"/);
});
