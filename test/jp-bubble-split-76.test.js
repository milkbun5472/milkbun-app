const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const engine = fs.readFileSync("js/engine.js", "utf8");
const i = engine.indexOf("function splitLongBubble(");
const splitLongBubble = new Function(engine.slice(engine.indexOf("const BUBBLE_NUMSEP"), i) + engine.slice(i, engine.indexOf("\n}", i) + 2) + "\nreturn splitLongBubble;")();
test("日文只靠空格断句的一整段要拆开", () => {
  const out = splitLongBubble("今日ね信濃町のキャンパスの近くにすごくいい匂いのする花屋さんができててね 通り過ぎるだけでなんだかすごく癒やされるの ふと遥のこと思い出して", true);
  assert.ok(out.length >= 2, JSON.stringify(out));
  assert.ok(out.every(x => !/^\s|\s$/.test(x)));
});
test("日文的「、」当逗号", () => {
  const out = splitLongBubble("遅くなってごめんね、午後の小テストと見回りが立て込んでてさ、頼まれてたリンゴジュースちゃんと買っておいたよ", true);
  assert.ok(out.length >= 2, JSON.stringify(out));
});
test("中文列举的顿号不下刀，韩文词间空格不下刀", () => {
  assert.deepEqual(splitLongBubble("我今天去超市买了苹果、香蕉、橘子、葡萄还有一大袋零食回来", true), ["我今天去超市买了苹果、香蕉、橘子、葡萄还有一大袋零食回来"]);
  const ko = "오늘 학교 근처에 정말 좋은 향기가 나는 꽃집이 생겼는데 지나가기만 해도 기분이 좋아져";
  assert.deepEqual(splitLongBubble(ko, true), [ko]);
});
