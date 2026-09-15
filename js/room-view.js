// ============================================================
// 走进他屋里（room-view）—— 拖着看的那一页
// ============================================================
// 算术全在 js/room3d.js（RoomKit，纯函数、整份能在 node 里跑）。
// 这一份只管三件事：画到 canvas 上、拖拽转头、点中一件东西弹出他那句话。
//
// ⚠️整页，不是半窗（施工规则/no-half-sheet.md）。
// ⚠️点中家具弹的那张卡是【少数配得上半窗的形状】：判据那句「这一层的内容，
//   需要同时看见它下面那一层吗」在这儿是**要**——不看着那件东西，就不知道
//   他在说哪一件。所以它是压在画面下缘的一张窄卡，不是盖住半屏的面板。
// ============================================================
(function () {
  const K = window.RoomKit;
  const INK = "#f2efe9", SUB = "rgba(242,239,233,.62)", LINE = "rgba(242,239,233,.2)";

  function RoomView(props) {
    const t = useTheme();
    const place = props.place, char = props.char;
    const L = useMemo(function () { return K.layoutRoom(place); }, [place && place.id, place && place.zones]);
    const spots = useMemo(function () { return K.spots(L); }, [L]);
    const [spotIdx, setSpotIdx] = useState(0);
    const [picked, setPicked] = useState(null);
    const canvasRef = useRef(null);
    const camRef = useRef(null);
    const listRef = useRef([]);
    const dragRef = useRef(null);

    // 换站位＝整个人挪过去：朝向也跟着回到那个站位该看的方向
    useEffect(function () {
      const s = spots[spotIdx] || spots[0];
      camRef.current = { x: s.x, y: s.y, z: s.z, yaw: s.yaw, pitch: s.pitch };
      setPicked(null);
      draw();
      // eslint-disable-next-line
    }, [spotIdx, L]);

    function draw() {
      const cv = canvasRef.current, cam = camRef.current;
      if (!cv || !cam) return;
      const dpr = Math.min(2.5, (window.devicePixelRatio || 1));
      const w = cv.clientWidth, h = cv.clientHeight;
      if (!w || !h) return;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      }
      const g = cv.getContext("2d");
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      // 屋外那一圈：不是黑的，是屋里漏出来的光更暗一档——不然墙边缘硬得像剪纸
      g.fillStyle = K.tint(L.palette[0], 0.42);
      g.fillRect(0, 0, w, h);
      const list = K.renderList(L, cam, { w: w, h: h, fov: 1.55 });
      listRef.current = list;
      const hit = picked;
      list.forEach(function (f) {
        g.beginPath();
        g.moveTo(f.pts[0][0], f.pts[0][1]);
        for (let i = 1; i < f.pts.length; i++) g.lineTo(f.pts[i][0], f.pts[i][1]);
        g.closePath();
        g.fillStyle = (hit && f.pickId === hit) ? K.tint(f.color, 1.22) : f.color;
        g.fill();
        // 低模那个味儿就靠这一道极淡的边：不描边的话同色的两个面会糊成一块
        if (!f.shell) { g.strokeStyle = "rgba(20,24,28,.13)"; g.lineWidth = 0.6; g.stroke(); }
      });
    }

    useEffect(function () { draw(); });
    useEffect(function () {
      const on = function () { draw(); };
      window.addEventListener("resize", on);
      return function () { window.removeEventListener("resize", on); };
      // eslint-disable-next-line
    }, []);

    // ── 拖着转头 ────────────────────────────────────────────
    // ⚠️转头只动相机、不过 React：一帧一个 setState 在手机上会掉帧。
    //   state 只留「站在哪儿」和「点中了谁」这两样真会变界面的。
    const pt = function (e) {
      const s = e.touches && e.touches[0] ? e.touches[0] : e;
      return { x: s.clientX, y: s.clientY };
    };
    function down(e) {
      const p = pt(e);
      dragRef.current = { x0: p.x, y0: p.y, x: p.x, y: p.y, moved: 0,
        yaw: camRef.current.yaw, pitch: camRef.current.pitch };
    }
    function move(e) {
      const d = dragRef.current; if (!d) return;
      const p = pt(e);
      d.moved = Math.max(d.moved, Math.hypot(p.x - d.x0, p.y - d.y0));
      camRef.current.yaw = d.yaw - (p.x - d.x0) * 0.0042;
      // 往下拖＝抬头：手指抓着屋子拖，跟左右转那一下是同一个手感
      camRef.current.pitch = K.clampPitch(d.pitch + (p.y - d.y0) * 0.0032);
      draw();
    }
    function up(e) {
      const d = dragRef.current; dragRef.current = null;
      if (!d) return;
      // 拖过就不算点：手指在屏幕上蹭一下也会发一个 click
      if (d.moved > 7) return;
      const cv = canvasRef.current; if (!cv) return;
      const r = cv.getBoundingClientRect();
      const s = (e.changedTouches && e.changedTouches[0]) || e;
      const id = K.pick(listRef.current, s.clientX - r.left, s.clientY - r.top);
      setPicked(id || null);
    }

    const cur = (L.pieces || []).find(function (p) { return p.id === picked; });
    const spot = spots[spotIdx] || spots[0];

    return h("div", { className: "h-full flex flex-col", style: { background: K.tint(L.palette[0], 0.42) } },
      h(Head, { zh: place.name || "他的屋子", sub: spot.name, onBack: props.onBack, ink: INK, subInk: SUB, noLine: true,
        bg: "linear-gradient(180deg,rgba(8,11,13,.55),rgba(8,11,13,0))" }),
      h("div", { className: "flex-1 min-h-0 relative", style: { marginTop: -1 } },
        h("canvas", { ref: canvasRef,
          onTouchStart: down, onTouchMove: move, onTouchEnd: up,
          onMouseDown: down, onMouseMove: move, onMouseUp: up, onMouseLeave: function () { dragRef.current = null; },
          style: { width: "100%", height: "100%", display: "block", touchAction: "none" } }),
        // 头一回进来得有人说一句这屋子能拖
        !picked ? h("div", { style: { position: "absolute", left: 0, right: 0, top: 10, textAlign: "center",
          fontFamily: F_BODY, fontSize: 10.5, color: SUB, pointerEvents: "none" } },
          "按住屏幕左右拖能转头 · 点一件东西看看") : null,
        // ── 点中的那一件：压在画面下缘的一张窄卡（见文件头那条判据）──
        cur ? h("div", { style: { position: "absolute", left: 12, right: 12, bottom: 12, borderRadius: 12,
          background: "rgba(12,15,18,.9)", border: "1px solid " + LINE, padding: "13px 15px",
          animation: "fadeUp .18s ease-out both" } },
          h("div", { className: "flex items-baseline", style: { gap: 8 } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: INK, minWidth: 0 }, className: "truncate" }, cur.label),
            h("span", { style: { flex: 1 } }),
            cur.zone ? h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: SUB, flexShrink: 0 } }, cur.zone) : null,
            h("button", { onClick: function () { setPicked(null); }, "aria-label": "收起",
              style: { fontFamily: F_BODY, fontSize: 11, color: SUB, padding: "2px 0 2px 10px", flexShrink: 0 } }, "收起")),
          cur.note ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.75, color: "rgba(242,239,233,.8)", marginTop: 7 } }, cur.note) : null,
          cur.thought ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.8, color: INK, marginTop: 9,
            borderTop: "1px solid " + LINE, paddingTop: 9 } }, "「" + cur.thought + "」") : null) : null),
      // ── 走到别处站站 ──────────────────────────────────────
      h("div", { className: "shrink-0 flex", style: { gap: 7, padding: "9px 12px",
        paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 9px)", overflowX: "auto",
        background: "rgba(8,11,13,.55)", borderTop: "1px solid " + LINE } },
        spots.map(function (s, i) {
          return h("button", { key: s.name, onClick: function () { setSpotIdx(i); }, className: "active:opacity-70",
            style: { flexShrink: 0, minHeight: 34, padding: "0 13px", borderRadius: 999, whiteSpace: "nowrap",
              fontFamily: F_BODY, fontSize: 12,
              color: i === spotIdx ? "#16191c" : INK,
              background: i === spotIdx ? INK : "transparent",
              border: "1px solid " + (i === spotIdx ? INK : LINE) } }, s.name);
        }),
        h("span", { style: { flex: 1, minWidth: 6 } }),
        h("div", { style: { flexShrink: 0, alignSelf: "center", fontFamily: F_BODY, fontSize: 10.5, color: SUB } },
          (L.pieces || []).length + " 件东西")));
  }

  window.RoomView = RoomView;
})();
