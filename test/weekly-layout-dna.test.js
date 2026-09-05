const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const weekly = fs.readFileSync(path.resolve(__dirname, "../js/weekly.js"), "utf8");

test("十种媒体腔按内容身份分骨架，不再共用同一流水线", () => {
  assert.match(weekly, /tabloid: "manifesto", cyberpunk: "manifesto"/);
  assert.match(weekly, /tribunal: "dossier", noir: "dossier", markets: "dossier"/);
  assert.match(weekly, /victorian: "classic", republican: "classic"/);
  assert.match(weekly, /naturalist: "notes", editorial: "standard", sportsdesk: "scoreboard"/);
  for (const dna of ["manifesto", "dossier", "classic", "notes", "standard", "scoreboard"]) {
    assert.match(weekly, new RegExp('data-layout-dna": "' + dna + '"'), dna + " 骨架必须有可验身份");
  }
});

test("各骨架具有自己不可互换的排版语言", () => {
  assert.match(weekly, /> loading dispatch_/);
  assert.match(weekly, /物证 /);
  assert.match(weekly, /争点 /);
  // v62.81 那一版的洋名（FIELD NOTES）删了；它自己的排版语言现在靠这两个记号认
  assert.match(weekly, /随记 · /);
  assert.match(weekly, /观察 · /);
  assert.match(weekly, /战报 /);
  assert.match(weekly, /❦/);
});

test("文章数决定稳定阵型，版式变体来自持久 section id 而非随机数", () => {
  assert.match(weekly, /one-plus-one/);
  assert.match(weekly, /pyramid/);
  assert.match(weekly, /eye-plus-columns/);
  assert.match(weekly, /String\(s\.id \|\| s\.voiceId\)/);
  const detail = weekly.slice(weekly.indexOf("function MediaDetail"), weekly.indexOf("function IssueView"));
  assert.doesNotMatch(detail, /Math\.random/);
});
