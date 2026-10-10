// Schedule rendering is a read-only adapter. Its catalog is generated from the actual maps.
(function (root) {
  "use strict";
  const catalog = () => root.CharDayCatalog || [];
  function validate(value) {
    if (!value || typeof value !== "object") return null;
    const scene = catalog().find(s => s.id === value.scene);
    return scene?.spots.some(s => s.id === value.spot) ? { scene: scene.id, spot: value.spot } : null;
  }
  function bindRow(row, source) {
    const next = { ...row, world: validate(source?.world) };
    if (row.deviation) next.deviation = { ...row.deviation, world: validate(source?.deviation?.world) };
    return next;
  }
  // Only the day renderer consumes visual links. Human-facing readers get a projection.
  function publicRow(row) {
    if (!row || typeof row !== "object") return row;
    const { world, ...text } = row;
    if (text.deviation && typeof text.deviation === "object") {
      const { world: changedWorld, ...changedText } = text.deviation;
      text.deviation = changedText;
    }
    return text;
  }
  function publicSchedules(schedules) {
    return Object.fromEntries(Object.entries(schedules || {}).map(([id, plans]) => [id,
      Object.fromEntries(Object.entries(plans || {}).map(([day, plan]) => [day,
        plan && typeof plan === "object" ? { ...plan, seqs: Array.isArray(plan.seqs) ? plan.seqs.map(publicRow) : plan.seqs } : plan]))]));
  }
  function instruction(digital = false) {
    if (digital) return "\n【小世界显示字段】seqs 每段 world 填 null，deviation 内 world 也填 null；存在时间线仍按数字生命的事实写。";
    const choices = catalog().map(s => s.id + "（" + s.label + "）：" + s.spots.map(p => p.id + "=" + (p.label || p.action)).join("；")).join("\n");
    return "\n【TA的一天·场景连接】先按角色身份、真实安排和世界观写完整日程，再为每段添加可选的 world:{\"scene\":\"场景编号\",\"spot\":\"位置编号\"}。以下编号只写进 world，专供「TA的一天」计算画面位置。日历的 title/location/place、碎碎念和临时变更的 plan/reason/actual 都写角色世界里原本的具体事情和地名，保留自然语言。选最贴合所做之事的位置，没有贴合的位置填 null；按需要安排生活，不为凑齐场景添日程。\n"
      + choices + "\n就寝对应 dayHome/sleep。工作与学习可按实际事情去专业房或普通工作空间；在家做事留在小家。deviation 有实际改动时，其 world 标注实际正在做的事对应的位置，原计划的 world 留在该段外层。";
  }
  function schema(value, digital = false) {
    const field = digital ? '"world":null,' : '"world":{"scene":"上表的场景编号或填null","spot":"该场景的位置编号"},';
    return String(value).replace(/("seqs"\s*:\s*\[\s*\{)/g, "$1" + field);
  }
  function at(scene, spot) {
    const link = validate({ scene, spot });
    if (!link) return null;
    const point = catalog().find(s => s.id === scene).spots.find(s => s.id === spot);
    return { map: scene, spot, action: point.action || "rest", gesture: point.gesture || ({ sleep: "sleep", meal: "eat", tea: "tea", read: "read" }[point.action] || "rest") };
  }
  function sourceFor(slot) {
    if (!slot?.deviation?.actual) return slot || {};
    // A changed task must never inherit the planned room/location.
    const d = slot.deviation;
    return { title: d.actual, location: d.location || (d.actual === slot.title ? slot.location : "") || "", type: d.type || (d.actual === slot.title ? slot.type : "other"), world: d.world };
  }
  function infer(slot) {
    const type = slot.type || "other", words = String(slot.title || ""), place = String(slot.location || ""), text = place + " " + words;
    const home = /家里|家中|在家|回家|住处|府中|寝室|卧室/.test(text);
    const outside = /餐厅|餐馆|饭店|食堂|咖啡店|咖啡馆|茶馆|小店|酒馆/.test(text);
    const dining = outside && !home ? "dayCafe" : "dayHome";
    if (type === "sleep" || /睡觉|就寝|入睡|上床|歇下/.test(words)) return at("dayHome", "sleep");
    if (/做饭|做菜|下厨|烹饪|煮饭|煮粥|煮汤|炒菜|备菜|做[早午晚]餐/.test(words) && !outside) return at("dayHome", "cook");
    if (type === "meal" || /吃饭|用膳|用餐|进餐|早餐|午餐|晚餐|早饭|午饭|晚饭/.test(words)) return at(dining, "meal");
    if (type === "coffee" || /喝茶|饮茶|品茶|喝咖啡|喝水|饮水/.test(words)) return at(dining, "tea");
    if (!home) {
      if (/图书馆|阅览室/.test(text)) return at("dayLibrary", /归还|还书|借阅/.test(words) ? "return-book" : /挑书|找书|选书/.test(words) ? "choose-book" : /备考|自习|做题|复习|笔记/.test(words) ? "study-notes" : /窗边/.test(text) ? "window-reading" : "desk-reading");
      if (/实验室|实验台|实验数据|做实验|观测样品|观察样品/.test(text)) return at("dayLaboratory", /数据|分析|电脑/.test(words) ? "computer" : /记录|笔记/.test(words) ? "records" : /观察|观测|测量/.test(words) ? "observation" : /资料柜/.test(text) ? "archive" : "bench");
      if (/诊室|值班室|病历|接诊|查房|诊查/.test(text)) return at("dayClinic", /休息|歇会/.test(words) ? "rest" : /交班|交接/.test(words) ? "handoff" : /接诊|查房|诊查/.test(words) ? "bedside" : /器材|取物/.test(words) ? "equipment" : /值班/.test(words) ? "duty" : "casework");
      if (/创作工作室|画室|手作|绘画|画画|画稿|画架|画布|缝制|织布|雕刻/.test(text)) return at("dayStudio", /材料|取物/.test(words) ? "materials" : /作品|展示|看画/.test(words) ? "gallery" : /晾|晾干/.test(words) ? "drying" : /画架|画布/.test(text) ? "easel" : /手作|缝|织|雕刻/.test(words) ? "handcraft" : "drawing");
      if (/排练室|琴房|练功房|练舞|练琴|排练|排戏|练习乐器/.test(text)) return at("dayRehearsal", /离开|结束/.test(words) ? "exit" : /休息|歇会/.test(words) ? "rest" : /乐器.*取|取.*乐器|整理乐器|乐器架/.test(words) ? "instruments" : /乐谱|看谱|读谱|台词|背词/.test(words) ? "score" : /练琴|钢琴|电钢琴/.test(words) ? "piano" : /镜前|镜墙|看镜|检查站姿/.test(words) ? "mirror" : "practice");
      if (/车站|候车|站台|公交站|地铁站|客运站/.test(place) || /候车|等车|乘车|赶车|坐车|通勤|出差出发|旅行出发|旅途出发/.test(words)) return at("dayStation", /离开|走出/.test(words) ? "exit" : /进站|走进|进入/.test(words) ? "entrance" : /行李/.test(words) ? "luggage" : /站牌|时刻|路线|信息/.test(words) ? "information" : /问询|服务台|车票/.test(words) ? "service" : /读|看书|翻书/.test(words) ? "reading" : /等车|候车|等待/.test(words) ? "waiting" : /出发|乘车|赶车|通勤|上车/.test(words) ? "departure" : "platform");
    }
    if (type === "out" || /散步|走走|逛街/.test(words)) return at("dayStreet", "walk");
    if (/读|阅读|翻书|看书/.test(words)) return at(home || !["work", "create"].includes(type) ? "dayHome" : "dayWork", "read");
    if (["work", "create"].includes(type)) return home ? { map: "dayHome", action: "work", gesture: "rest" } : at("dayWork", "work");
    if (type === "social" && outside) return at("dayCafe", "rest");
    return at("dayHome", "rest");
  }
  function presentation(slot) {
    const source = sourceFor(slot);
    if (source.type === "sleep" || /睡觉|就寝|入睡|上床|歇下/.test(String(source.title || ""))) return at("dayHome", "sleep");
    const link = validate(source.world);
    return (link && at(link.scene, link.spot)) || infer(source);
  }
  const live = new Map();
  function setPresence(id,value){if(!id)return;if(!value?.present){live.delete(String(id));return;}live.set(String(id),{...value,at:Date.now()});}
  function presenceFor(id){const v=live.get(String(id));if(!v||Date.now()-v.at>15000)return "";
    const state=v.interaction?(v.interactionPhase==="active"?v.interactionLabel+"中":"正在走到"+v.interactionLabel+"的位置"):v.busy?"对方正在屋里走动":v.seated?"对方已坐下":"对方站在屋里";
    return "【TA的一天·此刻的小世界画面】对方已主动进入共同小屋。"+state+"；你当前画面位置："+(v.taActivity||"在家")+"。这是当前3D互动画面的会话状态，现实日程、住址和经历仍沿原资料理解。回应由你的人设与当前话题决定。";
  }
  root.CharDayLink = { validate, bindRow, publicRow, publicSchedules, instruction, schema, presentation, setPresence, presenceFor };
})(globalThis);
