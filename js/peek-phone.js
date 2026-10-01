// ============================================================
// 他翻你的手机（她 2026-10-01：「我是想跟看他玩一样边滑边有心声」，选的是 A——在【她真的 app】上播）
//
// 「看他玩」是看TA玩TA自己的手机；这儿反过来：她把手机递给TA，TA在【她这台真 app】上翻。
// 所以不另画一台假手机：屏幕真的跳到她的聊天、论坛、钱包那几页，一个触控圆点在上面点、滑，
// 心声浮在屏幕上——每个人 app 的布局、主题、内容本来就不一样，翻出来也就不一样。
//
// 点哪儿【照屏幕上的字找】：脚本里写「点『我』」「点『某个帖子标题』」，播放时在当前屏幕上
//   找写着这几个字的那一块，圆点挪过去再点下去。布局变了也照样找得到；找不到就跳过这一步，不硬点。
//
// ⚠️心声配额照「看他玩」那条规矩（phone-watch.js thoughtCapFor）：每点开一样东西一句，另给两句。
//   代码兜死，不靠提示词。
// ⚠️整个播放期间她点不了别的（透明遮罩），右上角「跳过」随时能停。
// ============================================================
(function () {
  "use strict";
  const STEP_CAP = 40;
  const THOUGHT_FREE = 2;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const S = v => String(v == null ? "" : v);

  // 脚本收拾：认得的动作才留，心声按点开次数封顶
  function cleanScript(raw, allowApps) {
    const list = Array.isArray(raw && raw.steps) ? raw.steps : (Array.isArray(raw) ? raw : []);
    const out = [];
    let opens = 0, thoughts = 0;
    list.forEach(s => {
      if (!s || out.length >= STEP_CAP) return;
      const d = S(s.do || s.action).trim();
      if (d === "open") {
        const app = S(s.app).trim();
        if (allowApps.indexOf(app) < 0) return;          // 她藏起来的那几样，录像里也碰不到
        opens++; out.push({ do: "open", app, who: S(s.who).trim().slice(0, 24) });
      } else if (d === "tap") {
        const text = S(s.text).trim().slice(0, 30);
        if (text) { opens++; out.push({ do: "tap", text }); }
      } else if (d === "scroll") {
        out.push({ do: "scroll", dir: s.dir === "up" ? "up" : "down", n: Math.max(1, Math.min(3, Number(s.n) || 1)) });
      } else if (d === "back") out.push({ do: "back" });
      else if (d === "pause") out.push({ do: "pause", ms: Math.max(400, Math.min(2500, Number(s.ms) || 900)) });
      else if (d === "think") {
        const text = S(s.text).trim().slice(0, 60);
        if (text) out.push({ do: "think", text });
      }
    });
    const cap = Math.max(4, opens + THOUGHT_FREE);
    return out.filter(s => s.do !== "think" || (++thoughts <= cap));
  }

  // 当前屏幕上写着这几个字、而且看得见的那一块（取最小的那块，免得点到整页外壳）
  function findByText(text) {
    const vw = window.innerWidth, vh = window.innerHeight;
    let best = null, bestArea = Infinity;
    const all = document.querySelectorAll("#root button, #root a, #root [role=button], #root span, #root div");
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      if (el.closest("[data-peek-overlay]")) continue;
      const tx = (el.textContent || "").trim();
      if (!tx || tx.indexOf(text) < 0 || tx.length > text.length + 60) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
      const area = r.width * r.height;
      if (area < bestArea) { best = el; bestArea = area; }
    }
    return best;
  }
  // 圆点底下那个能滚的；没有就挑屏幕上最大的那个能滚的
  function findScroller(x, y) {
    let el = document.elementFromPoint(x, y);
    while (el && el !== document.body) {
      if (!el.closest("[data-peek-overlay]")) {
        const st = getComputedStyle(el);
        if (/(auto|scroll)/.test(st.overflowY) && el.scrollHeight > el.clientHeight + 20) return el;
      }
      el = el.parentElement;
    }
    let best = null, bestH = 0;
    document.querySelectorAll("#root *").forEach(e => {
      if (e.scrollHeight > e.clientHeight + 20) {
        const st = getComputedStyle(e);
        if (/(auto|scroll)/.test(st.overflowY) && e.clientHeight > bestH) { best = e; bestH = e.clientHeight; }
      }
    });
    return best;
  }
  function animScroll(el, delta, ms) {
    return new Promise(res => {
      const from = el.scrollTop, t0 = performance.now();
      const step = now => {
        const k = Math.min(1, (now - t0) / ms);
        el.scrollTop = from + delta * (1 - Math.pow(1 - k, 3));
        if (k < 1) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });
  }

  // props: charName, avatarChar, script(null＝还在想), onOpen(app, who)→bool, onBack(), onDone(thoughts)
  function PeekPlayer(props) {
    const h = React.createElement, t = (typeof useTheme === "function" ? useTheme() : {}) || {};
    const [dot, setDot] = React.useState({ x: window.innerWidth / 2, y: window.innerHeight * 0.62, down: false });
    const [thought, setThought] = React.useState("");
    const [caption, setCaption] = React.useState("接过了你的手机…");
    const stopRef = React.useRef(false);
    const doneRef = React.useRef(false);
    const logRef = React.useRef([]);
    const finish = () => { if (doneRef.current) return; doneRef.current = true; stopRef.current = true; props.onDone && props.onDone(logRef.current.slice()); };

    React.useEffect(() => {
      if (!props.script) return;
      let alive = true;
      (async () => {
        const steps = props.script;
        if (!steps.length) { finish(); return; }
        for (let i = 0; i < steps.length; i++) {
          if (!alive || stopRef.current) return;
          const s = steps[i];
          if (s.do === "open") {
            setCaption("在翻：" + (props.labelOf ? props.labelOf(s.app, s.who) : s.app));
            props.onOpen && props.onOpen(s.app, s.who);
            await sleep(1100);
          } else if (s.do === "tap") {
            const el = findByText(s.text);
            if (!el) continue;                                  // 找不到就不硬点
            const r = el.getBoundingClientRect();
            setDot({ x: r.left + r.width / 2, y: r.top + r.height / 2, down: false });
            await sleep(650);
            setDot(d => ({ ...d, down: true })); await sleep(160);
            try { el.click(); } catch (e) {}
            setDot(d => ({ ...d, down: false }));
            await sleep(900);
          } else if (s.do === "scroll") {
            const sc = findScroller(window.innerWidth / 2, window.innerHeight / 2);
            if (!sc) { await sleep(400); continue; }
            const amt = sc.clientHeight * 0.55 * s.n * (s.dir === "up" ? -1 : 1);
            const y0 = window.innerHeight * 0.7, y1 = window.innerHeight * 0.35;
            setDot({ x: window.innerWidth * 0.55, y: s.dir === "up" ? y1 : y0, down: true });
            await sleep(200);
            setDot({ x: window.innerWidth * 0.55, y: s.dir === "up" ? y0 : y1, down: true });
            await animScroll(sc, amt, 700 + 250 * s.n);
            setDot(d => ({ ...d, down: false }));
            await sleep(500);
          } else if (s.do === "back") {
            props.onBack && props.onBack();
            await sleep(800);
          } else if (s.do === "pause") {
            await sleep(s.ms);
          } else if (s.do === "think") {
            logRef.current.push(s.text);
            setThought(s.text);
            await sleep(1800 + Math.min(2400, s.text.length * 90));
            setThought("");
            await sleep(250);
          }
        }
        if (alive) finish();
      })();
      return () => { alive = false; };
    }, [props.script]);

    const ink = t.ink || "#222", bg2 = t.bg2 || "#fff";
    return h("div", { "data-peek-overlay": "1", style: { position: "fixed", inset: 0, zIndex: 9990, background: "transparent" },
        onClickCapture: e => { if (!e.target.closest("[data-peek-skip]")) { e.stopPropagation(); e.preventDefault(); } } },
      // 顶上那一行：谁在翻、在翻什么
      h("div", { style: { position: "absolute", left: 12, right: 76, top: "calc(env(safe-area-inset-top, 0px) + 10px)", display: "flex", alignItems: "center", gap: 8,
          padding: "7px 12px", borderRadius: 999, background: "rgba(20,20,20,.62)", color: "#fff", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" } },
        props.avatarChar && typeof Avatar === "function" ? h(Avatar, { character: props.avatarChar, size: 22, radius: 11 }) : null,
        h("span", { style: { fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, (props.charName || "TA") + " " + caption)),
      h("button", { "data-peek-skip": "1", onClick: finish, style: { position: "absolute", right: 12, top: "calc(env(safe-area-inset-top, 0px) + 8px)", minHeight: 36, padding: "0 14px",
          borderRadius: 999, background: "rgba(20,20,20,.62)", color: "#fff", fontSize: 12.5 } }, "跳过"),
      // 触控圆点
      props.script ? h("div", { style: { position: "absolute", left: dot.x - 17, top: dot.y - 17, width: 34, height: 34, borderRadius: 999,
          background: dot.down ? "rgba(255,255,255,.72)" : "rgba(255,255,255,.45)", border: "2px solid rgba(0,0,0,.35)",
          boxShadow: "0 2px 10px rgba(0,0,0,.25)", transform: dot.down ? "scale(.82)" : "scale(1)",
          transition: "left .55s cubic-bezier(.3,.7,.3,1), top .55s cubic-bezier(.3,.7,.3,1), transform .15s", pointerEvents: "none" } }) : null,
      // 心声：浮在屏幕下半，第一人称一句
      thought ? h("div", { style: { position: "absolute", left: 20, right: 20, bottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)", display: "flex", justifyContent: "center", pointerEvents: "none" } },
        h("div", { style: { maxWidth: 320, padding: "10px 14px", borderRadius: 14, background: bg2, color: ink, fontSize: 14, lineHeight: 1.6,
            boxShadow: "0 8px 24px rgba(0,0,0,.22)", fontStyle: "italic", animation: "wkpop .26s cubic-bezier(.2,1.5,.4,1) both" } }, "（" + thought + "）")) : null);
  }

  window.PeekPhone = { PeekPlayer, cleanScript, findByText, STEP_CAP };
})();
