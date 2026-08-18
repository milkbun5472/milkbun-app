# Lisa Cloud（精简 Supabase 兼容栈）

只运行 Lisa-phone 实际需要的 PostgreSQL、GoTrue、PostgREST、Storage 和 Nginx。
不运行 Studio、Realtime、Analytics、imgproxy、Supavisor 或 Edge Runtime。

## 安全边界

- `.env`、数据库目录、Storage 正文和生产快照只留 VPS，禁止进 Git。
- 对公网只通过 Tailscale Funnel 的独立 `8443` 端口开放 gateway。
- PostgreSQL 不映射宿主机端口；gateway 只监听 `127.0.0.1:8800`。
- 迁移先全量快照和逐表核对，再影子同步；切换前不关闭旧 Supabase。

## 目录

- `compose.yml`：精简服务编排。
- `nginx.conf`：`/auth/v1`、`/rest/v1`、`/storage/v1` 兼容入口。
- `schema-core.sql`：旧项目中未被独立 SQL 文件覆盖的核心表。
- `import-snapshot.mjs`：从私有 gzip JSONL 快照导入并核对。
