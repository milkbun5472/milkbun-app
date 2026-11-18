# T恤袖根连续曲面

用户截图中的 T 恤肩部与袖子分开活动。原 `outfit_tee_cotton` 是封住的整圈衣身，左右袖管独立重叠其上；仅抬高衣身权重仍会露出叠面边缘。

本轮只重建 T 恤上衣的连接。保留原领口、下摆、完整袖口，按实际边界顺序开两侧袖窿、连接袖管，再局部修顺位置与绑定。上衣成为一张连续网格；牛仔裤、鞋和原贴图的二进制载荷保持。上衣为原纯色布料槽，统一取原衣身纯色贴图区，染色仍沿原槽位。

六项体型在新曲面上生成连续场。旧独立躯干/手臂形态不能直接插值后粘接：圆润度里原来的硬阈值会翻折新腋下；修后64端点零翻面、最小面积比约.4506。原型将边界按极角排序，锯齿边界被重排后出现小孔，已弃；必须保留拓扑顺序，按弧长匹配。最终只留领口、下摆、两袖口四圈边界。

下摆必须保留精确的躯干权重；旧绑定里极小的手臂权重原来被 ids 排除，合并后若无条件激活全网格，会覆盖坐姿 seatDrape。已加几何回归与原生下摆权重断言。

## 重建

证据目录为本聊天 `think-tee/`。`source/` 包含发布前 tee.glb、使用真实加载链且在动画前解码的 meshes.json、原 motion.json。源 GLB SHA守卫为 `608bc37c0bc7d9961af89e94c35e8319bca5fbe7bf65e81785f79d30a57167b3`。完整服装母版不在本机，不要全套重导。

```sh
Blender --background --python art/fairy-garden/doll/sew_tee_armholes.py -- SOURCE OUTPUT
python art/fairy-garden/doll/repair_tee_armholes.py SOURCE OUTPUT
```

第二步需要 NumPy/SciPy；同时生成 tee.glb、tee.bin.gz 与 motion.json。替换运行资产后同步 data/manifest.json。全套动作包重建须使用这里的新 binding，不能拿旧 `wardrobe-fair-bind-tee.json.gz` 覆盖。

全曲面布尔合并的试验把休息时靠着衣身的下半截袖子也粘住了，抬手严重拉伸，已弃；`union*`、`candidate*`、早期 `sewn*-review` 不是可发布输入。最终输出 `final/`，正式验证 `final-chrome`、`final-webkit`、`transitions` 和 `release/`。

## 回归

`test/tee-armholes.test.mjs` 检查单连通网格、四个合法开口、保留资产载荷、动作绑定与64体型端点。

`MOTION_THINKING=1` 启用实际模型思考近图：全部12套、三档体型、抬起/保持/收回，并测骨段长度、材料手面直径与抬肘高度；T恤额外检查左右抬手和双弯肘。`MOTION_TRANSITIONS=1 MOTION_INCLUDE_CHIN=1` 增加动作中换衣/改体型的同历史对照。真实衣柜和坐姿仍须分别验证。

思考的接触方向由公共 emotion-pose 的 elbowPole 传给原 IK；骨长、身体资产和其他动作的默认肘方向保持。审美验收以实际图和用户反馈为准，数值通过不表示全动作碰撞穷举。
