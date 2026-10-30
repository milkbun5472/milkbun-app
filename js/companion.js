// ============================================================
// 陪伴 · 桌宠（companion）—— 独立小 app ＋ 全局悬浮小人
// 选一个角色，他以庭院那一份小人（2K 表情）站在你屏幕上；
// 脸跟着他此刻的心情换（x_moods → 十张表情之一）。样貌在这里单独挑，跟庭院没关系
// （她 2026-09-26：「这个的外貌是要单独选和庭院没关系」）；换装面板用庭院那一份 DressControls。
// 画面在 iframe 里（three.js 只在那里加载），这边只负责挑人、算样貌和表情、摆悬浮窗。
// 设置存 x_companion：{ charId, float, pos, scale, autoFace, looks: { [charId]: look } }
// ============================================================
(function () {
  const KEY = "x_companion", BUILD = "fg-c485d06c678e8f5c";
  const load = () => Object.assign({ charId: "", float: false, pos: null, scale: 1, autoFace: true, looks: {} }, loadJSON(KEY, {}) || {});
  const save = v => saveJSON(KEY, v);
  // 心情 → 表情。心情是模型写的自由中文（x_moods[charId].label），按字认；认不出就是「平常」。
  // 顺序有意义：先认强烈的，再认温和的（「又委屈又开心」按委屈算）。
  // 她 2026-09-26「每个脸的心情词典多加点」：把 mood-label.js 那张英→中表里会出现的词都对上了一格。
  // ⚠️最先认「不开心／不高兴」这类带否定的：原来它们里面有「开心」两个字，被认成了开心。
  const FACE_RULES = [
    ["gloomy", /不(?:开心|高兴|快乐|愉快|爽|舒服)|没(?:心情|劲)|闷闷不乐|提不起/],
    ["irritated", /生气|火气|烦|恼|不耐|气鼓|暴躁|炸毛|醋|愤|(?<!花)怒|不爽|嫌弃|郁闷|憋屈|挫败|抓狂|咬牙|气急败坏|恼羞成怒|火冒三丈|不服|较劲|吃味|酸溜溜|闹别扭|别扭|赌气|冷脸|没好气|白眼|不满|窝火|来气|憋闷/],
    ["sad", /难过|委屈|伤心|哭|心碎|想哭|酸涩|受伤|失望|心疼|愧疚|内疚|自责|心酸|哽|心痛|痛苦|绝望|落寞|黯然|眼眶|鼻酸|泪|憔悴|悲|哀|凄|难受|揪心/],
    ["gloomy", /低落|失落|疲惫|累|困(?!惑)|倦|思念|想念|寂寞|孤单|孤独|闷|丧|emo|惆怅|怅|无聊|焦虑|担心|担忧|紧张|不安|忐忑|心事|沉默|沮丧|茫然|迷茫|空落|恹恹|蔫|没精神|无精打采|心不在焉|患得患失|七上八下|魂不守舍|郁|消沉|颓|乏|发愁|愁|犯困|心累/],
    ["surprise", /惊讶|意外|错愕|愣|懵|吓|震惊|害怕|慌|困惑|疑惑|不解|诧异|呆|抓耳挠腮|手足无措|不知所措|局促|尴尬|窘|手忙脚乱|心虚|目瞪口呆|哑口无言|发蒙|一怔|怔|结巴|语塞|无措/],
    ["amazed", /激动|兴奋|期待|惊喜|雀跃|心动|哇|好奇|感动|迫不及待|跃跃欲试|热血|振奋|蠢蠢欲动|心痒|心花怒放|眼前一亮|上头|心潮澎湃|热切|按捺不住|跃跃|亢奋|燃/],
    ["proud", /得意|骄傲|傲娇|自豪|嘚瑟|神气|臭屁|胜利|自信|成就感|坚定|得逞|坏笑|调皮|狡黠|逞强|洋洋得意|扬眉吐气|胸有成竹|游刃有余|挑衅|戏谑|促狭|玩味|使坏|捉弄|逗弄|得瑟|痞|挑眉|贱兮兮/],
    ["happy", /开心|高兴|快乐|愉悦|愉快|欢喜|喜悦|欣喜|乐|笑|雀跃|轻快|畅快|爽快|痛快|好心情|眉开眼笑|喜滋滋|乐呵|美滋滋|欢快|窃喜|心情好|好笑|开怀|嘿嘿|哈哈|舒心/],
    ["cozy", /温暖|暖|幸福|甜|满足|惬意|安心|踏实|舒服|温柔|柔软|亲昵|爱意|感激|感恩|依恋|害羞|羞|撒娇|黏|宠溺|被爱|珍惜|心软|宠|疼爱|眷恋|缱绻|温存|贴心|甜蜜|悸动|脸红|羞涩|腼腆|乖|软|恋恋|舍不得|想贴|黏糊/],
    ["relax", /平静|放松|平和|悠闲|慵懒|淡定|安稳|宁静|安宁|如释重负|释然|松了口气|专注|若有所思|沉思|发呆|懒洋洋|随意|闲适|悠然|自在|从容|平稳|沉稳|安静|餍足|松弛|懒|佛系|无所谓|漫不经心|随性|困意|惺忪|迷糊|恍惚|走神|出神/]
  ];
  const FACE_ZH = { default: "平常", happy: "开心", cozy: "惬意", relax: "放松", surprise: "惊讶", amazed: "哇", proud: "得意", gloomy: "低落", sad: "难过", irritated: "不耐烦" };
  function faceForMood(label) {
    const s = String(label || "");
    for (const [face, re] of FACE_RULES) if (re.test(s)) return face;
    return "default";
  }
  function moodLabel(moods, id) {
    const mo = moods && moods[id];
    if (!mo || !mo.label) return "";
    if (window.MoodLabel && window.MoodLabel.settle) { try { return window.MoodLabel.settle(mo.label, mo.ts, Date.now()).label || mo.label; } catch (_) {} }
    return String(mo.label);
  }
  const taOf = c => (typeof CharacterPronoun !== "undefined" && c) ? CharacterPronoun.ta(c) : "TA";
  function lookFor(char, moods, cfg = load()) {
    if (!char) return {};
    const own = (cfg.looks || {})[char.id] || {};
    const face = cfg.autoFace === false ? (own.face || "default") : faceForMood(moodLabel(moods, char.id));
    return Object.assign({}, own, { face });
  }
  function petMessage(char, moods, cfg) {
    return char ? { type: "pet-look", characterId: String(char.id), ta: taOf(char), mood: faceForMood(moodLabel(moods, char.id)), look: lookFor(char, moods, cfg) } : null;
  }
  // 只记小人的睡醒状态；角色作息仍由 App 的 sleepPhaseOf 唯一判断。
  const LIFE_KEY = "x_companionLife";
  function lifeStep(previous, event, now = Date.now()) {
    const p = previous || {}, n = Object.assign({ sleeping: false, phase: "", morning: "", wakeAt: 0, wakeSeen: 0, sleepAt: 0, until: 0, rev: 0 }, p);
    const sleep = () => { if (!n.sleeping) { n.sleeping = true; n.sleepAt = now; } };
    const wake = () => { if (n.sleeping) { n.sleeping = false; n.wakeAt = now; } };
    if (event.kind === "sleep") sleep();
    else if (event.kind === "wake") wake();
    else if (event.kind === "seen" && event.wakeAt === n.wakeAt) n.wakeSeen = event.wakeAt;
    else if (event.kind === "clock") {
      const r = event.routine || {};
      if (r.phase === "asleep" && (n.phase !== "asleep" || now >= n.until)) { sleep(); n.until = Number(r.sleepUntil) > now ? Number(r.sleepUntil) : now + 12 * 3600000; }
      if (r.phase !== "asleep" && n.phase === "asleep") wake();
      n.phase = r.phase || "awake";
      if (r.clock && r.minute >= 360 && r.minute < 720 && r.day && n.morning !== r.day) {
        n.morning = r.day;
        // 刚说完要睡的早晨小憩照常睡；隔夜回来才揉眼醒来。
        if (n.phase !== "asleep" && (!n.sleepAt || now - n.sleepAt > 3600000)) { n.sleeping = false; n.wakeAt = now; }
      }
    }
    if (JSON.stringify(n) !== JSON.stringify(Object.assign({ sleeping: false, phase: "", morning: "", wakeAt: 0, wakeSeen: 0, sleepAt: 0, until: 0, rev: 0 }, p))) n.rev++;
    return n;
  }
  const lifeRead = id => (loadJSON(LIFE_KEY, {}) || {})[id] || null;
  function lifeUpdate(id, event) {
    if (!id) return null;
    const all = loadJSON(LIFE_KEY, {}) || {}, previous = all[id], next = lifeStep(previous, event);
    if (JSON.stringify(previous) !== JSON.stringify(next)) {
      saveJSON(LIFE_KEY, Object.assign({}, all, { [id]: next }));
      window.dispatchEvent(new CustomEvent("companion-life", { detail: { charId: id } }));
    }
    return next;
  }
  function usePetLife(char, props) {
    const id = char && char.id, latest = useRef(null); latest.current = { char, props };
    const [state, setState] = useState(() => ({ id, value: id ? lifeRead(id) : null }));
    useEffect(() => {
      if (!id) { setState({ id, value: null }); return; }
      const read = () => setState({ id, value: lifeRead(id) });
      const tick = () => { if (document.hidden || latest.current.props.hidden) return;
        const { char, props } = latest.current;
        if (typeof props.companionRoutineFor === "function") lifeUpdate(id, { kind: "clock", routine: props.companionRoutineFor(char) });
        read();
      };
      const changed = e => { if (e.detail?.charId === id) read(); };
      tick(); const timer = setInterval(tick, 30000);
      window.addEventListener("companion-life", changed); document.addEventListener("visibilitychange", tick);
      return () => { clearInterval(timer); window.removeEventListener("companion-life", changed); document.removeEventListener("visibilitychange", tick); };
    }, [id, props.hidden]);
    return state.id === id && state.value ? Object.assign({ characterId: String(id) }, state.value) : null;
  }
  // 一只 iframe 画面：加载完成（pet-ready）或样貌变了，就把消息再送一次
  // 你在干嘛（她 2026-09-26「点他有反应／跟着时间／看你在哪个页面」）：哪一页、有没有放歌、多久没碰手机。
  // 只送这三样事实，怎么反应由小人自己定（apps/companion/pet.mjs）。
  const IDLE_MS = 3 * 60 * 1000;
  let lastTouch = Date.now(), returnSeq = 0, awayAt = 0;
  const presenceListeners = new Set();
  const presence = () => ({ idle: Date.now() - lastTouch >= IDLE_MS, returnSeq });
  function markActive() { const returning = Date.now() - lastTouch >= IDLE_MS; lastTouch = Date.now(); if (returning) { returnSeq++; presenceListeners.forEach(f => f()); } }
  ["pointerdown", "keydown", "wheel"].forEach(k => window.addEventListener(k, markActive, { passive: true, capture: true }));
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => {
    if (document.hidden) awayAt = Date.now();
    else { if (awayAt && Date.now() - awayAt >= IDLE_MS) lastTouch = Math.min(lastTouch, awayAt); awayAt = 0; markActive(); }
  });
  function useIdle() {
    const [state, setState] = useState(presence);
    useEffect(() => { const update = () => setState(p => { const n = presence(); return p.idle === n.idle && p.returnSeq === n.returnSeq ? p : n; });
      presenceListeners.add(update); update(); const id = setInterval(update, 15000);
      return () => { clearInterval(id); presenceListeners.delete(update); }; }, []);
    return state;
  }
  function usePetContext(props, screen, char) {
    const life = usePetLife(char, props);
    const p = useIdle(), typing = useTyping(), [weather, setWeather] = useState(null), geo = props.geo;
    useEffect(() => {
      let stop = () => {}, selected = "";
      const select = () => {
        const places = typeof weatherPlaceList === "function" ? weatherPlaceList(geo, props.characters, props.worlds) : [];
        let pick = "me";try { pick = localStorage.getItem("x_weatherPlace") || "me"; } catch (_) {}
        const place = places.find(p => p.key === pick) || places[0], id = JSON.stringify(place);
        if (selected === id) return;selected = id;stop();setWeather(null);
        if (typeof watchWeatherCurrent === "function") stop = watchWeatherCurrent(place, setWeather);
      };
      select();window.addEventListener("weather-place", select);
      return () => { stop();window.removeEventListener("weather-place", select); };
    }, [geo && geo.lat, geo && geo.lng, props.characters, props.worlds]);
    return { screen, music: !!props.music, idle: p.idle, returnSeq: p.returnSeq, typing, weather, life };
  }
  // Observe the real message arrays after delivery. Historical imports and edits are not arrivals.
  function makeMessageWatch() {
    let who = null; const sources = new Map(), seen = new Set();
    return (charId, chats, groups, now = Date.now()) => {
      const freshCharacter = who !== charId; if (freshCharacter) { who = charId; sources.clear(); seen.clear(); }
      let arrived = false;
      const rows = [["chat", (chats || {})[charId] || []], ...Object.entries(groups || {}).map(([id, messages]) => ["group:" + id, messages])];
      for (const [key, messages] of rows) {
        if (sources.get(key) === messages) continue; sources.set(key, messages);
        for (const m of messages.slice(-32)) {
          if (!m || !["assistant", "char"].includes(m.role) || (key !== "chat" && m.senderId !== charId)) continue;
          const id = key + ":" + (m.id || m.mid || [m.turnId, m.ts, m.kind, m.role, m.senderId].join("|"));
          if (!freshCharacter && !seen.has(id) && Number(m.ts) >= now - 10000 && Number(m.ts) <= now + 60000) arrived = true;
          seen.add(id);
        }
      }
      while (seen.size > 256) seen.delete(seen.values().next().value);
      return arrived;
    };
  }
  function useMessageNotice(charId, props, frame) {
    const watch = useRef(null); if (!watch.current) watch.current = makeMessageWatch();
    useEffect(() => { const arrived = watch.current(charId, props.chats, props.groupChats);
      const w = frame.current && frame.current.contentWindow;
      if (arrived && w && !props.hidden && !document.hidden) w.postMessage({ type: "pet-notice" }, "*");
    }, [charId, props.chats, props.groupChats, props.hidden]);
  }
  // 戳一戳时让他顺手说一句（她 2026-09-27）：开关默认关——每一句都是一次 API 调用。
  // ⚠️走 runProbe({voice:true})：人设全文／心情／好感／印象卡／记忆／反八股是 buildBundle 白给的一整份
  //   （施工规则/four-surfaces-same-context.md：别自己拼 sys）。料全在 system，user 只留一句触发（runProbe 自己就是这个形状）。
  // 连戳不连发：停手 1.2 秒才合成一次；两次之间至少隔 15 秒，其间的戳只换动作不说话。
  const POKE_ZH = { tap: "戳了你一下", double: "连戳了你两下", many: "一直在戳你", lift: "把你拎起来晃了晃又放下" };
  const voiceOn = () => { try { return localStorage.getItem("x_fairyGardenVoice") === "1"; } catch (e) { return false; } };
  async function speak(line, voiceId, s) {
    try { if (s.audio) { s.audio.pause(); s.audio = null; }
      const blob = await ttsSpeak(line, voiceId), url = URL.createObjectURL(blob), a = new Audio(url); s.audio = a;
      a.onended = a.onerror = () => { try { URL.revokeObjectURL(url); } catch (_) {} if (s.audio === a) s.audio = null; };
      await a.play(); } catch (e) {/* 念不出来就只看字 */} }
  // 为什么每次戳都是同一句（她 2026-09-27）：每一枪都是全新的、料几乎一样——同一份人设、同一个心情、同一句「她戳了你」，
  //   模型就每次回到它的先验中心。照 施工规则/bans-make-it-dumber.md：不加「不许重复」这种判决，
  //   ① 给真的不同的料（今天第几次、隔了多久、之前说过哪几句——长期记着当 avoid 单子，越用越不重样）；
  //   ② 掷几条互相独立的轴、不掷答案，每条轴都留一格「你自己定」。地板是代码的，天花板是模型的。
  const POKE_KEY = "x_companionPokes";
  // 本地的「今天」，跟日程同一支（原来 toISOString＝UTC，凌晨到早上八点算成前一天）
  const today = () => window.ScheduleClock.deviceDayKey(new Date());
  function pokeLog(id) {
    let all = {}; try { all = JSON.parse(localStorage.getItem(POKE_KEY) || "{}") || {}; } catch (e) {}
    const r = all[id] || {}; return { lines: Array.isArray(r.lines) ? r.lines.slice(-12) : [], count: r.day === today() ? (r.count || 0) : 0, lastAt: r.lastAt || 0 };
  }
  function notePoke(id, line) {
    let all = {}; try { all = JSON.parse(localStorage.getItem(POKE_KEY) || "{}") || {}; } catch (e) {}
    const r = pokeLog(id); all[id] = { lines: r.lines.concat(line).slice(-12), day: today(), count: r.count + 1, lastAt: Date.now() };
    try { localStorage.setItem(POKE_KEY, JSON.stringify(all)); } catch (e) {}
  }
  // 原来这儿有一张「手感」轴（冲着谁说、多长、接不接茬），每次掷一组给他（她 2026-10-25：「不要给方向」）——撤了，只告诉他她戳了他
  // ⚠️节流是【全局一份】，不是每个小人各一份（她 2026-09-29 转读者：「戳了好多下但只说了一句话，
  //   看使用日志多了三次消耗」）：陪伴页和悬浮那只各自记着「上次说话的时间」，互相不认识，
  //   两边一起戳就是两份额度。
  const POKE_GATE = { busy: false, last: 0 };
  // 没按 JSON 交回来也捡得回那一句（她 2026-09-29：「戳一下这种能不能搞强一点的兜底」）：
  //   ① 半截 JSON 里的 "line":"…"；② 去掉代码块、引号、「我：」这类前缀之后的第一行正经话。
  //   捡出来太长（像一段分析）或者像提示词复读，就当没捡到。
  function pokeSalvage(raw) {
    const s = String(raw || "");
    const m = s.match(/"line"\s*:\s*"((?:[^"\\]|\\.)*)/);
    let line = m ? m[1].replace(/\\n/g, " ").replace(/\\"/g, "\"") : "";
    if (!line) {
      line = s.replace(/```[a-z]*|```/gi, "").split(/\n+/).map(x => x.trim())
        .map(x => x.replace(/^[-*·\s]*/, "").replace(/^(?:line|回复|他说|我)\s*[:：]\s*/i, "").replace(/^["「『“]+|["」』”]+$/g, "").trim())
        .find(x => x && !/^[{}\[\]]/.test(x) && !/【|】/.test(x)) || "";
    }
    line = line.trim();
    // 被戳时脱口而出的一句不会超过四十个字；带「应该／考虑到／回应她」的是它在想怎么回，不是回
    // 不按字数丢（她 2026-09-29：「一句话超 40 字不要丢，都花了钱的，而且有些人就是话痨」）——
    //   只挡「它在想怎么回」那一种；三百字的上限只防它把整段提示词吐回来
    return line && line.length <= 300 && !/应该|考虑到|回应她|按照自己/.test(line) ? { line: line } : null;
  }
  function usePokeTalk(char, props, on) {
    const [say, setSay] = useState("");
    const st = useRef({ timer: 0, pending: null, hide: 0 });
    useEffect(() => () => { clearTimeout(st.current.timer); clearTimeout(st.current.hide); }, []);
    const arm = len => { const s = st.current; clearTimeout(s.hide); s.hide = setTimeout(() => setSay(""), Math.min(30000, 3500 + len * 200)); };
    const fire = async () => {
      const s = st.current, info = s.pending; s.pending = null;
      if (!info || POKE_GATE.busy || !char || Date.now() - POKE_GATE.last < 15000) return;
      // 走后台线路（她 2026-09-29：「陪伴消耗移动到后台 API 便宜一点」）；没配后台线路才退回这个角色自己那条
      const p = props.bgActive || (props.apiFor ? props.apiFor(char.id) : null), ctx = props.ctxFor ? props.ctxFor(char) : null;
      if (!p || !ctx || typeof runProbe !== "function") return;
      POKE_GATE.busy = true; POKE_GATE.last = Date.now();
      try {
        const hr = new Date().getHours(), uName = (props.profile && props.profile.name) || "她";
        const log = pokeLog(char.id), gap = log.lastAt ? Math.round((Date.now() - log.lastAt) / 60000) : null;
        // once：这一句就一行字，没解析出来就算了，不自动再打一枪（原来一次戳最多会调三次）
        const d = await runProbe(p, ctx, { voice: true, tag: "陪伴", once: true, salvage: pokeSalvage,
          instruction: "你此刻是" + uName + "手机屏幕上陪着她的一个小人。她刚才" + (POKE_ZH[info.kind] || POKE_ZH.tap) + "。现在是" + hr + "点。"
            // 第几次只在连着戳的时候提（隔得久了提「今天第十次」只会把他演成被戳烦了）
            + (gap != null && gap < 3 ? "她刚刚才戳过你一下，这是又一下。" : "") + "\n"
            + "按你自己的性子、你此刻的心情，顺手回她——像被戳到时脱口而出的那种，长短跟着你这个人平时说话走。\n"
            // 不再掷「手感」（冲着谁说、接不接茬……）：只说她戳了你，怎么回由他（她 2026-10-25：「不要给方向」）
            // 说过的原话照旧摆着，免得他每次都说同一句（她 2026-10-25：「之前一直重复」）
            + (log.lines.length ? "【你之前被她戳时说过的】" + log.lines.map(x => "「" + x + "」").join(" ") + "——那些已经说过了，这是新的一下，说你此刻会说的那句。\n" : "")
            + (typeof REGISTER_FOLLOWS_SCENE !== "undefined" ? "\n" + REGISTER_FOLLOWS_SCENE : ""),
          schemaHint: "{\"line\":\"你脱口而出的那一句\"}" });
        const line = String((d && d.line) || "").trim().slice(0, 600);
        if (line) notePoke(char.id, line);
        if (line) { setSay(line); arm(line.length);
          // 念出来（她 2026-09-27）：和庭院、列车同一个开关 x_fairyGardenVoice；TA 没选声音就只冒字
          if (voiceOn() && char.voiceId && typeof ttsSpeak === "function") speak(line, char.voiceId, s); }
      } catch (e) {
        // 失败要说一声（她 2026-09-29：「任何时候生成东西好了或者失败都要有 toast 提醒」）——
        //   原来这里是静默吞掉，于是花了钱、他却一句话没说，她只能去翻使用日志才知道
        props.toast && props.toast(characterText(char, "他这一句没说出来：") + String((e && e.message) || e || "").replace(/\s+/g, " ").slice(0, 60), 5000);
      }
      finally { POKE_GATE.busy = false; }
    };
    const onPoke = info => { if (!on) return; const s = st.current; s.pending = info; clearTimeout(s.timer); s.timer = setTimeout(fire, 1200); };
    // 气泡挂多久跟着字数走：长的多挂一会儿，最多半分钟；她按着、滑着气泡的时候重新计时，不会读到一半没了
    const sayRef = useRef(""); sayRef.current = say;
    const hold = () => { if (sayRef.current) arm(sayRef.current.length); };
    return [say, onPoke, hold];
  }
  // 滚动气泡（她 2026-09-29：「做个滚动气泡这样如果很长不会撑爆气泡框」）：
  // 最多撑到六行左右，再长就在气泡里上下滑。小人是浮在屏幕上的，大气泡会把底下的聊天整片盖住。
  // ⚠️气泡上的手势不许冒到外面：悬浮那只整块是拖动区，在气泡里滑会被当成拖小人。
  function Bubble({ text, style, onHold }) {
    if (!text) return null;
    const stop = e => { e.stopPropagation(); if (onHold) onHold(); };
    return h("div", { "data-wk": "compbubble", onPointerDown: stop, onPointerMove: e => e.stopPropagation(), onPointerUp: e => e.stopPropagation(), onTouchStart: stop, onScroll: stop,
      style: Object.assign({ position: "absolute", left: "50%", transform: "translateX(-50%)", maxWidth: 220, width: "max-content", maxHeight: "7.6em", overflowY: "auto",
      WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", touchAction: "pan-y", whiteSpace: "pre-wrap", wordBreak: "break-word", padding: "6px 10px", borderRadius: 12,
      background: "rgba(255,250,240,.96)", boxShadow: "0 2px 10px rgba(75,60,38,.2)", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.5, color: "#4a3a2a", pointerEvents: "auto", zIndex: 2 }, style) }, text);
  }
  function PetFrame({ mode, msg, ctx, style, onOpen, onPoke, frameRef, onStatus, onAct, reloadKey }) {
    const own = useRef(null), ref = frameRef || own, pokeRef = useRef(onPoke);
    pokeRef.current = onPoke;
    const key = JSON.stringify(msg);
    useEffect(() => {
      const send = () => { const w = ref.current && ref.current.contentWindow; if (w && msg) w.postMessage(msg, "*"); if (w && ctx) w.postMessage(Object.assign({ type: "pet-ctx" }, ctx), "*"); };
      send();
      const on = e => {
        if (!ref.current || e.source !== ref.current.contentWindow || !e.data) return;
        if (e.data.type === "pet-ready") { send(); if (onStatus) onStatus({ state: "ready" }); if (e.data && ref.onReady) ref.onReady(); }
        // 5MB 的小人第一次要真下一遍：有进度条才知道是在等、不是坏了
        if (e.data.type === "pet-progress" && onStatus) onStatus({ state: "loading", pct: Number(e.data.pct) || 0 });
        // 下不来要说人话 + 给一条路（原来是永远挂在「小人还在来的路上…」）
        if (e.data.type === "pet-failed" && onStatus) onStatus({ state: "failed", why: String(e.data.why || "") });
        if (e.data.type === "pet-act" && onAct) onAct(String(e.data.kind || ""));
        if (e.data.type === "pet-open" && onOpen) onOpen();
        if (e.data.type === "pet-wake" && msg && String(e.data.characterId) === msg.characterId) { markActive(); lifeUpdate(msg.characterId, { kind: "wake" }); }
        if (e.data.type === "pet-woke" && msg && String(e.data.characterId) === msg.characterId) lifeUpdate(msg.characterId, { kind: "seen", wakeAt: Number(e.data.wakeAt) });
        if (e.data.type === "pet-poke") markActive();
        if (e.data.type === "pet-poke" && pokeRef.current) pokeRef.current({ kind: String(e.data.kind || "tap"), count: Number(e.data.count) || 1 });
      };
      window.addEventListener("message", on);
      return () => window.removeEventListener("message", on);
    }, [key, JSON.stringify(ctx || null), reloadKey]);
    return h("iframe", { key: reloadKey || 0, ref, title: "陪伴小人", src: "apps/companion/index.html?mode=" + mode + "&v=" + BUILD + (reloadKey ? "&retry=" + reloadKey : ""),
      allowTransparency: "true", style: Object.assign({ border: 0, background: "transparent", display: "block" }, style) });
  }
  // 他这会儿在做什么：十种心情各一套动作，界面上不说一句，用户只当是随机待机。
  const ACT_ZH = { "emotion-headlook":"抬眼看看摸头的你", "emotion-headnest":"慢慢靠近你的手心", "emotion-tidy":"站稳后理理衣服和袖口", "emotion-catchrain":"撑着伞伸手接雨", "emotion-catchsnow":"捧着雪花看它慢慢化掉", "emotion-warmhands":"搓搓手哈一口暖气", "emotion-wipesweat":"抬手擦擦额头的汗", "emotion-shade":"抬手遮住阳光", "emotion-wind":"护住头发缩缩肩", "emotion-thunder":"雷雨天捂住耳朵", "emotion-rainclose":"雨停了，收起小伞", "emotion-raindry":"轻轻拍拍身上的水珠", "emotion-peace":"举起圆手套比耶", "emotion-applause":"拍拍手为你鼓掌", "emotion-sing":"晃着脑袋轻轻哼歌", "emotion-selfie":"举起手机和你自拍", "emotion-ears":"捂住耳朵晃晃脑袋", "emotion-cold":"搓着双手冷得轻轻发抖", "emotion-fan":"抬手给自己扇扇风", "emotion-daydream":"望向一边安静出神", "emotion-umbrella":"撑起小伞陪你看雨", 'emotion-heart':'双手围成心形给你看', 'emotion-thumb':'朝你竖起大拇指', 'emotion-wink':'朝你眨了一下眼', 'emotion-tongue':'调皮地吐吐舌头', 'emotion-cry':'抬手抹眼泪再慢慢缓过来', 'emotion-tilt':'歪着脑袋看你', 'emotion-poke':'伸出圆手套朝你脸边轻戳', 'emotion-pinch':'伸手轻轻捏捏你的脸', 'emotion-lie':'躺下来歇一会儿再起身', 'emotion-prone':'趴下来托着脸看你', 'emotion-phone':'低头拿着手机点点打字', 'emotion-eat':'拿起小饼干咬一口嚼嚼', 'emotion-hips':'叉着腰得意地看你', 'emotion-selfhug':'抱住自己轻轻晃', 'emotion-peekaboo':'捂住眼睛又张开手看你', 'emotion-sneeze':'掩住鼻口打了个喷嚏', 'emotion-gift':'双手把小礼盒递给你', 'emotion-sign':'举起写着想你的小纸牌', 'emotion-cheeks':'双手捧着脸歪头看你', 'emotion-plead':'双手合十拜托你', 'emotion-crossarms':'抱着双臂等你回答', 'emotion-scratch':'挠了挠后脑勺', 'emotion-rubeyes':'低头揉揉眼睛又看向你', 'emotion-flower':'把一朵小花递到你面前', 'emotion-kiss':'把手停在嘴前送你一个飞吻', 'emotion-giggle':'捂着嘴偷偷笑', 'emotion-listen':'拢着手侧耳听你说', 'emotion-promise':'拍拍胸口向你保证', 'emotion-cheer':'举起双手给你加油', 'emotion-refuse':'摇摇头又摆摆手', 'emotion-chin':'托着下巴安静陪你', 'emotion-headpat':'低头靠近你的手又抬眼看你', 'emotion-show':'转身展示新衣服', 'emotion-five-left':'抬起手等你击掌', 'emotion-five-right':'抬起手等你击掌', 'emotion-clap-left':'和你击了个掌', 'emotion-clap-right':'和你击了个掌', 'emotion-dodge-left':'躲开你的手又看回来', 'emotion-dodge-right':'躲开你的手又看回来', 'emotion-beckon':'招手示意你靠近', 'emotion-dance':'左右摆身跳小舞', 'emotion-bow':'欠身向你致意', 'emotion-shrug':'摊开手耸耸肩', 'emotion-peek':'看看两边又望向你', 'emotion-default':'抬手问候你', 'emotion-happy':'笑着向你招手', 'emotion-amazed':'举起双手欢呼', 'emotion-cozy':'张开手想抱抱你', 'emotion-relax':'舒展开双臂', 'emotion-surprise':'缩了一下又凑过来看', 'emotion-proud':'挺起胸等你夸', 'emotion-gloomy':'叹口气又望向你', 'emotion-sad':'低头后朝你伸出手', 'emotion-irritated':'别过身又偷偷看你',  wave: "在跟你招手", stretch: "在伸懒腰", tea: "在喝茶", read: "在看书", sit: "坐下了",
    hop: "高兴得蹦了一下", jolt: "被你吓了一跳", nod: "在点头", sigh: "叹了口气", stomp: "在跺脚",
    turn: "扭过头去不理你", shy: "有点害羞", look: "回头看你", yawn: "在打哈欠", wake: "刚被你叫醒",
    land: "被你放下来了", held: "被你拎在手上晃", sleep: "睡着了" };

  function Companion(props) {
    const chars = props.characters || [];
    const [cfg, setCfg] = useState(load);
    const [styles, setStyles] = useState(null);
    const [, bump] = useState(0);
    const frame = useRef(null);
    useChatAct(cfg.charId, frame);
    useMessageNotice(cfg.charId, props, frame);
    frame.onReady = () => bump(n => n + 1);   // 小人加载好，换装面板才有现值可读
    useEffect(() => { fetch("apps/fairy-garden/doll.json?v=" + BUILD).then(r => r.json()).then(setStyles).catch(() => {}); }, []);
    const set = patch => setCfg(c => { const n = Object.assign({}, c, patch); save(n); if (window.__companionChanged) window.__companionChanged(n); return n; });
    const char = chars.find(c => c.id === cfg.charId) || chars[0] || null;
    useEffect(() => { if (char && char.id !== cfg.charId) set({ charId: char.id }); }, [char && char.id]);
    const mood = char ? moodLabel(props.moods, char.id) : "";
    const auto = cfg.autoFace !== false;
    const own = char ? ((cfg.looks || {})[char.id] || {}) : {};
    const face = auto ? faceForMood(mood) : (own.face || "default");
    const ctx = usePetContext(props, "companion", char);
    const [say, onPoke, holdSay] = usePokeTalk(char, props, !!cfg.pokeTalk);
    // 小人下到哪儿了 / 下不来了 / 这会儿在做什么
    const [petState, setPetState] = useState({ state: "loading", pct: 0 });
    const [actNow, setActNow] = useState("");
    const [retry, setRetry] = useState(0);
    const pet = () => { const w = frame.current && frame.current.contentWindow; return w && w.PetGame ? w.PetGame : null; };
    const pushLook = patch => { if (!char) return; const g = pet(); const cur = (load().looks || {})[char.id] || {};
      const next = g ? g.merge(cur, patch) : Object.assign({}, cur, patch);
      const extra = patch && patch.face ? { autoFace: false } : {};   // 在面板里点了表情＝我来选
      set(Object.assign({ looks: Object.assign({}, load().looks || {}, { [char.id]: next }) }, extra)); };
    // 换装控件住在小世界那组里（2026-10-18 瘦身后点进小世界才加载）：陪伴页一打开就顺手装上，装好再画一次
    const [, setDressReady] = useState(0);
    useEffect(() => { if (!window.GardenDressControls && window.LazyMods) window.LazyMods.load("garden").then(() => setDressReady(n => n + 1), () => {}); }, []);
    const Dress = window.GardenDressControls;
    const chip = (on, label, onClick, key) => h("button", { "data-wk": "compchip", "data-on": on ? "1" : "0", key, onClick, className: "active:opacity-70",
      style: { flexShrink: 0, padding: "7px 14px", borderRadius: 16, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))",
        border: "1px solid " + (on ? "#8a6a4b" : "rgba(138,106,75,.25)"), background: on ? "#8a6a4b" : "rgba(255,255,255,.6)", color: on ? "#fff" : "#6b5440" } }, label);
    return h("div", { "data-wk": "comppage", className: "h-full flex flex-col", style: { background: "linear-gradient(180deg,#f6efe4,#ece2d2)" } },
      h(Head, { zh: "陪伴", onBack: props.onBack, bg: "transparent" }),
      h("div", { "data-wk": "compcharbar", style: { display: "flex", gap: 8, overflowX: "auto", padding: "4px 16px 8px", flexShrink: 0 } },
        chars.map(c => chip(char && c.id === char.id, c.remark || c.name, () => set({ charId: c.id }), c.id))),
      !char ? h("div", { "data-wk": "compempty", style: { padding: 24, fontFamily: F_BODY, color: "#8a7a5e" } }, "还没有角色。先去建一个，再回来让他陪着你。") :
      h(React.Fragment, null,
        h("div", { "data-wk": "compstage", style: { height: "42vh", flexShrink: 0, position: "relative" } },
          h(Bubble, { text: say, onHold: holdSay, style: { top: 8 } }),
          h(PetFrame, { mode: "full", frameRef: frame, onPoke, msg: petMessage(char, props.moods, cfg), ctx,
            onStatus: setPetState, onAct: setActNow, reloadKey: retry, style: { width: "100%", height: "100%" } }),
          // 他还没画出来的时候屏幕是空的：第一次要下 5MB 的小人，网差就更久。
          // 原来这里什么都不说，卡住和正在下一个样（2026-09-26 发公共版前补的）。
          petState.state !== "ready" ? h("div", { "data-wk": "compstatus", style: { position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 10, fontFamily: F_BODY, color: "#8a7a5e", textAlign: "center", padding: 20 } },
            petState.state === "failed"
              ? h(React.Fragment, null,
                  h("div", { style: { fontSize: "calc(13px * var(--app-fs, 1))" } }, "小人没能来 · 网络不太好的时候会这样"),
                  h("button", { "data-wk": "compretry", onClick: () => { setPetState({ state: "loading", pct: 0 }); setRetry(n => n + 1); }, className: "active:opacity-70",
                    style: { minHeight: 40, padding: "0 20px", borderRadius: 12, background: "#8a6a4b", color: "#fff", border: "none", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } }, "再试一次"))
              : h(React.Fragment, null,
                  h("div", { style: { fontSize: "calc(13px * var(--app-fs, 1))" } }, "小人在来的路上… " + (petState.pct || 0) + "%"),
                  h("div", { style: { width: 140, height: 4, borderRadius: 2, background: "rgba(138,106,75,.18)", overflow: "hidden" } },
                    h("div", { style: { width: (petState.pct || 0) + "%", height: "100%", background: "#8a6a4b", transition: "width .25s" } })),
                  h("div", { style: { fontSize: "calc(11px * var(--app-fs, 1))", color: "#a89a80" } }, characterText(char, "第一次要把他整个人下下来，之后就快了")))) : null),
        h("div", { "data-wk": "comppanel", className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "8px 20px", paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 24px)", fontFamily: F_BODY } },
          h("div", { "data-wk": "compmood", style: { fontSize: "calc(12.5px * var(--app-fs, 1))", color: "#6b5440", lineHeight: 1.8 } },
            (char.remark || char.name) + " 现在" + (mood ? "的心情是「" + mood + "」" : "没有记下心情") + "，脸上是「" + FACE_ZH[face] + "」。"
            + (ACT_ZH[actNow] ? "他" + ACT_ZH[actNow] + "。" : "")),
          h("div", { style: { display: "flex", gap: 8, margin: "8px 0 12px" } },
            chip(auto, "表情跟着心情", () => set({ autoFace: true }), "a"), chip(!auto, "我来选表情", () => set({ autoFace: false }), "b")),
          h("button", { "data-wk": "compfloat", "data-on": cfg.float ? "1" : "0", onClick: () => set({ float: !cfg.float }), className: "active:opacity-70",
            style: { width: "100%", minHeight: 46, borderRadius: 14, fontSize: "calc(14px * var(--app-fs, 1))", marginBottom: 18,
              background: cfg.float ? "#8a6a4b" : "rgba(255,255,255,.7)", color: cfg.float ? "#fff" : "#6b5440", border: "1px solid rgba(138,106,75,.35)" } },
            cfg.float ? "正在屏幕上陪着你 · 点这里收起来" : "让他悬浮在屏幕上"),
          h("div", { style: { display: "flex", gap: 8, margin: "0 0 4px" } },
            chip(!cfg.pokeTalk, "戳他只做动作", () => set({ pokeTalk: false }), "pa"), chip(!!cfg.pokeTalk, "戳他会说一句", () => set({ pokeTalk: true }), "pb")),
          cfg.pokeTalk && char.voiceId ? h("div", { style: { display: "flex", gap: 8, margin: "6px 0 4px" } },
            chip(!voiceOn(), "只冒字", () => { try { localStorage.setItem("x_fairyGardenVoice", "0"); } catch (e) {} bump(n => n + 1); }, "va"),
            chip(voiceOn(), "念出来", () => { try { localStorage.setItem("x_fairyGardenVoice", "1"); } catch (e) {} bump(n => n + 1); }, "vb")) : null,
          h("div", { style: { fontSize: "calc(11px * var(--app-fs, 1))", color: "#9a8a70", lineHeight: 1.7, marginBottom: 14 } }, characterText(char, "开了以后，戳他、拎他时他会按自己的性子和此刻的心情回一句。每一句都会调用一次 API；连着戳只算一次，两句之间至少隔 15 秒。" + (char.voiceId ? "「念出来」和庭院、列车是同一个开关。" : "给他在角色资料里选一个声音，就能念出来。"))),
          h("div", { style: { fontSize: "calc(11px * var(--app-fs, 1))", color: "#9a8a70", lineHeight: 1.7, marginBottom: 12 } }, characterText(char, "待机和戳拎反应跟着真实心情；开心更活跃，低落更安静，手选表情也照样联动。晚安后会睡，按角色作息醒来揉眼，点他能叫醒。回来招手、新消息轻跳、打字探头、深夜揉眼；跟着天气观测牌所选地点，雨雪、冷热、晴天和大风时偶尔做小动作；前台约每15分钟更新天气。这些只做动作，不花调用。陪伴与「TA的一天」共用这一身，和庭院那一身分开。悬浮的小人拖右下角的小圆点能调大小；点手邀击掌，手举稳时再点同一只手；连续点头顶会从抬眼到靠近。按住能拎起来，放下理衣服，紧接着再拎会抱起胳膊；点他底下那条把手打开这一页。")),
          Dress && pet() ? h(Dress, { who: "me", look: { me: Object.assign({}, own, auto ? {} : {}) }, styles, game: pet, pushLook }) :
            h("div", { style: { fontSize: "calc(12px * var(--app-fs, 1))", color: "#9a8a70" } }, "小人还在来的路上…"))));
  }

  // 全局悬浮小人：挂在 app 外壳上（和迷你播放器同一层），在陪伴页里自己不出。
  // 在打字吗：悬浮小人会挡输入框，而一个挡住输入框的装饰品，用户第一反应是把它关掉。
  // 打字时淡下去、并且不吃点击（他不该在这时候抢你的手指）。
  function useTyping() {
    const [typing, setTyping] = useState(false);
    useEffect(() => {
      const isField = el => !!el && (/^(input|textarea)$/.test(String(el.tagName || "").toLowerCase()) || el.isContentEditable);
      const on = () => queueMicrotask(() => setTyping(isField(document.activeElement)));
      on();
      document.addEventListener("focusin", on);
      document.addEventListener("focusout", on);
      return () => { document.removeEventListener("focusin", on); document.removeEventListener("focusout", on); };
    }, []);
    return typing;
  }
  // 全部聊天动作共用：同一分句内认动作词与部位，允许修饰、数量和倒装。
  // 不跨标点牵线，免得把“点了杯茶，看着你的头发”拼成点头。
  function actionSpan(...parts) { return actionAnchors(parts, false); }
  function actionSequence(...parts) { return actionAnchors(parts, true); }
  function actionWithout(excluded, ...parts) {
    const match = actionSpan(...parts);
    return clause => excluded.test(clause) ? -1 : match(clause);
  }
  function actionAnchors(parts, ordered) {
    const anchors = parts.map(p => new RegExp(p.source, "iu"));
    // 同一句中的锚点可换序，字符不能重复占用两个锚点；最多三个锚点。
    // 这样“手挥了挥”“书被翻开”“把下巴托住”都走同一层，不逐项另写倒装。
    // 认到了返回第一个锚点在这一小句里的位置（拿去看它前面有没有「别／没」），认不到返回 -1
    return clause => {
      const find = (at, remaining) => {
        if (!remaining.length) return Infinity;
        const rest = clause.slice(at);
        let best = -1;
        remaining.forEach((index, i) => {
          if (best >= 0 || (ordered && i)) return;
          const match = anchors[index].exec(rest);
          if (match && find(at + match.index + match[0].length, remaining.filter((_, j) => j !== i)) >= 0) best = at + match.index;
        });
        return best;
      };
      return find(0, anchors.map((_, i) => i));
    };
  }
  function actionRule(kind, cues, ...spans) { return { kind, cues, spans }; }
  const ACTION_HEAD = /(?<!拳|指|石|木)头(?!发|像|绪|衔|条|号|皮|疼|痛|脑)|脑袋/;
  // Hugging needs a person as the object, or an explicit invitation with no object.
  // Matching a distant “你” in “抱着手机等你回” used to turn the phone into a hug.
  const HUG_CUE = /(?:抱抱|拥抱)(?=$|[～~!！呀啊吧嘛呢哦啦]|[你您我他她](?!的))|🫂|\bhug(?:s)?\b|(?:^|[（(【\s])抱(?=$|[）)】\s~～!！])|抱(?:了?一下)(?=$|[～~!！呀啊吧嘛呢哦啦])/i;
  const SLAP = /巴掌|耳光|掌掴/;
  const PAT_OBJECT = /(?:你|您|对方)的[^，。]*?(?:手|掌)|(?:拍|把|将)[^，。]*?[他她]的[^，。]*?(?:手|掌)|(?:手|掌)(?:上|里|背|心)[^，。]*(?:灰|尘|脏)/;
  const HUG_PERSON = /(?:抱|搂|拥)(?:了|着|过|住|紧|抱|搂|拥|一把|一下)*[你您我他她](?!的)|(?:把|将)[你您我他她](?!的)[^，。]*?(?:抱|搂|拥)/;
  const ACT_RULES = [
    actionRule("sleep", /^(?:宝宝|宝贝|亲爱的)?[\s，,]*(?:晚安|晚安安)[呀啦哦喽～~!！。\s]*$|(?:^|[\s，,。！!])我(?:先|这就|现在)?(?:去|要)?睡(?:了|啦)|困死了[\s，,]*睡了|我睡觉去了|^(?:先)?睡[了啦](?:睡[了啦])?[哈喽～~]?$/,
      actionSpan(/睡着|睡熟|熟睡|睡过去|睡下了/), actionSpan(/入/, /梦乡/)),
    actionRule("emotion-selfie", null, actionSpan(/自拍/), actionSpan(/举|拿|抬/, /手机/, /拍自己|对着自己|拍张照|拍照/)),
    actionRule("emotion-peace", null, actionSpan(/比|摆|举|做/, /耶|剪刀手|胜利手势|[Vv]字手势/), actionSpan(/✌/)),
    actionRule("emotion-sing", null, actionSpan(/哼|唱/, /歌|曲|调|旋律/), actionSpan(/歌声|哼唱|吟唱|轻唱/)),
    actionRule("emotion-ears", null, actionSpan(/捂|堵|蒙|盖|掩/, /耳/), actionSpan(/不听不听/)),
    actionRule("emotion-fan", null, actionWithout(SLAP, /扇|煽/, /风(?!衣|景)/), actionWithout(SLAP, /手|掌/, /扇|煽/, /给自己|脸边|扇子|凉|热/)),
    actionRule("emotion-daydream", null, actionSpan(/发呆|走神|出神|神游|放空|呆望/), actionSpan(/发/, /呆/)),
    actionRule("emotion-umbrella", null, actionSpan(/撑|打|举|打开/, /伞/)),
    actionRule("emotion-heart", null, actionSpan(/比|摆|做/, /心(?!情|理|事|思)/), actionSpan(/爱心手势|手指心|🫰|🫶/)),
    actionRule("emotion-thumb", null, actionSpan(/竖|举|伸/, /拇指|大指/), actionSpan(/👍/)),
    actionRule("emotion-wink", null, actionSpan(/眨|挤/, /眼/), actionSpan(/wink|😉/i)),
    actionRule("emotion-tongue", null, actionSpan(/吐|伸/, /舌/)),
    actionRule("emotion-cry", null, actionSpan(/抹|擦|拭/, /泪/), actionSpan(/哭(?!笑不得)|抽泣|啜泣|落泪|流泪/), actionSpan(/眼泪|泪水/, /落|掉|流|涌/)),
    actionRule("emotion-poke", null, actionSpan(/戳/, /脸|面颊|腮/), actionSpan(/点|碰/, /指/, /脸|面颊|腮/)),
    actionRule("emotion-pinch", null, actionSpan(/捏|掐|拧/, /脸|面颊|腮/), actionSpan(/揉/, /(?:你|您|对方)的[^，。]*?(?:脸|面颊|腮)/)),
    actionRule("emotion-phone", null, actionSpan(/拿|掏|举|握|看|盯|刷|划|滑|敲|捧|抱/, /手机|电话/), actionSpan(/打(?!断|翻|碎|坏|破|掉|落|击)|拨|接听|接起|接了|接过/, /电话/), actionSpan(/拨号/), actionSpan(/敲|输入|戳|划|滑/, /屏幕|键盘/), actionSpan(/打字|敲字/)),
    actionRule("emotion-eat", null, actionSpan(/吃|咬|啃|嚼|吞|尝/, /口|饼|食物|东西|面包|点心|蛋糕|零食|饭|糖|餐/)),
    actionRule("emotion-prone", null, actionSpan(/趴|俯卧/, /下|好|着|在|床|地|桌/)),
    actionRule("emotion-lie", null, actionSpan(/躺|卧(?!槽|底)/, /下|倒|平|好|着|在|床|地|边|侧/)),
    actionRule("emotion-hips", /叉腰/,
      actionSpan(/叉腰/), actionSpan(/手|掌/, /腰/, /叉|插|搭|撑/)),
    actionRule("emotion-selfhug", /抱抱自己|自我拥抱/,
      actionSpan(/抱|搂|环/, /自己(?!的)|自己的(?:身体|身子)|自身|自我/)),
    actionRule("emotion-peekaboo", /躲猫猫/,
      actionSpan(/捂|蒙|遮|盖|掩|挡/, /眼睛|双眼|眼皮|眼/)),
    actionRule("emotion-sneeze", /喷嚏|[阿啊]嚏/,
      actionSpan(/喷嚏|[阿啊]嚏/)),
    actionRule("emotion-gift", /送礼|递礼物/,
      actionSpan(/递|送|捧|献|给/, /礼物|礼盒|礼品|小礼/)),
    actionRule("emotion-sign", /举牌/,
      actionSpan(/举|抬|扬|晃/, /牌子|纸牌|小牌|字牌|手牌|牌/)),
    actionRule("emotion-cheeks", /捧脸|捧腮/,
      actionSpan(/捧/, /脸|面颊|腮/), actionSpan(/双手|两手/, /托|撑/, /脸|面颊|腮/)),
    actionRule("emotion-crossarms", /抱胸|环胸/,
      actionSpan(/抱胸|环胸/), actionSpan(/双臂|两臂|手臂|胳膊|双手/, /交叉|交叠|抱|环/, /胸/)),
    actionRule("emotion-scratch", /挠头|搔头/,
      actionSpan(/挠|搔/, ACTION_HEAD), actionSpan(/抓|挠|搔/, /后脑|脑后|后颈/)),
    actionRule("emotion-rubeyes", /揉眼/,
      actionSpan(/揉|擦|搓|抹/, /眼睛|眼角|眼眶|眼皮|双眼|眼/)),
    actionRule("emotion-cold", null, actionSpan(/搓/, /手|掌/), actionSpan(/冷|冻/, /抖|颤|哆嗦|哆哆嗦嗦/), actionSpan(/打/, /寒颤|冷颤|哆嗦/)),
    actionRule("emotion-plead", /合十|拜托|求求/,
      actionSpan(/合|并|贴|拢/, /双掌|掌心|双手|两手/)),
    actionRule("emotion-flower", /送你一朵花/,
      actionSpan(/递|送|献|捧/, /小花|花朵|鲜花|花束|玫瑰|雏菊|花(?!生|钱|费|销|样|纹|絮)/),
      actionSpan(/给/, /你|您|我|她|他/, /一朵花|小花|鲜花|花束/)),
    actionRule("emotion-kiss", /飞吻|啵|么么|mua|mwah|\bkiss(?:es)?\b|😘|(?:^|[（(【\s])[亲吻](?=$|[）)】\s~～!！])|啾/i,
      actionSpan(/亲(?!爱|属|自|切|近|情|缘|戚|眼|手|笔|口|身|生|友|民|密)|吻/, /亲|吻|口|下|你|您|我|她|他|额头|脸|嘴/), actionSpan(/飞/, /吻/)),
    actionRule("emotion-giggle", /偷笑|憋笑|窃笑|忍笑/,
      actionSpan(/偷|忍|憋/, /笑/), actionSpan(/捂|掩|遮/, /嘴/), actionSpan(/抿/, /嘴/, /笑/)),
    actionRule("emotion-listen", /洗耳恭听|听着呢|在听呢/,
      actionSpan(/侧|竖|拢|偏/, /耳/), actionSequence(/凑|认真/, /听/),
      actionSequence(/听/, /你|您|我|她|他/, /说|讲/), actionSequence(/你|您/, /说|讲/, /听/)),
    actionRule("emotion-promise", /保证(?!金|书)|包在我身上|说到做到|一言为定/,
      actionSpan(/拍/, /胸(?!前)/), actionSpan(/捶|叩|敲/, /胸/), actionSpan(/发/, /誓/)),
    actionRule("emotion-applause", null,
      actionWithout(PAT_OBJECT, /鼓/, /掌(?!心|背)/),
      actionWithout(PAT_OBJECT, /拍(?:了|着|过|起|一|两|几|下|次|拍)*[手掌](?!上|里|背|心|指|腕|臂|套)/),
      actionWithout(PAT_OBJECT, /拍/, /手|掌/, /一起|相互|互相|响|叫好/),
      actionWithout(PAT_OBJECT, /双手|双掌|两只手|两手/, /拍(?:了|着|过|起|一|两|几|下|次|拍)*$/)),
    actionRule("emotion-cheer", /加油|鼓劲|你(?:一定|肯定)?可以的|你能行/,
      actionSpan(/握|攥/, /拳/), actionSpan(/打/, /气/)),
    actionRule("emotion-refuse", /不干了|才不要|才不呢|拒绝/,
      actionSpan(/摇|晃/, ACTION_HEAD), actionSpan(/摆/, /手/)),
    actionRule("emotion-cozy", HUG_CUE,
      actionSpan(HUG_CUE), actionSpan(HUG_PERSON),
      actionSpan(/张|敞/, /双臂|手臂|胳膊/), actionSpan(/伸/, /出|开/, /双臂|手臂|胳膊/),
      actionSpan(/双臂|手臂|胳膊/, /张|伸/, /开/)),
    actionRule("emotion-chin", /托腮/,
      actionSpan(/托|撑|支/, /下巴|下颌|腮|脸颊/)),
    actionRule("emotion-dance", /跳舞|手舞足蹈|跟着节拍|起舞|舞步|舞动/,
      actionSpan(/跳/, /舞/), actionSpan(/扭/, /腰/), actionSpan(/音乐|节拍/, /摇|晃|摆/)),
    actionRule("emotion-bow", /弯腰致意/,
      actionSpan(/鞠/, /躬/), actionSpan(/欠|躬/, /身/), actionSpan(/弯/, /腰/, /致意|行礼|道谢|道歉/)),
    actionRule("emotion-shrug", /两手一摊/,
      actionSpan(/耸/, /肩/), actionSpan(/摊/, /手/), actionSpan(/抬|提/, /双肩|肩膀/)),
    actionRule("emotion-beckon", /过来(?:一点|点|呀|嘛|抱)|靠近(?:一点|些|我)/,
      actionSpan(/招/, /手/, /叫|让|示意|喊|过来|靠近/), actionSpan(/勾|弯/, /手指|食指|手/)),
    actionRule("emotion-peek", /左顾右盼|东张西望/,
      actionSpan(/探|伸|露/, ACTION_HEAD), actionSpan(/四下|左右/, /看|张望/)),
    actionRule("emotion-show", /好看吗/,
      actionSpan(/展示|显摆/, /衣|穿搭/), actionSpan(/转/, /圈/, /给你看|展示|新衣|穿搭/)),
    actionRule("emotion-five-right", /give\s+me\s+five|high[ -]?five/i,
      actionSpan(/击|碰/, /掌/)),
    actionRule("wave", /拜拜|拜了个拜|再见|回头见|嗨(?:[~～!！]|呀|喽|咯|$)|哈[喽啰罗]|hello|hi[!！~～]|早安|早上好|晚上好/i,
      actionSpan(/挥(?!霍)|招(?!聘|生|商)|摇|晃/, /手/)),
    actionRule("yawn", /[哈呵]欠|好困|困(?:了|死|得|意)|犯困|睡意|想睡|想打盹|睁不开眼|眼皮打架/,
      actionSpan(/打/, /[哈呵]欠/)),
    actionRule("stretch", /舒展|活动一下/,
      actionSpan(/伸|舒|活动/, /懒腰|筋骨|身体|胳膊|手臂|双臂|腰/)),
    actionRule("tea", /干杯/,
      actionSpan(/喝|饮|抿|啜/, /茶|水|咖啡|奶茶|汤|酒|口/), actionSpan(/端|举|捧/, /杯|茶盏/)),
    actionRule("read", /学习|温习|复习|埋头读/,
      actionSpan(/看|翻|读|阅|批|写|浏览/, /书(?!店|架|包|柜)|文件|资料|课本|作业|卷宗|页/)),
    actionRule("shy", /害羞|羞(?:涩|红|怯|得)|不好意思/,
      actionSpan(/脸|面颊|耳/, /红|烫/), actionSpan(/捂|遮/, /脸|面颊/)),
    actionRule("hop", /蹦|欢呼|雀跃|手舞足蹈|(?<!比|个)耶(?:[!！~～]|$)|好耶|太棒了|太好了/,
      actionSpan(/跳|跃/, /起来|起身|起|半空/)),
    actionRule("stomp", /气死|气炸|哼(?:[!！~～]|$)|炸毛|气鼓鼓/,
      actionSpan(/跺|踏/, /脚/)),
    actionRule("sigh", /叹息|长叹|唉|哎呀呀/,
      actionSpan(/叹/, /气/)),
    actionRule("jolt", /一激灵|吓死|心头一跳|吓到(?:了)?我/,
      actionSpan(/吓|惊/, /一跳/), actionSpan(/打/, /激灵/), actionSpan(/身子|身体/, /一颤|一抖/)),
    actionRule("nod", /颔首|嗯嗯|好好好|知道(?:了|啦|喽)|明白(?:了|啦)|收到|没问题|好嘞|好哒/,
      actionSpan(/(?<!一|两|几|有|丁)点(?!心|菜|餐|单|评|击|名|播|赞|火|灯|烟|缀|开|亮)/, ACTION_HEAD), actionSpan(/颔/, /首/)),
    actionRule("turn", /转身|扭头|别过脸|背过身/,
      actionSpan(/转(?!账|帐|发|运|学|型)|扭|别|背/, new RegExp("后背|身|脸|" + ACTION_HEAD.source, "u")),
      // 回过头看一眼也是转头；「回头见」「回头再说」是在说以后，不算
      actionSequence(/回(?=过?(?:头|脑袋)(?!见|再|说|聊|找|补|给))/, ACTION_HEAD)),
    actionRule("emotion-tilt", null, actionSpan(/歪|偏|斜|侧(?=[了过着动一])/, ACTION_HEAD)),
    // 复用已有情绪动画。口头提示只留笑声和惊叹；身体／神态词只放动作锚点。
    actionRule("emotion-happy", /哈哈+|笑死|笑不活/,
      actionSpan(/大笑|朗笑|哈哈+|笑死|笑不活/), actionSpan(/笑/, /出声|前仰后合|停不下来|肚子疼/), actionSpan(/笑/, /直不起|直不起来/, /腰/)),
    actionRule("emotion-amazed", /哇(?:塞|哦|喔|[!！~～]|$)|好厉害/,
      actionSpan(/惊喜|惊叹|惊艳|惊呼|哇(?:塞|哦|喔|[!！~～]|$)|好厉害/), actionSpan(/喜/, /望外/)),
    actionRule("emotion-surprise", null,
      actionSpan(/愣|怔|呆/, /住|下|滞|在|着|会/), actionSpan(/发/, /愣|怔|呆/), actionSpan(/愣神/)),
    actionRule("emotion-proud", null,
      actionSpan(/得意|求夸|自豪|骄傲/), actionSpan(/挺|抬|扬/, /胸/)),
    actionRule("emotion-sad", null,
      actionSpan(/难过|委屈|伤心/), actionSpan(/低|垂|耷拉|埋/, ACTION_HEAD), actionSpan(/眼眶|眼圈/, /红|润|泪/)),
    actionRule("emotion-irritated", null,
      actionSpan(/闷闷不乐|生闷气|不高兴/), actionSpan(/撇|噘|嘟/, /嘴/), actionSpan(/鼓/, /腮|脸颊|面颊/)),
    actionRule("emotion-headpat", null,
      actionSpan(/蹭过来|蹭蹭/), actionSpan(/蹭|贴/, /手|掌心|手心|你/), actionSpan(ACTION_HEAD, /凑|靠|贴/, /过来|过|向|近|你|手/)),
    actionRule("sit", /坐着|落座|盘腿/,
      actionSpan(/坐|窝|瘫/, /下|好|回|在|进|到|沙发|椅|床|地上/), actionSpan(/盘/, /腿/), actionSpan(/落/, /座/))
  ];
  // 这一小句没真做（她 2026-10-24 审：「别叹气了」「我没有拒绝你啊」「你要是敢跑，我就抱你回来」都被当成动作）：
  //   动作前面有「别／不／没……」就跳过（「别开了脸」「没问题」那个字就是动作本身，不算）；
  //   只看动作前面、最后一个「的」之后那一截：「还没睡醒的脑袋点了点」里的「没」管的是睡醒，不是点头；
  //   一句话里出现「要是／如果」，从那一小句起到这句话完都跳过。
  const NOT_DONE = /别|不要|不准|不许|不用|不想|没有?|才不|要是|如果|假如|万一|是不是|会不会|想不想/;
  const IF_SENT = /要是|如果|假如|万一/;
  // 问句（「脸红什么」「今天学习了吗」）是在问人，不是自己在做
  const ASKING = /什么|吗|呢|么|[?？]/;
  // 有好几个动作时，从最后写到的那一小句选，前面的招呼不抢走后面的反应
  function clausesOf(s) {
    const out = [];
    for (const match of s.matchAll(/([^。.！？!?；;\n\r]+)([。.！？!?；;\n\r]*)/gu)) {
      const sent = match[1], question = /[?？]/u.test(match[2]); let ifs = false;
      sent.split(/[，,：:]/u).forEach(c => { if (IF_SENT.test(c)) ifs = true; if (c.trim()) out.push({ c, ifs, question, ask: question || ASKING.test(c) }); });
    }
    return out.reverse();
  }
  // Observation/request complements belong to the other person. Keep the
  // actor's surrounding actions, and resume when the actor is named again.
  // All action families use this text, so “看你吃饭/点头/哭/举手机” share one boundary.
  function actorActionText(c) {
    const who = /^(?:\s*)(他|她|我|TA)/iu.exec(c)?.[1];
    const other = /(?:看(?:了看|了一眼|着|到|见)?|望着|盯着|听(?:了听|着|到|见)?|等(?:着|待)?|让|叫|催|劝)[你您我他她](?!的)/gu;
    let out = "", from = 0, match;
    while ((match = other.exec(c))) {
      const start = match.index, tail = start + match[0].length;
      if (/^(?:让|叫|催|劝)/u.test(match[0]) && /^(?:靠近|过来)/u.test(c.slice(tail))) continue;
      const resume = new RegExp("(?:" + (who ? who + "(?!的)|" : "") + "(?:后|时|又|却|而)自己(?!的)|一边|以后|之后|随后|然后|接着)", "iu").exec(c.slice(tail));
      const end = resume ? tail + resume.index : c.length;
      // Listening is itself an action; preserve its “听你说/讲” cue, not the
      // actions described inside what the other person says.
      const listen = /^听/u.test(match[0]) && /说|讲/u.exec(c.slice(tail, end));
      const own = listen ? match[0] + listen[0] : /^(?:让|叫|催|劝)/u.test(match[0]) ? match[0] : "";
      out += c.slice(from, start) + own + " ".repeat(Math.max(0, end - start - own.length));
      from = end; other.lastIndex = end;
    }
    return out + c.slice(from);
  }
  const done = (x, at) => at >= 0 && !x.ifs && !x.question && !NOT_DONE.test(x.c.slice(0, at).split("的").pop());
  const cueAt = (rule, x) => { const m = rule.cues && rule.cues.exec(x.c); return m ? m.index : -1; };
  // act：动作描写（action 那一栏、话里括号或星号包着的那段）；said：说出口的话。
  //   动作只从 act 里认；said 里只认本身就是在打招呼、应声的那几句（晚安、加油、好好好……），而且不认问句。
  //   只给一个字符串（旧的叫法、测试）＝当成动作描写。
  function actForChat(act, said) {
    const norm = x => String(x || "").normalize("NFKC").replace(/摇头晃脑/g, "跟着节拍晃");
    const inSaid = [];
    const sd = norm(said).replace(/[（(【*]([^）)】*\n]{1,60})[）)】*]/gu, (m, x) => { inSaid.push(x); return " "; });
    const owned = text => clausesOf(text).map(x => Object.assign(x, { c: actorActionText(x.c) }));
    const a = owned([norm(act)].concat(inSaid).join("\n")), b = owned(sd);
    // 明确动作优先于“早安／知道了”等口头提示；仍只在原动作表选一套。
    for (const x of a) for (const rule of ACT_RULES) if (rule.spans.some(match => done(x, match(x.c)))) return rule.kind;
    for (const x of a) for (const rule of ACT_RULES) if (done(x, cueAt(rule, x))) return rule.kind;
    for (const x of b) if (!x.ask) for (const rule of ACT_RULES) if (done(x, cueAt(rule, x))) return rule.kind;
    return "";
  }
  function actForText(text) { return actForChat(text, ""); }
  window.addEventListener("companion-chat", e => {
    const d = e && e.detail; if (!d || !d.charId) return;
    const k = d.act != null || d.said != null ? actForChat(d.act, d.said) : actForText(d.text);
    if (k || d.said) lifeUpdate(d.charId, { kind: k === "sleep" ? "sleep" : "wake" });
  });
  function useChatAct(charId, frame) {
    useEffect(() => {
      const on = e => { const d = e && e.detail; if (!d || d.charId !== charId) return; const k = d.act != null || d.said != null ? actForChat(d.act, d.said) : actForText(d.text);
        const w = frame.current && frame.current.contentWindow; if (k && w) w.postMessage({ type: "pet-act", kind: k }, "*"); };
      window.addEventListener("companion-chat", on);
      return () => window.removeEventListener("companion-chat", on);
    }, [charId]);
  }
  function CompanionFloat(props) {
    const [cfg, setCfg] = useState(load);
    useEffect(() => { window.__companionChanged = n => setCfg(n); return () => { window.__companionChanged = null; }; }, []);
    const chars = props.characters || [];
    const char = chars.find(c => c.id === cfg.charId);
    const sc = Math.max(.6, Math.min(2.2, Number(cfg.scale) || 1)), W = Math.round(96 * sc), H = Math.round(132 * sc);
    const [pos, setPos] = useState(() => cfg.pos || { x: window.innerWidth - W - 8, y: window.innerHeight - H - 150 });
    const drag = useRef(null), rs = useRef(null);
    const ctx = usePetContext(props, props.screen || "", char);
    const typing = ctx.typing;
    const [failed, setFailed] = useState(false);
    const [say, onPoke, holdSay] = usePokeTalk(char, props, !!cfg.pokeTalk);
    const petFrame = useRef(null);
    useChatAct(cfg.charId, petFrame);
    useMessageNotice(cfg.charId, props, petFrame);
    // 下不来就别在屏幕上留一个空框占地方（悬浮这只不打扰她，一句话都不弹）
    if (!cfg.float || !char || props.hidden || failed) return null;
    const clamp = p => ({ x: Math.max(0, Math.min(window.innerWidth - W, p.x)), y: Math.max(44, Math.min(window.innerHeight - H - 8, p.y)) });
    const onDown = e => { drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y }; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {} };
    const onMove = e => { const d = drag.current; if (!d) return; setPos(clamp({ x: d.ox + e.clientX - d.sx, y: d.oy + e.clientY - d.sy })); };
    // 把手：拖＝挪位置；轻点一下（没挪动）＝打开陪伴页。点小人本身留给他的反应。
    const onUp = e => { const d = drag.current; if (!d) return; drag.current = null;
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 6) { if (props.onOpen) props.onOpen(); return; }
      const n = Object.assign(load(), { pos }); save(n); };
    return h("div", { "data-wk": "compfloatpet", onContextMenu: e => e.preventDefault(), style: { position: "fixed", left: pos.x, top: pos.y, width: W, height: H, zIndex: 60, touchAction: "none", WebkitUserSelect: "none", userSelect: "none", WebkitTouchCallout: "none", WebkitTapHighlightColor: "transparent",
      opacity: typing ? .2 : 1, pointerEvents: typing ? "none" : "auto", transition: "opacity .18s" } },
      h(Bubble, { text: say, onHold: holdSay, style: { bottom: "100%", marginBottom: 4 } }),
      h(PetFrame, { mode: "float", frameRef: petFrame, onPoke, msg: petMessage(char, props.moods, cfg), ctx,
        onStatus: st => { if (st && st.state === "failed") setFailed(true); }, style: { width: W, height: H - 18, pointerEvents: "auto" } }),
      // 这一条是把手：拖动挪位置，轻点打开陪伴页（iframe 里的点击留给小人自己的反应）
      h("div", { "data-wk": "compdrag", onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp, "aria-label": "拖动陪伴小人",
        style: { height: 18, margin: "0 22px", borderRadius: 9, background: "rgba(138,106,75,.28)", cursor: "grab" } }),
      // 右下角的小圆点：往外拖变大、往里拖变小
      h("div", { "data-wk": "compresize", "aria-label": "调整陪伴小人大小",
        onPointerDown: e => { e.stopPropagation(); rs.current = { sx: e.clientX, sy: e.clientY, s0: sc }; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {} },
        onPointerMove: e => { const r = rs.current; if (!r) return; const d = ((e.clientX - r.sx) + (e.clientY - r.sy)) / 2; const ns = Math.max(.6, Math.min(2.2, r.s0 + d / 110)); setCfg(c => Object.assign({}, c, { scale: ns })); },
        onPointerUp: () => { if (!rs.current) return; rs.current = null; setCfg(c => { const n = Object.assign(load(), { scale: c.scale }); save(n); return c; }); },
        style: { position: "absolute", right: -4, bottom: -4, width: 22, height: 22, borderRadius: 11, background: "rgba(138,106,75,.55)", border: "2px solid #fff", touchAction: "none" } }));
  }

  // 主屏图标：一个圆脑袋的小人
  window.GCompanion = p => h(Svg, p, h("circle", { cx: 12, cy: 8, r: 4.6 }), h("path", { d: "M6.5 20.5c.4-4 2.6-6.3 5.5-6.3s5.1 2.3 5.5 6.3" }), h("path", { d: "M9.6 8.4h.01M14.4 8.4h.01" }));
  window.Companion = Companion;
  window.CompanionPreview = PetFrame;
  window.CompanionFloat = CompanionFloat;
  window.CompanionFace = { faceForMood, FACE_ZH, lookFor, petMessage, lifeStep, lifeRead, lifeUpdate, actForText, actForChat, makeMessageWatch };
})();
