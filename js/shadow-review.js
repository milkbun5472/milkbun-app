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
  const finiteRound = value => Number.isFinite(Number(value)) ? Math.round(Number(value) * 1000) / 1000 : null;
  const readStoredJiwen = () => {
    try {
      const raw = window.localStorage && window.localStorage.getItem("x_jiwen");
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (e) { return {}; }
  };
  const cleanJiwen = (char, label, stored) => {
    const live = window.__jiwen && window.__jiwen[char.id];
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
      insightCandidates: window.InsightCandidateShadow
    };
    const memory = {};
    for (const [key, mod] of Object.entries(modules)) {
      memory[key] = await safe(key, () => mod && mod.report ? mod.report(key === "recall" ? 300 : 300) : ({ unavailable: true }));
    }
    const e = await safe("E", () => window.InnerLifeETidalShadow && window.InnerLifeETidalShadow.report ? window.InnerLifeETidalShadow.report() : ({ unavailable: true }));
    const eReadiness = window.InnerLifePromotionGate ? window.InnerLifePromotionGate.evaluateE(e) : null;
    const c = await safe("C", () => window.SleepShadow && window.SleepShadow.report ? window.SleepShadow.report(500) : ({ unavailable: true }));
    const personality = cleanPersonality(await safe("personality", () => window.PersonalityShadow && window.PersonalityShadow.report ? window.PersonalityShadow.report() : ({ unavailable: true })));
    const a = [], b = [], drives = [], somatic = [], jiwen = [], storedJiwen = readStoredJiwen();
    for (const char of chars) {
      const label = char.remark || char.name || char.id;
      const jiwenRow = cleanJiwen(char, label, storedJiwen);
      if (jiwenRow) jiwen.push(jiwenRow);
      if (window.InnerLifeAShadow) {
        const state = await safe("A state", () => window.InnerLifeAShadow.get(owner, char.id));
        const report = await safe("A report", () => window.InnerLifeAShadow.report(owner, char.id));
        if (state || (report && report.sampleCount)) a.push({ charId: char.id, name: label, state, report, readiness: window.InnerLifePromotionGate ? window.InnerLifePromotionGate.evaluateA(report) : null, gate: window.InnerLifePromotionGate ? window.InnerLifePromotionGate.state("A", char.id) : null });
      }
      if (window.InnerLifeBShadow && window.InnerLifeBShadow.pilotFor && window.InnerLifeBShadow.pilotFor(char)) {
        b.push({ charId: char.id, name: label, report: await safe("B report", () => window.InnerLifeBShadow.report(owner, char)) });
      }
      if (window.DesireDriveShadow && window.DesireDriveShadow.status) {
        const state = await safe("drive", () => window.DesireDriveShadow.status(char.id));
        if (state) drives.push({
          charId: char.id, name: label, drives: state.drives, baselines: state.baselines,
          baselineFreezeVersion: state.baselineFreezeVersion || null,
          legacyBaselineDriftDetected: !!state.legacyBaselineDrift,
          top: state.top, ticks: state.ticks, warnings: state.warnings,
          suppressed: state.suppressed, updatedAt: state.t
        });
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
    const jiwenVsA = jiwen.map(row => {
      const aRow = aByChar[row.charId], current = aRow && aRow.state && aRow.state.emotion && aRow.state.emotion.current;
      const sharedAxes = {};
      ["connection", "pride", "valence", "arousal", "immersion"].forEach(key => {
        const jiwenValue = finiteRound(row.axes[key]);
        const aValue = current ? finiteRound(current[key]) : null;
        sharedAxes[key] = { jiwen: jiwenValue, aShadow: aValue, delta: jiwenValue != null && aValue != null ? finiteRound(aValue - jiwenValue) : null };
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
        interpretation: "delta 只表示两套引擎此刻读数之差，不代表谁对谁错；须由 Lisa 与角色本人评审。"
      };
    });
    return {
      schema: "lisa-shadow-promotion-review-v1",
      generatedAt: new Date().toISOString(), appVersion: appVersion || null,
      safety: {
        readOnly: true, changedLiveBehavior: false, containsChatText: false, openedAnyGate: false,
        ownerMismatchCannotClearDiagnostics: true
      },
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
        E: e && typeof e === "object" ? { ...e, readiness: eReadiness } : { report: e, readiness: eReadiness }, A: a, B: b, C: c, somatic,
        somaticReview: window.SomaticReviewCore ? window.SomaticReviewCore.summarize(somatic) : { unavailable: true },
        jiwenLive: {
          mode: "live",
          axes: ["connection", "pride", "valence", "arousal", "immersion"],
          affectsLiveBehavior: true,
          livePaths: ["private_proactive", "group_proactive", "group_offline_proactive"],
          containsChatText: false,
          characters: jiwen
        },
        jiwenVsA: {
          mode: "review_only",
          changedLiveBehavior: false,
          sharedAxisLabels: { connection: "连接/挂念", pride: "骄傲/端着", valence: "情绪正负", arousal: "唤醒度", immersion: "沉浸度" },
          aAddedAxisLabels: { hurt: "受伤", anger: "愤怒", anxiety: "焦虑", warmth: "温度", fatigue: "疲劳" },
          characters: jiwenVsA
        },
        legacyNineDrivesStatus: {
          mode: "retired_shadow",
          affectsLiveBehavior: false,
          note: "旧九维只作历史对照，不是 jiwen，也不能据此开阀或解释当前主动消息。"
        },
        legacyNineDrives: drives
      }, personality
    };
  }
  async function saveText(filename, text, mime) {
    const bridge = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.nativeExport;
    if (bridge && typeof bridge.postMessage === "function") {
      const result = await bridge.postMessage({ filename, text, mime: mime || "application/json" });
      if (!result || result.ok !== true) throw new Error("原生保存面板没有打开");
      return "native";
    }
    const file = new File([text], filename, { type: mime || "application/json" });
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({ files: [file], title: "人格转正评审包" });
      return "share";
    }
    const href = URL.createObjectURL(file), a = document.createElement("a");
    a.href = href; a.download = filename; a.style.display = "none";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 10000);
    return "download";
  }
  async function download(characters, appVersion) {
    const data = await build(characters, appVersion), stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await saveText("lisa-shadow-review-" + stamp + ".json", JSON.stringify(data, null, 2), "application/json");
    return data;
  }
  window.ShadowReview = Object.freeze({ build, download, _saveText: saveText });
})();
