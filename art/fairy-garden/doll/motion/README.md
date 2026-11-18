# 身体与衣服动作数据

运行入口是 `apps/fairy-garden/avatar-motion/controller.mjs`，由公共
`loadTravelerSource()` 准备后交给 `createTraveler()`。陪伴、庭院、列车、
日常生活、邮局和宠物世界使用同一入口。自定义 NPC costume 保持自己的绑定。

身体仍使用原 GLB 的材质、骨骼和贴图。动作模块安装经过验证的身体几何、
姿态形态键和六项体型形态键，再计算肩部、弯肘和材料长度修正。
衣服从当前身体的材料表面建立变形框架，保留衣柜材质分区、配色、配件与原网格。
全部 12 套共用 `cloth-transport.mjs`；复古三件套、古风与菱格额外使用材料截面导引。

## 必须保留的约定

- 原始握点参与 IK；手持挂点通过材料掌面映射跟随修正。不能把 IK marker 搬到掌心。
- 肩部碰撞修正只撤销自己的上一帧位移，不能覆盖躯干侧倾。接触姿势也走同一顺序。
- `linear` 腰围绑定行会去掉源模型中杂散的手臂权重；不能因为它们不属于袖子而跳过。
- normalized 的压缩形态键须通过属性规则解码。不可直接用 Int16 原数组参与坐标运算。
- 衣服用稳定 `meshId` 绑定，名称可能重复。跨材质袖口/接缝锚点不能只从主网格找。
- 弯肘的袖身与袖口保留真实手臂的轴向转动，再对齐身体材料轴；不能都从躯干朝向重建。
- DQ 旋转参考按整袖上臂固定。不能按每个顶点的最大权重切换参考，否则三骨旋转跨半球时，
  相邻顶点会跳到不同解并拉出尖片。JS 与 WASM 必须使用同一份参考索引；回归见 `test/sleeve-roll.test.mjs`。
- 姿态计算同步执行。WASM 共享不变的因子、形态数据；角色各自拥有可变结果。
  内存增长须刷新 TypedArray 视图，销毁角色须释放可复用分配。
- 站姿外观、原形、UV、骨长、袖口和腰带需与选定基准分别对照；数值测试不能替代验图。

## 数值核心

`numeric-core.ts` 是 AssemblyScript 源；编译器固定 **0.28.20**。
所有求解和几何运算使用 Float64，原本的 GPU 形态键仍为 Float32。
核心包含稀疏求解、16 步 RK4、衣服变形/法线、身体蒙皮及表面查询。
恒定流区域仅复用同一个 RK4 线性算子的 16 次方，没有减少积分步数。

```sh
node art/fairy-garden/doll/motion/build-numeric-core.mjs /absolute/path/to/assemblyscript/bin/asc.js
```

构建写入运行时 WASM 和 `kernel-manifest.json`（源码/二进制 SHA256）。

## 数据重建

`pack_motion.py` 接收完整的标定数据目录，以无损字节重排和 gzip 打包为 LMOT。
源文件 SHA256 记录在运行时 `data/manifest.json`。只提前转为 Float32 的通道，
是原运行时必然转成 Float32BufferAttribute 的通道。动作位置／法线增量可再按每个
动作、每个通道独立缩放到 Int16，加载时还原 Float32；求解因子与其他通道保持原字节。
标定原件保存在本任务的 `body-motion-night/` 工作目录，具体路径见公共复盘的证据链接。
运行时已经打包的数据和固定稀疏算子随仓库保存；重新标定需要原件，不能凭本说明重造。

`operators/` 保存原始稀疏算子及 SHA 守卫。对称 LDL 存储只保留一个三角因子，
减少重复数据；Float32 因子误差过大的方案没有采用。重建需要 NumPy/SciPy：

```sh
python art/fairy-garden/doll/motion/refactor_factors.py "$MOTION_SOURCE_DIR" --output "$MOTION_SOURCE_DIR"
python art/fairy-garden/doll/motion/pack_motion.py "$MOTION_SOURCE_DIR" --symmetric --quantize-pose-deltas --output /tmp/rebuilt-motion
```

不要在浏览器回归进行中替换运行时数据格式。先生成到单独目录、核对，再统一切换代码和资产。

已有 LMOT 原件也可通过 `quantize_pose_deltas.py 原件.bin.gz 候选.bin.gz --report 报告.json`
单独生成身体候选，不重打包任何衣服。必须保留未量化原件；脚本拒绝重复量化。
`test/fixtures/motion-compression.json` 锁定原件 SHA、所有非目标数据的保护摘要和通道误差。
本轮身体包24,589,128→17,762,655字节；这只改变下载编码，不修复动作或服装造型。

## 验证

```sh
node --test test/avatar-motion-core.test.mjs test/avatar-motion-geometry.test.mjs apps/fairy-garden/arm-rig.test.mjs apps/fairy-garden/reach-hand.test.mjs apps/fairy-garden/seated-legs.test.mjs apps/fairy-garden/wardrobe.test.mjs
PLAYWRIGHT_MODULE=/absolute/path/to/playwright COMPANION_TEST_URL=http://127.0.0.1:18979 MOTION_EVIDENCE=/tmp/avatar-motion-review node scripts/checks/avatar-motion-browser.cjs
```

浏览器检查默认覆盖全部衣服、默认/滑杆全最小/全最大体型与七种状态；
`MOTION_OUTFITS=linen,argyle` 可限定衣服，`MOTION_BROWSER=webkit` 切换 WebKit。
`MOTION_TRANSITIONS=1` 运行连续左右单举/双手弯肘的双角色对照：每段61帧，
第18帧把体型调至全最大再恢复，第30帧换到另一套再换回；
核对与同历史未换装角色的几何一致性，关键帧逐点比较，其余每13点采样。
这项检查只验证操作没有留下变形，不证明所有动作都无碰撞。
`MOTION_PHONE_CONTACT=1` 核对全部12套三档体型的原生手面与真实屏幕触点，
并以陪伴动作原时长、30fps验证三体型点屏轨迹和手势/道具收回。
固定姿势距离上限.003，连续点屏峰值上限.006（模型单位）；不是整手机碰撞审计。
`MOTION_COLLAR_STRAP=1` 检查背带裙领口和卫衣肩带：两套三体型、四姿态、四方向，
含原问题位置像素断言和两套独立改色；肩带资产与绑定同步另见RANGER-BAG.md。
`MOTION_CARDIGAN_SEAM=1` 检查小兔毛衣三体型、站姿及左右举手/双弯肘四个中途帧，
共117近距离视图，并断言修复区没有压塌三角面；源资产/绑定迁移见CARDIGAN-SHOULDERS.md。
另外跑实际页面的 `companion-all-actions-browser.cjs` 和 `town-appearance-browser.cjs`，
确认产品入口、衣柜保存与角色隔离，不能只验证测试场景。

唯一公共经验记录：`施工规则/model-outfit-review.md`。当前部署状态与未解决项以其顶部为准。

`MOTION_THINKING=1` 检查全部服装的思考近图及真实骨段/手面长度；
加 `MOTION_THINKING_TIMELINE=1 MOTION_OUTFITS=tee` 按注册时长逐帧检查三体型起势与收回。
T恤新连续曲面的重建与原生坐姿下摆约束见 `../TEE-SHOULDERS.md`。
