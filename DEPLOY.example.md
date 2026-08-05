# FitUp 部署配置文档

> **当前状态**：仓库为 Private，GitHub Pages 不可用，仅能通过本地 `npm run dev` 访问。
>
> **当仓库切换为 Public 后**，按照本文档操作即可启用 Pages 自动部署。
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

### 5.1 自定义 SMTP（Resend）

需注册 Resend（https://resend.com）获取 API Key，然后在 Supabase Dashboard → Authentication → Email → SMTP Settings 配置：

| 字段 | 值 |
|------|------|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | `<你的 Resend API Key>` |
| Sender Name | `FitUp` |
| Sender Email | `onboarding@resend.dev`（测试域名）或你自己的域名 |

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
<p>验证码 10 分钟内有效，请勿泄露给他人。</p>
<p style="color:#888;font-size:12px;">如果你没有请求此验证码，请忽略此邮件。</p>
```

### 5.3 OTP 配置

| 配置项 | 值 |
|--------|------|
| OTP 长度 | `6` 位 |
| OTP 有效期 | `3600` 秒（10 分钟） |
| 自动创建用户 | `shouldCreateUser: true` |

---

## 六、一键切换 Public 部署清单

- [ ] 1. 仓库改 Public：Settings → Change visibility → Public
- [ ] 2. 启用 Pages：Settings → Pages → Source 选 **GitHub Actions**
- [ ] 3. 确认 Secrets 存在：Settings → Secrets → `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
- [ ] 4. 触发部署：`git push` 到 main 或手动 workflow_dispatch
- [ ] 5. 验证访问：https://craftr-x.github.io/fitnessWeb/
