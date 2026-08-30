const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const dwell = R("dwell.js"), app = R("app.js");

// 把模块跑起来，出图那一步换成桩：只想看它把什么样的提示词递出去
function load(onImagePrompt) {
  const store = {}; const w = {};
  new Function("loadJSON", "saveJSON", "window", "useTheme", "useState", "useEffect", "h", "Head", "Empty", "Sheet",
    "Spinner", "Eyebrow", "IArrow", "IRefresh", "ITrash", "pageSkin", "safeTop", "F_BODY", "F_DISPLAY",
    "generateSelfieImage", "blobToDataUrl", "imgToVault", "imgApiReady", "resolveImg", dwell)(
    (k, d) => store[k] !== undefined ? JSON.parse(JSON.stringify(store[k])) : d,
    (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); }, w,
    () => ({}), () => [null, () => {}], () => {}, () => null, null, null, null, null, null, null, null, null,
    () => ({}), () => "", "", "",
    async p => { onImagePrompt && onImagePrompt(p); return { blob: {} }; },
    async () => "data:image/png;base64,AA", async () => "iv_fake", () => true, x => x);
  return { D: w.Dwell, store };
}

const PLACE = {
  id: "p1", name: "研究生宿舍", en: "Dormitory",
  ambient: "进门是速溶咖啡和薄荷洗发水混在一起的味道，显示器还没息屏。",
  zones: [
    { name: "上铺床位", items: [{ name: "没叠的夏被" }, { name: "两米长的充电线" }, { name: "降噪耳机" }, { name: "第四件" }] },
    { name: "个人工作台", items: [{ name: "两台显示器" }] },
    { name: "收纳金属架", items: [{ name: "零食盒" }] },
    { name: "窗台", items: [{ name: "养死的绿萝" }] },
    { name: "第五块", items: [{ name: "多出来的" }] }
  ]
};

test("出图：画面里不许有人，画什么全从这份地方数据里长出来", async () => {
  let prompt = null;
  const { D } = load(p => { prompt = p; });
  const key = await D.genArt(PLACE, { name: "沈屿白" });
  assert.equal(key, "iv_fake", "图没进图仓库，换设备就丢");
  assert.match(prompt, /没有人/, "没说清画面里不要人——这是他的地方，不是他的写真");
  assert.match(prompt, /不出现文字/, "没禁文字，模型很爱往画里写字");
  assert.ok(prompt.includes(PLACE.name), "没把地方名字给出去");
  assert.ok(prompt.includes(PLACE.ambient), "那一句氛围没进提示词——光线冷暖全靠它定");
  assert.ok(prompt.includes("上铺床位") && prompt.includes("个人工作台"), "区域没给出去，画出来跟这地方没关系");
  assert.ok(prompt.includes("沈屿白"), "没说是谁的地方");
});

test("出图的提示词要有节制：区域封顶 4 块、每块封顶 3 件", async () => {
  let prompt = null;
  const { D } = load(p => { prompt = p; });
  await D.genArt(PLACE, { name: "沈屿白" });
  assert.ok(!prompt.includes("第五块"), "第 5 块也塞进去了，提示词会越堆越长");
  assert.ok(!prompt.includes("第四件"), "一块里第 4 件也塞进去了");
});

// 出图慢又贵，不该为了换几句话把画重刷一遍（跟月度印象「只重写文案」同一条）
test("重新看一遍只换文字，图原样留着", () => {
  const { D } = load();
  const prev = { id: "p1", name: "旧名", img: "iv_old", zones: [] };
  const out = D.normalize({ name: "新名", ambient: "新的一句", zones: [{ name: "区", items: [{ name: "东西" }] }] }, null, prev);
  assert.equal(out.img, "iv_old", "刷一次文字把图冲没了");
  assert.equal(out.id, "p1", "换了 id，等于又多出来一个地方");
  assert.equal(out.name, "新名", "文字没更新");
  // 第一次生成没有旧图，也不能是 undefined（存下去会变成 null/漏字段）
  assert.equal(D.normalize({ name: "n", zones: [{ name: "区", items: [{ name: "x" }] }] }, null, null).img, "");
});

// 她 2026-08-30：「现在生成出来东西太过于关于我了，不完全是他的生活」
test("提示词说明白这是他一个人过日子的地方", () => {
  const { D } = load();
  const ins = D.placeSpec({ name: "沈屿白" }, null, null).instruction;
  assert.match(ins, /他一个人过日子的地方/, "没点明这是他的日子");
  assert.match(ins, /绝大多数东西跟用户没关系/, "没给比例，模型会把每一件都写成跟用户有关");
  assert.match(ins, /至多出现在一两件里/, "没给上限");
  // 判据里不许再拿「跟谁有关」当敞口——那个「谁」模型默认就填用户
  assert.ok(!/在意什么、跟谁有关/.test(ins), "判据还留着那个敞口：「跟谁有关」会被填成用户");
});

test("去处这一路不发她的心愿单、送礼往来和他对她的印象", () => {
  const i = app.indexOf("const genDwellPlace = async");
  const src = app.slice(i, app.indexOf("const genCarryAll", i));
  assert.match(src, /ctx\.wishLog\s*=\s*""/, "心愿单还在发——他屋里会长出一堆她想买的东西");
  assert.match(src, /ctx\.giftLog\s*=\s*""/, "送礼往来还在发");
  assert.match(src, /ctx\.gazeText\s*=\s*""/, "他对她的印象还在发");
  assert.match(src, /runProbe\(api, ctx,/, "清完了却没拿这份收窄过的 ctx 去调");
  // 记忆和印象卡要照给：他的日子本来就长在那里面，一起砍掉会写成一间样板房
  assert.ok(!/ctx\.memLib\s*=\s*/.test(src) && !/ctx\.memory\s*=\s*/.test(src), "把记忆也一起砍了，屋子会变成谁的都行");
});

test("细线小签指的是区域、点得动、最多四根", () => {
  const i = dwell.indexOf("细线指的是【区域】");
  assert.ok(i > 0, "找不到出图那一块了");
  const src = dwell.slice(i, i + 2600);
  assert.match(src, /\(open\.zones \|\| \[\]\)\.slice\(0, 4\)/, "小签没封顶，区域多了会糊成一片");
  assert.match(src, /pointerEvents: "auto"/, "小签点不动——外面那层是 pointerEvents:none");
  assert.match(src, /onClick: function \(\) \{ setZoneIdx\(i\); \}/, "点了小签没翻到那一块");
  assert.match(src, /pointerEvents: "none"/, "覆盖层没设 none，会把整张图挡住");
});

test("没配图像 API 就说清楚，别让她撞一句看不懂的报错", () => {
  const i = dwell.indexOf("async function draw(place) {");
  assert.ok(i > 0, "找不到出图那个动作了");
  const src = dwell.slice(i, dwell.indexOf("\n    }", i));
  assert.match(src, /imgApiReady/, "没检查图像 API 配没配");
  assert.match(src, /if \(drawing\) return/, "连点两下会调两次图像 API——她按次付钱");
  assert.match(src, /savePlace\(char\.id/, "图没落盘，退出去再进来就没了");
});
