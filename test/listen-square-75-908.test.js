const test=require('node:test'),assert=require('node:assert');const fs=require('fs');
const app=fs.readFileSync(__dirname+'/../js/app.js','utf8'),sc=fs.readFileSync(__dirname+'/../js/screens.js','utf8'),lq=fs.readFileSync(__dirname+'/../js/listen-square.js','utf8'),sh=fs.readFileSync(__dirname+'/../js/shua.js','utf8');
const seg=(src,a,b)=>src.slice(src.indexOf(a),src.indexOf(b,src.indexOf(a)));
test('广场与歌评：她点了才打、不进后台、每枪 8000',()=>{
  const g=seg(app,'const genSquare = async','const genCharPlaylist = async');
  assert.match(app,/const sqAsk = async[^\n]*maxTokens: 8000/);
  assert.doesNotMatch(g,/bgJob\(/);
  assert.match(g,/sqResolveSong\(/);
});
test('歌评一首一页、按门牌缓存；陪听的那位一定在',()=>{
  assert.match(lq,/const songKey = song => song \? \(song\.neteaseId \? "ne:"/);
  assert.match(app,/songTalk: \{ \.\.\.st, \[key\]:/);
  assert.match(lq,/这一批里一定有他写的一条/);
  assert.match(app,/partner: partner \? \{ id: partner\.id/);
});
test('熟面孔就是论坛那批人：music 那一栏、同一本碰面账、片刻那段话共用',()=>{
  assert.equal((app.match(/music: \{ name: "/g)||[]).length,10);
  assert.match(app,/FORUM_NPC_REGISTRY\.filter\(n => n\.music\)/);
  assert.match(app,/touchForumPublicTie\(/);
  assert.match(sh,/window\.ShuaKit = \{ regularsBlock,/);
  assert.match(lq,/regularsBlock\(o\.regs, o\.pairs \|\| \[\], o\.me \|\| "她", "听歌、写歌评"\)/);
});
test('活人感给判据不给样例；转给TA落一张卡',()=>{
  assert.match(lq,/判定一：把名字遮住/);
  assert.match(lq,/ANTI_CLICHE/);
  assert.match(app,/kind: "listenshare", listenPost: snap/);
  assert.match(fs.readFileSync(__dirname+'/../js/components.js','utf8'),/kind === "listenshare"\) return window\.ListenShareCard/);
});
test('界面：广场能发帖评论转发，播放页有「评」进歌评页',()=>{
  assert.match(sc,/navBtn\("square", "广场"/);
  assert.match(sc,/nav === "songtalk" \? \(songTalkTab \|\| squareTab\)/);
  assert.match(sc,/onPostSquare && onPostSquare\(v, now\)/);
  assert.match(sc,/"data-wk": "listentalkopen"/);
});
test('一枪刷得多（跟论坛一样）、网易云评论区的样子：网名、赞数、热评',()=>{
  assert.match(app,/n: "12-18"/);assert.match(app,/n: "10-16"/);
  assert.match(lq,/网易云评论区的样子/);assert.match(lq,/likes/);
  assert.match(sc,/"热门评论"/);assert.match(sc,/"精彩评论"/);
  assert.match(sc,/onMoreSquare && onMoreSquare\(p\.id\)/);
  assert.match(lq,/"data-kind": "listenshare"/);
});
test('广场上你的人带的料跟论坛楼里回帖是同一份（forumCharGrounding）',()=>{
  assert.match(app,/brief: forumCharGrounding\(c, \{ title:/);
  assert.equal((app.match(/sqCast\([^\n]*?\{ title:/g)||[]).length,5);
  assert.match(lq,/c\.brief \? S\(c\.brief\)/);
});
