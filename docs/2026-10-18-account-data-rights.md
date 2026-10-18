# 用户数据权利：导出与删除账号（2026-10-18）

> 对应功能：页头「菜单 → 导出我的数据 / 删除账号」。本文记录设计决策与站长侧的配套操作。

## 背景

体重 / 体脂属于健康敏感数据（个保法意义上的个人信息）。用户需要能够：

1. **可携带**：一键导出自己的全部数据（JSON 文件，含 profile / weekPlan / checks / weights / feedbacks / setLogs / activity 七个域）。
2. **可删除**：自助删除账号，数据被彻底清除，无需联系站长。

## 实现边界（简版）

前端无法删除 `auth.users` 里的账号行（`auth.admin.deleteUser()` 需要 service role 权限，
不能下发给浏览器）。因此「删除账号」的删除范围是：

| 数据 | 位置 | 删除方式 |
|---|---|---|
| 全部业务数据（健康数据） | `public.user_data` 整行 | 客户端 `delete().eq('user_id', uid)`，RLS 保证只能删自己的行 |
| 本机缓存与未同步标记 | localStorage `fitup:u:*` | `clearLocalData()` 全量移除 |
| 旧版迁移源 | localStorage `fitup:*`（6 个） | 同上 |
| 邮箱账号行 | `auth.users` | **保留**（简版边界），见下方站长清理 |

删除流程刻意「任一步失败即中止」：`flush()` → 删云端行 → 清本地 → 登出，
避免出现"云端没删干净、本地却已清空"的错位。

## 站长侧配套：清理残留的 auth.users 行

用户删号后 `auth.users` 仍会保留邮箱行（Supabase Auth 的行为）。两种清理方式：

### 方式一：定期 SQL（推荐，控制台 SQL Editor 执行）

```sql
-- 1. 删除「业务数据已删（user_data 无对应行）」的 auth 用户，即已主动删号的用户
delete from auth.users u
where not exists (select 1 from public.user_data d where d.user_id = u.id);

-- 2. 顺手清理 30 天以上从未验证邮箱的僵尸注册（防止开放注册刷库）
delete from auth.users
where email_confirmed_at is null
  and created_at < now() - interval '30 days';
```

> 执行前可先 `select` 同条件预览。`user_data.user_id` 对 `auth.users(id)` 有
> `on delete cascade` 外键，删 auth 用户不会产生孤儿业务数据。

### 方式二：Edge Function 真删（未来可选）

新建持有 service role 的 Edge Function 调 `auth.admin.deleteUser()`，删除流程最后调用。
需要维护 functions 部署与密钥，当前用户量下不必——方式一每月跑一次即可。

## 相关代码

- `app/src/lib/account.ts`：buildExportPayload / downloadExport / clearLocalData / deleteCloudRow
- `app/src/pages/Home.tsx`：菜单入口与两个确认弹窗
- `app/supabase/schema.sql`：RLS 策略（`for all using (auth.uid() = user_id)`，天然支持删自己的行）
