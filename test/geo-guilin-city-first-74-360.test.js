// 搜「桂林」出来六个村（她 2026-09-30 的截图，群友复测「还是不行」）
//
// 她那张图上列的是：桂林,安徽 / 桂林,臺灣省 or 台灣省,台湾 ×2 / 桂林,福建省,中国 ×3
// —— 没有广西桂林市，三行福建看上去一模一样，还有一行写着「A or B」。
//
// 四个病根（都在这一份测试里钉住）：
//   ① 备用那家（open-meteo）是【按名字精确匹配】的：问「桂林」只有村，问「桂林市」才是广西那个。
//      而梯子原来只会做减法（长地址往短拆），不会做加法。
//   ② feature_code 明说了谁是市谁是村（PPLA2 / PPL），代码整个没用。
//   ③ 标签只写到省，admin2（南平市/龙岩市）被丢了，于是三行长得一样。
//   ④ admin1 会是「臺灣省 or 台灣省」这种别名串，原样端了出来。
//
// ⚠️桩是 test/_fixtures-geo-guilin.json —— 2026-09-30 真去问那家 API 拿回来的原样字段，
//   不是照着要测的代码编的（施工规则/stub-from-the-writer）。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const src = fs.readFileSync('js/engine.js', 'utf8');
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, '_fixtures-geo-guilin.json'), 'utf8'));

const i = src.indexOf('function geoQueryLadder(');
const j = src.indexOf('// 地名 → 候选列表（去重）');
assert.ok(i > 0 && j > i, '抠不出 geoQueryLadder');
const { geoQueryLadder } = new Function(src.slice(i, j) + '\nreturn {geoQueryLadder,geoRankByTyped};')();

// om 那一段的清洗逻辑：从源码里抠出来跑，别在测试里另写一份
const omSeg = src.slice(src.indexOf('  const omAlt = v =>'), src.indexOf('  // 第一家最多等 6 秒'));
assert.ok(omSeg.includes('OM_RANK'), '抠不出 om 的清洗段');
const mapOm = new Function('d', omSeg.replace(/const om = \(\) =>[\s\S]*$/, '') + `
  return ((d && d.results) || []).map(x => {
    const a1 = omAlt(x.admin1), a2 = omAlt(x.admin2);
    const tail = [a2 !== x.name ? a2 : "", a1, x.country].filter(Boolean).join(", ");
    return { name: x.name + (a1 ? "," + a1 : ""), full: x.name + (tail ? ", " + tail : ""),
      lat: Number(x.latitude), lng: Number(x.longitude), rank: OM_RANK[x.feature_code] || 0, src: "om" };
  }).sort((a, b) => b.rank - a.rank);`);

// geoCityProbe：补问「XX市」那一步
const probeSeg = src.slice(src.indexOf('async function geoCityProbe('),
                           src.indexOf('// 选定的那一个候选 → 一整份定位。'));
assert.ok(probeSeg.length > 200, '抠不出 geoCityProbe');
const makeProbe = (searchFn, rankFn) =>
  new Function('geoSearch', 'geoRankByTyped', probeSeg + 'return geoCityProbe;')(searchFn, rankFn || (x => x));

test('① 梯子不许自作主张加「市」——那一版不安全，实测三种都翻车', () => {
  // 「东京市」Nominatim 给的是浙江衢州一个叫东京的村；「上海市」open-meteo 给的是
  // 伊利诺伊州的「上海市」；「杭州市」open-meteo 什么都没有。所以加「市」不能进梯子。
  assert.deepEqual(geoQueryLadder('东京'), ['东京']);
  assert.deepEqual(geoQueryLadder('桂林'), ['桂林']);
});

test('①b 主用那家答上来了就根本不补问（它本来就给对了）', async () => {
  let asked = 0;
  const probe = makeProbe(async () => { asked++; return []; });
  // Nominatim 的结果没有 src/rank
  const nom = [{ full: '桂林市, 广西壮族自治区, 中国', lat: 25.27, lng: 110.29 }];
  const out = await probe('桂林', '桂林', nom, null);
  assert.equal(asked, 0, '主用那家答上来了还去补问＝白花一次请求，还可能查歪');
  assert.deepEqual(out, nom);
});

test('①c 掉到备用那家、全是村：补问一次，市排到最前面，村还留着', async () => {
  const villages = mapOm({ results: FIX['桂林'] });
  const city = mapOm({ results: FIX['桂林市'] });
  let askedTerm = null;
  const probe = makeProbe(async term => { askedTerm = term; return city; });
  const out = await probe('桂林', '桂林', villages, null);
  assert.equal(askedTerm, '桂林市');
  assert.equal(out[0].full, '桂林市, 广西, 中国', '市要排第一');
  assert.ok(out.length > 1, '村不许被删掉——她要找的可能真是那个村');
});

test('①d 补问回来的东西名字不叫「XX市」，一律不要（东京那种翻车法）', async () => {
  const villages = mapOm({ results: FIX['桂林'] });
  // Nominatim 对「东京市」的真返回就是这个形状：一个叫东京的村
  const wrong = [{ full: '东京, 上方镇, 衢江区, 衢州市, 浙江省, 中国', lat: 28.9, lng: 118.9 }];
  const probe = makeProbe(async () => wrong);
  const out = await probe('桂林', '桂林', villages, null);
  assert.ok(!out.some(x => x.full.includes('上方镇')), '名字对不上就不许塞进来');
});

test('② 问「桂林市」拿回来的就是广西那个，只有一条 → 不用挑，直接定位', () => {
  const out = mapOm({ results: FIX['桂林市'] });
  assert.equal(out.length, 1);
  assert.equal(out[0].full, '桂林市, 广西, 中国');
});

test('③ 别名串「臺灣省 or 台灣省」要洗成一个', () => {
  const out = mapOm({ results: FIX['桂林'] });
  assert.ok(out.every(x => !/ or /.test(x.full)), '标签里不许还留着 or');
  assert.ok(out.some(x => x.full.includes('臺灣省')), '洗完要留头一个写法');
});

// geoCandidates 里那一步去重，照源码的写法搬过来，不在测试里另写一份
const dedupe = ok => ok.filter((x, i) => !ok.slice(0, i).some(y =>
  (Math.abs(y.lat - x.lat) < 0.05 && Math.abs(y.lng - x.lng) < 0.05) ||
  String(y.full || y.name) === String(x.full || x.name)));

test('④ 每行带上市/县这一级；仍然重名的由去重收掉，她眼前不许出现两行一样的', () => {
  const out = mapOm({ results: FIX['桂林'] });
  const fj = out.filter(x => x.full.includes('福建省'));
  assert.equal(fj.length, 3, '这份真数据里福建原本有三条');
  assert.ok(fj.every(x => /南平市|龙岩市/.test(x.full)), '市这一级要写出来');
  // ⚠️其中两条都在南平市：加了市这一级仍然一模一样（真数据就是这样，不是我编的）。
  //   她分不出来的两行，列出来只是添乱——交给去重收掉。
  const left = dedupe(out);
  assert.equal(new Set(left.map(x => x.full)).size, left.length,
    '去重之后，她眼前不许还剩两行长得一样的');
  assert.ok(left.length < out.length, '这份真数据本来就有该收掉的');
});

test('⑤ 市排在村前面（feature_code 不许再被丢掉）', () => {
  const out = mapOm({ results: FIX['桂林'] });
  const ranks = out.map(x => x.rank);
  assert.deepEqual(ranks, ranks.slice().sort((a, b) => b - a), '必须按行政级别从大到小排');
  assert.ok(ranks[0] > ranks[ranks.length - 1], '这份真数据里级别本来就不齐');
});

test('⑥ 去重也看标签：看上去一模一样的两行只留一行', () => {
  const body = src.slice(src.indexOf('async function geoCandidates('),
                         src.indexOf('async function geoFromPoint('));
  assert.match(body, /String\(y\.full \|\| y\.name\) === String\(x\.full \|\| x\.name\)/,
    '去重必须也比标签，不能只比坐标');
});
