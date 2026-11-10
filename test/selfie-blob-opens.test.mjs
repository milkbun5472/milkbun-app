import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
const app = fs.readFileSync("js/app.js", "utf8");
test("生图回来的数据先验能不能解开", () => {
  assert.match(app, /async function imgBlobOpens\(b\)/);
  assert.match(app, /b\.size && await imgBlobOpens\(b\)\) return b/);
  assert.match(app, /out\.blob && !\(await imgBlobOpens\(out\.blob\)\)/);
  assert.match(app, /站子回来的不是一张打得开的图/);
});
