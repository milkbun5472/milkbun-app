const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = name => fs.readFileSync(path.join(__dirname, "..", "js", name), "utf8");
const app = read("app.js");
const components = read("components.js");
const engine = read("engine.js");
const theater = read("theater.js");

test("全 App 删除确认走自绘层，不依赖会被 iOS 吞掉的系统 confirm", () => {
  assert.match(components, /function requestAppConfirm\(title, body, onConfirm, confirmLabel, onCancel\)/);
  assert.match(components, /onCancel: typeof onCancel === "function" \? onCancel : null/, "取消回调必须一路送进全局确认层");
  assert.match(app, /window\.__appConfirmOpen = open/);
  assert.match(app, /appConfirm && h\(ConfirmDialog/);
  assert.match(app, /const fn = appConfirm\.onCancel; setAppConfirm\(null\); if \(typeof fn === "function"\)/, "点取消必须通知发起方解锁");
  assert.match(components, /fixed inset-0 z-\[220\]/, "确认层必须盖住小剧场大图等高层浮窗");

  const audited = fs.readdirSync(path.join(__dirname, "..", "js"))
    .filter(name => name.endsWith(".js")).map(read).join("\n");
  const nativeDelete = audited.split("\n").filter(line =>
    !/^\s*\/\//.test(line) && /(?:window\.)?confirm\(/.test(line) && /(删除|删掉|清空|移除|忘掉)/.test(line) && !/(?:不|不会)删除/.test(line)
  );
  assert.deepEqual(nativeDelete, [], "还有删除按钮依赖系统 confirm：\n" + nativeDelete.join("\n"));
});

test("单人和群线下整场删除按一条定位，并等 WAL 验真后才改界面", () => {
  const single = app.slice(app.indexOf("const offlineDelSession"), app.indexOf("const offlineEditMsg"));
  const group = app.slice(app.indexOf("const groupOfflineDelSession"), app.indexOf("const openGroupOffline"));
  for (const block of [single, group]) {
    assert.match(block, /requestAppConfirm/);
    assert.match(block, /Number\.isInteger\(fallbackIndex\)/, "老记录缺 id 时要有当前下标兜底");
    assert.match(block, /filter\(\(_, i\) => i !== idx\)/, "重复或缺失 id 也只能删点中的一条");
    assert.match(block, /await commitJSONDurable\(/, "没等保险仓验真就改界面，刷新仍可能复活");
    assert.match(block, /if \(!wrote\.durable \|\| !wrote\.live\) return toast\(/, "写失败必须保留界面和原记录");
  }
  assert.equal((components.match(/onDelSession\(s\.id, sessions\.indexOf\(s\)\)/g) || []).length, 2);
  assert.equal((components.match(/onDelSession\(id, idx\)/g) || []).length, 2);
});

test("小剧场图库删除会立墓碑，启动补档绕开墓碑", () => {
  assert.match(theater, /const GAL_GONE_KEY = "x_theaterGalleryGone"/);
  assert.match(theater, /const galTomb = img =>/);
  assert.match(theater, /loadGalGone\(\)\.forEach\(img => have\.add\(img\)\)/);
  assert.match(theater, /const loadGal = \(\) => \{ const gone = new Set\(loadGalGone\(\)\); return loadJSON\("x_theaterGallery", \[\]\)\.filter\(x => x && !gone\.has\(x\.img\)\); \}/);
  assert.match(theater, /galTomb\(item\.img\)/);
  assert.match(theater, /filter\(x => x\.id !== id && x\.img !== item\.img\)/);
  assert.match(theater, /requestAppConfirm\("从图库删掉这张？"/);
});

test("通用 JSON 写盘会读回验真，缩小写失败时挪开旧值再试", () => {
  const start = engine.indexOf("function saveJSON(k, v) {");
  const end = engine.indexOf("// ============================================================\n// 施工卡 1A", start);
  assert.ok(start > 0 && end > start);
  const make = localStorage => new Function("localStorage", "window", "console", "isIdbTextKey", "isQuotaError",
    engine.slice(start, end) + "\nreturn saveJSON;")(
      localStorage, {}, { error() {} }, () => false,
      e => !!e && e.name === "QuotaExceededError"
    );

  const swallowed = { value: '"old"', getItem() { return this.value; }, setItem() {}, removeItem() {} };
  assert.equal(make(swallowed)("x_demo", "new"), false, "静默 no-op 不能再被当成保存成功");

  let first = true;
  const shrinking = {
    value: JSON.stringify(["很大的一份旧数据", "还占着位置"]),
    getItem() { return this.value; },
    removeItem() { this.value = null; },
    setItem(k, v) { if (first) { first = false; throw Object.assign(new Error("quota"), { name: "QuotaExceededError" }); } this.value = String(v); }
  };
  assert.equal(make(shrinking)("x_demo", ["小"]), true);
  assert.equal(shrinking.value, JSON.stringify(["小"]));
});

test("关键删除先写保险仓，失败时不准碰实时镜像", () => {
  const start = engine.indexOf("async function commitJSONDurable(key, value)");
  const end = engine.indexOf("\nfunction ", start + 1);
  const block = engine.slice(start, end > start ? end : start + 1200);
  assert.match(block, /durable = await walPutVerified\(key, str\)/);
  assert.match(block, /if \(!durable\) return \{ durable: false, live: false \}/);
  assert.ok(block.indexOf("if (!durable)") < block.indexOf("saveJSON(key, value)"), "保险仓失败前不能改实时镜像");
});

test("其余本机删除也必须先写成，失败时不准退出详情或改列表", () => {
  const capsule = read("capsule.js"), debate = read("debate.js"), dream = read("dream.js");
  const dwell = read("dwell.js"), fanfic = read("fanfic.js"), impression = read("impression.js");
  const screens = read("screens.js"), rooms = read("chat-rooms.js");
  assert.match(capsule, /const next = allList\.filter[\s\S]{0,120}if \(!save\(next\)\) return[\s\S]{0,120}setAllList\(next\); setView\(null\)/);
  for (const src of [debate, dream]) assert.match(src, /if \(persist\([\s\S]{0,100}\) && view === id\) setView\("home"\)/);
  assert.match(dwell, /const next = dropPlace[\s\S]{0,160}if \(!next\) return[\s\S]{0,120}setPlaces\(next\)/);
  assert.match(fanfic, /if \(persistFics\([\s\S]{0,180}\)\) props\.toast/);
  assert.match(impression, /if \(!M\.save\(next\)\) return[\s\S]{0,120}setBook\(next\); setCardId\(null\)/);
  assert.match(rooms, /return !!write\(all\)/);
  assert.match(screens, /if \(await onSave\(nl, nextActive\) === false\) return/);
});
