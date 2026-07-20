const fs = require("fs");
const assert = require("assert");
const app = fs.readFileSync(require.resolve("../js/app.js"), "utf8");
const engine = fs.readFileSync(require.resolve("../js/engine.js"), "utf8");
const cloud = fs.readFileSync(require.resolve("../js/cloud.js"), "utf8");

assert.match(app, /\["avatarImage", "refPhoto"\]/, "角色和用户参考照都应迁出 localStorage");
assert.match(engine, /idbVaultGet\(rp\)/, "自拍 API 应能从 vault 读取参考照 Blob");
assert.match(engine, /refBlobs\.length === 1/, "图片编辑接口应使用解析后的 Blob");
assert.match(cloud, /embedRefs\("x_characters"\)/);
assert.match(cloud, /embedRefs\("x_profile"\)/);
assert.match(cloud, /blobToDataUrl\(blob\)/, "云存档应临时嵌回参考照内容");

console.log("reference photo vault contract tests passed");
