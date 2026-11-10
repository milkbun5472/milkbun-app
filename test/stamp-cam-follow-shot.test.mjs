import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
test("邮票卡面：分镜写了镜头就照分镜，不再掷随机镜头", () => {
  assert.match(app, /const stampCam = \(shotHasCam\) => \{\s*if \(shotHasCam\) return "【这一张卡面的镜头】照分镜里写的机位和景别拍/);
  assert.match(app, /shotLine: stampCam\(!alt && \/camera\\s\*\[:：\]\|机位\|镜头\|景别\/i\.test\(String\(tx\.shot \|\| ""\)\)\)/);
});
