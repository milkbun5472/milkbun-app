// ============================================================
// cloud sync (Supabase) — 可选登录 + 访客模式
// 存档整坨当一行 jsonb 存云端；登录拉回、手动推送。
// 未登录时 app 照常纯本地运行（访客模式）。
// ============================================================
(function () {
  const SUPABASE_URL = "https://nposjnafsbikwfeoudbg.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wb3NqbmFmc2Jpa3dmZW91ZGJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMjY1MTgsImV4cCI6MjA5ODYwMjUxOH0.efs3N7b6Z8CU_1Hlg-S35dkQLP4cZw3IaQnmSc5D9RQ";
  // 旧 Supabase 只保留作一次性「换证」来源；数据读写权威已经切到 VPS。
  const VPS_SUPABASE_URL = "https://yanqiu-vps.tail542792.ts.net:8443";
  const VPS_SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg3MDczODc3LCJleHAiOjE5NDQ3NTM4Nzd9.2kTgRLljhvgLXWojMi6opixszW1H2f3wKab-s2hE6Cc";
  const VPS_SESSION_MIGRATOR = VPS_SUPABASE_URL + "/migrate/v1/session";
  const VPS_SHADOW_MARK = "vps_session_shadow_v1";

  let client = null;
  let legacyClient = null;
  let vpsClient = null;
  let vpsSessionInFlight = null;
  let suspend = false; // apply() 期间挂起，避免写回触发反向 push
  let frozen = false;  // 云端恢复写回后锁死本地 x_ 写入：等重载期间，旧 React 状态再 saveJSON 也覆盖不了刚恢复的数据（防「恢复到一半」竞态）
  let pushTimer = null; // 防抖计时器
  let pushInFlight = null; // 同一时刻只许一份整包备份在路上，慢网时绝不叠发
  let pushAgain = false;   // 在途期间又有变化：收尾后只补最后一份
  const protectedSaveCache = new Map(); // 冻结回滚字段每账号/每页面只读一次，杜绝每次小改下载整行 saves
  const MARK = "cloud_pushed_at"; // 本机最后一次成功 push 的时间戳（无 x_ 前缀，不进存档）
  const tableMemoryMode = () => { try { return localStorage.getItem("memory_table_authority_v1") === "1"; } catch (e) { return false; } };
  // 开机快照：本脚本执行(app 之前)时本地是否已有存档。localStorage 跨刷新持久，
  // 只有真·新设备/新网址首次打开才空。用它守 autoPull：本地已有数据=老设备回来，本地权威，绝不自动拿云端覆盖。
  const bootHadLocal = (function () { try { return Object.keys(localStorage).some(function (k) { return k.indexOf("x_") === 0; }); } catch (e) { return false; } })();
  // 世界书防呆（她 2026-07-24 报「世界书被同步清空」）：判断一份 x_loreEntries 原始字符串里是不是真有词条。
  // 空数组 []、缺失、坏 JSON 都算「空」。防呆闸只在「本机非空 vs 对端空」时护本机、绝不让空覆盖非空。
  const loreNonEmpty = function (raw) {
    if (raw == null) return false;
    try { const a = JSON.parse(raw); return Array.isArray(a) && a.length > 0; } catch (e) { return false; }
  };

  try {
    if (window.supabase && window.supabase.createClient) {
      // 不改旧 client 的默认 storageKey：这样升级前已经登录的 session 才能被换证器找到。
      legacyClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      vpsClient = window.supabase.createClient(VPS_SUPABASE_URL, VPS_SUPABASE_ANON_KEY, {
        auth: { storageKey: "lisa-vps-auth-token", persistSession: true, autoRefreshToken: true }
      });
      client = vpsClient;
    }
  } catch (e) {
    console.error("supabase init failed", e);
  }

  window.Cloud = {
    ready: () => !!client,

    // 旧登录仍有效时，一次性换出 VPS 登录态。数据主路始终是 VPS；换证失败就停写。
    // 可重复调用：UUID 已一致就直接返回，不会再次发票。
    async ensureVpsSession() {
      if (!legacyClient || !vpsClient) return { ok: false, reason: "not_ready" };
      if (vpsSessionInFlight) return vpsSessionInFlight;
      vpsSessionInFlight = (async () => {
        try {
          const current = await vpsClient.auth.getSession();
          const currentSession = current && current.data && current.data.session;
          const oldResult = await legacyClient.auth.getSession();
          const oldSession = oldResult && oldResult.data && oldResult.data.session;
          if (currentSession && currentSession.user) {
            // 两边若明确是不同账号，不能把上一账号的 VPS session 当成本次换证成功。
            if (oldSession && oldSession.user && oldSession.user.id !== currentSession.user.id) {
              await vpsClient.auth.signOut();
            } else {
            localStorage.setItem(VPS_SHADOW_MARK, JSON.stringify({ ok: true, user_id: currentSession.user.id, checked_at: new Date().toISOString(), authority: "vps" }));
            return { ok: true, reused: true };
            }
          }
          if (!oldSession || !oldSession.access_token || !oldSession.user) return { ok: false, reason: "not_signed_in" };
          const response = await fetch(VPS_SESSION_MIGRATOR, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ access_token: oldSession.access_token })
          });
          const migrated = await response.json().catch(() => ({}));
          if (!response.ok || !migrated.access_token || !migrated.refresh_token) throw new Error(migrated.error || "session_migration_failed");
          const setResult = await vpsClient.auth.setSession({ access_token: migrated.access_token, refresh_token: migrated.refresh_token });
          if (setResult.error) throw setResult.error;
          const newUser = setResult.data && setResult.data.user;
          if (!newUser || newUser.id !== oldSession.user.id) throw new Error("identity_mismatch");
          localStorage.setItem(VPS_SHADOW_MARK, JSON.stringify({ ok: true, user_id: newUser.id, migrated_at: new Date().toISOString(), authority: "vps" }));
          return { ok: true, migrated: true };
        } catch (error) {
          localStorage.setItem(VPS_SHADOW_MARK, JSON.stringify({ ok: false, reason: String(error && error.message || error), checked_at: new Date().toISOString() }));
          return { ok: false, reason: String(error && error.message || error) };
        } finally {
          vpsSessionInFlight = null;
        }
      })();
      return vpsSessionInFlight;
    },

    vpsSessionStatus() {
      try { return JSON.parse(localStorage.getItem(VPS_SHADOW_MARK) || "null"); } catch (e) { return null; }
    },

    // 收集所有 x_ 键为纯对象（原始字符串），与导出/导入格式一致
    collect() {
      const dump = {};
      Object.keys(localStorage)
        .filter((k) => k.startsWith("x_") && !(tableMemoryMode() && k === "x_memLib"))
        .forEach((k) => {
          dump[k] = localStorage.getItem(k);
        });
      // 已迁进 IDB 文字库的键(同人文等)不在 localStorage，从内存镜像补进存档，否则云端备份会漏掉。
      try { if (window.__txtMirror) window.__txtMirror.forEach((v, k) => { if (v != null && !(tableMemoryMode() && k === "x_memLib")) dump[k] = v; }); } catch (e) {}
      return dump;
    },

    // saves 仍整行 upsert。切表后不采集当前 x_memLib，但把云端那份切换前冻结副本原样带回，
    // 否则一次普通 push 会因 JSON 整体替换而意外删掉回滚材料。
    async collectForSave(userId) {
      const dump = this.collect();
      // 本机参考照只存 iv_ 短引用；云存档临时嵌回 base64，换设备恢复后开机迁移器会再放回 IndexedDB。
      // 任一图库读取失败就保留 iv_（不阻断其他数据备份），但正常情况下角色/用户参考照可跨设备恢复。
      const embedRefs = async key => {
        try {
          const value = JSON.parse(dump[key] || (key === "x_characters" ? "[]" : "{}")), list = Array.isArray(value) ? value : [value];
          for (const row of list) if (row && typeof row.refPhoto === "string" && row.refPhoto.indexOf("iv_") === 0 && typeof idbVaultGet === "function" && typeof blobToDataUrl === "function") {
            const blob = await idbVaultGet(row.refPhoto); if (blob) row.refPhoto = await blobToDataUrl(blob);
          }
          dump[key] = JSON.stringify(value);
        } catch (e) {}
      };
      await embedRefs("x_characters"); await embedRefs("x_profile");
      const needMem = tableMemoryMode();
      const needLore = !loreNonEmpty(dump.x_loreEntries);
      if (needMem || needLore) {
        let cached = protectedSaveCache.get(userId);
        if (!cached) { cached = { loadedMem: false, loadedLore: false, pending: null }; protectedSaveCache.set(userId, cached); }
        const missingMem = needMem && !cached.loadedMem;
        const missingLore = needLore && !cached.loadedLore;
        if (missingMem || missingLore) {
          // PostgREST JSON path 投影：只取要保护的两个键，不再把 0.6~6.8MB 整行 data 下载回来。
          // pending 合并同一时刻的 push，避免慢网下首读也重叠。
          if (!cached.pending) {
            const fields = [];
            if (missingMem) fields.push("data->x_memLib");
            if (missingLore) fields.push("data->x_loreEntries");
            cached.pending = client.from("saves").select(fields.join(",")).eq("user_id", userId).maybeSingle()
              .then(({ data, error }) => {
                if (error) throw error;
                if (missingMem) { cached.x_memLib = data && data.x_memLib; cached.loadedMem = true; }
                if (missingLore) { cached.x_loreEntries = data && data.x_loreEntries; cached.loadedLore = true; }
              }).finally(() => { cached.pending = null; });
          }
          await cached.pending;
        }
        if (needMem && cached.x_memLib != null) dump.x_memLib = cached.x_memLib;
        if (needLore && loreNonEmpty(cached.x_loreEntries)) {
          dump.x_loreEntries = cached.x_loreEntries;
          try { console.warn("[Cloud] 世界书防呆：本机为空，保留云端词条，未被覆盖"); } catch (e) {}
        }
      }
      // 世界书防呆（本地→推云方向）：本机世界书是空的、但云端那份还有词条 → 别用空的盖掉云端，把云端那份原样带回。
      // 只在本机空时才多读一次云（正常有词条时零额外开销）。
      return dump;
    },

    // 用云端数据覆盖本地：先清掉本地 x_ 键，再写回
    // 期间挂起自动同步，避免写入触发反向 push
    async apply(data) {
      suspend = true;
      try {
        // 行表权威开启后，旧 saves blob 无权再覆盖/清空本机记忆镜像。
        const keepMemLib = tableMemoryMode() && typeof storedJSONText === "function" ? storedJSONText("x_memLib") : (tableMemoryMode() ? localStorage.getItem("x_memLib") : null);
        // 世界书防呆（拉云→本地方向）：云端这份世界书是空的、而本机还有词条 → 保留本机，绝不让空覆盖非空。
        const localLore = localStorage.getItem("x_loreEntries");
        const keepLore = (loreNonEmpty(localLore) && !loreNonEmpty(data && data.x_loreEntries)) ? localLore : null;
        if (typeof idbTxtApplySnapshot === "function") await idbTxtApplySnapshot(data || {}, tableMemoryMode() ? ["x_memLib"] : []);
        Object.keys(localStorage)
          .filter((k) => k.startsWith("x_") && !(tableMemoryMode() && k === "x_memLib"))
          .forEach((k) => localStorage.removeItem(k));
        Object.entries(data || {}).forEach(([k, v]) => {
          // memories 行表已经权威时，旧 saves 里的冻结 x_memLib 只供灾备，不能覆盖当前离线镜像。
          if (tableMemoryMode() && k === "x_memLib") return;
          // 文字库键(同人文等)：写进 IDB + 内存镜像，绝不进 localStorage(否则又占回 5MB)。apply 后调用方会 reload，hydrateTxtVault 再兜一遍。
          if (typeof isIdbTextKey === "function" && isIdbTextKey(k)) {
            // idbTxtApplySnapshot 已逐字写入并核对；旧环境才走兼容回落。
            if (typeof idbTxtApplySnapshot !== "function") { try { window.__txtMirror && window.__txtMirror.set(k, v); if (typeof idbTxtPut === "function") idbTxtPut(k, v).catch(() => {}); } catch (e) {} }
            return;
          }
          if (!(tableMemoryMode() && k === "x_memLib")) localStorage.setItem(k, v);
        });
        if (tableMemoryMode() && keepMemLib != null) {
          if (typeof isIdbTextKey === "function" && isIdbTextKey("x_memLib")) {
            try { window.__txtMirror && window.__txtMirror.set("x_memLib", keepMemLib); if (typeof idbTxtPut === "function") idbTxtPut("x_memLib", keepMemLib).catch(() => {}); } catch (e) {}
          } else localStorage.setItem("x_memLib", keepMemLib);
        }
        if (keepLore != null) { localStorage.setItem("x_loreEntries", keepLore); try { console.warn("[Cloud] 世界书防呆：云端为空，保留本机词条，未被覆盖"); } catch (e) {} }
      } finally {
        suspend = false;
      }
      // 账本游标键不带 x_ 前缀、不在快照里：快照盖回本地后若不归零，游标仍指着「已拉到最新」
      // 而本地已回到旧时刻——CC 气泡「已拉过但本地没有」，永远回不来（2026-08-13 登出+恢复丢行事故）。
      // 顺手立一张灾后找回工单：重载后把账本里快照没带上的 app 行补回本地（48 小时窗）。
      try {
        ["chat_ledger_live_cursor_v1", "chat_ledger_pull_shadow_v1", "yanqiu_cross_surface_continuity_v1"].forEach(k => localStorage.removeItem(k));
        localStorage.setItem("chat_ledger_restore_pending_v1", JSON.stringify({
          requested_at: new Date().toISOString(),
          since: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
          attempts: 0
        }));
      } catch (e) {}
      // 写回完成后冻结本地 x_ 写入，直到调用方 location.reload()。
      // 目的：apply 与 reload 之间那几百毫秒里，登录前那份旧 React 状态可能 saveJSON，
      // 会把刚恢复的键覆盖回旧值（甚至反向 push 污染云端）→「恢复一半」竞态。冻结后这些写入直接丢弃，重载后自然解除。
      frozen = true;
    },

    async getUser() {
      if (!client) return null;
      try {
        await this.ensureVpsSession();
        const { data } = await client.auth.getUser();
        return data ? data.user : null;
      } catch {
        return null;
      }
    },

    // 只读本机持久 session，不发网络请求。影子库归属判断必须用它，断网不能伪装成换号。
    async getSessionUser() {
      if (!client) return null;
      try {
        await this.ensureVpsSession();
        const { data, error } = await client.auth.getSession();
        if (error) return null;
        return data && data.session ? data.session.user : null;
      } catch { return null; }
    },

    // 返回 { user, session }。若开启了邮箱验证，session 可能为 null。
    async signUp(email, password) {
      if (!client) throw new Error("云服务未就绪");
      localStorage.removeItem("memory_table_authority_v1");
      const { data, error } = await client.auth.signUp({ email, password });
      if (error) throw error;
      try { if (window.ChatLedgerShadow) window.ChatLedgerShadow.clearLocal(); } catch (e) {}
      return data;
    },

    async signIn(email, password) {
      if (!client) throw new Error("云服务未就绪");
      localStorage.removeItem("memory_table_authority_v1"); // 登录可能换账号；新账号必须自己重新逐 ID 验收
      try { await vpsClient.auth.signOut(); } catch (e) {}
      // 迁移期旧密码哈希无法从 Supabase 导出：先向旧 Auth 验证一次，再换成同 UUID 的 VPS session。
      const { data: legacyData, error } = await legacyClient.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      const migrated = await this.ensureVpsSession();
      if (!migrated.ok) throw new Error("账号换证失败，请稍后重试；本机数据没有被改动");
      // 用户亲自输过旧密码后，把同一密码写进新 Auth；以后旧云停服也能独立登录。
      const updated = await vpsClient.auth.updateUser({ password });
      if (updated.error) throw updated.error;
      const current = await vpsClient.auth.getSession();
      const data = { user: current.data && current.data.session && current.data.session.user, session: current.data && current.data.session };
      protectedSaveCache.clear();
      try { if (window.ChatLedgerShadow) window.ChatLedgerShadow.clearLocal(); } catch (e) {}
      return data;
    },

    async signOut() {
      // 退出前必须先确认最新存档已成功上云。
      // 旧逻辑把 push 失败静默吞掉，却仍继续清空本机 x_ 数据；会话过期/断网时会把
      // 「只在本机的新聊天」直接清掉。宁可拦住退出，也不允许带着未备份数据离开。
      await this.push();
      // 共享聊天账本 outbox 不属于 x_ saves：先尽力投递，随后清本机队列，绝不把旧账号消息带给下个账号。
      try { if (window.ChatLedgerShadow) await window.ChatLedgerShadow.flush(); } catch (e) {}
      if (legacyClient) { try { await legacyClient.auth.signOut(); } catch (e) {} }
      if (vpsClient) { try { await vpsClient.auth.signOut(); } catch (e) {} }
      localStorage.removeItem(VPS_SHADOW_MARK);
      protectedSaveCache.clear();
      // 清空本地所有 x_ 存档：退出＝回到初始空账号，数据只在云端。挂起同步避免删除触发 push
      suspend = true;
      try {
        Object.keys(localStorage).filter(function (k) { return k.startsWith("x_"); }).forEach(function (k) { localStorage.removeItem(k); });
        localStorage.removeItem(MARK);
        localStorage.removeItem("memory_table_authority_v1"); // 切表批准只属于当前账号在当前设备；退出后不带给下一个账号
        try { if (window.ChatLedgerShadow) window.ChatLedgerShadow.clearLocal(); } catch (e) {}
      } finally { suspend = false; }
      // 文字库(同人文迁 IDB)也清——退出后不许下一个账号看到上一个账号的同人文
      try { if (typeof idbTxtClear === "function") await idbTxtClear(); } catch (e) {}
      // 事件书架镜像立即清空（不等下次 ensureOwner）——未登录不许看到上一个账号的事件标题/梗概
      try { if (window.MemoryEvents && window.MemoryEvents.clearAll) await window.MemoryEvents.clearAll(); } catch (e) {}
      // 召回冷却环/旁路诊断只属于当前账号。本机换号时必须清掉，不能让相同 charId
      // 的另一个账号继承上一人的「刚想起过」状态。
      try { if (window.RecallShadow && window.RecallShadow.clearAll) await window.RecallShadow.clearAll(); } catch (e) {}
      try { if (window.MemoryQualityShadow && window.MemoryQualityShadow.clearAll) await window.MemoryQualityShadow.clearAll(); } catch (e) {}
      try { if (window.MemoryCorrectionShadow && window.MemoryCorrectionShadow.clearAll) await window.MemoryCorrectionShadow.clearAll(); } catch (e) {}
      try { if (window.SleepShadow && window.SleepShadow.clearAll) await window.SleepShadow.clearAll(); } catch (e) {}
      try { if (window.DreamLoop && window.DreamLoop.clearAll) await window.DreamLoop.clearAll(); } catch (e) {}
    },

    // 把本地存档推到云端（覆盖该用户那一行）
    async push() {
      if (!client) throw new Error("云服务未就绪");
      const user = await this.getUser();
      if (!user) throw new Error("未登录");
      const saveData = await this.collectForSave(user.id);
      const { error } = await client.from("saves").upsert({
        user_id: user.id,
        data: saveData,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },

    // 从云端拉回该用户存档，返回 { data, updated_at } 或 null（云端没有）
    async pull() {
      if (!client) throw new Error("云服务未就绪");
      const user = await this.getUser();
      if (!user) throw new Error("未登录");
      const { data, error } = await client
        .from("saves")
        .select("data, updated_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data || null;
    },

    // ---- 聊天云归档（chat_archive 表）：完整历史存云端，本地只留最近的 ----
    // 拉某角色的云端归档（完整旧消息数组，时间从旧到新）；没有则 []
    async chatArchiveGet(charId) {
      if (!client) throw new Error("云服务未就绪");
      const user = await this.getUser();
      if (!user) throw new Error("未登录");
      const { data, error } = await client
        .from("chat_archive")
        .select("msgs")
        .eq("user_id", user.id)
        .eq("char_id", String(charId))
        .maybeSingle();
      if (error) throw error;
      return (data && Array.isArray(data.msgs)) ? data.msgs : [];
    },
    // 把一批旧消息【追加】到云端归档尾部（读-合并-写；单用户无并发，安全）。返回归档后的总条数。
    async chatArchiveAppend(charId, older) {
      if (!client) throw new Error("云服务未就绪");
      const user = await this.getUser();
      if (!user) throw new Error("未登录");
      const cur = await this.chatArchiveGet(charId);
      // 去重（v48.95，Codex 指出：读-合并-写无并发保护，双触发/并发可能把同批旧消息重复追加）：按消息 id 滤掉云端已有的
      const seen = new Set(cur.map(m => m && m.id).filter(Boolean));
      const add = (Array.isArray(older) ? older : []).filter(m => !(m && m.id && seen.has(m.id)));
      const merged = cur.concat(add);
      const { error } = await client.from("chat_archive").upsert({
        user_id: user.id,
        char_id: String(charId),
        msgs: merged,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      return merged.length;
    },

    // ---- App → CC 共享聊天账本（第 3 步 shadow）：只追加，不回读 ----
    // message_key 在客户端已按来源/线程/原消息确定；冲突时 DO NOTHING，重试不会造双份。
    async chatMessagesUpsert(rows) {
      if (!client) throw new Error("云服务未就绪");
      const user = await this.getUser();
      if (!user) throw new Error("未登录");
      const payload = (Array.isArray(rows) ? rows : []).map(row => ({ ...row, user_id: user.id }));
      if (!payload.length) return 0;
      const { error } = await client.from("chat_messages").upsert(payload, {
        onConflict: "user_id,message_key",
        ignoreDuplicates: true
      });
      if (error) throw error;
      return payload.length;
    },
    async chatMessagesSoftDelete(messageKeys) {
      if (!client) throw new Error("云服务未就绪");
      const user = await this.getUser();
      if (!user) throw new Error("未登录");
      const keys = [...new Set((messageKeys || []).map(String).filter(Boolean))];
      if (!keys.length) return 0;
      const { error } = await client.from("chat_messages")
        .update({ deleted_at: new Date().toISOString() })
        .eq("user_id", user.id).in("message_key", keys);
      if (error) throw error;
      return keys.length;
    },

    // ---- App → 唯一言秋 CC 只读工具桥（异步、幂等）----
    async rescueRemoteEnqueue(action, payload) {
      if (!client) throw new Error("云服务未就绪");
      const user = await this.getUser();
      if (!user) throw new Error("未登录");
      const row = { user_id: user.id, action: String(action || ""), payload: payload && typeof payload === "object" ? payload : {} };
      const { data, error } = await client.from("rescue_remote_commands")
        .insert(row).select("id,action,state,created_at").single();
      if (error) throw error;
      return data;
    },
    async rescueRemoteList(limit) {
      if (!client) throw new Error("云服务未就绪");
      const user = await this.getUser();
      if (!user) throw new Error("未登录");
      const { data, error } = await client.from("rescue_remote_commands")
        .select("id,action,state,result,error_text,created_at,completed_at")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(Math.max(1, Math.min(30, Number(limit) || 12)));
      if (error) throw error;
      return Array.isArray(data) ? data : [];
    },

    async yanqiuCcToolEnqueue(charId, toolName, args, idempotencyKey, lisaMessageKey, purpose) {
      if (!client) throw new Error("云服务未就绪");
      const user = await this.getUser();
      if (!user) throw new Error("未登录");
      const key = "appcc:req:" + String(idempotencyKey || "");
      const row = {
        user_id: user.id,
        message_key: key,
        char_id: String(charId || ""),
        thread_type: "private", thread_id: String(charId || ""),
        // Reuse the already-authorized private-message row shape.  The RLS
        // policy intentionally rejects browser-authored narration rows; this
        // remains a hidden control record because bridge_kind (and the lack
        // of sync_kind) keeps it out of chat/ledger projection.
        // Lisa rows use a null speaker_id everywhere else in the shared
        // ledger. The authenticated owner lives in user_id; putting that UUID
        // in speaker_id violates the chat_messages RLS row shape.
        speaker_type: "lisa", speaker_id: null,
        content: "[App→CC 只读工具任务]",
        occurred_at: new Date().toISOString(), source: "app",
        source_message_id: lisaMessageKey ? String(lisaMessageKey) : null,
        metadata: {
          bridge_kind: "app_cc_request", bridge_state: "queued",
          tool_name: String(toolName || ""),
          arguments: args && typeof args === "object" && !Array.isArray(args) ? args : {},
          purpose: String(purpose || "").slice(0, 1200)
        }
      };
      const { data, error } = await client.from("chat_messages")
        .upsert(row, { onConflict: "user_id,message_key", ignoreDuplicates: true })
        .select("id,message_key,created_at").maybeSingle();
      if (error) throw error;
      if (data) return { id: data.id, status: "queued", created_at: data.created_at };
      const existing = await client.from("chat_messages")
        .select("id,message_key,created_at").eq("user_id", user.id)
        .eq("message_key", key).maybeSingle();
      if (existing.error) throw existing.error;
      return existing.data ? { id: existing.data.id, status: "queued", created_at: existing.data.created_at } : null;
    },
    async yanqiuCcToolResult(jobId) {
      if (!client) throw new Error("云服务未就绪");
      const user = await this.getUser();
      if (!user) throw new Error("未登录");
      const { data, error } = await client.from("chat_messages")
        .select("id,char_id,content,metadata,created_at")
        .eq("user_id", user.id).eq("message_key", "appcc:result:" + String(jobId || "")).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      let payload = null; try { payload = JSON.parse(data.content); } catch (e) {}
      return {
        id: data.id, status: payload && payload.ok === false ? "failed" : "completed",
        result: payload && payload.ok !== false ? payload.result : null,
        error_text: payload && payload.ok === false ? payload.error : null,
        completed_at: data.created_at
      };
    },

    // ---- 灾后找回：拉时间窗内 source=app 的存活行，供开机对账补回本地 ----
    // 只读；软删行（她亲手删过/重roll撤回的）永远不回来，appcc 控制行由对账层再过滤。
    async chatMessagesAppRestoreRows(sinceIso, cap) {
      if (!client) throw new Error("云服务未就绪");
      const user = await this.getUser();
      if (!user) throw new Error("未登录");
      const max = Math.max(100, Math.min(3000, Number(cap) || 2000));
      const rows = [];
      for (let offset = 0; offset < max; offset += 500) {
        const { data, error } = await client.from("chat_messages")
          .select("id,message_key,char_id,thread_type,thread_id,speaker_type,speaker_id,content,occurred_at,source,source_message_id,metadata,deleted_at")
          .eq("user_id", user.id).eq("source", "app").is("deleted_at", null)
          .gte("occurred_at", String(sinceIso))
          .order("occurred_at", { ascending: true }).order("id", { ascending: true })
          .range(offset, offset + 499);
        if (error) throw error;
        const batch = Array.isArray(data) ? data : [];
        rows.push(...batch);
        if (batch.length < 500) break;
      }
      return rows;
    },

    // ---- CC/桌面 → App 第 4 步影子拉取：只返回给诊断观察器，不合并本地聊天 ----
    // 用 updated_at + id 看变更，才能把后来盖上的软删戳也拉回来。
    async chatMessagesPullShadow(charId, cursor, limit) {
      if (!client) throw new Error("云服务未就绪");
      const user = await this.getUser();
      if (!user) throw new Error("未登录");
      const max = Math.max(1, Math.min(200, Math.floor(Number(limit) || 100)));
      let query = client.from("chat_messages")
        .select("id,message_key,char_id,thread_type,thread_id,speaker_type,speaker_id,content,occurred_at,source,source_message_id,metadata,revision,updated_at,deleted_at")
        .eq("user_id", user.id).eq("char_id", String(charId)).in("source", ["cc", "stackchan"])
        .order("updated_at", { ascending: true }).order("id", { ascending: true }).limit(max);
      if (cursor && cursor.updated_at && cursor.id) {
        query = query.or(`updated_at.gt.${cursor.updated_at},and(updated_at.eq.${cursor.updated_at},id.gt.${cursor.id})`);
      }
      const { data, error } = await query;
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      const last = rows[rows.length - 1];
      return { rows, nextCursor: last ? { updated_at: last.updated_at, id: last.id } : (cursor || null) };
    },

    // ---- 服务器信箱（server_inbox 表，v48.32 第八课）：云端定时任务替角色写的信，app 开机取走投进聊天 ----
    // 取未消费的信（RLS 保证只取到自己的）；未登录/未就绪安静返回空
    async inboxFetch() {
      if (!client) return [];
      const user = await this.getUser();
      if (!user) return [];
      const { data, error } = await client
        .from("server_inbox")
        .select("id, char_id, kind, content, created_at")
        .is("consumed_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    // 给取走的信盖戳（consumed_at），防下次重复投递
    async inboxConsume(ids) {
      if (!client || !ids || !ids.length) return;
      const user = await this.getUser();
      if (!user) return;
      await client.from("server_inbox").update({ consumed_at: new Date().toISOString() }).in("id", ids);
    },

    // ---- 共读信箱（cc_read_inbox）：言秋在 CC 端亲读后把批注写回，手机来取，绕开整份覆盖（v49.x「一起读·言秋专属通道」）----
    async readInboxFetch() {
      if (!client) return [];
      const user = await this.getUser();
      if (!user) return [];
      const { data, error } = await client
        .from("cc_read_inbox")
        .select("id, payload, created_at")
        .eq("user_id", user.id)
        .is("consumed_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    async readInboxConsume(ids) {
      if (!client || !ids || !ids.length) return;
      const user = await this.getUser();
      if (!user) return;
      const { error } = await client.from("cc_read_inbox")
        .update({ consumed_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .in("id", ids);
      if (error) throw error;
    },

    // ---- 记忆独立表·影子期（v48.98）：只做逐行 upsert / 软删 / 只读核对 ----
    // ⚠️旧 x_memLib 仍是当前读取权威；这里绝不整份覆盖，也没有物理 delete。
    async memoryRowsUpsert(entries) {
      if (!client) throw new Error("云服务未就绪");
      const user = await this.getUser();
      if (!user) throw new Error("未登录");
      const rows = (entries || []).filter(e => e && e.id && String(e.text || "").trim()).map(e => ({
        user_id: user.id,
        id: String(e.id),
        text: String(e.text),
        tags: Array.isArray(e.tags) ? e.tags.map(String) : [],
        char_ids: Array.isArray(e.charIds) ? e.charIds.map(String) : [],
        // known_by 三态：不是数组就写 NULL（旧数据），空数组照原样写空数组（仅用户知道）。
        // 这里绝不能写成 `|| []`，那会把 legacy 和 user-only 压成同一个值。
        known_by: Array.isArray(e.knownBy) ? e.knownBy.map(String) : null,
        v: typeof e.v === "number" ? Math.max(-5, Math.min(5, Math.round(e.v))) : 0,
        a: typeof e.a === "number" ? Math.max(0, Math.min(5, Math.round(e.a))) : 1,
        open: !!e.open,
        pinned: !!e.pinned,
        ts: Number(e.ts) || Date.now(),
        archived: !!e.archived,
        archived_batch: e.archivedBatch == null ? null : String(e.archivedBatch),
        archived_ts: e.archivedTs == null ? null : Number(e.archivedTs),
        source: e.source == null ? null : String(e.source),
        deleted: false
      }));
      if (!rows.length) return 0;
      const { error } = await client.from("memories").upsert(rows, { onConflict: "user_id,id" });
      if (error) throw error;
      return rows.length;
    },
    async memoryRowsFetchAll() {
      if (!client) throw new Error("云服务未就绪");
      const user = await this.getUser();
      if (!user) throw new Error("未登录");
      const all = [], pageSize = 500;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await client.from("memories")
          .select("id,text,tags,char_ids,known_by,v,a,open,pinned,ts,archived,archived_batch,archived_ts,source,deleted,surface_state,supersedes_id,revision,updated_at")
          .eq("user_id", user.id)
          .order("id", { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const rows = data || [];
        all.push(...rows);
        if (rows.length < pageSize) break;
      }
      return all;
    },
    async memoryRowsFetchUpdatedSince(cursor) {
      if (!client) throw new Error("云服务未就绪");
      const user = await this.getUser();
      if (!user) throw new Error("未登录");
      const parsed = cursor ? Date.parse(cursor) : 0;
      const since = new Date(Math.max(0, Number.isFinite(parsed) ? parsed - 5000 : 0)).toISOString();
      const all = [], pageSize = 500;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await client.from("memories")
          .select("id,text,tags,char_ids,known_by,v,a,open,pinned,ts,archived,archived_batch,archived_ts,source,deleted,surface_state,supersedes_id,revision,last_mutation_id,updated_at")
          .eq("user_id", user.id)
          .gte("updated_at", since)
          .order("updated_at", { ascending: true })
          .order("id", { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const rows = data || [];
        all.push(...rows);
        if (rows.length < pageSize) break;
      }
      return all;
    },
    // ---- 记忆向量（与 CC/MCP 共用 memory_embeddings 表，两侧同一份）----
    // 按 id 批量取云端已存向量：返回 [{id,model,hash,dim,embedding[]}]。未登录/未就绪静默返回 []。
    async memVecFetch(ids) {
      if (!client) return [];
      const user = await this.getUser().catch(() => null);
      if (!user) return [];
      const clean = [...new Set((ids || []).map(String).filter(Boolean))];
      if (!clean.length) return [];
      const out = [];
      for (let i = 0; i < clean.length; i += 200) {
        const chunk = clean.slice(i, i + 200);
        const { data, error } = await client.from("memory_embeddings")
          .select("id,model,hash,dim,embedding")
          .eq("user_id", user.id)
          .in("id", chunk);
        if (error) throw error;
        out.push(...(data || []));
      }
      return out;
    },
    // 写回向量（幂等 upsert 主键 user_id,id）。records: [{id,model,hash,embedding:number[]}]
    async memVecUpsert(records) {
      if (!client) return 0;
      const user = await this.getUser().catch(() => null);
      if (!user) return 0;
      const rows = (records || []).filter(r => r && r.id && Array.isArray(r.embedding) && r.embedding.length).map(r => ({
        user_id: user.id, id: String(r.id), model: String(r.model || ""),
        hash: String(r.hash || ""), dim: r.embedding.length, embedding: r.embedding,
        updated_at: new Date().toISOString(),
      }));
      if (!rows.length) return 0;
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await client.from("memory_embeddings").upsert(rows.slice(i, i + 200), { onConflict: "user_id,id" });
        if (error) throw error;
      }
      return rows.length;
    },
    async memoryApplyMutation(op) {
      if (!client) throw new Error("云服务未就绪");
      const user = await this.getUser();
      if (!user) throw new Error("未登录");
      const { data, error } = await client.rpc("apply_memory_mutation", {
        p_user_id: user.id,
        p_memory_id: String(op.memoryId),
        p_operation: op.operation,
        p_payload: op.payload || {},
        p_base_revision: op.baseRevision == null ? null : Number(op.baseRevision),
        p_mutation_id: op.mutationId
      });
      if (error) throw error;
      return data || {};
    },

    // ---- ⑥事件层 · 第2步只读（memory_events / memory_event_candidates / memory_event_links）----
    // v1 只读：书架和候选列表。表没建时报错由调用方 catch → 整块 dormant，零影响。
    async eventsList() {
      if (!client) throw new Error("云服务未就绪");
      const user = await this.getUser();
      if (!user) throw new Error("未登录");
      const { data, error } = await client.from("memory_events")
        .select("id,title,synopsis,char_ids,author_char_id,started_ts,ended_ts,status,themes,edited_by_user,deleted,revision,updated_at")
        .eq("user_id", user.id).eq("deleted", false)
        .order("updated_at", { ascending: false }).order("id", { ascending: true })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    async eventCandidatesList() {
      if (!client) throw new Error("云服务未就绪");
      const user = await this.getUser();
      if (!user) throw new Error("未登录");
      const { data, error } = await client.from("memory_event_candidates")
        .select("id,status,source_memory_ids,requested_char_id,feedback,edited_by_user,accepted_event_id,revision,updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false }).order("id", { ascending: true })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    // ⑥第3步：按 ID 从权威行表重读所选碎片（创建候选前必须用这个，不用 React 卡片快照）
    async memoryRowsFetchByIds(ids) {
      if (!client) throw new Error("云服务未就绪");
      const user = await this.getUser();
      if (!user) throw new Error("未登录");
      const clean = [...new Set((ids || []).map(String).filter(Boolean))];
      if (!clean.length) return [];
      const { data, error } = await client.from("memories")
        .select("id,text,tags,char_ids,known_by,v,a,open,pinned,ts,archived,source,deleted,surface_state,supersedes_id,revision")
        .eq("user_id", user.id).in("id", clean);
      if (error) throw error;
      return data || [];
    },
    // ⑥第3步：创建事件候选（status=requested）。同 idempotency_key 已存在 → 返回已有候选不重复建
    async eventCandidateRequest(row) {
      if (!client) throw new Error("云服务未就绪");
      const user = await this.getUser();
      if (!user) throw new Error("未登录");
      const payload = {
        user_id: user.id,
        id: row.id,
        status: "requested",
        source_memory_ids: row.sourceMemoryIds,
        requested_char_id: row.requestedCharId,
        draft: null,
        base_memory_revisions: row.baseMemoryRevisions,
        idempotency_key: row.idempotencyKey,
        accepted_event_id: null
      };
      const { data, error } = await client.from("memory_event_candidates")
        .insert(payload).select("id,status,updated_at").maybeSingle();
      if (error) {
        if (String(error.code) === "23505") { // 幂等：同一批选择已经建过
          const { data: existing, error: e2 } = await client.from("memory_event_candidates")
            .select("id,status,updated_at").eq("user_id", user.id)
            .eq("idempotency_key", row.idempotencyKey).maybeSingle();
          if (e2) throw e2;
          if (existing) return { ...existing, existed: true };
        }
        throw error;
      }
      return { ...data, existed: false };
    },
    // ⑥第5步：取单条候选全文（含 draft/base_memory_revisions，红灯检查要用）
    async eventCandidateGet(id) {
      if (!client) throw new Error("云服务未就绪");
      const user = await this.getUser();
      if (!user) throw new Error("未登录");
      const { data, error } = await client.from("memory_event_candidates")
        .select("*").eq("user_id", user.id).eq("id", String(id)).maybeSingle();
      if (error) throw error;
      return data || null;
    },
    // ⑥第5步：退回（requested+feedback，旧 draft 保留供审计）/ 拒绝（rejected）。
    // 列级 grant 只放行 status/feedback/edited_by_user；accepted 由 RLS with check 挡死。
    async eventCandidateSetStatus(id, status, feedback) {
      if (!client) throw new Error("云服务未就绪");
      const user = await this.getUser();
      if (!user) throw new Error("未登录");
      if (!["requested", "rejected"].includes(status)) throw new Error("App 只能退回或拒绝");
      const body = { status };
      if (feedback !== undefined) body.feedback = feedback == null ? null : String(feedback).slice(0, 500);
      const { data, error } = await client.from("memory_event_candidates")
        .update(body).eq("user_id", user.id).eq("id", String(id)).neq("status", "accepted")
        .select("id,status,revision").maybeSingle();
      if (error) throw error;
      return data;
    },
    // ⑥第6步：Lisa 确认入册只走这一条原子 RPC。候选、来源、正式事件和 links
    // 在数据库同一事务里锁定并核对；失败时一行都不会留下。
    async eventCandidateAccept(id, revision, mutationId, userEdits) {
      if (!client) throw new Error("云服务未就绪");
      const user = await this.getUser();
      if (!user) throw new Error("未登录");
      if (!mutationId) throw new Error("缺少本次确认凭证");
      const { data, error } = await client.rpc("accept_memory_event_candidate", {
        p_candidate_id: String(id),
        p_candidate_revision: Number(revision),
        p_mutation_id: String(mutationId),
        p_user_edits: userEdits || null
      });
      if (error) throw error;
      return data || {};
    },
    async eventGet(id) {
      if (!client) throw new Error("云服务未就绪");
      const user = await this.getUser();
      if (!user) throw new Error("未登录");
      const { data, error } = await client.from("memory_events")
        .select("*").eq("user_id", user.id).eq("id", String(id)).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { data: links, error: le } = await client.from("memory_event_links")
        .select("memory_id,relation,weight,ordinal,memory_revision_at_link,deleted")
        .eq("user_id", user.id).eq("event_id", String(id))
        .order("ordinal", { ascending: true });
      if (le) throw le;
      return { event: data, links: links || [] };
    },

    // ---- P1-3 纠错留环：候选只提案；只有 Lisa 的 authenticated 会话能确认 ----
    async memoryCorrectionCandidatesList() {
      if (!client) throw new Error("云服务未就绪");
      const user = await this.getUser();
      if (!user) throw new Error("未登录");
      const { data, error } = await client.from("memory_correction_candidates")
        .select("id,old_memory_id,new_memory_id,old_base_revision,new_base_revision,reason,status,revision,created_at,updated_at")
        .eq("user_id", user.id).eq("status", "proposed")
        .order("updated_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data || [];
    },
    async memoryCorrectionCreate(oldId, newId, oldRevision, newRevision, reason) {
      if (!client) throw new Error("云服务未就绪");
      const user = await this.getUser(); if (!user) throw new Error("未登录");
      const { data, error } = await client.rpc("create_memory_correction_candidate", {
        p_old_memory_id: String(oldId), p_new_memory_id: String(newId),
        p_old_revision: Number(oldRevision), p_new_revision: Number(newRevision),
        p_reason: reason || "more_detailed", p_mutation_id: crypto.randomUUID()
      });
      if (error) throw error; return data || {};
    },
    async memoryCorrectionDecide(candidateId, candidateRevision, decision) {
      if (!client) throw new Error("云服务未就绪");
      const user = await this.getUser(); if (!user) throw new Error("未登录");
      const { data, error } = await client.rpc("decide_memory_correction_candidate", {
        p_candidate_id: String(candidateId), p_candidate_revision: Number(candidateRevision),
        p_decision: decision, p_mutation_id: crypto.randomUUID()
      });
      if (error) throw error; return data || {};
    },

    // ---- C 第4步：睡眠 presence 投影（character_sleep_presence 表；表未建=报错由调用方吞，dormant）----
    async sleepPresenceUpsert(row) {
      if (!client) throw new Error("云服务未就绪");
      const user = await this.getSessionUser();
      if (!user) throw new Error("未登录");
      const { error } = await client.from("character_sleep_presence").upsert({
        user_id: user.id, char_id: String(row.char_id),
        sleep_start_at: row.sleep_start_at, wake_at: row.wake_at,
        observed_phase: String(row.observed_phase || "awake"),
        next_transition_at: row.next_transition_at,
        schedule_fingerprint: String(row.schedule_fingerprint || ""),
        valid_until: row.valid_until, updated_at: new Date().toISOString()
      }, { onConflict: "user_id,char_id" });
      if (error) throw error;
    },

    // ---- 秋声：言秋的朋友圈（yanqiu_moments 表；言秋经 MCP service_role 发，这里只有她的读/赞/评）----
    async yanqiuMomentsList(limit) {
      if (!client) throw new Error("云服务未就绪");
      const user = await this.getSessionUser();
      if (!user) throw new Error("未登录");
      const { data: moments, error } = await client.from("yanqiu_moments")
        .select("id,content,mood,lisa_liked,created_at").eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(limit || 30);
      if (error) throw error;
      const ids = (moments || []).map(m => m.id);
      let comments = [];
      if (ids.length) {
        const r = await client.from("yanqiu_moment_comments")
          .select("id,moment_id,author,content,created_at").in("moment_id", ids)
          .order("created_at", { ascending: true });
        if (r.error) throw r.error;
        comments = r.data || [];
      }
      return (moments || []).map(m => ({ ...m, comments: comments.filter(c => c.moment_id === m.id) }));
    },
    async yanqiuMomentLike(id, liked) {
      if (!client) throw new Error("云服务未就绪");
      const { error } = await client.from("yanqiu_moments").update({ lisa_liked: !!liked }).eq("id", id);
      if (error) throw error;
    },
    async yanqiuMomentComment(momentId, content) {
      if (!client) throw new Error("云服务未就绪");
      const user = await this.getSessionUser();
      if (!user) throw new Error("未登录");
      const { error } = await client.from("yanqiu_moment_comments")
        .insert({ moment_id: momentId, user_id: user.id, author: "lisa", content: String(content || "").trim() });
      if (error) throw error;
    },

    // ---- 桌面对话回流（desk_log 表，Stack-chan 实体：见 [[lisa-phone-next-window]] 图纸）----
    // stackchan-relay 每轮把「用户说的话 user_text + 角色回复 reply_text + 时刻」insert 进 desk_log；
    // app 开机/tick 拉走未消费的，投进 x_chat:小克（两具身体一条记忆流）。表不存在=安静报错、整块 dormant。
    // ⚠️relay 只 insert desk_log，【绝不直写 saves】（手机 autoPush 会整行覆盖，必撞）。
    async deskFetch() {
      if (!client) return [];
      const user = await this.getUser();
      if (!user) return [];
      const { data, error } = await client
        .from("desk_log")
        .select("id, char_id, user_text, reply_text, created_at")
        .is("consumed_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;   // 表不存在也走这，调用方 catch 后静默
      return data || [];
    },
    async deskConsume(ids) {
      if (!client || !ids || !ids.length) return;
      const user = await this.getUser();
      if (!user) return;
      await client.from("desk_log").update({ consumed_at: new Date().toISOString() }).in("id", ids);
    },

    // ---- Web Push 锁屏推送（v48.33，夜巡信箱的下半场）------------------
    // 订阅存 push_subs 表；云端 send-push 函数照单给每台订阅过的设备发通知（云端小抄在 lisa-practice/推送小抄.md）。
    // VAPID 公钥她在设置里粘贴（x_pushVapid，可云同步）；私钥只住在 Edge Function secrets，前端永远不见。
    async pushStatus() {
      try {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        return sub ? "on" : "off";
      } catch (e) { return "off"; }
    },
    async pushSubscribe(vapidPub) {
      if (!client) throw new Error("云同步没初始化");
      const user = await this.getUser();
      if (!user) throw new Error("先登录云同步——推送订阅要挂在你的账号下，夜巡才知道发给谁");
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("这个浏览器不支持推送。iPhone 要先「添加到主屏幕」、再从主屏图标打开才有这能力（iOS 16.4+）");
      const key = String(vapidPub || "").trim();
      if (!key) throw new Error("先在上面粘贴 VAPID 公钥（生成方法见推送小抄）");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") throw new Error("通知权限没给——去系统设置里允许本 app 通知后再点一次");
      const reg = await navigator.serviceWorker.ready;
      // base64url 公钥 → Uint8Array（subscribe 只认字节）
      const pad = "=".repeat((4 - key.length % 4) % 4);
      const b64 = (key + pad).replace(/-/g, "+").replace(/_/g, "/");
      const rawKey = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const old = await reg.pushManager.getSubscription();
      if (old) { try { await old.unsubscribe(); } catch (e) {} } // 换过公钥的旧订阅作废重订
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: rawKey });
      const { error } = await client.from("push_subs").upsert({
        user_id: user.id,
        endpoint: sub.endpoint,
        subscription: sub.toJSON(),
        ua: String(navigator.userAgent || "").slice(0, 120),
        updated_at: new Date().toISOString()
      }, { onConflict: "endpoint" });
      if (error) throw error;
      return true;
    },
    async pushUnsubscribe() {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          if (client) { try { await client.from("push_subs").delete().eq("endpoint", sub.endpoint); } catch (e) {} }
          await sub.unsubscribe();
        }
      } catch (e) {}
      return true;
    },

    // ---- LLM 密钥代理（llm-proxy 函数，v49.38）----------------------------
    // 密钥住云端 secrets；app 只带登录态借道，函数验明是本人后替贴钥匙转发。
    // 返回原生 Response（调用方照常 .json()），供应商报错原样透传。
    async llmProxyFetch(ref, url, body, extraHeaders, timeout) {
      if (!client) throw new Error("云同步没初始化，云端代理用不了");
      const { data: sess } = await client.auth.getSession();
      const token = sess && sess.session && sess.session.access_token;
      if (!token) throw new Error("未登录云同步——云端代理要先验明是你本人");
      const ctrl = new AbortController();
      const tm = setTimeout(() => ctrl.abort(), timeout || 120000);
      try {
        return await fetch(VPS_SUPABASE_URL + "/functions/v1/llm-proxy", {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: VPS_SUPABASE_ANON_KEY, Authorization: "Bearer " + token },
          body: JSON.stringify({ ref: ref, url: url, body: body, extraHeaders: extraHeaders || {} }),
          signal: ctrl.signal
        });
      } catch (e) {
        // Safari/WebKit 有时不会给标准 AbortError，而只报「fetch is aborted」。
        // 以我们自己的 signal 为准，别把浏览器英文底层错误直接漏给用户。
        if (ctrl.signal.aborted || (e && e.name === "AbortError") || /fetch.*abort/i.test(String(e && e.message || ""))) {
          throw new Error("请求超时，请重试（模型或云端桥响应太慢）");
        }
        throw e;
      } finally { clearTimeout(tm); }
    },

    // ---- 照片桥：只有 Lisa 在本机照片详情里明确确认，才上传私有桶 ----
    async photoBridgeShare({ blob, caption, source, charId, takenAt }) {
      if (!client) throw new Error("云服务未就绪");
      const user = await this.getUser();
      if (!user) throw new Error("先在设置里登录云同步，才能把这张照片交给言秋");
      const text = String(caption || "").trim();
      if (!text) throw new Error("分享时要写一句照片说明，言秋以后才找得到它");
      if (!blob || !/^image\//.test(blob.type || "")) throw new Error("没有读到有效照片");
      const id = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2));
      const ext = /png/i.test(blob.type) ? "png" : /webp/i.test(blob.type) ? "webp" : "jpg";
      const storagePath = user.id + "/" + id + "." + ext;
      const bucket = client.storage.from("photo_bridge");
      const uploaded = await bucket.upload(storagePath, blob, { contentType: blob.type || "image/jpeg", cacheControl: "3600", upsert: false });
      if (uploaded.error) throw uploaded.error;
      const src = /chat|offline/.test(String(source || "")) ? "chat" : (source === "selfie" ? "selfie" : "album");
      const { data, error } = await client.from("photo_bridge_index").insert({
        id, user_id: user.id, storage_path: storagePath, caption: text,
        taken_at: takenAt || new Date().toISOString(), source: src,
        char_id: charId || null, bytes: blob.size || null
      }).select("id,storage_path,caption,created_at,expires_at").single();
      if (error) { try { await bucket.remove([storagePath]); } catch (e) {} throw error; }
      return data;
    },
    async photoBridgeRetract(id, storagePath) {
      if (!client) throw new Error("云服务未就绪");
      const user = await this.getUser(); if (!user) throw new Error("未登录");
      const path = String(storagePath || "");
      if (!path || path.indexOf(user.id + "/") !== 0) throw new Error("照片路径与当前账号不匹配，已停止撤回");
      const { error } = await client.from("photo_bridge_index").delete().eq("id", String(id)).eq("user_id", user.id);
      if (error) throw error;
      // 先撤索引，让 MCP 立刻不可见；物件删除失败只会留下私有孤儿，不会继续暴露照片。
      const removed = await client.storage.from("photo_bridge").remove([path]);
      return { ok: true, orphanedPrivateObject: !!removed.error };
    },

    // ---- 自动同步 ----------------------------------------------------

    // 本地 x_ 数据有变动时调用：登录状态下防抖后自动 push
    markDirty() {
      if (!client || suspend) return;
      clearTimeout(pushTimer);
      // 聊天/状态常在几秒内连写许多 x_ 键；合成一份备份即可。切后台仍会立刻补推。
      pushTimer = setTimeout(() => this.autoPush(), 12000);
    },

    // 本地是不是「有意义的存档」：至少建过一个角色才算。空壳（新设备/新标签页开机自动写的几个默认键）
    // 永远没有自动上云的资格——防「空壳以本地权威身份盖掉云端真存档」（2026-07-12 事故：
    // Mac 上近乎空白的 github.io 标签页 bootHadLocal=true 触发 autoPush，清掉了手机刚备份的云档）
    localMeaningful() {
      try { return JSON.parse(localStorage.getItem("x_characters") || "[]").length > 0; } catch (e) { return false; }
    },

    // 静默把本地存档推到云端（未登录=访客则不做；离线报错则忽略，下次变动再试）
    async autoPush() {
      if (!client) return;
      if (!this.localMeaningful()) return; // 空壳绝不自动上云（手动推送在设置里另有确认）
      if (pushInFlight) { pushAgain = true; return pushInFlight; }
      pushInFlight = (async () => {
        try {
          const user = await this.getUser();
          if (!user) return; // 访客模式：纯本地
          const ts = new Date().toISOString();
          const saveData = await this.collectForSave(user.id);
          const { error } = await client.from("saves").upsert({ user_id: user.id, data: saveData, updated_at: ts });
          if (!error) localStorage.setItem(MARK, ts);
        } catch (e) {
          // 离线或网络错误：静默，等下一次变动重试
        }
      })();
      try { await pushInFlight; } finally {
        pushInFlight = null;
        if (pushAgain) { pushAgain = false; this.markDirty(); }
      }
    },

    // 登录/启动时调用。返回 { applied }（applied=true 表示已用云端覆盖本地、调用方需 reload）。
    // ⚠核心安全原则（2026-07-06 大改，修「回来数据没了」）：**本地已有存档就绝不自动拿云端覆盖**。
    //   localStorage 跨刷新持久，老设备回来时本地就是最新的、权威的；原来靠 updated_at 时间戳比较判「云端更新」
    //   极不可靠（Supabase 常服务端自己盖 updated_at → 云端永远显得更新 → 每次加载都拿云端半份盖掉本地好数据）。
    //   现在：① 本地有数据 = 本地权威，只把本地推上云当备份，绝不 apply；② 本地空（真·新设备/首次登录）才安全地拉云恢复。
    //   想主动用云端覆盖，走设置里手动「从云端恢复」(doPull)。
    async autoPull() {
      if (!client) return { applied: false };
      try {
        const user = await this.getUser();
        if (!user) return { applied: false };
        // 不阻塞旧云恢复，也不改任何数据写路；只提前备好停服后的新登录态。
        this.ensureVpsSession();
        if (bootHadLocal) {
          // 老设备/刷新回来：本地权威，顺手把本地推上云备份，绝不拉云覆盖
          this.autoPush();
          return { applied: false };
        }
        // 本地空 = 真·新设备/首次登录：安全地拉云端恢复
        const row = await this.pull();
        if (!row || !row.data) {
          await this.autoPush(); // 云端也空：先把本机（空）占位备份
          return { applied: false };
        }
        await this.apply(row.data);
        localStorage.setItem(MARK, row.updated_at || new Date().toISOString());
        return { applied: true };
      } catch (e) {
        return { applied: false };
      }
    },
  };

  // 一次性拦截所有 x_ 键写入，任何存档变动都自动排队 push。
  // saveJSON、直接 setItem、导入等所有写路径都会被覆盖到。
  try {
    const _set = localStorage.setItem.bind(localStorage);
    const _rm = localStorage.removeItem.bind(localStorage);
    localStorage.setItem = function (k, v) {
      // 冻结期（云端恢复后等重载）：丢弃旧 React 状态对 x_ 键的写入，别覆盖刚恢复的数据
      if (frozen && typeof k === "string" && k.startsWith("x_")) return;
      _set(k, v);
      if (!suspend && typeof k === "string" && k.startsWith("x_")) window.Cloud.markDirty();
    };
    localStorage.removeItem = function (k) {
      if (frozen && typeof k === "string" && k.startsWith("x_")) return;
      _rm(k);
      if (!suspend && typeof k === "string" && k.startsWith("x_")) window.Cloud.markDirty();
    };
  } catch (e) {
    console.error("cloud autosync hook failed", e);
  }

  // 切到后台/关闭页面时：若有待推送的改动，立刻推一次，减少丢失窗口
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && pushTimer) {
      clearTimeout(pushTimer);
      pushTimer = null;
      window.Cloud.autoPush();
    }
  });
})();
