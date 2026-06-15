# TaleTrip · Demo Runbook（D4 彩排 ×3 + 代码冻结）

完整端到端 demo 脚本。目标：**连跑 3 遍全绿** → 计时为 D5 录制定调 → 暴露剩余 bug → 然后代码冻结。

> ⚠️ **彩排阶段（debug build）不要开飞行模式。** debug build 的 JS bundle 实时从 Mac 的 Metro（`<mac-ip>:8081`）加载，飞行模式 = 断 Metro = "No script URL provided" 启动失败。
> 彩排时 iPad 与 Mac 必须在**同一局域网**且能访问 Metro。
> **真·离线证明（飞行模式全程）只在 release build 上做**：`expo run:ios --configuration Release` 把 bundle 内嵌进 app，那时才脱离 Metro。安排在代码冻结后 / D7。
> P2P 收书本身是局域网直连，不需要公网，但 debug build 仍需 Metro 在线。

> Demo 主线对齐 5 条比赛硬指标：① QVAC SDK 全本地推理 + RAG ② Psy 模型创意用法（MedPsy 时差睡眠教练）③ multi-agent + tool-calling（Studio agentic 生成）④ evidence bundle（本地 JSONL）⑤ 全离线 / 隐私（nothing uploaded）。

---

## 0. 彩排前准备（每遍开始前）

- [ ] Mac Studio 起：`http://localhost:3000` 返回 200
- [ ] iPad 已装当前 build，**飞行模式关**，WiFi 与 Mac 同一局域网
- [ ] iPad Safari 能打开 `http://<mac-ip>:8081/status`（确认 Metro 可达）
- [ ] iPad 电量 > 50%，亮度调高（录屏可见）
- [ ] （可选）清旧数据复测：删 app 重装，或保留——`my-photo-story` 是单槽位，重生成即覆盖
- [ ] Mac 无 zombie `bare` 进程抢 registry 锁（除 Studio server 自身两个）

---

## 幕表（每幕：耗时 / 通过标准 / 故障→对策）

### Act 1 — Parent Studio 智能行程设计器（Mac，multi-agent + RAG + tool）
1. 打开 `localhost:3000`
2. 行程设计器输入一句话，例：**「下周带 Sofia 去巴塞罗那玩，她 5 岁，喜欢恐龙和画画」**
3. 点解析 → 出 destination=Barcelona / days / childName=Sofia / age=5 / likes
4. 点生成 → 看 agentic 流：🤖 planning → 🔧 lookup_facts(RAG) → ✍️ writing → 🎨 painting → 🏥 MedPsy sleep plan
5. QR + sleep plan 卡出现

- **通过**：一句话正确解析出结构化行程；agentic 4 阶段日志都出现；QR 唯一（旧的已清）
- **故障→对策**：解析空 → 检查 reasoning_budget:0 + json_schema；生成卡死 → 看是否 zombie bare 锁 registry，`pkill -9 bare` 留 server

### Act 2 — P2P 交付（iPad，pear://，无云）
6. iPad **Get a book** → 扫 QR（或粘贴 64 位 key）→ 接收进度 → 自动进 Reader

- **通过**：飞行模式下仍能收到（同局域网）；接收日志显示 `pear://`；自动开书且是**本次新生成**内容
- **故障→对策**：开的是旧书 → 确认 receive 用 stamped 文件名 + `&ts=`；收不到 → 确认 Studio seeder 在 swarm

### Act 3 — 读书（iPad，本地 TTS + 双语 + 家庭 RAG 个性化）
7. Reader：翻页 / TTS 朗读 / 点彩色词出西班牙语卡片 + 发音
8. 点 **Home**（→ 回首页，不再红屏）；翻到末页点 **Play Activities**（→ 进 Play）

- **通过**：TTS 出声；点词有西语 + 发音；**Home / Play Activities 不崩**（已修 GO_BACK）
- **故障→对策**：朗读不停 → mute store + stopPcm；图不更新 → stamped 文件名 + `&ts=`

### Act 4 — Hunt + Camera Photo Story（iPad，VLM + LLM 本地）
9. **Hunt**：听到 "Find a ___!"（TTS 说目标词）→ 找到 3 个 → Refresh 出新 3 个室内目标
10. **Camera**：拍 3 张 → **Make my story**（look→write→place→words 四阶段）→ **Read my story**

- **通过**：Hunt 说词 + 识别 ~5s + Refresh 换题；Photo Story 文案是「Today I saw…」紧扣照片物体（非目的地套话）；生成后 Read my story 正常进 Reader
- **故障→对策**：相机黑屏 → 只在 focused 时挂 CameraView；文案跑题 → 已移除 RAG、caption 锚定实物

### Act 5 — MedPsy Sleep Coach（差异化亮点）
11. 🌙 → Sleep Coach 计划卡：8 天逐日入睡时间 + MedPsy 建议（无药物）
12. ☀️ 早晨打卡（Slept well / So-so / Rough）→ 看「今晚」时间随之调整 + 绿色反馈
13. **Start wind-down** → 白噪声 + 照片/插图循环渐变 → 长按 ~2.5s 退出

- **通过**：当前书是带 sleepPlan 的 barcelona-sofia；打卡有反馈且 rough → +20min；wind-down 出声+轮播；长按可退
- **故障→对策**：看不到计划 → 当前书无 sleepPlan，重收 barcelona-sofia 使其成 current；打卡无反应 → 已加绿色反馈行 + calendar-anchored tonight()

### Act 6 — 隐私 / 离线收尾
14. 强调：整场飞行模式；nothing uploaded；evidence log 本地 JSONL（`documents/evidence/<day>.jsonl` + Mac `artifacts/runs/`）

- **通过**：全程无网；能展示 evidence 文件有 completion/diffusion/toolCall/ragSearch 记录

---

## 3 遍计时表（填这个）

| 幕 | 第 1 遍 | 第 2 遍 | 第 3 遍 | 备注 |
|---|---|---|---|---|
| Act1 Studio 生成 | | | | 目标 < ~90s |
| Act2 P2P 接收 | | | | |
| Act3 读书 | | | | |
| Act4 Hunt+Photo | | | | Photo 生成 ~? |
| Act5 Sleep Coach | | | | |
| **全程总时长** | | | | demo 目标 6–8min |
| **结果** | ⬜全绿 | ⬜全绿 | ⬜全绿 | |

3 遍任意一遍出红/卡 → 记下哪一幕 + Metro 报错 → 修 → 重置计数，重新连跑 3 遍。

---

## 彩排通过后 → 代码冻结 checklist

- [ ] 3 遍连续全绿
- [ ] `git status` 干净（CLAUDE.md 仍 ignored）
- [ ] `npx tsc --noEmit` 0 错
- [ ] 打 freeze tag：`git tag -a demo-freeze -m "..."`
- [ ] 归档一份成功 evidence run（Studio + iPad 各一）备 D6 提交材料
