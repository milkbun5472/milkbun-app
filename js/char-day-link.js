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
  function occupationLink(words, place, type) {
    const preparingMeal = /制作[早午晚]餐|准备[早午晚]餐|做[早午晚]餐|备料|切配|备菜|做饭|做菜|炒菜|煮饭|烹饪|下厨/.test(words);
    if (/吃饭|用餐|喝水|喝茶|喝咖啡|观看直播|收看直播|看直播|听录音/.test(words) || /早餐|午餐|晚餐/.test(words) && !preparingMeal) return null;
    if (["meal", "coffee"].includes(type) && !/制作[早午晚]餐|准备[早午晚]餐|做[早午晚]餐|备料|切配|备菜|做饭|做菜|炒菜|煮饭|烹饪|下厨|出餐|冲煮|制作咖啡|做咖啡|调酒|调制/.test(words)) return null;
    if (/候车|等车|乘车|通勤|坐车|赶车/.test(words)) return null;
    // Actual outdoor work keeps its outdoor location; the indoor sets are only
    // selected for matching tasks and places, not from a guessed profession.
    if (/巡逻|街拍|外景拍摄|外出取证|街头拍摄/.test(words)) return at("dayStreet", "walk");
    if (/警局|派出所|刑侦|办案室|案件室|侦探事务所/.test(place) || /梳理案情|分析案情|整理案件|调查线索|比对线索|案情汇报|线索墙/.test(words)) {
      return at("dayInvestigation", /离开|下班/.test(words) ? "exit" : /喝水|喝茶/.test(words) ? "tea" : /休息|歇会/.test(words) ? "rest" : /汇报|讨论案情|开会|会议/.test(words) ? "briefing" : /交班|交接|值勤|值班/.test(words) ? "duty" : /物证|封存/.test(words) ? "evidence" : /取.*卷宗|取.*档案|归还|档案柜/.test(words) ? "files" : /检索|电脑|查询|比对数据/.test(words) ? "computer" : /线索|案情|案件板/.test(words) ? "clues" : "notes");
    }
    const restaurant = /餐厅|餐馆|饭店|咖啡店|咖啡馆|酒吧|酒馆|后厨|吧台/.test(place);
    const serviceTask = /制作[早午晚]餐|准备[早午晚]餐|做[早午晚]餐|备料|切配|出餐|备菜|做饭|做菜|炒菜|煮饭|煮汤|烹饪|下厨|冲煮|制作咖啡|做咖啡|调酒|调制饮品|接单|核对订单|收银|清洗器具|整理操作台|店内值班|门店值班|上班|开店|营业/.test(words);
    if (restaurant && serviceTask || /后厨|操作吧台/.test(place) && ["work", "create"].includes(type)) {
      return at("dayService", /离开|下班/.test(words) ? "exit" : /冷藏|冷柜|取.*材料/.test(words) ? "storage" : /清洗|洗碗|整理操作台/.test(words) ? "wash" : /收银|接单|订单/.test(words) ? "cashier" : /调酒|调制|调饮/.test(words) ? "mix" : /咖啡|冲煮/.test(words) || /咖啡店|咖啡馆/.test(place) && /上班|值班|营业/.test(words) ? "coffee" : /备料|切配|备菜/.test(words) ? "prep" : /制作[早午晚]餐|准备[早午晚]餐|做[早午晚]餐|做饭|做菜|煮饭|烹饪|下厨|灶台|炒菜|煮汤/.test(words) ? "cook" : "serve");
    }
    const filmPlace = /摄影棚|拍摄棚|片场|影棚|化妆间|试镜室/.test(place);
    if (filmPlace || /棚拍|试镜|定妆|拍戏/.test(words)) {
      return at("dayFilm", /离开|收工/.test(words) ? "exit" : /休息|等候|候场/.test(words) && !/台本|剧本/.test(words) ? "rest" : /化妆|妆容|补妆|定妆/.test(words) ? "makeup" : /服装|换装|挂衣/.test(words) ? "costume" : /台本|剧本|台词/.test(words) ? "script" : /布光|灯光|灯架/.test(words) ? "lighting" : /回看|素材|剪辑/.test(words) ? "review" : /模特|摆姿|定点拍照/.test(words) ? "pose" : /掌镜|机后|操作摄影机|摄影师|摄影|摄像/.test(words) ? "camera" : /棚拍/.test(words) ? "pose" : "perform");
    }
    const recordPlace = /录音室|录音棚|配音棚|直播间|直播工作室|播音室/.test(place);
    const recordTask = /配音录制|录制配音|录歌|录制歌曲|开播|直播|调音|混音|录音|试音/.test(words) && !/观看|收看|看直播|听录音/.test(words);
    if (recordPlace || recordTask && !/办公室|会议室|教室|图书馆/.test(place)) {
      return at("dayBroadcast", /离开|收工|下播/.test(words) ? "exit" : /休息|歇会/.test(words) ? "rest" : /器材|线材|取.*耳机/.test(words) ? "gear" : /台本|歌词|读稿/.test(words) ? "script" : /混音|调音|监听/.test(words) ? "mix" : /剪辑|整理素材/.test(words) ? "edit" : /直播|开播/.test(words) ? "stream" : /录歌|唱歌|演唱|录制歌曲/.test(words) ? "sing" : "voice");
    }
    return null;
  }
  function infer(slot) {
    const type = slot.type || "other", words = String(slot.title || ""), place = String(slot.location || ""), text = place + " " + words;
    const home = /家里|家中|在家|回家|住处|府中|寝室|卧室/.test(text);
    const outside = /餐厅|餐馆|饭店|食堂|咖啡店|咖啡馆|茶馆|小店|酒馆|面包房|面包店|烘焙店|甜品店|甜点店/.test(text);
    const office = !home && !outside && (/办公室|办公区|公司|会议室|会议厅|部门工位|办公楼/.test(text) || /开会|例会|组会|项目汇报|部门会议/.test(words));
    const campus = !home && (!office || /教室|校园|学校|教学楼/.test(place)) && (!outside || /食堂/.test(place)) && /教室|课堂|校园|学校|教学楼|讲台|黑板|上课|听课|授课|讲课|备课|教案|课间|下课/.test(text);
    const dining = outside && !home ? "dayCafe" : "dayHome";
    if (type === "sleep" || /睡觉|就寝|入睡|上床|歇下/.test(words)) return at("dayHome", "sleep");
    if (!home && /农场|农庄|田间|菜畦|菜园|种植园/.test(place || words)) return at("dayFarm", /离开|走出/.test(words) ? "exit" : /休息|歇会/.test(words) ? "rest" : /记录|笔记|整理|分析|规划/.test(words) ? "records" : /取.*工具|取.*资料|整理工具/.test(words) ? "supplies" : /钓鱼|码头|水边/.test(words) ? "dock" : "crops");
    if (!home && !outside && /复古市集|跳蚤市集|跳蚤市场|旧货市场|古董市场|市集|集市|夜市/.test(place || words)) return at("dayFleaMarket", /离开|走出/.test(words) ? "exit" : /休息|歇脚/.test(words) ? "rest" : /装袋|整理.*袋/.test(words) ? "packing" : /结账|付款/.test(words) ? "checkout" : /布料|布匹|织物/.test(words) ? "fabric" : "antiques");
    const occupation = !home && occupationLink(words, place, type);
    if (occupation) return occupation;
    if (/做饭|做菜|下厨|烹饪|煮饭|煮粥|煮汤|炒菜|备菜|做[早午晚]餐/.test(words) && !outside) return at("dayHome", "cook");
    if (type === "meal" || /吃饭|用膳|用餐|进餐|早餐|午餐|晚餐|早饭|午饭|晚饭/.test(words)) return at(campus ? "dayCampus" : dining, "meal");
    if (type === "coffee" || /喝茶|饮茶|品茶|喝咖啡|喝水|饮水|红茶|绿茶|热茶/.test(words)) return office ? at("dayOffice", "tea") : at(!home && /健身房|运动馆|健身中心/.test(text) ? "dayGym" : dining, !home && /健身房|运动馆|健身中心/.test(text) ? "water" : "tea");
    if (outside && /买|挑|吃|歇脚|面包|蛋糕|肉桂卷/.test(words)) return at("dayCafe", /歇脚|休息/.test(words) ? "rest" : "meal");
    if (!home) {
      if (/健身房|运动馆|健身中心/.test(text)) return at("dayGym", /离开|结束/.test(words) ? "exit" : /喝水|补水/.test(words) ? "water" : /休息|歇会/.test(words) ? "rest" : /储物|换衣|存包/.test(words) ? "storage" : /哑铃|力量|举铁/.test(words) ? "weights" : /拉伸|热身|舒展/.test(words) ? "stretch" : "treadmill");
      if (/超市|便利店|生鲜店/.test(text)) return at("dayMarket", /离开|走出/.test(words) ? "exit" : /收银|值班|上班|工作/.test(words) ? "cashier" : /装袋|整理.*袋/.test(words) ? "packing" : /结账|付款/.test(words) ? "checkout" : /购物篮|拿篮/.test(words) ? "basket" : /冷藏|冷柜|牛奶|酸奶/.test(words) ? "cold" : /日用品|货架|洗漱|纸巾/.test(words) ? "groceries" : "produce");
      if (/图书馆|阅览室/.test(text)) return at("dayLibrary", /归还|还书|借阅/.test(words) ? "return-book" : /挑书|找书|选书/.test(words) ? "choose-book" : /备考|自习|做题|复习|笔记/.test(words) ? "study-notes" : /窗边/.test(text) ? "window-reading" : "desk-reading");
      if (/实验室|实验台|实验数据|做实验|观测样品|观察样品/.test(text)) return at("dayLaboratory", /数据|分析|电脑/.test(words) ? "computer" : /记录|笔记/.test(words) ? "records" : /观察|观测|测量/.test(words) ? "observation" : /资料柜/.test(text) ? "archive" : "bench");
      if (/诊室|值班室|病历|接诊|查房|诊查/.test(text)) return at("dayClinic", /休息|歇会/.test(words) ? "rest" : /交班|交接/.test(words) ? "handoff" : /接诊|查房|诊查/.test(words) ? "bedside" : /器材|取物/.test(words) ? "equipment" : /值班/.test(words) ? "duty" : "casework");
      if (/创作工作室|画室|手作|绘画|画画|画稿|画架|画布|缝制|织布|雕刻/.test(text)) return at("dayStudio", /材料|取物/.test(words) ? "materials" : /作品|展示|看画/.test(words) ? "gallery" : /晾|晾干/.test(words) ? "drying" : /画架|画布/.test(text) ? "easel" : /手作|缝|织|雕刻/.test(words) ? "handcraft" : "drawing");
      if (/排练室|琴房|练功房|练舞|练琴|排练|排戏|练习乐器/.test(text)) return at("dayRehearsal", /离开|结束/.test(words) ? "exit" : /休息|歇会/.test(words) ? "rest" : /乐器.*取|取.*乐器|整理乐器|乐器架/.test(words) ? "instruments" : /乐谱|看谱|读谱|台词|背词/.test(words) ? "score" : /练琴|钢琴|电钢琴/.test(words) ? "piano" : /镜前|镜墙|看镜|检查站姿/.test(words) ? "mirror" : "practice");
      if (campus) return at("dayCampus", /离开|放学/.test(words) ? "exit" : /课间|休息|歇会/.test(words) ? "rest" : /书包|课本.*取|取.*课本|储物柜/.test(words) ? "lockers" : /板书|写.*黑板|黑板.*写/.test(words) ? "blackboard" : /备课|教案|批改/.test(words) ? "prepare" : /授课|讲课|讲解课程|给.*上课|教学/.test(words) ? "teach" : /自习|做题|复习|备考|作业/.test(words) ? "study" : /笔记|记录/.test(words) ? "notes" : /走廊|下课/.test(text) ? "corridor" : "listen");
      if (office) return at("dayOffice", /离开|下班/.test(words) ? "exit" : /茶水|喝水|喝茶|咖啡/.test(words) ? "tea" : /休息|歇会/.test(words) ? "rest" : /打印|复印|扫描/.test(words) ? "print" : /取.*文件|取.*资料|文件柜|资料柜|归档/.test(words) ? "files" : /汇报|演示|讲解|演讲/.test(words) && /会议|开会|投影|汇报/.test(text) ? "presentation" : /会议|开会|例会|组会|讨论会/.test(text) ? /笔记|记录/.test(words) ? "meeting-notes" : "meeting" : /手写|写.*笔记|整理文件|整理资料|纸本|记录|备课|教案|批改/.test(words) ? "notes" : "computer");
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
    // An old visual link can be structurally valid but name a different place.
    // Correct only an explicit venue, using the same read-only inference; vague
    // names and deliberately chosen positions continue to use their valid link.
    const venue=explicitVenue(source);
    if(link&&venue&&link.scene!==venue)return infer(source);
    return (link && at(link.scene, link.spot)) || infer(source);
  }
  function explicitVenue(source){
    const place=String(source.location||""),words=String(source.title||""),text=place||words;
    const venues=[[/面包房|面包店|烘焙店|甜品店|甜点店|餐厅|餐馆|食堂|咖啡店|咖啡馆|茶馆/,"dayCafe"],[/农场|农庄|田间|菜畦|菜园|种植园/,"dayFarm"],[/复古市集|跳蚤市集|跳蚤市场|旧货市场|古董市场|市集|集市|夜市/,"dayFleaMarket"],[/图书馆|阅览室/,"dayLibrary"],[/实验室|实验台/,"dayLaboratory"],[/诊室|病房|值班室/,"dayClinic"],[/健身房|运动馆|健身中心/,"dayGym"],[/超市|便利店|生鲜店/,"dayMarket"],[/车站|候车厅|站台|地铁站/,"dayStation"]];
    // A chef's workplace and a customer's meal share a venue name. Let the
    // existing profession resolver determine which physical set fits the task.
    for(const [pattern,map]of venues)if(pattern.test(text))return map==='dayCafe'?(occupationLink(words,place,source.type)?.map||map):map;
    return null;
  }
  root.CharDayLink = { validate, bindRow, publicRow, publicSchedules, instruction, schema, presentation };
})(globalThis);
