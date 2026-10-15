// ============================================================
// 房间（room3d）—— 能拖着看的那间屋子
// ============================================================
// 她 2026-09-15 甩来一个别人做的 3D 房间：「这种可以移动看全景的咋做啊」。
//
// 为什么不挂 three.js：
//   仓库里那几个库全是自托管的（vendor/，注释写着「不再依赖 CDN，防国内访问
//   抽风时整站白屏」）。而这一屋子只有十来个盒子，用不着一个 600KB 的引擎——
//   自己算投影反而能整份放进 node 测试里跑，一行 WebGL 都不用碰。
//
// 为什么不做「一个房间一个模型」：
//   那样每个角色一份几兆的资源，十个角色就是几十兆，还得进桶、进同步。
//   这儿走的是【一套共用家具 + 一份摆放清单】：家具是代码里的几个盒子，
//   摆放清单是从【去处】那份现成数据长出来的——**零调用**，不多花她一分钱。
//   点一件家具弹出来的那句话，也是去处里本来就写好的 note 和 thought。
//
// 判据一句话：这间屋子里的每一件东西，都得是他那份【去处】里真有的东西。
// ============================================================
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.RoomKit = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {

  // ── 一、家具目录：每件家具就是几个盒子 ──────────────────────────
  // 局部坐标：原点在这件家具【贴地那一面的中心】，y 向上，家具默认朝 +z（面朝屋里）。
  // tone 是色号在这间屋子调色板里的下标，不是写死的颜色——同一件家具在不同人的
  // 屋里该是不同颜色的（木色/布色由调色板给）。
  const B = (x, y, z, w, h, d, tone) => ({ x, y, z, w, h, d, tone });
  const FURNITURE = {
    // 沙发：座 + 靠背 + 两个扶手
    sofa: { w: 1.9, d: 0.85, wall: true, boxes: [
      B(0, 0.18, 0, 1.9, 0.36, 0.85, 1), B(0, 0.55, -0.32, 1.9, 0.38, 0.2, 1),
      B(-0.85, 0.45, 0, 0.2, 0.26, 0.85, 1), B(0.85, 0.45, 0, 0.2, 0.26, 0.85, 1)] },
    bed: { w: 1.5, d: 2, wall: true, boxes: [
      B(0, 0.2, 0, 1.5, 0.4, 2, 3), B(0, 0.46, 0, 1.44, 0.12, 1.94, 0),
      B(0, 0.58, -0.78, 0.7, 0.14, 0.34, 2), B(0, 0.62, -1.02, 1.5, 0.84, 0.08, 3)] },
    desk: { w: 1.3, d: 0.6, wall: true, boxes: [
      B(0, 0.72, 0, 1.3, 0.06, 0.6, 3),
      B(-0.6, 0.35, -0.24, 0.06, 0.7, 0.06, 3), B(0.6, 0.35, -0.24, 0.06, 0.7, 0.06, 3),
      B(-0.6, 0.35, 0.24, 0.06, 0.7, 0.06, 3), B(0.6, 0.35, 0.24, 0.06, 0.7, 0.06, 3)] },
    table: { w: 0.95, d: 0.55, wall: false, boxes: [
      B(0, 0.38, 0, 0.95, 0.06, 0.55, 3),
      B(-0.4, 0.18, -0.2, 0.06, 0.36, 0.06, 3), B(0.4, 0.18, -0.2, 0.06, 0.36, 0.06, 3),
      B(-0.4, 0.18, 0.2, 0.06, 0.36, 0.06, 3), B(0.4, 0.18, 0.2, 0.06, 0.36, 0.06, 3)] },
    chair: { w: 0.45, d: 0.45, wall: false, boxes: [
      B(0, 0.44, 0, 0.45, 0.06, 0.45, 3), B(0, 0.68, -0.2, 0.45, 0.42, 0.05, 3),
      B(-0.18, 0.22, -0.18, 0.05, 0.44, 0.05, 3), B(0.18, 0.22, -0.18, 0.05, 0.44, 0.05, 3),
      B(-0.18, 0.22, 0.18, 0.05, 0.44, 0.05, 3), B(0.18, 0.22, 0.18, 0.05, 0.44, 0.05, 3)] },
    shelf: { w: 0.9, d: 0.3, wall: true, boxes: [
      B(-0.42, 0.9, 0, 0.06, 1.8, 0.3, 3), B(0.42, 0.9, 0, 0.06, 1.8, 0.3, 3),
      B(0, 0.04, 0, 0.9, 0.08, 0.3, 3), B(0, 0.62, 0, 0.9, 0.05, 0.3, 3),
      B(0, 1.2, 0, 0.9, 0.05, 0.3, 3), B(0, 1.76, 0, 0.9, 0.05, 0.3, 3),
      B(-0.2, 0.86, -0.02, 0.3, 0.28, 0.2, 2), B(0.16, 1.44, -0.02, 0.26, 0.26, 0.2, 1)] },
    rug: { w: 1.7, d: 1.2, wall: false, flat: true, boxes: [B(0, 0.01, 0, 1.7, 0.02, 1.2, 2)] },
    lamp: { w: 0.34, d: 0.34, wall: false, boxes: [
      // ⚠️杆别做太细：0.04 米的杆在屏幕上不到一个像素，底座就成了一块浮在地上的板
      B(0, 0.04, 0, 0.3, 0.08, 0.3, 3), B(0, 0.62, 0, 0.07, 1.2, 0.07, 3),
      B(0, 1.34, 0, 0.34, 0.28, 0.34, 4)] },
    plant: { w: 0.38, d: 0.38, wall: false, boxes: [
      B(0, 0.16, 0, 0.3, 0.32, 0.3, 2), B(0, 0.56, 0, 0.34, 0.5, 0.34, 5),
      B(0, 0.88, 0, 0.22, 0.3, 0.22, 5)] },
    // 箱子/杂物：认不出来的东西一律落到这儿，别凭空消失
    box: { w: 0.42, d: 0.34, wall: false, boxes: [B(0, 0.17, 0, 0.42, 0.34, 0.34, 2)] },
    // 挂墙的：画框和窗，贴着墙面、离地一米多
    frame: { w: 0.5, d: 0.06, wall: true, hang: 1.45, boxes: [
      B(0, 0, 0, 0.5, 0.62, 0.05, 3), B(0, 0, 0.02, 0.42, 0.52, 0.02, 4)] },
    window: { w: 1.1, d: 0.08, wall: true, hang: 1.5, boxes: [
      B(0, 0, 0, 1.1, 1.2, 0.06, 0), B(0, 0, 0.03, 0.98, 1.08, 0.02, 4),
      B(0, 0, 0.04, 0.05, 1.08, 0.02, 0), B(0, 0, 0.04, 0.98, 0.05, 0.02, 0)] }
  };

  // ── 二、名字 → 家具：词表粗筛 ────────────────────────────────
  // 跟购物页猜品类是同一个形状（app.js「从名字猜一下品类，这条链才对得上」）。
  // ⚠️认不出来【不许丢掉】：落到 box，屋里照样多一件东西——他那份去处里写了的，
  //   屋里就得有，哪怕长得只是个箱子。
  const WORDS = [
    ["bed", /床|被|褥|枕/], ["sofa", /沙发|懒人椅|长椅|卡座/],
    ["desk", /书桌|写字台|办公桌|工作台|案|台面/], ["table", /茶几|餐桌|桌|吧台/],
    ["chair", /椅|凳|墩/], ["shelf", /书架|书柜|柜|架|橱|抽屉|箱柜/],
    ["rug", /地毯|毯|垫子|地垫|榻榻米/], ["lamp", /灯|烛|台灯|落地灯/],
    ["plant", /花|草|盆栽|盆|树|绿植|绿萝|多肉|枝|叶|吊兰|仙人掌|竹/],
    ["frame", /画|照片|相框|海报|挂|镜|字帖|奖状|贴|明信片|信片|卡片|票根|门票|合影/],
    ["window", /窗|阳台|落地窗/]
  ];
  function kindOf(name) {
    const t = String(name == null ? "" : name);
    for (const [kind, re] of WORDS) if (re.test(t)) return kind;
    return "box";
  }

  // 同一间屋子每次打开都得长一样：一切随机都走这颗按 id 定死的种子。
  function seedOf(str) {
    let h = 2166136261;
    const s = String(str == null ? "" : str);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) || 1;
  }
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }

  // 调色板：一间屋子一套。墙/布/木/暖光各一档，按种子挑。
  const PALETTES = [
    ["#efeae2", "#9fb0c2", "#c9b7a4", "#b99b7d", "#f2d9a8", "#7f9d78"],
    ["#f1efe9", "#c9a9a6", "#d6cbbd", "#a98d72", "#f4dcae", "#86a083"],
    ["#eceff1", "#8fa3b0", "#c2c7cb", "#8d8377", "#efd7a6", "#789c8a"],
    ["#f3ede4", "#b8a7c9", "#cfc3b4", "#a58567", "#f6dfb4", "#8aa476"]
  ];
  const paletteOf = seed => PALETTES[seed % PALETTES.length];

  // ── 三、摆放：把【去处】那份数据排进一间屋子 ──────────────────
  // ⚠️这一步【零调用】：区域和东西是她本来就有的，这儿只负责决定谁靠哪面墙。
  //   大件贴墙、小件散在中间；同一间屋子每次进来摆得一模一样（种子定死）。
  const WALLS = ["north", "east", "south", "west"];   // north = z 最小那面
  function layoutRoom(place, opts) {
    const o = opts || {};
    const p = place || {};
    const seed = seedOf(p.id || p.name || "room");
    const rand = rng(seed);
    const items = [];
    (Array.isArray(p.zones) ? p.zones : []).forEach(z => {
      (Array.isArray(z && z.items) ? z.items : []).forEach(x => {
        if (x && x.name) items.push({ zone: String(z.name || ""), name: String(x.name),
          note: String(x.note || ""), thought: String(x.thought || "") });
      });
    });
    const cap = Math.max(1, Number(o.cap) || 18);
    const use = items.slice(0, cap);
    // 屋子大小跟东西多少走：东西少的人住得小，这本身就是话
    const W = Math.min(7, Math.max(3.6, 3.2 + use.length * 0.22));
    const D = Math.min(7, Math.max(3.4, 3.0 + use.length * 0.2));
    const H = 2.6;
    const pieces = [];
    // 贴墙的沿着四面墙走一圈；不贴墙的散在中间
    // ⚠️两条游标：落地的家具一条，挂墙的（画、窗）另一条。
    //   合成一条的话，一扇窗会吃掉 1.1 米的墙——而沙发本来可以摆在窗底下。
    const along = [0, 0, 0, 0];      // 四面墙各走到哪儿了（从墙的一头算起）
    const alongHang = [0, 0, 0, 0];
    let midN = 0;
    use.forEach((it, i) => {
      const kind = kindOf(it.name);
      const f = FURNITURE[kind] || FURNITURE.box;
      const piece = { id: "p" + i, kind, label: it.name, note: it.note, thought: it.thought, zone: it.zone };
      if (f.wall) {
        const cursor = f.hang ? alongHang : along;
        // 挑一面还塞得下的墙；四面都满了就退回中间
        let wi = -1;
        for (let k = 0; k < 4; k++) {
          const w = (i + k) % 4, span = (w % 2 === 0) ? W : D;
          if (cursor[w] + f.w + 0.25 <= span - 0.3) { wi = w; break; }
        }
        if (wi >= 0) {
          const span = (wi % 2 === 0) ? W : D;
          const off = -span / 2 + 0.3 + cursor[wi] + f.w / 2;
          cursor[wi] += f.w + 0.25;
          const back = f.d / 2 + 0.02;
          if (wi === 0) { piece.x = off; piece.z = -D / 2 + back; piece.rot = 0; }
          else if (wi === 1) { piece.x = W / 2 - back; piece.z = off; piece.rot = -Math.PI / 2; }
          else if (wi === 2) { piece.x = -off; piece.z = D / 2 - back; piece.rot = Math.PI; }
          else { piece.x = -W / 2 + back; piece.z = -off; piece.rot = Math.PI / 2; }
          if (f.hang) piece.y = f.hang;
          pieces.push(piece);
          return;
        }
      }
      // 中间那几件：绕着屋子中心散开。
      // ⚠️只按黄金角撒点是不够的（实测落地灯的杆直接穿过茶几）：每放一件就记下
      //   它占多大一圈，下一件挤得上就往外推一点，推到墙根还挤不开就算了——
      //   一间挤的屋子本来就该是挤的，但不能长在一起。
      const rad = Math.max(f.w, f.d) / 2;
      let ok = null;
      for (let step = 0; step < 14 && !ok; step++) {
        const a = midN * 2.399 + step * 0.7 + rand() * 0.3;
        const r = 0.45 + (midN % 3) * 0.5 + step * 0.16;
        const x = Math.max(-W / 2 + rad + 0.25, Math.min(W / 2 - rad - 0.25, Math.cos(a) * r));
        const z = Math.max(-D / 2 + rad + 0.25, Math.min(D / 2 - rad - 0.25, Math.sin(a) * r * 0.85));
        // 地毯不占地方：东西本来就该摆在它上面
        if (f.flat || !pieces.some(q => {
          const qf = FURNITURE[q.kind] || FURNITURE.box;
          if (qf.flat || qf.hang) return false;
          return Math.hypot(q.x - x, q.z - z) < rad + Math.max(qf.w, qf.d) / 2 + 0.12;
        })) ok = { x, z };
      }
      const put = ok || { x: 0, z: 0 };
      piece.x = put.x; piece.z = put.z;
      // ⚠️挂墙的东西没抢到墙也得挂在它该在的高度：这几件的盒子是按【中心在原点】
      //   写的，落到地上就是一半埋进地板，看着像一块浮在地上的板子。
      if (f.hang) piece.y = f.hang;
      // 地毯顺着屋子摆，别歪着——歪地毯一眼就假
      piece.rot = f.flat ? (rand() < 0.5 ? 0 : Math.PI / 2) : rand() * Math.PI * 2;
      midN++;
      pieces.push(piece);
    });
    return { w: W, d: D, h: H, seed, palette: paletteOf(seed), pieces,
      name: String(p.name || ""), ambient: String(p.ambient || "") };
  }

  // ── 四、几何：把摆放清单摊成一堆面 ────────────────────────────
  // 每个盒子六个面，每个面四个顶点（世界坐标）。面自带法线，用来打光和剔除背面。
  const FACE_DEF = [
    { n: [0, 0, -1], v: [[-1, 1, -1], [1, 1, -1], [1, -1, -1], [-1, -1, -1]] },
    { n: [0, 0, 1], v: [[1, 1, 1], [-1, 1, 1], [-1, -1, 1], [1, -1, 1]] },
    { n: [-1, 0, 0], v: [[-1, 1, 1], [-1, 1, -1], [-1, -1, -1], [-1, -1, 1]] },
    { n: [1, 0, 0], v: [[1, 1, -1], [1, 1, 1], [1, -1, 1], [1, -1, -1]] },
    { n: [0, 1, 0], v: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
    { n: [0, -1, 0], v: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] }
  ];
  function boxFaces(b, ox, oy, oz, rot, tone, pickId) {
    const c = Math.cos(rot || 0), s = Math.sin(rot || 0);
    const hw = b.w / 2, hh = b.h / 2, hd = b.d / 2;
    return FACE_DEF.map(f => ({
      pickId, tone,
      n: [f.n[0] * c + f.n[2] * s, f.n[1], -f.n[0] * s + f.n[2] * c],
      v: f.v.map(([sx, sy, sz]) => {
        const lx = b.x + sx * hw, ly = b.y + sy * hh, lz = b.z + sz * hd;
        return [ox + lx * c + lz * s, oy + ly, oz - lx * s + lz * c];
      })
    }));
  }
  // 屋壳：地板 + 四面墙 + 天花板。
  // ⚠️天花板一开始没画（怕屋里变黑），实测是错的：墙只有 2.6 米高，抬眼就是墙顶
  //   上面一片空——不像屋子，像个没盖的盒子。画上，并且给它最亮那一档
  //   （天花板本来就是屋里最亮的一面，不吃方向光也得是白的）。
  function shellFaces(L) {
    const W = L.w / 2, D = L.d / 2, H = L.h;
    const out = [];
    out.push({ pickId: null, tone: 3, shell: true, n: [0, 1, 0],
      v: [[-W, 0, D], [W, 0, D], [W, 0, -D], [-W, 0, -D]] });
    out.push({ pickId: null, tone: 0, shell: true, ceil: true, n: [0, -1, 0],
      v: [[-W, H, -D], [W, H, -D], [W, H, D], [-W, H, D]] });
    const wall = (n, v) => out.push({ pickId: null, tone: 0, shell: true, n, v });
    wall([0, 0, 1], [[-W, H, -D], [W, H, -D], [W, 0, -D], [-W, 0, -D]]);
    wall([0, 0, -1], [[W, H, D], [-W, H, D], [-W, 0, D], [W, 0, D]]);
    wall([1, 0, 0], [[-W, H, D], [-W, H, -D], [-W, 0, -D], [-W, 0, D]]);
    wall([-1, 0, 0], [[W, H, -D], [W, H, D], [W, 0, D], [W, 0, -D]]);
    return out;
  }
  function buildFaces(L) {
    const out = shellFaces(L);
    (L.pieces || []).forEach(p => {
      const f = FURNITURE[p.kind] || FURNITURE.box;
      (f.boxes || []).forEach(b => {
        boxFaces(b, p.x, p.y || 0, p.z, p.rot || 0, b.tone, p.id).forEach(x => { if (f.flat) x.flat = true; out.push(x); });
      });
    });
    return out;
  }

  // ── 五、相机与投影 ──────────────────────────────────────────
  // 视图坐标：先平移到相机，再绕 y 转 -yaw，再绕 x 转 -pitch；看向 +z。
  function toView(pt, cam) {
    const dx = pt[0] - cam.x, dy = pt[1] - cam.y, dz = pt[2] - cam.z;
    const cy = Math.cos(-cam.yaw), sy = Math.sin(-cam.yaw);
    const x1 = dx * cy - dz * sy, z1 = dx * sy + dz * cy;
    // ⚠️pitch 这一下【别再写成 -pitch】：那样负的 pitch 是抬头。
    //   第一版就是反的，于是四个站位全在盯着天花板看，屏幕四成是一片空白墙顶，
    //   我还以为是视角太广。判据很好记：**pitch 为负＝低头，地平线该往上跑**。
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    return [x1, dy * cp - z1 * sp, dy * sp + z1 * cp];
  }
  const NEAR = 0.08;
  const HFOV_MAX = 1.55;   // 横着最宽这么多（约 89°）
  const VFOV_MAX = 1.45;   // 竖着最宽这么多（约 83°）——竖屏手机上卡住的通常是这一条
  // 近平面裁剪（Sutherland–Hodgman，只切这一个面）。
  // ⚠️不裁的话，站在墙边时那面墙的顶点跑到相机背后，整面墙会忽然消失／翻到屏幕另一头。
  function clipNear(poly) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const ain = a[2] > NEAR, bin = b[2] > NEAR;
      if (ain) out.push(a);
      if (ain !== bin) {
        const t = (NEAR - a[2]) / (b[2] - a[2]);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]);
      }
    }
    return out;
  }
  function projectFace(face, cam, vp) {
    const poly = clipNear(face.v.map(p => toView(p, cam)));
    if (poly.length < 3) return null;
    // ⚠️焦距是【横竖各一个上限，谁紧听谁的】，这一处返工过两次：
    //   · 第一版照惯例只按高度算 → 竖屏上横向视角被压成 390/600，
    //     站屋里只看得见正前方巴掌大一块（实测十件家具只看得见两件）；
    //   · 第二版改成只按宽度算 → 竖屏上纵向变成 120° 的鱼眼，
    //     一屋子东西缩成小玩具，天花板占掉四成屏幕。
    //   两个上限一起卡：横不过 VFOV_MAX 对应的那档，竖也不过。
    const f = Math.max((vp.w / 2) / Math.tan((vp.fov || HFOV_MAX) / 2),
      (vp.h / 2) / Math.tan(VFOV_MAX / 2));
    let depth = 0;
    const pts = poly.map(p => {
      depth += p[2];
      return [vp.w / 2 + f * p[0] / p[2], vp.h / 2 - f * p[1] / p[2]];
    });
    return { pts, depth: depth / poly.length, tone: face.tone, n: face.n, pickId: face.pickId,
      shell: !!face.shell, ceil: !!face.ceil, flat: !!face.flat };
  }
  // 朝哪边亮：一盏斜上方的光 + 一层环境光。硬边、无贴图，就是低模那个味儿。
  const LIGHT = (() => { const v = [0.4, 0.82, -0.4]; const m = Math.hypot(v[0], v[1], v[2]); return v.map(x => x / m); })();
  function shade(n) {
    const d = n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2];
    return 0.62 + 0.38 * Math.max(0, d);
  }
  function tint(hex, k) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    const ch = i => Math.max(0, Math.min(255, Math.round(((n >> (16 - i * 8)) & 255) * k)));
    return "#" + [0, 1, 2].map(i => ch(i).toString(16).padStart(2, "0")).join("");
  }
  // 画一帧要的那份东西：远的排前面（画家算法），背对相机的面直接扔掉。
  function renderList(L, cam, vp) {
    const out = [];
    buildFaces(L).forEach(face => {
      // 背面剔除：面朝着相机才画（屋壳靠这一条自动只留你面前那两面墙）
      const mid = [(face.v[0][0] + face.v[2][0]) / 2, (face.v[0][1] + face.v[2][1]) / 2, (face.v[0][2] + face.v[2][2]) / 2];
      const toCam = [cam.x - mid[0], cam.y - mid[1], cam.z - mid[2]];
      if (face.n[0] * toCam[0] + face.n[1] * toCam[1] + face.n[2] * toCam[2] <= 0) return;
      const pr = projectFace(face, cam, vp);
      if (!pr) return;
      // 天花板是屋里最亮的一面：它朝下，按方向光算会最暗——那是反的
      pr.color = tint((L.palette || PALETTES[0])[pr.tone] || "#cccccc", face.ceil ? 0.86 : shade(face.n));
      out.push(pr);
    });
    // 三层：屋壳 → 平铺在地上的 → 站着的家具；每层里再按远近排（远的先画）。
    // ⚠️地毯必须单成一层：它贴着地、离相机最近，混在一起排会盖住桌子腿——
    //   实测第一版就是一张地毯压在茶几上面，像浮在半空。
    const rank = f => f.shell ? 0 : (f.flat ? 1 : 2);
    out.sort((a, b) => (rank(a) - rank(b)) || (b.depth - a.depth));
    return out;
  }

  // ── 六、点中了哪一件 ────────────────────────────────────────
  // 从最近的面往回找：第一个罩住这个点、而且属于某件家具的，就是它。
  function inPoly(pts, x, y) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function pick(list, x, y) {
    for (let i = list.length - 1; i >= 0; i--) {
      const f = list[i];
      if (f.pickId && inPoly(f.pts, x, y)) return f.pickId;
    }
    return null;
  }

  // ── 七、站位：几个能站的地方，绕着走 ──────────────────────────
  // 她那张截图里是「进入下一个房间…」；这儿一间屋子，换的是【站在哪儿看】。
  // ⚠️朝向那一下算错过一次：toView 是绕 y 转 -yaw、看向 +z，所以
  //   **朝前的世界方向是 (-sin yaw, 0, cos yaw)**。照直觉写 yaw=π/2 站左墙，
  //   人是脸贴着墙的——屋里什么都看不见（实测只剩 18 个面）。这几个数照公式定。
  const facing = yaw => [-Math.sin(yaw), 0, Math.cos(yaw)];
  function spots(L) {
    const W = L.w / 2 - 0.55, D = L.d / 2 - 0.55, eye = 1.45;
    return [
      { name: "门口", x: 0, y: eye, z: D, yaw: Math.PI, pitch: -0.26 },          // 朝 -z
      { name: "靠窗", x: -W, y: eye, z: 0, yaw: -Math.PI / 2, pitch: -0.24 },    // 朝 +x
      { name: "屋子中间", x: 0, y: eye, z: 0.2, yaw: Math.PI, pitch: -0.3 },
      { name: "另一头", x: W, y: eye, z: -D * 0.4, yaw: Math.PI / 2.2, pitch: -0.26 } // 朝 -x
    ];
  }
  const clampPitch = p => Math.max(-0.75, Math.min(0.55, p));

  return { FURNITURE, WORDS, kindOf, facing, seedOf, rng, PALETTES, paletteOf,
    layoutRoom, boxFaces, shellFaces, buildFaces, toView, clipNear, projectFace,
    shade, tint, renderList, HFOV_MAX, VFOV_MAX, inPoly, pick, spots, clampPitch, NEAR, LIGHT };
});
