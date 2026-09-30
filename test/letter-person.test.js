// 群友 2026-10-01：「情书最新一封突然变成第三人称了，写信按道理应该是第一人称」
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js", "app.js"), "utf8");
test("写情书和回情书都说清：我写给你，不是第三人称旁白；只一份", () => {
  assert.match(app, /const LETTER_PERSON = "这是你亲笔写给她的信：用「我」写你自己，用「你」/);
  assert.equal((app.match(/\+ LETTER_PERSON/g) || []).length, 2, "写信和回信两处都要带");
});
