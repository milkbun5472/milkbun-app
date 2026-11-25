// 从小世界邮局退出会卡死回到开屏（她 2026-11-24）：先拆邮局的 3D、iframe 换空页，等一下再走
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), path = require("path");
const fg = fs.readFileSync(path.join(__dirname, "..", "js", "fairy-garden.js"), "utf8");
const game = fs.readFileSync(path.join(__dirname, "..", "apps", "post-office", "game.mjs"), "utf8");
test("邮局把 dispose 交出来", () => { assert.match(game, /window\.PostOfficeGame=\{dispose,refresh,/); });
test("返回和去别处都先 leave", () => {
  assert.match(fg, /PostOfficeGame\?\.dispose\?\.\(\);\}catch\{\}\s*try\{if\(node\)node\.src="about:blank";\}catch\{\}\s*setTimeout\(/);
  assert.match(fg, /onBack:\(\)=>leave\(\(\)=>props\.onBack\(\)\)/);
  assert.match(fg, /leave\(\(\)=>props\.onTravel\(to\)\)/);
});
test("进邮局晚半秒再开建 iframe：等陪伴小人那份 3D 放干净（她 2026-11-25 从集邮社进来闪退）", () => {
  assert.match(fg, /const \[frameGo,setFrameGo\]=useState\(false\);\s*useEffect\(\(\)=>\{const t=setTimeout\(\(\)=>setFrameGo\(true\),450\);/);
  assert.match(fg, /frameGo&&h\("iframe",\{ref:binder\.current,/);
});
test("邮局里的人走省力小人（skeletonOnly）：一个完整小人约 150MB，四个店员 630MB 顶爆手机（她 2026-11-25）", () => {
  const v = fs.readFileSync(path.join(__dirname, "..", "apps", "post-office", "view.mjs"), "utf8");
  assert.match(v, /createTraveler\(source,true,u\.look,u\.npcStyle\?\{costume:[^}]*\}:\{skeletonOnly:true\}\)/);
});
test("来访演出：店员走不到客人身边（柜台前挤满人）也在几秒后就地开口（她 2026-11-25）", () => {
  const f = fs.readFileSync(path.join(__dirname, "..", "apps", "post-office", "flow.mjs"), "utf8");
  assert.match(f, /meeting\.phase==='approach'&&\(meeting\.total=\(meeting\.total\|\|0\)\+dt\)>12\)startMeetSpeech\(\)/);
  assert.match(f, /meeting\.wait=\(meeting\.wait\|\|0\)\+dt;if\(a\.arrived\|\|meeting\.wait>6\|\|\(meeting\.wait>1\.5&&!a\.path\.length\)\)startMeetSpeech\(\);/);
});
test("开口了两人还隔得远：客人走到店员身边，到了再面对面（她 2026-11-25）", () => {
  const f = fs.readFileSync(path.join(__dirname, "..", "apps", "post-office", "flow.mjs"), "utf8");
  assert.match(f, /meeting\.phase==='talk'&&!meeting\.close\)\{const d=Math\.hypot/);
  assert.match(f, /go\(b,nearby\(b,a,\.85\)\)/);
});
