const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const screens = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");

test("情侣空间共同层会被本地保存、启动恢复并接进页面", () => {
  assert.match(app, /const \[coupleHome, setCoupleHome\] = useState\(\{\}\)/);
  assert.match(app, /setCoupleHome\(loadJSON\("x_coupleHome", \{\}\)\)/);
  assert.match(app, /saveJSON\("x_coupleHome", n\)/);
  assert.match(app, /coupleHome: coupleHome/);
  assert.match(app, /onSaveCoupleHome: saveCoupleHome/);
});

test("情侣空间首页聚合今天、最近、共同档案和愿望板", () => {
  assert.match(screens, /"今天的我们"/);
  assert.match(screens, /"最近发生"/);
  assert.match(screens, /"我们的档案"/);
  assert.match(screens, /"愿望板"/);
  assert.match(screens, /recentItems\.sort\(\(a, b\) => b\.ts - a\.ts\)/);
});

test("共同档案与愿望板沿用紧凑顶栏和单一滚动容器", () => {
  const archive = screens.slice(screens.indexOf("function CoupleArchive"), screens.indexOf("function CoupleWishes"));
  const wishes = screens.slice(screens.indexOf("function CoupleWishes"), screens.indexOf("function Us"));
  for (const source of [archive, wishes]) {
    // v62.14 起愿望板外壳带软木底纹（style 挂在外壳上、Head 透明）——结构照旧核，
    // 但不锁 style 有没有、也不锁左右 padding 的具体值
    assert.match(source, /h\("div", \{ className: "h-full flex flex-col"[,\s}]/);
    assert.match(source, /h\(Head, \{/);
    assert.match(source, /className: "flex-1 min-h-0 overflow-y-auto px-\d+ pb-10"/);
  }
});

test("共同档案与愿望板不调用模型，也不绕写记忆库", () => {
  const source = screens.slice(screens.indexOf("function CoupleArchive"), screens.indexOf("function Us"));
  assert.doesNotMatch(source, /callAI|runProbe|x_memLib|Cloud\.memory/);
  assert.match(source, /这里不会从普通聊天或记忆库自动填字/);
});
