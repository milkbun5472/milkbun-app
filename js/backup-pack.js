// ============================================================
// 备份那一份文本【全库只攒这一次】
// ============================================================
// ⚠️2026-11-09 从 app.js 搬出来（施工规则/one-public-mechanism.md）：
//   原来它是设置页组件里的一个闭包，所以组件外面谁都用不上。自动落盘要用同一份，
//   照着它再写一遍就是第二套收集逻辑——以后加一层新数据只会加在其中一条路上，
//   另一条导出的就是残的。所以搬成公共的一份，已有的那几处也改成调它。
//   搬的时候【一行行为都不许改】：拒绝的那一下原来直接 toast，公共层不碰界面，
//   改成把理由交出去，界面那一路照旧 toast。
(function () {
  "use strict";
  async function build(opts) {
    const noImages = !!(opts && opts.noImages);
    const dump = {};
    // ⚠️x_neteaseCookie 是账号凭据，界面上写着「只存这台设备」。
    //   上云那一路（cloud.js 的 collect）早就排掉它了，导出这一路没跟上——
    //   又是「一层写在两处，第二处没跟上」。备份文件会被发给别人、放进云盘，
    //   网易云账号 cookie 一起出去。两处口径必须一样。
    Object.keys(localStorage).filter(k => k.startsWith("x_") && k !== "x_neteaseCookie").forEach(k => {
      dump[k] = localStorage.getItem(k);
    });
    // 已迁进 IDB 文字库的键(同人文)不在 localStorage，从内存镜像补进备份，否则导出会漏、换设备就丢。
    try { if (window.__txtMirror) window.__txtMirror.forEach((v, k) => { if (v != null) dump[k] = v; }); } catch (e) {}
    // ⭐阶段4：图片仓库也打进备份——头像/壁纸迁进 IndexedDB 后，localStorage 只剩 iv_ 引用键，
    // 图本身在 vault 里、不随普通备份走；这里把 vault 里每张图 base64 化装进 JSON，换设备导入后图才不丢。
    let vault = {}, vaultCount = 0;
    try {
      if (!noImages && typeof idbVaultEntries === "function" && typeof blobToDataUrl === "function") {
        const entries = await idbVaultEntries();
        for (const [k, b] of entries) { try { vault[k] = await blobToDataUrl(b); vaultCount++; } catch (e) {} }
      }
    } catch (e) {}
    // ⭐备份 v3：自拍永远打包。以前现场问「要不要带自拍」，一次误点/漏点就会得到
    // 只有图片门牌、没有像素的假完整备份；数据安全优先，备份可以大但不能悄悄缺图。
    let selfies = {}, selfieCount = 0;
    try {
      if (!noImages && typeof idbImgEntries === "function" && typeof blobToDataUrl === "function") {
        const sEntries = await idbImgEntries();
        for (const [k, b] of sEntries) { try { selfies[k] = await blobToDataUrl(b); selfieCount++; } catch (e) {} }
      }
    } catch (e) {}
    // 动态形象的视频（她 2026-10-05：「很多人都不用云端，就靠导入导出备份」）。
    //   视频住在自己那个库里，不在 localStorage，原来导出只带走了门牌、视频本身留在旧手机上。
    //   跟自拍一个口径：只要带图就一起带，备份可以大，但不能悄悄缺。
    let videos = {}, videoCount = 0, videoWanted = 0;
    try {
      if (!noImages && window.VideoApi && window.VideoApi.allVideos) {
        Object.values(window.VideoApi.motionAll()).forEach(m => Object.values(m || {}).forEach(x => { if (x && x.videoRef) videoWanted++; }));
        for (const [k, b] of await window.VideoApi.allVideos()) { try { videos[k] = await blobToDataUrl(b); videoCount++; } catch (e) {} }
      }
    } catch (e) {}
    // ⚠️图库读失败是【静默】的：idbVaultEntries 的 tx.onerror 直接 res([])，
    //   于是「一张图都没有」和「一次没读出来」返回值一模一样，导出就写「含 0 张图片」。
    //   把这份文件导回本机 → 下面 doImport 看见 vault 是真值 → idbVaultClear() →
    //   **头像、壁纸、照片连同 album 目录一起清空**。这一路她不会收到任何警告。
    //   所以在这儿做一次交叉核对：存档里明明引用着 iv_ 门牌，图库却一张都没读出来，
    //   那就不是「没有图」，是「没读出来」——**拒绝导出**，绝不产出一份会清空图库的文件。
    //   「先导出一份」是所有数据规矩的地基（never-say-delete-first.md），
    //   地基本身能悄悄少图的话，那条规矩就是空的。
    const ivRefs = new Set();
    try { (JSON.stringify(dump).match(/iv_[A-Za-z0-9_-]+/g) || []).forEach(x => ivRefs.add(x)); } catch (e) {}
    // ⚠️这道闸防的是【悄悄少图】。复制那条路是明说不带图的，不归它管。
    if (!noImages && ivRefs.size > 0 && vaultCount === 0) {
      // 公共层不碰界面：把【为什么拒】原样交出去，由调用方决定怎么说。
      //   界面那一路照旧 toast；自动落盘那一路没人看着，只能安静地不写、下次再来。
      return { refused: "img_vault_unreadable", refs: ivRefs.size };
    }
    // album 目录（照片的说明、来源、照片桥索引）原来【从不进备份】，
    // 而导入那一路 idbVaultClear() 会把它连同图一起清掉——只清不备，导一次少一次。
    let album = [];
    // 照片说明是跟着图一起回去的（导入那头就写在图库那一支里），不带图就别带它
    try { if (!noImages && typeof idbAlbumEntries === "function") album = await idbAlbumEntries(); } catch (e) {}
    const blob = new Blob([JSON.stringify({
      __archive: 1,
      version: 4,
      exportedAt: Date.now(),
      data: dump,
      vault: vault,
      selfies: selfies,
      album: album,
      videos: videos
    }, null, 2)], {
      type: "application/json"
    });
    const missing = (() => { let n = 0; ivRefs.forEach(k => { if (!(k in vault)) n++; }); return n; })();
    const what = noImages
      ? "（只有文字：角色、聊天、记忆、手机、情侣空间这些；⚠️不含图片和自拍）"
      : "（含 " + vaultCount + " 张图片" + (selfieCount ? "、" + selfieCount + " 张自拍" : "")
      + (album.length ? "、" + album.length + " 条照片说明" : "")
      + (videoCount ? "、" + videoCount + " 段动态形象视频" : "")
      + (videoWanted && !videoCount ? "；⚠️动态形象的视频没读出来，这份备份里没有视频" : "")
      + (missing ? "；⚠️有 " + missing + " 张图只剩门牌、图本身找不到了" : "") + "）";
    const name = "archive-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    return { name: name, text: await blob.text(), what: what };
  }

  const g = (typeof window !== "undefined") ? window : globalThis;
  g.BackupPack = { build: build };
})();
