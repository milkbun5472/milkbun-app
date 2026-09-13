const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const app = fs.readFileSync('js/app.js', 'utf8');
const screens = fs.readFileSync('js/screens.js', 'utf8');
const ordering = screens.slice(screens.indexOf('const forumFloorArrivedAt'), screens.indexOf('function fmtNum'));
const writer = app.slice(app.indexOf('  const buildForumFloor ='), app.indexOf('  // 这帖里已经冒泡过的角色'));
const manual = app.slice(app.indexOf('  const genMoreComments ='), app.indexOf('  // 角色发帖（可被未来'));
function fixture() {
  let state, finish, fail, calls = 0, saved;
  const ref = {current: {}}, lock = {current: {}}, errors = [];
  const deps = {
    active: {}, characters: [], isForumCharAuthor: () => false,
    forumPublicNpcOf: x => ({id: x.authorName, name: x.authorName, handle: x.authorName}),
    forumHash: () => 30, forumCommentsRef: ref, forumCInflightRef: lock,
    setForumComments: fn => { state = fn(state); ref.current = state; },
    saveForumComments: n => { saved = JSON.parse(JSON.stringify(n)); },
    setGen: () => {}, toast: x => errors.push(x), forumRepliedCharCells: () => [],
    forumWorldCtx: () => ({}), forumCommentProbe: () => ({}), bumpReplyBy: () => {},
    buildForumReplyObj: x => ({content: x.content, ts: Date.now()}),
    runProbeRetry: () => { calls++; return new Promise((resolve, reject) => {finish=resolve; fail=reject;}); }
  };
  const code = new Function(...Object.keys(deps), ordering + writer + manual + '\nreturn {buildForumFloor,genMoreComments};')(...Object.values(deps));
  const post = {id:'post', authorType:'npc', authorName:'帖主', board:'日常吧'};
  // 真正的楼层写入器造存档，再沿用首批的 visibleAt/ts 排队形状。
  const base = Date.now()-1000;
  const old = [0,1,2].map(i => ({...code.buildForumFloor({authorName:'网友'+i,content:'旧评论'+i,replies:[]},i+2,base,i,post), visibleAt:base+600000*i, ts:base+600000*i}));
  state = {post:old}; ref.current=state;
  return {post, old, errors, lock, run:()=>code.genMoreComments(post),
    get state(){return state;}, get saved(){return saved;}, get calls(){return calls;},
    replace: n => {state=n; ref.current=n;}, finish: x => finish(x), fail:()=>fail(new Error('离线'))};
}
test('先放旧楼，模型返回后新楼接后面；等待中用户追评不回滚', async () => {
  const f=fixture(), p=f.run();
  assert.equal(f.state.post.length,3);
  assert.ok(f.state.post.every(x=>!x.visibleAt || x.visibleAt<=Date.now()));
  const mine={content:'等待中追评',authorType:'me',ts:Date.now()};
  f.replace({post:f.state.post.map((x,i)=>i===0?{...x,replies:[mine]}:x)});
  await f.run(); assert.equal(f.calls,1,'重复点击不重发');
  f.finish({comments:[{authorName:'新网友',content:'新评论'}]}); await p;
  assert.deepEqual(f.state.post.map(x=>x.content),['旧评论0','旧评论1','旧评论2','新评论']);
  assert.deepEqual(f.state.post[0].replies,[mine]);
  assert.deepEqual(f.saved,f.state);
  assert.equal(f.lock.current.post,false);
});
test('等待期间缓存丢项，返回仍保留已经放出的旧楼，并保留同期其他帖子', async () => {
  const f=fixture(), p=f.run();
  f.replace({other:[]});
  f.finish({comments:[{authorName:'新网友',content:'新评论'}]}); await p;
  assert.deepEqual(f.state.post.map(x=>x.id).slice(0,3),f.old.map(x=>x.id));
  assert.equal(f.state.post.length,4);
  assert.deepEqual(f.state.other,[]);
});
test('生成失败不收回已放出的旧楼且解除锁',async()=>{
  const f=fixture(), p=f.run(); f.fail(); await p;
  assert.equal(f.state.post.length,3);
  assert.ok(f.state.post.every(x=>!x.visibleAt || x.visibleAt<=Date.now()));
  assert.equal(f.lock.current.post,false);
  assert.deepEqual(f.errors,['离线']);
});
test('后台淘汰不碰正在生成评论的帖',()=>{
  const expr=app.match(/const evictable = x => ([^;]+);/)[1];
  const canEvict=new Function('spare','forumCInflightRef','return x => '+expr)(new Set(),{current:{busy:true}});
  assert.equal(canEvict({id:'busy',authorType:'npc'}),false);
  assert.equal(canEvict({id:'idle',authorType:'npc'}),true);
});
