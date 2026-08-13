// App ↔ CC 共享聊天账本（第 4 步 shadow）
// App 写出照旧；CC 入站目前只做无正文诊断，不合并真实聊天、不注入 prompt。
(function (root, factory) {
  const api = factory(root || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ChatLedgerShadow = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const OUTBOX_KEY = "chat_ledger_outbox_v1"; // 无 x_ 前缀：不混进整份 saves
  const DELETE_OUTBOX_KEY = "chat_ledger_delete_outbox_v1";
  const DIAG_KEY = "chat_ledger_shadow_diag_v1";
  const LIVE_CURSOR_KEY = "chat_ledger_live_cursor_v1";
  const CONTINUITY_KEY = "yanqiu_cross_surface_continuity_v1";
  const THREAD_TYPES = new Set(["private", "offline", "group", "group_offline"]);
  const BLOCKED_KINDS = new Set(["system", "ooc", "thought", "thinking", "cot", "silence", "offlinelog"]);

  const text = value => String(value == null ? "" : value).trim();
  const asArray = value => Array.isArray(value) ? value : [];
  const parse = (storage, key, fallback) => {
    try { const value = JSON.parse(storage.getItem(key)); return value == null ? fallback : value; }
    catch (_) { return fallback; }
  };
  const write = (storage, key, value) => storage.setItem(key, JSON.stringify(value));
  const iso = (value, fallback) => {
    const n = typeof value === "number" ? value : Date.parse(value);
    const d = new Date(Number.isFinite(n) ? n : fallback);
    return Number.isFinite(d.getTime()) ? d.toISOString() : new Date(fallback).toISOString();
  };

  function findYanqiu(characters, settings) {
    const chars = asArray(characters);
    const marked = chars.filter(c => settings && settings[c.id] && settings[c.id].engineerEyes === true);
    if (marked.length === 1) return marked[0];
    return chars.find(c => /(?:许)?言秋|小克/.test(text(c && c.name))) || null;
  }

  function eligibleContext(context) {
    if (!context || !context.charId || !THREAD_TYPES.has(context.threadType) || !context.threadId) return false;
    if (context.threadType === "private" || context.threadType === "offline") return String(context.threadId) === String(context.charId);
    return asArray(context.groupMemberIds).map(String).includes(String(context.charId));
  }

  function isRealMessage(message) {
    if (!message || message.recalled || !text(message.content)) return false;
    if (BLOCKED_KINDS.has(text(message.kind).toLowerCase())) return false;
    return ["user", "assistant", "char", "narration"].includes(text(message.role).toLowerCase());
  }

  function speakerFor(message, context) {
    const role = text(message.role).toLowerCase();
    if (role === "user") return { type: "lisa", id: null };
    if (role === "narration") return { type: "narration", id: null };
    const senderId = message.senderId || message.charId || null;
    if (!senderId || String(senderId) === String(context.charId) || context.threadType === "private" || context.threadType === "offline") {
      return { type: "character", id: String(context.charId) };
    }
    return { type: "other_character", id: String(senderId) };
  }

  async function sha256(value) {
    const bytes = new TextEncoder().encode(value);
    if (root.crypto && root.crypto.subtle) {
      const digest = await root.crypto.subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(digest)).map(n => n.toString(16).padStart(2, "0")).join("");
    }
    // 极老 WebView 的确定性后备；只是幂等键，不承担安全用途。
    let h = 2166136261;
    for (let i = 0; i < value.length; i++) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16).padStart(8, "0");
  }

  function strongSourceId(message) {
    return message.id || message.mid || message.messageId || message.cid || null;
  }

  function sourceId(message) {
    return strongSourceId(message) || message.turnId || null;
  }

  async function rowsFor(context, messages, nowValue) {
    if (!eligibleContext(context)) return [];
    const now = Number(nowValue) || Date.now();
    const rows = [];
    for (const message of asArray(messages)) {
      if (!isRealMessage(message)) continue;
      const speaker = speakerFor(message, context);
      const occurredAt = iso(message.ts || message.created_at, now);
      const sid = sourceId(message), strongId = strongSourceId(message);
      // turnId 是“一轮”的 ID，多泡会共用，不能拿它单独当“一条消息”的幂等键。
      // 只有真正逐消息 ID 才可直用；否则把 turnId 作为材料，再叠时间/说话者/正文指纹。
      const material = ["app", context.threadType, context.threadId, sid || "", speaker.type, speaker.id || "", occurredAt, text(message.content)].join("|");
      const key = strongId
        ? ["app", context.threadType, context.threadId, String(strongId)].join(":")
        : "app:" + context.threadType + ":" + context.threadId + ":sha256:" + await sha256(material);
      rows.push({
        message_key: key,
        source: "app",
        source_message_id: sid == null ? null : String(sid),
        thread_type: context.threadType,
        thread_id: String(context.threadId),
        char_id: String(context.charId),
        speaker_type: speaker.type,
        speaker_id: speaker.id,
        content: text(message.content),
        occurred_at: occurredAt,
        metadata: {
          shadow_version: 1,
          message_kind: text(message.kind) || null,
          group_name: context.groupName ? text(context.groupName) : null
        }
      });
    }
    return rows;
  }

  function identity(message) {
    const sid = sourceId(message);
    if (sid != null) return "id:" + sid;
    return [message && message.role, message && message.senderId, message && message.ts, message && message.kind, text(message && message.content)].join("|");
  }

  function addedSessionMessages(previous, next) {
    const counts = new Map();
    asArray(previous).forEach(s => asArray(s && s.msgs).forEach(m => counts.set(identity(m), (counts.get(identity(m)) || 0) + 1)));
    const added = [];
    asArray(next).forEach(s => asArray(s && s.msgs).forEach(m => {
      const k = identity(m), left = counts.get(k) || 0;
      if (left) counts.set(k, left - 1); else added.push(m);
    }));
    return added;
  }

  // 第 5 步：把 CC/Stack-chan 的合格逐字句段投影成 App 私聊消息。
  // 纯函数只负责核验、幂等、修订与软删；真正落盘和游标提交由 App 按“先消息、后游标”完成。
  function reconcileIncoming(existing, incoming, charId) {
    const allowedKinds = new Set(["life", "emotion", "decision", "joke", "continuity"]);
    const cid = String(charId || ""), list = asArray(existing).slice();
    const byKey = new Map();
    list.forEach((m, index) => { if (m && m.ledgerKey) byKey.set(String(m.ledgerKey), index); });
    let added = 0, updated = 0, deleted = 0, skipped = 0;
    const personalityEvents = [];
    const fullTurnSides = new Set(asArray(incoming).filter(row => {
      const meta = row && row.metadata && typeof row.metadata === "object" ? row.metadata : {};
      return meta.sync_kind === "continuity" && meta.turn_id && ["lisa", "character"].includes(text(row && row.speaker_type));
    }).map(row => {
      const meta = row.metadata || {};
      return String(meta.turn_id) + ":" + text(row.speaker_type);
    }));
    asArray(incoming).forEach(row => {
      const meta = row && row.metadata && typeof row.metadata === "object" ? row.metadata : {};
      const key = text(row && row.message_key), source = text(row && row.source);
      const kind = text(meta.sync_kind), speaker = text(row && row.speaker_type);
      if (!key || String(row && row.char_id || "") !== cid || !["cc", "stackchan"].includes(source)
        || !allowedKinds.has(kind) || !["lisa", "character"].includes(speaker)) { skipped++; return; }
      // 新的完整 turn 是聊天副本的权威正文；同轮旧句段筛仍提供人格证据，
      // 但不再投影第二份气泡。旧数据没有 turn_id 时保持原行为。
      if (kind !== "continuity" && meta.turn_id && fullTurnSides.has(String(meta.turn_id) + ":" + speaker)) {
        if (!row.deleted_at) personalityEvents.push({
          eventKey:key + ":" + Math.max(1, Number(row.revision) || 1), messageKey:key, speaker,
          content:text(row.content), ts:Number.isFinite(Date.parse(row.occurred_at)) ? Date.parse(row.occurred_at) : Date.now(),
          evidence:meta.personality_evidence && typeof meta.personality_evidence === "object" ? meta.personality_evidence : null
        });
        skipped++; return;
      }
      const ts = Date.parse(row.occurred_at), safeTs = Number.isFinite(ts) ? ts : Date.now();
      const revision = Math.max(1, Number(row.revision) || 1), isDeleted = !!row.deleted_at;
      const next = {
        id: "ledger:" + String(row.id || key), ledgerKey: key, ledgerRevision: revision,
        ledgerUpdatedAt: row.updated_at || null, ledgerImported: true, crossSource: source,
        crossThreadId: row.thread_id || null, syncKind: kind,
        role: speaker === "lisa" ? "user" : "assistant", content: text(row.content),
        ts: safeTs, read: speaker === "lisa", recalled: isDeleted
      };
      if (!byKey.has(key)) {
        list.push(next); byKey.set(key, list.length - 1); added++; if (isDeleted) deleted++;
        if (!isDeleted) personalityEvents.push({
          eventKey:key + ":" + revision, messageKey:key, speaker,
          content:next.content, ts:safeTs,
          evidence:meta.personality_evidence && typeof meta.personality_evidence === "object" ? meta.personality_evidence : null
        });
        return;
      }
      const index = byKey.get(key), prev = list[index] || {};
      if (revision <= Number(prev.ledgerRevision || 0) && !!prev.recalled === isDeleted) return;
      list[index] = { ...prev, ...next };
      updated++; if (isDeleted && !prev.recalled) deleted++;
    });
    list.sort((a, b) => Number(a && a.ts || 0) - Number(b && b.ts || 0));
    return { messages: list, added, updated, deleted, skipped, personalityEvents };
  }

  // 完整跨窗口经历同时保存一份滚动窗，供历史裁剪后仍能补足 prompt；
  // App 时间线本身也会把 continuity 行作为 CC turn 的权威保留副本显示出来。
  function reconcileContinuity(existing, incoming, charId, limit) {
    const cid = String(charId || ""), max = Math.max(10, Math.min(200, Number(limit) || 80));
    const byKey = new Map(asArray(existing).filter(Boolean).map(row => [String(row.message_key || ""), row]));
    asArray(incoming).forEach(row => {
      const meta = row && row.metadata && typeof row.metadata === "object" ? row.metadata : {};
      const key = text(row && row.message_key), speaker = text(row && row.speaker_type);
      if (!key || String(row && row.char_id || "") !== cid || !["cc", "stackchan"].includes(text(row && row.source))
        || meta.sync_kind !== "continuity" || !["lisa", "character"].includes(speaker) || !text(row && row.content)) return;
      if (row.deleted_at) { byKey.delete(key); return; }
      byKey.set(key, {
        message_key: key, source: text(row.source), thread_id: text(row.thread_id), speaker_type: speaker,
        content: text(row.content), occurred_at: row.occurred_at, updated_at: row.updated_at || null,
        reply_to: meta.reply_to || null
      });
    });
    return Array.from(byKey.values()).sort((a, b) => {
      const dt = Date.parse(a.occurred_at) - Date.parse(b.occurred_at);
      return dt || String(a.message_key).localeCompare(String(b.message_key));
    }).slice(-max);
  }

  function continuityPrompt(rows, userName, limit, afterTs, maxLineChars) {
    const floor = Math.max(0, Number(afterTs) || 0);
    const eligible = asArray(rows).filter(row => {
      const at = Date.parse(row && row.occurred_at);
      return !floor || (Number.isFinite(at) && at > floor);
    });
    const picked = eligible.slice(-(Math.max(4, Math.min(60, Number(limit) || 30))));
    if (!picked.length) return "";
    const who = text(userName) || "Lisa";
    const lineCap = Math.max(80, Math.min(1200, Number(maxLineChars) || 1200));
    const lines = picked.map(row => {
      const at = Date.parse(row.occurred_at), stamp = Number.isFinite(at) ? new Date(at).toLocaleString("zh-CN", { month:"numeric", day:"numeric", hour:"2-digit", minute:"2-digit" }) : "时间未知";
      const raw = text(row.content).replace(/\s+/g, " ").trim();
      const content = raw.length > lineCap ? raw.slice(0, lineCap - 1) + "…" : raw;
      return `[${stamp}·${row.source === "stackchan" ? "桌面身体" : "CC窗口"}] ${row.speaker_type === "lisa" ? who : "你"}：${content}`;
    });
    return "\n\n【你在其他窗口亲历的近期对话·同一个你的连续经历】\n" + lines.join("\n")
      + "\n这些不是外部记忆或转述，而是你本人和 " + who + " 在另一窗口真实说过的原话。自然承接即可；不要复述来源标签，也不要假装第一次听说。";
  }

  // CC 完整 turn 要作为 App 可见聊天副本永久保留，但同一批原话已经由
  // continuityPrompt 作为“亲历块”喂给模型。若再混进 promptHistory，会既
  // 双份计费，又因按 occurred_at 回插到历史中段而击穿 Anthropic 历史缓存。
  // 这里只裁模型请求的副本；聊天 UI、云账本和本地 x_chat 一个字不动。
  function modelHistory(messages) {
    return asArray(messages).filter(message => !(
      message && message.ledgerImported === true
      && message.syncKind === "continuity"
      && ["cc", "stackchan"].includes(text(message.crossSource))
    ));
  }

  // 灾后找回（2026-08-13 强制登出+云端恢复丢行事故）：云端恢复只盖回 saves 快照，
  // 快照时刻之后的 app 行仍活在账本里。这里把账本行与本地线程逐条对账，返回本地缺失
  // 行还原成的消息。只算缺行，不改不删已有消息；真正落盘由 App 侧直写完成——
  // 不得走 pChat/pOffline 一类 helper，否则差量会被再次 enqueue、给账本造第二份行。
  async function restoreAppRows(context, existingMessages, cloudRows) {
    if (!eligibleContext(context)) return { missing: [] };
    const offlineLike = context.threadType === "offline" || context.threadType === "group_offline";
    const groupLike = context.threadType === "group" || context.threadType === "group_offline";
    const eligible = asArray(cloudRows).filter(row => row && !row.deleted_at
      && text(row.source) === "app"
      && text(row.thread_type) === context.threadType
      && String(row.thread_id) === String(context.threadId)
      && text(row.message_key).indexOf("appcc:") !== 0
      && !(row.metadata && typeof row.metadata === "object" && row.metadata.bridge_kind)
      && text(row.content));
    if (!eligible.length) return { missing: [] };
    const existing = asArray(existingMessages);
    const have = new Set((await rowsFor(context, existing, Date.now())).map(r => r.message_key));
    // 老消息没强 ID 时 message_key 带正文指纹，本地重算可能漂移；
    // 再叠一层「同侧同正文±15分钟」软对账兜底，宁可漏补也不造重复泡。
    const sideOf = value => value === "user" || value === "lisa" ? "u" : value === "narration" ? "n" : "c";
    const nearby = new Map();
    existing.filter(isRealMessage).forEach(m => {
      const k = sideOf(text(m.role).toLowerCase()) + "|" + text(m.content);
      if (!nearby.has(k)) nearby.set(k, []);
      nearby.get(k).push(Number(m.ts) || 0);
    });
    const missing = [];
    for (const row of eligible) {
      if (have.has(text(row.message_key))) continue;
      const at = Date.parse(row.occurred_at), ts = Number.isFinite(at) ? at : Date.now();
      const side = sideOf(text(row.speaker_type));
      const near = nearby.get(side + "|" + text(row.content));
      if (near && near.some(t => Math.abs(t - ts) < 15 * 60 * 1000)) continue;
      const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
      const msg = {
        id: row.source_message_id ? String(row.source_message_id) : "rst_" + text(row.message_key).replace(/[^\w]+/g, "_").slice(-40),
        role: side === "u" ? "user" : side === "n" ? "narration" : offlineLike ? "char" : "assistant",
        content: text(row.content), ts, read: true, ledgerRestored: true
      };
      if (meta.message_kind) msg.kind = text(meta.message_kind);
      if (groupLike && side === "c" && row.speaker_id) msg.senderId = String(row.speaker_id);
      missing.push(msg);
    }
    missing.sort((a, b) => a.ts - b.ts);
    return { missing };
  }

  function createManager(options) {
    options = options || {};
    const storage = options.storage || root.localStorage;
    const clock = options.now || (() => Date.now());
    const uploader = options.upload || (async rows => {
      if (!root.Cloud || typeof root.Cloud.chatMessagesUpsert !== "function") throw new Error("chat ledger cloud unavailable");
      return root.Cloud.chatMessagesUpsert(rows);
    });
    const deleter = options.remove || (async keys => {
      if (!root.Cloud || typeof root.Cloud.chatMessagesSoftDelete !== "function") throw new Error("chat ledger delete unavailable");
      return root.Cloud.chatMessagesSoftDelete(keys);
    });
    let chain = Promise.resolve();

    const diagnostic = patch => {
      const old = parse(storage, DIAG_KEY, {});
      write(storage, DIAG_KEY, { ...old, ...patch, updated_at: new Date(clock()).toISOString() });
    };
    const internalFlush = async () => {
      const deletes = parse(storage, DELETE_OUTBOX_KEY, []);
      if (deletes.length) {
        const batchKeys = deletes.slice(0, 50);
        try {
          await deleter(batchKeys);
          const done = new Set(batchKeys), currentDeletes = parse(storage, DELETE_OUTBOX_KEY, []);
          write(storage, DELETE_OUTBOX_KEY, currentDeletes.filter(k => !done.has(k)));
        } catch (error) {
          diagnostic({ last_error: String(error && error.message || error), pending_deletes: deletes.length });
          return { sent: 0, pending: parse(storage, OUTBOX_KEY, []).length, pendingDeletes: deletes.length, error };
        }
      }
      const outbox = parse(storage, OUTBOX_KEY, []);
      if (!outbox.length) return { sent: 0, pending: 0, pendingDeletes: parse(storage, DELETE_OUTBOX_KEY, []).length };
      const batch = outbox.slice(0, 50);
      try {
        await uploader(batch);
        const sent = new Set(batch.map(r => r.message_key));
        const current = parse(storage, OUTBOX_KEY, []);
        const remaining = current.filter(r => !sent.has(r.message_key));
        write(storage, OUTBOX_KEY, remaining);
        diagnostic({ last_success_at: new Date(clock()).toISOString(), last_error: null, pending: remaining.length });
        return { sent: batch.length, pending: remaining.length };
      } catch (error) {
        diagnostic({ last_error: String(error && error.message || error), pending: outbox.length });
        return { sent: 0, pending: outbox.length, error };
      }
    };
    const enqueue = (context, messages) => {
      chain = chain.catch(() => {}).then(async () => {
        const rows = await rowsFor(context, messages, clock());
        if (!rows.length) return { queued: 0, pending: parse(storage, OUTBOX_KEY, []).length };
        const current = parse(storage, OUTBOX_KEY, []);
        const byKey = new Map(current.map(r => [r.message_key, r]));
        let newCount = 0;
        rows.forEach(r => { if (!byKey.has(r.message_key)) { byKey.set(r.message_key, r); newCount++; } });
        const merged = Array.from(byKey.values());
        write(storage, OUTBOX_KEY, merged);
        diagnostic({ total_queued: Number(parse(storage, DIAG_KEY, {}).total_queued || 0) + newCount, pending: merged.length });
        const result = await internalFlush();
        return { queued: rows.length, ...result };
      });
      return chain;
    };
    const invalidate = (context, messages) => {
      chain = chain.catch(() => {}).then(async () => {
        const rows = await rowsFor(context, messages, clock());
        const keys = new Set(rows.map(r => r.message_key));
        // 若旧泡还在“待新增”队列，先撤销新增；否则恢复联网时会先删空气、再把旧泡重新插回。
        const pendingRows = parse(storage, OUTBOX_KEY, []);
        write(storage, OUTBOX_KEY, pendingRows.filter(r => !keys.has(r.message_key)));
        const current = parse(storage, DELETE_OUTBOX_KEY, []);
        write(storage, DELETE_OUTBOX_KEY, [...new Set([...current, ...keys])]);
        return internalFlush();
      });
      return chain;
    };
    const flush = () => { chain = chain.catch(() => {}).then(internalFlush); return chain; };
    const status = () => ({ outbox: parse(storage, OUTBOX_KEY, []), deleteOutbox: parse(storage, DELETE_OUTBOX_KEY, []), diagnostic: parse(storage, DIAG_KEY, {}) });
    const clearLocal = () => { storage.removeItem(OUTBOX_KEY); storage.removeItem(DELETE_OUTBOX_KEY); storage.removeItem(DIAG_KEY); storage.removeItem(LIVE_CURSOR_KEY); storage.removeItem(CONTINUITY_KEY); };
    return { enqueue, invalidate, flush, status, clearLocal };
  }

  // 第 4 步：只观察 CC/Stack-chan 入站，不保存正文、更不写进真实聊天。
  const manager = root.localStorage ? createManager() : null;
  return {
    OUTBOX_KEY, DELETE_OUTBOX_KEY, DIAG_KEY, LIVE_CURSOR_KEY, CONTINUITY_KEY, findYanqiu, eligibleContext, isRealMessage, speakerFor,
    rowsFor, addedSessionMessages, reconcileIncoming, reconcileContinuity, continuityPrompt, modelHistory, restoreAppRows, createManager,
    enqueue: manager ? manager.enqueue : async () => ({ queued: 0, pending: 0 }),
    invalidate: manager ? manager.invalidate : async () => ({ sent: 0, pending: 0 }),
    flush: manager ? manager.flush : async () => ({ sent: 0, pending: 0 }),
    status: () => (manager ? manager.status() : { outbox: [], diagnostic: {} }),
    clearLocal: () => { if (manager) manager.clearLocal(); }
  };
});
