// 表情包清单是 PDF（小红书导出）：读文件走 readTextFileSmart → extractPdfText，不再当字解码塞一坨乱码卡死
const fs = require("fs"), path = require("path"), assert = require("assert");
const core = fs.readFileSync(path.join(__dirname, "../js/core.js"), "utf8");
const body = core.slice(core.indexOf("async function readTextFileSmart"), core.indexOf("async function readTextFileSmart") + 900);
assert(/\.pdf\$/.test(body) && body.includes("extractPdfText(file)"), "readTextFileSmart 认 PDF");
const ui = fs.readFileSync(path.join(__dirname, "../js/screens-ui.js"), "utf8");
const rf = ui.slice(ui.indexOf("const readFile = async e"), ui.indexOf("const readFile = async e") + 700);
assert(rf.includes("importEmotesOk(text)"), "读出来没链接就不往框里塞");
// 「1.不开心」一行、链接下一行：关键词去掉序号
const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
const i = app.indexOf("const parseEmoteImport"), j = app.indexOf("return out;", i);
const parse = new Function((app.slice(i, j + 11) + "};").replace("const parseEmoteImport =", "return"))();
const out = parse("这狗『第二弹』\n\n1.不开心\n\nhttps://pic1.imgdb.cn/i/a.jpg\n\n12、OK\nhttps://pic1.imgdb.cn/i/b.jpg\n小红书号：1");
assert.deepStrictEqual(out.map(x => x.keyword), ["不开心", "OK"]);
console.log("ok emote-import-pdf");
