const test = require("node:test"); const assert = require("node:assert");
require("../js/trpg-core.js");
const K = globalThis.TrpgCore;
// 一个点在不在一条 SVG 路径围起来的形状里（只认 M/L/Z，团块就是这么写的）
const poly = d => (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number).reduce((a, v, i, arr) => (i % 2 ? a : a.concat([[v, arr[i + 1]]])), []);
const inPoly = (pts, x, y) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
const mk = (n, extra) => Object.assign({ terrain: "平原", adj: [], nodes: Array.from({ length: 12 }, (_, k) => ({ name: n + k })) }, extra || {});
test("挪过、缩放过、一块塞 12 个点：每个地点都在自己那块里，不压别人那块", () => {
  const regions = [mk("甲", { name: "甲", pos: { x: 0.3, y: 0.3 }, size: 0.7 }), mk("乙", { name: "乙", pos: { x: 0.45, y: 0.35 }, size: 1.5 }), mk("丙", { name: "丙" }), mk("丁", { name: "丁", pos: { x: 0.8, y: 0.8 }, size: 0.6 }),
    mk("戊", { name: "戊" }), mk("己", { name: "己", pos: { x: 0.2, y: 0.75 } })];
  for (const seed of ["w1", "w2", "w3", "世界"]) {
    const b = K.mapBuild(seed, regions, 360, 620, 12, 12);
    const shapes = b.regions.map(r => poly(r.blob));
    let bad = 0;
    b.nodes.forEach(n => { const own = b.regions.findIndex(r => r.name === n.region); const inOwn = inPoly(shapes[own], n.x, n.y);
      const inOther = shapes.some((s, j) => j !== own && inPoly(s, n.x, n.y)); if (!inOwn || inOther) bad++; });
    assert.equal(b.nodes.length, 72);
    assert.equal(bad, 0, seed + " 有 " + bad + " 个地点出界");
  }
});
