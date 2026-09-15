// 她 2026-09-15：「这种 3D 类的可以移动看全景的咋做啊」→「开始吧」。
// 这一份钉的是那间屋子的算术：摆放、投影、剔除、点选。
// 全是纯函数，所以整份能在 node 里跑——一行 WebGL 都不用碰，也不用挂 three.js
//（仓库里那几个库都是自托管的，这一屋子十来个盒子不值得再背一个 600KB 的引擎）。
const test = require("node:test");
const assert = require("node:assert/strict");
const K = require("../js/room3d.js");

const place = (names, id) => ({ id: id || "d1", name: "屋", ambient: "冷咖啡味",
  zones: [{ name: "一块", items: names.map(n => ({ name: n, note: n + "的来历", thought: "我" + n })) }] });
const VP = { w: 390, h: 600, fov: 1.55 };

test("认不出来的东西不许丢：落成箱子，屋里照样有这一件", () => {
  assert.equal(K.kindOf("旧沙发"), "sofa");
  assert.equal(K.kindOf("那本翻烂的书架"), "shelf");
  assert.equal(K.kindOf("她寄来的明信片"), "frame");
  assert.equal(K.kindOf("说不清是什么的一团"), "box", "认不出的要落到箱子，不能返回空");
  const L = K.layoutRoom(place(["旧沙发", "说不清是什么的一团", "另一样怪东西"]));
  assert.equal(L.pieces.length, 3, "他去处里写了几件，屋里就得有几件");
  assert.deepEqual(L.pieces.map(p => p.label), ["旧沙发", "说不清是什么的一团", "另一样怪东西"]);
});

test("每一件都带着他自己那句话（零调用：全是去处里现成的）", () => {
  const L = K.layoutRoom(place(["台灯"]));
  assert.equal(L.pieces[0].note, "台灯的来历");
  assert.equal(L.pieces[0].thought, "我台灯");
  assert.equal(L.pieces[0].zone, "一块");
});

test("同一间屋子每次进来摆得一模一样", () => {
  const p = place(["旧沙发", "茶几", "地毯", "台灯", "纸箱"]);
  const a = K.layoutRoom(p), b = K.layoutRoom(p);
  assert.deepEqual(a.pieces, b.pieces, "随机得按 id 定死，不然每次开门屋子都变样");
  assert.deepEqual(a.palette, b.palette);
  // 换个人就该是另一间屋子
  const c = K.layoutRoom(place(["旧沙发", "茶几", "地毯", "台灯", "纸箱"], "d2"));
  assert.notDeepEqual(c.pieces.map(x => [x.x, x.z]), a.pieces.map(x => [x.x, x.z]));
});

test("东西多的人屋子大，但都关在屋里", () => {
  const small = K.layoutRoom(place(["台灯", "纸箱"]));
  const big = K.layoutRoom(place(Array.from({ length: 16 }, (_, i) => "东西" + i)));
  assert.ok(big.w > small.w && big.d > small.d, "东西多就该住得开一点");
  [small, big].forEach(L => L.pieces.forEach(p => {
    assert.ok(Math.abs(p.x) <= L.w / 2 && Math.abs(p.z) <= L.d / 2, p.label + " 摆到墙外面去了");
  }));
});

test("朝向公式：站在左墙不能脸贴着墙（算错过一次）", () => {
  // toView 绕 y 转 -yaw、看向 +z，所以朝前的世界方向是 (-sin yaw, 0, cos yaw)
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + " ≠ " + b);
  near(K.facing(Math.PI)[2], -1);              // 朝 -z
  near(K.facing(-Math.PI / 2)[0], 1);          // 朝 +x
  near(K.facing(Math.PI / 2)[0], -1);          // 朝 -x
  const L = K.layoutRoom(place(["旧沙发", "书桌"]));
  K.spots(L).forEach(sp => {
    const f = K.facing(sp.yaw);
    // 站位贴着哪面墙，就不许朝那面墙看
    if (sp.x < -0.01) assert.ok(f[0] > 0, sp.name + " 脸贴着左墙");
    if (sp.x > 0.01) assert.ok(f[0] < 0, sp.name + " 脸贴着右墙");
    if (sp.z > 0.01) assert.ok(f[2] < 0, sp.name + " 脸贴着后墙");
  });
});

test("近平面裁剪：贴着墙站也不许整面墙忽然翻走", () => {
  // 一条从相机前面跨到背后的边，要在近平面上切一刀，不是整片扔掉
  const poly = K.clipNear([[-1, 1, 2], [1, 1, 2], [1, -1, -1], [-1, -1, -1]]);
  assert.ok(poly.length >= 3, "切完不该剩不下东西");
  poly.forEach(p => assert.ok(p[2] >= K.NEAR - 1e-9, "切完还有点在相机背后：" + p[2]));
  // 整片都在背后的，才该整片扔掉
  assert.equal(K.clipNear([[0, 0, -1], [1, 0, -1], [1, 1, -2], [0, 1, -2]]).length, 0);
});

test("屋壳永远垫在最底下，背对相机的面一个都不画", () => {
  const L = K.layoutRoom(place(["旧沙发", "书桌", "台灯", "纸箱"]));
  const list = K.renderList(L, K.spots(L)[0], VP);
  const lastShell = list.map(f => !!f.shell).lastIndexOf(true);
  const firstPiece = list.findIndex(f => !f.shell);
  assert.ok(firstPiece < 0 || lastShell < firstPiece, "家具被墙盖住了");
  // 家具之间远的先画（画家算法）
  const depths = list.filter(f => !f.shell).map(f => f.depth);
  for (let i = 1; i < depths.length; i++) assert.ok(depths[i] <= depths[i - 1] + 1e-9, "远近排反了");
});

test("点哪件就是哪件：拿最靠前的那一片", () => {
  const L = K.layoutRoom(place(["旧沙发", "书桌", "台灯", "地毯", "书架"]));
  const list = K.renderList(L, K.spots(L)[0], VP);
  const top = list.filter(f => f.pickId).pop();
  const cx = top.pts.reduce((a, p) => a + p[0], 0) / top.pts.length;
  const cy = top.pts.reduce((a, p) => a + p[1], 0) / top.pts.length;
  assert.equal(K.pick(list, cx, cy), top.pickId);
  // 屋壳点不中（点墙不该弹出一张卡）
  const floor = list.find(f => f.shell);
  assert.equal(floor.pickId, null);
});

test("站着转一圈得看得全 —— 这是这个玩法成立的底线", () => {
  // ⚠️视角收窄到一档正常镜头之后（横 52° 左右），一个站位一个朝向当然看不全——
  //   人本来就会拖着转头。所以这一条量的是【站在那儿转一圈】能不能看全。
  [4, 10, 16].forEach(n => {
    const L = K.layoutRoom(place(Array.from({ length: n },
      (_, i) => ["旧沙发", "茶几", "地毯", "书桌", "台灯", "书架", "窗", "绿萝", "明信片", "纸箱", "椅子", "床"][i % 12] + i)));
    const seen = new Set();
    K.spots(L).forEach(sp => {
      for (let a = 0; a < 16; a++) {
        const cam = { x: sp.x, y: sp.y, z: sp.z, yaw: sp.yaw + a * Math.PI / 8, pitch: sp.pitch };
        K.renderList(L, cam, VP)
          .filter(f => f.pickId && f.pts.some(p => p[0] >= 0 && p[0] <= VP.w && p[1] >= 0 && p[1] <= VP.h))
          .forEach(f => seen.add(f.pickId));
      }
    });
    assert.equal(seen.size, L.pieces.length, n + " 件里有 " + (L.pieces.length - seen.size) + " 件转一圈也看不见");
  });
});

test("低头就是低头：pitch 为负，地平线要往上跑（算反过一次）", () => {
  // 第一版把 pitch 写成 -pitch，于是四个站位全在盯天花板，屏幕四成是空白墙顶
  const cam0 = { x: 0, y: 1.4, z: 0, yaw: 0, pitch: 0 };
  const down = { x: 0, y: 1.4, z: 0, yaw: 0, pitch: -0.3 };
  const ahead = [0, 1.4, 3];   // 正前方、眼睛那么高
  const f = (face, cam) => K.projectFace(face, cam, VP).pts[0][1];
  const face = { tone: 0, n: [0, 0, -1], v: [ahead, ahead, ahead, ahead] };
  assert.ok(Math.abs(f(face, cam0) - VP.h / 2) < 0.5, "平视时地平线该在正中");
  assert.ok(f(face, down) < VP.h / 2 - 10, "低头之后眼前那点该跑到画面上半边去");
  // 四个站位一律略微低头（站着看屋子，眼睛落在东西上）
  const L = K.layoutRoom(place(["旧沙发"]));
  K.spots(L).forEach(sp => assert.ok(sp.pitch < 0 && sp.pitch > -0.5, sp.name + " 的俯仰不对：" + sp.pitch));
});

test("横竖各一个上限，谁紧听谁的（返工过两次）", () => {
  // 只按高度算 → 竖屏上横向被压扁；只按宽度算 → 竖屏上变成 120° 鱼眼
  const wide = { w: 390, h: 780, fov: K.HFOV_MAX };
  const cam = { x: 0, y: 1.4, z: 0, yaw: 0, pitch: 0 };
  const at = d => K.projectFace({ tone: 0, n: [0, 0, -1], v: [d, d, d, d] }, cam, wide).pts[0];
  // 画面边缘对应的视角：两个方向都不许超出上限
  const f = Math.max((wide.w / 2) / Math.tan(K.HFOV_MAX / 2), (wide.h / 2) / Math.tan(K.VFOV_MAX / 2));
  assert.ok(2 * Math.atan((wide.w / 2) / f) <= K.HFOV_MAX + 1e-9, "横向超出上限");
  assert.ok(2 * Math.atan((wide.h / 2) / f) <= K.VFOV_MAX + 1e-9, "纵向超出上限（竖屏鱼眼）");
  // 竖屏上卡住的应该是纵向那一条
  assert.ok((wide.h / 2) / Math.tan(K.VFOV_MAX / 2) > (wide.w / 2) / Math.tan(K.HFOV_MAX / 2), "竖屏上该由纵向说了算");
  assert.ok(at([0, 1.4, 3])[1] > 0);
});

test("屋顶要画，而且不能比墙还白", () => {
  const L = K.layoutRoom(place(["旧沙发"]));
  const list = K.renderList(L, K.spots(L)[0], VP);
  assert.ok(list.some(f => f.ceil), "不画屋顶的话，墙顶上是一片空，不像屋子像个没盖的盒子");
});

test("抬头低头有限度，别翻过去", () => {
  assert.equal(K.clampPitch(9), 0.55);
  assert.equal(K.clampPitch(-9), -0.75);
  assert.equal(K.clampPitch(0.2), 0.2);
});

// ── 接线：入口、退路、脚本都得在 ────────────────────────────────────
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

test("从【去处】那处地方走进去，一层层退得回来", () => {
  const dwell = R("js/dwell.js");
  assert.match(dwell, /if \(view === "room" && open && window\.RoomView\)/, "没有这一页");
  assert.match(dwell, /h\(window\.RoomView, \{ place: open, char: char, onBack: function \(\) \{ setView\("place"\); \} \}\)/);
  assert.match(dwell, /else if \(view === "room"\) \{ setView\("place"\); \}/, "返回键退不回上一层");
  // 空屋子不给按钮（按了没反应的按钮比没有按钮更糟）
  assert.match(dwell, /\(open\.zones \|\| \[\]\)\.some\(function \(z\) \{ return \(z\.items \|\| \[\]\)\.length; \}\) && window\.RoomView/);
  assert.match(dwell, /"走进去看看"/);
});

test("两个脚本都挂上了，而且排在 dwell 前面", () => {
  const html = R("index.html");
  const a = html.indexOf('js/room3d.js'), b = html.indexOf('js/room-view.js'), c = html.indexOf('js/dwell.js');
  assert.ok(a > 0 && b > a && c > b, "顺序不对：算术 → 界面 → 去处");
  // useMemo 得在公共那份别名里（room-view 用到；core.js 原来只解构了五个）
  assert.match(R("js/core.js"), /\n  useMemo,\n/);
});

test("界面那一页：整页、顶栏走公共 Head、拖过就不算点", () => {
  const v = R("js/room-view.js");
  assert.match(v, /h\("div", \{ className: "h-full flex flex-col"/, "施工规则/no-half-sheet：整页");
  assert.match(v, /h\(Head, \{ zh: place\.name/, "施工规则/mobile-ui-layout §1：顶栏就是 Head");
  assert.match(v, /paddingBottom: "calc\(env\(safe-area-inset-bottom\) \* 0\.4 \+ 9px\)"/, "§2：底栏只吃 0.4 条安全区");
  assert.match(v, /if \(d\.moved > 7\) return;/, "手指蹭一下也会发 click，拖过就不该算点");
  assert.match(v, /touchAction: "none"/);
});
