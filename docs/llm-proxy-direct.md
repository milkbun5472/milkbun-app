# 密钥保险柜直连版（绕开 Kong）· 安装单

> 起因（2026-08-24）：她翻大肘子的账单发现「扣了费的也算失败」——
> gemini-3.1-pro-preview 服务端跑了 **1m8s**、标着「非流」、$0.023 照扣，
> 而手机 **60 秒**就判死，什么都没拿到。
>
> 两层病叠在一起：
> 1. 自建 Supabase 的 **Kong** 网关 `proxy_read_timeout` 默认就是 60 秒；
> 2. Edge Function 里写着 `new Response(await r.text(), …)`——上游响应要**整个读完**
>    才往回发，所以中转就算在推 SSE，手机那 68 秒里也是零字节。
>
> 这份直连版把中间两层都拿掉：手机 → VPS 上的 Node 服务 → 中转，字节一段到一段发。
> 改配置只要 `systemctl restart`，不用重贴函数。
>
> ⚠️本文件不含任何密钥。密钥只住 VPS 上的 `env` 文件（600 权限，不进 git）。

## 为什么可以不要 Supabase 那层

原来那层的价值只有一个：**验明是本人**（`user.id === OWNER_UID`）。
直连版用两道门禁替代，强度不低于它：

1. **tailnet**：VPS 是 `*.ts.net`，只有你 tailnet 里的设备解析得到、连得上，公网根本够不着。
2. **`x-proxy-secret`**：同一 tailnet 里的其它设备也得对上口令才放行。

域名白名单（`ROUTES[ref].hosts`）原样保留——这才是防钥匙外流的那道，任何时候都不能删。

## 装

```bash
ssh yanqiu-vps
mkdir -p ~/services/llm-proxy/logs
# 把仓库里这两个文件拷过去
#   tools/vps/llm-proxy.mjs      -> ~/services/llm-proxy/llm-proxy.mjs
#   tools/vps/llm-proxy.service  -> /etc/systemd/system/llm-proxy.service
```

密钥文件（**不进 git**）：

```bash
cat > ~/services/llm-proxy/env <<'EOF'
LLM_PROXY_SECRET=随便一串长口令
LLM_PROXY_ORIGIN=https://milkbun5472.github.io
KEY_DZZI=大肘子的 key
KEY_ANTHROPIC=…（要用才填）
KEY_SILICONFLOW=…（要用才填）
EOF
chmod 600 ~/services/llm-proxy/env
```

起：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now llm-proxy
curl -s http://127.0.0.1:8791/health     # 应回 {"ok":true,"routes":[...]}
```

## 手机上配

设置 → API → 那条线路里：

| 栏 | 填什么 |
|---|---|
| 云端代理 | 照旧填引用名，如 `DZZI` |
| **保险柜直连** | `https://yanqiu-vps.tail542792.ts.net:8791/` |
| **直连口令** | 上面 `LLM_PROXY_SECRET` 那一串 |

后两栏是**全局**的，填一次所有走云端代理的线路都改道；留空就还走原来的 Kong 那条路。
手机要在 tailnet 里（Tailscale 开着）才连得到。

## 验

试写台跑一次 1500 字。成了的话：

- 不再有「60 秒整挂掉」；
- 中转账单里那笔会从「非流」变成流式；
- 失败卡片上不会再出现「这条线路发不出流式」的红框。

## 回退

手机上把「保险柜直连」清空即可，立刻退回 Edge Function 那条路，不用改服务端。

## 两边保持一致

`ROUTES` 表在两处各有一份（Edge Function 和这个服务）。加中转站时**两边都要加**，
否则从直连改回退时会 `unknown ref`。
