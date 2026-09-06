// 07-22 Shadow 转正评审包：统一读取各旁路的聚合报告。
// 只读、不清数据、不切开关；导出不含聊天正文、prompt 或思维链。
(function () {
  "use strict";
  const safe = async (name, fn) => {
    try { return await fn(); } catch (e) { return { error: name + " 读取失败" }; }
  };
  const ownerId = async () => {
    try { const u = window.Cloud && window.Cloud.getSessionUser && await window.Cloud.getSessionUser(); if (u && u.id) return u.id; } catch (e) {}
    return "local-device";
  };
  const cleanPersonality = report => {
    if (!report || report.error) return report;
    return {
      cards: report.cards, firstObservedAt: report.firstObservedAt, lastObservedAt: report.lastObservedAt, spanHours: report.spanHours, types: report.types, dimensions: report.dimensions,
      tenDayMismatches: report.tenDayMismatches, conflictingTraits: report.conflictingTraits,
      recent: (report.last || []).map(x => ({
        fingerprint: x.fingerprint, charHash: x.charHash, type: x.type, dimension: x.dimension,
        traitKey: x.traitKey, seenCount: x.seenCount, mismatchSpanDays: x.mismatchSpanDays,
        eligibleAfterTenDays: !!x.eligibleAfterTenDays, hasConflict: !!x.hasConflict,
        firstSeenAt: x.firstSeenAt, lastSeenAt: x.lastSeenAt,
        evidenceCount: (x.observations || []).reduce((n, o) => n + (o.evidence || []).length, 0)
      }))
    };
  };
  // ── 心上进转正评审（v61.56）───────────────────────────────────────────
  // ⚠️它一直在【外面】：评审包收了 E潮汐/人格/A线/躯体/动念，唯独没有心上。
  //   于是这套东西跑了几个月没人看得见它到底有没有在跑——盘一盘触发过没有？
  //   旁人递的纸条他采了还是全丢了？念想是在长还是在积灰？
  // ⚠️只报【数】和【时刻】，一个字的内容都不出来：念想和长出来的自我是他自己的话，
  //   评审包是拿去给人看的（containsChatText:false 那条约定）。
  const readStoredHeart = () => {
    try {
      const raw = window.localStorage && window.localStorage.getItem("x_desires");
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (e) { return {}; }
  };
  const cleanHeart = (char, label, stored) => {
    const b = stored && stored[char.id];
    if (!b || typeof b !== "object") return null;
    const list = Array.isArray(b.list) ? b.list : [];
    const by = st => list.filter(e => e && e.status === st).length;
    return {
      charId: char.id, name: label,
      念想: { 总数: list.length, active: by("active"), 落灰: by("ash"), 毕业: by("graduated"), 没接住: by("withered") },
      长出来的自我: Array.isArray(b.persona) ? b.persona.length : 0,
      做过的: list.reduce((n, e) => n + ((e && Array.isArray(e.tracks) ? e.tracks.length : 0)), 0),
      旁人纸条: Array.isArray(b.briefs) ? b.briefs.length : 0,
      不想碰的: Array.isArray(b.avoid) ? b.avoid.length : 0,
      一季自述: Array.isArray(b.milestones) ? b.milestones.length : 0,
      上次: { 发呆: b.lastMuse || null, 盘一盘: b.lastMellow || null, 回头看: b.lastSolstice || null, 旁人: b.lastObserve || null }
    };
  };
  const finiteRound = value => Number.isFinite(Number(value)) ? Math.round(Number(value) * 1000) / 1000 : null;
  const readStoredDongnian = () => {
    try {
      const raw = window.localStorage && window.localStorage.getItem("x_jiwen");
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (e) { return {}; }
  };
  const cleanDongnian = (char, label, stored) => {
    const live = window.__dongnian && window.__dongnian[char.id];
    const state = live && live.state || stored && stored[char.id];
    if (!state || typeof state !== "object") return null;
    const triggers = Array.isArray(live && live.triggers) ? live.triggers : [];
    return {
      charId: char.id, name: label,
      axes: {
        connection: finiteRound(state.connection), pride: finiteRound(state.pride),
        valence: finiteRound(state.valence), arousal: finiteRound(state.arousal),
        immersion: finiteRound(state.immersion)
      },
      triggerActions: [...new Set(triggers.map(row => row && row.action).filter(action => ["observation", "contact", "find_activity"].includes(action)))],
      lastTick: state.lastTick || null,
      userStatus: ["active", "busy", "away", "sleeping"].includes(state.userStatus) ? state.userStatus : "active",
      lastActivity: state.lastActivity ? { type: String(state.lastActivity.type || ""), at: state.lastActivity.at || null } : null,
      runtimeSnapshotReady: !!live
    };
  };
  async function build(characters, appVersion) {
    const chars = Array.isArray(characters) ? characters : [], owner = await ownerId();
    const modules = {
      recall: window.RecallShadow, extraction: window.MemoryQualityShadow,
      correction: window.MemoryCorrectionShadow, repairGate: window.OpenRepairShadow,
      experienceGate: window.ExperienceGateShadow, twoResolution: window.TwoResolutionShadow,
      contextBudget: window.ContextBudgetShadow, messageBranch: window.MessageBranchShadow,
      insightCandidates: window.InsightCandidateShadow, memoryV2: window.MemoryV2Shadow
    };
    const memory = {};
    for (const [key, mod] of Object.entries(modules)) {
      memory[key] = await safe(key, () => mod && mod.report ? mod.report(key === "recall" ? 300 : 300) : ({ unavailable: true }));
    }
    const e = await safe("E", () => window.InnerLifeETidalShadow && window.InnerLifeETidalShadow.report ? window.InnerLifeETidalShadow.report() : ({ unavailable: true }));
    const eReadiness = window.InnerLifePromotionGate ? window.InnerLifePromotionGate.evaluateE(e) : null;
    const eGates = chars.map(char => ({ charId: char.id, name: char.remark || char.name || char.id, gate: window.InnerLifePromotionGate ? window.InnerLifePromotionGate.state("E", char.id) : null }));
    const c = await safe("C", () => window.SleepShadow && window.SleepShadow.report ? window.SleepShadow.report(500) : ({ unavailable: true }));
    const personality = cleanPersonality(await safe("personality", () => window.PersonalityShadow && window.PersonalityShadow.report ? window.PersonalityShadow.report() : ({ unavailable: true })));
    const a = [], b = [], somatic = [], dongnian = [], heart = [], storedDongnian = readStoredDongnian(), storedHeart = readStoredHeart();
    for (const char of chars) {
      const label = char.remark || char.name || char.id;
      const dongnianRow = cleanDongnian(char, label, storedDongnian);
      if (dongnianRow) dongnian.push(dongnianRow);
      const heartRow = cleanHeart(char, label, storedHeart);
      if (heartRow) heart.push(heartRow);
      if (window.InnerLifeAShadow) {
        const state = await safe("A state", () => window.InnerLifeAShadow.get(owner, char.id));
        const report = await safe("A report", () => window.InnerLifeAShadow.report(owner, char.id));
        if (state || (report && report.sampleCount)) a.push({ charId: char.id, name: label, state, report, readiness: window.InnerLifePromotionGate ? window.InnerLifePromotionGate.evaluateA(report) : null, gate: window.InnerLifePromotionGate ? window.InnerLifePromotionGate.state("A", char.id) : null });
      }
      if (window.InnerLifeBShadow && window.InnerLifeBShadow.pilotFor && window.InnerLifeBShadow.pilotFor(char)) {
        b.push({ charId: char.id, name: label, report: await safe("B report", () => window.InnerLifeBShadow.report(owner, char)) });
      }
      if (window.SomaticShadow && window.SomaticShadow.report) {
        const report = await safe("somatic", () => window.SomaticShadow.report(owner, char.id));
        if (report && report.sampleCount) {
          const status = await safe("somatic status", () => window.SomaticShadow.status(owner, char.id, Date.now()));
          const channels = status && status.state && status.state.channels || {};
          somatic.push({
            charId: char.id, name: label, report,
            current: Object.fromEntries(Object.entries(channels).map(([key, row]) => [key, {
              value: Math.round((Number(row && row.value) || 0) * 1000) / 1000,
              labelCode: row && row.labelCode || "", entity: row && row.entity || "",
              source: row && row.source || "", mode: row && row.mode || ""
            }]))
          });
        }
      }
    }
    const ownerMismatches = a.filter(x => x && x.report && x.report.ownerMismatch).map(x => x.name)
      .concat(b.filter(x => x && x.report && x.report.ownerMismatch).map(x => x.name));
    const aByChar = Object.fromEntries(a.map(row => [row.charId, row]));
    const dongnianVsA = dongnian.map(row => {
      const aRow = aByChar[row.charId], current = aRow && aRow.state && aRow.state.emotion && aRow.state.emotion.current;
      const sharedAxes = {};
      ["connection", "pride", "valence", "arousal", "immersion"].forEach(key => {
        const dongnianValue = finiteRound(row.axes[key]);
        const aValue = current ? finiteRound(current[key]) : null;
        sharedAxes[key] = { dongnian: dongnianValue, aShadow: aValue, delta: dongnianValue != null && aValue != null ? finiteRound(aValue - dongnianValue) : null };
      });
      return {
        charId: row.charId, name: row.name,
        sharedAxes,
        aAddedAxes: current ? {
          hurt: finiteRound(current.hurt), anger: finiteRound(current.anger), anxiety: finiteRound(current.anxiety),
          warmth: finiteRound(current.warmth), fatigue: finiteRound(current.fatigue)
        } : null,
        aEvidence: aRow ? {
          sampleCount: Number(aRow.report && aRow.report.sampleCount || 0),
          spanHours: finiteRound(aRow.report && aRow.report.spanHours),
          readiness: aRow.readiness || null
        } : { sampleCount: 0, spanHours: 0, readiness: null },
        interpretation: "delta 只表示两套引擎此刻读数之差，不代表谁对谁错；须由你与角色本人评审。"
      };
    });
    const runtimePhases = {
      memoryRecall: window.RecallShadow && window.RecallShadow.liveEnabled && window.RecallShadow.liveEnabled() ? "live" : "shadow",
      memoryTieBreak: window.RecallShadow && window.RecallShadow.tieEnabled && window.RecallShadow.tieEnabled() ? "live" : "shadow",
      openRepair: "live",
      memoryV2: "shadow",
      contextBudget: "shadow",
      insightCandidates: "shadow",
      dongnian: "live",
      innerLifeE: eGates.some(x => x.gate && x.gate.mode === "pilot") ? "pilot" : "shadow",
      innerLifeA: a.some(x => x.gate && x.gate.mode === "pilot") ? "pilot" : "shadow",
      somatic: "shadow"
    };
    return {
      schema: "lisa-shadow-promotion-review-v1",
      generatedAt: new Date().toISOString(), appVersion: appVersion || null,
      safety: {
        readOnly: true, changedLiveBehavior: false, containsChatText: false, openedAnyGate: eGates.some(x => x.gate && x.gate.mode === "pilot") || a.some(x => x.gate && x.gate.mode === "pilot"),
        ownerMismatchCannotClearDiagnostics: true,
        exportReadOnly: true,
        auditedRuntimeHasLiveFeatures: Object.values(runtimePhases).some(mode => mode === "live" || mode === "pilot")
      },
      runtimePhases,
      comparisonIntegrity: {
        purePreShadowBaseline: false,
        reasons: [
          "记忆抽取 prompt 已要求输出质量分类与逐字证据；真实采纳仍沿用旧写路，因此抽取质量只能评估当前系统，不能冒充上线前纯基线。",
          "pruneSubsumed 已改为保留旧条并生成纠错候选；这是已批准的 live 安全修复，不属于纯 shadow。"
        ],
        ownerMismatches
      },
      sampleWindow: { note: "各模块保留期不同；样本不足只能续观，不能自动转正。" },
      memory, innerLife: {
        E: e && typeof e === "object" ? { ...e, readiness: eReadiness, gates: eGates } : { report: e, readiness: eReadiness, gates: eGates }, A: a, B: b, C: c, somatic,
        somaticReview: window.SomaticReviewCore ? window.SomaticReviewCore.summarize(somatic) : { unavailable: true },
        dongnianLive: {
          mode: "live",
          axes: ["connection", "pride", "valence", "arousal", "immersion"],
          affectsLiveBehavior: true,
          livePaths: ["private_proactive", "group_proactive", "group_offline_proactive"],
          containsChatText: false,
          characters: dongnian
        },
        心上: {
          mode: "live",
          affectsLiveBehavior: true,
          livePaths: ["private_chat_epiphany", "daily_muse", "persona_grown"],
          containsChatText: false,
          note: "只报数和时刻；念想与长出来的自我是角色自己的话，不进评审包。",
          characters: heart
        },
        dongnianVsA: {
          mode: "review_only",
          changedLiveBehavior: false,
          sharedAxisLabels: { connection: "连接/挂念", pride: "骄傲/端着", valence: "情绪正负", arousal: "唤醒度", immersion: "沉浸度" },
          aAddedAxisLabels: { hurt: "受伤", anger: "愤怒", anxiety: "焦虑", warmth: "温度", fatigue: "疲劳" },
          characters: dongnianVsA
        },
        legacyNineDrivesStatus: {
          mode: "deleted",
          affectsLiveBehavior: false,
          note: "旧九维（heart-drive-shadow）已于 v62.07 连模块带 IndexedDB 一起删除；这一栏只是留个墓碑，别再指望能查旧读数。"
        }
      }, personality
    };
  }
  // 存文件走 engine.js 里那一份公共的 saveTextFile（原生桥 → 分享面板 → 普通下载），
  // 这里不再自己留一份——一层写在两处，改了一处另一处必然跟不上
  const saveText = (filename, text, mime) => window.saveTextFile(filename, text, mime);
  async function download(characters, appVersion) {
    const data = await build(characters, appVersion), stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await saveText("lisa-shadow-review-" + stamp + ".json", JSON.stringify(data, null, 2), "application/json");
    return data;
  }
  window.ShadowReview = Object.freeze({ build, download, _saveText: saveText });
})();
