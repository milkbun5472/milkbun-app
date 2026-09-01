const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("index.html", "utf8");
const bump = fs.readFileSync("scripts/bump-version.mjs", "utf8");

test("主屏布局引擎带发布指纹，iOS 不会永久复用坏缓存", () => {
  assert.match(
    html,
    /<script src="vendor\/tailwind\.js\?v=\d{2,3}\.\d{2,3}"><\/script>/,
    "Tailwind 必须有版本指纹；它缺失时主屏四列网格会塌成左侧单列"
  );
  assert.match(
    bump,
    /const CORE = \[[^\]]*"tailwind"[^\]]*\]/,
    "发版脚本必须同步推进 Tailwind 指纹"
  );
});
