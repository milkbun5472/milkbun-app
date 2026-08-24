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
    const a = [], b = [], drives = [], somatic = [];
    for (const char of chars) {
      const label = char.remark || char.name || char.id;
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
