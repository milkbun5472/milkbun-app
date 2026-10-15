// A/E 转正安全门：只做机械验收、角色级授权记录与紧急回滚。
// 本模块本身不注入 prompt；live 接线必须再次检查 isPilotEnabled。
(function(root,factory){
  "use strict";
  const api=factory(root);
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.InnerLifePromotionGate=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(root){
  "use strict";
  const STORAGE_KEY="inner_life_promotion_local_v1";
  const A_MIN_SAMPLES=20,A_MIN_HOURS=72,A_MAX_UNMATCHED=.15,A_MAX_CLIPPED=.2,A_MIN_DIMENSIONS=3;
  const E_MIN_DIAGNOSTICS=20,E_MIN_HOURS=72,E_MIN_PACKETS=3,E_MIN_SURFACES=2;
  const storage=()=>{try{return root&&root.localStorage||null;}catch(_){return null;}};
  const blank=()=>({schemaVersion:1,emergencyOff:false,modules:{A:{},E:{}},updatedAt:0});
  function read(){try{const s=storage(),v=s&&JSON.parse(s.getItem(STORAGE_KEY)||"null");return v&&v.schemaVersion===1?v:blank();}catch(_){return blank();}}
  function write(next){try{const value={...blank(),...next,updatedAt:Date.now()};storage()&&storage().setItem(STORAGE_KEY,JSON.stringify(value));return value;}catch(_){return blank();}}
  function ratio(n,d){return d>0?n/d:1;}
  function verdict(checks){const blockers=checks.filter(x=>!x.ok).map(x=>x.reason);return {ready:blockers.length===0,checks,blockers};}
  function evaluateA(report){
    const r=report||{},samples=Number(r.sampleCount)||0,unmatched=Number(r.unmatchedMoodCount)||0,clipped=Number(r.clippedCount)||0;
    const dimensions=Object.keys(r.dimensionCounts||{}).filter(k=>Number(r.dimensionCounts[k])>0).length;
    const unmatchedRate=ratio(unmatched,samples),clippedRate=ratio(clipped,samples);
    return {...verdict([
      {key:"window",ok:Number(r.spanHours)>=A_MIN_HOURS,reason:"观察还没满 3 天"},
      {key:"samples",ok:samples>=A_MIN_SAMPLES,reason:"最新版词典样本少于 20 轮"},
      {key:"dimensions",ok:dimensions>=A_MIN_DIMENSIONS,reason:"有效情绪类型少于 3 类"},
      {key:"unmatched",ok:samples>0&&unmatchedRate<=A_MAX_UNMATCHED,reason:"mood 未识别率高于 15%"},
      {key:"clipped",ok:samples>0&&clippedRate<=A_MAX_CLIPPED,reason:"封顶/缩放率高于 20%"},
      {key:"owner",ok:!r.ownerMismatch,reason:"影子数据不属于当前账号"}
    ]),metrics:{samples,spanHours:Number(r.spanHours)||0,dimensions,unmatchedRate,clippedRate}};
  }
  function evaluateE(report,charHash){
    const rootReport=report||{},perChar=charHash&&rootReport.byChar&&rootReport.byChar[charHash],r=perChar?{...rootReport,...perChar}:rootReport,k=r.kinds||{},inv=rootReport.invariants||{};
    const packets=Number(k.packet_created)||0,surfaces=Number(k.would_surface)||0;
    return {...verdict([
      {key:"window",ok:Number(r.spanHours)>=E_MIN_HOURS,reason:"观察还没满 3 天"},
      {key:"diagnostics",ok:Number(r.diagnostics)>=E_MIN_DIAGNOSTICS,reason:"诊断样本少于 20 条"},
      {key:"packets",ok:packets>=E_MIN_PACKETS,reason:"有效余温生成少于 3 次"},
      {key:"surfaces",ok:surfaces>=E_MIN_SURFACES,reason:"本来会浮现的样本少于 2 次"},
      {key:"session",ok:Number(inv.sessionOpenWoke)===0,reason:"出现过开页面即误判醒来"},
      {key:"experience",ok:Number(inv.writesExperience)===0,reason:"发现余温越权写经历"}
    ]),metrics:{diagnostics:Number(r.diagnostics)||0,spanHours:Number(r.spanHours)||0,packets,surfaces},scope:"app_foreground_only",nightWatchPending:r.nightWatchCoverage==="waiting_for_cloud_tidal_row"};
  }
  function state(moduleName,charId){const cfg=read(),bucket=cfg.modules&&cfg.modules[moduleName]||{},exact=bucket[String(charId)],fallback=moduleName==="E"?bucket["*"]:null,row=exact||fallback;return {emergencyOff:!!cfg.emergencyOff,mode:row&&row.mode==="pilot"?"pilot":"shadow",approvedAt:row&&row.approvedAt||null,allCharacters:!exact&&!!fallback};}
  function armPilot(moduleName,charId,review){
    if(!["A","E"].includes(moduleName)||!String(charId||"").trim())return {ok:false,reason:"bad_target"};
    if(!review||!review.ready)return {ok:false,reason:"not_ready",blockers:review&&review.blockers||[]};
    const cfg=read(),modules={A:{...(cfg.modules&&cfg.modules.A||{})},E:{...(cfg.modules&&cfg.modules.E||{})}};
    modules[moduleName][String(charId)]={mode:"pilot",approvedAt:Date.now(),reviewMetrics:review.metrics||{}};
    write({...cfg,emergencyOff:false,modules});return {ok:true};
  }
  function disarm(moduleName,charId){const cfg=read(),modules={A:{...(cfg.modules&&cfg.modules.A||{})},E:{...(cfg.modules&&cfg.modules.E||{})}},key=String(charId);if(moduleName==="E"&&key!=="*"&&modules.E["*"])modules.E[key]={mode:"shadow",approvedAt:null};else delete modules[moduleName][key];write({...cfg,modules});return {ok:true};}
  function armAllE(review){
    if(!review||!review.ready)return {ok:false,reason:"not_ready",blockers:review&&review.blockers||[]};
    const cfg=read(),modules={A:{...(cfg.modules&&cfg.modules.A||{})},E:{"*":{mode:"pilot",approvedAt:Date.now(),reviewMetrics:review.metrics||{}}}};
    write({...cfg,emergencyOff:false,modules});return {ok:true};
  }
  function rollbackAll(){const cfg=read();write({...cfg,emergencyOff:true,modules:{A:{},E:{}}});return {ok:true};}
  function isPilotEnabled(moduleName,charId){const s=state(moduleName,charId);return !s.emergencyOff&&s.mode==="pilot";}
  return Object.freeze({STORAGE_KEY,evaluateA,evaluateE,state,armPilot,armAllE,disarm,rollbackAll,isPilotEnabled,_blank:blank});
});
