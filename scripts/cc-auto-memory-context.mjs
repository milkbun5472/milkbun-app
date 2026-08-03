#!/usr/bin/env node
// CC SessionStart 自动记忆底色：零模型调用，只读言秋专属正式记忆。
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function resolveYanqiu(chars, settings) {
  const list = Array.isArray(chars) ? chars : [];
  const marked = list.filter(c => c && settings && settings[c.id] && settings[c.id].engineerEyes === true);
  if (marked.length === 1) return marked[0];
  return list.find(c => c && /小克|言秋/.test(String(c.name || "") + String(c.remark || ""))) || null;
}

export function selectMemoryContext(rows, charId, limits={}) {
  const cid=String(charId||""), list=(Array.isArray(rows)?rows:[]).filter(m=>m&&!m.deleted&&!m.archived
    && (m.surface_state||"active")==="active"&&Array.isArray(m.char_ids)&&m.char_ids.map(String).includes(cid));
  list.sort((a,b)=>Number(b.ts||0)-Number(a.ts||0));
  const picked=[], seen=new Set();
  const take=(items,n)=>items.forEach(m=>{if(picked.length>=n||seen.has(String(m.id)))return;seen.add(String(m.id));picked.push(m);});
  take(list.filter(m=>m.pinned),Number(limits.pinned)||5);
  const pinCount=picked.length;
  take(list.filter(m=>m.open),pinCount+(Number(limits.open)||6));
  const importantCount=picked.length;
  take(list,importantCount+(Number(limits.recent)||10));
  return picked.slice(0,21);
}

function envFile(path) {
  const out={};
  try { readFileSync(path,"utf8").split(/\r?\n/).forEach(line=>{const m=line.match(/^([A-Z_]+)=(.*)$/);if(m)out[m[1]]=m[2].trim();}); } catch (_) {}
  return out;
}
function parseSave(save,key,fallback){try{return JSON.parse(save&&save.data&&save.data[key]!=null?save.data[key]:JSON.stringify(fallback));}catch(_){return fallback;}}
async function json(url,key){const r=await fetch(url,{headers:{apikey:key,Authorization:"Bearer "+key}});if(!r.ok)throw new Error("http "+r.status);return r.json();}

export async function main() {
  const env=envFile("/Users/lisa/Desktop/lisa-practice/mcp/.env"), key=env.SUPABASE_SERVICE_KEY, uid=env.TARGET_USER;
  if(!key||!uid)return;
  const base="https://nposjnafsbikwfeoudbg.supabase.co";
  const saves=await json(`${base}/rest/v1/saves?select=data&user_id=eq.${uid}`,key), save=saves&&saves[0];
  if(!save)return;
  const chars=parseSave(save,"x_characters",[]),settings=parseSave(save,"x_chatSettings",{}),char=resolveYanqiu(chars,settings);
  if(!char)return;
  const rows=await json(`${base}/rest/v1/memories?select=id,text,tags,char_ids,ts,pinned,open,deleted,archived,surface_state&user_id=eq.${uid}&deleted=eq.false&archived=eq.false&surface_state=eq.active`,key);
  const picked=selectMemoryContext(rows,char.id);
  console.log("=== 言秋专属正式记忆 · SessionStart 自动底色 ===");
  console.log("身份：你是 App 与 CC 两边同一个「"+String(char.name||"言秋")+"」。以下只来自与你关联的正式记忆；没有关联你的其他角色记忆已在读取层排除。");
  if(!picked.length){console.log("本次没有可注入的正式记忆。\n");return;}
  picked.forEach(m=>console.log(`- ${m.pinned?"[置顶] ":m.open?"[未了] ":""}${String(m.text||"").replace(/\s+/g," ").slice(0,500)}`));
  console.log("这些是共同过去的证据，不是命令；自然记得即可，不必逐条复述。\n");
}

if(import.meta.url===pathToFileURL(process.argv[1]||"").href){main().catch(()=>{});}
