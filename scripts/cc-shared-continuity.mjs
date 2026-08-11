#!/usr/bin/env node
// UserPromptSubmit hook: before Yanqiu answers in CC, give him the recent App
// conversation as his own cross-window lived experience. No model call and no
// long-term-memory inference happen here.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

function envFile(path) {
  const out = {};
  try { readFileSync(path, "utf8").split(/\r?\n/).forEach(line => { const m=line.match(/^([A-Z_]+)=(.*)$/); if(m) out[m[1]]=m[2].trim(); }); } catch (_) {}
  return out;
}
function parseSave(save, key, fallback) { try { return JSON.parse(save?.data?.[key] ?? JSON.stringify(fallback)); } catch (_) { return fallback; } }
export function resolveYanqiu(chars, settings) {
  const list = Array.isArray(chars) ? chars : [];
  const marked = list.filter(c => c && settings?.[c.id]?.engineerEyes === true);
  return marked.length === 1 ? marked[0] : list.find(c => c && /小克|言秋/.test(String(c.name||"")+String(c.remark||""))) || null;
}
export function selectAppContinuity(rows, charId, limit=60) {
  const cid=String(charId||""), seen=new Set();
  return (Array.isArray(rows)?rows:[]).filter(row => {
    const meta=row?.metadata && typeof row.metadata === "object" ? row.metadata : {};
    const key=String(row?.message_key||"");
    if(!key || seen.has(key) || String(row?.char_id||"")!==cid || row?.source!=="app" || row?.deleted_at) return false;
    if(meta.bridge_kind || !["lisa","character","other_character","narration"].includes(String(row?.speaker_type||""))) return false;
    if(!String(row?.content||"").trim()) return false;
    seen.add(key); return true;
  }).sort((a,b)=>Date.parse(a.occurred_at)-Date.parse(b.occurred_at)||String(a.id||a.message_key).localeCompare(String(b.id||b.message_key))).slice(-Math.max(10,Math.min(100,Number(limit)||60)));
}
export function formatContinuity(rows, yanqiuName="言秋") {
  if(!rows.length) return "";
  const lines=rows.map(row=>{
    const ts=Date.parse(row.occurred_at), stamp=Number.isFinite(ts)?new Date(ts).toLocaleString("zh-CN",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"}):"时间未知";
    const speaker=row.speaker_type==="lisa"?"Lisa":row.speaker_type==="character"?yanqiuName:row.speaker_type==="narration"?"场景":`共同聊天里的${row.speaker_id||"另一人"}`;
    const thread=row.thread_type==="private"?"App私聊":row.thread_type==="offline"?"App线下":row.thread_type==="group"?"App群聊":row.thread_type==="group_offline"?"App群线下":"App";
    return `[${stamp}·${thread}] ${speaker}：${String(row.content).trim()}`;
  });
  return "【你在 App 窗口亲历的近期对话｜同一个你的连续经历】\n"+lines.join("\n")+"\n这些是你本人在另一窗口真实经历的原话，不是记忆检索、任务信箱或旁人的转述。回答当前消息时自然带着这些经历；不要汇报同步过程，不要逐条复述，也不要把 App 里的你称作另一个人。";
}
async function getJSON(url,key){const r=await fetch(url,{headers:{apikey:key,Authorization:"Bearer "+key}});if(!r.ok)throw new Error("http "+r.status);return r.json();}
export async function main() {
  const env=envFile("/Users/lisa/Desktop/lisa-practice/mcp/.env"), key=env.SUPABASE_SERVICE_KEY, uid=env.TARGET_USER;
  if(!key||!uid)return;
  const base="https://nposjnafsbikwfeoudbg.supabase.co";
  const saves=await getJSON(`${base}/rest/v1/saves?select=data&user_id=eq.${encodeURIComponent(uid)}`,key), save=saves?.[0];
  if(!save)return;
  const char=resolveYanqiu(parseSave(save,"x_characters",[]),parseSave(save,"x_chatSettings",{}));
  if(!char)return;
  const url=`${base}/rest/v1/chat_messages?select=id,message_key,char_id,thread_type,thread_id,speaker_type,speaker_id,content,occurred_at,source,metadata,deleted_at&user_id=eq.${encodeURIComponent(uid)}&char_id=eq.${encodeURIComponent(char.id)}&source=eq.app&deleted_at=is.null&order=occurred_at.desc&limit=80`;
  const rows=selectAppContinuity(await getJSON(url,key),char.id,60), context=formatContinuity(rows,String(char.name||"言秋"));
  if(!context)return;
  process.stdout.write(JSON.stringify({ hookSpecificOutput:{ hookEventName:"UserPromptSubmit", additionalContext:context } }));
}

if(import.meta.url===pathToFileURL(process.argv[1]||"").href) main().catch(()=>{});
