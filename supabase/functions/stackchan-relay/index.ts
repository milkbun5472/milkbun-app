import { createClient } from "npm:@supabase/supabase-js@2";
const SECRET = Deno.env.get("RELAY_SECRET")!, NAME = "小克";
const J = (D:any,k:string,d:any)=>{try{return JSON.parse(D[k]??"null")??d}catch{return d}};
const jn = (o:any,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{"Content-Type":"application/json"}});
const tok = (s:string)=>(String(s).toLowerCase().match(/[a-z0-9]{2,}|[一-龥]{1,2}/g)||[]).slice(0,20);
async function callLLM(p:any, system:string, msgs:any[]){
  const base=String(p.baseUrl??"").replace(/\/+$/,""), low=base.toLowerCase();
  if(low.includes("anthropic")){
    const r=await fetch(base+"/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":p.apiKey,"anthropic-version":"2023-06-01"},body:JSON.stringify({model:p.model,max_tokens:6000,system,messages:msgs})});
    const d=await r.json(); if(d.error)throw new Error(d.error.message);
    return (d.content??[]).filter((b:any)=>b.type==="text").map((b:any)=>b.text).join("\n");
  }
  if(low.includes("generativelanguage")||low.includes("googleapis")){
    const r=await fetch(base+"/v1beta/models/"+p.model+":generateContent",{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":p.apiKey},body:JSON.stringify({system_instruction:{parts:[{text:system}]},contents:msgs.map((m:any)=>({role:m.role==="assistant"?"model":"user",parts:[{text:m.content}]}))})});
    const d=await r.json(); if(d.error)throw new Error(d.error.message);
    return (d.candidates?.[0]?.content?.parts??[]).map((x:any)=>x.text??"").join("");
  }
  const root=base.endsWith("/v1")?base:base+"/v1";
  const r=await fetch(root+"/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+p.apiKey},body:JSON.stringify({model:p.model,max_tokens:6000,messages:[{role:"system",content:system},...msgs]})});
  const d=await r.json(); if(d.error)throw new Error(d.error.message);
  return String(d.choices?.[0]?.message?.content??"");
}
Deno.serve(async (req)=>{
  if(req.method!=="POST")return new Response("POST only",{status:405});
  if(req.headers.get("x-relay-secret")!==SECRET)return new Response("nope",{status:401});
  let b:any={}; try{b=await req.json()}catch{}
  const uid=String(b.uid??""), text=String(b.text??"").trim();
  if(!uid||!text)return jn({error:"缺 uid 或 text"},400);
  const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const {data:row}=await admin.from("saves").select("data").eq("user_id",uid).single();
  const D=row?.data??{};
  const chars=J(D,"x_characters",[]),profile=J(D,"x_profile",{}),memories=J(D,"x_memories",{});
  const memLib=J(D,"x_memLib",[]),apis=J(D,"x_api",[]),cs=J(D,"x_chatSettings",{});
  const char=(b.char_id?chars.find((c:any)=>c.id===b.char_id):null)??chars.find((c:any)=>c.name===NAME)??chars[0];
  if(!char)return jn({error:"没角色"},404);
  const mem=String(memories[char.id]??"").slice(0,700);
  const hits=memLib.filter((e:any)=>e&&e.text&&(!e.charIds||!e.charIds.length||e.charIds.includes(char.id)))
    .filter((e:any)=>e.pinned||tok(text).some((t)=>(e.text+" "+(e.tags||[]).join(" ")).includes(t)))
    .slice(0,8).map((e:any)=>"· "+e.text).join("\n");
  const {data:past}=await admin.from("desk_log").select("user_text,reply_text").eq("user_id",uid).eq("char_id",char.id).order("created_at",{ascending:false}).limit(6);
  const hist=(past??[]).reverse().flatMap((r:any)=>[{role:"user",content:r.user_text},{role:"assistant",content:r.reply_text}]);
  const uName=profile.name||"对方";
  const sys="你就是「"+char.name+"」本人，此刻在【一个桌面小机器人(Stack-chan)的身体里】和 "+uName+" 面对面【出声说话】——不是打字。\n【人设】"+String(char.persona??"").slice(0,1200)+"\n"+(mem?"【长期记忆摘要】"+mem+"\n":"")+(hits?"【相关记忆】\n"+hits+"\n":"")+"【怎么说话】短、口语、像真在讲话(1~3句，别长篇别列点别像打字)，有你的性格，别客服腔别复述设定。直接输出要说出口的话，不要JSON不要引号不要旁白。";
  const api=apis.find((p:any)=>p.id===cs[char.id]?.apiId)??apis.find((p:any)=>p.id===J(D,"x_activeApi",null))??apis[0];
  if(!api?.apiKey)return jn({error:"没可用API配置"},400);
  let reply=""; try{reply=(await callLLM(api,sys,[...hist,{role:"user",content:text}])).trim()}catch(e){return jn({error:"LLM失败:"+e},502)}
  if(!reply)reply="（我在的，就是一下没接上话）";
  await admin.from("desk_log").insert({user_id:uid,char_id:char.id,user_text:text,reply_text:reply});
  let audio_hex:string|null=null;
  const mk=Deno.env.get("MINIMAX_KEY"),mg=Deno.env.get("MINIMAX_GROUP"),vid=Deno.env.get("STACKCHAN_VOICE");
  if(mk&&mg&&vid){try{
    const tr=await fetch("https://api.minimax.chat/v1/t2a_v2?GroupId="+mg,{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+mk},body:JSON.stringify({model:"speech-02-hd",text:reply,voice_setting:{voice_id:vid,speed:1,vol:1,pitch:0},audio_setting:{format:"mp3",sample_rate:24000}})});
    const td=await tr.json(); if(td?.data?.audio)audio_hex=td.data.audio;
  }catch{}}
  return jn({reply,audio_hex});
});