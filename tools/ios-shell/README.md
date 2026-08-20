# 小手机原生壳（7 天免费签名版）

一个极简 WKWebView 壳，把 GitHub Pages 上的正式站
`https://milkbun5472.github.io/milkbun-app/index.html` 装进一个真正的 iOS App：
自己的图标、自己的进程、独立于 Safari 的存储（localStorage/IndexedDB 不和网页版共用，
云同步登录一次即可接上同一份存档）。

## 首次安装（需要 Lisa 的手，约 10 分钟）

1. 打开工程：双击 `LisaPhone/LisaPhone.xcodeproj`。
2. Xcode → Settings → Accounts → `+` 登录你的 Apple ID（免费账号即可，不用付 $99）。
3. 左侧点蓝色工程图标 → TARGETS `LisaPhone` → Signing & Capabilities：
   - 勾 `Automatically manage signing`
   - Team 选你的 Apple ID（Personal Team）
   - Bundle Identifier 若报红（被占用），把 `com.lisa.xiaoshouji` 改成任意独有的，如 `com.lisa.xiaoshouji2`。
4. 数据线插 iPhone（或同一 Wi-Fi 已配对），顶部设备选你的 iPhone，按 ▶ Run。
5. 第一次手机上会拦：设置 → 通用 → VPN与设备管理 → 信任你的开发者证书。
6. iPhone 需开开发者模式：设置 → 隐私与安全性 → 开发者模式 → 开 → 重启手机。

## 每 7 天续签（免费账号的规矩）

签名 7 天过期，过期后图标还在但点开闪退。续法只有一步：
**插上手机，打开这个工程，按一次 ▶ Run。** 完事。
（不用改任何代码；日历上排个每周提醒最省心。）

## 说清楚的边界

- **能得到**：全屏无 Safari 边框、独立图标进程、锁屏推送仍走站内已有的 Web Push、
  Mac Safari 可远程调试（开发→你的 iPhone→小手机）。
- **得不到**：免费签名没有真后台常驻（那需要付费账号+特殊权限）；「保活」的实际收益是
  App 切后台后系统对原生壳比对 Safari 标签页宽容得多，回来基本不重载。
- 站点更新不用重装壳：壳只是浏览器，刷新即最新版。
