# 西装皮鞋恢复

`restore_suit_footwear.py` 从 `v2/outfits/hunyuan-c06-shell.glb` 取回原鞋、袜口和裤脚下缘。
沿 C06 原参数居中并缩放 .69；鞋头、鞋侧、鞋底不再向素体表面投影。
只让 z>.125 的裤脚重叠区贴回当前衣服内侧，旧鞋裁到 .135，新片保留至 .15。
保留原 UV 和现有贴图，单独给鞋部 6000 面预算，独立腿绑定与六项体型。
西装上衣、口袋、袖子及裤身不重建。sourceFootwearVersion=1 保证幂等。

已接入 add_outfit 的 suit 分支。已有母版迁移：

```sh
blender -b --python-exit-code 1 --python art/fairy-garden/doll/restore_suit_footwear.py -- before.glb full.glb suit.glb
```

网页只更新 lazy suit，母版不能覆盖网页 base doll.glb。
验证脚本：scripts/checks/suit-footwear-assets.py、suit-footwear-browser.cjs。
