# 2026-08-06 排查记录：新用户注册收不到验证码

新邮箱注册时「发送验证码」报 `unexpected_failure: Error sending magic link email`（500），
但老邮箱一切正常。最终定位为 **Supabase 默认邮件服务策略限制**，与代码无关。

> 踩坑速查：凡是「新用户发码失败、老用户正常」，先查 Supabase 邮件服务策略，不要先怀疑 trigger / 模板 / 代码。

---

## 一、现象

- 新邮箱注册：POST `/auth/v1/otp` 返回 **500 Internal Server Error**
  `{"code":"unexpected_failure","message":"Error sending magic link email"}`
- 老邮箱（组织成员）：收发验证码**完全正常**
- 矛盾点：Supabase 数据库 `auth.users` 表里**能看到那个新邮箱的用户记录**（说明建号成功了）

---

## 二、排查过程（走过的弯路）

按顺序排除了以下方向，均排除后才找到真因。记录在此避免下次重复：

| # | 假设 | 结论 | 验证方式 |
|---|------|------|---------|
| 1 | 本地代码改动导致 | ❌ 无关 | 待提交的 4 个文件全是 onboarding 画像校验/UI 文案，与登录无关 |
| 2 | 登录链路代码有问题 | ❌ 无关 | `app/src/hooks/useAuth.ts:36-46` 标准 `signInWithOtp({shouldCreateUser:true})`，新老用户走同一段 |
| 3 | `auth.users` 上有坏 trigger | ❌ 无 trigger | 查 `pg_trigger`：`auth.users` 上无任何自定义 trigger；无 `handle_new_user` 函数 |
| 4 | 数据库约束/权限阻止建号 | ❌ 不是 | Dashboard 手动 Add User 能成功，DB 里有记录 |
| 5 | 邮件模板变量写错 | ❌ 不是 | 模板正常 |
| 6 | **Supabase 默认邮件服务限制** | ✅ **真因** | 见根因 |

> 教训：第 1 步就该去查 Supabase 官方关于「默认邮件服务策略变更」的公告（2024-09 起），
> 而不是在数据库层和模板层打转。

---

## 三、根因

**Supabase 默认邮件服务的投递限制**（自 2024 年 9 月起的策略变更）：

> 未配置自定义 SMTP 的项目，验证码/魔法链接邮件**只投递给 Supabase 组织团队成员的邮箱**，
> 其余地址一律拒发。

两个看似矛盾的现象由此解释：

- **DB 有新用户记录**：`signInWithOtp` 是「先建用户、再发邮件」。建号成功了，发邮件才被策略拒绝 → 用户已落库，但邮件没发出 → 500 回滚（用户实际未激活）。
- **老用户正常**：测试邮箱是组织成员邮箱，在放行名单里。

---

## 四、解决方案：配置自定义 SMTP

用自定义 SMTP 绕过默认邮件服务的限制。

### 选型：Resend

- Supabase 侧配置免费
- Resend 免费档 **3,000 封/月**，验证码量级足够（0 成本）
- 已创建 API Key

### 卡点：Resend 要求绑定自有域名

Resend 发信必须用已验证的自有域名，不能用它自带的。需要先有一个域名。

**域名购买建议**（海外注册商，免实名免备案）：

| 注册商 | 说明 |
|--------|------|
| Porkbun | 价格低，DNS 管理简洁 |
| Cloudflare Registrar | 成本价，稳定性好 |
| Namecheap | 老牌，支付方便 |
| GoDaddy | 支持支付宝 |

买个便宜的 `.xyz` / `.top` 类域名即可（年费几十元）。

### 配置步骤

1. **域名到手** → Resend 添加 `mail.<你的域名>` 子域名
2. **配 DNS 记录验证** → Resend 给出的 SPF/DKIM/DMARC 记录填到域名 DNS
3. **Supabase 配 SMTP**：
   - Authentication → Settings → SMTP Settings → 开启 Custom SMTP
   - Host：`smtp.resend.com`
   - Port：`465`
   - Username：`resend`
   - Password：**Resend API Key**
   - Sender email：`noreply@mail.<你的域名>`
4. **新邮箱实测**注册发码
5. **顺手调高 Supabase 邮件频率限制**（默认约 30 封/小时，Authentication → Settings → Rate Limits）

---

## 五、附带收获：一个域名解决两件事

同一个域名还可用于 **GitHub Pages 绑定**（仓库已有现成流水线 `.github/workflows/deploy.yml`）：

- 主域名 `<你的域名>` 加 **A 记录**指向 GitHub Pages IP
- 与 Resend 的 `mail.` 子域名记录**互不冲突**
- 一个域名同时解决「发信」和「建站」两件事

`deploy.yml` 已确认：`push: branches: [main]` 触发，build 用 `app/` 目录的 `npm run build`，
产物从 `app/dist` 部署到 GitHub Pages。域名解析生效后，在仓库 Settings → Pages → Custom domain 填入域名即可。

---

## 六、待办清单

- [ ] 买域名
- [ ] Resend 添加 `mail.` 子域名 + DNS 验证
- [ ] Supabase 配置 SMTP 凭据
- [ ] 新邮箱注册实测
- [ ] 调高 Supabase 邮件频率限制
- [ ] （可选）域名同时绑 GitHub Pages
