// 装修工单第三批（她 2026-09-05：「继续扫吧宝宝」）。
//
// 这一轮先修了扫描脚本本身——上一版有个致命盲区：**主屏铺着壁纸**，
// 所以「没点开」和「已经装修好了」量出来一模一样（都是有 backgroundImage）。
// 于是没点开的那几个会被记成已完成。加了一道「还在主屏就作废这条读数」才敢信。
//
// 扫下来 C 那张单子基本已经过期：匿名问答/钱包/世界书/秋秋/文风台/擂台/梦境/
// 解梦馆/番茄钟/小剧场/月度印象/关系/人格档案馆，全都早有底纹了。
// 真正还秃着的只剩两处整页。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const heart = fs.readFileSync(path.join(__dirname, "..", "js", "heart.js"), "utf8");
const code = comp.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");

const W = (() => {
  const i = comp.indexOf("const WEATHER_SKY = {"), j = comp.indexOf("const HOME_STICKER_MAX");
  assert.ok(i > 0 && j > i, "抠不出天气那一段");
  // 依赖 wmoKind / pageSkin / skinMix / skinRGB —— 这里只验「挑哪一种天色」那一半，
  // 所以把 pageSkin 换成一个照实回话的桩，别把 core.js 整个拖进来。
  const src = "function wmoKind(c){ if(c===0||c===1)return 'sun'; if(c===2)return 'partly'; if(c===3)return 'cloud';"
    + " if(c===45||c===48)return 'fog'; if(c>=95)return 'storm';"
    + " if(c>=71&&c<=86&&c!==80&&c!==81&&c!==82)return 'snow'; if(c>=51)return 'rain'; return 'partly'; }\n"
    + "function pageSkin(kind, t, o){ return { __kind: kind, __base: (o&&o.base)||null, __tint: (o&&o.tint)||null }; }\n"
    + "function skinMix(a,b,k){ return 'mix(' + a + ',' + b + ',' + k + ')'; }\n"
    + "function skinRGB(h){ return [1,2,3]; }\n"
    + comp.slice(i, j) + "\nreturn { WEATHER_SKY, weatherSkin };";
  return new Function(src)();
})();

test("天气页的底跟着今天的天气走，不是一张通用的纸", () => {
  const t = { bg: "#ece8e1" };
  // 判据（tabs-not-plain-pills）：这一页搬到别的 app 里还成立吗？
  // 铺纸/铺玻璃——成立，那就是写坏了。天气页的底本来就该是天。
  const kindOf = c => W.weatherSkin({ code: c }, t).__base;
  assert.notEqual(kindOf(0), kindOf(3), "晴天和阴天一个颜色");
  assert.notEqual(kindOf(61), kindOf(95), "下雨和打雷一个颜色");
  assert.notEqual(kindOf(73), kindOf(45), "下雪和起雾一个颜色");
  // 六档天色一档不少，而且各不相同
  const skies = Object.keys(W.WEATHER_SKY);
  assert.deepEqual(skies.sort(), ["cloud", "fog", "partly", "rain", "snow", "storm", "sun"].sort());
  assert.equal(new Set(Object.values(W.WEATHER_SKY)).size, skies.length, "有两档天色写重了");
  // 纹理一律 glass：天上没有织纹（SKIN_PATS 里 glass 那格的说明就是「只有光斑」）
  assert.equal(W.weatherSkin({ code: 0 }, t).__kind, "glass");
  // ⚠️取不到天气时退回主题色，别硬给一片蓝天
  assert.equal(W.weatherSkin(null, t).__base, null);
  assert.equal(W.weatherSkin({}, t).__base, null, "code 缺了也该退回去");
  // 掺得够不够：.5 的时候晴阴只差四个色阶，手机上看不出来
  assert.match(String(kindOf(0)), /,0\.72\)$/, "掺淡了就看不出「跟着天气变」");
});

test("天气那一整页接上了，而且顶栏透上来", () => {
  const seg = code.slice(code.indexOf("const detail = open && typeof ReactDOM"), code.indexOf("const detail = open && typeof ReactDOM") + 900);
  assert.match(seg, /style: Object\.assign\(\{ position: "fixed", inset: 0, zIndex: 240 \}, weatherSkin\(w, t\)\)/);
  assert.match(seg, /h\(Head, \{ zh: "天气", sub: [^}]*bg: "transparent"/);
  assert.ok(!/zIndex: 240, background: t\.bg \} \},\s*h\(Head, \{ zh: "天气"/.test(code), "还留着平色");
});

test("心上是【他自己的本子】，底带着这个盒子的颜色", () => {
  // 顶栏那句写着「只有 TA 能往里写；你只是碰巧看见了」——
  // 判据：这一页搬到别的 app 里还成立吗？一张匿名米白成立，这一张不成立。
  assert.match(heart, /const ACCENT = "#a8763e";/, "盒子主色变了，底下那一段得跟着改");
  const seg = heart.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert.match(seg, /pageSkin\("paper", t, \{ base: \(typeof skinMix === "function" \? skinMix\(t\.bg, ACCENT, \.06\) : t\.bg\), tint: \(typeof skinRGB === "function" \? skinRGB\(ACCENT\)\.join\(","\) : ""\), strength: 1\.15 \}\)/);
  assert.match(seg, /: \{ background: t\.bg \}\) \}/, "没兜底：pageSkin 没加载就整页透明");
  assert.match(seg, /sub: "只有 TA 能往里写；你只是碰巧看见了", bg: "transparent"/, "顶栏没透上来");
  assert.ok(!/zIndex: 240, background: t\.bg \} \}/.test(seg), "还留着平色");
});
