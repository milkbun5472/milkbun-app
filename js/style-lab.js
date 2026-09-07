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
    // ⚠️不许用原生 prompt：PWA 里它被吞掉、直接返回 null，这颗按钮就是个摆设（v64.88 那一批）
    const pasteBundle = () => requestAppPrompt("粘贴模块包", "把 json 整段贴进来（从「文件」里选不出来时用这个）。", "",
      function (txt) {
        if (!String(txt || "").trim()) { props.toast && props.toast("什么都没贴"); return; }
        try { takeText(String(txt).trim(), "粘贴进来的"); }
        catch (err) { props.toast && props.toast("导入失败：" + (err && err.message || "内容读不出来")); }
      }, "导入", { multiline: true });
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
      requestAppPrompt("搬哪一条过来？", cands.map((s, i) => (i + 1) + ". " + s.name + "（" + cnt(s.prompt) + " 字）").join("\n") + "\n\n填序号：", "1",
        function (pick) {
          const i = Number(String(pick || "").trim()) - 1;
          if (!(i >= 0 && i < cands.length)) { props.toast && props.toast("没有这个序号"); return; }
          addPreset({ name: cands[i].name, free: String(cands[i].prompt).trim() });
          props.toast && props.toast("搬过来了，原来那条还在线下留着");
        }, "搬过来");
    };

    const assembled = cur ? SP.textFor(cur, null, { uName: (props.profile && props.profile.name) || "你" }) : "";
    const S = {
      h2: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.sub, marginBottom: 3 },
      hint: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, lineHeight: 1.6 },
      card: { background: t.bg, border: "1px solid " + t.line, borderRadius: 9, padding: 11 },
      tapGhost: color => ({ minHeight: 40, padding: "9px 14px", borderRadius: 999, border: "1px solid " + t.line, background: "transparent", color: color, fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1 }),
      tapIcon: color => ({ minWidth: 40, minHeight: 40, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: color, fontSize: 15, padding: 0 }),
      input: { width: "100%", padding: "9px 11px", borderRadius: 8, border: "1px solid " + t.line, background: t.bg2, fontFamily: F_BODY, fontSize: 13, color: t.ink, outline: "none" },
      // 台边的家伙什：方角、小、不抢版的位置（跟「一块版」长得不一样才分得开）
      tool: { minHeight: 40, padding: "9px 12px", borderRadius: 6, border: "1px solid " + t.line, background: "transparent", color: t.sub, fontFamily: F_BODY, fontSize: 12 }
    };

    // 一块版长什么样，只画在这一处：搭预设那一排和测试台「印哪几块」共用。
    // ⚠️各画一份的话，哪天改版边的颜色就得记得改两处（施工规则/one-public-mechanism.md）。
    const plate = (o) => h("button", { key: o.key, onClick: o.onClick, "aria-pressed": o.on ? "true" : "false",
      className: "active:opacity-80",
      style: {
        display: "flex", alignItems: "stretch", minHeight: 44, padding: 0,
        borderRadius: "3px 5px 5px 3px",
        border: "1px solid " + (o.on ? t.ink : t.line),
        background: o.on ? t.bg2 : "rgba(127,127,127,.05)",
        transform: o.on ? "translateY(1px)" : "none",
        boxShadow: o.on ? "inset 0 2px 6px -5px rgba(0,0,0,.6)" : "0 3px 8px -7px rgba(0,0,0,.5)"
      } },
      h("span", { style: { width: 5, flexShrink: 0, borderRadius: "3px 0 0 3px", background: o.on ? (o.edge || t.accent) : t.line } }),
      h("span", { style: { padding: "6px 12px 6px 10px", textAlign: "left" } },
        h("span", { style: { display: "block", fontFamily: F_DISPLAY, fontSize: 13.5, color: o.on ? t.ink : t.sub } }, o.name),
        o.sub ? h("span", { style: { display: "block", fontFamily: "monospace", fontSize: 10, color: t.fog, marginTop: 1 } }, o.sub) : null));

    // ---- 搭预设 ----
    const buildTab = h("div", { style: { padding: "14px 14px 28px" } },
      // ── 台边搁着的那几块版（v65.10）───────────────────────────────
      // 一条预设在现实里就是【排好的一块版】：选中那块压在台面上——纸色、往下沉一格、
      // 左边那道版边上了墨；没选的还搁在架子上，抬着、暗一档、版边是灰的。
      // ⚠️原来这里是一排填色药丸：药丸搬到哪个 app 都成立，等于没设计
      //   （施工规则/tabs-not-plain-pills.md）。选中态同时变【底色、位置、版边、投影】，
      //   不只靠一个色差；整块可点区 44 高。
      presets.length ? h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 } },
        presets.map(p => plate({ key: p.id, on: p.id === curId, onClick: () => setCurId(p.id), name: p.name,
          sub: ((p.mods || []).length + (String(p.free || "").trim() ? 1 : 0)) + " 块" }))) : null,
      // 台边的小工具：跟「版」分开摆，不混进同一排里——它们不是版，是家伙什
      h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14,
          paddingTop: presets.length ? 9 : 0, borderTop: presets.length ? "1px dashed " + t.line : "none" } },
        [["＋ 新建", () => addPreset()],
         ["⇧ 导入文件", () => fileRef.current && fileRef.current.click()],
         ["粘贴模块包", pasteBundle],
         ["搬旧文风", importOldStyle]].map(pair => h("button", { key: pair[0], onClick: pair[1], style: S.tool }, pair[0])),
        h("input", { key: "__f", ref: fileRef, type: "file", accept: ".docx,.txt,.md,.json,text/plain,application/json,*/*", style: { display: "none" }, onChange: importFile })),

      // 空台：台上一个空版位（虚线的），底下三步。原来是一整段灰字糊在那儿——
      // 这是她点开这一页看见的第一屏，得让人一眼知道该先按哪个。
      !cur
        ? h("div", null,
            h("div", { style: { display: "flex", alignItems: "center", justifyContent: "center",
                minHeight: 88, borderRadius: "3px 5px 5px 3px", border: "1px dashed " + t.line,
                background: "rgba(127,127,127,.04)", marginBottom: 14 } },
              h("span", { style: Object.assign({}, S.hint, { fontSize: 12.5 }) }, "台上还没有版")),
            h("div", { style: { display: "flex", flexDirection: "column", gap: 9 } },
              [["1", "先从上面挑一样起手：「＋新建」从字条搭一块，「⇧导入文件」把你写好的整篇塞进来，「搬旧文风」把线下那边已有的搬过来（原来那条不动）。"],
               ["2", "在字盘里挑几根字条，它们会按顺序卡进槽里——越往下模型看得越重。"],
               ["3", "去线下／小剧场／同人文的设置里打开「吃入文风预设」并选中它。不打开＝三处行为和以前完全一样。"]]
                .map(function (row) {
                  return h("div", { key: row[0], style: { display: "flex", gap: 9, alignItems: "flex-start" } },
                    h("span", { style: { width: 18, height: 18, flexShrink: 0, borderRadius: 2, background: t.ink, color: t.bg2,
                      fontFamily: "monospace", fontSize: 10.5, display: "flex", alignItems: "center", justifyContent: "center" } }, row[0]),
                    h("span", { style: Object.assign({}, S.hint, { flex: 1, lineHeight: 1.75 }) }, row[1]));
                })))
        : h("div", null,
            h("input", { value: cur.name, onChange: e => patchCur({ name: e.target.value }), placeholder: "预设名字", style: Object.assign({}, S.input, { marginBottom: 14 }) }),

            // ── 已选＝排字槽（v65.10）────────────────────────────────
            // 顺序就是喂进去的顺序，所以它现实里是【一条排字槽】：几根字条挨着卡在槽里，
            // 左边那道墨色轨从头连到尾，号码印在轨上；槽底那一行写着「往下越重」，
            // 因为「重」这件事是有方向的，写在标题底下就看不出方向。
            // ⚠️原来是几张一模一样的圆角灰卡片，中间还留着缝——搬到哪个 app 都成立。
            h("div", { style: { marginBottom: 16 } },
              h("div", { style: S.h2 }, "已选 · 按这个顺序喂进去"),
              h("div", { style: Object.assign({}, S.hint, { marginBottom: 8 }) }, "把最容易被违反的那条放最后。"),
              h("div", { style: { border: "1px solid " + t.line, borderRadius: 4, overflow: "hidden", background: t.bg } },
                (cur.mods || []).length === 0
                  ? h("div", { style: { display: "flex", alignItems: "stretch", minHeight: 46 } },
                      h("span", { style: { width: 26, flexShrink: 0, background: t.line } }),
                      h("span", { style: Object.assign({ flex: 1, display: "flex", alignItems: "center", padding: "10px 12px",
                        margin: 6, border: "1px dashed " + t.line, borderRadius: 3 }, S.hint) }, "槽是空的。下面按分类勾，勾上的会卡进这里。"))
                  : h("div", null, (cur.mods || []).map((id, i) => {
                      const m = SP.moduleById(id);
                      return h("div", { key: id, style: { display: "flex", alignItems: "stretch",
                        borderTop: i ? "1px solid " + t.line : "none" } },
                        // 轨：一根从头连到尾的墨条，号码印在它上面
                        h("span", { style: { width: 26, flexShrink: 0, background: t.ink, color: t.bg2,
                          fontFamily: "monospace", fontSize: 10.5, display: "flex", alignItems: "center", justifyContent: "center" } }, String(i + 1)),
                        h("div", { style: { flex: 1, minWidth: 0, padding: "9px 4px 9px 11px", display: "flex", alignItems: "center", gap: 6 } },
                          h("div", { style: { flex: 1, minWidth: 0 } },
                            h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink } }, m ? m.name : "（已失效：" + id + "）"),
                            m && m.builtinIn ? h("div", { style: Object.assign({}, S.hint, { fontSize: 10.5, marginTop: 1 }) }, "小剧场本来就有这条，在那边会自动跳过") : null),
                          h("button", { onClick: () => moveMod(id, -1), "aria-label": "往前挪一格", style: S.tapIcon(t.fog) }, "↑"),
                          h("button", { onClick: () => moveMod(id, 1), "aria-label": "往后挪一格", style: S.tapIcon(t.fog) }, "↓"),
                          h("button", { onClick: () => toggleMod(id), "aria-label": "从槽里取出来", style: S.tapIcon(t.accent) }, "×")));
                    })),
                // 槽底那一行：方向感在这儿，不在标题里
                (cur.mods || []).length > 1
                  ? h("div", { style: { display: "flex", alignItems: "center", gap: 6, padding: "5px 10px 6px",
                      borderTop: "1px solid " + t.line, background: "rgba(127,127,127,.05)" } },
                      h("span", { style: { fontFamily: "monospace", fontSize: 11, color: t.fog } }, "↓"),
                      h("span", { style: Object.assign({}, S.hint, { fontSize: 10.5 }) }, "越往下，模型看得越重"))
                  : null)),

            // ── 模块库＝字盘（v65.10）──────────────────────────────────
            // 一格一格拉开，里面躺着一根根字条。挑中的那根【上了墨】——左端那个字面
            // 是实心的墨块，没挑的是空白的一格；上了墨的还往右让开一道压痕，
            // 因为它已经卡进上面那条槽里了。
            // ⚠️原来是「○ / ✓」加一圈圆角灰卡：那是任何 app 都能用的复选框
            //   （施工规则/tabs-not-plain-pills.md 那句判据对这一栏同样成立）。
            h("div", { style: { marginBottom: 16 } },
              h("div", { style: S.h2 }, "模块库"),
              h("div", { style: Object.assign({}, S.hint, { marginBottom: 8 }) }, "点一格拉开。挑中的字条会卡进上面那条槽里，再去那儿调顺序。"),
              SP.allCats().map(c => {
                const open = !!openCat[c.id];
                const picked = c.mods.filter(m => (cur.mods || []).indexOf(m.id) >= 0).length;
                return h("div", { key: c.id, style: { marginBottom: open ? 10 : 6 } },
                  h("button", { onClick: () => setOpenCat(o => Object.assign({}, o, { [c.id]: !o[c.id] })),
                    "aria-expanded": open ? "true" : "false",
                    style: { width: "100%", minHeight: 44, textAlign: "left", padding: "0 11px 0 0",
                      borderRadius: open ? "6px 6px 0 0" : 6,
                      border: "1px solid " + t.line, borderBottom: open ? "none" : "1px solid " + t.line,
                      background: open ? t.bg2 : "rgba(127,127,127,.05)",
                      display: "flex", alignItems: "center", gap: 8 } },
                    // 格口：字盘那一格上的指槽。拉开了它就上墨，一眼看出开的是哪一格
                    h("span", { style: { width: 11, alignSelf: "stretch", flexShrink: 0,
                      background: open ? t.accent : "transparent", borderRight: "1px solid " + t.line,
                      borderRadius: open ? "5px 0 0 0" : "5px 0 0 5px" } }),
                    h("span", { style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: t.ink } }, c.zh),
                    h("span", { style: Object.assign({}, S.hint, { flex: 1, minWidth: 0 }) }, c.hint),
                    h("span", { style: { fontFamily: "monospace", fontSize: 10.5, color: picked ? t.ink : t.fog,
                      border: "1px solid " + (picked ? t.ink : t.line), borderRadius: 3, padding: "1px 4px" } },
                      picked + "/" + c.mods.length)),
                  open
                    ? h("div", { style: { border: "1px solid " + t.line, borderTop: "none", borderRadius: "0 0 6px 6px",
                        background: t.bg, padding: "7px 8px 8px", display: "flex", flexDirection: "column", gap: 5 } },
                        // 「删」是独立按钮、不是套在模块按钮里的 span——按钮套按钮在 iOS 上点谁很看运气
                        c.mods.map(m => {
                          const on = (cur.mods || []).indexOf(m.id) >= 0;
                          return h("div", { key: m.id, style: { display: "flex", alignItems: "stretch", gap: 4 } },
                            h("button", { onClick: () => toggleMod(m.id), "aria-pressed": on ? "true" : "false",
                              style: { flex: 1, minWidth: 0, minHeight: 44, textAlign: "left", padding: "9px 10px 9px 8px",
                                borderRadius: 3, border: "1px solid " + (on ? t.ink : t.line),
                                background: on ? t.bg2 : "transparent",
                                marginLeft: on ? 6 : 0,
                                boxShadow: on ? "inset 3px 0 0 " + t.ink : "none",
                                display: "flex", gap: 9, alignItems: "flex-start" } },
                              // 字面：上了墨是实心墨块，没上是空白的一格
                              h("span", { style: { width: 15, height: 15, marginTop: 1, flexShrink: 0, borderRadius: 2,
                                background: on ? t.ink : "transparent", border: "1px solid " + (on ? t.ink : t.line) } }),
                              h("span", { style: { flex: 1, minWidth: 0 } },
                                h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 12.5, color: t.ink } }, m.name),
                                h("span", { style: Object.assign({ display: "block", marginTop: 2 }, S.hint) }, m.hint))),
                            m.user ? h("button", { onClick: () => {
                                if (armed !== m.id) { setArmed(m.id); return; }
                                SP.removeUserModule(m.id); setArmed(""); setPresets(SP.list().slice()); },
                              style: Object.assign({}, S.tapIcon(armed === m.id ? t.accent : t.fog), { fontSize: 11.5, borderRadius: 3, border: "1px solid " + (armed === m.id ? t.accent : t.line) }) },
                              armed === m.id ? "真删" : "删") : null);
                        }))
                    : null);
              })),

            // 手写 / 导入
            h("div", { style: { marginBottom: 16 } },
              h("div", { style: S.h2 }, "手写 ／ 导入" + (String(cur.free || "").trim() ? " · " + cnt(cur.free) + " 字" : "")),
              h("div", { style: Object.assign({}, S.hint, { marginBottom: 8 }) }, "整段贴进来就行，不用拆。你从酒馆搬的那种一整篇的文风放这儿最合适。"),
              // 手写那一段是【一张稿子】，不是一个通用输入框：左边留出页边、竖一道红线
              h("div", { style: { position: "relative", border: "1px solid " + t.line, borderRadius: 3, background: t.bg2, overflow: "hidden" } },
                h("span", { "aria-hidden": "true", style: { position: "absolute", left: 22, top: 0, bottom: 0, width: 1, background: "rgba(194,90,74,.30)" } }),
                h("textarea", { value: cur.free || "", onChange: e => patchCur({ free: e.target.value }), rows: 6,
                  placeholder: "粘贴一整篇文风说明…",
                  style: { width: "100%", border: "none", outline: "none", background: "transparent", resize: "vertical",
                    padding: "10px 11px 10px 30px", fontFamily: F_BODY, fontSize: 13, lineHeight: 1.7, color: t.ink } })),
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
              // 稿子排在字条前面还是后面：这是【位置】问题，所以画成位置本身，不是两颗药丸。
              // 一张纸＋三根字条，谁在左谁在前——不用读字也看得懂哪个是哪个。
              (function () {
                const paper = h("span", { key: "p", style: { width: 15, height: 11, flexShrink: 0, borderRadius: 1,
                  background: t.bg2, border: "1px solid " + t.ink, borderLeft: "2px solid " + t.accent } });
                const slugs = h("span", { key: "s", style: { display: "flex", gap: 2 } },
                  [0, 1, 2].map(i => h("span", { key: i, style: { width: 4, height: 11, borderRadius: 1, background: t.ink, opacity: .75 } })));
                const one = (val, label) => {
                  const on = val === "before" ? cur.freePos === "before" : cur.freePos !== "before";
                  return h("button", { key: val, onClick: () => patchCur({ freePos: val }), "aria-pressed": on ? "true" : "false",
                    style: { minHeight: 44, padding: "7px 10px", borderRadius: 4, border: "1px solid " + (on ? t.ink : t.line),
                      background: on ? t.bg2 : "transparent", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 } },
                    h("span", { style: { display: "flex", alignItems: "center", gap: 4, opacity: on ? 1 : .45 } },
                      val === "before" ? [paper, slugs] : [slugs, paper]),
                    h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: on ? t.ink : t.fog } }, label));
                };
                return h("div", { style: { display: "flex", gap: 7, marginTop: 9, alignItems: "center" } },
                  h("span", { style: Object.assign({}, S.hint, { marginRight: 1 }) }, "这张稿排在"),
                  one("before", "字条前面"), one("after", "字条后面"));
              })()),

            // 预览
            h("div", { style: { marginBottom: 16 } },
              h("div", { style: { display: "flex", alignItems: "baseline", gap: 8 } },
                h("div", { style: S.h2 }, "组装出来长这样"),
                h("span", { style: { fontFamily: "monospace", fontSize: 10.5, color: t.fog } }, cnt(assembled) + " 字"),
                h("button", { onClick: () => setShowFull(v => !v), style: Object.assign({}, S.tapGhost(t.tint), { marginLeft: "auto", border: "none" }) }, showFull ? "收起" : "看全文")),
              // 样张：一张印出来的纸。收起时下缘【褪下去】而不是被硬切一刀——
              // 硬切看着像内容没加载完，褪下去才读得出「后面还有」。
              h("div", { style: { position: "relative", background: t.bg2, border: "1px solid " + t.line, borderRadius: 3,
                  padding: "11px 12px", maxHeight: showFull ? "none" : 150, overflow: "hidden" } },
                h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.75, color: t.sub, whiteSpace: "pre-wrap" } },
                  assembled || "（空的——挑几根字条，或者贴一段进去）"),
                !showFull && assembled
                  ? h("span", { "aria-hidden": "true", style: { position: "absolute", left: 0, right: 0, bottom: 0, height: 34,
                      background: "linear-gradient(180deg, rgba(255,255,255,0) 0%, " + t.bg2 + " 92%)" } })
                  : null)),

            // 台脚那几颗跟台边的家伙什长一个样（都是工具，不是版）
            h("div", { style: { display: "flex", gap: 6, alignItems: "center", paddingTop: 9, borderTop: "1px dashed " + t.line } },
              h("button", { onClick: dupPreset, style: Object.assign({}, S.tool, { color: t.tint }) }, "复制一份"),
              h("button", { onClick: delPreset, style: Object.assign({}, S.tool, { color: t.accent },
                armed === cur.id ? { background: t.accent, color: "#fff", borderColor: t.accent } : null) },
                armed === cur.id ? "真删？再点一下" : "删掉这块版"),
              armed === cur.id
                ? h("button", { onClick: () => setArmed(""), style: Object.assign({}, S.tool, { color: t.fog }) }, "算了")
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

      // 谁来写：一排名牌。选中那张往下压、上墨边——不是一颗填色药丸。
      // 有头像就带着头像：这一屏比的是「同一个人写出来的两版」，人得是认得出的那个人。
      h("div", { style: { marginBottom: 13 } },
        h("div", { style: S.h2 }, "谁来写"),
        h("div", { style: { display: "flex", flexWrap: "wrap", gap: 7, marginTop: 6 } },
          chars.map(c => {
            const on = c.id === tChar;
            return h("button", { key: c.id, onClick: () => setTChar(c.id), "aria-pressed": on ? "true" : "false",
              style: { display: "flex", alignItems: "center", gap: 7, minHeight: 44, padding: "5px 11px 5px 6px",
                borderRadius: 3, border: "1px solid " + (on ? t.ink : t.line),
                background: on ? t.bg2 : "transparent",
                transform: on ? "translateY(1px)" : "none",
                boxShadow: on ? "inset 0 2px 6px -5px rgba(0,0,0,.6)" : "none" } },
              h(Avatar, { character: c, size: 26, radius: 3 }),
              h("span", { style: { fontFamily: F_DISPLAY, fontSize: 13, color: on ? t.ink : t.sub } }, c.name));
          }))),

      h("div", { style: { marginBottom: 13 } },
        h("div", { style: S.h2 }, "哪一场"),
        // 场景是【剧本上的一折】，所以这里就是一本薄剧本：一折一行，翻到哪一折，
        // 哪一折就摊开——底下直接接着那一折的场面和她的第一句。
        // ⚠️不做成一排标签：四折的名字排不进一行，一换行「选中那张接着底下那页」
        //   就断了（标签在第一行、页在第二行下面），形状当场不成立。
        h("div", { style: { border: "1px solid " + t.line, borderRadius: 3, overflow: "hidden",
            background: t.bg2, marginTop: 6 } },
          SP.TEST_SCENES.map((sc, i) => {
            const on = sc.id === tScene;
            return h("div", { key: sc.id, style: { borderTop: i ? "1px solid " + t.line : "none" } },
              h("button", { onClick: () => setTScene(sc.id), "aria-pressed": on ? "true" : "false",
                style: { width: "100%", minHeight: 44, textAlign: "left", padding: "0 12px 0 0",
                  background: on ? "transparent" : "rgba(127,127,127,.045)",
                  display: "flex", alignItems: "center", gap: 9 } },
                // 折号：翻到的那一折，号码那一格上墨
                h("span", { style: { width: 26, alignSelf: "stretch", flexShrink: 0, display: "flex",
                    alignItems: "center", justifyContent: "center", fontFamily: "monospace", fontSize: 10.5,
                    background: on ? t.ink : "transparent", color: on ? t.bg2 : t.fog,
                    borderRight: "1px solid " + t.line } }, String(i + 1)),
                h("span", { style: { fontFamily: F_DISPLAY, fontSize: 13, color: on ? t.ink : t.fog } }, sc.name)),
              on
                ? h("div", { style: Object.assign({}, S.hint, { lineHeight: 1.75, padding: "2px 12px 11px 35px", whiteSpace: "pre-wrap" }) },
                    sc.setting + "\n你：" + sc.user)
                : null);
          }))),

      h("div", { style: { marginBottom: 13 } },
        h("div", { style: S.h2 }, "跑哪几份 · 可多选"),
        h("div", { style: Object.assign({}, S.hint, { marginBottom: 6 }) },
          "勾几份就连着跑几次，结果并排堆在下面。「对照组」是完全不吃预设，用来做基线。"
          + "每份【只调一次 API】，不偷偷补写。"
          + (tPicks.length > 1 ? "这一把 " + tPicks.length + " 份 = " + tPicks.length + " 次调用。" : "")),
        // 印哪几块版——跟搭预设那一排是同一种东西，所以长同一个样（plate 一处画）。
        // 「对照组」是【空版】：什么都不印，用来跟别的版比。
        h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8 } },
          [plate({ key: "__base", on: tPicks.indexOf("") >= 0, onClick: () => togglePick(""), name: "对照组", sub: "空版 · 不吃预设", edge: t.fog })]
            .concat(presets.map(p => plate({ key: p.id, on: tPicks.indexOf(p.id) >= 0, onClick: () => togglePick(p.id), name: p.name,
              sub: ((p.mods || []).length + (String(p.free || "").trim() ? 1 : 0)) + " 块" }))))),

      h("div", { style: { marginBottom: 16 } },
        h("div", { style: { display: "flex", alignItems: "baseline", gap: 8 } },
          h("div", { style: S.h2 }, "最低字数"),
          h("span", { style: { fontFamily: "monospace", fontSize: 11, color: t.tint } }, tMin ? String(tMin) : "不限")),
        // 走共用的 Slider：一处写好，全 app 一个样，也白得那个 data-wk="slider" 挂点
        // （施工规则/one-public-mechanism.md）。原来这儿自己写了一个裸 input[type=range]。
        h(Slider, { value: tMin, min: 0, max: 3000, step: 100, onChange: v => setTMin(Number(v)) })),

      // 这条线路能不能流式，决定了它有没有 60 秒的天花板——花钱之前就该看见，
      // 而不是等三次试写全挂了才知道（她 2026-08-24）。
      (function () {
        if (!props.active || !SP.routeInfo) return null;
        const r = SP.routeInfo(props.active);
        if (r.canStream) return null;
        return h("div", { style: Object.assign({}, S.card, { marginBottom: 14, borderColor: t.accent }) },
          h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.accent, marginBottom: 4 } }, "这条线路发不出流式 · 有 60 秒天花板"),
          h("div", { style: Object.assign({}, S.hint, { lineHeight: 1.75 }) },
            r.why + "。\n非流式请求只要生成超过 60 秒就会被读超时掐断（nginx 和 iOS 的默认值都是 60 秒），"
            + "跟 max_tokens、上下文多长都没关系。1500 字本来就要一两分钟，所以多半会失败。\n"
            + "· 想一次写长：换一条 openai 方言的线路，能流式之后这个天花板就没了。\n"
            + "· 先将就：最低字数调到 800 上下，一次调用能在 60 秒内写完。"));
      })(),
      h("button", { onClick: doRun, disabled: !!busy,
        style: { width: "100%", minHeight: 48, padding: "13px", borderRadius: 3, border: "none",
          background: busy ? t.line : t.ink, color: t.bg2, fontFamily: F_DISPLAY, fontSize: 14,
          letterSpacing: ".04em", marginBottom: 18,
          boxShadow: busy ? "none" : "0 4px 10px -8px rgba(0,0,0,.8)" } },
        busy ? "在写 " + busy + "…" : "印一张"),

      runs.length
        ? h("div", null,
            h("div", { style: { display: "flex", alignItems: "baseline", marginBottom: 8 } },
              h("div", { style: S.h2 }, "结果 · 最近 " + runs.length + " 次"),
              h("button", { onClick: () => { if (armed !== "__runs") { setArmed("__runs"); return; } setArmed(""); setRuns(SP.clearRuns()); },
                style: Object.assign({}, S.tool, { color: armed === "__runs" ? t.accent : t.fog, marginLeft: "auto" }) }, armed === "__runs" ? "真清空？再点一下" : "清空")),
            // 每一次试写＝一张打样纸：正文印在纸上，纸脚那一条印着这张是谁、哪一场、多少字。
            // 印坏的那张纸脚整条上红——一眼挑得出来，不用去读小字。
            h("div", { style: { display: "flex", flexDirection: "column", gap: 11 } },
              runs.map(r => {
                const bad = !!r.err, thin = !bad && r.want && r.chars < r.want;
                return h("div", { key: r.id, style: { background: t.bg2, border: "1px solid " + (bad ? t.accent : t.line),
                    borderRadius: 3, overflow: "hidden", boxShadow: "0 3px 9px -8px rgba(0,0,0,.7)" } },
                  h("div", { style: { padding: "11px 12px 10px" } },
                    (r.notes || []).length ? h("div", { style: Object.assign({}, S.hint, { fontSize: 10.5, marginBottom: 6, color: t.tint }) }, (r.notes || []).join("　·　")) : null,
                    bad
                      ? h("div", { style: Object.assign({}, S.hint, { color: t.accent }) }, r.err)
                      : h("div", { style: { position: "relative", maxHeight: openRun[r.id] ? "none" : 132, overflow: "hidden" } },
                          h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.85, color: t.sub, whiteSpace: "pre-wrap" } }, r.text),
                          !openRun[r.id]
                            ? h("span", { "aria-hidden": "true", style: { position: "absolute", left: 0, right: 0, bottom: 0, height: 30,
                                background: "linear-gradient(180deg, rgba(255,255,255,0) 0%, " + t.bg2 + " 92%)" } })
                            : null)),
                  // 纸脚
                  h("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "0 6px 0 12px",
                      borderTop: "1px solid " + (bad ? t.accent : t.line),
                      background: bad ? "rgba(194,90,74,.10)" : "rgba(127,127,127,.05)" } },
                    h("span", { style: { fontFamily: F_DISPLAY, fontSize: 12, color: bad ? t.accent : t.ink } }, r.presetName),
                    h("span", { style: Object.assign({}, S.hint, { fontSize: 10.5, flex: 1, minWidth: 0 }) }, r.charName + " · " + r.sceneName),
                    h("span", { style: { fontFamily: "monospace", fontSize: 10.5, color: bad || thin ? t.accent : t.fog } },
                      bad ? "印坏了" : r.chars + " 字" + (r.want ? " / " + r.want : "")),
                    bad ? null : h("button", { onClick: () => setOpenRun(o => Object.assign({}, o, { [r.id]: !o[r.id] })),
                      style: Object.assign({}, S.tapIcon(t.tint), { fontSize: 11.5, minWidth: 52 }) }, openRun[r.id] ? "收起" : "全文")));
              })))
        : null);

    // 打样台也铺一张纸（v62.73 审美审计：这一页整个是 t.bg 平色）
    const benchPaper = (typeof pageSkin === "function") ? pageSkin("paper", t, { strength: .5 }) : { background: t.bg };
    return h("div", { style: Object.assign({ position: "relative", height: "100%", display: "flex", flexDirection: "column" }, benchPaper) },
      // 顶栏走共用的 Head（施工规则/mobile-ui-layout.md §1：「那条紧凑栏就是 Head，别再自己写一条」）。
      // ⚠️v65.09 才换过来。之前这一页自己手写了一条，于是它身上【一个 data-wk 挂点都没有】：
      //   她让秋秋给文风台写主题 CSS，[data-wk="head"]/headink/headdim 那几条全落空，
      //   看上去像「秋秋写的应用不出来」，其实是这一页没有那几个挂点可抓。
      //   换成 Head＝顶栏那三个挂点当场就有了，紧凑栏那条规矩也一起合规。
      // bg 传 transparent：底纹铺在外壳（benchPaper）上，顶栏透上来（同 §3.5）。
      h(Head, { zh: "文风预设台", onBack: props.onBack, bg: "transparent" }),
      // ── 两栏＝叠在台上的两张样张（v62.68）──────────────────────────
      // 审美审计 2026-09-04：这两个 tab 是填色药丸，只靠色差区分——
      // 换个 app 照样成立（tabs-not-plain-pills）。
      // 文风台现实里是【打样台】：你搭一张样，再拿它试印一段看看。
      // 所以两栏就是台上叠着的两张样张：翻到哪一张，哪一张压在上面、纸色、往下探出一截；
      // 底下那张只露出一个角，暗着、缩着。
      // ⚠️选中态同时变【高度、位置、底色、阴影】，不只靠色差。
      h("div", { style: { display: "flex", gap: 0, padding: "0 14px" } },
        [["build", "搭预设"], ["test", "测试台"]].map(([k, label], i) => {
          const on = tab === k;
          return h("button", { key: k, onClick: () => setTab(k), "aria-pressed": on ? "true" : "false",
            className: "active:opacity-80",
            style: {
              flex: 1, minHeight: 40,
              padding: on ? "11px 0 13px" : "9px 0 9px",
              marginTop: on ? 0 : 4,
              marginLeft: i ? -6 : 0,
              zIndex: on ? 2 : 1, position: "relative",
              fontFamily: F_DISPLAY, fontSize: 13.5,
              color: on ? t.ink : t.fog,
              background: on ? t.bg2 : "rgba(127,127,127,.08)",
              border: "1px solid " + t.line, borderBottom: on ? "1px solid " + t.bg2 : "1px solid " + t.line,
              borderRadius: "3px 3px 0 0",
              boxShadow: on ? "0 -3px 8px -6px rgba(0,0,0,.5)" : "none"
            }
          }, label);
        })),
      h("div", { style: { flex: 1, overflowY: "auto", background: t.bg2, borderTop: "1px solid " + t.line, marginTop: -1 } }, tab === "build" ? buildTab : testTab));
  }
  window.StyleLabApp = StyleLabApp;
})();
