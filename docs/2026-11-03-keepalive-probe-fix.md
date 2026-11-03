# 2026-11-03 修复记录：Supabase 保活 workflow 的两次 401 误判

保活任务加了两版才真正跑通：第一版挂在 `/auth/v1/health`，第二版换成 `/rest/v1/` 根路径，
两者对 publishable key 都返回 **401**，只是报错文案不同——等于换个地方继续红。

> 踩坑速查：Supabase 探针返回 401 ≠ 项目挂了。401 先看「请求有没有带 apikey」「这个路径放不放行 publishable key」，
> 再谈项目是否被暂停（暂停的特征是 DNS 解析失败 / 请求根本发不出去）。

---

## 一、现象

| 时间（北京） | 事件 |
|---|---|
| 11-02 白天 | 线上登录报 `Failed to fetch`；排查为 Supabase 免费版项目连续 7 天无 API 活动被自动暂停，手动 Resume 恢复（PR #38） |
| 11-02 23:14 | PR #38 合并，新增 `.github/workflows/keepalive.yml`，每天 UTC 01:00 打一次 API |
| 11-02 23:16 | 首跑失败（[run 41469922566](https://github.com/Craftr-X/fitnessWeb/actions/runs/41469922566)，`fb36dc7`）：`/auth/v1/health` 在 270ms 内退出 |
| 11-02 23:25 | PR #39 合并：判断 secret 尾部有空白，做 `tr -d '[:space:]'`，并把主判据换成 `/rest/v1/`、health 降级为告警 |
| 11-02 23:25 之后 | **该版本一次都没运行过**，PR #39 的「合并后手动跑一次」验证项始终未勾选 |

---

## 二、根因：两个 401，都不是「项目挂了」

用与 workflow 等价的 Kong 认证方式（`apikey`）直接探测线上项目：

| 探测 | 不带 key | 带 `sb_publishable_...`（anon key） |
|---|---|---|
| `/auth/v1/health` | 401 `No API key found` | **200**（GoTrue v2.197.0） |
| `/auth/v1/settings` | — | 200 |
| `/rest/v1/`（OpenAPI 根路径） | 401 | **401 `Secret API key required`** |
| `/rest/v1/user_data?select=user_id&limit=1` | — | **200**（RLS 过滤成 `[]`） |
| `/rest/v1/profiles?...` | — | 404 `PGRST205`（表名不存在，说明鉴权已通过） |

结论：

1. **首跑的真凶是 health 端点要求 apikey**，`curl -sf` 遇到 401 立即失败，270ms 特征完全吻合。
   尾部空白裁剪是无害的防御性改动，但治的是想象中的病（浏览器/Vite 容忍尾部空白这一点成立，只是与本次失败无关）。
2. **第二版依然会红**：`/rest/v1/` 根路径只放行 secret key，publishable key 一律 401，
   而代码只接受 `200`/`404` → `exit 1`。改完之后红叉照旧，只是错误信息从 health 换成了 REST。

---

## 三、修复

主判据改成「带 apikey 查真实业务表」：

```bash
curl ... -H "apikey: $SUPABASE_ANON_KEY" \
  "$SUPABASE_URL/rest/v1/user_data?select=user_id&limit=1"
```

- RLS 把匿名查询过滤成空数组 → **200**，一次请求走完 Kong → PostgREST → Postgres，
  既是链路体检，也是保活真正需要的「真实 API 活动」（比 health 更贴近暂停判定所看的口径）
- 按状态码分流指引：`401` 指 apikey 失效/填错；`000` 指 DNS/网络失败、大概率已被暂停；
  其他 → 后端异常，去 Dashboard 确认
- `/auth/v1/health` **带 apikey** 后降级为诊断告警（200 打印 ✅，否则 `::warning::`）
- 去掉了「不带 key 请求 health」「拿 publishable key 打 `/rest/v1/` 根路径」这两条错误路径

---

## 四、验证

分支 `fix/keepalive-probe-apikey` push 后手动 dispatch：

- [run 41574110735](https://github.com/Craftr-X/fitnessWeb/actions/runs/41574110735) — **success**（11-03 11:45 北京，全程约 7 秒）
- 运行日志：
  - `✅ REST 链路正常（HTTP 200，/rest/v1/user_data）——今日活动量已计入，项目不会被自动暂停`
  - `✅ /auth/v1/health 正常（HTTP 200）`

另注：`echo "目标端点: ..."` 那行在 Actions 里会被掩码成 `***`（主机是 secret 值的子串），仅供本地调试用，
不影响判定。

---

## 五、教训

- **探针要挑「会返回 200 的鉴权路径」**，不要拿根路径/无 key 请求当健康检查，否则 401 会被误读成宕机。
- 判断「项目是不是被暂停」，看的是**请求能不能发出去**（000/DNS 失败），不是随便一个非 2xx。
- 改了 CI/workflow，**合并前先 `workflow_dispatch` 手动跑一次**，别把验证留给第二天的定时任务。
- 定时任务的绿色 ✅ 本身就是监控：长期没有运行记录，说明 schedule 没被 GitHub 触发，同样要查。
