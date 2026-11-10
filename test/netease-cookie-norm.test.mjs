import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
test("拉歌单这些请求跟验证登录用同一份补好前缀的 Cookie", () => {
  assert.match(app, /const musicRequest = \(path, options\) => MusicSource\.request\(\{ provider: musicProvider, base: neteaseApi, cookie: normCookie\(\) \|\| neteaseCookie \}/);
});
