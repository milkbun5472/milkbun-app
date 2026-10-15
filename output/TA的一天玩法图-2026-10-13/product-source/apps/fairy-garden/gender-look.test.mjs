import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';
import {lookForTa, GENDER_LOOKS} from './wardrobe.mjs';
// 她 2026-09-19：「为啥男的进去是默认女体我是男体」
// 病根：身形（六根形体参数）根本没跟性别挂过钩，全靠发型替身形说话，
// 而两边的发型又是写死的，正好反了。
const DIMS = JSON.parse(fs.readFileSync(new URL('./doll.json', import.meta.url)));

test('他和她拿到的是两身，而且头发和身形一起给', () => {
  const he = lookForTa('他'), she = lookForTa('她');
  assert.notEqual(he.hair, she.hair, '两边发型一样，那又回到发型替身形说话了');
  for (const d of DIMS.dims) {
    assert.notEqual(he.dims[d.key], undefined, '男体少了一根：' + d.key);
    assert.notEqual(she.dims[d.key], undefined, '女体少了一根：' + d.key);
  }
  assert.ok(DIMS.dims.some(d => he.dims[d.key] !== she.dims[d.key]), '两边身形一模一样');
});

test('每一根都在 doll.json 的上下限里', () => {
  for (const ta of Object.keys(GENDER_LOOKS))
    for (const d of DIMS.dims) {
      const v = GENDER_LOOKS[ta].dims[d.key];
      assert.ok(v >= d.min && v <= d.max, ta + ' 的 ' + d.key + ' 超出滑杆范围：' + v);
    }
});

test('性别不明就中性，不许替人猜', () => {
  for (const d of DIMS.dims) assert.equal(lookForTa('TA').dims[d.key], 1);
  assert.deepEqual(lookForTa('说不好'), lookForTa('TA'), '认不出来的要落回中性');
  assert.deepEqual(lookForTa(undefined), lookForTa('TA'));
});
