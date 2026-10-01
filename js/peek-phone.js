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

  // 脚本收拾：认得的动作才留，心声按点开次数封顶。
  // hints：{ forum: [{title, anon}], diary: [title] }——她真有的帖子和日记标题（没看过的排前面），
  //   模型打开论坛／日记却没点进去的时候，代码替它点第一条（她 2026-10-01：「论坛这次也直接不点开帖子看了」）。
  function cleanScript(raw, allowApps, hints) {
    hints = hints || {};
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
        // 模型常把标题连书名号一起抄过来，屏幕上没有那对符号就找不到
        const text = S(s.text).replace(/[《》「」『』“”"]/g, "").trim().slice(0, 30);
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
    // 退出来才想的那一句挪回退出之前（她 2026-10-01：「第二句钱包想法是会退出了钱包才想的」）
    for (let i = 1; i < out.length; i++) {
      if (out[i].do === "think" && out[i - 1].do === "back") { const b = out[i - 1]; out[i - 1] = out[i]; out[i] = b; }
    }
    const cap = Math.max(4, opens + THOUGHT_FREE);
    const kept = out.filter(s => s.do !== "think" || (++thoughts <= cap));
    const nextReal = i => { let j = i + 1; while (j < kept.length && (kept[j].do === "think" || kept[j].do === "pause")) j++; return j < kept.length ? kept[j] : null; };
    const fq = (hints.forum || []).slice(), dq = (hints.diary || []).slice();
    const res = [];
    for (let i = 0; i < kept.length; i++) {
      const s = kept[i]; res.push(s);
      const nx = nextReal(i);
      // 打开论坛／日记却没点进具体那一条：替它点一条（匿名发的也在她的「我」里，不用绕）
      if (s.do === "open" && s.app === "forum" && !(nx && nx.do === "tap") && fq.length) {
        const p = fq.shift();
        res.push({ do: "tap", text: S(p.title).slice(0, 30), auto: true }, { do: "scroll", dir: "down", n: 2, auto: true });
        continue;
      }
      if (s.do === "open" && s.app === "diary" && !(nx && nx.do === "tap") && dq.length) {
        res.push({ do: "tap", text: S(dq.shift()).slice(0, 30), auto: true }, { do: "scroll", dir: "down", n: 2, auto: true });
        continue;
      }
      // 点开就要往下读（她 2026-10-01：「看信息不会下划」「不会看聊天记录整体」）：
      //   聊天停在最新那条，往【上】翻才是在读，翻两回、中间停一下；列表、帖子、日记往【下】滑。
      const opened = (s.do === "open" && (s.app === "chat" || s.app === "messages" || s.app === "forum" || s.app === "diary")) || s.do === "tap";
      if (!opened || (nx && nx.do === "scroll")) continue;
      if (s.do === "open" && s.app === "chat") res.push({ do: "scroll", dir: "up", n: 3, auto: true }, { do: "pause", ms: 900 }, { do: "scroll", dir: "up", n: 3, auto: true });
      else res.push({ do: "scroll", dir: "down", n: 2, auto: true });
    }
    return res;
  }

  // 主屏上每个 app 在哪儿（她 2026-10-01：「能不能做在主屏幕滑动翻找这些 app 的动画」）。
  //   dock 上那几个按字找（只看屏幕下面那一截）；组件、图标按 data-appkey 找；
  //   在文件夹里的，查 x_homeFolders 是哪个文件夹，先点开文件夹再点它。钱包不在主屏上，直接打开。
  // 信息页会记着上次停在哪个底栏（翻过钱包就停在「我」），所以找人之前先点回「聊天」
  // 论坛点开先去底栏「我」（她发过的帖在那儿）；日记点开先翻到她自己那本（她 2026-10-01：「日记和论坛也就点进去页面也没深入」）
  const HOME_SPOT = { chat: { dock: "信息", path: [{ text: "聊天", exact: true, minTopK: 0.8, optional: true }] },
    // 消息列表本身也是一处能看的（她 2026-10-01：「看到我对别人的备注、几点聊的、最后一句是啥」）
    messages: { dock: "信息", path: [{ text: "聊天", exact: true, minTopK: 0.8, optional: true }] },
    forum: { dock: "论坛", path: [{ text: "我", exact: true, minTopK: 0.8, optional: true }] },
    diary: { dock: "日记", path: [{ call: "diaryMine" }] },
    memo: { key: "w_memo" }, listen: { key: "w_music" }, shop: { key: "shop" }, takeout: { key: "takeout" },
    // 钱包不在主屏上：信息 → 底栏「我」→「我的钱包」（她 2026-10-01：「钱包页面找不到直接点进来的」）
    wallet: { dock: "信息", path: [{ text: "我", exact: true, minTopK: 0.8 }, { text: "我的钱包" }] } };
  function folderOf(key) {
    let f = {}; try { f = JSON.parse(localStorage.getItem("x_homeFolders") || "{}") || {}; } catch (e) {}
    const ids = Object.keys(f);
    for (let i = 0; i < ids.length; i++) if ((f[ids[i]].keys || []).indexOf(key) >= 0) return ids[i];
    return null;
  }
  // 当前屏幕上写着这几个字、而且看得见的那一块（取最小的那块，免得点到整页外壳）
  function findByText(text, minTop, exact) {
    const vw = window.innerWidth, vh = window.innerHeight;
    let best = null, bestArea = Infinity;
    const all = document.querySelectorAll("#root button, #root a, #root [role=button], #root span, #root div");
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      if (el.closest("[data-peek-overlay]")) continue;
      const tx = (el.textContent || "").trim();
      if (!tx || tx.indexOf(text) < 0 || tx.length > text.length + 60) continue;
      if (exact && tx !== text) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
      if (minTop && r.top < minTop) continue;
      const area = r.width * r.height;
      if (area < bestArea) { best = el; bestArea = area; }
    }
    return best;
  }
  // 圆点底下那个能滚的；没有就挑屏幕上最大的那个能滚的
  function findScroller(x, y) {
    // ⚠️遮罩盖在最上面，elementFromPoint 只会拿到遮罩自己——要往下数第一个不是遮罩的
    let el = (document.elementsFromPoint ? document.elementsFromPoint(x, y) : [document.elementFromPoint(x, y)]).find(e => e && !e.closest("[data-peek-overlay]")) || null;
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

  // props: charName, avatarChar, script(null＝还在想), goHome(), onOpen(app, who)（主屏找不到时直接打开）, onBack(), onDone(thoughts)
  function PeekPlayer(props) {
    const h = React.createElement, t = (typeof useTheme === "function" ? useTheme() : {}) || {};
    const [dot, setDot] = React.useState({ x: window.innerWidth / 2, y: window.innerHeight * 0.62, down: false });
    const [thought, setThought] = React.useState("");
    const [caption, setCaption] = React.useState("接过了你的手机…");
    const stopRef = React.useRef(false);
    const doneRef = React.useRef(false);
    const logRef = React.useRef([]);
    const openViaHomeLast = React.useRef("");
    const tapEl = async el => {
      const r = el.getBoundingClientRect();
      setDot({ x: r.left + r.width / 2, y: r.top + r.height / 2, down: false });
      await sleep(650);
      setDot(d => ({ ...d, down: true })); await sleep(160);
      try { el.click(); } catch (e) {}
      setDot(d => ({ ...d, down: false }));
    };
    const swipe = async dir => {
      const y = window.innerHeight * 0.45, a = window.innerWidth * 0.78, b = window.innerWidth * 0.22;
      setDot({ x: dir > 0 ? a : b, y, down: true }); await sleep(260);
      setDot({ x: dir > 0 ? b : a, y, down: true });
      window.__homeNav.go(window.__homeNav.page() + dir);
      await sleep(520); setDot(d => ({ ...d, down: false })); await sleep(250);
    };
    // 回主屏 → 一页页滑过去找 → 点开（文件夹里的先点开文件夹）。哪一步找不到就回 false，外面直接打开兜底
    const lastAppRef = openViaHomeLast;
    const openViaHome = async (app, who) => {
      const spot = HOME_SPOT[app];
      if (!spot || !props.goHome) return false;
      // 人已经在「信息」里了（刚翻完聊天、列表或钱包），下一样还在信息里：不回主屏，退回信息再点
      //   （她 2026-10-01：「看完一条退出信息然后再进再点开」「刚看完消息就直接点我-钱包过来」）
      const IN_MSG = ["chat", "messages", "wallet"];
      if (IN_MSG.indexOf(app) >= 0 && IN_MSG.indexOf(lastAppRef.current) >= 0 && props.toMessages) {
        setCaption(app === "wallet" ? "点开「我」，找钱包" : app === "chat" && who ? "退回聊天列表，找" + who : "退回聊天列表");
        props.toMessages(); await sleep(800);
        for (const step of (spot.path || [])) {
          const n = findByText(step.text, step.minTopK ? window.innerHeight * step.minTopK : 0, !!step.exact);
          if (!n) { if (step.optional) continue; return false; }
          await tapEl(n); await sleep(800);
        }
        if (app === "chat" && who) { const n = findByText(who); if (!n) return false; await tapEl(n); await sleep(900); }
        return true;
      }
      setCaption("回到主屏，找" + (props.labelOf ? props.labelOf(app, "") : app));
      props.goHome(); await sleep(900);
      let el = null, inner = null;
      if (spot.dock) el = findByText(spot.dock, window.innerHeight * 0.72);
      else {
        el = document.querySelector('#root [data-appkey="' + spot.key + '"]');
        if (!el) { const fid = folderOf(spot.key); if (fid) { el = document.querySelector('#root [data-appkey="' + fid + '"]'); inner = spot.key; } }
      }
      if (!el) return false;
      let guard = 0;
      while (window.__homeNav && guard++ < 6) {
        const r = el.getBoundingClientRect();
        if (r.left >= 0 && r.right <= window.innerWidth) break;
        await swipe(r.left < 0 ? -1 : 1);
      }
      // 组件（w_ 开头）外壳本身不接点击，点它里面那颗按钮
      if (/^w_/.test(spot.key || "")) {
        const btn = el.querySelector("button, [role=button]");
        if (btn) el = btn;
      }
      await tapEl(el);
      if (inner) {
        await sleep(750);
        const it = document.querySelector('#root [data-appkey="' + inner + '"]');
        if (!it) return false;
        await tapEl(it);
      }
      await sleep(950);
      // 点完还停在主屏＝没点开（主屏上才有 data-appkey）：交给外面直接打开
      if (document.querySelector("#root [data-appkey]")) return false;
      // 还要再点几下才到的（钱包：信息 →「我」→「我的钱包」）
      for (const step of (spot.path || [])) {
        if (step.call === "diaryMine") {
          if (window.__diaryNav && window.__diaryNav.openMine) { window.__diaryNav.openMine(); await sleep(900); }
          continue;
        }
        const n = findByText(step.text, step.minTopK ? window.innerHeight * step.minTopK : 0, !!step.exact);
        if (!n) { if (step.optional) continue; return false; }
        await tapEl(n); await sleep(900);
      }
      if (app === "chat" && who) { const n = findByText(who); if (!n) return false; await tapEl(n); await sleep(900); }
      return true;
    };
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
            let ok = false;
            try { ok = await openViaHome(s.app, s.who); } catch (e) { ok = false; }
            openViaHomeLast.current = s.app;
            if (!alive || stopRef.current) return;
            setCaption("在翻：" + (props.labelOf ? props.labelOf(s.app, s.who) : s.app));
            if (!ok) { props.onOpen && props.onOpen(s.app, s.who); await sleep(1100); }
          } else if (s.do === "tap") {
            const el = findByText(s.text, s.bottom ? window.innerHeight * 0.8 : 0, !!s.exact);
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
