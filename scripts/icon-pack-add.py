#!/usr/bin/env python3
"""把她发来的单张图标收进某一套整套图标（v62.68）。

用法：
    python3 scripts/icon-pack-add.py autumn cast=/path/a.jpg ties=/path/b.jpg …

每张做四件事：
  1. 缩到 256×256、存成 WEBP（主屏那格 62px，三倍屏 186px；同一张 png 110KB、webp 12KB——秋秋的图标就是这么存的）；
  2. 四角那圈「方块外面」的近白底抠成透明——从四个角往里洪水填充，只吃跟角上颜色相近的像素，
     方块里面的奶油色不会被误伤（图标自带的那块玻璃方块四边是有边线的，填充到边线就停）；
     再把边上那圈抗锯齿的白晕啃掉两圈、边缘 alpha 压软（她 2026-09-05：「我细看我的有些白边」）；
     长方形的图按剩下的像素外框裁成正方形——GPT 后面几批给的都是长方形；
  3. 存到 img/icons/<套>/<appKey>.webp；
  4. 把 appKey 登记进 js/theme-studio.js 里 ICON_PACKS.<套>.keys（按字母序，已有就不重复）。

⚠️不许手写 keys：写了没文件 / 有文件没写，test/icon-packs-62-42.test.js 都会红。
"""
import re, sys, os
from collections import deque
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SIZE = 256
TOL = 34  # 跟角上那个颜色差多少以内算「底」

def knock_out_corners(im):
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    def near(a, b): return sum(abs(a[i] - b[i]) for i in range(3)) <= TOL
    seen = bytearray(w * h)
    for sx, sy in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        base = px[sx, sy][:3]
        if sum(base) < 3 * 200:  # 角上不是浅色底：这张图本来就没白边，别抠
            continue
        q = deque([(sx, sy)])
        while q:
            x, y = q.popleft()
            i = y * w + x
            if seen[i]: continue
            seen[i] = 1
            p = px[x, y]
            if not near(p[:3], base): continue
            px[x, y] = (p[0], p[1], p[2], 0)
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]: q.append((nx, ny))
    return im

# 洪水填充停在方块边线上，边线外侧那一圈抗锯齿像素是「白混一点奶油」——留着就是她看见的白边。
# 从透明区往里啃：贴着透明的像素只要够亮就一起抠掉，啃两圈；最后把新边缘的 alpha 压到六成，
# 让边软下来而不是锯齿。方块本身的边线是深棕的，够亮这一条啃不到它。
def trim_halo(im, passes=2, bright=640, feather=150):
    px = im.load(); w, h = im.size
    def edge_pixels():
        out = []
        for y in range(h):
            for x in range(w):
                if px[x, y][3] == 0: continue
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] == 0:
                        out.append((x, y)); break
        return out
    for _ in range(passes):
        for x, y in edge_pixels():
            p = px[x, y]
            if sum(p[:3]) >= bright: px[x, y] = (p[0], p[1], p[2], 0)
    for x, y in edge_pixels():
        p = px[x, y]; px[x, y] = (p[0], p[1], p[2], min(p[3], feather))
    return im

# 她后面几批是长方形的：抠完底之后按【还留着的像素】的外框裁，再补成正方形——图标在哪儿都找得到。
def crop_to_content(im):
    bbox = im.getbbox()
    if not bbox: return im
    im = im.crop(bbox)
    w, h = im.size; s = max(w, h)
    sq = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    sq.paste(im, ((s - w) // 2, (s - h) // 2))
    return sq

def main():
    if len(sys.argv) < 3: print(__doc__); sys.exit(1)
    pack = sys.argv[1]
    ts_path = os.path.join(ROOT, "js", "theme-studio.js")
    ts = open(ts_path, encoding="utf-8").read()
    m = re.search(r'(\s*%s: \{ name: "[^"]+", dir: "(img/icons/[a-z0-9_-]+/)", bare: (?:true|false), keys: \[)([^\]]*)(\])' % re.escape(pack), ts)
    if not m: print("theme-studio.js 里没有登记这一套：" + pack); sys.exit(1)
    outdir = os.path.join(ROOT, m.group(2))
    os.makedirs(outdir, exist_ok=True)
    keys = [k.strip().strip('"') for k in m.group(3).split(",") if k.strip()]
    for arg in sys.argv[2:]:
        key, path = arg.split("=", 1)
        key = key.strip()
        if not re.fullmatch(r"[a-z][a-z0-9_]*", key): print("appKey 不合法：" + key); sys.exit(1)
        im = Image.open(path)
        im = trim_halo(knock_out_corners(im))
        im = crop_to_content(im).resize((SIZE, SIZE), Image.LANCZOS)
        out = os.path.join(outdir, key + ".webp")
        im.save(out, "WEBP", quality=88, method=6)
        print("→ %s  (%d KB)" % (os.path.relpath(out, ROOT), os.path.getsize(out) // 1024))
        if key not in keys: keys.append(key)
    keys.sort()
    new_list = ", ".join('"%s"' % k for k in keys)
    ts = ts[:m.start(3)] + new_list + ts[m.end(3):]
    open(ts_path, "w", encoding="utf-8").write(ts)
    print("keys →", len(keys), "张：", ", ".join(keys))

if __name__ == "__main__":
    main()
