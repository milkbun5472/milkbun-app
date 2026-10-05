// 她 2026-10-05 转群里：「有时候发的表情包会图裂，等一会儿表情包库加载出来又好了」
const test = require("node:test");
const assert = require("node:assert/strict");
const comp = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");
test("表情图裂不再是一锤子：iv_ 现取、外链重试两次、地址变了重来", () => {
  const seg = comp.slice(comp.indexOf("function EmoteBubble("), comp.indexOf("// 长按一句话能做的事"));
  assert.match(seg, /imgVaultFetchBlob\(raw\)/, "本机图库那张没进缓存就一直裂");
  assert.match(seg, /if \(tries < 2 && \/\^https\?:\/i\.test\(url \|\| ""\)\)/, "外链没有重试");
  assert.match(seg, /useEffect\(\(\) => \{ setBroken\(false\); setTries\(0\); \}, \[raw\]\);/);
  assert.doesNotMatch(seg, /onError: \(\) => setBroken\(true\)/);
});
