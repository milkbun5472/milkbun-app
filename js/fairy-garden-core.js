// ============================================================
// 小世界 · 开机就要的那一小份（从 js/fairy-garden.js 搬出来，她 2026-10-18 继续瘦身）
// ============================================================
// 小世界页面（fairy-garden.js，连同地图规则、游戏时钟、厨房、TA的一天页面那一组）改成点进去才加载；
// 可这几样开机、聊天里就要：世界名单 FairyWorlds（聊天摘要认来源、小房间那条世界横幅）、
// 世界对话 FairyWorldDialogs（庭院房的历史、摘要里的世界认知）、主屏图标 GFairyGarden。
// 页面那一半从 root.FairyCore 取它要的，不另写。
// 微光庭院有两种进法（她 2026-09-16 定的第二种）：
//   · 首页那个入口＝架空试玩：一个公共存档，全文人设＋公共文风，主线一概不读写。
//   · 【庭院房】＝角色的一间侧房：一间房一个存档，进门带什么由这间房的开关说了算，
//     说过的话落在这间房自己的聊天记录里，要带出去就开「能进记忆」「总结回主线」。
// ⚠️第二种一样机制都没新造：房间那套（cognition/writeback）本来就长着这几排开关，
//   庭院以前只是没接上去。所以这里只多收三个 props：storeKey（存档挂哪儿）、
//   mainline（已经过这间房认知闸的主线底子）、record（这间房的记录与写回）。
// 接口密钥留在父页 callAI，不传进游戏画面。
(function (root) {
  "use strict";
  const h = React.createElement, useState = React.useState, useRef = React.useRef, useEffect = React.useEffect;
  // One record, partitioned by archive and world. Untagged old replies remain readable,
  // but cannot establish which world they happened in and never enter a world prompt.
  const DIALOG_WORLDS = new Set(['garden','train','pets']);
  const dialogStamp = (world, archiveId) => {
    if(!DIALOG_WORLDS.has(world)||!String(archiveId||''))throw Error('对话来源异常，暂未写入。');
    return {gameWorld:world,gameArchiveId:String(archiveId)};
  };
  const scopedDialog = (m, world, archiveId) => !!m && m.gameWorld===world && String(m.gameArchiveId||'')===String(archiveId||'');
  const selectDialogs = (rows, world, archiveId) => (Array.isArray(rows)?rows:[]).filter(m=>scopedDialog(m,world,archiveId));
  // Only garden ever wrote untagged pending/failed requests; completed legacy turns are ambiguous.
  const oldGardenRequest = m => m && !m.gameWorld && m.role==='user' && ['pending','failed'].includes(m.status);
  const localDialogs = (d,cid,world) => ((d.dialogs||{})[cid]||[]).filter(m=>scopedDialog(m,world,d.id)||(world==='garden'&&oldGardenRequest(m)));
  function replaceDialogs(d,cid,world,rows,limit=200){
    const old=(d.dialogs||{})[cid]||[],stamp=dialogStamp(world,d.id);
    const kept=old.filter(m=>!scopedDialog(m,world,d.id)&&!(world==='garden'&&oldGardenRequest(m)));
    return {...d,dialogs:{...(d.dialogs||{}),[cid]:kept.concat(rows.slice(-limit).map(m=>({...m,...stamp})))}};
  }
  const worldCognition = world => (root.FairyWorlds||[]).find(w=>w.id===world)?.cognition||'';
  root.FairyWorldDialogs={stamp:dialogStamp,select:selectDialogs,local:localDialogs,replace:replaceDialogs,cognition:worldCognition};
  root.GFairyGarden = p => h(Svg, p, h("path", {
    d: "M5 14a4 4 0 1 0 8 0a4 4 0 1 0 -8 0M13 7.5a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M3.9 6.2a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0 -3.4 0" }));

  // ── 进门那两页（她 2026-09-16：「先做个进入页面…再来到存档…新建或者开启已有」）──
  // 一层是【去哪个世界】，一层是【开哪一档】。庭院房那条路不走这儿：
  // 一间房就是一个世界一个存档，进门直接落到桌上（见 app.js 的 storeKey/lockPartnerId）。
  // ⚠️她 2026-09-18：占位的那三个世界全删了。原来摆在那儿是「这地方以后会长」的意思，
  //   可它们许的是三件谁都没在做的事——别人打开秋秋，看见的就是三张空头支票。
  //   撤掉一件东西就把它删掉，不许留在原地当死代码（那三行连着灰卡片那一档渲染一起走）。
  const WORLDS = [
    { id: "garden", name: "微光庭院", label: "庭院", note: "种花、下井、和同行者一起把日子过下去" },
    { id: "train", name: "远行列车", label: "列车", note: "带上同一档的同行者，沿着山林、田野和海岸旅行" },
    { id: "pets", name: "绒绒小镇", label: "宠物", note: "跟着小尾巴，过自己的日子", cognition: "【绒绒小镇】这里是你和对方共同生活、一起养宠的日常。家、街区、店铺和家里的猫狗都是这个生活场景的一部分；照料、家务、职业与带回家的东西会成为你们共同的小日子。以眼前的状态和已经完成的记录承接经历，尚在路上或准备做的事按当前阶段理解。你怎样看待宠物、愿不愿照料、如何相处，沿你完整的人设、喜好与实际经历自然生发；两人可以商量、分工，也会有不同意见。其他往事沿这间房准许的上下文承接。" }
  ];
  root.FairyWorlds=WORLDS;

  // 页面那半要用的，原样递过去
  root.FairyCore = { h, useState, useRef, useEffect, selectDialogs, localDialogs, replaceDialogs, worldCognition, WORLDS };
})(window);
