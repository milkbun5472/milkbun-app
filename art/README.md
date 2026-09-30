# art/ 只留脚本和小文件

大的美术源文件（.blend、原始 GLB、整套换装导出、incoming 里的参考图，约 1.8 GB）
2026-09-30 挪到了 **`art-source` 分支**——app 一个都不读，可网页发布每次都要整份搬一遍，
发版从半分钟拖到了四五分钟。

要用：`git fetch origin art-source && git checkout origin/art-source -- art/<路径>`
⚠️别再把大文件提交回 main（.gitignore 挡了常见的几种后缀）。做完的成品该进 app 的，放到 assets/。
