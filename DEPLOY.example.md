# FitUp 部署配置文档

> **当前状态（2026-08-07 更新）**：已上线，生产地址 https://craftr-x.github.io/fitnessWeb/ 可正常访问，
> 推送到 `main` 自动部署。以下「切换 Public」步骤仅作历史记录保留。
>
> ⚠️ 密钥（Supabase / Resend / Access Token）统一存于云端文档，不落在仓库和本地文档中；本地部署步骤见 `DEPLOY.md`（已加入 .gitignore，不会提交到 Git）。

---

## 一、仓库切换为 Public

1. 打开 https://github.com/Craftr-X/fitnessWeb/settings
2. 滚动到最底部 **Danger Zone**
3. 点击 **Change repository visibility**
4. 选择 **Public** → 确认

切换完成后，继续下面的步骤。

---

## 二、启用 GitHub Pages

1. 打开 https://github.com/Craftr-X/fitnessWeb/settings/pages
2. **Build and deployment → Source** 选择 **GitHub Actions**
3. 保存

启用后，下次 `push` 到 `main` 会自动触发部署。

---

## 三、GitHub Secrets 配置

CI 部署需要以下两个环境变量（在 GitHub Secrets 中配置）：

| Secret 名称 | 说明 | 获取位置 |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase 项目地址 | Supabase Dashboard → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase 公开密钥 | Supabase Dashboard → Project Settings → API → anon public |

> 管理地址：https://github.com/Craftr-X/fitnessWeb/settings/secrets/actions

---

## 四、本地开发环境

创建 `app/.env.local` 文件（已加入 .gitignore）：

```env
VITE_SUPABASE_URL=<你的 Supabase Project URL>
VITE_SUPABASE_ANON_KEY=<你的 Supabase Anon Key>
```

启动命令：

```bash
cd app
npm install
npm run dev    # http://localhost:3000
```

---

## 五、Supabase 认证配置

### 5.1 自定义 SMTP

> **为什么必须配 SMTP**：Supabase 自 2024-09 起变更默认邮件服务策略，未配置自定义 SMTP 的项目，验证码邮件只投递给组织成员邮箱，其余地址一律拒发（表现：新用户注册收不到验证码）。详见 `docs/2026-08-06-otp-email-delivery-issue.md`。

在 Supabase Dashboard → Authentication → Email Templates/SMTP Settings 配置。有两种方案：

#### 方案 A：163 邮箱 SMTP（推荐起步，零成本、无需域名）

注册一个 163 邮箱，在「设置 → POP3/SMTP/IMAP」开通 IMAP/SMTP 服务，获得**授权码**（非登录密码），然后配置：

| 字段 | 值 |
|------|------|
| Host | `smtp.163.com` |
| Port | `465` |
| Username | 完整 163 邮箱地址 |
| Password | 163 授权码（非登录密码） |
| Sender Name | `FitUp` |
| Sender Email | 同 Username 的 163 邮箱地址 |

> ⚠️ 已知短板：新注册的 163 账号往 QQ 邮箱发信可能触发 554 DT:SPM 反垃圾拦截。如影响注册体验，切换到方案 B。

#### 方案 B：Resend（正式方案，需自有域名）

需注册 Resend（https://resend.com）并绑定已验证的自有域名（免费档 3,000 封/月，验证码量级足够）：

| 字段 | 值 |
|------|------|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | `<你的 Resend API Key>` |
| Sender Name | `FitUp` |
| Sender Email | `noreply@mail.<你的域名>`（Resend 验证过的域名） |

### 5.2 邮件模板（OTP 6 位验证码）

Supabase Dashboard → Authentication → Email Templates → **Magic Link**：

**Subject：**

```
FitUp 登录验证码：{{ .Token }}
```

**Body：**

```html
<h2>FitUp 登录验证码</h2>
<p>你的验证码是：<strong style="font-size:24px;letter-spacing:4px;">{{ .Token }}</strong></p>
<p>验证码 1 小时内有效，请勿泄露给他人。</p>
<p style="color:#888;font-size:12px;">如果你没有请求此验证码，请忽略此邮件。</p>
```

### 5.3 OTP 配置

| 配置项 | 值 |
|--------|------|
| OTP 长度 | `6` 位 |
| OTP 有效期 | `3600` 秒（60 分钟） |
| 自动创建用户 | `shouldCreateUser: true` |

---

## 六、一键切换 Public 部署清单

- [ ] 1. 仓库改 Public：Settings → Change visibility → Public
- [ ] 2. 启用 Pages：Settings → Pages → Source 选 **GitHub Actions**
- [ ] 3. 确认 Secrets 存在：Settings → Secrets → `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
- [ ] 4. 触发部署：`git push` 到 main 或手动 workflow_dispatch
- [ ] 5. 验证访问：https://craftr-x.github.io/fitnessWeb/
