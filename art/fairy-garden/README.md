# 微光庭院 · 可调布偶美术源

发型参考和十二款轮廓说明见 [HAIR_REFERENCES.md](HAIR_REFERENCES.md)。

此目录只生成可编辑 Blender 模型与预览，不修改游戏中的 `traveler.glb`。
源脚本留在 `art/`，避免触发 `apps/fairy-garden/` 整包缓存指纹变化。
原稿保存在 Git 提交 `d6cb63c`；图和 `.blend` 输出到仓库之外。

## 这一稿

- 保留原 `traveler.glb` 的竖蛋形脸、五官、四肢与布料材质。
- 将两颗相交的圆形上衣重做为一个连续衣身：肩、腰、衣摆分别成形。
- 共用一份身体拓扑，通过六组形态键调节；短发、长发均能配任何体型。
- 十二款发型分别设计发际、头顶、鬓侧和后颈；用贴头的发量底层承接细分发束。
- 中分和逗号刘海沿头骨走向展开，长发使用连续后发主体；加了左右小耳朵，便于辨认短侧与长尾。
- 头发保留沿发流方向的 UV 与细纹材质，每款合成一个网格，原始构造统一在脚本中维护。
- 每个实例的网格、衣服和头发材质独立，改一个人不会改变其他人。
- 原复制逻辑会截断 `.001`，混掉另一条腿、眼睛等身份；现在保存准确的 `part` 属性。

## 生成与检查

本机已经安装 Blender，无需再安装 `bpy`：

```sh
DOLL_OUT=/tmp/fairy-doll-trends /Applications/Blender.app/Contents/MacOS/Blender --background --python art/fairy-garden/preview.py -- focus trends tied
/Applications/Blender.app/Contents/MacOS/Blender --background --python art/fairy-garden/check_model.py
python3 art/fairy-garden/contact_sheet.py /tmp/fairy-doll-trends
```

其他系统用自己的 Blender 可执行文件替换上述路径。
已有兼容 `bpy` 的 Python 环境，也可直接 `python3 art/fairy-garden/preview.py`。
默认输出 `/tmp/fairy-doll`，可用 `DOLL_OUT` 指定持久目录。

默认预览任务输出重点三款的 `focus-front` / `focus-profile`，及十二款的 `catalog-1` 至 `catalog-4`，
每张都有同名 `.blend`；`tied` 另渲长卷、盘发和马尾侧面。`contact_sheet.py` 用 Pillow 排入中文标题，不重绘模型像素；
中文字体可通过 `DOLL_FONT` 指定，默认使用本机宋体。图不进 Git。

`dims` 仍可渲同一身体的两组参数交换长短发；`face` 渲单人近景；`hair` 等同十二款目录。

打开 `.blend`，选择 `Doll korean` 等空物体，在“物体属性 → 自定义属性”调节。
其子物体的形态键通过驱动器跟随，保存的不是一次性的静态摆拍。

| 参数 | 支持范围 | 含义 |
|---|---|---|
| shoulder | .85–1.20 | 肩宽，袖子与手一起移动 |
| waist | .85–1.15 | 衣身腰线 |
| flare | .78–1.22 | 衣摆宽度，独立于体型性别 |
| height | .85–1.25 | 腿长，上半身整体升降，鞋底固定 |
| head | .88–1.10 | 头身比，五官、耳朵与全部头发一起缩放 |
| build | .85–1.15 | 穿衣身体的丰满程度 |

所有参数以 1 为中性值，范围外显式报错，重复应用不会累计变形。
这是穿衣的童话布偶，不是写实人体解剖模型，也没有独立裸体。
十二款键和中文名由 `HAIR` 与共用 `hairstyles.json` 定义；旧五个键保留，色号独立设置。

## 坐标与脸部边界

Blender Z 向上、面向 -Y。导入后烘焙零件局部变换，不带旧场景的摆放根变换。
原脸宽 .478、深 .380、高 .520；眼睛原上沿 1.264。
中性底模把躯干以上提高 .075，头发同步提高，避免改腿长后头发错位。
刘海最低处在眼睛上方，发片根部埋入头壳，不依赖额前球体遮挡。

## 检查范围与后续接入

`check_model.py` 实际调用 Blender 检查：六个参数各自两端与组合两端、鞋底固定、
重复应用、恢复中性、直接修改自定义属性的驱动效果、左右零件完整、网格与材质隔离、
十二种发型共用身体拓扑、发型单网格/UV/有限顶点以及非法参数报错。预览另需目视检查；数学通过不代表美术满意。

尚未替换运行时模型、接自定义面板、增加骨骼或测试行走动画。
运行时 `traveler.mjs` 的手脚枢轴仍对应旧尺寸，接入前要随新体型调整；
新的 `Tunic body` 也要纳入服装识别。不能只覆盖 GLB 就宣称接线完成。
Blender 自定义属性驱动器不会自动变成网页滑杆，后续需导出形态键并在 Three.js 连接。
Three.js 的 `clone(true)` 仍共享材质；本脚本的独立材质只解决美术预览实例，
运行时克隆也必须单独处理，不得误报那个坑已修。
