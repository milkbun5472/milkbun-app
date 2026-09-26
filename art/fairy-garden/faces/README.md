# 九种表情 · 描图定稿

`reference-nine-faces.png` 是 Lisa 定的最终设计稿。**这里的五官不是设计出来的，是从参考图逐像素抠出来的。**

- `trace.py`：按颜色从参考图每一格分出深棕五官（眼、眼皮线）和红色嘴巴，用 potrace 转成矢量路径。坐标单位是参考图像素，原点在头部中心。
- `faces.json`：九个表情的固定 SVG 片段，键是 `MOOD_FACE`（`js/screens.js`）的九个 key：happy / cozy / relax / surprise / amazed / proud / gloomy / sad / irritated。
- 另有 `default`（默认）：从 `reference-default-doll.png` 描的一对眼睛，无嘴；按两眼间距缩放到九宫格比例。
- `traced-sheet.png`：九张贴在临时光头上的预览，`sheet.html` 从本地服务器打开可复现。

## 对位

每一格按它自己的那对腮红定中心（腮红在头心下方 80、左右 78 像素）。这是九格共有的地标，比按头顶找更准：原先第二排的头顶被上一排的文字标签误认，整排低了 18 像素。九张再整体上移 6 像素（`NINE_DY`），和默认表情的眼睛同高。只允许这种整组平移，不单独挪任何一格。

## 规矩

1. 情绪名只是 ID，不参与生成。**不许按「开心／难过应该长什么样」重画、美化、对称化或修正任何一格。**
2. 要改表情，先改参考图，再重跑 `trace.py`；不要手改 `faces.json` 里的路径。
3. 腮红不属于表情，是常驻的一层（柔边椭圆），不在这九个文件里。
4. 贴到模型上时，九张整体只做同一个缩放和平移（对齐真玩偶的脸），不单独挪动任何一格。

重跑：`python3 art/fairy-garden/faces/trace.py art/fairy-garden/faces/reference-nine-faces.png art/fairy-garden/faces/faces.json`（需要 `pip install potracer pillow numpy`）。
