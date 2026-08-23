// ============================================================
// 文风预设台 · 界面（style lab）
//
// 一个独立的屏：在这里搭预设、调顺序、试写对比。线下 / 小剧场 / 同人文的设置页
// 各有一个「去预设台」按钮跳进来，返回时回到原来那一页（app.js 记着从哪来的）。
// 这里【只】生产预设，不改任何一处的开关——吃不吃由三处各自的开关决定。
// ============================================================
(function () {
  const useState = React.useState, useRef = React.useRef, useEffect = React.useEffect;

  // 图标：三条粗细不同的横杠，像调音台的推子
  window.GStyleLab = p => h(Svg, p,
    h("path", { d: "M4 7h16" }), h("path", { d: "M4 12h16" }), h("path", { d: "M4 17h16" }),
    h("circle", { cx: 9, cy: 7, r: 2 }), h("circle", { cx: 15, cy: 12, r: 2 }), h("circle", { cx: 7, cy: 17, r: 2 }));

  const rid2 = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const cnt = s => String(s || "").replace(/\s/g, "").length;

  function StyleLabApp(props) {
    const t = useTheme();
    const SP = window.StylePresets;
    const [tab, setTab] = useState("build");             // build | test
    const [presets, setPresets] = useState(() => SP.list());
    const [curId, setCurId] = useState(() => { const l = SP.list(); return l.length ? l[0].id : ""; });
    const [openCat, setOpenCat] = useState({});
    const [showFull, setShowFull] = useState(false);
    // 删除一律「点一下问一句、再点一下才删」。以前用 confirm()，装成 PWA 之后不一定弹得出来，
    // 弹不出来时代码会当成「取消」——表现就是「按了没反应」，跟按钮太小的症状一模一样，
    // 查起来会绕远路。行内确认还有个好处：第一下就有可见反馈，按没按到一眼就知道。
    const [armed, setArmed] = useState("");        // 非空=这个 id 的删除已经问过一次，再点就真删
    const fileRef = useRef(null);

    const cur = presets.find(p => p.id === curId) || null;

    const commit = next => { SP.save(next); setPresets(next); };
    const patchCur = patch => { if (!cur) return; commit(presets.map(p => p.id === cur.id ? Object.assign({}, p, patch) : p)); };

    const addPreset = (seed) => {
      const p = Object.assign({ id: rid2("sp_"), name: "新预设", mods: [], free: "", freePos: "after", ts: Date.now() }, seed || {});
      commit(presets.concat([p])); setCurId(p.id); return p;
    };
    const dupPreset = () => { if (!cur) return; const p = Object.assign({}, cur, { id: rid2("sp_"), name: cur.name + " 副本", ts: Date.now() }); commit(presets.concat([p])); setCurId(p.id); };
    const delPreset = () => {
      if (!cur) return;
      if (armed !== cur.id) { setArmed(cur.id); return; }
      const next = presets.filter(p => p.id !== cur.id);
      setArmed(""); commit(next); setCurId(next.length ? next[0].id : "");
    };
    const toggleMod = id => {
      if (!cur) return;
      const has = (cur.mods || []).indexOf(id) >= 0;
      patchCur({ mods: has ? cur.mods.filter(x => x !== id) : (cur.mods || []).concat([id]) });
    };
    const moveMod = (id, d) => {
      if (!cur) return;
      const a = (cur.mods || []).slice();
      const i = a.indexOf(id), j = i + d;
      if (i < 0 || j < 0 || j >= a.length) return;
      a[i] = a[j]; a[j] = id;
      patchCur({ mods: a });
    };

    // 一段文字进来之后：像 json 就当模块包，否则整段当一条手写预设。
    // ⚠️判定看的是内容不是文件名——iOS 选文件常常把扩展名吃掉。
    const takeText = (txt, fallbackName) => {
      let d = null;
      if (/^\s*[{\[]/.test(txt)) { try { d = JSON.parse(txt); } catch (err) { d = null; } }
      if (d && (Array.isArray(d.modules) || Array.isArray(d.presets))) {
        const r = SP.importBundle(d);
        const next = SP.list();
        setPresets(next);
        if (!curId && next.length) setCurId(next[0].id);
        const firstCat = ((d.modules || [])[0] || {}).cat;
        if (firstCat) setOpenCat(o => Object.assign({}, o, { [firstCat]: true }));
        props.toast && props.toast("导入了 " + r.modules + " 个模块" + (r.presets ? " 和 " + r.presets + " 条预设" : "") + "，在下面模块库里勾");
        return "bundle";
      }
      if (d) throw new Error("这是个 json，但里面没有 modules／presets，不是模块包");
      addPreset({ name: String(fallbackName || "").trim() || "导入的预设", free: txt.trim() });
      props.toast && props.toast("导入了 " + cnt(txt) + " 字，进「手写／导入」那一格了");
      return "free";
    };
    // 只读开头一小段来判形状，别为了看一眼把整个文件读两遍
    const peek = async file => { try { return await file.slice(0, 64).text(); } catch (e) { return ""; } };
    const pasteBundle = () => {
      const txt = prompt("把模块包的 json 整段粘贴进来（从「文件」里选不出来时用这个）：", "");
      if (!txt || !txt.trim()) return;
      try { takeText(txt.trim(), "粘贴进来的"); } catch (err) { alert("导入失败：" + (err && err.message || "内容读不出来")); }
    };
    const importFile = async e => {
      const file = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!file) return;
      try {
        const looksJson = /^\s*[{\[]/.test(await peek(file));
        const txt = looksJson || typeof readOfflineStyleDocument !== "function" ? await file.text() : await readOfflineStyleDocument(file);
        if (!txt || !txt.trim()) throw new Error("文件里没有读到文字");
        takeText(txt, file.name.replace(/\.(docx|txt|md|json)$/i, "").trim());
      } catch (err) { alert("导入失败：" + (err && err.message || "请改用 txt 文件")); }
    };
    // 老的自定义文风（x_offlineStyles）搬一条过来当手写块，原来那条不动。
    const importOldStyle = () => {
      let old = [];
      try { old = (typeof loadJSON === "function" ? loadJSON("x_offlineStyles", []) : []) || []; } catch (e) { old = []; }
      const cands = old.filter(s => s && s.custom && String(s.prompt || "").trim());
      if (!cands.length) return props.toast && props.toast("线下那边还没有自定义文风");
      const pick = prompt("搬哪一条过来？填序号：\n" + cands.map((s, i) => (i + 1) + ". " + s.name + "（" + cnt(s.prompt) + " 字）").join("\n"), "1");
      const i = Number(pick) - 1;
      if (!(i >= 0 && i < cands.length)) return;
      addPreset({ name: cands[i].name, free: String(cands[i].prompt).trim() });
      props.toast && props.toast("搬过来了，原来那条还在线下留着");
    };

    const assembled = cur ? SP.textFor(cur, null, { uName: (props.profile && props.profile.name) || "你" }) : "";
    const S = {
      chip: on => ({ padding: "6px 12px", borderRadius: 999, border: "1px solid " + (on ? t.ink : t.line), background: on ? t.ink : "transparent", color: on ? t.bg2 : t.sub, fontFamily: F_BODY, fontSize: 12.5 }),
      dash: { padding: "6px 12px", borderRadius: 999, border: "1px dashed " + t.line, background: "transparent", color: t.fog, fontFamily: F_BODY, fontSize: 12.5 },
      h2: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.sub, marginBottom: 3 },
      hint: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, lineHeight: 1.6 },
      card: { background: t.bg, border: "1px solid " + t.line, borderRadius: 9, padding: 11 },
      tapGhost: color => ({ minHeight: 40, padding: "9px 14px", borderRadius: 999, border: "1px solid " + t.line, background: "transparent", color: color, fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1 }),
      tapIcon: color => ({ minWidth: 38, minHeight: 38, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: color, fontSize: 15, padding: 0 }),
      input: { width: "100%", padding: "9px 11px", borderRadius: 8, border: "1px solid " + t.line, background: t.bg2, fontFamily: F_BODY, fontSize: 13, color: t.ink, outline: "none" }
    };

    // ---- 搭预设 ----
    const buildTab = h("div", { style: { padding: "14px 14px 28px" } },
      h("div", { style: { display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 14 } },
        presets.map(p => h("button", { key: p.id, onClick: () => setCurId(p.id), style: S.chip(p.id === curId) },
          p.name + " · " + ((p.mods || []).length + (String(p.free || "").trim() ? 1 : 0)))),
        h("button", { key: "__add", onClick: () => addPreset(), style: S.dash }, "＋ 新建"),
        h("button", { key: "__imp", onClick: () => fileRef.current && fileRef.current.click(), style: S.dash }, "⇧ 导入"),
        h("button", { key: "__paste", onClick: pasteBundle, style: S.dash }, "粘贴模块包"),
        h("button", { key: "__old", onClick: importOldStyle, style: S.dash }, "搬旧文风"),
        h("input", { key: "__f", ref: fileRef, type: "file", accept: ".docx,.txt,.md,.json,text/plain,application/json,*/*", style: { display: "none" }, onChange: importFile })),

      !cur
        ? h("div", { style: Object.assign({}, S.hint, { lineHeight: 1.9 }) },
            "还没有预设。\n\n「＋新建」从模块搭一条；「⇧导入文件」把你写好的整篇文风塞进来；\n「搬旧文风」把线下那边已有的自定义文风搬过来（原来那条不动）。\n\n" +
            "搭好之后，去线下／小剧场／同人文的设置里打开「吃入文风预设」并选中它。不打开＝三处行为和以前完全一样。")
        : h("div", null,
            h("input", { value: cur.name, onChange: e => patchCur({ name: e.target.value }), placeholder: "预设名字", style: Object.assign({}, S.input, { marginBottom: 14 }) }),

            // 已选：顺序就是喂进去的顺序
            h("div", { style: { marginBottom: 16 } },
              h("div", { style: S.h2 }, "已选 · 按这个顺序喂进去"),
              h("div", { style: Object.assign({}, S.hint, { marginBottom: 8 }) }, "越靠后的模型看得越重。所以把最容易被违反的那条放最后。"),
              (cur.mods || []).length === 0
                ? h("div", { style: Object.assign({}, S.card, S.hint) }, "一条都没勾。下面按分类勾。")
                : h("div", { style: { display: "flex", flexDirection: "column", gap: 6 } },
                    (cur.mods || []).map((id, i) => {
                      const m = SP.moduleById(id);
                      return h("div", { key: id, style: Object.assign({ display: "flex", alignItems: "center", gap: 8 }, S.card) },
                        h("span", { style: { fontFamily: "monospace", fontSize: 10.5, color: t.fog, width: 16 } }, String(i + 1)),
                        h("div", { style: { flex: 1 } },
                          h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink } }, m ? m.name : "（已失效：" + id + "）"),
                          m && m.builtinIn ? h("div", { style: Object.assign({}, S.hint, { fontSize: 10.5, marginTop: 1 }) }, "小剧场本来就有这条，在那边会自动跳过") : null),
                        h("button", { onClick: () => moveMod(id, -1), style: S.tapIcon(t.fog) }, "↑"),
                        h("button", { onClick: () => moveMod(id, 1), style: S.tapIcon(t.fog) }, "↓"),
                        h("button", { onClick: () => toggleMod(id), style: S.tapIcon(t.accent) }, "×"));
                    }))),

            // 模块库
            h("div", { style: { marginBottom: 16 } },
              h("div", { style: S.h2 }, "模块库"),
              h("div", { style: Object.assign({}, S.hint, { marginBottom: 8 }) }, "点分类展开。勾上就进上面的「已选」，再去调顺序。"),
              SP.allCats().map(c => h("div", { key: c.id, style: { marginBottom: 6 } },
                h("button", { onClick: () => setOpenCat(o => Object.assign({}, o, { [c.id]: !o[c.id] })),
                  style: { width: "100%", textAlign: "left", padding: "9px 11px", borderRadius: 9, border: "1px solid " + t.line, background: t.bg, display: "flex", alignItems: "center", gap: 8 } },
                  h("span", { style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: t.ink } }, c.zh),
                  h("span", { style: Object.assign({}, S.hint, { flex: 1 }) }, c.hint),
                  h("span", { style: { fontFamily: "monospace", fontSize: 10.5, color: t.fog } },
                    c.mods.filter(m => (cur.mods || []).indexOf(m.id) >= 0).length + "/" + c.mods.length),
                  h("span", { style: { color: t.fog, fontSize: 12 } }, openCat[c.id] ? "▾" : "▸")),
                openCat[c.id]
                  ? h("div", { style: { padding: "6px 0 2px 6px", display: "flex", flexDirection: "column", gap: 5 } },
                      // 「删」是独立按钮、不是套在模块按钮里的 span——按钮套按钮在 iOS 上点谁很看运气
                      c.mods.map(m => {
                        const on = (cur.mods || []).indexOf(m.id) >= 0;
                        return h("div", { key: m.id, style: { display: "flex", alignItems: "stretch", gap: 4 } },
                          h("button", { onClick: () => toggleMod(m.id),
                            style: { flex: 1, textAlign: "left", padding: "10px 10px", borderRadius: 8, border: "1px solid " + (on ? t.tint : t.line), background: on ? (t.bg2 || "transparent") : "transparent", display: "flex", gap: 9, alignItems: "flex-start" } },
                            h("span", { style: { fontSize: 12, color: on ? t.tint : t.fog, lineHeight: 1.5 } }, on ? "✓" : "○"),
                            h("span", { style: { flex: 1 } },
                              h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 12.5, color: t.ink } }, m.name),
                              h("span", { style: Object.assign({ display: "block", marginTop: 2 }, S.hint) }, m.hint))),
                          m.user ? h("button", { onClick: () => {
                              if (armed !== m.id) { setArmed(m.id); return; }
                              SP.removeUserModule(m.id); setArmed(""); setPresets(SP.list().slice()); },
                            style: Object.assign({}, S.tapIcon(armed === m.id ? t.accent : t.fog), { fontSize: 11.5, borderRadius: 8, border: "1px solid " + (armed === m.id ? t.accent : t.line) }) },
                            armed === m.id ? "真删" : "删") : null);
                      }))
                  : null))),

            // 手写 / 导入
            h("div", { style: { marginBottom: 16 } },
              h("div", { style: S.h2 }, "手写 ／ 导入" + (String(cur.free || "").trim() ? " · " + cnt(cur.free) + " 字" : "")),
              h("div", { style: Object.assign({}, S.hint, { marginBottom: 8 }) }, "整段贴进来就行，不用拆。你从酒馆搬的那种一整篇的文风放这儿最合适。"),
              h("textarea", { value: cur.free || "", onChange: e => patchCur({ free: e.target.value }), rows: 6,
                placeholder: "粘贴一整篇文风说明…", style: Object.assign({}, S.input, { lineHeight: 1.7, resize: "vertical" }) }),
              /^\s*[{\[]/.test(cur.free || "")
                ? h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 8 } },
                    h("span", { style: Object.assign({}, S.hint, { color: t.tint, flex: 1 }) }, "这一坨看着是模块包，不该整段躺在这儿"),
                    h("button", { onClick: () => {
                        try {
                          const kind = takeText(String(cur.free), cur.name);
                          if (kind === "bundle") commit(SP.list().filter(p => p.id !== cur.id));
                        } catch (err) { alert("拆不开：" + (err && err.message || "内容读不出来")); }
                      }, style: { padding: "6px 12px", borderRadius: 999, border: "none", background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 12 } }, "拆成模块"))
                : null,
              h("div", { style: { display: "flex", gap: 7, marginTop: 8, alignItems: "center" } },
                h("span", { style: S.hint }, "放在模块的"),
                h("button", { onClick: () => patchCur({ freePos: "before" }), style: S.chip(cur.freePos === "before") }, "前面"),
                h("button", { onClick: () => patchCur({ freePos: "after" }), style: S.chip(cur.freePos !== "before") }, "后面"))),

            // 预览
            h("div", { style: { marginBottom: 16 } },
              h("div", { style: { display: "flex", alignItems: "baseline", gap: 8 } },
                h("div", { style: S.h2 }, "组装出来长这样"),
                h("span", { style: { fontFamily: "monospace", fontSize: 10.5, color: t.fog } }, cnt(assembled) + " 字"),
                h("button", { onClick: () => setShowFull(v => !v), style: Object.assign({}, S.tapGhost(t.tint), { marginLeft: "auto", border: "none" }) }, showFull ? "收起" : "看全文")),
              h("div", { style: Object.assign({}, S.card, { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.75, color: t.sub, whiteSpace: "pre-wrap", maxHeight: showFull ? "none" : 150, overflow: "hidden" }) },
                assembled || "（空的——勾几条模块，或者贴一段进去）")),

            h("div", { style: { display: "flex", gap: 10, alignItems: "center" } },
              h("button", { onClick: dupPreset, style: S.tapGhost(t.tint) }, "复制一份"),
              h("button", { onClick: delPreset, style: Object.assign({}, S.tapGhost(t.accent), armed === cur.id ? { background: t.accent, color: "#fff", borderColor: t.accent } : null) },
                armed === cur.id ? "真删？再点一下" : "删掉这条"),
              armed === cur.id
                ? h("button", { onClick: () => setArmed(""), style: S.tapGhost(t.fog) }, "算了")
                : null)));

    // ---- 测试台 ----
    const chars = props.characters || [];
    const [tChar, setTChar] = useState(() => (chars[0] && chars[0].id) || "");
    const [tScene, setTScene] = useState(SP.TEST_SCENES[0].id);
    const [tMin, setTMin] = useState(600);
    const [tPicks, setTPicks] = useState([]);           // 要跑的预设 id；"" 代表对照组（不吃预设）
    const [runs, setRuns] = useState(() => SP.loadRuns());
    const [busy, setBusy] = useState("");
    const [openRun, setOpenRun] = useState({});

    const togglePick = id => setTPicks(a => a.indexOf(id) >= 0 ? a.filter(x => x !== id) : a.concat([id]));

    const doRun = async () => {
      if (busy) return;
      if (!props.active) return props.toast && props.toast("请先配置线下 API");
      const char = chars.find(c => c.id === tChar);
      if (!char) return props.toast && props.toast("先选个角色");
      const scene = SP.TEST_SCENES.find(s => s.id === tScene) || SP.TEST_SCENES[0];
      const picks = tPicks.length ? tPicks : [""];
      let acc = runs;
      for (let i = 0; i < picks.length; i++) {
        const pid = picks[i];
        const preset = pid ? SP.byId(pid) : null;
        setBusy((preset ? preset.name : "对照组") + "（" + (i + 1) + "/" + picks.length + "）");
        try {
          const r = await SP.runTest(props.active, {
            char: char, preset: preset, scene: scene, minWords: tMin,
            uName: (props.profile && props.profile.name) || "你"
          });
          acc = SP.pushRun({ id: rid2("run_"), presetName: preset ? preset.name : "对照组 · 不吃预设",
            presetId: pid || "", charName: char.name, sceneName: scene.name,
            chars: r.chars, text: r.text, notes: r.notes || [], want: tMin, ts: Date.now() });
          setRuns(acc);
        } catch (e) {
          acc = SP.pushRun({ id: rid2("run_"), presetName: preset ? preset.name : "对照组 · 不吃预设",
            presetId: pid || "", charName: char.name, sceneName: scene.name, chars: 0, text: "", err: String(e && e.message || e), ts: Date.now() });
          setRuns(acc);
        }
      }
      setBusy("");
    };

    const testTab = h("div", { style: { padding: "14px 14px 28px" } },
      h("div", { style: Object.assign({}, S.hint, { marginBottom: 14, lineHeight: 1.8 }) },
        "同一个人设、同一个场景、只有预设不同——这样比出来的差别才真的是预设的差别。\n剧本是固定的，别改，改了就没法比。"),

      h("div", { style: { marginBottom: 13 } },
        h("div", { style: S.h2 }, "谁来写"),
        h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 } },
          chars.map(c => h("button", { key: c.id, onClick: () => setTChar(c.id), style: S.chip(c.id === tChar) }, c.name)))),

      h("div", { style: { marginBottom: 13 } },
        h("div", { style: S.h2 }, "哪一场"),
        h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, margin: "6px 0 6px" } },
          SP.TEST_SCENES.map(s => h("button", { key: s.id, onClick: () => setTScene(s.id), style: S.chip(s.id === tScene) }, s.name))),
        h("div", { style: Object.assign({}, S.card, S.hint, { lineHeight: 1.7 }) },
          (SP.TEST_SCENES.find(s => s.id === tScene) || {}).setting + "\n你：" + (SP.TEST_SCENES.find(s => s.id === tScene) || {}).user)),

      h("div", { style: { marginBottom: 13 } },
        h("div", { style: S.h2 }, "跑哪几份 · 可多选"),
        h("div", { style: Object.assign({}, S.hint, { marginBottom: 6 }) }, "勾几份就连着跑几次，结果并排堆在下面。「对照组」是完全不吃预设，用来做基线。"),
        h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } },
          [h("button", { key: "__base", onClick: () => togglePick(""), style: S.chip(tPicks.indexOf("") >= 0) }, "对照组")]
            .concat(presets.map(p => h("button", { key: p.id, onClick: () => togglePick(p.id), style: S.chip(tPicks.indexOf(p.id) >= 0) }, p.name))))),

      h("div", { style: { marginBottom: 16 } },
        h("div", { style: { display: "flex", alignItems: "baseline", gap: 8 } },
          h("div", { style: S.h2 }, "最低字数"),
          h("span", { style: { fontFamily: "monospace", fontSize: 11, color: t.tint } }, tMin ? String(tMin) : "不限")),
        h("input", { type: "range", min: 0, max: 3000, step: 100, value: tMin, onChange: e => setTMin(Number(e.target.value)), style: { width: "100%" } })),

      h("button", { onClick: doRun, disabled: !!busy,
        style: { width: "100%", padding: "12px", borderRadius: 9, border: "none", background: busy ? t.line : t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 13.5, marginBottom: 18 } },
        busy ? "在写 " + busy + "…" : "试写"),

      runs.length
        ? h("div", null,
            h("div", { style: { display: "flex", alignItems: "baseline", marginBottom: 8 } },
              h("div", { style: S.h2 }, "结果 · 最近 " + runs.length + " 次"),
              h("button", { onClick: () => { if (armed !== "__runs") { setArmed("__runs"); return; } setArmed(""); setRuns(SP.clearRuns()); },
                style: Object.assign({}, S.tapGhost(armed === "__runs" ? t.accent : t.fog), { marginLeft: "auto" }) }, armed === "__runs" ? "真清空？再点一下" : "清空")),
            h("div", { style: { display: "flex", flexDirection: "column", gap: 9 } },
              runs.map(r => h("div", { key: r.id, style: S.card },
                h("div", { style: { display: "flex", alignItems: "baseline", gap: 7, marginBottom: 6 } },
                  h("span", { style: { fontFamily: F_DISPLAY, fontSize: 12.5, color: t.ink } }, r.presetName),
                  h("span", { style: Object.assign({}, S.hint, { fontSize: 10.5 }) }, r.charName + " · " + r.sceneName),
                  h("span", { style: { marginLeft: "auto", fontFamily: "monospace", fontSize: 10.5, color: r.err || (r.want && r.chars < r.want) ? t.accent : t.fog } },
                    r.err ? "失败" : r.chars + " 字" + (r.want ? " / " + r.want : ""))),
                (r.notes || []).length ? h("div", { style: Object.assign({}, S.hint, { fontSize: 10.5, marginBottom: 5, color: t.tint }) }, (r.notes || []).join("　·　")) : null,
                r.err
                  ? h("div", { style: Object.assign({}, S.hint, { color: t.accent }) }, r.err)
                  : h("div", null,
                      h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.85, color: t.sub, whiteSpace: "pre-wrap", maxHeight: openRun[r.id] ? "none" : 132, overflow: "hidden" } }, r.text),
                      h("button", { onClick: () => setOpenRun(o => Object.assign({}, o, { [r.id]: !o[r.id] })), style: Object.assign({}, S.tapGhost(t.tint), { border: "none", marginTop: 3, paddingLeft: 0 }) }, openRun[r.id] ? "收起" : "全文"))))))
        : null);

    return h("div", { style: { position: "relative", height: "100%", display: "flex", flexDirection: "column", background: t.bg } },
      h("div", { style: { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid " + t.line } },
        h("button", { onClick: props.onBack, style: { background: "none", border: "none", color: t.ink, fontSize: 19, padding: "2px 6px" } }, "←"),
        h("div", { style: { flex: 1, fontFamily: F_DISPLAY, fontSize: 17, color: t.ink } }, "文风预设台"),
        h("button", { onClick: () => setTab("build"), style: S.chip(tab === "build") }, "搭预设"),
        h("button", { onClick: () => setTab("test"), style: S.chip(tab === "test") }, "测试台")),
      h("div", { style: { flex: 1, overflowY: "auto" } }, tab === "build" ? buildTab : testTab));
  }
  window.StyleLabApp = StyleLabApp;
})();
