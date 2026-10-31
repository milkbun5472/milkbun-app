const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const ts = fs.readFileSync(__dirname + "/../js/theme-studio.js", "utf8");
test("chat ＋ panels (single and group) offer 文件; text files only; gbk fallback; cap", () => {
  assert.equal((comp.match(/\["file", "文件", "file"\]/g) || []).length, 2);
  assert.match(comp, /function pickTextFile\(onMsg, opts\)/);
  assert.match(comp, /inp\.accept = (ANY_FILE|"\*\/\*|\.txt,\.md)/);
  assert.match(comp, /new TextDecoder\("gb18030"\)/);
  assert.match(comp, /const FILE_MAX = 12000;/);
  assert.equal((comp.match(/if \(m\.kind === "file"\) \{/g) || []).length, 2, "单聊群聊都要画文件卡");
});
test("model reads the file as a file, not as her words", () => {
  assert.match(app, /m\.kind === "file" \? "【" \+ uName \+ "发来一个文件「"/);
  ["filecard", "filename", "filebody"].forEach(k => assert.ok(ts.includes('["' + k + '", '), k));
});
test("PDF and docx via vendored, lazily loaded libraries", () => {
  assert.ok(fs.existsSync(__dirname + "/../vendor/pdf.min.js") && fs.existsSync(__dirname + "/../vendor/pdf.worker.min.js") && fs.existsSync(__dirname + "/../vendor/mammoth.browser.min.js"));
  // 2026-10-06：聊天发文件的 PDF 读法合进 core.js 那一份 extractPdfText（懒加载在 loadPdfjs 里）
  const core = fs.readFileSync(__dirname + "/../js/core.js", "utf8");
  assert.match(comp, /function pdfToText\(buf\) \{ return extractPdfText\(/);
  assert.match(core, /function loadPdfjs\(/);
  assert.match(core, /tryLoad\("vendor\/pdf\.min\.js", "vendor\/pdf\.worker\.min\.js"\)/, "先用自带那份");
  assert.match(comp, /lazyScript\("vendor\/mammoth\.browser\.min\.js"\)/);
  const idx = fs.readFileSync(__dirname + "/../index.html", "utf8");
  assert.ok(!/pdf\.min\.js|mammoth/.test(idx), "解析库不该进开机那一串");
});

// 群里 2026-10-17：14 万字的气泡包发给秋秋，只给了前 6 万——大半是嵌着的图（头像框、贴纸的 base64）
test("文件里嵌着的图换成一句占位，字数不再被图吃掉；秋秋那头知道有几张图", () => {
  const fs = require("node:fs"), path = require("node:path");
  const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
  const asst = fs.readFileSync(path.join(__dirname, "..", "js", "assistant.js"), "utf8");
  const i = comp.indexOf("function pickTextFile("), seg = comp.slice(i, comp.indexOf("\n}\n", i));
  const m = /txt = txt\.replace\((\/data:image[^\n]*?\/gi), /.exec(seg);
  assert.ok(m, "没在截断之前把图换掉");
  assert.ok(seg.indexOf(m[0]) < seg.indexOf("const cut = txt.length > MAX"), "要在算截断之前换");
  const re = eval(m[1]);
  const big = '{"assets":{"iv_a":"data:image/png;base64,' + "A".repeat(80000) + '"},"css":"a{}"}';
  const out = big.replace(re, "图");
  assert.ok(out.length < 100 && out.includes('"css":"a{}"'));
  assert.equal('url(data:image/svg+xml;base64,PHN2Zy8+)'.replace(re, "图"), 'url(data:image/svg+xml;base64,PHN2Zy8+)', "小的不动");
  assert.match(asst, /pic\.imgs \? "（里面嵌着 " \+ pic\.imgs \+ " 张图/);
});

// 群里 2026-10-18：「线下生的图找不到」「线上照片也没有」——照片库只收她自己发的，而且收着时永远写 0
test("数据页：TA 们拍的照片按人认键前缀；本机照片库一进来就数；以前发的真照片能找回来", () => {
  const fs = require("node:fs"), path = require("node:path");
  const scr = (fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8") + "\n" + fs.readFileSync(path.join(__dirname, "..", "js", "screens-ui.js"), "utf8"));
  const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  assert.match(scr, /k\.indexOf\("img_" \+ c\.id \+ "_"\) === 0 \|\| k\.indexOf\("img_pdiary_" \+ c\.id \+ "_"\) === 0/);
  assert.match(scr, /h\(CharPhotoAlbum, \{ characters: characters \|\| \[\], toast: toast \}\)/);
  assert.match(scr, /useEffect\(\(\) => \{ refresh\(\); \}, \[open\]\);/, "收着的时候也要数");
  assert.match(app, /window\.__collectMyOldPhotos = async/);
  assert.match(app, /m\.role === "user" && m\.kind === "photo" && m\.photoMode !== "describe"/, "只补她自己发的真照片");
  // 键前缀：c1 不能把 c10 的图算进来
  const keys = ["img_c1_a", "img_c10_b", "img_pdiary_c1_x", "img_c1_a_raw"].filter(x => !/_raw$/.test(x));
  const c = { id: "c1" };
  assert.deepEqual(keys.filter(k => k.indexOf("img_" + c.id + "_") === 0 || k.indexOf("img_pdiary_" + c.id + "_") === 0), ["img_c1_a", "img_pdiary_c1_x"]);
});
test("选到视频：单聊、群聊都截画面拼成一张当照片发", () => {
  const c = require("node:fs").readFileSync(require.resolve("../js/components.js"), "utf8");
  assert.match(c, /function videoContactSheet\(file\)/);
  assert.match(c, /opts\.onVideo\(f\); return;/);
  assert.equal((c.match(/onVideo: f => sendVideoAsPhoto\(f, sendRich, "(private|group)-chat"\)/g) || []).length, 2);
});
