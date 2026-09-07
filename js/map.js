// js/map.js — 好友地图：真·在线地图(Leaflet+OSM)，角色按「家乡城市 + 此刻日程活动」定位。
// 主屏 2×2 实时小组件 MapWidget + 全屏 CharMap。Leaflet 没加载时优雅降级不崩。
(function () {

// 好友地图那几层子页（一处地点 / 加个地点 / 开一个世界）共用这一份底。
// ⚠️三处本来是一模一样的三行平色，各改各的迟早只改一处。
//   挑 grid（坐标纸）不是随手挑的：这几页说的都是「在图上标一个地方」，
//   而它们自己【没有网格结构】——不像日历那种本来就是一张网、再铺一层会撞。
//   底纹是给没有结构的页面补结构的，这几页正是那一类。
function mapSubSkin(t) {
  return Object.assign({ position: "fixed", inset: 0, zIndex: 140, display: "flex", flexDirection: "column" },
    typeof pageSkin === "function" ? pageSkin("grid", t, { strength: .9 }) : { background: t.bg });
}
  const inApp = typeof window !== "undefined" && typeof React !== "undefined";
  const h = inApp ? React.createElement : null;
  const useState = inApp ? React.useState : null, useEffect = inApp ? React.useEffect : null, useRef = inApp ? React.useRef : null;

  // 常用城市 → [lat,lng]，给角色设家乡用（离线，不靠地理编码 API）
  const CITY_DB = {
    "北京": [39.90, 116.40], "上海": [31.23, 121.47], "广州": [23.13, 113.26], "深圳": [22.54, 114.06],
    "杭州": [30.27, 120.16], "成都": [30.57, 104.07], "重庆": [29.56, 106.55], "武汉": [30.59, 114.31],
    "西安": [34.34, 108.94], "南京": [32.06, 118.80], "苏州": [31.30, 120.62], "天津": [39.13, 117.20],
    "长沙": [28.23, 112.94], "青岛": [36.07, 120.38], "厦门": [24.48, 118.09], "沈阳": [41.81, 123.43],
    "哈尔滨": [45.80, 126.53], "大连": [38.91, 121.61], "郑州": [34.75, 113.62], "昆明": [25.04, 102.71],
    "合肥": [31.82, 117.23], "福州": [26.07, 119.30], "济南": [36.65, 117.12], "贵阳": [26.65, 106.63],
    "香港": [22.32, 114.17], "台北": [25.03, 121.56], "澳门": [22.20, 113.54],
    "东京": [35.68, 139.69], "大阪": [34.69, 135.50], "首尔": [37.57, 126.98], "新加坡": [1.35, 103.82],
    "曼谷": [13.76, 100.50], "吉隆坡": [3.14, 101.69], "伦敦": [51.51, -0.13], "巴黎": [48.86, 2.35],
    "纽约": [40.71, -74.01], "洛杉矶": [34.05, -118.24], "旧金山": [37.77, -122.42], "西雅图": [47.61, -122.33],
    "多伦多": [43.65, -79.38], "温哥华": [49.28, -123.12], "温尼伯": [49.90, -97.14], "卡尔加里": [51.05, -114.07], "蒙特利尔": [45.50, -73.57],
    "悉尼": [-33.87, 151.21], "墨尔本": [-37.81, 144.96],
    "柏林": [52.52, 13.40], "莫斯科": [55.76, 37.62], "迪拜": [25.20, 55.27]
  };
  const CITY_NAMES = Object.keys(CITY_DB);
  // 完整逐步导航由 VPS 代取并瘦身：手机不直接解析 OSRM 每一步附带的巨型 geometry。
  // 若 VPS 暂时不可用，仍自动退回直连轻量路线，至少保住路线/里程/时间。
  const ROUTE_PROXY = "https://yanqiu-vps.tail542792.ts.net/route/v1";

  // 日程活动类型 → 相对家的小偏移（度），让 pin 随日程在城里挪一点（没有真实门牌，靠此营造"移动感"）
  const ACT_OFFSET = {
    work: [0.020, 0.028], create: [0.015, -0.022], meal: [-0.013, 0.021], out: [0.030, -0.013],
    social: [-0.021, -0.024], rest: [0.004, 0.006], coffee: [0.007, 0.013], sleep: [0, 0], other: [0.011, 0.009]
  };
  // 行程里那句「在哪」→ 真坐标（她 2026-08-31 要的：行程变了人就该动一下）。
  // 不花模型调用：同一个地名一辈子只查一次 OSM(免费无 key)，之后一直读缓存。
  // ⚠️查不到的也要记下来，不然每次渲染都会重新去撞一遍那个查不到的名字。
  const GEO_KEY = "x_geoPlace";
  const GEO_MISS_TTL = 7 * 24 * 3600 * 1000;
  let geoCache = null;
  const geoLoad = function () { if (!geoCache) { try { geoCache = JSON.parse(localStorage.getItem(GEO_KEY) || "{}") || {}; } catch (e) { geoCache = {}; } } return geoCache; };
  const geoSave = function () { try { localStorage.setItem(GEO_KEY, JSON.stringify(geoCache)); } catch (e) {} };
  const geoKey = function (char, loc) { const hm = charHome(char); return (hm ? hm.city : "~") + "|" + String(loc || "").trim(); };
  const geoHit = function (char, loc) {
    const v = geoLoad()[geoKey(char, loc)];
    if (!v) return null;
    if (v.miss) return (Date.now() - v.miss < GEO_MISS_TTL) ? "miss" : null;
    return [v[0], v[1]];
  };
  // 一次一个、隔一秒多一点——OSM 那边讲礼貌，打太快会被封
  const geoQueue = [];
  let geoRunning = false, geoBump = null;
  function geoPump() {
    if (geoRunning || !geoQueue.length) return;
    geoRunning = true;
    const job = geoQueue.shift();
    nomSearch(job.q, job.near).then(function (r) {
      const p0 = r && r[0];
      geoLoad()[job.key] = p0 ? [p0.lat, p0.lng] : { miss: Date.now() };
      geoSave();
      if (geoBump) geoBump();
    }).catch(function () {
      geoLoad()[job.key] = { miss: Date.now() }; geoSave();
    }).then(function () {
      geoRunning = false;
      setTimeout(geoPump, 1200);
    });
  }
  function geoWant(char, loc) {
    const key = geoKey(char, loc);
    if (geoLoad()[key] || geoQueue.some(function (j) { return j.key === key; })) return;
    const hm = charHome(char);
    // 带上他所在的城市一起搜：光搜「公司」全世界都是，加了城市才落在他那一片
    geoQueue.push({ key: key, q: (hm ? hm.city + " " : "") + String(loc).trim(), near: hm ? [hm.lat, hm.lng] : null });
    geoPump();
  }
  // 谁的行程里写了地名就去补一次坐标；补到了就重画。渲染时不发请求，只在这里发。
  function useSchedGeo(characters, status) {
    const [, tick] = useState(0);
    useEffect(function () {
      geoBump = function () { tick(function (n) { return n + 1; }); };
      (characters || []).forEach(function (c) {
        const st = (status || {})[c.id];
        const q2 = st && (st.place || st.location);
        if (q2 && !geoHit(c, q2)) geoWant(c, q2);
      });
      return function () { geoBump = null; };
    });
  }
  function charHome(char) { const hm = char && char.home; return hm && typeof hm.lat === "number" ? hm : null; }
  // 他到底住在哪一套世界里（她 2026-09-06：「比如说王爷我钉到温尼伯和一个架空世界
  // 这种怎么算呢」）。
  //
  // 判据一句话：**他被钉进哪个架空世界，他就住在那个世界。** 没钉进任何世界，才算住在现实。
  // 理由是这一钉是她【专门为这个人做的动作】，而 home 那个坐标常常只是随手给的一个参照
  //（没设城市的角色本来就会被撒在她定位附近）。取消那一钉，他自己就回现实。
  //
  // 谁在乎这件事：① 现实地图不再画住在架空世界里的人（不然一个王爷插在温尼伯街上）；
  //              ② 行程那一枪不再给他灌现实天气——古代那位不该跟着温尼伯下雨。
  function charRealm(char, worlds) {
    if (!char) return { kind: "real" };
    const list = Array.isArray(worlds) ? worlds : [];
    for (let i = 0; i < list.length; i++) {
      const w = list[i], node = w && w.pins && w.pins[char.id];
      if (node) return { kind: "world", world: w, node: node, terrain: terrainOfNode(w, node) };
    }
    return { kind: "real" };
  }
  function terrainOfNode(world, node) {
    let t = "";
    ((world && world.regions) || []).forEach(function (r) {
      ((r && r.nodes) || []).forEach(function (n) { if (n && String(n.name) === String(node)) t = String(r.terrain || ""); });
    });
    return t || "平原";
  }
  // 没设城市的角色：按 id 稳定地在锚点(你的定位/温尼伯)附近撒开 ±0.024°(≈2.5km)，不重叠
  function charJitter(char) {
    const id = String((char && (char.id || char.name)) || "");
    let hh = 0; for (let i = 0; i < id.length; i++) hh = (hh * 31 + id.charCodeAt(i)) | 0;
    const a = Math.abs(hh);
    return [((a % 24) - 12) / 500, ((Math.floor(a / 24) % 24) - 12) / 500];
  }
  // pos：锚点=设的家乡城市 / 没设则你的定位(或温尼伯)；一律叠 per-char jitter(同城/同点也不重叠)+日程活动偏移
  function charPos(char, st, userGeo) {
    const hm = charHome(char);
    const anc = hm ? { lat: hm.lat, lng: hm.lng }
      : (userGeo && typeof userGeo.lat === "number") ? userGeo
        : { lat: CITY_DB["温尼伯"][0], lng: CITY_DB["温尼伯"][1] };
    const j = charJitter(char);
    // 行程里写了地名、而且查到过坐标：直接站到那个真地方去（只叠 jitter，不叠活动偏移，
    // 那个偏移本来就是「不知道他具体在哪」时的替代品）
    // ⚠️先认 place（城／坊市这一级），再认 location（具体处所）。
    //   她 2026-09-06：「角色好像都不会随着日程移动」——根因是行程写的是【他家里的一个房间】，
    //   而这张图上查得到的是【城市级】的地名，永远搜不到，于是永远退回落脚点。
    const q = (st && (st.place || st.location)) || "";
    const g = q ? geoHit(char, q) : null;
    if (g && g !== "miss") return [g[0] + j[0], g[1] + j[1]];
    let lat = anc.lat + j[0], lng = anc.lng + j[1];
    const off = st && ACT_OFFSET[st.type]; if (off) { lat += off[0]; lng += off[1]; }
    return [lat, lng];
  }
  function avatarHtml(char, size) {
    const s = size || 34;
    // 头像迁到 IndexedDB 图库后是 iv_ 引用，必须 resolveImg 换成可显示的 objectURL；没解析出来就落回底色首字（别塞 iv_ 进 url 变白圈）
    const img = char.avatarImage ? (typeof resolveImg === "function" ? resolveImg(char.avatarImage) : char.avatarImage) : "";
    const inner = img
      ? "<div style='width:100%;height:100%;border-radius:50%;background:center/cover no-repeat url(\"" + img + "\")'></div>"
      : "<div style='width:100%;height:100%;border-radius:50%;background:" + (char.color || "#7c5c4e") + ";display:flex;align-items:center;justify-content:center;color:#fff;font-size:" + Math.round(s * 0.42) + "px;font-family:serif'>" + String(char.name || "?").slice(0, 1) + "</div>";
    return "<div style='width:" + s + "px;height:" + s + "px;border-radius:50%;border:2.5px solid #fff;box-shadow:0 2px 7px rgba(0,0,0,.32);box-sizing:border-box;background:#fff'>" + inner + "</div>";
  }

  // 共享的 Leaflet 画布：把 pins 放上去，自动 fit。opts.static=不可交互（widget 用）
  function MapCanvas({ pins, opts, style, className }) {
    const elRef = useRef(null);
    const mapRef = useRef(null);
    const lgRef = useRef(null);
    const fittedRef = useRef(false);
    const sigRef = useRef("");
    const o = opts || {};
    useEffect(function () {
      if (!window.L || !elRef.current || mapRef.current) return;
      const L = window.L;
      const inter = !o.static;
      const map = L.map(elRef.current, {
        zoomControl: !!o.zoomControl, dragging: inter, scrollWheelZoom: inter, doubleClickZoom: inter,
        boxZoom: inter, keyboard: inter, touchZoom: inter, tap: inter, attributionControl: true
      });
      // Esri World Street Map 允许免 Key 取图；detectRetina 会在高清屏自动请求
      // 更高一级的四张瓦片，手机上仍然清楚。不要再用 CARTO 匿名端点：
      // 它会直接把 “API KEY REQUIRED” 烙进图片，前端无法去掉。
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19,
        maxNativeZoom: 19,
        detectRetina: true,
        attribution: 'Tiles &copy; Esri'
      }).addTo(map);
      map.setView([31.23, 121.47], 3);
      mapRef.current = map;
      lgRef.current = L.layerGroup().addTo(map);
      // 容器尺寸稳定后修正
      setTimeout(function () { try { map.invalidateSize(); } catch (e) {} }, 120);
      if (o.onReady) o.onReady(map); // 把地图实例交出去，供外部飞到某点/看全部
      return function () { try { map.remove(); } catch (e) {} mapRef.current = null; lgRef.current = null; fittedRef.current = false; };
    }, []);
    useEffect(function () {
      const L = window.L, map = mapRef.current, lg = lgRef.current;
      if (!L || !map || !lg) return;
      // 位置签名：没变就不重建 marker（主屏时钟每秒刷新时别让 Leaflet 空转→卡）
      const sig = (o.center ? o.center[0].toFixed(4) + "," + o.center[1].toFixed(4) : "") + "::" + (pins || []).map(function (p) { return (p.pos ? p.pos[0].toFixed(4) + "," + p.pos[1].toFixed(4) : "-") + "|" + (p.tooltip || ""); }).join(";");
      if (sig === sigRef.current) return;
      sigRef.current = sig;
      lg.clearLayers();
      const pts = [];
      (pins || []).forEach(function (p) {
        if (!p.pos) return;
        const sz = p.size || 34;
        const mk = L.marker(p.pos, { icon: L.divIcon({ html: p.html, className: "", iconSize: [sz, sz], iconAnchor: [sz / 2, sz / 2] }), interactive: !o.static });
        if (p.onClick && !o.static) mk.on("click", p.onClick);
        if (p.tooltip) mk.bindTooltip(p.tooltip, { direction: "top", offset: [0, -sz / 2], className: "cm-tip" });
        mk.addTo(lg); pts.push(p.pos);
      });
      // 修 flex 里初始 0 高只加载一格瓦片：先 invalidateSize，容器真正有尺寸(sized)才 fit 并标记 fitted
      const fit = function () {
        try { map.invalidateSize(); } catch (e) {}
        if (o.noFit) return; // 视角完全由外部控制（对准你/飞到角色/看全部）
        const sized = map.getSize && map.getSize().x > 60 && map.getSize().y > 60;
        const doFit = o.fitOnce ? !fittedRef.current : true;
        if (doFit && sized && pts.length) {
          if (pts.length === 1) map.setView(pts[0], o.zoom || 10);
          else { try { map.fitBounds(pts, { padding: [26, 26], maxZoom: o.zoom || 11 }); } catch (e) {} }
          fittedRef.current = true;
        }
      };
      fit();
      const t1 = setTimeout(fit, 250), t2 = setTimeout(fit, 750);
      return function () { clearTimeout(t1); clearTimeout(t2); };
    }, [pins]);
    // 降级：没 Leaflet 时给个占位
    if (!window.L) return h("div", { className: className, style: Object.assign({ display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(160deg,#cfe0ea,#e6ddd0)", color: "#6a7a86", fontSize: 12, textAlign: "center", padding: 12 }, style || {}) }, "地图组件加载中…（需要联网）");
    return h("div", { ref: elRef, className: className, style: Object.assign({ background: "#dfe6ea" }, style || {}) });
  }

  // 蓝点 HTML（你自己的实时位置）
  function meDotHtml(size) { const s = size || 18; return "<div style='width:" + s + "px;height:" + s + "px;border-radius:50%;background:#3f6d8c;border:3px solid #fff;box-shadow:0 0 0 4px rgba(63,109,140,.28)'></div>"; }
  // 「我在这儿」在【纸地图】上是一枚按下去的图钉，不是一个蓝点（她 2026-09-05 给的参考图）。
  // 只给主屏那张小地图用；全屏那张仍是蓝点——那一张是真在导航，蓝点才是对的语言。
  function mePinHtml(size) {
    const s = size || 22, w = s * 0.72;
    return "<svg width='" + w + "' height='" + s + "' viewBox='0 0 16 22' style='display:block;filter:drop-shadow(0 2px 3px rgba(40,26,14,.45))'>"
      + "<path d='M8 21.4C8 21.4 2 13.6 2 8.6a6 6 0 1 1 12 0c0 5-6 12.8-6 12.8Z' fill='#b8483c' stroke='rgba(72,26,20,.75)' stroke-width='1'/>"
      + "<circle cx='8' cy='8.4' r='2.3' fill='rgba(255,246,236,.92)'/></svg>";
  }
  // 主屏 2×2 实时小组件：就是一张地图，不写标题（她 2026-08-30 让删的：那块白渐变盖掉上沿快 50px）
  // ⚠️worlds 必须传进来：现实图不画住在架空世界里的人，靠的就是它
  //   （没传＝undefined＝所有人都算住现实，那这一层等于没有）
  function MapWidget({ characters, status, userGeo, worlds, onOpen }) {
    const list = characters || [];
    useSchedGeo(list, status);
    const mapRef = useRef(null);
    // 组件自己取一次实时定位（像苹果地图 widget 对准你），失败就退回传入的 userGeo
    const [myPos, setMyPos] = useState(userGeo && typeof userGeo.lat === "number" ? [userGeo.lat, userGeo.lng] : null);
    useEffect(function () {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(function (p) { setMyPos([p.coords.latitude, p.coords.longitude]); }, function () {}, { enableHighAccuracy: false, maximumAge: 120000, timeout: 12000 });
    }, []);
    // 拿到定位就把组件地图对准你
    useEffect(function () { if (mapRef.current && myPos) { try { mapRef.current.setView(myPos, 12); } catch (e) {} } }, [myPos]);
    const anchor = myPos ? { lat: myPos[0], lng: myPos[1] } : (userGeo && typeof userGeo.lat === "number" ? userGeo : null);
    const pins = list.filter(function (c) { return charRealm(c, worlds).kind === "real"; }).map(function (c) {
      const st = (status || {})[c.id];
      return { pos: charPos(c, st, anchor), html: avatarHtml(c, 26), size: 26 };
    }).filter(function (p) { return p.pos; });
    if (myPos) pins.push({ pos: myPos, size: 24, html: mePinHtml(24) });
    // 一张【摊开过的旧海图】，不是一块生瓦片（她 2026-09-05：「太普通了」）。
    // 原来就是把 Esri 的街道图直接嵌进一个圆角方框——那个东西在任何一个 app 里都成立，
    // 而且底下那行 "Leaflet | Tiles © Esri" 还横着漏出来。现在：
    //   · 瓦片压成旧纸的色（去饱和 + 微微发黄），四角压暗
    //   · 中间两道折痕：这张图是从口袋里掏出来摊开的
    //   · 右下角一枚程序画的罗盘（不是 emoji）
    //   · 版权那行缩到最小、压在左下角，不再横穿整张图
    return h("button", { onClick: onOpen, className: "active:opacity-90 text-left wk-mapwidget",
      style: { position: "relative", width: "100%", aspectRatio: "1 / 1", borderRadius: 6, overflow: "hidden", isolation: "isolate",
        border: "1px solid rgba(92,72,48,.45)", boxShadow: "0 8px 26px rgba(30,28,24,.18), inset 0 0 0 3px rgba(247,241,229,.85)", background: "#e6dcc6" } },
      h("div", { style: { position: "absolute", inset: 0, filter: "sepia(.24) saturate(.86) contrast(1.02) brightness(1.06)" } },
        h(MapCanvas, { pins: pins, opts: { static: true, zoom: 12, onReady: function (m) { mapRef.current = m; if (myPos) { try { m.setView(myPos, 12); } catch (e) {} } } }, style: { position: "absolute", inset: 0, width: "100%", height: "100%" } })),
      // 折痕：竖一道、横一道，各带一侧的亮边
      h("div", { "aria-hidden": true, style: { position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(90deg,transparent calc(50% - 1.2px),rgba(84,66,44,.16) 50%,rgba(255,252,244,.5) calc(50% + 1.2px),transparent calc(50% + 3px)),"
          + "linear-gradient(180deg,transparent calc(50% - 1.2px),rgba(84,66,44,.13) 50%,rgba(255,252,244,.42) calc(50% + 1.2px),transparent calc(50% + 3px)),"
          + "radial-gradient(120% 110% at 50% 45%, transparent 52%, rgba(70,54,34,.22))" } }),
      // 罗盘：北针一半上墨一半留白，外面一圈刻度
      h("svg", { width: 34, height: 34, viewBox: "0 0 34 34", "aria-hidden": true, style: { position: "absolute", right: 7, bottom: 7, opacity: .82 } },
        h("circle", { cx: 17, cy: 17, r: 15, fill: "rgba(247,241,229,.72)", stroke: "rgba(74,56,36,.6)", strokeWidth: 1 }),
        h("circle", { cx: 17, cy: 17, r: 11.5, fill: "none", stroke: "rgba(74,56,36,.35)", strokeWidth: .6 }),
        h("path", { d: "M17 3.5 20.4 17 17 30.5 13.6 17Z", fill: "#f7f1e5", stroke: "rgba(74,56,36,.7)", strokeWidth: .7 }),
        h("path", { d: "M17 3.5 20.4 17 17 17Z", fill: "#8d3f33" }),
        h("path", { d: "M17 3.5 13.6 17 17 17Z", fill: "#5d4a30" }),
        h("circle", { cx: 17, cy: 17, r: 1.6, fill: "#5d4a30" })),
      pins.length === 0 ? h("div", { style: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, pointerEvents: "none" } },
        // ⚠️原来这儿摆的是一个地图 emoji：她机器上会渲成豆腐块，规矩里写着一律换程序画的
        h("svg", { width: 30, height: 30, viewBox: "0 0 30 30", "aria-hidden": true },
          h("path", { d: "M2 7.5 10.5 4l9 3.5L28 4v18.5L19.5 26l-9-3.5L2 26Z", fill: "none", stroke: "rgba(74,56,36,.5)", strokeWidth: 1.4, strokeLinejoin: "round" }),
          h("path", { d: "M10.5 4v18.5M19.5 7.5V26", stroke: "rgba(74,56,36,.5)", strokeWidth: 1.2 })),
        h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "rgba(74,56,36,.66)" } }, "还没有人在图上")) : null);
  }

  // 真·地点搜索（OSM Nominatim，免费无 key）：搜全世界任何地方，中文优先
  function nomSearch(q, near, signal) {
    // near=[lat,lng] 时用 viewbox 就近加权(bounded=0 只偏好不封死)——同名地点先出你城市附近的
    const vb = near ? "&viewbox=" + (near[1] - 0.6) + "," + (near[0] + 0.6) + "," + (near[1] + 0.6) + "," + (near[0] - 0.6) + "&bounded=0" : "";
    return fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=zh" + vb + "&q=" + encodeURIComponent(q), { signal: signal })
      .then(function (r) { if (!r.ok) throw new Error("search_" + r.status); return r.json(); })
      .then(function (list) { return (list || []).map(function (x) { return { name: (x.display_name || "").split(",").slice(0, 2).join(","), full: x.display_name, lat: parseFloat(x.lat), lng: parseFloat(x.lon) }; }); });
  }

  // ── 架空世界地图 ────────────────────────────────────────────────────────
  // 地图引擎直接借跑团那一份(window.TrpgMap):模型只宣告【区域·接壤·节点】,
  // 坐标全由力导向现算——同一个世界每次画出来一模一样,不存图片、不占云同步。
  const WORLD_MAX_NODES = 8, WORLD_MAX_REGIONS = 8;   // 一块地方最多画几个地点 / 一个世界最多几块地方
  const TERR_TINT = { 山地: "#d9d0c2", 平原: "#dde2cd", 森林: "#cfdac8", 水泽: "#cdd8dc", 荒漠: "#e4d9c2", 城郭: "#ddd3d6" };
  // ── 地点记号（v62.68）─────────────────────────────────────────────
  // 原来是四个 Unicode 符号 ⌂ ▲ • ★ 当图标。规矩里写着：Unicode 当图标一律换成
  // 程序画的 SVG——汉字一定渲得出来，emoji 和符号不行（⌂ 在不少字体里就是豆腐块）。
  // 而且这一层本来就该是【图例】：地图上认地方靠的是记号，不是一个字。
  // 每条路径都画在 12×12 的方框里，三处（图例、详情标题、图上的标注）共用同一份。
  const KIND_PATH = {
    城镇: "M2 6.5 6 2.6l4 3.9V10a.6.6 0 0 1-.6.6H2.6A.6.6 0 0 1 2 10z",
    遗迹: "M6 2.2 10.4 10H1.6z",
    野外: "M6 3.4a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2z",
    地标: "M6 1.8 7.4 4.7l3.2.4-2.3 2.2.6 3.1L6 8.9l-2.9 1.5.6-3.1L1.4 5.1l3.2-.4z"
  };
  // size 是那个方框的边长；stroke 传了就画线框，不传就实心
  const kindMark = function (kind, size, color, stroke) {
    const d = KIND_PATH[kind] || KIND_PATH.地标;
    return h("svg", { width: size, height: size, viewBox: "0 0 12 12", "aria-hidden": "true", style: { display: "block", flexShrink: 0 } },
      h("path", { d: d, fill: stroke ? "none" : color, stroke: stroke ? color : "none", strokeWidth: stroke || 0, strokeLinejoin: "round" }));
  };
  const worldPaper = t => ({
    backgroundColor: "#efe9dd",
    backgroundImage: [
      "radial-gradient(120% 90% at 50% 0%, rgba(255,255,255,0.55), transparent 62%)",
      "repeating-linear-gradient(0deg, rgba(120,104,80,0.05) 0 1px, transparent 1px 26px)",
      "repeating-linear-gradient(90deg, rgba(120,104,80,0.05) 0 1px, transparent 1px 26px)",
      "radial-gradient(140% 120% at 50% 50%, transparent 52%, rgba(76,62,44,0.16))"
    ].join(", ")
  });

  // 行程一变，人就自己挪一下——【不花一次调用】（她 2026-08-31 要的）。
  // 贵的那一步是「他在做的这件事，落在这个世界的哪个地点」，那是语义配对；
  // 造世界那一枪已经顺手问过一次了（world.route），之后就只是查表。
  // 对不上就退回落脚点，绝不瞎猜——猜错比不动更糟，人会莫名其妙地闪现。
  const zhOverlap = function (a, b) {
    a = String(a || ""); b = String(b || "");
    if (!a || !b) return 0;
    if (a.indexOf(b) >= 0 || b.indexOf(a) >= 0) return 1;
    const set = {}; for (const ch of a) set[ch] = 1;
    let hit = 0; for (const ch of b) if (set[ch]) hit++;
    return hit / Math.max(a.length, b.length);
  };
  const worldNodeNames = function (world) {
    const out = [];
    ((world && world.regions) || []).forEach(function (r) {
      ((r && r.nodes) || []).forEach(function (n) {
        const nm = String((n && n.name) || "").trim();
        if (nm) out.push(nm);
      });
    });
    return out;
  };
  const bestNode = function (names, text, floor) {
    let best = null, score = floor;
    names.forEach(function (nm) { const sc = zhOverlap(nm, text); if (sc > score) { score = sc; best = nm; } });
    return best;
  };
  // 他此刻在图上的哪一点。
  //
  // ⚠️她 2026-08-31 报「王爷一直在王府不动了，但是明明显示他应该在别的地方」。
  // 三个毛病叠在一起：
  //  ① 原来【只】跟 route.places 那张表对，而那张表是【开世界那天】模型给的一次性映射
  //     （「搜查厢房→东跨院」这种）。行程天天新生成，doing 对不上，就永远退回落脚点。
  //  ② 从来没拿【行程里的地点名】直接去对图上的节点——那才是最直接、也最稳的一条，
  //     而且完全不受那张冻住的表影响。
  //  ③ 把 title 和 location 拼成一句再比。zhOverlap 的分母是较长那个，拼长了只会
  //     互相稀释：本来对得上的也掉到门槛以下。
  function liveNodeOf(world, char, st) {
    const pinned = (world.pins || {})[char.id] || "";
    if (!st) return { node: pinned, live: false };
    const names = worldNodeNames(world);
    const loc = String(st.location || "").trim();
    const title = String(st.title || "").trim();
    const place = String(st.place || "").trim();
    // ⓪ place 是【大地方】（城／坊市这一级），本来就是照着地图上的地名写的，
    //    所以它最先对、门槛也最低（v64.24：她报「两张图都不动」，根因是粒度对不上）
    let hit = place ? bestNode(names, place, 0.28) : null;
    // ① 再拿细地点对一次
    if (!hit && loc) hit = bestNode(names, loc, 0.34);
    // ② 有些行程把地点写在标题里（「回王府用饭」），标题再对一次；
    //    标题噪音多（动词、人名都在里头），门槛抬高，免得随便撞上一个节点
    if (!hit && title) hit = bestNode(names, title, 0.5);
    // 标题本来就常以「在」开头（「在城南茶楼见人」），不去掉就成了「此刻在在城南…」
    if (hit) return { node: hit, live: true, why: "此刻在" + String(title || loc || place).replace(/^在/, "") };
    // ③ 兜底：开世界那天那张「他会去哪儿」的小表。分开比、取高的，不拼在一起
    const r = (world.route || {})[char.id];
    if (r) {
      let best = null, score = 0.34;
      (r.places || []).forEach(function (q) {
        const sc = Math.max(zhOverlap(q.doing, title), loc ? zhOverlap(q.doing, loc) : 0);
        if (sc > score) { score = sc; best = q.node; }
      });
      if (best) return { node: best, live: true, why: "此刻" + (title ? "在" + title : "") };
      if ((st.type === "sleep" || st.type === "rest") && r.home) return { node: r.home, live: true, why: "回去歇着了" };
    }
    // ④ 行程明明写着他在某处、图上却没有这个地方——这就是她看到的那个样子。
    //    把它说出来（miss），别默默退回落脚点让人以为是坏了。
    return { node: pinned, live: false, miss: place || loc || title || "" };
  }


  // 一个世界的舆图：满屏 SVG，可拖可捏；角色钉在节点上，头像贴着那个点
  function WorldMap({ world, characters, status, me, busy, onPin, onAdd, onGen, onBack, onEdit }) {
    const t = useTheme();
    const [selNode, setSelNode] = useState(null);
    const [adding, setAdding] = useState(false);
    const [vb, setVb] = useState(null);
    const ptr = useRef({ pts: {}, dist: 0, moved: false });
    const skel = (world.regions || []).map(function (r) {
      return r.name + ":" + (r.nodes || []).map(function (n) { return n.name; }).join(",");
    }).join("|");
    const built = React.useMemo(function () {
      const K = window.TrpgMap;
      return (K && world && world.regions) ? K.mapBuild(world.id, world.regions, 360, 620, WORLD_MAX_NODES, WORLD_MAX_REGIONS) : null;
    }, [world && world.id, skel]);
    if (!built) return h("div", { className: "flex-1 flex items-center justify-center", style: { fontFamily: F_BODY, fontSize: 13, color: t.fog } }, "这个世界的地图画不出来——区域至少要两块");
    const pins = (world.pins || {});
    // 画在图上的是【此刻】的位置：行程指到哪儿就在哪儿，指不到才退回落脚点
    // 她自己也能钉进每一个世界（她 2026-08-31 要的）。当成名单里的一员，
    // id 固定 __me，每个世界各记各的——同一个人可以在这个世界在城里、在那个世界在海上。
    const meRow = { id: "__me", name: (me && me.name) || "我", remark: (me && me.name) || "我", color: "#3f6d8c", __me: true };
    const roster = (characters || []).concat([meRow]);
    const where = {};
    roster.forEach(function (c) { where[c.id] = c.__me ? { node: (world.pins || {})[c.id] || "", live: false } : liveNodeOf(world, c, (status || {})[c.id]); });
    const atNode = {};
    roster.forEach(function (c) { const n = where[c.id] && where[c.id].node; if (n) (atNode[n] = atNode[n] || []).push(c); });
    // 视口按【画出来的内容】收紧，不按画布 360×620 收：力导向撒点常常空出一整条边，
    // 照画布铺就是上下各留一条空白网格。视口存 {x,y,w,h}，缩放围着视口中心缩。
    const fit = (function () {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      built.regions.forEach(function (r) {
        const nums = (r.blob.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
        for (let i = 0; i + 1 < nums.length; i += 2) {
          x0 = Math.min(x0, nums[i]); x1 = Math.max(x1, nums[i]);
          y0 = Math.min(y0, nums[i + 1]); y1 = Math.max(y1, nums[i + 1]);
        }
      });
      built.nodes.forEach(function (n) { x0 = Math.min(x0, n.x); x1 = Math.max(x1, n.x); y0 = Math.min(y0, n.y - 16); y1 = Math.max(y1, n.y + 20); });
      if (x1 <= x0 || y1 <= y0) return { x: 0, y: 0, w: built.W, h: built.H };
      const pad = 14;
      return { x: x0 - pad, y: y0 - pad, w: (x1 - x0) + pad * 2, h: (y1 - y0) + pad * 2 };
    })();
    const V = vb || fit;
    const clampVB = function (v) {
      const w = Math.max(fit.w / 6, Math.min(fit.w, v.w));
      const hh = w * fit.h / fit.w;
      return { w: w, h: hh,
        x: Math.max(fit.x - w * 0.25, Math.min(fit.x + fit.w - w * 0.75, v.x)),
        y: Math.max(fit.y - hh * 0.25, Math.min(fit.y + fit.h - hh * 0.75, v.y)) };
    };
    const zoomAt = function (cur, f) {
      const cx = cur.x + cur.w / 2, cy = cur.y + cur.h / 2, w = cur.w / f, hh = cur.h / f;
      return clampVB({ x: cx - w / 2, y: cy - hh / 2, w: w, h: hh });
    };
    const vbStr = V.x.toFixed(1) + " " + V.y.toFixed(1) + " " + V.w.toFixed(1) + " " + V.h.toFixed(1);
    // 单指拖 / 双指捏，同一套 pointer 事件；拖过 6px 就不算点选
    const onPD = function (e) { try { e.currentTarget.setPointerCapture(e.pointerId); } catch (e2) {} const P = ptr.current; P.pts[e.pointerId] = { x: e.clientX, y: e.clientY }; if (Object.keys(P.pts).length === 1) P.moved = false; P.dist = 0; };
    const onPM = function (e) {
      const P = ptr.current;
      if (!P.pts[e.pointerId]) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const ids = Object.keys(P.pts);
      if (ids.length === 1) {
        const p0 = P.pts[e.pointerId], dx = e.clientX - p0.x, dy = e.clientY - p0.y;
        if (Math.abs(dx) + Math.abs(dy) > 6) P.moved = true;
        P.pts[e.pointerId] = { x: e.clientX, y: e.clientY };
        setVb(function (v) { const cur = v || V; return clampVB({ w: cur.w, h: cur.h, x: cur.x - dx * cur.w / rect.width, y: cur.y - dy * cur.h / rect.height }); });
      } else if (ids.length === 2) {
        P.moved = true;
        P.pts[e.pointerId] = { x: e.clientX, y: e.clientY };
        const pts = Object.keys(P.pts).map(function (id) { return P.pts[id]; });
        const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (P.dist) setVb(function (v) { return zoomAt(v || V, d / P.dist); });
        P.dist = d;
      }
    };
    const onPU = function (e) { const P = ptr.current; delete P.pts[e.pointerId]; P.dist = 0; };
    const zoomBtn = function (label, fn) { return h("button", { onClick: fn, className: "active:opacity-70", style: { width: 34, height: 34, borderRadius: 10, fontFamily: F_BODY, fontSize: 15, border: "1px solid " + t.line, background: "rgba(255,255,255,0.9)", color: t.ink } }, label); };
    const sel = selNode ? built.nodes.find(function (n) { return n.name === selNode; }) : null;
    // 节点页：整页（no-half-sheet）——这一层的正文（钩子、谁在这儿、通往哪儿）不需要同时看见地图
    const nodePage = sel ? h("div", { style: mapSubSkin(t) },
      h(Head, { zh: sel.name, en: sel.region + " · " + sel.kind, bg: "transparent", onBack: function () { setSelNode(null); } }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "4px 16px 30px" } },
        h("div", { style: Object.assign({ borderRadius: 16, padding: "16px 16px 18px", border: "1px solid " + t.line }, worldPaper(t)) },
          h("div", { className: "flex items-center", style: { gap: 7, fontFamily: F_DISPLAY, fontSize: 22, color: "#3b3227" } },
            kindMark(sel.kind, 15, "#3b3227"), sel.name),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: "#7a6a54", marginTop: 3 } }, world.name + " · " + sel.region + "（" + (built.regions.find(function (r) { return r.name === sel.region; }) || {}).terrain + "）"),
          sel.hook ? h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: "#4a3f31", lineHeight: 1.85, marginTop: 12, borderTop: "1px dashed rgba(120,104,80,0.35)", paddingTop: 12 } }, sel.hook) : null),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, margin: "18px 2px 7px" } }, "从这里可以去"),
        h("div", { style: { display: "flex", flexWrap: "wrap", gap: 7 } },
          (window.TrpgMap.mapAdjacent(built.edges, sel.name) || []).map(function (n) {
            return h("button", { key: n, onClick: function () { setSelNode(n); }, className: "active:opacity-70",
              style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink, border: "1px solid " + t.line, borderRadius: 999, padding: "6px 14px" } }, "→ " + n);
          })),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, margin: "18px 2px 7px" } }, "谁在这儿"),
        h("div", { style: { display: "flex", flexDirection: "column", gap: 6 } },
          roster.map(function (c) {
            const w = where[c.id] || {};
            const here = w.node === sel.name;
            const other = !here && w.node;
            return h("button", { key: c.id, onClick: function () { onPin(c.id, pins[c.id] === sel.name ? null : sel.name); }, className: "active:opacity-70 w-full",
              style: { display: "flex", alignItems: "center", gap: 10, textAlign: "left", background: here ? t.tint : "transparent", border: "1px solid " + (here ? t.tint : t.line), borderRadius: 14, padding: "9px 13px" } },
              h("div", { style: { width: 30, height: 30, borderRadius: 999, flexShrink: 0, background: (c.avatarImage && typeof resolveImg === "function") ? "center/cover no-repeat url(" + resolveImg(c.avatarImage) + ")" : (c.color || "#7c5c4e"), display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: F_DISPLAY, fontSize: 13 } }, c.avatarImage ? "" : String(c.name || "?").slice(0, 1)),
              h("div", { className: "min-w-0 flex-1" },
                h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: here ? "#fff" : t.ink } }, c.remark || c.name),
                h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: here ? "rgba(255,255,255,0.8)" : t.fog, lineHeight: 1.5 } },
                  c.__me ? (here ? "你在这儿" : other ? "你在「" + w.node + "」" : "你还没进这个世界")
                    : here ? (w.live ? (w.why || "此刻在这儿") + "（跟着今天的行程走）" : ((world.why || {})[c.id] || "就在这儿"))
                    : other ? (w.live ? "此刻在「" + w.node + "」" : "落脚在「" + w.node + "」") : "还没落脚在这个世界里"),
                // 行程说他在某处、图上却没有那个地方——不说的话看起来就是「人不动了」。
                // 说出来，顺手指向右上角那个加地点
                w.miss ? h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: here ? "rgba(255,255,255,0.9)" : t.accent, lineHeight: 1.5, marginTop: 2 } },
                  "行程说他在「" + w.miss + "」，这张图上还没有——右上角可以加一个") : null),
              h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: here ? "rgba(255,255,255,0.85)" : t.tint, flexShrink: 0 } },
                (pins[c.id] === sel.name) ? "挪走" : "钉过来"));
          })))) : null;
    return h("div", { className: "flex-1 flex flex-col", style: { minHeight: 0 } }, nodePage,
      adding ? h(NodeAdd, { world: world, busy: busy, onBack: function () { setAdding(false); },
        onAdd: function (r, nd) { return onAdd(r, nd); }, onGen: function (r, hint) { onGen(r, hint); } }) : null,
      h("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "8px 14px 4px" } },
        h("button", { onClick: onBack, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.sub } }, "‹ 全部世界"),
        h("div", { className: "min-w-0 flex-1", style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, world.name),
        h("button", { onClick: function () { setAdding(true); }, className: "active:opacity-60 shrink-0", style: { fontFamily: F_BODY, fontSize: 12, color: t.tint, marginRight: 10 } }, "＋ 地点"),
        h("button", { onClick: onEdit, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, flexShrink: 0 } }, "···")),
      h("div", { className: "flex-1", style: { position: "relative", minHeight: 0, padding: "4px 12px 0" } },
        h("div", { style: { position: "absolute", right: 20, top: 14, zIndex: 2, display: "flex", flexDirection: "column", gap: 6 } },
          zoomBtn("＋", function () { setVb(function (v) { return zoomAt(v || V, 1.4); }); }),
          zoomBtn("－", function () { setVb(function (v) { return zoomAt(v || V, 1 / 1.4); }); }),
          zoomBtn("⌖", function () { setVb(null); })),
        h("svg", { viewBox: vbStr, preserveAspectRatio: "xMidYMid meet", onPointerDown: onPD, onPointerMove: onPM, onPointerUp: onPU, onPointerCancel: onPU,
          style: Object.assign({ width: "100%", height: "100%", display: "block", borderRadius: 16, border: "1px solid " + t.line, touchAction: "none" }, worldPaper(t)) },
          built.regions.map(function (r) { return h("path", { key: "b" + r.name, d: r.blob, fill: TERR_TINT[r.terrain] || "#e3ded2", stroke: "rgba(88,72,52,0.45)", strokeWidth: 1, opacity: 0.82 }); }),
          built.regions.map(function (r) {
            // 区域名压在中心那个节点上会糊成一团（首府节点就在 cx,cy）——
            // 从团块路径里抠出最高的那个点，把名字挂在上边缘
            const ys = (r.blob.match(/-?\d+(?:\.\d+)?/g) || []).filter(function (_, i) { return i % 2; }).map(Number);
            const top = ys.length ? Math.min.apply(null, ys) : r.cy - 40;
            return h("text", { key: "t" + r.name, x: r.cx, y: top + 15, textAnchor: "middle", fontSize: 11.5, fill: "rgba(72,58,40,0.72)", fontFamily: F_DISPLAY, letterSpacing: 3, stroke: "#f0e9dd", strokeWidth: 3.4, paintOrder: "stroke" }, r.name);
          }),
          built.roads.map(function (rd, i) { return h("path", { key: "r" + i, d: rd.d, fill: "none", stroke: "rgba(96,78,54,0.55)", strokeWidth: 1.2, strokeDasharray: "5 4", strokeLinecap: "round" }); }),
          built.nodes.map(function (nd) {
            const who = atNode[nd.name] || [];
            return h("g", { key: nd.name, onClick: function () { if (!ptr.current.moved) setSelNode(nd.name); }, style: { cursor: "pointer" } },
              h("circle", { cx: nd.x, cy: nd.y, r: 5, fill: "#4a3c2b", stroke: "#f3ece0", strokeWidth: 1.4 }),
              // 记号画在文字左边（不再往文字里塞一个符号字）；文字自己居中，
              // 记号按文字的估宽往左让开，长短名字都对得住。
              h("g", { transform: "translate(" + (nd.x - (String(nd.name || "").length * 4.75 + 4) - 5.5) + "," + (nd.y + 8.6) + ")" },
                h("path", { d: KIND_PATH[nd.kind] || KIND_PATH.地标, fill: "#3f3527", stroke: "#f0e9dd", strokeWidth: 2.4, paintOrder: "stroke", transform: "scale(.78)" })),
              h("text", { x: nd.x + 5.5, y: nd.y + 16, textAnchor: "middle", fontSize: 9.5, fill: "#3f3527", fontFamily: F_BODY, stroke: "#f0e9dd", strokeWidth: 3, paintOrder: "stroke" }, nd.name),
              who.map(function (c, i) {
                const cx = nd.x + 10 + i * 12;
                return h("g", { key: c.id },
                  h("circle", { cx: cx, cy: nd.y - 9, r: 6.5, fill: c.color || "#7c5c4e", stroke: "#fff", strokeWidth: 1.4 }),
                  h("text", { x: cx, y: nd.y - 6.6, textAnchor: "middle", fontSize: 7.5, fill: "#fff", fontFamily: F_BODY }, String(c.remark || c.name || "?").slice(0, 1)));
              }),
              h("circle", { cx: nd.x, cy: nd.y, r: 16, fill: "transparent" }));
          }))),
      h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, lineHeight: 1.7, padding: "7px 16px calc(env(safe-area-inset-bottom, 0px) * 0.4 + 10px)" } },
        "单指拖动 · 双指缩放 · 点一个地点看它藏着什么、把谁钉过去" + (roster.some(function (c) { return where[c.id] && where[c.id].live; }) ? " · 头像跟着今天的行程走" : (Object.keys(pins).length ? "" : "（还没人落脚在这个世界）"))));
  }

  // 往已有的世界里加地点（她 2026-08-31 要的）。整页，不是半窗。
  // 手写那条一次调用都不花；「让模型添几个」才走一次。
  function NodeAdd({ world, busy, onAdd, onGen, onBack }) {
    const t = useTheme();
    const regions = (world.regions || []);
    const [reg, setReg] = useState(regions[0] ? regions[0].name : "");
    const [nm, setNm] = useState("");
    const [kind, setKind] = useState("野外");
    const [hook, setHook] = useState("");
    const [hint, setHint] = useState("");
    const inp = { fontFamily: F_BODY, fontSize: 14, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "11px 13px", width: "100%", outline: "none" };
    const lbl = { fontFamily: F_BODY, fontSize: 11, color: t.fog, margin: "18px 2px 7px" };
    const chip = function (on) { return { fontFamily: F_BODY, fontSize: 12.5, color: on ? "#fff" : t.ink, background: on ? t.tint : "transparent", border: "1px solid " + (on ? t.tint : t.line), borderRadius: 999, padding: "6px 14px" }; };
    return h("div", { style: mapSubSkin(t) },
      h(Head, { zh: "加个地点", en: world.name, bg: "transparent", onBack: onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "4px 16px 30px" } },
        h("div", { style: Object.assign({}, lbl, { marginTop: 6 }) }, "加到哪块地方"),
        h("div", { style: { display: "flex", flexWrap: "wrap", gap: 7 } },
          regions.map(function (r) {
            return h("button", { key: r.name, onClick: function () { setReg(r.name); }, className: "active:opacity-70", style: chip(reg === r.name) },
              r.name + "（" + (r.nodes || []).length + "）");
          })),
        h("div", { style: lbl }, "自己写一个"),
        h("input", { value: nm, onChange: function (e) { setNm(e.target.value); }, placeholder: "地点叫什么", style: inp }),
        h("div", { style: { display: "flex", flexWrap: "wrap", gap: 7, marginTop: 9 } },
          ["城镇", "遗迹", "野外", "地标"].map(function (k) {
            // 图例条目：一个记号 + 一个名字，方角、只有一道边；选中那条上墨、加粗那道边。
            // 圆角药丸是任何 app 的筛选器，图例只在地图上成立（tabs-not-plain-pills）。
            const on2 = kind === k;
            return h("button", { key: k, onClick: function () { setKind(k); }, className: "active:opacity-70 flex items-center",
              "aria-pressed": on2 ? "true" : "false",
              style: { gap: 6, minHeight: 40, padding: "7px 12px", borderRadius: 2,
                fontFamily: F_BODY, fontSize: 12.5, color: on2 ? "#fff" : t.ink,
                background: on2 ? t.ink : "transparent",
                border: (on2 ? "2px" : "1px") + " solid " + (on2 ? t.ink : t.line) } },
              kindMark(k, 13, on2 ? "#fff" : t.ink), k);
          })),
        h("textarea", { value: hook, onChange: function (e) { setHook(e.target.value); }, rows: 3, placeholder: "这儿眼下正有什么事（一句，可空）",
          style: Object.assign({}, inp, { marginTop: 9, lineHeight: 1.8, resize: "vertical" }) }),
        h("button", { onClick: function () { if (onAdd(reg, { name: nm.trim(), kind: kind, hook: hook.trim() })) { setNm(""); setHook(""); } }, disabled: !nm.trim(), className: "w-full active:opacity-80",
          style: { marginTop: 12, fontFamily: F_BODY, fontSize: 14, color: "#fff", background: t.ink, borderRadius: 14, padding: "13px 0", opacity: nm.trim() ? 1 : 0.5 } }, "加进「" + reg + "」（不花调用）"),
        h("div", { style: lbl }, "或者让模型添几个"),
        h("input", { value: hint, onChange: function (e) { setHint(e.target.value); }, placeholder: "想要什么样的？（可空）", style: inp }),
        h("button", { onClick: function () { onGen(reg, hint.trim()); }, disabled: busy, className: "w-full active:opacity-80",
          style: { marginTop: 10, fontFamily: F_BODY, fontSize: 13.5, color: t.tint, border: "1px dashed " + t.line, borderRadius: 14, padding: "12px 0", opacity: busy ? 0.5 : 1 } },
          busy ? "添着…" : "让模型往「" + reg + "」添 2-4 个（一次调用）"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, lineHeight: 1.8, marginTop: 16 } },
          "加完之后，同一块地方里其它地点的位置会挪一挪——地图是按骨架现算的，不存坐标。区域的形状和它们之间的路不会变，人也还站在原来那个地点上。")));
  }

  // 开世界：整页表单。她写一段设定，模型只负责把它铺成区域和地点
  function WorldForm({ init, characters, busy, onGen, onSave, onDel, onBack }) {
    const t = useTheme();
    const [name, setName] = useState((init && init.name) || "");
    const [brief, setBrief] = useState((init && init.prompt) || (init && init.brief) || "");
    // 带哪几个人进去（她 2026-08-31 要的）：把他们的人设和一天的行程一起喂给造世界那一枪，
    // 地方就长成他们过得下去的地方，而不是一张谁都能用的通用地图。
    const [picked, setPicked] = useState(() => ((init && init.cast) || []).slice());
    const toggle = id => setPicked(p => p.indexOf(id) >= 0 ? p.filter(x => x !== id) : (p.length >= 8 ? p : [...p, id]));
    const inp = { fontFamily: F_BODY, fontSize: 14, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "11px 13px", width: "100%", outline: "none" };
    return h("div", { style: mapSubSkin(t) },
      h(Head, { zh: init ? "这个世界" : "开一个世界", en: init ? "" : "New world", bg: "transparent", onBack: onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "4px 16px 30px" } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, margin: "6px 2px 7px" } }, "世界叫什么"),
        h("input", { value: name, onChange: function (e) { setName(e.target.value); }, placeholder: "一个名字", style: inp }),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, margin: "18px 2px 7px" } }, "这个世界是什么样的"),
        h("textarea", { value: brief, onChange: function (e) { setBrief(e.target.value); }, rows: 7, placeholder: "写多少都行：这地方靠什么活着、有哪几块地方、彼此什么关系、路上会遇上什么。写得越具体，画出来的地图越是你的，越含糊模型就越往通用模板上靠。",
          style: Object.assign({}, inp, { lineHeight: 1.8, resize: "vertical" }) }),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, margin: "18px 2px 4px" } }, "带谁进去住"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, lineHeight: 1.7, marginBottom: 8 } },
          "选中的人，他们的人设和一天的行程会一起喂进去——地方就长成他们过得下去的地方，人也会直接落在图上。不选也行，那就是一张空的世界。"),
        h("div", { style: { display: "flex", flexWrap: "wrap", gap: 7 } },
          (characters || []).length ? (characters || []).map(function (c) {
            const on = picked.indexOf(c.id) >= 0;
            return h("button", { key: c.id, onClick: function () { toggle(c.id); }, className: "active:opacity-70",
              style: { display: "flex", alignItems: "center", gap: 6, fontFamily: F_BODY, fontSize: 12.5, color: on ? "#fff" : t.ink, background: on ? t.tint : "transparent", border: "1px solid " + (on ? t.tint : t.line), borderRadius: 999, padding: "5px 12px 5px 5px" } },
              h("div", { style: { width: 22, height: 22, borderRadius: 999, flexShrink: 0, background: (c.avatarImage && typeof resolveImg === "function") ? "center/cover no-repeat url(" + resolveImg(c.avatarImage) + ")" : (c.color || "#7c5c4e"), display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: F_DISPLAY, fontSize: 10 } }, c.avatarImage ? "" : String(c.name || "?").slice(0, 1)),
              c.remark || c.name);
          }) : h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } }, "还没有角色")),
        init ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, lineHeight: 1.8, marginTop: 16 } }, "重画会换掉整张地图，钉在旧地点上的人也会一起掉下来。") : null,
        h("button", { onClick: function () { onGen(name.trim(), brief.trim(), picked); }, disabled: busy || !brief.trim(), className: "w-full active:opacity-80",
          style: { marginTop: 20, fontFamily: F_BODY, fontSize: 14, color: "#fff", background: t.ink, borderRadius: 14, padding: "13px 0", opacity: (busy || !brief.trim()) ? 0.5 : 1 } },
          busy ? "正在铺开这片地方…" : init ? "照这段重画" : "画出这个世界"),
        init ? h("div", { style: { display: "flex", gap: 8, marginTop: 10 } },
          h("button", { onClick: function () { onSave(name.trim(), brief.trim()); }, className: "flex-1 active:opacity-70", style: { fontFamily: F_BODY, fontSize: 13, color: t.ink, border: "1px solid " + t.line, borderRadius: 14, padding: "11px 0" } }, "只改名字和设定"),
          h("button", { onClick: onDel, className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 13, color: t.accent, border: "1px solid " + t.line, borderRadius: 14, padding: "11px 18px" } }, "删掉")) : null));
  }

  // 架空那一半的总入口：世界列表 → 某个世界的舆图
  function StoryMap({ worlds, characters, status, me, busy, onGen, onSave, onDel, onPin, onAddNode, onGenNodes }) {
    const t = useTheme();
    const [wid, setWid] = useState(null);
    const [form, setForm] = useState(null);   // "new" | 世界 id
    const list = worlds || [];
    const cur = wid ? list.find(function (w) { return w.id === wid; }) : null;
    const formInit = (form && form !== "new") ? list.find(function (w) { return w.id === form; }) : null;
    const formLayer = form ? h(WorldForm, {
      init: formInit, characters: characters, busy: busy, onBack: function () { setForm(null); },
      onGen: function (nm, bf, picked) { onGen(formInit ? formInit.id : null, nm, bf, picked, function (id) { setForm(null); setWid(id); }); },
      onSave: function (nm, bf) { onSave(formInit.id, nm, bf); setForm(null); },
      onDel: function () { onDel(formInit.id); setForm(null); setWid(null); }
    }) : null;
    if (cur) return h(React.Fragment, null, formLayer,
      h(WorldMap, { world: cur, characters: characters, status: status, me: me, busy: busy,
        onBack: function () { setWid(null); }, onEdit: function () { setForm(cur.id); },
        onPin: function (charId, node) { onPin(cur.id, charId, node); },
        onAdd: function (r, nd) { return onAddNode(cur.id, r, nd); },
        onGen: function (r, hint) { onGenNodes(cur.id, r, hint); } }));
    return h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "10px 16px 30px" } }, formLayer,
      list.length === 0
        ? h("div", { style: { textAlign: "center", padding: "56px 10px 30px" } },
            h("div", { style: { fontSize: 32, marginBottom: 12 } }, "🏔"),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink, marginBottom: 8 } }, "还没有架空的世界"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, lineHeight: 1.9 } }, "写一段设定，就能铺出一张有区域、有路、有地点的地图。", h("br"), "开几个都行，它们互不相干。"))
        : list.map(function (w) {
            const nNode = (w.regions || []).reduce(function (n, r) { return n + (r.nodes || []).length; }, 0);
            const nPin = Object.keys(w.pins || {}).length;
            return h("button", { key: w.id, onClick: function () { setWid(w.id); }, className: "w-full active:opacity-85",
              style: Object.assign({ display: "block", textAlign: "left", borderRadius: 18, border: "1px solid " + t.line, padding: "15px 16px 16px", marginBottom: 10 }, worldPaper(t)) },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 19, color: "#3b3227" } }, w.name),
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: "#6d5e49", lineHeight: 1.75, marginTop: 5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, w.brief || w.prompt || ""),
              h("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 11 } },
                (w.regions || []).map(function (r) {
                  return h("span", { key: r.name, style: { fontFamily: F_BODY, fontSize: 10.5, color: "#4d4132", background: TERR_TINT[r.terrain] || "#e3ded2", border: "1px solid rgba(88,72,52,0.3)", borderRadius: 999, padding: "2px 9px" } }, r.name);
                })),
              h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#8a7961", marginTop: 9 } },
                (w.regions || []).length + " 块地方 · " + nNode + " 个地点" + (nPin ? " · " + nPin + " 人在里面" : "")));
          }),
      h("button", { onClick: function () { setForm("new"); }, className: "w-full active:opacity-70",
        style: { fontFamily: F_BODY, fontSize: 13.5, color: t.tint, border: "1px dashed " + t.line, borderRadius: 16, padding: "14px 0", marginTop: list.length ? 2 : 20 } }, "＋ 开一个新世界"));
  }

  // 全屏好友地图
  function CharMap({ characters, status, profile, userGeo, mode, onSetMode, onSetHome, onBack, worlds, worldBusy, onGenWorld, onSaveWorld, onDelWorld, onPinWorld, onAddNode, onGenNodes }) {
    const t = useTheme();
    useSchedGeo(characters, status);
    const [sel, setSel] = useState(null);   // 选中要设城市的角色 id
    const [q, setQ] = useState("");
    // 地点搜索 + 导航（v54.16 真货二连）：Nominatim 搜地点落临时钉，OSRM 画从你到那儿的路线
    const [pq, setPq] = useState("");             // 地点搜索词
    const [pRes, setPRes] = useState(null);       // 搜索结果
    const [pBusy, setPBusy] = useState(false);
    const [pin, setPin] = useState(null);         // 临时地点钉 {pos:[lat,lng], name}
    const [route, setRoute] = useState(null);     // {km, min} 当前画着的路线
    const routeLayerRef = useRef(null);
    const routePathRef = useRef([]);              // [[lat,lng]]，只在本机做偏航判断
    const routeDestRef = useRef(null);
    const offRouteRef = useRef({ hits: 0, lastReroute: 0 });
    const spokenRef = useRef(new Set());
    const gpsAccuracyRef = useRef(Infinity);
    const searchAbortRef = useRef(null);
    const routeAbortRef = useRef(null);
    const [routeBusy, setRouteBusy] = useState(false);
    useEffect(function () {
      return function () {
        if (searchAbortRef.current) searchAbortRef.current.abort();
        if (routeAbortRef.current) routeAbortRef.current.abort();
      };
    }, []);
    const clearRoute = function () {
      if (routeLayerRef.current && mapRef.current) { try { mapRef.current.removeLayer(routeLayerRef.current); } catch (e) {} }
      routeLayerRef.current = null; routePathRef.current = []; routeDestRef.current = null;
      offRouteRef.current.hits = 0; spokenRef.current.clear(); setRoute(null);
    };
    const doPlaceSearch = function () {
      if (!pq.trim() || pBusy) return;
      if (searchAbortRef.current) searchAbortRef.current.abort();
      const ctl = new AbortController(); searchAbortRef.current = ctl;
      setPBusy(true); setPRes(null);
      nomSearch(pq.trim(), livePos || (anchor ? [anchor.lat, anchor.lng] : null), ctl.signal)
        .then(function (r) { if (!ctl.signal.aborted) setPRes(r); })
        .catch(function (e) { if (!ctl.signal.aborted) { setPRes([]); if (typeof toast === "function") toast("地点搜索暂时没响应"); } })
        .finally(function () { if (searchAbortRef.current === ctl) { searchAbortRef.current = null; setPBusy(false); } });
    };
    const goPlace = function (p) {
      clearRoute(); setPRes(null); setPq("");
      setPin({ pos: [p.lat, p.lng], name: p.name });
      if (mapRef.current) { try { mapRef.current.setView([p.lat, p.lng], 14, { animate: true }); } catch (e) {} }
    };
    // 把 OSRM 的 maneuver 翻成人话（OSRM 只给类型不给文案）
    const stepText = function (s) {
      const M = { left: "左转", right: "右转", "slight left": "稍向左", "slight right": "稍向右", "sharp left": "急左转", "sharp right": "急右转", straight: "直行", uturn: "掉头" };
      const m = s.maneuver || {}; const road = s.name ? "进入 " + s.name : "";
      if (m.type === "depart") return "出发" + (s.name ? "，沿 " + s.name : "");
      if (m.type === "arrive") return "到达目的地";
      if (m.type === "roundabout" || m.type === "rotary") return "环岛第 " + (m.exit || 1) + " 个出口" + (road ? "，" + road : "");
      if (m.type === "merge") return "并线" + (road ? "，" + road : "");
      if (m.type === "on ramp") return "上匝道" + (road ? "，" + road : "");
      if (m.type === "off ramp") return "下匝道" + (road ? "，" + road : "");
      return (M[m.modifier] || "继续") + (road ? "，" + road : "");
    };
    const havM = function (a, b) { const R = 6371000, dLa = (b[0] - a[0]) * Math.PI / 180, dLo = (b[1] - a[1]) * Math.PI / 180, la = a[0] * Math.PI / 180, lb = b[0] * Math.PI / 180; const x = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(la) * Math.cos(lb) * Math.sin(dLo / 2) * Math.sin(dLo / 2); return 2 * R * Math.asin(Math.sqrt(x)); };
    const [steps, setSteps] = useState(null);       // 转弯步骤 [{pos,text,dist}]
    const [stepsOpen, setStepsOpen] = useState(false);
    const routeTo = function (dest, automatic) {
      const from = livePos || (anchor ? [anchor.lat, anchor.lng] : null);
      if (!from || !dest || routeBusy) return;
      if (routeAbortRef.current) routeAbortRef.current.abort();
      const ctl = new AbortController(); routeAbortRef.current = ctl;
      setRouteBusy(true);
      clearRoute(); setSteps(null); setStepsOpen(false);
      routeDestRef.current = dest.slice();
      const applyRoute = function (rt) {
          const map = mapRef.current; const coords = rt && rt.geometry;
          if (!rt || !map || !Array.isArray(coords) || !coords.length) throw new Error("route_empty");
          const line = window.L.polyline(coords.map(function (c) { return [c[1], c[0]]; }), { color: "#3f6d8c", weight: 5, opacity: 0.85 });
          line.addTo(map); routeLayerRef.current = line;
          routePathRef.current = coords.map(function (c) { return [c[1], c[0]]; });
          if (!automatic) { try { map.fitBounds(line.getBounds(), { padding: [40, 40] }); } catch (e) {} }
          setRoute({ km: (rt.distance / 1000).toFixed(rt.distance > 20000 ? 0 : 1), min: Math.round(rt.duration / 60) });
          const st = (rt.steps || []).map(function (s) {
            const loc = s && s.maneuver && s.maneuver.location;
            return loc && loc.length === 2 ? { pos: [loc[1], loc[0]], text: stepText(s), dist: s.distance || 0 } : null;
          }).filter(Boolean);
          spokenRef.current.clear(); offRouteRef.current.hits = 0;
          setSteps(st.length ? st : null);
          if (automatic && typeof toast === "function") toast("已按当前位置重新规划路线");
      };
      const fallback = function () {
        // 故障回退永远 steps=false；绝不让手机重新吞逐步 geometry。
        return fetch("https://router.project-osrm.org/route/v1/driving/" + from[1] + "," + from[0] + ";" + dest[1] + "," + dest[0] + "?overview=simplified&geometries=geojson&steps=false", { signal: ctl.signal })
          .then(function (r) { if (!r.ok) throw new Error("route_" + r.status); return r.json(); })
          .then(function (d) { const rt = d && d.routes && d.routes[0]; return { distance: rt && rt.distance, duration: rt && rt.duration, geometry: rt && rt.geometry && rt.geometry.coordinates, steps: [] }; });
      };
      fetch(ROUTE_PROXY, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ from: from, to: dest }), signal: ctl.signal })
        .then(function (r) { if (!r.ok) throw new Error("proxy_" + r.status); return r.json(); })
        .catch(function (e) { if (ctl.signal.aborted) throw e; return fallback(); })
        .then(function (rt) { if (!ctl.signal.aborted) applyRoute(rt); })
        .catch(function (e) { if (!ctl.signal.aborted && typeof toast === "function") toast("路线服务暂时没响应"); })
        .finally(function () { if (routeAbortRef.current === ctl) { routeAbortRef.current = null; setRouteBusy(false); } });
    };
    // 你自己的实时位置（像苹果地图蓝点）：进地图就持续 watchPosition，离开清掉。仅前台生效。
    const [livePos, setLivePos] = useState(userGeo && typeof userGeo.lat === "number" ? [userGeo.lat, userGeo.lng] : null);
    // 必须放在 livePos 初始化之后：steps 从 null 变成数组后的下一次渲染会真的读取
    // livePos；若计算块排在 useState 前，会命中 const 暂时性死区，整页直接崩掉。
    const nextTurn = (function () {
      if (!steps || !livePos) return null;
      let best = 0, bd = Infinity;
      for (var i = 0; i < steps.length; i++) { const dd = havM(livePos, steps[i].pos); if (dd < bd) { bd = dd; best = i; } }
      const nx = (bd < 40 && best + 1 < steps.length) ? steps[best + 1] : steps[best]; // 已到达这步跳下一步
      const m = Math.round(havM(livePos, nx.pos));
      return { text: nx.text, m: m, index: (bd < 40 && best + 1 < steps.length) ? best + 1 : best };
    })();
    useEffect(function () {
      if (!navigator.geolocation) return;
      const id = navigator.geolocation.watchPosition(
        function (p) { gpsAccuracyRef.current = Number(p.coords.accuracy || Infinity); setLivePos([p.coords.latitude, p.coords.longitude]); },
        function () {}, { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 });
      return function () { try { navigator.geolocation.clearWatch(id); } catch (e) {} };
    }, []);
    // 点到路线折线的近似距离（局部等距投影，城市导航足够准确）。
    const routeDistanceM = function (p, path) {
      if (!p || !path || path.length < 2) return Infinity;
      const kLat = 111320, kLng = 111320 * Math.cos(p[0] * Math.PI / 180); let best = Infinity;
      for (var i = 1; i < path.length; i++) {
        const ax = (path[i - 1][1] - p[1]) * kLng, ay = (path[i - 1][0] - p[0]) * kLat;
        const bx = (path[i][1] - p[1]) * kLng, by = (path[i][0] - p[0]) * kLat;
        const dx = bx - ax, dy = by - ay, den = dx * dx + dy * dy;
        const u = den ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / den)) : 0;
        best = Math.min(best, Math.hypot(ax + u * dx, ay + u * dy));
      }
      return best;
    };
    // 连续三次偏离 180m 才重算（给简化路线和 GPS 漂移留余量）；定位精度太差不判，且 45 秒内最多重算一次。
    useEffect(function () {
      const path = routePathRef.current, dest = routeDestRef.current;
      if (!route || !livePos || !dest || path.length < 2 || gpsAccuracyRef.current > 100) return;
      const state = offRouteRef.current, away = routeDistanceM(livePos, path) > 180;
      state.hits = away ? state.hits + 1 : 0;
      if (state.hits >= 3 && Date.now() - state.lastReroute > 45000 && !routeAbortRef.current) {
        state.hits = 0; state.lastReroute = Date.now(); routeTo(dest, true);
      }
    }, [livePos]);
    // 临近同一个转弯分档播报；每档只说一次，不打断正在播放的提示。
    useEffect(function () {
      if (!nextTurn || !window.speechSynthesis || document.visibilityState === "hidden") return;
      const band = nextTurn.m <= 80 ? "now" : nextTurn.m <= 300 ? "near" : nextTurn.m <= 800 ? "ahead" : "";
      if (!band) return;
      const key = nextTurn.index + ":" + band;
      if (spokenRef.current.has(key) || window.speechSynthesis.speaking) return;
      const lead = band === "now" ? "现在" : (nextTurn.m + "米后");
      const utter = new window.SpeechSynthesisUtterance(lead + "，" + nextTurn.text);
      utter.lang = "zh-CN"; utter.rate = 1.02; spokenRef.current.add(key); window.speechSynthesis.speak(utter);
    }, [nextTurn && nextTurn.index, nextTurn && (nextTurn.m <= 80 ? "now" : nextTurn.m <= 300 ? "near" : nextTurn.m <= 800 ? "ahead" : "")]);
    const mapRef = useRef(null);
    const allPtsRef = useRef([]);
    const centeredRef = useRef(false);
    // 进地图默认对准你（不是看全部）；GPS 到了再精确对准一次
    useEffect(function () {
      if (mapRef.current && livePos && !centeredRef.current) { try { mapRef.current.setView(livePos, 12); centeredRef.current = true; } catch (e) {} }
    }, [livePos]);
    const anchor = livePos ? { lat: livePos[0], lng: livePos[1] } : (userGeo && typeof userGeo.lat === "number" ? userGeo : null);
    // 住在架空世界里的那几位不画在现实图上（她 2026-09-06 那个「钉了温尼伯又钉了架空世界」）：
    // 一个王爷插在温尼伯的街上，看着就不对。取消那一钉，他自己就回来了。
    const pins = (characters || []).filter(function (c) { return charRealm(c, worlds).kind === "real"; }).map(function (c) {
      const st = (status || {})[c.id];
      const label = st && st.title ? (c.name + " · " + st.title) : c.name;
      return { pos: charPos(c, st, anchor), html: avatarHtml(c, 40), size: 40, tooltip: label, onClick: function () { setSel(c.id); } };
    }).filter(function (p) { return p.pos; });
    if (livePos) pins.push({ pos: livePos, size: 22, html: meDotHtml(20), tooltip: (profile && profile.name || "我") + "（你 · 实时）" });
    if (pin) pins.push({ pos: pin.pos, size: 30, html: "<div style='font-size:26px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))'>📍</div>", tooltip: pin.name });
    allPtsRef.current = pins.map(function (p) { return p.pos; });
    const flyTo = function (pos) { if (mapRef.current && pos) { try { mapRef.current.setView(pos, 13, { animate: true }); } catch (e) {} } };
    const fitAll = function () { if (mapRef.current && allPtsRef.current.length) { try { mapRef.current.fitBounds(allPtsRef.current, { padding: [30, 30], maxZoom: 12 }); } catch (e) {} } };
    const cityList = CITY_NAMES.filter(function (n) { return !q.trim() || n.indexOf(q.trim()) >= 0; });
    const selChar = sel ? (characters || []).find(function (c) { return c.id === sel; }) : null;
    return h("div", { className: "h-full flex flex-col" },
      // 顶栏走共用的 Head（施工规则/mobile-ui-layout.md §1）：手写那条一个挂点都没有，
      // 「好友地图」这一页的主题 CSS 抓不到顶栏；返回键原来还是个 19px 的「←」字符。
      h(Head, { zh: "好友地图", onBack: onBack, noLine: true,
        right: h("div", { className: "flex shrink-0", style: { gap: 4, background: t.bg2, border: "1px solid " + t.line, borderRadius: 999, padding: 2 } },
          [["real", "现实"], ["story", "架空"]].map(function (m) {
            const on = (mode || "real") === m[0];
            return h("button", { key: m[0], onClick: function () { onSetMode && onSetMode(m[0]); }, style: { fontFamily: F_BODY, fontSize: 11.5, padding: "4px 11px", borderRadius: 999, background: on ? t.ink : "transparent", color: on ? t.bg2 : t.sub } }, m[1]);
          })) }),
      (mode || "real") === "story"
        ? h(StoryMap, { worlds: worlds, characters: characters, status: status, me: profile, busy: worldBusy, onGen: onGenWorld, onSave: onSaveWorld, onDel: onDelWorld, onPin: onPinWorld, onAddNode: onAddNode, onGenNodes: onGenNodes })
        : h("div", { className: "flex-1", style: { position: "relative", minHeight: 0, isolation: "isolate" } },
            // ⚠️人少了要说一声：住在架空世界里的那几位不画在这张图上。
            //   不说的话她只会看见「有人不见了」，以为坏了（诚实的诊断要写在她看得见的地方）。
            (function () {
              const away = (characters || []).filter(function (c) { return charRealm(c, worlds).kind === "world"; });
              if (!away.length) return null;
              return h("div", { style: { position: "absolute", left: 12, right: 12, bottom: 12, zIndex: 1200,
                background: "rgba(255,255,255,0.94)", border: "1px solid " + t.line, borderRadius: 12, padding: "8px 12px",
                fontFamily: F_BODY, fontSize: 11, color: t.sub, lineHeight: 1.6, boxShadow: "0 4px 14px rgba(0,0,0,.10)" } },
                away.map(function (c) { return c.name; }).join("、") + " 住在架空世界里，没画在这张图上（去「架空」那边看；把那边的钉子取消，他就回来）");
            })(),
            h(MapCanvas, { pins: pins, opts: { noFit: true, zoomControl: true, zoom: 11, onReady: function (m) { mapRef.current = m; const c = livePos || (anchor ? [anchor.lat, anchor.lng] : allPtsRef.current[0]); if (c) { try { m.setView(c, livePos ? 12 : 11); } catch (e) {} if (livePos) centeredRef.current = true; } } }, style: { position: "absolute", inset: 0, width: "100%", height: "100%" } }),
            // 地点搜索条（真·全球搜索）
            h("div", { style: { position: "absolute", top: 10, left: 12, right: 12, zIndex: 1200 } },
              h("div", { style: { display: "flex", gap: 6 } },
                h("input", { value: pq, onChange: function (e) { setPq(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter") doPlaceSearch(); }, placeholder: "搜任何地方：店名 / 地址 / 城市",
                  style: { flex: 1, fontFamily: F_BODY, fontSize: 13.5, color: t.ink, background: "rgba(255,255,255,0.95)", border: "1px solid " + t.line, borderRadius: 999, padding: "9px 15px", outline: "none", boxShadow: "0 2px 10px rgba(0,0,0,.10)" } }),
                h("button", { onClick: doPlaceSearch, className: "shrink-0 active:opacity-70", style: { fontFamily: F_BODY, fontSize: 13, color: "#fff", background: t.ink, borderRadius: 999, padding: "0 16px", boxShadow: "0 2px 10px rgba(0,0,0,.15)" } }, pBusy ? "…" : "搜")),
              pRes ? h("div", { style: { marginTop: 6, background: "rgba(255,255,255,0.97)", border: "1px solid " + t.line, borderRadius: 14, overflow: "hidden", boxShadow: "0 6px 20px rgba(0,0,0,.12)" } },
                pRes.length ? pRes.map(function (p, i) {
                  return h("button", { key: i, onClick: function () { goPlace(p); }, className: "w-full active:opacity-70", style: { display: "block", textAlign: "left", padding: "9px 14px", borderTop: i ? "1px solid " + t.line : "none" } },
                    h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.ink } }, p.name),
                    h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, p.full));
                }) : h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, padding: "10px 14px" } }, "没搜到，换个说法试试")) : null),
            // 临时地点卡：导航 / 清除
            pin ? h("div", { style: { position: "absolute", left: 12, right: 12, bottom: 86, zIndex: 1200, background: "rgba(255,255,255,0.97)", border: "1px solid " + t.line, borderRadius: 16, padding: "10px 14px", boxShadow: "0 6px 20px rgba(0,0,0,.14)", display: "flex", alignItems: "center", gap: 10 } },
              h("div", { className: "min-w-0 flex-1" },
                h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, "📍 " + pin.name),
                route ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.tint, marginTop: 2 } }, "🚗 " + route.km + " km · 约 " + route.min + " 分钟") : null),
              route && steps ? h("button", { onClick: function () { setStepsOpen(!stepsOpen); }, className: "shrink-0 active:opacity-70", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink, border: "1px solid " + t.line, borderRadius: 999, padding: "7px 12px" } }, stepsOpen ? "收起" : "步骤") : null,
              h("button", { onClick: function () { routeTo(pin.pos); }, disabled: routeBusy, className: "shrink-0 active:opacity-70", style: { fontFamily: F_BODY, fontSize: 12.5, color: "#fff", background: "#3f6d8c", borderRadius: 999, padding: "7px 14px", opacity: routeBusy ? 0.65 : 1 } }, routeBusy ? "算路中…" : "路线"),
              h("button", { onClick: function () { setPin(null); clearRoute(); setSteps(null); }, className: "shrink-0 active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, padding: "7px 4px" } }, "✕")) : null,
            // 实时下一步提示（真导航横幅）：绿牌报「XX 米后 干什么」，随你移动自己刷新
            (route && nextTurn) ? h("div", { style: { position: "absolute", top: 62, left: 12, right: 12, zIndex: 1200, background: "#2e5e46", borderRadius: 14, padding: "10px 16px", boxShadow: "0 6px 20px rgba(0,0,0,.25)", display: "flex", alignItems: "center", gap: 12 } },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: "#fff", whiteSpace: "nowrap" } }, nextTurn.m >= 1000 ? (nextTurn.m / 1000).toFixed(1) + " km" : nextTurn.m + " m"),
              h("div", { style: { fontFamily: F_BODY, fontSize: 14, color: "rgba(255,255,255,0.95)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, nextTurn.text)) : null,
            // 全程步骤列表
            (route && steps && stepsOpen) ? h("div", { style: { position: "absolute", left: 12, right: 12, bottom: 150, maxHeight: "38%", overflowY: "auto", zIndex: 1200, background: "rgba(255,255,255,0.97)", border: "1px solid " + t.line, borderRadius: 16, boxShadow: "0 6px 20px rgba(0,0,0,.14)" } },
              steps.map(function (s, i) {
                return h("div", { key: i, style: { display: "flex", gap: 10, alignItems: "baseline", padding: "8px 14px", borderTop: i ? "1px solid " + t.line : "none" } },
                  h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, flexShrink: 0, width: 52, textAlign: "right" } }, s.dist >= 1000 ? (s.dist / 1000).toFixed(1) + " km" : Math.round(s.dist) + " m"),
                  h("span", { style: { fontFamily: F_BODY, fontSize: 13, color: t.ink } }, s.text));
              })) : null,
            // 底部角色条（z-index 压过 Leaflet 图层）：点头像=飞到 TA；右侧「设/改」=设城市；最前「全部」=看全部
            h("div", { style: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 1200, padding: "10px 12px 14px", background: "linear-gradient(0deg,rgba(255,255,255,0.96),rgba(255,255,255,0.7) 55%,rgba(255,255,255,0))", display: "flex", gap: 8, overflowX: "auto", alignItems: "center" } },
              h("button", { key: "__all", onClick: fitAll, className: "shrink-0 active:opacity-80", style: { display: "flex", alignItems: "center", gap: 5, background: "#fff", border: "1px solid " + t.line, borderRadius: 999, padding: "8px 14px", boxShadow: "0 2px 8px rgba(0,0,0,.08)" } },
                h("span", { style: { fontSize: 13 } }, "🗺️"), h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink } }, "全部")),
              (characters || []).map(function (c) {
                const hm = charHome(c); const st = (status || {})[c.id]; const pos = charPos(c, st, anchor);
                return h("div", { key: c.id, className: "shrink-0", style: { display: "flex", alignItems: "stretch", background: "#fff", border: "1px solid " + t.line, borderRadius: 999, boxShadow: "0 2px 8px rgba(0,0,0,.08)", overflow: "hidden" } },
                  h("button", { onClick: function () { flyTo(pos); }, className: "active:opacity-70", style: { display: "flex", alignItems: "center", gap: 7, padding: "5px 6px 5px 6px" } },
                    (function () { const av = c.avatarImage ? (typeof resolveImg === "function" ? resolveImg(c.avatarImage) : c.avatarImage) : ""; return h("div", { style: { width: 26, height: 26, borderRadius: 999, flexShrink: 0, background: av ? "center/cover no-repeat url(" + av + ")" : (c.color || "#7c5c4e"), display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: F_DISPLAY, fontSize: 12 } }, av ? "" : String(c.name || "?").slice(0, 1)); })(),
                    h("div", { style: { textAlign: "left" } },
                      h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink, lineHeight: 1.1 } }, c.remark || c.name),
                      h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, color: hm ? t.tint : t.fog } }, hm ? (hm.city + (st && st.title ? " · " + String(st.title).slice(0, 6) : "")) : "在你附近"))),
                  h("button", { onClick: function () { setSel(c.id); }, className: "active:opacity-60", title: "设城市", style: { display: "flex", alignItems: "center", padding: "0 11px", borderLeft: "1px solid " + t.line, color: hm ? t.sub : t.accent, fontFamily: F_BODY, fontSize: 11 } }, hm ? "改" : "设"));
              }))),
      // 设城市弹层
      sel && h(Sheet, { onClose: function () { setSel(null); setQ(""); }, tall: true },
        h("div", { className: "flex items-center justify-between", style: { marginBottom: 8 } },
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: t.ink } }, "「" + (selChar ? (selChar.remark || selChar.name) : "") + "」在哪座城市"),
          charHome(selChar) ? h("button", { onClick: function () { onSetHome(sel, null); setSel(null); setQ(""); }, style: { fontFamily: F_BODY, fontSize: 12.5, color: t.accent } }, "清除") : null),
        h("input", { value: q, onChange: function (e) { setQ(e.target.value); }, placeholder: "搜城市名，如 上海 / 东京 / 伦敦",
          style: { fontFamily: F_BODY, fontSize: 14, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 10, padding: "10px 12px", width: "100%", outline: "none", marginBottom: 10 } }),
        h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, maxHeight: "42vh", overflowY: "auto" } },
          cityList.map(function (name) {
            const cur = charHome(selChar) && charHome(selChar).city === name;
            return h("button", { key: name, onClick: function () { const c = CITY_DB[name]; onSetHome(sel, { city: name, lat: c[0], lng: c[1] }); setSel(null); setQ(""); }, className: "active:opacity-70",
              style: { fontFamily: F_BODY, fontSize: 13.5, color: cur ? "#fff" : t.ink, background: cur ? t.tint : "transparent", border: "1px solid " + (cur ? t.tint : t.line), borderRadius: 999, padding: "7px 15px" } }, name);
          }),
          cityList.length === 0 ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, padding: 8 } }, "内置名单里没有——用下面的全网搜索，全世界任何城市都能设") : null),
        // 名单外城市：Nominatim 全网搜（v54.16 起任何地方都能当家乡）
        q.trim() ? h("button", { onClick: function () {
            nomSearch(q.trim()).then(function (r) {
              const p = r && r[0];
              if (p) { onSetHome(sel, { city: p.name.split(",")[0], lat: p.lat, lng: p.lng }); setSel(null); setQ(""); }
              else if (typeof toast === "function") toast("全网也没搜到这个地方");
            }).catch(function () { if (typeof toast === "function") toast("搜索接口没响应，稍后再试"); });
          }, className: "w-full active:opacity-70", style: { marginTop: 10, fontFamily: F_BODY, fontSize: 13, color: t.tint, border: "1px dashed " + t.line, borderRadius: 10, padding: "10px 0" } }, "🔍 全网搜「" + q.trim() + "」并设为家乡") : null));
  }

  if (inApp) window.MapKit = { MapWidget: MapWidget, CharMap: CharMap, StoryMap: StoryMap, CITY_DB: CITY_DB, charHome: charHome, liveNodeOf: liveNodeOf, zhOverlap: zhOverlap, charRealm: charRealm };
  // 纯函数导出给 node --test；浏览器里没有 module，原样跳过（同 trpg.js）
  if (typeof module === "object" && module.exports) module.exports = { liveNodeOf: liveNodeOf, zhOverlap: zhOverlap, charRealm: charRealm, charPos: charPos };
})();
