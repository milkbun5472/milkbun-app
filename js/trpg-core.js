// 跑团的开机那半（2026-10-18 瘦身第八批，从 js/trpg.js 拆出来）：主屏图标（GTrpg）和地图引擎（TrpgMap，好友地图的架空那半、
//   世界生成也在用）开机就要。跑团整页在 js/trpg.js，点进去才加载（js/lazy-mods.js）。
//   测试会 require 这份，所以递过去的那一包挂在 window，没有 window 时挂 globalThis。
// ============================================================
// 跑团（trpg）—— 文字跑团 / TTRPG
// Lisa(玩家) + 至多 4 名角色队友 + 模型当守密人(GM)。
// 参考 ai-virtual-phone 的冒险玩法【思路】(不复制其 AGPL 代码):
//   · 骰子全部由客户端掷(d100 五档),模型只能给选项挂检定,绝不自己编骰子结果——
//     和小剧场取景骰子同一课:客户端真随机压得住语料先验,模型自称的随机压不住。
//   · GM 秘典(隐藏真相/伏笔/转折/结局方向)开团即生成,结局落幕后才解密给玩家看。
//   · 状态(HP/物品/线索/章节)走【结构化 JSON 字段+名字校验】才落账,不从散文里
//     用正则抠——那是参考项目状态漂移的病根;章节进度只有一个计数器。
//   · 每拍 GM 消息带一份小状态快照,从任意一拍分支回溯时按快照恢复,不会带错账。
// 成本:一回合只打一次 GM 调用(守密人叙事并代入全部队友),不做每回合 1+N 次
//   调用——她按次计费。言秋在队里时,TA那一句先走 CC 亲笔票(同小剧场管道)。
// 完全沙箱(四处一样喂·合法差异,同小剧场先例):平行时空,只读人设,不读写主线
//   记忆/世界书/好感/心情;数据只存 x_trpg(跟随 x_ 前缀整包云同步)。
// ============================================================
(function () {
  // node --test 会直接 require 这份文件跑纯函数,那边没有 React/window——顶层一律守卫
  const inApp = typeof window !== "undefined" && typeof React !== "undefined";
  // 图标:一枚二十面骰(六边形 + 内三角),挂进 REG 的 window.GTrpg
  if (inApp) window.GTrpg = p => h(Svg, p, h("path", { d: "M12 2.4l8.3 4.8v9.6L12 21.6l-8.3-4.8V7.2z" }), h("path", { d: "M12 7.4l4.6 7.8H7.4z" }), h("path", { d: "M12 2.4v5M3.7 7.2l3.7 8M20.3 7.2l-3.7 8M12 21.6l-4.6-6.4M12 21.6l4.6-6.4" }));

  // ---- 手绘旅程图(纯函数) ----
  // 参考 ai-virtual-phone 地图引擎拆解后的结论:留矢量、丢栅格。这里只要一条
  // 蜿蜒小径 + 章节节点;种子取战役 id,同一场团每次画出来一模一样。
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hashStr = s => { let h2 = 5381; s = String(s || ""); for (let i = 0; i < s.length; i++) h2 = (h2 * 33 + s.charCodeAt(i)) >>> 0; return h2; };

  // ---- 大地图(纯函数,全矢量) ----
  // 参考 ai-virtual-phone 地图引擎拆解后的取舍:留下它的灵魂两件事——
  //   ① 模型宣告的【区域接壤关系】驱动力导向布局:说风语镇挨着暗影林,地图上就真挨着;
  //   ② 道路和可行走图【同一趟循环】生成:画出来的路永远等于能走的边,不会两张皮。
  // 丢掉它的栅格化重活(120×90 网格/行军方块/Dijkstra 描边):全走矢量,毫秒级出图,
  // 不卡主线程也不用存大 blob——布局由 (战役id, 骨架) 决定,每次现算,张张一样。
  function normRegions(raw, maxNodes, maxRegions) {
    const MAXN = maxNodes || 3, MAXR = maxRegions || 6;
    const TERR = ["山地", "平原", "森林", "水泽", "荒漠", "城郭"];
    const KIND = ["城镇", "遗迹", "野外", "地标"];
    const seen = {};
    const regions = (Array.isArray(raw) ? raw : []).map(r => {
      if (!r || typeof r !== "object") return null;
      const name = String(r.name || "").trim().slice(0, 16); // 跟改名那一处同长（原来 8：改名能存 16 个字，这里一截，图上的名字就跟存的对不上，再改就找不到它了）
      if (!name || seen[name]) return null;
      seen[name] = 1;
      const nseen = {};
      const nodes = (Array.isArray(r.nodes) ? r.nodes : []).map(n => {
        if (typeof n === "string") n = { name: n };
        if (!n || typeof n !== "object") return null;
        const nm = String(n.name || "").trim().slice(0, 10);
        if (!nm || nseen[nm]) return null;
        nseen[nm] = 1;
        return { name: nm, kind: KIND.indexOf(n.kind) >= 0 ? n.kind : "野外", hook: String(n.hook || "").trim().slice(0, 60) };
      }).filter(Boolean).slice(0, MAXN);
      if (!nodes.length) nodes.push({ name: name, kind: "地标", hook: "" });
      // 手动摆过的位置（0~1 的比例）和大小（0.6~1.6 倍），没摆过就是 null，照旧自动排
      const pos = r.pos && isFinite(r.pos.x) && isFinite(r.pos.y) ? { x: Math.max(0.08, Math.min(0.92, +r.pos.x)), y: Math.max(0.08, Math.min(0.92, +r.pos.y)) } : null;
      const size = isFinite(r.size) ? Math.max(0.6, Math.min(1.6, +r.size)) : 1;
      return { name, terrain: TERR.indexOf(r.terrain) >= 0 ? r.terrain : "平原", adj: (Array.isArray(r.adj) ? r.adj : []).map(x => String(x || "").trim()).filter(Boolean), nodes, pos, size };
    }).filter(Boolean).slice(0, MAXR);
    // 接壤只认双方都存在的名字,并补成对称;谁都不挨的孤区随后由道路兜底接上
    const names = regions.map(r => r.name);
    regions.forEach(r => { r.adj = r.adj.filter(a => a !== r.name && names.indexOf(a) >= 0); });
    regions.forEach(r => r.adj.forEach(a => { const o = regions.find(x => x.name === a); if (o && o.adj.indexOf(r.name) < 0) o.adj.push(r.name); }));
    return regions.length >= 2 ? regions : null;
  }
  // 力导向:接壤的区域互相拉近(弹簧),不接壤的互相推开,整体轻轻向画布中心收
  function forceLayout(regions, rand, W, H) {
    const n = regions.length;
    const pos = [];
    for (let i = 0; i < n; i++) {
      // 最远点撒种:每个新中心从 24 个随机候选里挑离已有中心最远的那个
      let best = null, bd = -1;
      for (let t = 0; t < 24; t++) {
        const c = { x: W * (0.18 + rand() * 0.64), y: H * (0.18 + rand() * 0.64) };
        const d = pos.length ? Math.min.apply(null, pos.map(p2 => (p2.x - c.x) ** 2 + (p2.y - c.y) ** 2)) : 1e9;
        if (d > bd) { bd = d; best = c; }
      }
      pos.push(best);
    }
    const target = Math.min(W, H) / 2.1;
    for (let it = 0; it < 60; it++) {
      const f = pos.map(() => ({ x: 0, y: 0 }));
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const dx = pos[j].x - pos[i].x, dy = pos[j].y - pos[i].y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const linked = regions[i].adj.indexOf(regions[j].name) >= 0;
        const k = linked ? (d - target) * 0.02 : Math.min(0, (d - target * 1.25)) * 0.03;
        f[i].x += dx / d * k; f[i].y += dy / d * k;
        f[j].x -= dx / d * k; f[j].y -= dy / d * k;
      }
      pos.forEach((p2, i) => {
        p2.x += f[i].x + (W / 2 - p2.x) * 0.004;
        p2.y += f[i].y + (H / 2 - p2.y) * 0.004;
        p2.x = Math.max(W * 0.14, Math.min(W * 0.86, p2.x));
        p2.y = Math.max(H * 0.14, Math.min(H * 0.86, p2.y));
      });
    }
    return pos;
  }
  // Chaikin 切角(闭合):每段取 1/4 与 3/4 点,两轮下来折线就圆润成手绘团块
  function chaikinClosed(pts, iters) {
    for (let it = 0; it < (iters || 2); it++) {
      const out = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
        out.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
      }
      pts = out;
    }
    return pts;
  }
  // 区域团块:极坐标 24 根射线,半径带噪声,并被「到最近邻中心距离」软钳住——
  // 这就是不用 Dijkstra 也能让边界互相退让的省事法
  function regionBlob(center, others, rand, baseR) {
    const pts = [];
    const RAYS = 24;
    const jit = []; for (let i = 0; i < RAYS; i++) jit.push(0.72 + rand() * 0.56);
    for (let i = 0; i < RAYS; i++) {
      const a = i / RAYS * Math.PI * 2;
      let r = baseR * (jit[i] + jit[(i + 1) % RAYS]) / 2;
      others.forEach(o => {
        const d = Math.sqrt((o.x - center.x) ** 2 + (o.y - center.y) ** 2);
        const toward = Math.cos(a - Math.atan2(o.y - center.y, o.x - center.x));
        if (toward > 0) r = Math.min(r, d * (0.62 - 0.1 * toward));
      });
      pts.push({ x: center.x + Math.cos(a) * r, y: center.y + Math.sin(a) * r });
    }
    const sm = chaikinClosed(pts, 2);
    const d = sm.map((p2, i) => (i ? "L" : "M") + p2.x.toFixed(1) + " " + p2.y.toFixed(1)).join("") + "Z";
    // 每个方向伸出去多远（地点落不落在这块地里，照它算）
    return { d, center, poly: sm, rays: pts.map(q => Math.sqrt((q.x - center.x) ** 2 + (q.y - center.y) ** 2)) };
  }
  // 一个点在不在这块地里：按它的方向在两条射线之间插值，留一点边（平滑过的边比射线往里收一点，字也要地方）
  //   照画出来的那条边（磨圆以后的）判：把点从中心往外推一截（÷margin）还在边里，才算站得稳
  function inBlob(b, p, margin) {
    const m = margin || 0.8, q = { x: b.center.x + (p.x - b.center.x) / m, y: b.center.y + (p.y - b.center.y) / m }, P = b.poly;
    let c = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      if ((P[i].y > q.y) !== (P[j].y > q.y) && q.x < (P[j].x - P[i].x) * (q.y - P[i].y) / (P[j].y - P[i].y) + P[i].x) c = !c;
    }
    return c;
  }
  // 并查集:跨区兜底连通用
  function unionFind(n) {
    const pa = Array.from({ length: n }, (_, i) => i);
    const find = x => (pa[x] === x ? x : (pa[x] = find(pa[x])));
    return { find, union: (a, b) => { const ra = find(a), rb = find(b); if (ra === rb) return false; pa[ra] = rb; return true; } };
  }
  // 总装:布局 → 团块 → 节点(环带拒绝采样) → 道路+通行图(同一趟循环记 edges)
  function mapBuild(seed, regionsRaw, W, H, maxNodes, maxRegions) {
    W = W || 360; H = H || 300;
    const regions = normRegions(regionsRaw, maxNodes, maxRegions);
    if (!regions) return null;
    const rand = mulberry32(hashStr(seed) ^ 0x51ab);
    const centers = forceLayout(regions, rand, W, H);
    // 她手动挪过／放大缩小过的那几块（她 2026-10-03 群友：「可以调整每块地的大小和位置」）：
    //   随机数照旧按原顺序消耗，所以没动过的那几块形状、地点位置都跟以前一模一样
    regions.forEach((r, i) => { if (r.pos) centers[i] = { x: r.pos.x * W, y: r.pos.y * H }; });
    const baseR = Math.min(W, H) / (regions.length <= 3 ? 3.4 : 4.2);
    // 她手动挪过去的那块压在一块没动过的上面：把没动过的那块往旁边推开，两块都留出地方（不然被压的那块缩成一小团，地点放不下就跑到外面去）
    //   只推没动过的；没有压到谁就一个都不动，原来的图照旧
    regions.forEach((r, i) => { if (r.pos) return;
      regions.forEach((m, j) => { if (!m.pos || j === i) return;
        const need = baseR * 0.95 * ((r.size || 1) + (m.size || 1)) / 2, dx = centers[i].x - centers[j].x, dy = centers[i].y - centers[j].y, d = Math.sqrt(dx * dx + dy * dy);
        if (d >= need) return;
        const ux = d > 0.5 ? dx / d : Math.cos(i), uy = d > 0.5 ? dy / d : Math.sin(i);
        centers[i] = { x: Math.max(30, Math.min(W - 30, centers[j].x + ux * need)), y: Math.max(30, Math.min(H - 30, centers[j].y + uy * need)) };
      }); });
    const blobs = regions.map((r, i) => regionBlob(centers[i], centers.filter((_, j) => j !== i), rand, baseR * (r.size || 1)));
    const outR = blobs.map(b => b.d);
    // 地点要落在自己那块地里、不压到别人那块上（群里 2026-10-31：挪过、缩放过以后地标跑到地图外面、别的地块上去了）
    const fits = (i, c) => inBlob(blobs[i], c) && blobs.every((b, j) => j === i || !inBlob(b, c, 0.95));
    // 节点:围着区域中心的环带里撒,彼此至少隔 30;第一个节点就放中心(区域首府感)
    const nodes = [];
    regions.forEach((r, i) => {
      r.nodes.forEach((nd, k) => {
        let p2 = null;
        if (k === 0) p2 = { x: centers[i].x, y: centers[i].y };
        else {
          for (let t = 0; t < 40 && !p2; t++) {
            const a = rand() * Math.PI * 2, rr = baseR * (r.size || 1) * (0.35 + rand() * 0.45);
            const c = { x: centers[i].x + Math.cos(a) * rr, y: centers[i].y + Math.sin(a) * rr };
            if (c.x < 16 || c.x > W - 16 || c.y < 20 || c.y > H - 20) continue;
            if (!fits(i, c)) continue;
            if (nodes.every(x => (x.x - c.x) ** 2 + (x.y - c.y) ** 2 > 30 * 30)) p2 = c;
          }
          // 原来那 40 次没找着（多半是地方被挤小了、点又多）：照着这块地自己的形状再找，间距一点点放小；还不行就往中心收，总之不出界
          for (let gap = 26; !p2 && gap >= 14; gap -= 4) {
            for (let t = 0; t < 60 && !p2; t++) {
              const a = rand() * Math.PI * 2, b = blobs[i], n = b.rays.length, f = a / (Math.PI * 2) * n, ii = Math.floor(f) % n, tt = f - Math.floor(f);
              const rr = (b.rays[ii] * (1 - tt) + b.rays[(ii + 1) % n] * tt) * 0.75 * Math.sqrt(rand());
              const c = { x: centers[i].x + Math.cos(a) * rr, y: centers[i].y + Math.sin(a) * rr };
              if (c.x < 16 || c.x > W - 16 || c.y < 20 || c.y > H - 20 || !fits(i, c)) continue;
              if (nodes.every(x => (x.x - c.x) ** 2 + (x.y - c.y) ** 2 > gap * gap)) p2 = c;
            }
          }
          if (!p2) p2 = { x: centers[i].x, y: centers[i].y + 1 };   // 实在挤不下：落在中心（中心一定在自己那块里）
        }
        nodes.push({ name: nd.name, kind: nd.kind, hook: nd.hook, region: r.name, ri: i, x: Math.round(p2.x * 10) / 10, y: Math.round(p2.y * 10) / 10 });
      });
    });
    // 道路与 edges 同一趟生成:区内相邻节点连成链;跨区按【接壤关系】连两区最近的一对节点;
    // 最后并查集查连通,不通的补最短桥(模型的 adj 写漏了也不会出孤岛)
    const roads = [];
    const edges = [];
    const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
    const bend = (a, b) => {
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
      const off = (rand() - 0.5) * Math.min(30, len * 0.35);
      return "M" + a.x + " " + a.y + "Q" + (mx - dy / len * off).toFixed(1) + " " + (my + dx / len * off).toFixed(1) + " " + b.x + " " + b.y;
    };
    const link = (a, b) => {
      if (edges.some(e => (e[0] === a.name && e[1] === b.name) || (e[0] === b.name && e[1] === a.name))) return;
      edges.push([a.name, b.name]);
      roads.push({ d: bend(a, b), a: a.name, b: b.name });
    };
    regions.forEach((r, i) => {
      const mine = nodes.filter(x => x.ri === i);
      for (let k = 1; k < mine.length; k++) {
        let best = mine[0], bd = 1e18;
        for (let j = 0; j < k; j++) { const d = dist2(mine[k], mine[j]); if (d < bd) { bd = d; best = mine[j]; } }
        link(mine[k], best);
      }
    });
    regions.forEach((r, i) => r.adj.forEach(an => {
      const j = regions.findIndex(x => x.name === an);
      if (j <= i) return;
      let pair = null, bd = 1e18;
      nodes.filter(x => x.ri === i).forEach(a => nodes.filter(x => x.ri === j).forEach(b => { const d = dist2(a, b); if (d < bd) { bd = d; pair = [a, b]; } }));
      if (pair) link(pair[0], pair[1]);
    }));
    const uf = unionFind(nodes.length);
    edges.forEach(e => uf.union(nodes.findIndex(x => x.name === e[0]), nodes.findIndex(x => x.name === e[1])));
    for (let guard = 0; guard < nodes.length; guard++) {
      const comps = {};
      nodes.forEach((x, i) => { const r = uf.find(i); (comps[r] = comps[r] || []).push(i); });
      const keys = Object.keys(comps);
      if (keys.length <= 1) break;
      let pair = null, bd = 1e18;
      comps[keys[0]].forEach(a => { for (let ki = 1; ki < keys.length; ki++) comps[keys[ki]].forEach(b => { const d = dist2(nodes[a], nodes[b]); if (d < bd) { bd = d; pair = [a, b]; } }); });
      if (!pair) break;
      link(nodes[pair[0]], nodes[pair[1]]);
      uf.union(pair[0], pair[1]);
    }
    return { W, H, regions: regions.map((r, i) => ({ name: r.name, terrain: r.terrain, cx: Math.round(centers[i].x), cy: Math.round(centers[i].y), size: r.size || 1, moved: !!r.pos, blob: outR[i] })), nodes, roads, edges };
  }
  const mapAdjacent = (edges, name) => (edges || []).reduce((out, e) => { if (e[0] === name) out.push(e[1]); else if (e[1] === name) out.push(e[0]); return out; }, []);
  const findNode = (nodes, name) => {
    const n = String(name || "").trim();
    if (!n) return null;
    return (nodes || []).find(x => x.name === n) || (nodes || []).find(x => x.name && (n.indexOf(x.name) >= 0 || x.name.indexOf(n) >= 0)) || null;
  };
  // 地图引擎(纯函数)外借给好友地图的【架空】那一半:同一套区域接壤→力导向→团块→道路,
  // 一份实现两处用。各写一份必然走成「一层写在两处,第二处没跟上」。
  if (inApp) window.TrpgMap = { normRegions, mapBuild, mapAdjacent, findNode };
  // 页面那半要用的，原样递过去
  (typeof window !== "undefined" ? window : globalThis).TrpgCore = { inApp, mulberry32, hashStr, normRegions, mapBuild, mapAdjacent, findNode };
})();
