// 英文眉标那道闸（no-english-titles.md）。
//
// Head / LineField / StudyHead 都已经有闸：有中文 zh 时纯拉丁的 en 一律不发。
// 漏网的是【不走这几个组件、自己手写一行小字】的那些——闸管不到它们，只能一处处改。
// 这个文件就是那道补上的闸：以后新加一处会当场红。
// v63.00 只管 screens.js；v63.01 起 Lisa 把别的文件也交过来了，改成全库一起问。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");

// 全库一起问。以前这条只管 screens.js，v63.01 起 Lisa 把别的文件也交过来了。
// 例外分三类，每一类都写着理由——不是"看着顺眼就放过"：
const OK_TECH = /^(GET|POST|PUT|DELETE|JSON|HTTP|HTTPS|UTF|API|URL|CSS|SVG|PNG|JPG|WEBP|IDB|LRU|TTS|SSE|MCP|ECDSA|NFKC|RIFF|SSR|SR|UID|PWA|AI|OK|ID|TA|OOC)$/;
const ALLOW = {
  // ① 这一处压根没有中文名（no-english-titles.md 里写明的那条例外）
  "js/notify.js": ["ARCHIVE"],            // app 自己的名字，manifest 里就叫这个
  // OOC 在中文同人圈里就是这么写的，它【就是】那个中文词，不是没翻译
  "js/components.js": ["OOC",
    // ④ 主屏装饰件上印的字：她 2026-09-03 对这一类另外定过一条——
    //    「任何有英文字母在图上的都要【可以编辑】换成我要的词」，给的解法是可编辑
    //    （dmark 那一层，v61.87 已经做了），不是翻成中文。它们是道具上的印刷字，
    //    不是标题、副标题或栏目名，no-english-titles 管不到。
    "EVIDENCE / ", "ARCHIVED", "PHOTO BOOTH", "WEEKEND", "A SMALL STORY",
    "CABINET OF MOMENTS", "ADMIT ONE"],
  "js/vps-codex.js": ["CODEX · ALWAYS ON"], // 那台机器自己的名字
  // ③ 发给模型的枚举值 / 模型返回的枚举值——不是给人看的字，各自都有中文映射
  "js/app.js": ["HIGH LOAD", "LOW LOAD", "NORMAL", "LIGHT"],
  "js/engine.js": ["CLEAR", "CLOUDY", "DRIZZLE", "KEEP", "OVERCAST", "PARTLY CLOUDY",
    "RAIN", "REWRITE", "SHOWERS", "SNOW", "THUNDERSTORM", "WAVE"],
  // 测量字宽用的那串字母
  "js/weekly.js": ["ABCDEFGHIJKL"]
};
test("全库不许再有大写拉丁眉标", () => {
  const dir = path.join(__dirname, "..", "js");
  const bad = [];
  fs.readdirSync(dir).filter(f => f.endsWith(".js")).forEach(f => {
    // games.js 是 Codex 的地盘、trpg.js 和 yanqiu.js 是言秋的，都不碰
    if (["games.js", "trpg.js", "yanqiu.js"].includes(f)) return;
    // ② pageSkin 的 word 是页脚那个 5% 的大水印，是背景装饰不是标题——先摘掉它再问。
    //    ⚠️别写成「这个词在这个文件里放行」：那样连【显示出来的副标题】也一起放行了
    //    （dwell 的 topBar("去处","PLACES") 就是这么漏过去的）。
    const txt = fs.readFileSync(path.join(dir, f), "utf8").replace(/word: "[^"]*"/g, 'word: ""');
    (txt.match(/"[A-Z][A-Z ·&/]{3,26}"/g) || []).map(x => x.slice(1, -1)).forEach(x => {
      if (OK_TECH.test(x.trim())) return;
      if ((ALLOW["js/" + f] || []).some(a => x.indexOf(a) >= 0)) return;
      bad.push("js/" + f + " → " + x);
    });
  });
  assert.deepEqual([...new Set(bad)], [], "还留着英文眉标：\n" + [...new Set(bad)].join("\n"));
});

test("「英文 · 中文」夹着写的也算——中文那半已经把话说完了", () => {
  // ⚠️只查【整串都是大写】的话，这一类全查不出来：LAST NOTES · 学到哪了、
  //   NEW ENTRY / 写日记、PAY FOR ME · 代付请求、CORRECTION · 更正……
  //   它们混着汉字，上一条那个正则一个都匹配不到。第一版就是这么漏掉七处的。
  const dir = path.join(__dirname, "..", "js");
  const bad = [];
  fs.readdirSync(dir).filter(f => f.endsWith(".js")).forEach(f => {
    if (["games.js", "trpg.js", "yanqiu.js"].includes(f)) return;
    // 提示词里给模型看的枚举、技术名词和说明文字不算——它们不是界面上的眉标
    if (["engine.js", "app.js", "phone.js", "assistant.js", "assistant-manual.js", "codex.js",
      "fanfic.js", "mcp.js", "read.js", "style-presets.js", "theme-studio.js", "theme-studio-ui.js",
      "uno-core.js", "vps-codex.js", "map.js", "notify.js", "rescue-console.js"].includes(f)) return;
    const txt = fs.readFileSync(path.join(dir, f), "utf8");
    (txt.match(/"[^"\n]*"/g) || []).forEach(raw => {
      const x = raw.slice(1, -1);
      if (!/[一-鿿]/.test(x)) return;                       // 没汉字的走上一条
      // 眉标是【短】的。超过 40 字的是正文、说明或提示词，不是栏目名——
      // 不设这条的话这条测试会被一屏提示词淹掉，然后没人再看它
      if (x.length > 40) return;
      const caps = x.match(/\b[A-Z]{3,}(?:[ ][A-Z]{2,})*\b/g) || [];
      caps.forEach(c => {
        // 技术名词 / 产品名 / 中文圈里就这么写的词 / 主屏装饰件上的印刷字
        if (/^(DOCX|TXT|PDF|CSS|SSE|CORS|RPC|TTS|CLI|OCR|JSON|HTTP|API|URL|UTF|SVG|PNG|VAPID|MUSIC|LLM|MAX|IMG|LINE|OOC|ADMIT|EVIDENCE|ARCHIVED|PHOTO|BOOTH|WEEKEND|SMALL|STORY|CABINET|MOMENTS|SSR|VIP|VPS|START|MES|JSON|CODEX|LISA|MCP|NPC|ANTHROPIC|DZZI)$/.test(c)) return;
        bad.push("js/" + f + " → " + x.slice(0, 40));
      });
    });
  });
  assert.deepEqual([...new Set(bad)], [], "还有中英夹着的眉标：\n" + [...new Set(bad)].join("\n"));
});

test("拼出来的大写英文也算——上面那两条正则都查不到它", () => {
  // ⚠️第三个洞：(sec.en || "").toUpperCase() 和 textTransform:"uppercase" 拼出来的
  //   眉标，源码里根本没有一个大写字符串——「整串都是大写」和「中英夹着」两条
  //   都匹配不到。随身物那两处 BAG / POCKET / WARDROBE 就是这么活到 v63.36 的。
  ["screens.js", "components.js", "phone.js", "weekly.js", "study.js", "dwell.js"].forEach(f => {
    const txt = fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
    assert.ok(!/\.en \|\| ""\)\.toUpperCase\(\)/.test(txt), f + " 里还在把 en 拼成大写眉标");
  });
  // 周刊那十种媒体腔的眉标：说的是这一期什么腔调，不是把英文译回来
  const weekly = fs.readFileSync(path.join(__dirname, "..", "js", "weekly.js"), "utf8");
  const brows = (weekly.match(/eyebrow: "[^"]*"/g) || []).map(x => x.slice(10, -1));
  assert.equal(brows.length, 10, "十种媒体腔少了几个");
  brows.forEach(x => assert.match(x, /[一-鿿]/, "这条眉标还是英文：" + x));
  // 换成中文之后，那身「Archivo + 大字距 + 全大写」的皮也得脱掉
  assert.equal((weekly.match(/textTransform: "uppercase"/g) || []).length, 0,
    "周刊里还有中文穿着英文眉标那身皮");
  // 头条那一处是 textTransform: cyber ? "lowercase" : "uppercase"——那是【大标题】
  // 的排版处理（中文上是空操作，只管标题里夹的洋文），不是眉标，留着
  assert.match(weekly, /textTransform: cyber \? "lowercase" : "uppercase"/);
});

test("pageSkin 的 word 放行的只是水印，不是顺带把那个词整篇放行", () => {
  const dwell = fs.readFileSync(path.join(__dirname, "..", "js", "dwell.js"), "utf8");
  // 去处那三页的顶栏副标题原来写着 PLACES——它是显示出来的字，跟水印不是一回事
  assert.ok(!/topBar\("[^"]*", "[A-Z]/.test(dwell), "顶栏副标题又塞了一行英文");
  assert.equal((dwell.match(/word: "PLACES"/g) || []).length, 3, "页脚那个水印不该被顺手删掉");
});

test("Head / LineField / StudyHead 那道闸后面不许再挂死的 en", () => {
  // 三个组件都是「有中文 zh 时纯拉丁的 en 一律不发」，留着只是让人以为还在用
  ["components.js", "screens.js", "study.js", "phone.js", "rescue-console.js"].forEach(f => {
    const txt = fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
    ["NEW COURSE FILE", "NEW RESEARCH SHEET", "OPEN STUDY BINDER", "REMOTE RESCUE"]
      .forEach(w => assert.ok(!txt.includes(w), f + " 里还挂着死的 en：" + w));
  });
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
