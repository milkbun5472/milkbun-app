// 云端建表内容（她 2026-10-23「家里建表看不到」）
//   ① 只住 js/cloud.js 一份；登录后那页也读得到（原来只在没连云那页露面，早建表的人缺 media 桶时找不到）
//   ② 必须能重复跑：Supabase SQL Editor 一句报错整份就停——每条 create policy 前先 drop if exists，
//      不然旧用户卡在「policy already exists」，后面建桶那段永远轮不到
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

function loadSQL() {
  const src = R("js/cloud.js");
  const a = src.indexOf("  window.CLOUD_SETUP_SQL = ["), b = src.indexOf("  window.copyCloudSetupSQL", a);
  const w = {};
  new Function("window", src.slice(a, b))(w);
  return w.CLOUD_SETUP_SQL;
}

test("建表内容：存文字的表 + 放图片的桶都在，而且能重复跑", () => {
  const sql = loadSQL();
  assert.match(sql, /create table if not exists public\.saves/);
  assert.match(sql, /insert into storage\.buckets \(id, name, public\) values \('media', 'media', false\) on conflict \(id\) do nothing;/);
  // 每一条 create policy 前面都得有同名的 drop policy if exists
  const lines = sql.split("\n");
  const creates = lines.map((l, i) => [l, i]).filter(([l]) => /^create policy /.test(l));
  assert.ok(creates.length >= 4);
  creates.forEach(([l, i]) => {
    const m = l.match(/^create policy (\w+) on ([\w.]+)/);
    assert.equal(lines[i - 1], "drop policy if exists " + m[1] + " on " + m[2] + ";", m[1] + " 没先 drop——旧用户再跑一次会卡在这句");
  });
  assert.ok(!/drop table|delete from|truncate/i.test(sql), "建表内容里不许有会删数据的句子");
});

test("登录后那页看得到；补图卡在没桶时指的就是它", () => {
  const scr = R("js/screens-ui.js");
  const cs = scr.slice(scr.indexOf("function CloudSync({"), scr.indexOf("function CloudSync({") + 40000);
  assert.match(cs, /"data-wk": "cloudsetup"/);
  assert.match(cs, /window\.CLOUD_SETUP_SQL\)\) : null,/, "登录后那页没把建表内容摆出来");
  assert.match(cs, /await window\.copyCloudSetupSQL\(\)/);
  assert.match(cs, /mediaFill\.stopped === "nobucket" \? "[^"]*展开下面「建表内容」/, "没桶时还在指一个看不见的地方");
  assert.ok(!/照上面「怎么弄」里建表/.test(scr), "旧那句指向登录后看不见的地方");
  const ts = R("js/theme-studio.js");
  assert.match(ts, /\["cloudsetup", "/); assert.match(ts, /\["cloudsetupcopy", "/);
});
