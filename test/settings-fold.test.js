const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const screens = fs.readFileSync(require("node:path").join(__dirname, "../js/screens.js"), "utf8");

test("总设置页用单开手风琴，切换 tab 时恢复全收起", () => {
  assert.match(screens, /function ConfigFold\(/);
  assert.match(screens, /const \[openSection, setOpenSection\] = useState\(""\)/);
  assert.match(screens, /open: openSection === id/);
  assert.match(screens, /setTab\(k\); setOpenSection\(""\)/);
});

test("API、主题与数据入口按用途拆组", () => {
  for (const title of [
    "聊天与后台模型", "额度与缓存", "图像生成", "语音 TTS",
    "外观与壁纸", "聊天气泡皮肤", "上下文诊断"
  ]) assert.match(screens, new RegExp(title));
});

test("数据页把空间、照片、云同步、备份和危险操作分别折叠", () => {
  assert.match(screens, /const \[part, setPart\] = useState\(""\)/);
  for (const title of ["本地空间", "本机照片库", "云同步", "导入与导出", "危险操作"])
    assert.match(screens, new RegExp(title));
});
