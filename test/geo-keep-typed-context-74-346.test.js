// 退到小地名去问时，她已经写明的那几级不许扔（群友九里香 2026-09-30）
//
// 她转来的原话：「老大我刚刚试了一下搜出来的城市和省份不对应………」
//
// 这是「给我定位到江苏去了」那件事的**真病根**，v74.343 只治了一半：
//   输「福建省福州市鼓楼区」→ 整串两家都查不到 → 梯子退到「鼓楼区」再问，
//   而「鼓楼区」全国有四个，Nominatim 返回顺序里南京排第一。
//   v74.343 把「闷头拿第一个」改成了「列出来让她挑」，但列表第一个还是南京——
//   她明明已经打了「福州」「福建」，那两个词被整个丢掉了。
//
// ⚠️下面那四条候选是 2026-09-30 真去问 Nominatim 拿回来的原样 display_name，
//   不是我编的（施工规则/stub-from-the-writer：桩照真正产出它的那一头写）。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const src = fs.readFileSync('js/engine.js', 'utf8');
// 锚只钉函数名（施工规则/anchor-on-code）
const i = src.indexOf('function geoQueryLadder(');
const j = src.indexOf('// 地名 → 候选列表（去重）');
assert.ok(i > 0 && j > i, '抠不出 geoQueryLadder / geoRankByTyped');
const { geoQueryLadder, geoRankByTyped } =
  new Function(src.slice(i, j) + '\nreturn {geoQueryLadder,geoRankByTyped};')();

// 真·Nominatim 对「鼓楼区」的返回（2026-09-30，accept-language=zh）
const REAL = [
  { full: '鼓楼区, 南京市, 江苏省, 中国' },
  { full: '鼓楼区, 福州市, 福建省, 中国' },
  { full: '鼓楼区, 顺河回族区, 开封市, 河南省, 中国' },
  { full: '鼓楼区, 徐州市, 江苏省, 221000, 中国' },
];
const rank = typed => geoRankByTyped(REAL, typed, '鼓楼区').map(x => x.full);

test('① 她把省市都写全了：只留她那一个，别再拿南京冒充', () => {
  assert.deepEqual(rank('福建省福州市鼓楼区'), ['鼓楼区, 福州市, 福建省, 中国']);
  assert.deepEqual(rank('河南省开封市鼓楼区'), ['鼓楼区, 顺河回族区, 开封市, 河南省, 中国']);
});

test('② 同省不同市也要分得开：江苏有南京和徐州两个鼓楼区', () => {
  assert.deepEqual(rank('江苏省徐州市鼓楼区'), ['鼓楼区, 徐州市, 江苏省, 221000, 中国']);
  assert.deepEqual(rank('江苏省南京市鼓楼区'), ['鼓楼区, 南京市, 江苏省, 中国']);
});

test('③ 她只写了区名：没有上下文就不许替她做主，四个全列出来', () => {
  assert.equal(rank('鼓楼区').length, 4);
});

test('④ 对不上一个的时候给出口、不给判决：仍然全列，不留空列表', () => {
  // 山东济南没有鼓楼区——她可能记错了省，但那几个地方是真的
  assert.equal(rank('山东省济南市鼓楼区').length, 4);
});

test('⑤ 梯子本身：从最小一级往大了问，且带不带后缀都试', () => {
  assert.deepEqual(geoQueryLadder('福建省福州市鼓楼区'),
    ['福建省福州市鼓楼区', '鼓楼区', '鼓楼', '福州', '福建省', '福建']);
});

test('⑥ 接线：geoCandidates 真的用了它，而不是白写一个函数放着', () => {
  // v74.360 起这一步挪进了 geoCityProbe（补问「XX市」那一支也要先排序）
  const body = src.slice(src.indexOf('async function geoCandidates('),
                         src.indexOf('// 选定的那一个候选 → 一整份定位。'));
  assert.match(body, /geoCityProbe\(q, term, uniq, near\)/,
    'geoCandidates 必须把候选交给 geoCityProbe');
  assert.match(body, /geoRankByTyped\(uniq, q, term\)/,
    '⚠️第二个参数必须是【她输的整串 q】，不是这一级的 term——传成 term 就等于每一级' +
    '只拿自己跟自己比，「按她写明的省市收敛」整个失效');
});
