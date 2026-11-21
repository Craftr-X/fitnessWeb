# 待办 / 下一步

> 新会话接续方式：打开本文件即可。或对 ZCode 说「看下 TODO」/「继续 TODO 里的事」。

---

## 🟢 本轮已完成（2026-11-21）

### 产品改进收尾（原未提交 WIP）

- [x] 反馈完成度按打卡自动计算；草稿跨 Tab 保留
- [x] 休息日不计入完成度；作战卡「达标周数」按 ≥80% 统计
- [x] Onboarding：新用户「先看计划」预览后再开始
- [x] 今日训练可顺延到下一休息日（`skippedDays`）
- [x] 抽出 `calcWeekProgress` / `rescheduleTrainingDay` 等纯函数并补单测

### 引擎边界 / 文档

- [x] `hasSport` 时力量日上限 5，保留周六运动 + 周日复盘（不再挤占复盘日）
- [x] `DEFAULT_PROFILE` 复核：仅保留 `name` + 必填 `heightCm`，无其它老模板残留
- [x] README 补齐近期功能（蜕变报告 / 训记重量 / 示范 / 软迁移 / 顺延等），测试数 → 199

---

## 🟡 后续 backlog（低优）

- [ ] onboarding 判定逻辑补单测（`needsOnboarding` / `hasUsageTrace` 已有部分覆盖，可再补 Home 分支场景）
- [ ] 废弃老字段 `badmintonHours`（与 `sport` / `sportHours` 语义重叠）
- [ ] goal 步 UX：步骤边界可再划分（目前「主要目标」单项偏薄）
- [ ] （可选）自有域名 + Resend 替换 163 SMTP，见 `docs/2026-08-06-otp-email-delivery-issue.md`

---

## 历史 / 已完成

- 2026-08-16 总览「我的蜕变」报告 + 海报下载（#34）
- 2026-08-11 删老模板死代码，规则引擎成为唯一计划入口
- 2026-08-10 老用户软迁移 + 训记式重量记录（#27/#28/#29）
- 2026-08-10 cloudDirty 脏标记重推：防抖窗口内改动不再被远端旧数据覆盖
