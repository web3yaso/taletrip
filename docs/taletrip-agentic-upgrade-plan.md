# TaleTrip · Agentic 升级设计与冲刺计划

> 2026-06-11 定稿。覆盖：评审标准审计 → Agentic 故事生成（tool calling）→ iPad 本地 RAG →
> MedPsy 时差贴士 + Bedtime 模式 → Artifact Quality 策略 → 排期与回退。

---

## 1. 评审标准审计

### 强制要求

| 要求 | 状态 | 行动 |
|---|---|---|
| QVAC SDK 做**所有** AI 推理 | ✅ 100%（LLM/SDXL/TTS/VLM/翻译全走 SDK，无 CoreML/OpenAI/diffusers 旁路） | 维持 |
| **+ RAG** | ⚠️ 缺口 | §3 iPad 本地 RAG（D3.5） |
| 赛道约束（Mobile） | ✅ iPad 2018 消费级 + Mac 经 P2P 卸载重活 | README 讲透 |
| 可复现说明 + 硬件设置 | ❌ | D6：clone→iPad 跑通的每一步 |
| 完整 artifacts（日志/视频/硬件证明） | ❌ | §6 黄金一跑策略（D4 起） |

### 核心评分项 → 我们的得分点

| 评分项 | 得分点 |
|---|---|
| Early Bird（<6/17） | 6/16 提交，死守 |
| Innovation | P2P 收书 + QR 配对 + 全端上管线 + Photo Story |
| **Capabilities（多智能体/编排/tool calling）** | §2 Agentic 故事生成（本计划核心） |
| Artifact Quality | §6 黄金一跑 + 结构化运行日志 |
| Performance | 实测数据：TTS RTF 0.30 / VLM 2.6s / Hunt 端到端 5s / LLM ~7s页 / 4GB 内存编排 |
| Complexity & UX | 双语阅读+点词+Hunt+Photo Story+书架+Bedtime |
| **Psy 模型** | §4 MedPsy 时差睡眠贴士 |
| Build in Public | 推文系列（已 2 条）+ D6 收官 + 评审期 Discord/Keet 拉票 |

---

## 2. Agentic 故事生成（Mac Studio）

### 2.1 架构：编排 agent + 能力工具箱

把「生成故事」从被调用的函数翻转为 **agent 驱动的工作流**：

```
🤖 Orchestrator（Qwen3 4B，Mac，QVAC completion + tools）
   输入："Barcelona / Sofia / 5 页 / 喜欢恐龙"
   工具箱：
   ├─ parse_request(text)            自由文本 → 结构化参数（json_schema）
   ├─ lookup_facts(dest, topic)      RAG 检索目的地知识（§3 知识库）
   ├─ write_page(scene, facts)       委托 1B 写作 agent（agent-as-tool）
   ├─ paint_illustration(prompt)     SDXL 插画 agent
   ├─ choose_hunt_targets(story)     从故事内容挑可找的寻宝目标（替换写死的 tree/tower/boat）
   ├─ health_tips(dest, age, tzDiff) MedPsy：时差>3h 才调用（agent 判断）
   └─ publish_to_kid(packId)         P2P seed + 配对码 —— 工具调用作用于物理网络
```

一条 agent 轨迹同时展示：**编排、tool calling、RAG、Psy 模型、P2P** —— 评分项五连。

### 2.2 可靠性设计：混合制（关键）

20 步全自由 agent loop 在 4B 模型上必脱轨。采用：

1. **规划一次**：orchestrator 用 `responseFormat: json_schema` 输出场景清单（GBNF 约束，不跑偏）
2. **页循环由 JS 钉死**（每页必产出、顺序保证）
3. **页内工具调用 agent 自主**：查不查事实、查什么主题、插画给什么 prompt
4. **护栏**：每步 schema 校验 + 步数上限 + **整级回退**——agent 脱轨自动退回现有确定性管线（已验证，一行 flag 切换）

### 2.3 SDK 依据

`completion` 支持 `tools`（Zod schema）、`toolDialect`（qwen35/hermes/pythonic）、
`responseFormat: json_schema`（GBNF）、MCP 客户端。注册表现成 `QWEN3_4B_INST_Q4_K_M`。

### 2.4 明确不做成工具的（防 tool-washing）

- TTS / playPcm：纯执行无决策
- iPad 侧整套（caption/检索/写页）：1B 跑 agent loop 不可靠 → 保持 JS 编排 + json_schema 结构化输出，叙述为"轻型 worker agents"
- receivePack 收书：用户手势触发，不该由模型决定

### 2.5 iPad 侧配套（B 档）

Photo Story 写作改 `json_schema` 输出 `{narration, vocabWords[], mood}`——
与 tool calling 同一套 GBNF 机器，对 1B 远比自由 tool call 可靠，顺手消灭按行切割的脆弱解析。

---

## 3. iPad 本地 RAG（强制项 + 隐私叙事）

### 3.1 内容

- **家庭画像**：孩子名字/年龄/性别/爱好。家长填一次（Parents 锁入口 → 表单），存 documents，**永不出设备**
- **目的地知识**：儿童友好的城市常识（地标/食物/习俗），随 StoryPack 携带或内置；当前书 = 当前旅行

### 3.2 技术

```
嵌入：EMBEDDINGGEMMA_300M_Q4（注册表现成，~300MB，QVAC embed()）
检索：JS 余弦 top-k（语料 <200 条，暴力余弦完胜向量库，零新依赖）
缓存：语料嵌入预计算，画像/知识变更才重算；生成时只嵌入查询
内存编排（4GB 红线，全部串行换乘）：
  VLM 看图 → [卸 VLM，载 EmbedGemma ~1s] 检索 top-2/页
           → [卸 Embed，载 LLM] 带检索结果写页
```

### 3.3 受益方

- **Photo Story**（iPad 生成）：从泛泛 "we" 句子 → "5 岁的 Sofia 最喜欢的恐龙…在兰布拉大道…"
- **Mac 故事生成**：`lookup_facts` 工具复用同一套知识库（agentic RAG）

### 3.4 叙事

"家庭隐私数据作为 RAG 知识库，**在设备上检索、在设备上生成、永不上传**" —— 正中 QVAC 本地优先伦理。

---

## 4. MedPsy（Psy 模型创意使用）+ Bedtime 模式

### 4.1 MedPsy 时差睡眠贴士

- 用在本行（儿科睡眠/时差 = 医疗 QA），场景有创意（亲子旅行）
- 形态：`health_tips(dest, age, tzDiff)` 工具，**orchestrator 判断时差>3h 才调用**
- 生成内容随 StoryPack 下发；iPad 只展示+TTS 念（零内存新风险）
- ⚠️ SDK 0.12.1 注册表无 Psy 常量 → 需 HF 下载 GGUF + `loadModel` 本地路径（30min spike 定生死）

### 4.2 Bedtime 模式（iPad）

```
入口：Home 顶栏 🌙
├─ 开场：今晚的睡觉提示（MedPsy 生成）+ TTS 轻声念
├─ 主体：相册式慢速幻灯片循环
│   素材 = 孩子拍的照片(kidphotos) + 当前书插图
│   8 秒/张 交叉淡入淡出，整屏压暗+暖色调
├─ 白噪声循环（JS 合成粉噪 WAV + loop，无需素材）
└─ 🔒 锁定：NativeTabs hidden 隐藏 tab 栏（原生级），家长长按 3 秒退出
```

全部素材/能力已在手：照片库✓ 插图✓ playPcm✓ Animated 淡入淡出✓ tab 隐藏 API✓。

---

## 5. Artifact Quality 策略

### 5.0 证据记录子系统（Evidence Logger，内建功能）

比赛要求 full evidence bundle for the 3-stage verification process → 日志必须**内建自动**，
不靠彩排手动攒。

- **统一 JSONL 事件**（两端同 schema）：ts / device / run 分组 / op(completion·tts·diffusion·embed·loadModel·downloadAsset) / 模型身份(名称·量化·大小) / durMs / 输出摘要 —— 证明每次推理由 QVAC SDK 在该设备完成
- **单咽喉点插桩**：iPad 所有推理经 `src/models/qvac.ts` re-export —— 在这一个文件包一层日志，全 app 自动入档（`documents/evidence/<date>-<run>.jsonl`），业务代码零改动；Mac 为 `studio/evidence.mjs` 落 `artifacts/runs/`（与 agent 轨迹日志合一）
- **iPad 导出**：app.json 加 `UIFileSharingEnabled` + `LSSupportsOpeningDocumentsInPlace` → Mac Finder 直接拖出（零 UI，下次重建生效）
- **run 分组**：生成书 / 收书 / Photo Story / Hunt 一轮 / 朗读会话各为一个 run

### 核心：「黄金一跑」(Golden Run)

D4 彩排时正式跑一遍全流程，**这一跑同时产出全部 artifacts**——日志、性能数字、
视频素材、截图来自同一次运行 → 评委交叉验证全对得上。

### 建设清单

1. **Studio 结构化运行日志**（随 agentic 一起做，agent 轨迹本来要打日志）：
   ```
   artifacts/runs/<时间戳>-<packId>/
   ├─ run.json    请求参数、模型清单(名称/参数量/量化/大小)、
   │              每阶段耗时、输出清单+校验和
   └─ agent.log   带时间戳的 agent 轨迹（= tool calling 证据，一鱼两吃）
   ```
2. **模型覆盖清单** `artifacts/models.json`：每个模型的名称/参数量/量化/大小/SHA/所在设备，从 SDK 注册表自动生成（同时喂 Model Coverage 评分项）
3. **iPad 日志**：彩排时 Metro console 按场景存档（receive/reader/hunt/photostory），SDK 启动 banner 自带设备型号 = 硬件证明一部分
4. **demo-script.md 先于视频**：彩排脚本 = 拍摄脚本 = README 功能导览，三处同源
5. **硬件证明包** `artifacts/hardware/`：iPad 设置页截图、Mac 关于本机、设备同框照

---

## 6. 排期（更新版）

| 天 | 内容 |
|---|---|
| **D3.5 (6/12)** | Agentic 故事生成（orchestrator + 4 核心工具 + 混合制 + 回退）；RAG 知识库（lookup_facts 工具 + iPad 画像检索）；运行日志/模型清单基建；embed() RN spike；MedPsy 加载 spike |
| **D4 (6/13)** | 上午：MedPsy 接入 + Bedtime 模式 + 便宜工具（publish_to_kid/choose_hunt_targets/parse_request 视余量）；下午：**黄金一跑彩排 ×3** + 日志/硬件证明采集 + demo-script.md；**晚冻结** |
| **D5 (6/14)** | demo 视频（照 demo-script 拍，数字与黄金跑一致） |
| **D6 (6/15)** | 可复现 README + 架构图（分布式 agent 叙事）+ 基准表 + artifacts 打包 + 收官推文 |
| **D7 (6/16)** | ⚠️ 重签名 iPad（7 天过期）→ 终检 → **提交（Early Bird）** |
| 评审期 | Discord/Keet 社区投票互动 |

## 7. 风险与回退

| 风险 | 概率 | 回退 |
|---|---|---|
| Qwen3 4B tool calling 脱轨 | 中 | 混合制护栏；整级回退确定性管线（已验证） |
| `embed()` 在 RN worker 不通 | 低中 | RAG 退 Mac 端（合规等价，丢"边缘 RAG"卖点） |
| MedPsy GGUF 本地加载不通 | 中 | 贴士用 Qwen3 顶（功能在，丢 Psy 加分） |
| 排期溢出 | 中 | 砍单顺序：parse_request → choose_hunt_targets → Bedtime 幻灯片简化为静态；**绝不动 D4 晚冻结与 6/16 提交** |
| 签名 7 天过期炸 demo | 确定会发生 | D7 第一件事重签 |
