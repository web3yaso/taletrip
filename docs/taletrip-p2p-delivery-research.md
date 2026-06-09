# TaleTrip · P2P 交付方案研究（QVAC / Holepunch）

> 目标：把 Parent Studio（MacBook）生成的 StoryPack（`storypack.json` + 插图 PNG）通过 **QVAC P2P** 直接送到 Child 端（iPad），**零云、零中转服务器**。本文只研究方案，不实现。
>
> 调研时间：2026-06-09。基于本仓库 `node_modules` 实测的模块清单 + `@qvac/sdk` 0.12.1。

---

## 0. 结论速览（TL;DR）

- **可行**。QVAC 本身就建在 Holepunch P2P 栈上——模型就是用 `registry://` 经 **Hyperswarm + Hypercore + Hyperblobs + Corestore** P2P 分发的。StoryPack 交付**复刻这套模式**即可。
- **移动端最难的一环（NAT 穿透 / DHT 传输）已具备**：`udx-native`（DHT 的 UDP 传输层）**自带 `ios-arm64` + `ios-arm64-simulator` prebuild**，react-native-bare-kit 的 Bare worker 能跑。
- **数据载体首选 Hyperdrive**：它本身就是一个 P2P 文件系统（一个 Hypercore 存元数据 + 一个 Hyperblobs 存文件内容），把一本绘本当成"一个可复制的目录"，天然契合 StoryPack。
- **配对模型有现成的两种**：① `startQVACProvider` 的"连公钥 + firewall 白名单"；② Hyperswarm `swarm.join(topic)` 的主题发现。配对码 = 公钥/主题 key（可编码成短码或二维码）。
- **首次同步后 iPad 自治**：书落进 iPad 本地 documents，之后飞行模式离线翻看，符合产品隐私主张。

> **✅ 验证进度（2026-06-09）· Spike-0a（Mac）通过**：`studio/p2p-spike-local.mjs` 用本地 DHT testnet 在 Bare 上跑通了完整链路——Hyperswarm 发现 → 连接 → Hyperdrive 复制（json 元数据 + PNG blob 都正确到达消费端）。证明该 P2P 栈在 Bare 下可用、publish/sync 代码逻辑正确。
> 注：用 testnet 是因为**同机走公网 DHT 的 holepunch 是已知假阴性**（连不到同 IP 的"自己"），不代表 Mac↔iPad（不同主机）连不通。生产 publish/consume 脚本见 `studio/p2p-publish.mjs` / `p2p-consume.mjs`。
> **剩余唯一硬不确定性 → Spike-0b（iPad）**：iPad 的嵌入式 Bare worker 能否同样 `swarm.join` + replicate（需改 worker entry + 重打 + 真机，且跨主机 DHT 真网络）。

---

## 1. 现成的 P2P 积木（已在 node_modules，无需新依赖）

| 模块 | 作用 | 在 TaleTrip 的角色 |
|---|---|---|
| `hyperswarm` / `hyperdht` | 基于 DHT 的 peer 发现 + 直连（含 NAT 穿透） | Parent/Child 互相找到对方 |
| `udx-native` | DHT 底层 UDP 传输（**有 iOS prebuild**） | 让 P2P 在 iPad 上能联网 |
| `hyperdrive` | P2P 文件系统（一本书 = 一个 drive） | StoryPack 的载体 |
| `hyperblobs` | 大二进制（插图 PNG） | drive 的文件内容存储 |
| `hypercore` / `corestore` | append-only 日志 + 多 core 管理 | drive 的元数据 + 多本书管理 |
| `protomux` / `compact-encoding` / `b4a` | 多路复用 / 编码 / buffer | 底层协议 |
| `hypercore-id-encoding` | key ↔ z-base32 短码 | **配对码编码**（公钥变成可读/可扫的码） |

> 这些都是 `@qvac/registry-client@0.6.0` 已经在用的（实测：corestore×19、hyperswarm×24、hyperblobs、hypercore 引用遍布其 lib/）。也就是说**模型 P2P 分发就是参考实现**，照抄到 StoryPack 即可。

---

## 2. iPad 端可行性（移动 P2P 的关键）

移动 P2P 通常死在两点：①NAT 穿透 ②iOS 上有没有 UDP/DHT 的原生支持。本栈两点都解决：

- ✅ `udx-native/prebuilds/` 含 **`ios-arm64`**、`ios-arm64-simulator`、`ios-x64-simulator` —— 传输层原生二进制 iOS 齐全。
- ✅ iPad 已经在跑 Bare worker（`react-native-bare-kit` + 项目 `qvac/worker.bundle.js`），模型下载本身就走 P2P registry —— 说明 **iPad 的 worker 已经具备 P2P 联网能力**（否则模型都下不下来）。
- ⚠️ **待验证**：StoryPack 用到的 `hyperdrive`/`hyperblobs` 是否已经打进了 iPad 的 `worker.bundle.js`（registry 用的是 hypercore+hyperblobs，hyperdrive 不一定在）。若不在，需要把交付逻辑加进 worker entry 重新 `bare-pack` 打包（见 §7）。

---

## 3. 两条技术路线

### 路线 A · 复用 `startQVACProvider`（SDK 内置 P2P）
- SDK 文档原文：「Starts a provider service that offers QVAC capabilities to remote peers. Consumers connect directly via its public key using `dht.connect(publicKey)`」，支持 `firewall` 白名单，公钥可由 `QVAC_HYPERSWARM_SEED` 固定。
- **优点**：配对模型现成（连公钥即可），firewall 天然做"只允许我自己的 iPad"。
- **风险/未知**：这个 provider 是为**远程调用 QVAC 能力（跑推理）**设计的（即"delegation"），**未必能直接传任意文件**。需读实现确认它能否承载 StoryPack 文件流，还是只暴露 inference RPC。
- **结论**：作为"配对 + 直连"层很合适；作为"传文件"层不确定，可能要在它的连接上自己跑文件协议。

### 路线 B · 自建 Hyperdrive over Hyperswarm（复刻 registry 模型分发）⭐ 推荐
- Parent：把一本 StoryPack 写进一个 **Hyperdrive**（Corestore 管理），`swarm.join(drive.discoveryKey)` 做服务端，`swarm.on('connection', c => drive.replicate(c))`。
- Child：拿到 drive 的 **public key**（配对码），`const drive = new Hyperdrive(store, key)`，`swarm.join(drive.discoveryKey)`，连上后 `drive.replicate(conn)`，再 `for await (entry of drive.list()) drive.get(entry) → 写进 documents`。
- **优点**：就是 QVAC 模型分发的同款积木，最可控、最稳；Hyperdrive 是文件系统，StoryPack 原样放（`storypack.json` + `p*.png`）。
- **缺点**：配对/发现要自己接（但有 hypercore-id-encoding 把 key 变短码）。

---

## 4. 推荐架构

**路线 B（自建 Hyperdrive）做数据面 + 借路线 A 的"连公钥"思路做配对**：

```
┌─ MacBook · Parent Studio (Bare 进程，已在跑) ──────────────┐
│ 生成 StoryPack → 写进 Hyperdrive(corestore)               │
│ swarm.join(drive.discoveryKey, {server:true})             │
│ 展示配对码 = z-base32(drive.key)  （短码 / 二维码）         │
└───────────────────────────────┬───────────────────────────┘
                       Hyperswarm DHT（udx UDP，含 NAT 穿透）
┌───────────────────────────────┴── iPad · Bare worker ─────┐
│ 输入/扫配对码 → key                                        │
│ new Hyperdrive(store, key) → swarm.join → replicate        │
│ drive.list() → drive.get() → 写进 app documents/packs/     │
│ → Kid Reader 列出新书（复用现有 adapter.ts 加载）          │
└───────────────────────────────────────────────────────────┘
首次同步后断网即可读；之后增量同步（Hypercore 天然增量）
```

**为什么 Hyperdrive 契合**：一本书 = 一个 drive = 一个可寻址的小文件系统。多本书 = 多个 drive（或一个 drive 多目录）。Hypercore 是 append-only，**家长更新某页插图 → 只同步增量**，孩子端自动拿到新版。

---

## 5. 配对 / 发现流程（无云、人可操作）

1. Parent Studio 生成书后，把 `drive.key`（32 字节）用 `hypercore-id-encoding` 编码成 **z-base32 短码**（约 52 字符）或直接渲染成**二维码**。
2. iPad Kid 端「从家长那里取书」→ 扫码 / 输码 → 解码回 key。
3. 双方 `swarm.join` 同一个 discoveryKey，DHT 撮合直连，开始 replicate。
4. 安全：key 即能力（holds the key = can read）。可叠加 `firewall`（只认对方公钥）防陌生人。书内无隐私（家长自造内容），孩子姓名只在本地填槽，不进 drive。

> 极简版可省二维码：同一 WiFi 下 Hyperswarm 也能本地发现，但**走 DHT 配对码更稳、也跨网络**。

---

## 6. 待验证的未知（实现前的 spike 清单）

| # | 未知 | 怎么验 | 影响 |
|---|---|---|---|
| 1 | `hyperdrive`/`hyperblobs` 是否已在 iPad `worker.bundle.js` | 解析 bundle / 在 iPad worker 里 `require('hyperdrive')` 试 | 不在则要改 worker entry + 重新 `bare-pack` + 重建 dev client |
| 2 | iPad 嵌入式 Bare 能否真的 `swarm.join` 并连上 Mac | 写一个最小 spike：Mac 起 drive，iPad worker replicate 一个 1KB 文件 | P2P 在 iOS 上的真实可行性（**最高优先级**） |
| 3 | `startQVACProvider` 能否传文件（路线 A 是否可用） | 读 provide 实现 + ProvideParams 能力面 | 决定用 A 还是纯 B |
| 4 | iOS 本地网络权限 | `Info.plist` 加 `NSLocalNetworkUsageDescription`（+ 可能 Bonjour）；真机弹窗确认 | 同 WiFi 发现 / 首次连接 |
| 5 | iPad worker 与 RN 层的 RPC 怎么把"同步进度/完成"传回 UI | 看现有 SDK 的 RPC（loadModel 已有 onProgress）能否复用同机制 | UI 进度条 |
| 6 | 后台/锁屏时 P2P 是否被 iOS 挂起 | 真机测：同步中锁屏 | 大文件同步需前台保持 |

---

## 7. 工程落点（实现时改哪里，仅供评估工作量）

- **Mac 侧**：在现有 `studio/server.mjs`（已是 Bare 进程）加一个 `publish(pack)`：建 Corestore→Hyperdrive→写文件→`swarm.join`→出配对码。复用 registry-client 的同款依赖，无新增。
- **iPad 侧**：在 Bare worker 加一个 `syncPack(key)`：Hyperdrive replicate → 写 `Paths.document/packs/<id>/`。需确认 §6.1（模块是否在 bundle）。可能要改 `qvac/worker.entry.mjs` + `bare-pack` 重打 + 重建 dev client。
- **RN UI 侧**：Kid 端加「取书」入口（输码/扫码）+ 进度；Reader 的 `adapter.ts`/`packs/*` 改成**从 documents 动态读取**已同步的 pack（现在是 bundle 死的 lisbon-mia）——这一步无论用不用 P2P 都要做。

---

## 8. 风险 & 降级

| 风险 | 降级 |
|---|---|
| iPad Bare 跑不起 hyperswarm（§6.2 失败） | 退**局域网 HTTP 拉取**（iPad 拉 Mac 的 `studio/server.mjs` `/packs`，已实现，本地不上云）或 **AirDrop 导出 `.taletrip`** |
| hyperdrive 不在 iPad bundle 且重打成本高 | 仅用 hypercore+hyperblobs（registry 已验证在 bundle）自拼简易文件传输 |
| 跨网络 NAT 穿透不稳 | 同 WiFi 演示（DHT 本地撮合）；或带一个 relay |
| 大插图同步慢 | 插图先压成 WebP（StoryPack 设计本来就用 WebP）；增量同步 |

---

## 9. 与 Mobile 赛道「delegation」的战略契合

赛道 focus area 明确列了 **"Delegation scenarios where the phone offloads heavy tasks to a laptop/desktop via P2P"**。
- 当前 TaleTrip 是"Mac 生成 → iPad 读"，方向是 laptop→phone。
- 若把发起方反转成 **iPad 端点「生成一本新书」→ 通过 QVAC P2P 委托 Mac 跑 LLM+SD → 结果 P2P 回传** —— 就**逐字命中**这条 focus area，而且 `startQVACProvider`（"offer QVAC capabilities to remote peers"）正是为此设计的。
- **建议**：P2P 交付落地后，把 demo 叙事做成"iPad 发起、P2P 委托笔记本",一举解决"Mac 算力是否让项目掉出 Mobile 赛道"的归类风险（见 PRD §12 ❓）。

---

## 10. 分阶段计划（研究 → spike → 实现）

1. **Spike-0（最高优先，~半天）**：iPad Bare worker 里跑通"replicate 一个 Mac 上的 1KB hyperdrive 文件"。这一步决定 P2P 在 iOS 上到底行不行（§6.1/§6.2）。**不通则整条 P2P 路线改走局域网/AirDrop 降级。**
2. **Spike-1**：确认 `startQVACProvider` 能力面（路线 A 是否能传文件）。
3. **实现-1**：Reader 改为从 documents 动态加载 pack（与 P2P 解耦，先做，立刻能用 AirDrop/局域网喂书）。
4. **实现-2**：Mac 侧 `publish(pack)` + 配对码；iPad 侧 `syncPack(key)` + 取书 UI。
5. **实现-3（拿赛道分）**：反转成 iPad 发起的 P2P 委托生成。

> 关键决策点在 **Spike-0**：先用最小代价验证"iPad 嵌入式 Bare 能不能真的 P2P 连上 Mac"，再决定全量投入。这是整条方案唯一的硬不确定性，其余都是工程量。
