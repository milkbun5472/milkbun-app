// 群友 2026-11-08 截到的那一幕：好好玩了半小时，一退出聊天，头像/壁纸/图标【整屏的图同时裂掉】，
// 手机根本没满。病根是各处的 idbXxxOpen 每读一张图就 indexedDB.open 一条新连接、从不关，
// 几百条连接之后 open 开始失败；外加「连接死在手里」（切后台被系统掐断，onclose 不一定发得出来）。
// 这两条道理对每个库都成立，所以抽成 core.js 里的 idbKeep / idbDrop / idbWith，
// 图库、自拍、朗读、向量、通话记录、文本库、保险箱全搬过去（施工规则/one-public-mechanism.md）。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const core = fs.readFileSync(__dirname + "/../js/core.js", "utf8");
const engine = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");

function layer() {
  const src = core.slice(core.indexOf("const _idbPool = {}"), core.indexOf("function makeTextStore"));
  return new Function("indexedDB", src + "; return { idbKeep: idbKeep, idbDrop: idbDrop, idbWith: idbWith };");
}
// 假 indexedDB：记下开了几次，open 永远成功
function fakeIdb(onOpen) {
  const state = { opens: 0 };
  state.idb = {
    open() {
      state.opens++;
      const rq = { result: { objectStoreNames: { contains: () => true }, close() { this.closed = true; } } };
      setTimeout(() => { if (onOpen) onOpen(rq.result, state.opens); rq.onsuccess && rq.onsuccess(); }, 0);
      return rq;
    }
  };
  return state;
}

test("一个库只开一条连接，第二次拿的是同一条", async () => {
  const f = fakeIdb();
  const L = layer()(f.idb);
  const a = await L.idbKeep("x_imgvault", 2, () => {});
  const b = await L.idbKeep("x_imgvault", 2, () => {});
  assert.strictEqual(a, b, "第二次又开了一条新连接");
  assert.strictEqual(f.opens, 1, "开了不止一次：" + f.opens);
});

test("连接死在手里：第一笔报错就丢掉重开，再跑一次", async () => {
  const f = fakeIdb();
  const L = layer()(f.idb);
  let tries = 0;
  const out = await L.idbWith("x_imgvault", 2, () => {}, () => {
    tries++;
    if (tries === 1) return Promise.reject(new Error("InvalidStateError"));
    return Promise.resolve("好了");
  });
  assert.strictEqual(out, "好了");
  assert.strictEqual(tries, 2, "没有重跑那一次");
  assert.strictEqual(f.opens, 2, "重跑时没有换一条新连接");
});

test("两次都不成才算真失败，不许无限重试", async () => {
  const f = fakeIdb();
  const L = layer()(f.idb);
  let tries = 0;
  await assert.rejects(() => L.idbWith("x_tts", 1, () => {}, () => { tries++; return Promise.reject(new Error("坏了")); }));
  assert.strictEqual(tries, 2, "重试次数不对：" + tries);
});

test("连接被系统关掉就从池子里忘掉，下次重开", async () => {
  let db = null;
  const f = fakeIdb(d => { db = d; });
  const L = layer()(f.idb);
  await L.idbKeep("x_selfies", 1, () => {});
  db.onclose();
  await L.idbKeep("x_selfies", 1, () => {});
  assert.strictEqual(f.opens, 2, "关掉以后没有重开");
});

test("每个库都搬过来了，没有谁还在自己家里 open", () => {
  ["x_memvec", "x_lorevec", "x_calllog", "x_selfies", "x_tts", "x_imgvault", "x_txtvault", "lisa_wal_v1"].forEach(name => {
    const re = new RegExp('indexedDB\\.open\\("' + name + '"');
    assert.ok(!re.test(engine), name + " 还在自己 open");
    assert.ok(new RegExp('idbKeep\\("' + name + '"|idbWith\\("' + name + '"').test(engine), name + " 没走公共那一层");
  });
  assert.ok(!/indexedDB\.open/.test(core.slice(core.indexOf("function makeTextStore"), core.indexOf("function companionHead"))), "文本库还在自己 open");
});

test("图库那条最密的路读写都带重试", () => {
  assert.match(engine, /function idbVaultWith\(run\) \{ return idbWith\("x_imgvault", 2, idbVaultUp, run\); \}/);
  ["idbVaultPutOnly", "idbVaultGetOnly"].forEach(fn => {
    const seg = engine.slice(engine.indexOf("function " + fn), engine.indexOf("function " + fn) + 400);
    assert.ok(seg.includes("idbVaultWith"), fn + " 没走重试那一层");
  });
});
