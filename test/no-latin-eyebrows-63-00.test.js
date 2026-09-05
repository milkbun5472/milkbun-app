// 审美审计还债收尾（二）：screens.js 里最后那批英文眉标（no-english-titles.md）。
//
// Head 和 LineField 都已经有闸：有中文 zh 时纯拉丁的 en 一律不发。
// 漏网的是【不走这两个组件、自己手写一行小字】的那些——闸管不到它们，
// 只能一处处改。这条测试就是那道补上的闸：以后新加一处也会当场红。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");

test("screens.js 里不许再有大写拉丁眉标", () => {
  // 大写拉丁串 = 眉标那一款的样子。技术缩写不算（它们没有中文名，是规矩里写明的例外）
  const OK = /^(GET|POST|PUT|DELETE|JSON|HTTP|HTTPS|UTF|API|URL|CSS|SVG|PNG|JPG|WEBP|IDB|LRU|TTS|SSE|MCP|ECDSA|NFKC|SSR|SR|UID|PWA|AI|OK|ID|TA)$/;
  const hits = (src.match(/"[A-Z][A-Z ·&/]{3,26}"/g) || [])
    .map(x => x.slice(1, -1)).filter(x => !OK.test(x.trim()))
    // pageSkin 的 word 是页脚那个 5% 的水印，不是标题，规矩管不到它
    .filter(x => x !== "CARRY");
  assert.deepEqual(hits, [], "还留着英文眉标：" + hits.join(" / "));
});

test("换掉的那些说的是这一栏在干嘛，不是把英文译回来", () => {
  // ❌「FILE COLOUR → 文件颜色」这种译法跟英文一样是装饰
  [["卷宗封面", "PERSONA DOSSIER"], ["这份卷宗什么颜色", "FILE COLOUR"],
   ["这条会怎么送出去", "INJECTION SUMMARY"], ["街坊的告示板", "NEIGHBORHOOD BOARD"],
   ["查一遍、清一遍", "TOOLS & DIAGNOSTICS"], ["他心里那半句", "HIS SIDE"]]
    .forEach(([zh, en]) => {
      assert.ok(src.includes('"' + zh + '"'), "少了这条中文眉标：" + zh);
      assert.ok(!src.includes(en), "旧那条还在：" + en);
    });
  // 档案馆那四张索引页签：眉标说的是这一卷要填什么
  [["01", "他是谁、从哪儿来"], ["02", "哪一年、在什么地方"],
   ["03", "长什么样、出图照着谁"], ["04", "说话什么声气"]].forEach(([no, zh]) =>
    assert.match(src, new RegExp('no: "' + no + '", title: "[^"]+", en: "' + zh + '"'), no + " 那一卷的眉标不对"));
});

test("上面一行就是中文标题的，英文直接删掉，不是改文案", () => {
  // 「撤掉东西要删除，不是在它后面说 xxx 是错的」
  assert.ok(!src.includes('"IMPORT"'), "导卡那行 IMPORT 还在");
  assert.match(src, /fontSize: 17, color: t\.ink \} \}, "导入角色卡"\)\),/, "IMPORT 该整行删掉");
  assert.ok(!src.includes('"NEW LORE"') && !src.includes('"EDIT LORE"'));
  assert.match(src, /h\("span", \{ style: \{ fontFamily: F_DISPLAY, fontSize: 22, color: t\.ink \} \}, isNew \? "新建设定" : "编辑设定"\)\),/);
  // 随身物两处顶栏的 CARRY：标题就写着「随身物」
  assert.equal((src.match(/letterSpacing: "0\.18em", color: t\.fog, marginTop: 2 \} \}, "CARRY"\)/g) || []).length, 0);
});

test("按钮和字段名也一起换了", () => {
  assert.ok(!src.includes('} }, "SAVE")'), "存档钮还写着 SAVE");
  assert.match(src, /padding: "10px 0 10px 10px" \} \}, "存档"\)/);
  assert.ok(!src.includes('"BACK")'), "写日记那页的返回还写着 BACK");
  assert.ok(!src.includes('"NEW ENTRY / 写日记"'), "中英夹着那行还在");
  ["时间", "地点", "天气"].forEach(z => assert.ok(src.includes('metaRow("' + z + '"'), "写日记那三栏没换：" + z));
  ["DATE & TIME", "LOCATION", "ENVIRONMENT"].forEach(e => assert.ok(!src.includes('metaRow("' + e + '"')));
});

test("换过的这些不再用 Archivo 那套大字距英文排法", () => {
  // Archivo 是给【数字和日期】用的字体；中文写在里头会挤成一团
  const bad = (src.match(/'Archivo',sans-serif[^\n]{0,180}\}, "[^"]*[一-鿿][^"]*"/g) || []);
  assert.deepEqual(bad.map(x => x.slice(-14)), [], "有中文还挂着 Archivo：" + bad.join(" | "));
});
