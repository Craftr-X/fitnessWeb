# 2026-08-10 修复：防抖窗口内的改动会被远端旧数据覆盖（数据丢失）

## 一、现象

`useCloudStorage` 的持久化链路：变更先写 localStorage 缓存，**防抖 800ms** 后才 upsert 到
Supabase；而下次启动时**远端数据无条件覆盖本地缓存**（`setState((prev) => ({ ...prev, ...remote }))`）。

由此产生一个真实的丢数据窗口：用户打完卡立刻关掉浏览器（或断网、保存失败），这次改动只存在
本机缓存里；下次打开时远端旧数据把缓存冲掉，改动无声消失。

## 二、方案：未同步标记（dirty flag）+ 启动重推

不引入时间戳比较（多设备时钟偏移不可靠），改用本地脏标记：

- `fitup:u:{userId}:dirty`：每次变更在调度防抖保存**之前**置位；保存成功才清除
- 清除时校验 `stateRef.current === snapshot`：保存期间又有新变更的，旧保存不得清标记，
  由新一轮防抖保存负责，或由下次启动重推
- 启动加载：检测到脏标记且缓存存在 → **跳过远端拉取**，以本地缓存为准，ready 后由持久化
  effect 自动重推并清标记
- `flush()`（退出登录前调用）同样在成功后清标记

副作用收益：断网期间的保存失败不再丢数据——标记留着，恢复联网后下次启动自动补推。

## 三、已知边界

整文档 last-write-wins 的固有限制不变：本机有未同步改动时若另一台设备也写了云端，
本机重推会覆盖对方的写入。要彻底解决需引入字段级合并或 Realtime，超出本次范围。

## 四、改动与测试

- `app/src/lib/store.ts`：新增 `cloudDirtyKey / isCloudDirty / markCloudDirty / clearCloudDirty`，
  加载/持久化/flush 三处接入
- `app/src/test/useCloudStorage.test.ts`（新增 7 个用例）：脏标记重推、无标记远端覆盖（旧行为锁定）、
  保存失败留标记、在途保存竞态、flush 清标记
- 验证：`npm run test` / `lint` / `build` 全绿
