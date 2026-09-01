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

  assert.match(screens, /function Us\(\{[^\n]*\bonOpenCapsule\b[^\n]*\}\) \{/);
  assert.match(screens, /capsuleDueCount\(bCid, partner\.name\)/);
  assert.match(screens, /spine\("capsule",[\s\S]*?onClick: \(\) => onOpenCapsule && onOpenCapsule\(bCid\)/);
  assert.match(app, /const \[capsuleCharId, setCapsuleCharId\] = useState\(null\)/);
  assert.match(app, /onOpenCapsule: charId => \{ setCapsuleCharId\(charId\); setScreen\("capsule"\); \}/);
  assert.match(app, /screen === "capsule"[\s\S]*?characterId: capsuleCharId/);
  assert.match(app, /screen === "capsule"[\s\S]*?onBack: \(\) => setScreen\("us"\)/);
  assert.match(capsule, /x_capsules/);
  assert.match(capsule, /const list = allList\.filter\(c => belongsTo\(c, props\.characterId/);
  assert.match(capsule, /charId: c\.id, charName: c\.name/);
  assert.doesNotMatch(capsule, /chars\.map\(c => chip/);
});

test("角色隔离只过滤显示，不覆盖或删除其他人的胶囊", () => {
  const capsule = read("js/capsule.js");
  assert.match(capsule, /const \[allList, setAllList\] = useState\(load\)/);
  assert.match(capsule, /updateAll\(prev => \[entry, \.\.\.prev\]\)/);
  assert.match(capsule, /updateAll\(prev => prev\.filter\(x => x\.id !== id\)\)/);
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
