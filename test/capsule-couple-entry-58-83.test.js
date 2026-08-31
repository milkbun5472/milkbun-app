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
  assert.match(screens, /tile\("capsule",[\s\S]*?onClick: onOpenCapsule/);
  assert.match(app, /onOpenCapsule: \(\) => setScreen\("capsule"\)/);
  assert.match(app, /screen === "capsule"[\s\S]*?onBack: \(\) => setScreen\("us"\)/);
  assert.match(capsule, /x_capsules/);
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
