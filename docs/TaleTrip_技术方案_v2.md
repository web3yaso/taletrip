# TaleTrip 技术方案 v2

**相对 v1 的变更:** ① 单界面 → **两界面**(MacBook 家长后台 + iPad 儿童端);② 新增**端侧实时翻译**(改进项 ①,1B+few-shot,已验证);③ 新增**相机视觉寻物**(SmolVLM2 500M,已验证)。
**诚实分级:** 文中用 ✅ 标已实测确认、⏳ 标待验证,后者**不得**当作已锁定。

---

## 0. 已验证事实 + 唯一红线

| 项 | 状态 |
|---|---|
| 设备 | iPad Pro 12.9" 3rd gen · A12X · **4GB** · iOS 26.3.1 |
| 栈 | @qvac/sdk 0.12.1 · Expo 56 / RN 0.85 dev-client |
| LLM(1B Q4)+ TTS(Supertonic2)同驻 4GB | ✅ 无 OOM,流水线一步成功,~12s/页余量 |
| TTS RTF | ✅ 0.30 |
| VLM 相机寻物(SmolVLM2 500M) | ✅ 加载 2.1s、单图 ~2.7s、严格 prompt 准确 |
| 点词翻译(常驻 1B + few-shot) | ✅ 译文正确,~2.3s/词,零额外模型 |
| 单个扩散模型(SD ~1.75GB)与任何模型同驻 | ❌ 撞穿 4GB(实测) |
| Qwen3VL-2B(~2.5GB)/ Bergamot 专用 NMT | ❌ 前者 OOM 硬崩、后者原生引擎崩溃(实测) |

**红线:** 运行期 iPad **只**同驻轻量模型(LLM+TTS;**翻译复用 1B、VLM 串行换入**);**大模型一次只驻一个**;**任何屏幕不得后台偷偷常驻模型**(v1 崩溃根因)。

---

## 1. 架构总览(两界面)

```
┌──────────── 家长后台 / Parent Studio(MacBook,创作期) ────────────┐
│ 语音/打字主题(STT/LLM) + 上传图片素材                              │
│   → LLM 生成故事文本 + SD 生成插图/词卡图                            │
│   → ★ 家长预览 / 编辑 / 批准(内容安全闸)                          │
│   → 打包 StoryPack(图资产 + JSON + checksum)                       │
└───────────────────────────────┬────────────────────────────────────┘
                  P2P 同步 / AirDrop(一次性传完,iPad 即自治)
┌───────────────────────────────┴──── iPad 儿童端(运行期,离线) ────┐
│ 多主题书库 → 选书                                                    │
│ 阅读:[打包图] + LLM 个性化叙述 + TTS 朗读(边看边生成,边读边备下页)│
│ ① 点任意词 → 1B+few-shot 端侧翻译 + TTS 发音(EN↔ES)              │
│ 活动:相机寻物(串行载入 VLM)· 涂色(边缘检测,非 AI)            │
└─────────────────────────────────────────────────────────────────────┘
```

**不变量:图固定,文字向图对齐**(每页 `scene` 锚定 LLM,既保图文一致又把 1B 关进笼子)。

---

## 2. 数据模型(StoryPack)

```jsonc
{
  "id": "...", "version": 1, "checksum": "sha256:...",
  "title": "...", "narrationLang": "en", "vocabLang": "es", "ageRange": [4,7],
  "pages": [{
    "index": 0, "image": "p00.webp",
    "scene": "...",                         // LLM 锚点
    "authoredNarration": "...",             // 安全回退(家长已批准)
    "slots": ["name","destination"]
  }],
  "vocab": [{ "word":"sun", "translation":"el sol", "say":"el sol" }], // 预置高频词
  "huntTargets": ["tree","red car","dog"]   // 相机寻物目标(好找、不歧义)
}
```
注:`vocab` 仍预置高频词;但 ① 后**任意词**都可端侧实时翻译,不限于此表。

---

## 3. 家长后台 / Parent Studio(MacBook,创作期)

MacBook 仅作**离线创作工具**,不进入 iPad 运行链路。算力不受限,STT/LLM/SD 随便跑。

1. 输入主题:**语音(QVAC STT)或打字**;可上传图片作素材。
2. 生成:LLM 出故事文本 → SD 出插图 + 词卡图(**角色跨页一致**:固定 seed / 角色 LoRA / IP-Adapter 任选其一)。
3. **★ 家长预览 → 编辑 → 批准**:这是内容安全的人在环节点——**未经家长批准的 AI 内容不得推到孩子端**。
4. 打包:WebP 压缩 + `storypack.json` + checksum。

---

## 4. MacBook → iPad 交付
- 优先 **QVAC P2P 内容同步**(Hyperdrive/Hyperswarm):点对点、不上云、一次传完 iPad 即自治(运行时不依赖 MacBook)。
- 退路:AirDrop / 本地文件。

---

## 5. iPad 运行期

### 5.1 模型管理(ModelManager 单一负责人)+ 内存分级
| 模型 | 驻留策略 | 状态 |
|---|---|---|
| LLM 1B Q4 | 核心常驻 | ✅ |
| TTS Supertonic2 | 核心常驻 | ✅ |
| 翻译(点词) | **复用常驻 1B LLM**(few-shot),无独立模型 | ✅ 译文正确 ~2.3s/词 |
| VLM(寻物) | **串行**:仅进寻物模式时载,退出即卸 | ✅ SmolVLM2 500M,2.1s/2.7s |
| ~~Bergamot 专用 NMT~~ | 原生引擎在 A12X 崩溃,弃用 | ❌ 改走 1B+few-shot |
| SD / Qwen3VL-2B | **永不上端**(均越 4GB) | ❌ |

内存告警 → 丢预生成缓存;App 后台 → 按需 unloadAll。

### 5.2 阅读 + 边看边生成(核心,已验证)
进入第 N 页:即时显示打包图 → 播 N 的旁白(已预生成)→ 后台预生成 N+1 的(LLM 文本 → 校验 → TTS)。轻拍翻页。时序:每页生成 ~15.5s < 播放 ~28s。

### 5.3 ① 端侧实时翻译(新增,改进项)✅ 真机验证
- 点故事里**任意词** → 端侧翻译 → 浮层显示译文 + **TTS 发音** → 直击赛道 "language translator / personal tutor"。
- **实现(实测结论):走【已常驻的 1B LLM】+ few-shot 严格 prompt**,不引入独立模型。
  - ❌ 专用 **Bergamot NMT 在 A12X 原生引擎初始化崩溃**(死循环重启,非 OOM,疑似 intgemm ARM 路径)。
  - ❌ `translate(modelType:"llm")` 套通用 1B 出垃圾(回显 + 漏 chat 角色词)。
  - ✅ `completion` + few-shot(system"只输出西语"+ tree→árbol/the house→la casa 示范 + 目标词,取首行):**译文正确**,~2.3s/词,**零额外模型**。
- ⚠️ 翻译可多语,但**发音受 TTS 语言闸(en/es/de/it,实测仅 es 稳)** → "翻译+发音"甜区 **EN↔ES**。常见词配 StoryPack 预烘焙 `vocab` 表即时出,任意词走 1B。

### 5.4 相机视觉寻物(新增)✅ 真机验证
- **模型:`SMOLVLM2_500M_MULTIMODAL_Q8_0` + mmproj**,走多模态 LLM 路径(`completion` + `attachments:[{path}]`,图像须落真实文件路径,RN 用 expo-asset)。
- 进入寻物模式:`unload(LLM,TTS) → load(VLM)`;退出反向(串行换入)。
- 流程:点"找一棵树" → 开相机拍 → VLM 判定 → 命中即成功。
- **实测(A12X):** 加载 2.1s **无 OOM**、单图 **~2.7s**(<5s 目标)。
- **准确性关键:严格 prompt** —— 宽松"有没有树?yes/no"会假阳性(小模型 yes 偏置);改 `"Look carefully… If you are not sure, answer 'no'."` 后正确。自然场景准确性建议实拍再抽检。
- **Qwen3VL-2B 实测 OOM 硬崩(~2.5GB 越线),故定 500M。** iOS 原生 Vision 仅作极端兜底(失 edge-AI 分)。
- **隐私:相机帧写入 app 私有临时文件(VLM 的 `Attachment` 仅接受文件路径,无法纯内存)→ 推理后立即删除;全程不上传、不持久化。** 保持"和家长一起"的监督基调。

### 5.5 涂色
照片→线稿用 **Core Image 边缘检测**(瞬时、不吃内存)。**不是 AI**,是好功能,别算进 edge-AI;**绝不用 diffusion 在 iPad 做涂色**。

---

## 6. Edge-AI 能力地图

| 运行期(iPad,被评设备) | 构建期(MacBook,创作工具) |
|---|---|
| LLM:叙述个性化 | STT:主题语音 |
| TTS:朗读 + 发音 | LLM:整本故事 |
| **1B+few-shot:实时翻译(①)** | SD:插图 + 词卡图 |
| VLM:相机寻物(⏳) | |

→ iPad 端侧 **4 种 QVAC 能力、全离线、多模型编排**——这是 demo 的工程 flex。

---

## 7. 安全与隐私
- **内容安全(双层)**:① 创作期家长预览/批准(未批准不推);② 运行期 LLM 个性化输出经校验(敏感词/长度/离题),不过则回退已批准的 `authoredNarration`。**绝不把未校验文本念给孩子。**
- **家长门禁**:PIN 加盐哈希存 Keychain(`WhenUnlockedThisDeviceOnly`),失败退避。
- **隐私**:运行期零网络/零遥测(审传递依赖);**语音纯内存处理(transcribe 走内存 base64,不落盘);相机帧写 app 私有临时文件 → 推理 → 立即删除(VLM 图像输入仅接受文件路径,无法纯内存),不上传/不持久化**;孩子姓名仅本地存,提供"清除"。P2P 同步不上云。
- **内存纪律**:见 §5.1(唯一红线)。

---

## 8. 失败与降级
| 情况 | 处理 |
|---|---|
| LLM 生成失败/超时/校验不过 | 回退 `authoredNarration`(仍 TTS) |
| 内存告警 | 丢 N+1 缓存;必要时降到即时生成 |
| VLM 太重 | 降级 iOS Vision(失 edge-AI 分) |
| 资产校验失败 | 拒绝加载,提示重新获取 |

---

## 9. 验证状态 / 开放项
**✅ 已实测(A12X,全部运行期能力):** LLM 个性化 · TTS RTF 0.30 · LLM+TTS 同驻 4GB 无 OOM、边看边生成有余量 · **VLM 寻物(SmolVLM2 500M,2.1s/2.7s,严格 prompt 准)** · **点词翻译(1B+few-shot,译文正确,~2.3s/词)**。反面:SD/Qwen3VL-2B OOM、Bergamot NMT 原生崩。详见《QVAC 端侧基准测试报告》。
**⏳ 剩余开放项(均非运行期能力阻塞):**
1. 干净 **LLM tok/s** 精确读数(现有 ~7s/751字符 为代理值)。
2. **Supertonic2** ES 音色 + demo 语言覆盖(EN 已验证)。
3. VLM 自然场景准确性用实拍照片抽检(当前测试图为抽象 logo)。
4. 构建期**角色跨页一致**方案落地。

**❓ 待问官方(@qvac / 组委):**
- 家长后台跑在 MacBook 上,会否触发"算力最大设备算主设备"、把项目从 **Mobile 顶到 General Purpose**?(干净说法:MacBook 仅创作工具,参赛产品是 iPad app。)

---

## 10. Demo / 赛道契合(Mobile)
- 现场:切飞行模式 → 家长后台现生成定制绘本 → 推到 iPad → 孩子离线读、实时朗读、**点词实时翻译**、**相机寻物**——一台 2018、4GB iPad 上 4 种端侧 AI,全程零云、孩子数据不出端。
- 命中:fully on-device、private、travel assistant / **language translator / personal tutor**、multimodal(photo→analysis)、creative use of camera、beautiful UX + 真实日常实用性。
- 诚实定位:重生成(故事+图)在创作期 MacBook;运行期可见的 edge-AI = 个性化叙述 + 朗读 + **实时翻译** + 相机识别。
