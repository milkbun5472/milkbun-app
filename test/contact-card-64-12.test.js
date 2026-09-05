// 装修工单第四批（她 2026-09-05：「继续吧宝宝」）。
//
// 这一轮把 REG 里摆不到主屏、只能从各自正门进去的那几页挨个查了源码：
//   收藏 KRAFT / 表情包 RELEASE_PAPER / 我的衣柜 wood / 备忘录 notebook /
//   设置 方格纸 —— 全都早有底了，工单上那几行是过期的。
// 真正一点底都没有的是【资料卡】：连 background 都不写，全靠父层透过来。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const scr = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
const memo = fs.readFileSync(path.join(__dirname, "..", "js", "memo.js"), "utf8");
const code = comp.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");

test("资料卡是【他的】卡：底掺进他自己那个色，换个人就是另一张", () => {
  const seg = code.slice(code.indexOf("const [remark, setRemark] = useState(character.remark"), code.indexOf("const [remark, setRemark] = useState(character.remark") + 1400);
  assert.match(seg, /const cardTint = character\.color \|\| t\.accent;/, "没用角色自己的颜色，那就是一张谁都能用的卡");
  assert.match(seg, /pageSkin\("paper", t, \{ base: \(typeof skinMix === "function" \? skinMix\(t\.bg2, cardTint, \.05\) : t\.bg2\)/);
  assert.match(seg, /tint: \(typeof skinRGB === "function" \? skinRGB\(cardTint\)\.join\(","\) : ""\), strength: 1\.05/);
  assert.match(seg, /: \{ background: t\.bg2 \};/, "没兜底：pageSkin 没加载就整页透明");
  assert.match(seg, /className: "h-full flex flex-col",\s*style: cardSkin/, "算出来了却没接到外壳上");
  // 顶栏透上来，底纹才铺得到刘海（mobile-ui-layout §3.5）
  assert.match(seg, /zh: "资料卡",\s*sub: character\.name \|\| "",\s*bg: "transparent",/);
  // 原来那一行连 background 都没有——全靠父层透过来
  assert.ok(!/className: "h-full flex flex-col"\n  \}, \/\*#__PURE__\*\/React\.createElement\(Head, \{\n    zh: "资料卡"/.test(comp),
    "还留着那个一点底都没有的老写法");
});

test("资料卡那行死掉的英文眉标删了（no-english-titles）", () => {
  // Head 对纯拉丁的 en 本来就不发，所以 "Contact" 是一行死字，留着只会被下一个人抄走
  assert.ok(!/en: "Contact"/.test(comp));
});

test("这几页【早就有底了】——钉住，别哪天被谁改平", () => {
  // 工单上它们还挂着，其实是过期的。钉一条，省得下一轮又去查一遍。
  assert.match(scr, /function Favorites\(\{ favorites[\s\S]{0,3000}?return h\("div", \{ className: "h-full flex flex-col", style: KRAFT\(t\) \}/, "收藏的牛皮纸没了");
  assert.match(scr, /function EmoteMatrix\([\s\S]{0,9000}?return h\("div", \{ className: "h-full flex flex-col", style: RELEASE_PAPER\(t\) \}/, "表情包的离型纸没了");
  assert.match(scr, /function MyCloset\([\s\S]{0,600}?return h\("div", \{ className: "h-full flex flex-col", style: pageSkin\("wood", t, \{ corner: false \}\) \}/, "我的衣柜的木纹没了");
  assert.match(memo, /return h\("div", \{ className: "h-full flex flex-col", style: notebook \}/, "备忘录的本子皮没了");
  // 设置：方格纸，而且【拼透明度前先验六位色号】（深色主题里 t.ink 可能不是六位，
  // 拼出废值整层底会静默消失——mobile-ui-layout §3.5 那条 ⚠️）
  assert.match(scr, /const sheet = !_hex6 \? \{ background: t\.bg \} : \{ background: t\.bg, backgroundImage: \[/, "设置页的方格纸没了，或者那道色号校验没了");
});
