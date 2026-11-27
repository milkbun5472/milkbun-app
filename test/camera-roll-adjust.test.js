// 相机：拍过的大退重进还在；滤镜后面能自己调（她 2026-11-26）
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), path = require("path");
const cam = fs.readFileSync(path.join(__dirname, "..", "js", "camera.js"), "utf8"), ts = fs.readFileSync(path.join(__dirname, "..", "js", "theme-studio.js"), "utf8");
test("胶卷清单开相机时照图库 img_camroll_ 键排回来，键尾记拍的/画的", () => {
  assert.match(cam, /k = "img_camroll_" \+ ts\.toString\(36\) \+ "_" \+/);
  assert.match(cam, /await idbAllKeys\(idbImgOpen\)/);
  assert.match(cam, /filter\(k => k\.indexOf\("img_camroll_"\) === 0\)/);
});
test("自己调：五根条拼成 CSS 串，只用逐像素兜底认得的那几种函数", () => {
  const src = cam.slice(cam.indexOf("function adjCss"), cam.indexOf("const STYLES"));
  const adjCss = new Function(src + "; return adjCss;")();
  assert.strictEqual(adjCss({ light: 0, contrast: 0, sat: 0, warm: 0, fade: 0 }), "");
  const all = adjCss({ light: 50, contrast: -40, sat: 100, warm: 60, fade: 30 }) + " " + adjCss({ warm: -60 });
  for (const [, f] of all.matchAll(/([a-z-]+)\(/g)) assert.ok(["brightness", "contrast", "saturate", "sepia", "hue-rotate"].includes(f), f);
  assert.match(cam, /const fcss = \(\(FILTERS\.find/);
  assert.ok(ts.includes('["camadjust"') && cam.includes('"data-wk": "camadjust"'));
});
test("给TA看／一起逛：同一个 cameraLook，看图回 say(+caption)；发进聊天走 shareShotToChat，不当场替TA开口", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  assert.match(app, /const cameraLook = async \(charId, img, kind, inPhoto\) =>/);
  assert.match(app, /const cameraShare = async \(charId, blob, caption\) =>[\s\S]{0,400}return shareShotToChat\(char,/);
  assert.match(app, /onLook: cameraLook, onShare: cameraShare/);
  assert.match(cam, /const finalBlob = async \(\) => look && look\.caption \? await polaroid\(/);
  assert.match(cam, /if \(st\.say\) drawBubble\(ctx,/);
  for (const k of ["camlook", "camlookone", "camlooksay", "camcaption", "camsay"]) { assert.ok(ts.includes('["' + k + '"'), k); assert.ok(cam.includes('"data-wk": "' + k + '"'), k); }
});
test("拍过的点开看大图：复用成片页，左下是删除，删本机图库那张", () => {
  assert.match(cam, /onClick: \(\) => openRoll\(p\)/);
  assert.match(cam, /shot\.fromRoll \? big\("删除", delRoll, "delshot"\)/);
  assert.match(cam, /await idbImgDel\(k\)/);
  assert.match(cam, /requestAppConfirm\("删掉这张？"/);
  assert.ok(ts.includes('["camrollone"'));
});
test("拍过的按角色分：画面里有谁写在键尾，开相机时读回来，上面一排按人筛", () => {
  assert.match(cam, /ps\.map\(encodeURIComponent\)\.join\("~"\)/);
  assert.match(cam, /rest\.slice\(j \+ 1\)\.split\("~"\)/);
  assert.match(cam, /toRoll\(blob, "拍的", stickers\.map\(s => s\.pid\)\)/);
  assert.match(cam, /toRoll\(blob, "画的", genIds\)/);
  assert.ok(ts.includes('["camrollwho"') && cam.includes('"data-wk": "camrollwhoone"'));
});
test("旅行：一站一站寄；样子可以定也可以让TA挑；出发前选她去不去、记不记", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8"), trip = fs.readFileSync(path.join(__dirname, "..", "js", "camera-trip.js"), "utf8"), html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(app, /const tripPlan = async \(ids, place, meGo, n\) =>/);
  assert.match(app, /const tripCard = async \(trip, idx, styles\) =>/);
  assert.match(app, /if \(trip\.remember\) \{/);
  assert.match(app, /onTripPlan: tripPlan, onTripCard: tripCard/);
  assert.match(trip, /const style = stop\.style !== "auto" \? stop\.style : \(r\.style \|\|/);
  assert.match(trip, /const next = trip\.stops\.findIndex\(s => !s\.card\)/);
  assert.match(html, /data-lazy="camera" data-src="js\/camera-trip\.js\?v=/);
  for (const k of ["trippage", "tripcard", "tripone", "tripstop", "tripitem", "trippost", "tripflip", "tripfront", "tripback", "tripbtn"]) { assert.ok(ts.includes('["' + k + '"'), k); assert.ok(trip.includes('"data-wk": "' + k + '"') || trip.includes(': "' + k + '"'), k); }
});
test("旅行的照片每张都有脸：没有 view 那一种", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  const body = app.slice(app.indexOf("const tripCard = async"), app.indexOf("const cameraGenShot = async"));
  assert.ok(!/view|buildScenePrompt/.test(body));
  assert.match(body, /const blob = await castShotBlob\(cast, scene,/);
});
test("旅行：入镜的人按性格拍，多人看得出关系（同行各人设定＋彼此关系给到挑怎么拍那一枪）", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  assert.match(app, /const tripCastLines = \(ids, meGo, uName\) =>/);
  assert.match(app, /\(rels \|\| \{\}\)\[a\.id \+ "->" \+ b\.id\]/);
  assert.match(app, /\+ tripCastLines\(ids, trip\.meGo, uName\)/);
});
test("相机里的删除不用原生 confirm（App 里会被吞掉，按不动）", () => {
  const trip = fs.readFileSync(path.join(__dirname, "..", "js", "camera-trip.js"), "utf8");
  for (const src of [cam, trip]) assert.ok(!/window\.confirm\(/.test(src));
});
test("电影和平行人生：入口、存档、出图接上；界面跟旅行共用 makeUI；删除走 App 确认框", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8"), st = fs.readFileSync(path.join(__dirname, "..", "js", "camera-story.js"), "utf8"), html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  for (const f of ["moviePlan", "moviePoster", "movieScene", "worldsPlan", "worldCard"]) assert.match(app, new RegExp("const " + f + " = async"));
  assert.match(app, /onMoviePlan: moviePlan, onMoviePoster: moviePoster, onMovieScene: movieScene, onWorldsPlan: worldsPlan, onWorldCard: worldCard/);
  assert.match(app, /popts: \{ editorial: "movie"/);
  assert.match(app, /popts: \{ cinematic: true \}/);
  assert.match(app, /\.\.\.\(o\.popts \|\| \{\}\)/);
  assert.match(html, /data-lazy="camera" data-src="js\/camera-story\.js\?v=/);
  assert.match(st, /k\.makeUI\(\{ page: "moviepage"/);
  assert.ok(!/window\.confirm\(/.test(st));
  for (const k of ["moviepage", "moviecard", "movieone", "moviescene", "movieitem", "movieposter", "moviestill", "moviesubs", "moviebtn", "worldpage", "worldcard", "worldone", "worldrow", "worlditem", "worldpost", "worldflip", "worldphoto", "worldletter", "worldbtn"]) { assert.ok(ts.includes('["' + k + '"'), k); assert.ok(st.includes('"data-wk": "' + k + '"') || st.includes('wk: "' + k + '"') || st.includes('"' + k + '"'), k); }
});
test("全身／半身、穿什么（衣柜或配一套新的）、抠好的再裁成半身", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  assert.match(app, /const cameraClosetOf = id =>/);
  assert.match(app, /const cameraGenFit = async \(id, hint\) =>/);
  assert.match(app, /const camDress = \(c, o\) =>[^\n]*outfit: f, photoOutfit: f/);
  assert.match(app, /onClosetOf: cameraClosetOf, onGenFit: cameraGenFit/);
  assert.match(cam, /props\.onGen\(genIds, genScene, genWho, \{ frame: genFrame, fits: fitsFor\(genIds\) \}\)/);
  assert.match(cam, /props\.onGenCutout\(cutFor, cutPose, \{ frame: cutFrame, fits: fitsFor\(\[cutFor\]\) \}\)/);
  assert.match(cam, /ctx\.drawImage\(im, 0, 0, im\.naturalWidth, im\.naturalHeight \* cr,/);
  assert.match(app, /bust: "【景别】胸像近景/);
  assert.match(cam, /\["bust", "到胸"\]/);
  for (const k of ["camoutfit", "camoutfitone", "camcrop"]) assert.ok(ts.includes('["' + k + '"'), k);
});
test("相机里的文字调用都走 runProbe+ctxFor（人设、关系网、防八股那一套公共的）；几个人的都带上每个人的人设和彼此关系", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  for (const f of ["cameraWriteShot", "cameraLook", "cameraGenFit", "tripPlan", "tripCard", "moviePlan", "movieScene", "worldsPlan", "worldCard"]) {
    const i = app.indexOf("const " + f + " = async"), body = app.slice(i, app.indexOf("\n  };", i));
    assert.ok(/runProbe\([^,]+, ctxFor\(/.test(body), f);
  }
  for (const f of ["cameraWriteShot", "tripCard", "moviePlan", "movieScene"]) { const i = app.indexOf("const " + f + " = async"); assert.ok(app.slice(i, app.indexOf("\n  };", i)).includes("tripCastLines("), f); }
  const tcl = app.slice(app.indexOf("const tripCastLines"), app.indexOf("const TRIP_KIND"));
  assert.ok(!/persona[^\n]*\.slice\(/.test(tcl), "同行的人设不截断");
});
