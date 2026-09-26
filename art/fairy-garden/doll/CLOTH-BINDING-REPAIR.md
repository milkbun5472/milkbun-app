# 小兔毛衣：手腕与衣内穿模修复

本批处理小兔毛衣的抬手拉片与衣内露皮，陪伴、小世界、列车仍共用同一资产和 traveler。承接已有鞋面修复，不重新制作外观。

- `repair_cloth_binding.py` 在加肘骨前按身体连通分区纠正内手腕权重。内衬由退化 UV 识别并独立取皮肤权重；外袖使用连续权重，裤腰与兔子包保留躯干绑定。
- 衣服上的 `skinCoverage` 只对小兔毛衣启用。着装覆盖的躯干、腿部与袖内皮肤在原始坐标中遮挡；手臂类别取实际蒙皮权重，手掌和脖子保留。颜色、深度和距离阴影共用同一遮挡，换衣即撤销；各人物独立 uniform。此前 `coveredFeet` 接口保留。
- 原 12 张纹理字节不变。早期仅调整绑定；下述连续表面重建更新毛衣网格，其他网格保持不变，文件仍小于 5 MiB。`assemble_v2.py` 和 `add_elbows.py` 的离线迁移都走同一修复。

## 后续：降低领口

`lower_cardigan_collar.py` 将中央领圈在 Z=.685～.770 之间平滑下移，最大 .028；横向在 |X|=.095～.135 衰减至零。保留原针织纹理、圆领造型、衣身、兔子包和身体比例。通过版本标记避免重复降低。

`body_shape.py` 抽出原有六个体型公式，组装与领口共用。领口形态键按新位置补偿，不能只给所有形态键相同的位移：那会使最大头身比下的胸口穿过领圈。其他顶点的形态偏移保持不变。

已带肘骨的旧资产可以用 Blender 后台执行 `lower_cardigan_collar.py -- before.glb after.glb` 单独迁移；全量组装则在服装权重修复末尾应用。`scripts/checks/verify-collar-asset.py` 比较改动范围与原纹理，浏览器另外目视默认/最小/最大体型正侧背及动作。

## 验证与范围

`shared-cloth-browser.cjs` 渲染小兔毛衣：10 个动作 × 默认/最小/最大体型 × 正侧背，共 90 格；另看其他三套衣服的 15 格回归。检查换衣撤销、两人隔离、阴影材质释放及着色器错误。`footwear-browser.cjs` 保留 180 个鞋面红色皮肤检测；`shared-arm-rig-browser.cjs` 继续检查 5000 姿态握点与骨骼，以及真实陪伴/小世界入口。数值测试不代替逐图检查。

**未完成：** 毛衣弯肘仍有较硬的局部布褶；学院、裙装、卫衣仍有袖缝拉片和穿模，不能把本批当作四套服装拓扑已修好。把同一坐标/颜色规则扩到三套衣服的试验已否决，没有并入。长发碰撞未处理；实体 iPhone 未测。

## 连续表面重建

原 C04 外表面焊接 UV 接缝后完全闭合；旧流程对分离的 UV 岛减面，产生大量开口，动作会把这些缝拉开。`restore_cardigan_surface.py` 从原 C04 移除退化内衬、先焊缝再减面，只在隐藏的脚踝衔接处裁切。保留原贴图、染色区和独立修复的鞋。手臂权重沿连续表面扩散，包的浅色前片固定到躯干；六个体型键复用 body_shape，随后重新应用降低领口。组装与肘骨迁移均调用，版本标记避免重复。

`verify-cardigan-surface.py` 检查仅脚踝允许开口、无非流形边、原贴图字节及其他部件形态保持；`cardigan-surface-browser.cjs` 在默认与两端体型、10动作三个阶段共90样本中验证接缝重合与包前片不随手臂拉伸。三套其他服装原始表面本身已有开口，未套用本修复。

## 整臂抬手（用户纠正）

用户不接受上臂停在半途、仅抬前臂的动作。共享 traveler 的肩骨现在接收完整动作旋转，肘骨保持原始局部姿态，袖子随整条手臂转动；保留已有连续毛衣表面、领口、包和鞋，不重导出资产。放下手臂使用较缓的姿态过渡。陪伴、小世界和列车共用此动作。

`shared-arm-rig-browser.cjs` 在全部5000姿态中断言肘骨不单独折起，并验证肩骨实际抬起、动作结束平滑、道具跟手和人物隔离。`cardigan-surface-browser.cjs` 重新检查整臂动作下90样本的接缝与包；毛衣正侧背三体型目视。其他三套衣服原有破面仍未解决，不能把骨骼测试当成所有衣服适配完成。

### Whole-arm sleeve volume (2026-09-26)

C04's inner sleeve is fused into the torso; diffuse arm/torso weights flatten its
cross-section during the requested whole-arm lift. `rebuild_cardigan_sleeves.py`
runs after the continuous surface/collar repair, cuts the fused lobes, closes the
side panels and authors full rounded sleeves with closed shoulder caps and inset
cuffs. Sleeves follow their shoulder as a single volume; the bag and torso stay
body-owned. The six morphs use `body_shape.py`; `roundSleeveVersion` makes this
step idempotent. The original twelve embedded images and other outfit meshes stay
unchanged. `repairKnit` enables a feathered knit sample on the repaired torso:
COLOR.r remains the dye slot; COLOR.g is only its local blend mask. Handle both
BYTE_COLOR (GLB re-import) and FLOAT_COLOR (fresh authoring) layers. The front
rabbit/bag texture is excluded. The atlas V is flipped when sampled in Three.
Legacy `cloth` tint must not multiply slot-dyed sleeve materials.

Validation: Blender closed-surface/other-mesh/texture/idempotence comparison;
90 pose/body cases compare pairwise sleeve distances, UV seams, bag movement,
legacy tint and avatar material isolation. The gallery covers both side views,
front/back, ten actions and three body variants. Whole-arm motion, lowered collar
and book clearance remain in the shared runtime. Other outfits' known cloth
issues and physical iPhone verification are outside this repair.
