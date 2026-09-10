// ============================================================
// 电台 · 界面与播放（第一版，配 js/radio.js）
//
// ⚠️播放这件事不住在 React 组件里，住在下面这个 Engine 单例里。
//   理由只有一个：**她退出电台页之后，电台还得在播**（悬浮那一条要显示台名）。
//   把它写成组件里的 effect 的话，一退出就 unmount，等于「关页面＝关电台」——
//   而这个功能的命根子正是「她不看着的时候它照样在播」。
//   Engine 里也没有播放位置这种东西：位置永远从时间算（js/radio.js 第五节），
//   Engine 只管两件事——开着没有、该念哪一句了。
// ============================================================
(function (root) {
  "use strict";

  const DIAL_KEY = "x_radioDial";
  const Engine = (() => {
    let on = false, sound = false, timer = null, lastKey = "";
    // 拧到哪一格记在本机：她上次听的那个频率，下次开机还在那儿（收音机就是这样的）。
    // ⚠️记的是【拧到哪儿】，不是【听到哪一句】——后者一个字都不许存（js/radio.js 第五节）。
    let idx = (() => { try { const v = parseInt(localStorage.getItem(DIAL_KEY), 10); return Number.isFinite(v) ? v : -1; } catch (e) { return -1; } })();
    const subs = [];
    const R = () => root.Radio;
    const notify = () => subs.slice().forEach(f => { try { f(); } catch (e) {} });

    // 每个台的嗓子：系统 TTS 没有几十个声音，但语速和音高能把台跟台分开。
    function voiceOf(st) {
      const r = R();
      const id = (st && st.id) || "";
      return { rate: 0.84 + r.seed01(id, "rate") * 0.4, pitch: 0.78 + r.seed01(id, "pitch") * 0.54 };
    }
    // 此刻这一格是什么。全部现算，一个字都不缓存。
    function look() {
      const r = R();
      if (!r) return null;
      const now = r.radioNow(), dk = r.dayKey(now);
      const world = r.readWorld(), days = r.readDays();
      const dial = r.dialToday(world, now);
      if (!dial.length) return null;
      const i = Math.max(0, Math.min(dial.length - 1, idx < 0 ? 0 : idx));
      const slot = dial[i];
      const base = { now: now, dk: dk, i: i, dial: dial, slot: slot, world: world, days: days };
      if (!slot.station) return Object.assign(base, { station: null, leak: r.leakLine(days, slot.freq, now) });
      const items = r.itemsFor(days, dk, slot.station.id);
      return Object.assign(base, {
        station: slot.station, items: items, signal: slot.signal,
        pos: items.length ? r.whereIs(slot.station, items, now, dk) : null
      });
    }
    function say(text, st) {
      const t = String(text || "").trim();
      try {
        if (!root.speechSynthesis) return;
        root.speechSynthesis.cancel();
        if (!t) return;
        const u = new root.SpeechSynthesisUtterance(t);
        const v = voiceOf(st);
        u.lang = "zh-CN"; u.rate = v.rate; u.pitch = v.pitch;
        root.speechSynthesis.speak(u);
      } catch (e) {}
    }
    function hush() { try { if (root.speechSynthesis) root.speechSynthesis.cancel(); } catch (e) {} }
    function beat() {
      const v = look();
      if (!v) return;
      const key = v.station && v.pos ? (v.station.id + "|" + v.pos.round + "|" + v.pos.i) : ("empty|" + (v.slot && v.slot.freq));
      if (key !== lastKey) {
        lastKey = key;
        if (sound && v.station && v.pos) {
          // 中途拧过来的，就从这句话已经念到的地方接着念——不从头念一遍
          const full = String(v.pos.item.text || "");
          const done = Math.min(0.98, Math.max(0, v.pos.into / Math.max(1, v.pos.item.sec)));
          say(full.slice(Math.floor(full.length * done)), v.station);
        } else hush();
      }
      notify();
    }
    function tick() { if (timer) clearInterval(timer); timer = on ? setInterval(beat, 400) : null; }

    return {
      look: look,
      live: () => on,
      soundOn: () => sound,
      slot: () => idx,
      subscribe: fn => { subs.push(fn); return () => { const i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); }; },
      setPower: v => { on = !!v; lastKey = ""; if (!on) hush(); tick(); notify(); },
      setSound: v => { sound = !!v; lastKey = ""; if (!sound) hush(); notify(); },
      tune: n => {
        idx = Math.max(0, n); lastKey = ""; hush();
        try { localStorage.setItem(DIAL_KEY, String(idx)); } catch (e) {}
        notify();
      },
      // 从没拧过的那一次：落在第一个有台的频率上，别让她第一眼就是一格静电
      settle: () => {
        if (idx >= 0) return;
        const r = R();
        const dial = r ? r.dialToday(r.readWorld(), r.radioNow()) : [];
        const k = dial.findIndex(x => x && x.station);
        idx = k >= 0 ? k : 0;
        notify();
      },
      refresh: () => { lastKey = ""; notify(); }
    };
  })();

  // ------------------------------------------------------------
  const NIGHT = { ink: "#efe7da", dim: "rgba(239,231,218,.52)", faint: "rgba(239,231,218,.3)", line: "rgba(239,231,218,.13)", warm: "#e3a86a" };
  const SHELL = {
    background: "#141210",
    backgroundImage: "radial-gradient(120% 80% at 50% -10%, rgba(227,168,106,.16), transparent 60%),"
      + "repeating-linear-gradient(0deg, rgba(255,255,255,.018) 0 1px, transparent 1px 3px)"
  };

  function useEngine() {
    const [, force] = useState(0);
    useEffect(() => Engine.subscribe(() => force(x => x + 1)), []);
    return Engine;
  }

  // 拧到某一格之后停住一会儿才算「真的调到这个台」——扫过去的那几格不该各花一次钱
  const DWELL_MS = 900;

  function RadioScreen(props) {
    const R = root.Radio;
    const eng = useEngine();
    const [busy, setBusy] = useState("");
    const view = eng.look();
    const dial = (view && view.dial) || [];
    const i = (view && view.i) || 0;
    const world = R.readWorld();
    const built = !!(world.stations && world.stations.length);

    // 进这一页就开机，但**声音默认不开**：她定的验收第一条就是
    // 「把声音关掉只看字，还想拧吗」——那本来就该是默认那一档。
    // ⚠️退出这一页**不关机**。关了的话底下那条悬浮就永远不会出现，
    //   而「退出去它还在播」正是这个功能要证明的那件事。要关得她自己按那个键。
    useEffect(() => { Engine.settle(); Engine.setPower(true); }, []);

    // 停在这一格够久了，才去补今天的节目 / 掷一个临时台
    useEffect(() => {
      if (!built || busy) return;
      const slot = dial[i];
      if (!slot) return;
      const now = R.radioNow(), dk = R.dayKey(now);
      const tid = setTimeout(async () => {
        try {
          if (slot.station && !R.itemsFor(R.readDays(), dk, slot.station.id).length) {
            setBusy("正在调 " + R.freqText(slot.freq) + "…");
            await props.onTune(slot.station);
          } else if (!slot.station && R.driftDue(world, slot.freq, now)) {
            setBusy(R.freqText(slot.freq) + " 上好像有东西…");
            await props.onDrift(slot.freq);
          }
        } catch (e) { props.toast && props.toast(String((e && e.message) || e).slice(0, 60)); }
        setBusy(""); Engine.refresh();
      }, DWELL_MS);
      return () => clearTimeout(tid);
    }, [i, built, busy, dial.length]);

    const slot = dial[i] || null;
    const st = slot && slot.station;
    const pos = view && view.pos;
    // 假流式：显示到哪个字，是按这一条已经播了多久算出来的。
    // 所以关掉声音只看字，进度照样是对的——这一版本来就要能这么用。
    let shown = "";
    if (pos) {
      const full = String(pos.item.text || "");
      const frac = Math.min(1, Math.max(0, pos.into / Math.max(1, pos.item.sec)));
      shown = R.roughen(full.slice(0, Math.ceil(full.length * frac)), (view && view.signal) || 1, st.id + "|" + pos.round + "|" + pos.i);
    }

    const turn = d => Engine.tune(Math.max(0, Math.min(dial.length - 1, i + d)));
    const btn = (label, onClick, hot) => h("button", {
      onClick: onClick, className: "active:opacity-60",
      style: {
        fontFamily: F_BODY, fontSize: 12.5, padding: "9px 15px", borderRadius: 999,
        border: "1px solid " + (hot ? "rgba(227,168,106,.6)" : NIGHT.line),
        color: hot ? NIGHT.warm : NIGHT.dim, background: hot ? "rgba(227,168,106,.1)" : "transparent"
      }
    }, label);

    return h("div", { className: "h-full flex flex-col", style: SHELL },
      h(Head, {
        zh: "电台", sub: st ? (st.callSign || st.name) : (built ? "空频" : "还没装天线"),
        onBack: props.onBack, bg: "transparent", ink: NIGHT.ink, subInk: NIGHT.dim, lineInk: NIGHT.line
      }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "14px 18px 28px" } },
        !built ? h("div", { style: { paddingTop: 40, textAlign: "center" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: NIGHT.dim, lineHeight: 1.9, marginBottom: 20 } },
            "这片频段上还什么都没有。", h("br"), "装上天线之后，这几个台就一直在那儿了——", h("br"), "你不开的时候它们也在播。"),
          h("button", {
            onClick: async () => { setBusy("装天线…"); try { await props.onBuild(); } catch (e) { props.toast && props.toast(String((e && e.message) || e).slice(0, 60)); } setBusy(""); Engine.refresh(); },
            disabled: !!busy, className: "active:opacity-60",
            style: { fontFamily: F_BODY, fontSize: 13.5, padding: "11px 26px", borderRadius: 999, border: "1px solid rgba(227,168,106,.55)", color: NIGHT.warm, background: "rgba(227,168,106,.1)" }
          }, busy || "装上天线")
        ) : h(Fragment, null,
          // 频率牌
          h("div", { style: { display: "flex", alignItems: "baseline", gap: 10, marginBottom: 2 } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 44, lineHeight: 1, color: NIGHT.ink, letterSpacing: "-.02em" } }, slot ? R.freqText(slot.freq) : "--"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: NIGHT.faint } }, "兆赫")),
          h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: st ? NIGHT.ink : NIGHT.faint, marginTop: 8 } },
            st ? st.name : "———"),
          st && st.area ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: NIGHT.faint, marginTop: 3 } }, st.area) : null,
          // 刻度
          h("div", { style: { display: "flex", alignItems: "flex-end", gap: 2, marginTop: 18, paddingBottom: 4, borderBottom: "1px solid " + NIGHT.line } },
            dial.map((s, k) => h("button", {
              key: s.freq, onClick: () => Engine.tune(k), className: "active:opacity-60",
              style: { flex: 1, background: "transparent", border: "none", padding: 0, textAlign: "center" }
            },
              h("div", { style: { height: k === i ? 26 : (s.station ? 15 : 8), background: k === i ? NIGHT.warm : (s.station ? "rgba(239,231,218,.42)" : NIGHT.line), borderRadius: 1, margin: "0 auto", width: 2 } }),
              h("div", { style: { fontFamily: F_BODY, fontSize: 8.5, color: k === i ? NIGHT.warm : NIGHT.faint, marginTop: 4 } }, R.freqText(s.freq).replace(/\.\d$/, ""))))),
          // 正在播
          h("div", { style: { minHeight: 150, marginTop: 20 } },
            busy ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: NIGHT.faint } }, busy)
              : st ? (pos
                ? h("div", { style: { fontFamily: F_BODY, fontSize: 15, lineHeight: 2.05, color: pos.item.kind === "ad" ? NIGHT.dim : NIGHT.ink, whiteSpace: "pre-wrap" } },
                  shown, h("span", { style: { opacity: .45, color: NIGHT.warm } }, "▌"))
                : h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: NIGHT.faint, lineHeight: 1.9 } }, "有信号，还没接上。停在这一格上别动。"))
              : h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: NIGHT.faint, lineHeight: 2.1, letterSpacing: ".22em" } },
                "沙沙沙沙沙沙沙沙沙沙沙沙沙沙沙",
                view && view.leak ? h("div", { style: { color: NIGHT.dim, letterSpacing: 0, marginTop: 12, fontSize: 12.5 } }, "…" + view.leak + "…") : null)),
          // 手上那几个键
          h("div", { style: { display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" } },
            btn("◀ 往回拧", () => turn(-1)), btn("往前拧 ▶", () => turn(1)),
            btn(eng.soundOn() ? "关掉声音" : "出声", () => Engine.setSound(!eng.soundOn()), eng.soundOn()),
            btn("关掉电台", () => { Engine.setPower(false); props.onBack && props.onBack(); })),
          root.Radio.RADIO_DEV ? h(DevBar, { view: view, onClear: props.onClearDev, toast: props.toast }) : null
        )));
  }

  // 打磨期的时间遥控器。⚠️`RADIO_DEV` 改成 false 就整条收起来，
  // 别让它无声地留在她手机上——台账里钉着这一条。
  function DevBar(props) {
    const R = root.Radio;
    const v = props.view;
    const jump = ms => { R.devJump(ms); Engine.refresh(); };
    const k = (label, fn) => h("button", {
      onClick: fn, className: "active:opacity-60",
      style: { fontFamily: F_BODY, fontSize: 11, padding: "6px 10px", borderRadius: 6, border: "1px dashed " + NIGHT.line, color: NIGHT.faint, background: "transparent" }
    }, label);
    const now = v ? v.now : Date.now();
    const d = new Date(now);
    return h("div", { style: { marginTop: 26, paddingTop: 14, borderTop: "1px dashed " + NIGHT.line } },
      h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: NIGHT.faint, lineHeight: 1.9, marginBottom: 8 } },
        "虚拟时刻 " + (d.getMonth() + 1) + "/" + d.getDate() + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"),
        v && v.pos ? "　第 " + (v.pos.round + 1) + " 圈第 " + (v.pos.i + 1) + " 条　" + ({ sign: "片头", talk: "口播", ad: "广告", time: "报时" }[v.pos.item.kind] || v.pos.item.kind) : "",
        v && v.station ? "　信号 " + Math.round((v.signal || 0) * 100) + "%" : ""),
      h("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" } },
        k("−1时", () => jump(-3600000)), k("+1时", () => jump(3600000)),
        k("−1天", () => jump(-86400000)), k("+1天", () => jump(86400000)),
        k("回到现在", () => { R.devReset(); Engine.refresh(); }),
        k("清掉测试痕迹", () => { R.clearDev(); Engine.refresh(); props.toast && props.toast("加速期生成的节目单清掉了"); })));
  }

  // 退出电台页之后那一条：台还在播，这儿显示它是谁
  function RadioMini(props) {
    const eng = useEngine();
    if (!eng.live()) return null;
    const v = eng.look();
    const st = v && v.station;
    return h("button", {
      onClick: props.onOpen, className: "active:opacity-70",
      style: {
        // 底下那一条要让开 dock 和输入栏——压在它们身上就是「点不到自己想点的东西」
        position: "fixed", left: 12, bottom: "calc(env(safe-area-inset-bottom, 0px) * 0.4 + 104px)",
        maxWidth: "64vw", display: "flex", alignItems: "center", gap: 9, padding: "9px 13px", borderRadius: 999,
        background: "rgba(20,18,16,.94)", border: "1px solid " + NIGHT.line, textAlign: "left",
        zIndex: (typeof MINI_PLAYER_Z === "number" ? MINI_PLAYER_Z - 1 : 59)
      }
    },
      h("div", { style: { width: 6, height: 6, borderRadius: 999, background: NIGHT.warm, flexShrink: 0 } }),
      h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: NIGHT.ink, flex: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" } },
        st ? st.name : "空频"),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13, color: NIGHT.warm } }, v && v.slot ? root.Radio.freqText(v.slot.freq) : ""));
  }

  // 主屏那个图标：一台真的收音机——天线、机身、喇叭、旋钮
  root.GRadio = p => h(Svg, p,
    h("path", { d: "M7.5 7.4L17.5 3" }),
    h("rect", { x: 2.6, y: 7.4, width: 18.8, height: 12.4, rx: 2.2 }),
    h("circle", { cx: 8.4, cy: 13.6, r: 3.1 }),
    h("path", { d: "M14.6 11.3h4.2M14.6 14.2h4.2M14.6 17.1h2.3" }));

  root.RadioUI = { Engine: Engine, RadioScreen: RadioScreen, RadioMini: RadioMini, NIGHT: NIGHT, DWELL_MS: DWELL_MS };
})(typeof window !== "undefined" ? window : globalThis);
