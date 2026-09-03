const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const core = fs.readFileSync(path.join(__dirname, "..", "js", "core.js"), "utf8");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");

// 把 core.js 里那一段颜色表原样跑起来（不带 React，也不碰 window）
function loadTone() {
  const i = core.indexOf("const APP_TONE_HUE = {");
  const j = core.indexOf("const HOME_PAPER_BG = [");
  assert.ok(i > 0 && j > i && j - i < 2600, "抠不出 appTone 那一段");
  return new Function(core.slice(i, j) + "\nreturn { appTone: appTone, APP_TONE_HUE: APP_TONE_HUE, APP_HUE_POOL: APP_HUE_POOL };")();
}
// 色相是个圈：359 和 1 只差 2
const hueGap = (a, b) => { const x = Math.abs(a - b); return Math.min(x, 360 - x); };

function defaultLayout() {
  const i = comp.indexOf("  const DEFAULT_LAYOUT = [");
  const j = comp.indexOf("  const SP_RE = /^sp_/;", i);
  assert.ok(i > 0 && j > i && j - i < 1800, "抠不出 DEFAULT_LAYOUT");
  return new Function(comp.slice(i, j) + "\nreturn DEFAULT_LAYOUT;")();
}
function dockKeys() {
  const i = comp.indexOf("  const dock = [{");
  const j = comp.indexOf("  const clearLP = function", i);
  assert.ok(i > 0 && j > i && j - i < 900, "抠不出 dock");
  const seg = comp.slice(i, j);
  return (seg.match(/key: "([a-z]+)"/g) || []).map(s => s.slice(6, -1));
}
function regAppKeys() {
  const i = comp.indexOf("  const REG = {");
  const j = comp.indexOf("\n  };", i);
  assert.ok(i > 0 && j > i, "抠不出 REG");
  const src = comp.slice(i, j) + "\n  };";
  const REG = new Function(src.replace(/G:[^,}]+/g, "G: null") + "\nreturn REG;")();
  return Object.keys(REG).filter(k => REG[k].kind === "app");
}

test("同一个 key 每次都是同一个色相", () => {
  const { appTone } = loadTone();
  ["cast", "phone", "trpg", "folder_9527"].forEach(k => {
    assert.equal(appTone(k).hue, appTone(k).hue);
    assert.equal(typeof appTone(k).wash, "string");
    assert.ok(/^hsl\(\d+,/.test(appTone(k).glyph), k + " 的线条色不是 hsl");
  });
});

// v58.43 的病：色相是哈希出来的，12 个 key 撞成 8 个色，一行里挨着的两个图标一个样。
// 所以每个 app 必须【被点名】，不许落到哈希那条路上。
test("REG 里每个 app 和 dock 上那四个都点了名", () => {
  const { APP_TONE_HUE } = loadTone();
  const keys = regAppKeys().concat(dockKeys());
  const missed = keys.filter(k => typeof APP_TONE_HUE[k] !== "number");
  assert.deepEqual(missed, [], "这几个没点名，会掉进哈希里跟别人撞色：" + missed.join(" "));
});

test("默认布局里挨着的两个图标，色相至少差 40", () => {
  const { appTone } = loadTone();
  const pages = defaultLayout().concat([dockKeys()]);
  const near = [];
  pages.forEach(keys => {
    const apps = keys.filter(k => !/^w_/.test(k));   // 组件不上色，不占格位算相邻
    apps.forEach((k, n) => {
      const nb = [];
      if (n % 4 !== 3 && apps[n + 1]) nb.push(apps[n + 1]);  // 右边（4 列制，第 4 列没有右邻）
      if (apps[n + 4]) nb.push(apps[n + 4]);                  // 下面
      nb.forEach(o => {
        const g = hueGap(appTone(k).hue, appTone(o).hue);
        if (g < 40) near.push(k + "/" + o + " 只差 " + g);
      });
    });
  });
  assert.deepEqual(near, [], "挨着的图标撞色：" + near.join("；"));
});

test("没点名的 key 也得落进已有的色相里，不会算出个 undefined", () => {
  const { appTone, APP_HUE_POOL } = loadTone();
  ["f_1", "f_2", "zzzz", "", null].forEach(k => {
    const hue = appTone(k).hue;
    assert.ok(APP_HUE_POOL.includes(hue), String(k) + " 落到了色盘外：" + hue);
  });
});

// 她自己换过图标的那几个不上色——染她的图是不对的
test("换过图标的 app 不上色", () => {
  const i = comp.indexOf("  const customIcon = appKey && window.ThemeStudio");
  const j = comp.indexOf("  const customSrc =", i);
  assert.ok(i > 0 && j > i, "抠不出 GlassIcon 里取色那两行");
  const seg = comp.slice(i, j).split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert.match(seg, /!customIcon/, "上色时没排除她自己换的图标");
});

// .claude/rules/home-screen-layout.md：主屏的尺寸一个都不许动，这次只动颜色
test("主屏的骨架没被这次改色碰到", () => {
  // v58.48 起 Home 只剩一支（底搬到根节点，两支合并），根节点那一处在 app.js
  assert.equal((comp.match(/height: "100vh"/g) || []).length, 1, "Home 的 100vh 变了");
  const app0 = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  // v61.38 后面又跟了一个属性（面纱那层的 isolation），所以这行末尾多了个逗号。
  // 要钉的是【那个值没变】，不是那一行的标点。
  assert.match(app0, /height: "100vh",? \/\/ 100vh=large viewport/, "根节点的 100vh 变了");
  assert.match(comp, /className: "relative flex-1 min-h-0 overflow-hidden pt-3 flex flex-col"/, "内容区的 pt-3 没了");
  assert.match(comp, /env\(safe-area-inset-top\)/, "刘海空带没了");
});

// 没壁纸时那块底：她说「米白加白色图标有点单调」，加的是光和纹理。
// v58.48：这块底搬到了 App 根节点上（core.js 的 HOME_PAPER_BG）——
// Home 自己画的话，刘海那条空带留着纯色，顶上就多一条接不上的横杠。
test("没壁纸时的底不是一层纯色", () => {
  const core = fs.readFileSync(path.join(__dirname, "..", "js", "core.js"), "utf8");
  const i = core.indexOf("const HOME_PAPER_BG = [");
  const j = core.indexOf('].join(", ")', i);
  assert.ok(i > 0 && j > i && j - i < 2400, "抠不出 HOME_PAPER_BG");
  const seg = core.slice(i, j);
  assert.ok((seg.match(/radial-gradient/g) || []).length >= 3, "至少要有三团光");
  assert.ok((seg.match(/repeating-linear-gradient/g) || []).length >= 2, "纸纹那两道没了");
  assert.match(seg, /linear-gradient\(163deg/, "底色那层渐变没了");
});

// 她 2026-08-30：「主界面的顶部又是坏的」——根节点上面垫着一条 safe-area 空带，
// 谁画底谁就得连那条带子一起画。壁纸那一支一直是根节点画的，没壁纸这一支以前是 Home 画的。
test("底由根节点画，Home 自己透明——两支走同一条路", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  const i = app.indexOf('background: screen === "home"');
  const j = app.indexOf('height: "100vh"', i);
  assert.ok(i > 0 && j > i && j - i < 700, "抠不出根节点那段底");
  const root = app.slice(i, j);
  assert.match(root, /wallpaper[\s\S]*HOME_PAPER_BG/, "没壁纸那一支没接到根节点上");
  // Home 两支都得是透明的，不许自己再画一层
  const home = comp.slice(comp.indexOf('className: "flex flex-col relative"'), comp.indexOf('className: "relative flex-1 min-h-0 overflow-hidden pt-3'));
  assert.match(home, /background: "transparent"/);
  assert.ok(!/radial-gradient|repeating-linear-gradient/.test(home), "Home 又自己画了一层底，顶上会接不上");
  assert.match(home, /height: "100vh"/, "Home 的 100vh 不许动");
});

// 玻璃的 saturate(1.9) 会把背后的颜色乘上去：底色本身偏黄，压上去的组件就是一片米黄
//（她 2026-08-30：「app文件夹和组件背景都还是太米黄了，我想要透一点的高级感」）
test("打底那层接近中性，颜色交给上面那几团光", () => {
  const core = fs.readFileSync(path.join(__dirname, "..", "js", "core.js"), "utf8");
  const m = core.match(/linear-gradient\(163deg, (#[0-9a-f]{6})[^,]*, (#[0-9a-f]{6})[^,]*, (#[0-9a-f]{6})/i);
  assert.ok(m, "抠不出打底那层渐变");
  const chroma = hex => {
    const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    return Math.max.apply(null, v) - Math.min.apply(null, v);
  };
  [m[1], m[2], m[3]].forEach(c => assert.ok(chroma(c) <= 8, c + " 太黄了（色度 " + chroma(c) + "），玻璃会把它放大成一片米黄"));
});
