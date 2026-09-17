// 六个体型参数（她 2026-09-16「做吧宝宝」）。
// ⚠️这一版最要紧的一条：形变规则【只写在 doll_hair.deform 一处】，导出成形态键，
//   网页那头只把「值 - 1」送进 morphTargetInfluences。在 JS 里再实现一遍就是同一层活在两处。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const trav = rd('apps/fairy-garden/traveler.mjs');
const game = rd('apps/fairy-garden/game.mjs');
const host = rd('js/fairy-garden.js');
const exp = rd('art/fairy-garden/export_traveler.py');
const doll = rd('art/fairy-garden/doll_hair.py');
const spec = JSON.parse(rd('apps/fairy-garden/doll.json'));

test('滑杆的上下限就是 Blender 里那份 LIMITS，一个都不许在 JS 里另写', () => {
  const src = doll.match(/LIMITS = dict\(([\s\S]*?)\)\n/)[1];
  const limits = {};
  for (const m of src.matchAll(/(\w+)=\(([\d.]+),\s*([\d.]+)\)/g)) limits[m[1]] = [Number(m[2]), Number(m[3])];
  assert.equal(spec.dims.length, Object.keys(limits).length, '六个参数没配齐');
  for (const d of spec.dims) {
    assert.ok(limits[d.key], '多出来一个 Blender 里没有的参数：' + d.key);
    assert.equal(d.min, limits[d.key][0], d.key + ' 下限对不上');
    assert.equal(d.max, limits[d.key][1], d.key + ' 上限对不上');
    assert.ok(d.min < 1 && d.max > 1, d.key + ' 的中性值 1 不在范围里');
  }
  assert.doesNotMatch(host, /min: 0?\.8[0-9]|max: 1\.2[0-9]/, '界面里又写死了一份范围');
  assert.match(host, /min: d\.min, max: d\.max/);
});

test('形变只在 Blender 那一处，网页只送「值-1」', () => {
  assert.match(exp, /D\.apply_dims\(objs, \{\}\)/, '导出没生成形态键');
  assert.match(exp, /export_morph=True/);
  assert.match(trav, /o\.morphTargetInfluences\[i\]=isFinite\(v\)\?v-1:0/);
  // JS 里不许出现 deform 里那几个魔法数（.30 的抬升、头部枢轴等）
  assert.doesNotMatch(trav, /1\.025|\.067|\.30\*delta/, 'JS 里又抄了一份形变公式');
});

test('空的形态键要摘掉——留着白涨接近两兆', () => {
  assert.match(exp, /o\.shape_key_remove\(key\)/);
  assert.match(exp, /\(a\.co - b\.co\)\.length < 1e-6/);
});

test('只拖一根滑杆，另外五根不许被打回中性', async () => {
  const {mergeLook} = await import('../apps/fairy-garden/wardrobe.mjs');
  const old = {dims:{height:1.2,shoulder:1.1,waist:.9,flare:1.1,build:.95,head:.98}};
  assert.deepEqual(mergeLook(old,{dims:{waist:1}}).dims,{...old.dims,waist:1});
  assert.equal(old.dims.waist,.9);
  const fn = game.slice(game.indexOf(' setLook:(who,look)=>{'), game.indexOf(' applyAction:'));
  assert.match(fn, /mergeLook\(old,look\)/);
  assert.match(trav, /mergeLook\(want,next\|\|\{\}\)/);
});

test('每根滑杆都能单独回到中间', () => {
  assert.match(host, /pushLook\(\{ dims: \{ \[d\.key\]: 1 \} \}\)/);
  assert.match(host, /"回到中间"/);
});
