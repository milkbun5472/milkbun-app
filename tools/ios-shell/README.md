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

### 弹「不受信任的开发者」怎么办

> 你的设备管理设置不允许在这台 iPhone 上使用开发者
> "Apple Development: hyodorisa@gmail.com (…)" 的 App。

**设置 → 通用 → VPN与设备管理 → 「开发者App」那一栏
→ `Apple Development: hyodorisa@gmail.com` → 信任。**

（英文系统：Settings → General → VPN & Device Management → Developer App）

⚠️ 两个会卡住的地方：

- **手机必须联网。** iOS 要连 Apple 的服务器验一次证书才肯让你按「信任」。
  没网的话那一栏可能压根不出现，或者点下去转圈然后失败。
- **那一栏是空的** = 这次 Run 其实没装上去。回 Xcode 看报错，
  装成功了才会有这一条。

⚠️ 这一步**每次换了证书都要重来一遍**（比如换了 Apple ID、
改了 Bundle Identifier、或者证书过期后系统重新签了一张）。
平常只按 ▶ Run 续签是不会再弹的——弹了就说明证书换了张新的。

## 说清楚的边界

- **能得到**：全屏无 Safari 边框、独立图标进程、锁屏推送仍走站内已有的 Web Push、
  Mac Safari 可远程调试（开发→你的 iPhone→小手机）。
- **得不到**：免费签名没有真后台常驻（那需要付费账号+特殊权限）；「保活」的实际收益是
  App 切后台后系统对原生壳比对 Safari 标签页宽容得多，回来基本不重载。
- 站点更新不用重装壳：壳只是浏览器，刷新即最新版。

## 图片保险仓

壳内生成/导入的聊天自拍除了网页 IndexedDB，还会镜像到 App 自己的
`Application Support/LisaPhoneMedia/selfies`。若 iOS 清掉 WKWebView 图库，下一次
启动会自动从这里补回。普通网页/PWA 没有这层原生桥，导出备份时会自动把全部
自拍装进备份文件（不再询问是否略过）。

注意：手动删除 App 会连它的沙盒一起删除；换机或删 App 前仍要保留一份完整导出备份。
