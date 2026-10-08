const fs = require("fs"), assert = require("assert");
const S = fs.readFileSync(__dirname + "/../js/screens.js", "utf8"), A = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
assert.match(S, /function Carry\(\{ characters, onOpenMine,/);
assert.match(S, /"data-wk": "carrymine", onClick: onOpenMine/);
assert.match(S, /useState\(initialNav \|\| "home"\); \/\/ home \| cart \| my/, "购物得能直接落在「我的」");
assert.match(A, /onOpenMine: \(\) => \{ setShopBack\("carry"\); setScreen\("shop"\); \}/);
assert.match(A, /initialNav: shopBack \? "my" : "home"/);
assert.match(A, /if \(shopBack\) \{ const b = shopBack; setShopBack\(null\); setScreen\(b\); \}/, "返回要回随身物");
console.log("carry mine ok");
