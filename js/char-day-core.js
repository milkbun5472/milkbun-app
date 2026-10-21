// ============================================================
// TA的一天 · 开机就要的那一小份（从 js/char-day.js 搬出来，她 2026-10-18 继续瘦身）
// ============================================================
// 「TA的一天」页面（char-day.js）跟小世界一组、点进去才加载；主屏的「TA的一天」小组件和秋秋改小家那支开机就要
// CharDayKit（此刻在干嘛、这一行怎么写、存小家改动）——那一套住在这儿。页面那一半从 root.CharDayCore 取，不另写。
// Schedule viewer and per-character home decoration; narrative and game saves stay with their owners.
(function (root) {
  "use strict";
  const DEMO = { id: "__char_day_demo", name: "示例小人", tz: "0" };
  const DEMO_ROWS = [
    { seq: 1, time: "08:00", end: "09:00", title: "吃早饭，慢慢醒过来", location: "家里的餐桌", type: "meal" },
    { seq: 2, time: "09:00", end: "12:00", title: "坐下来翻书、整理手头的事", location: "案边", type: "work" },
    { seq: 3, time: "14:00", end: "16:00", title: "出门走一走", location: "街边小路", type: "out" },
    { seq: 4, time: "18:00", end: "19:00", title: "在家下厨煮汤", location: "家里的厨房", type: "home" },
    { seq: 5, time: "19:00", end: "21:00", title: "回家喝茶，歇一会儿", location: "窗边", type: "coffee" },
    { seq: 6, time: "23:00", end: "24:00", title: "躺下来休息", location: "卧室", type: "sleep" }
  ];
  const clockText = n => String(Math.floor(n / 60)).padStart(2, "0") + ":" + String(n % 60).padStart(2, "0");
  // What came just before and what comes next around this moment, from the same filled rows the scene uses.
  function aroundNow(state){
    const rows=state?.rows||[],toMin=t=>{const m=/^(\d{1,2}):(\d{2})/.exec(String(t||""));return m?+m[1]*60+ +m[2]:null;},now=state?.minute;
    const index=state?.slot&&!state.slot.carry?rows.findIndex(r=>r.time===state.slot.time):-1;
    let prev=null,next=null;
    if(index>=0){prev=rows[index-1]||null;next=rows[index+1]||null;}
    else if(Number.isFinite(now))for(const row of rows){const t=toMin(row.time),e=toMin(row.end);if(t==null)continue;if(t>now){next=row;break;}if(e!=null&&e<=now)prev=row;}
    const slot=state?.slot,elapsed=slot&&Number.isFinite(slot.startAt)&&Number.isFinite(state.at)?Math.max(0,Math.floor((state.at-slot.startAt)/60000)):null;
    return {prev,next,elapsed};
  }
  const spanText = m => m == null ? "" : m < 1 ? "刚开始" : m < 60 ? "已经 " + m + " 分钟" : "已经 " + Math.floor(m / 60) + " 小时" + (m % 60 ? m % 60 + " 分" : "");
  function dayState(char, plans, at = Date.now(), options = {}) {
    const clock = root.ScheduleClock, frame = clock.characterFrame(char, at, options);
    const pinned=[options.clockSource,options.memorySource].find(v=>v?.virtualAt===frame.displayAt&&/^\d{4}-\d{2}-\d{2}$/.test(v.sourceDay));
    // 钉住的那一天只给「日程按现实日子存」的钟用。开了「日程照这只钟的日子排」，日程就存在钟上那天，
    //   旧钉子（多半是打开开关之前钉的现实日子）不许再盖——群里 2026-10-21：日历上排好了，「今天的日程」却说没有。
    if(frame.followVirtual&&frame.paused&&pinned&&!frame.schedFollow)frame.sourceDay=pinned.sourceDay;
    const plan = (plans || {})[frame.sourceDay], rows = typeof schedFillEnds === "function" ? schedFillEnds(plan?.seqs || []) : plan?.seqs || [];
    const slot = clock.currentSlot(char, plans, frame.at, frame.offset, {
      planDay:frame.sourceDay,
      fillEnds: typeof schedFillEnds === "function" ? schedFillEnds : x => x,
      sleepCarry: typeof schedSleepCarry === "function" ? schedSleepCarry : undefined
    });
    return { ...frame, time: clockText(frame.minute), rows, slot, hasPlan: !!rows.length };
  }
  function presentation(slot) { return root.CharDayLink.presentation(slot); }
  // The clock each character's day runs on (character clock or real time, pinned source day): the scene, picker and home widget all ask here.
  function clockOptions(homes, id) { const key = String(id); return { followVirtual: homes?.clockModes?.[key] !== "real", clockSource: homes?.clockSources?.[key], memorySource: clockSources.get(key) }; }
  let homeWrite=Promise.resolve();
  const clockSources=new Map();
  function saveHomeUpdate(update){
    const write=homeWrite.catch(()=>{}).then(async()=>{
      const previous=loadJSON("x_charDayHomes",{})||{},next=update(previous);
      const result=await commitJSONDurable("x_charDayHomes",next);
      if(!result?.durable||!result?.live)throw Error("save");
      return next;
    });homeWrite=write;return write;
  }
  function saveHomeChange(charId,section,value){
    return saveHomeUpdate(previous=>({...previous,version:3,[section]:{...previous[section],[String(charId)]:typeof value==='function'?value(previous[section]?.[String(charId)]):value}}));
  }
  const visitChoice=info=>info.control==="auto"?"auto":(["read","drink","eat","rest"].includes(info.manualAction)||root.CharDayHomeHobbies?.activities[info.manualAction])?info.manualAction:"manual";
  // Read the existing weather owner; this viewer never fetches or invents real weather.
  // day comes from the scene's own clock frame (real or character clock), so weather matches the minute on screen.
  function sceneWeather(char,at=Date.now(),preview=false,minute=null,day=null){
    try{
      const worlds=loadJSON("x_worlds",[])||[],realm=root.MapKit?.charRealm?.(char,worlds);
      if(realm?.kind==='world'&&root.WorldWeather){
        const frame=root.ScheduleClock.characterFrame(char,at),date=day||frame.day,m=minute==null?frame.minute:minute;
        const parts=date.split('-').map(Number),sample=new Date(parts[0],parts[1]-1,parts[2],Math.floor(m/60),m%60);
        const weather=root.WorldWeather.hours(realm.world.id+'|'+realm.node,realm.terrain,sample,1)?.[0];
        return weather?.code!=null?{code:weather.code,source:'world',place:realm.node}:null;
      }
      if(preview)return null;
      const home=char?.home;if(typeof home?.lat!=='number'||typeof home?.lng!=='number'||typeof weatherCached!=='function')return null;
      const weather=weatherCached(home.lat,home.lng);if(weather?.code==null||!Number.isFinite(weather.ts)||at-weather.ts>2*3600000||weather.ts>at+60000)return null;
      return {code:weather.code,source:'real',place:home.label||''};
    }catch{return null;}
  }
  // The last saved thought only; readers (picker, home widget) never ask the model for a new one.
  function lastThought(homes, id) { const t = homes?.thoughts?.[String(id)]; return t?.enabled === true && t.cache?.text ? t.cache : null; }
  // The whole day on one strip: each planned stretch over 24 hours, the current one filled, a tick at now.
  function dayLine(state, { accent = "#8b9e7e", muted = "rgba(120,110,95,.22)", height = 5 } = {}) {
    const rows = state?.rows || [], toMin = t => { const m = /^(\d{1,2}):(\d{2})/.exec(String(t || "")); return m ? +m[1] * 60 + +m[2] : null; }, now = state?.minute;
    if (!rows.length) return null;
    const bits = rows.map((row, i) => { const a = toMin(row.time), b = toMin(row.end); if (a == null) return null; const end = b == null || b <= a ? Math.min(1440, a + 60) : b, current = !!state.slot && !state.slot.carry && state.slot.time === row.time;
      return h("span", { key: i, style: { position: "absolute", top: 0, bottom: 0, left: (a / 14.4) + "%", width: Math.max(0.6, (end - a) / 14.4) + "%", background: current ? accent : muted, borderRadius: 2 } }); }).filter(Boolean);
    if (Number.isFinite(now)) bits.push(h("span", { key: "now", style: { position: "absolute", top: -2, bottom: -2, left: "calc(" + (now / 14.4) + "% - 1px)", width: 2, borderRadius: 1, background: accent } }));
    return h("span", { "aria-hidden": "true", style: { display: "block", position: "relative", height, borderRadius: height, background: "rgba(120,110,95,.08)", marginTop: 6 } }, ...bits);
  }
  root.CharDayKit = { dayState, clockOptions, aroundNow, spanText, lastThought, dayLine, presentation, sceneWeather, DEMO, DEMO_ROWS, saveHomeChange, saveHomeUpdate, visitChoice };
  // 页面那半要用的，原样递过去
  root.CharDayCore = { DEMO, DEMO_ROWS, clockText, aroundNow, spanText, dayState, presentation, clockOptions, clockSources, saveHomeUpdate, saveHomeChange, visitChoice, sceneWeather, lastThought, dayLine };
})(window);
