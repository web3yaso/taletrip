# QVAC 端侧基准测试报告

> 绘本 App「边看边生成」流水线在 4GB 端侧设备上的可行性验证。

| | |
|---|---|
| **日期** | 2026-06-05 |
| **设备** | iPad Pro 12.9″ 3rd gen (`iPad8,5`) — **Apple A12X / 4GB RAM**，iOS 26.3.1 |
| **运行方式** | 真机 dev-client（**非模拟器**） |
| **SDK** | `@qvac/sdk` 0.12.1 · Expo SDK 56 / React Native 0.85 |
| **测试载体** | `src/app/bench.tsx`（Bench tab） |
| **目标** | 量化 ① 1B LLM 速度 ② TTS 合成速度/RTF ③ LLM+TTS 能否在 4GB 内同时常驻 |

---

## 一、结果总览

| 项目 | 结果 | 关键数字 |
|---|---|---|
| **#1 LLM** — Llama-3.2-1B Instruct Q4_0 | ✅ 可运行 | 加载 **3.0s**（干净）；干净一页 completion ~7s（751 字符，代理值） |
| **#2 TTS** — Supertonic2 多语 Q8_0 | ✅ 通过 | 加载 ~1.0s；**稳态 RTF ≈ 0.30**（比实时快 ~3.3×） |
| **#3 BOTH 共存** — LLM + TTS | ✅ **成立** | 两模型同驻 4GB 无 OOM；gen→synth 流水线一步成功 |
| **#5 VLM 寻物** — SmolVLM2 500M (multimodal) | ✅ 通过 | 加载 2.1s 无 OOM；单图判定 **~2.7s**；**严格 prompt 后准确** |
| **#7 点词翻译** — 常驻 1B LLM + few-shot | ✅ 通过 | ~2.3s/词，译文正确，**零额外模型** |
| SD 出图 / Qwen3VL-2B / Bergamot NMT | ❌ 不可行 | 见 §四「反面结论」 |

---

## 二、详细数据

### #2 TTS（Supertonic2 多语，44.1 kHz int16 PCM）

| run | 合成耗时 | 音频时长 | RTF |
|---|---|---|---|
| #1（含预热） | 3.48s | 11s | 0.32 |
| #2 | 3.28s | 11s | 0.30 |
| #3 | 3.29s | 11s | **0.30** |

- 稳态 **RTF ≈ 0.30**，三次高度一致（预热仅多 ~0.2s）。
- 一页旁白稳定 **~3.3s** 生成，远快于播放时长 → 满足「边看边生成」的音频供给。

### #3 BOTH 共存（核心问题）

```
loadModel LLAMA → llamacpp model loaded → completed 4435ms     # LLM 加载 4.4s
loadModel begin (TTS，不卸载 LLM)                               # 第二个模型叠加
Loading supertonic2 → Loaded Model
tts-ggml model 41f3984f loaded                                 # ✅ TTS 叠在 LLM 之上，无崩溃
[request-lifecycle] end … completed 1010ms                     # TTS 共存加载 1.0s
kind=completion … completed 7074ms                             # 生成一页文本 7.07s
```

- LLM(4.4s) + TTS(1.0s) **同时常驻**，无 OOM、无闪崩。
- 流水线一步：`completion` 7.07s → **751 字符** → `textToSpeech` → **1,240,580 samples ≈ 28.1s 音频**。
- 屏幕确认：`BOTH: pipeline step OK ✅ text=751 chars, audio samples=1240580. 4GB co-residence WORKS.`

### #5 VLM 相机寻物（SmolVLM2 500M multimodal + mmproj）

- 走多模态 LLM 路径：`loadModel({ modelSrc: SMOLVLM2_500M_MULTIMODAL_Q8_0, modelType:"llm", modelConfig:{ ctx_size:1024, projectionModelSrc: MMPROJ_… } })` + `completion(history:[{…, attachments:[{ path }]}])`。`Attachment` **只认文件路径**，RN 端用 `expo-asset` 把图落地。
- **加载 2.1s，无 OOM**（500M + mmproj ~600MB，4GB 充裕）。
- **单图判定 ~2.5–2.8s**（3 次 2834/2526/2718ms），远低于 <5s 目标。
- **准确性靠严格 prompt**：宽松提问 "Is there a tree? yes/no" 会**假阳性**（小模型 yes 偏置）；改成 `"Look carefully. … If you are not sure, answer 'no'."` 后答案正确（准确描述 React logo、tree=no、logo=yes）。
- **结论：S2 用 SmolVLM2 500M，严格 prompt 是准确性开关。**（注：测试图为抽象 logo，自然场景准确性仍建议用实拍照片再抽检。）

### #7 点词翻译（常驻 1B LLM + few-shot）

- **专用 NMT（Bergamot）在真机原生崩溃**（见 §四）；`translate(modelType:"llm")` 套通用 1B 出垃圾（"tree"→"the tree assistant"，回显 + 漏 chat 角色词）。
- **可行方案：`completion` + few-shot 严格 prompt**（system "translation engine，只输出西语" + 2 个示范 tree→árbol / the house→la casa + 目标词，取首行）。
- **译文正确**：tree→árbol、the sun→el sol、"Where is the museum?"/"Sofia is happy." 均对；**~2.3s/词**；**零额外模型**（复用核心常驻 1B）。
- ⚠️ 翻译可多语，但**发音受 TTS 语言闸限制（en/es/de/it，实测 es 唯一稳的非英语）**→ "翻译+发音"甜区是 **EN↔ES**。
- 提速建议：常见词用 StoryPack 预烘焙 `vocab` 表（即时）、任意词走 1B（~2.3s）。

### 加载耗时趋势（同一模型，不同内存状态）

| | 污染态（有 SD 1.5 常驻） | 共存态（LLM+TTS） | 干净独占 |
|---|---|---|---|
| LLM 加载 | 5.3s | 4.4s | **3.0s** |
| TTS 加载 | （崩溃） | 1.0s | 1.0–1.1s |

---

## 三、关键 Bug：4GB OOM（已根因 + 修复）

**症状：** 点 #2 TTS / #3 BOTH 后 App 闪崩，原生 Bare worker 死在 `tts-ggml: Loading model …` 后重启（stale-lock / PID dead），每点必现。

**误判与纠正：** 最初怀疑是 TTS 模型版本（supertonic v1）或多余的 `ttsSpeed`/`ttsNumInferenceSteps` 参数。**错的** —— 换 supertonic2、删参数后**仍崩**。

**真因（OOM）：**
`src/app/index.tsx`（Home tab）在 `useEffect` 挂载时常驻加载 **SD 1.5 Q4_0（~1.75GB）**，且**只在组件卸载时**才 `unloadModel`。而 Expo 原生 tabs **切换 tab 不会卸载离开的屏幕** —— 于是你在 Bench 操作时，那 ~1.75GB 扩散模型一直压在内存里。加载任何第二个模型（TTS，或 #3 的 LLM+TTS）就撞穿 4GB → iOS 把原生 worker OOM-kill 在 TTS 分配那一步。

**修复：** 给 Home 自动加载加开关，bench 模式下不再常驻吃内存（可逆，想玩 Home 图像生成再改回 `true`）：

```ts
// src/app/index.tsx
const AUTO_LOAD_ON_HOME = false;   // bench 模式：Home 不常驻 SD 1.5
```

修复后，**杀进程重启**（清掉常驻模型 + 崩坏 worker + 重试队列）→ TTS 干净加载 1.07s、跑完 3 次合成、干净卸载；#2 / #3 全部通过。

---

## 四、反面结论：4GB 硬边界（同样是有价值的结果）

真机实测划清的边界——这些**不要上端**：

| 尝试 | 体积 | 结果 | 性质 |
|---|---|---|---|
| SD 1.5 / 2.1 出图 | ~1.75 / 2.19GB | ❌ 加载即被 jetsam | OOM（单个 ≥~2GB 模型越线） |
| **Qwen3VL-2B**（VLM 备选） | ~2.5GB（模型+mmproj） | ❌ 整个 app 被 jetsam 硬杀 | OOM |
| **Bergamot 专用 NMT** | ~几十 MB | ❌ 原生 `nmtcpp` 引擎 init 崩溃死循环 | **非 OOM**（疑似 intgemm ARM 路径） |
| `translate(modelType:"llm")` 套通用 1B | — | ❌ 译文垃圾（回显+漏 "assistant"） | 该 API 需翻译专调模型 |

**推论：本机单模型实用上限 ~1.5–2GB；VLM 用 500M、翻译复用常驻 1B（few-shot），都绕开了这条线。**

## 五、⚡ 重要副发现：内存压力不止让它崩，还让它慢 ~15×

| LLM completion 耗时 | 环境 |
|---|---|
| 76 – 114s | 首测（Home 的 SD 1.5 常驻，内存压力导致 swap/thrash） |
| **7.07s** | 干净共存态（仅 LLM+TTS） |

> **任何在「其他大模型仍驻留」时取得的数字都是被污染的、无效的。**
> 必须从 **杀进程冷启动 + Home 关闭** 的干净状态开始测。首测的 LLM tok/s 作废，需重测。

---

## 六、结论

1. ✅ **运行期 5 种能力全部真机验证通过**：LLM 个性化、TTS 朗读、LLM+TTS 共存、VLM 相机寻物（SmolVLM2 500M）、点词翻译（1B+few-shot）。"边看边生成 + 多模态 + 端侧翻译"在 A12X/4GB 上全部成立、零云。
2. ✅ **TTS 不是瓶颈**（RTF 0.30）；VLM ~2.7s/图、翻译 ~2.3s/词，均在可用区间。
3. ⚠️ **内存是唯一红线**：单模型实用上限 ~1.5–2GB；一次只驻当前需要的模型、用完即 `unloadModel`、严禁某屏幕后台常驻大模型（v1 崩溃根因）。
4. 🔑 **工程开关：严格 / few-shot prompt 是小模型可用性的总开关** —— VLM 寻物（"不确定就答 no"）和点词翻译（few-shot 限定只输出译文）都靠它从"出垃圾"变"可用"。

---

## 七、待办

- [ ] **补干净 #1 LLM 的 tok/s / TTFT**（读屏幕 `LLM #1/#2/#3 … TTFT … tok/s`）—— 现以"干净 completion ~7s/751字符"为代理值。
- [ ] 代码改动尚未提交：`bench.tsx`（TTS→Supertonic2、#5/#6 VLM、#7/#8 翻译）、`index.tsx`（Home 常驻开关）、`_layout.tsx`（dev 冷启动进 Bench）。
- [ ] VLM 自然场景准确性用实拍照片抽检（当前测试图为抽象 logo）。
- [ ] NMT/VLM 与 LLM+TTS 三者同驻的内存校验（VLM 实际是串行换入，翻译复用 1B 故无新增）。

---

## 附：环境与方法备注

- **TTS 工作配置（真机已验证）：**
  ```ts
  loadModel({
    modelSrc: TTS_MULTILINGUAL_SUPERTONIC2_Q8_0.src,
    modelType: "tts",
    modelConfig: { ttsEngine: "supertonic", language: "en", voice: "F1" },
  });
  ```
  0.12.1 已无 Piper；TTS modelConfig 为透传 record（不校验），多余键会原样进原生层，保持最小化。
- **`textToSpeech` 不打 server 生命周期日志**（不像 `completion`），合成期间 Metro 静默属正常；以 JS 走到合成后的 `unloadModel` 为成功判据。
- **观测手段：** Metro 实时日志（模型加载/推理生命周期/卸载/崩溃）+ 设备屏幕上 bench 自算的 tok/s / RTF / samples。
