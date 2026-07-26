# Glossy — 开发上下文

## 这是什么

一个英语学习 PWA。核心功能：查词、翻译、SM-2 间隔重复复习。
支持邮箱账号注册登录，登录后通过 Firebase Firestore 实现实时跨设备同步。

## 技术栈

- **框架**：React + Vite + TypeScript
- **样式**：Tailwind CSS
- **路由**：React Router
- **本地数据库**：IndexedDB，通过 Dexie.js 封装
- **云数据库 / 实时同步**：Firebase Firestore（persistentLocalCache + 多标签页管理）
- **认证**：Firebase Auth（邮箱密码）
- **词形还原**：compromise.js（纯前端，无需联网）
- **PWA**：Workbox（Service Worker + 离线缓存）
- **图标**：Lucide React
- **LLM 代理**：Cloudflare Worker（`worker/`），校验 Firebase ID token 后转发 DeepSeek，流式返回
- **部署**：前端 Cloudflare Pages / Vercel / Netlify 均可，需配置 `VITE_FIREBASE_*` 和 `VITE_PROXY_URL`；Worker 用 wrangler 单独部署

## 目录结构

```
/src
  /auth             Firebase Auth 上下文（AuthContext.tsx）
  /components       可复用 UI 组件
  /pages            页面级组件（Home、Lookup、Translate、Review、History、Settings、Login、Register）
  /db               Dexie schema（index.ts）、查询层（queries.ts）、Firestore 同步层（firestore-sync.ts）
  /algorithms       SM-2 等核心算法
  /api              调用 Worker 代理（llm.ts）与错误处理
  /prompts          查词与翻译的 prompt 文本（独立文件，便于迭代）
  /utils            lemmatize、hash 等工具函数
  firebase.ts       Firebase app 初始化（Auth + Firestore）
/worker
  src/index.ts      Cloudflare Worker：校验 Firebase ID token → 调用 DeepSeek → 流式转发
  wrangler.toml     Worker 配置（DEEPSEEK_API_KEY 是 secret，不在此文件里）
/docs
  PRD.md            完整产品需求文档
  UI.md             每个屏幕的详细组件描述
firestore.rules     Firestore 安全规则（需 firebase deploy 部署）
```

## 认证与同步架构

- 所有主路由均需登录（`RequireAuth` 守卫），未登录跳转 `/login`
- 登录成功后，`AuthContext` 依次执行：
  1. `subscribeToUserData(uid)` — 启动 `onSnapshot` 实时订阅，写入本地 IndexedDB
  2. `verifyFirestoreAccess(uid)` — 健康检查，检测规则是否部署（静默记录）
  3. `pushLocalOnlyItems(uid)` — **一次性**上传本设备登录前就存在的数据，成功后在 `settings` 写入 `bootstrapped:{uid}` 标记，之后直接跳过
- `pushLocalOnlyItems` **不是**离线补传机制：离线写入由 Firestore `persistentLocalCache` 自动排队重试。它每设备每用户只跑一次——重复执行会把其他设备已删除的条目重新传上去（本地有、远端没有的行，无法区分「待上传」和「已被删除」）
- 每个 collection 在拿到首个**服务端权威快照**时对账一次：删掉本地存在但远端没有的行，否则「设备关闭期间在别处删除的条目」永远不会消失。两个前置条件缺一不可：
  - `snap.metadata.fromCache === false` — 离线快照来自本地缓存，误当权威会清空本地数据
  - 已 bootstrap — 首次登录时本地数据是「待上传」而非「已删除」，此时对账会删掉正要上传的数据
- **共享缓存**（任意已登录用户可读写）：Firestore `word_cache`、`translation_cache`
- **用户私有数据**（Firestore 路径 `users/{uid}/`）：`history`、`review_items`、`review_logs`
- Firestore 使用 `persistentLocalCache` + `persistentMultipleTabManager`，离线写入自动排队并在上线后重试

## 关键约束

- 本地 IndexedDB 共 6 个 store：
  `word_cache`、`translation_cache`、`history`、`review_items`、`review_logs`、`settings`
  （`settings` 目前只存同步标记 `bootstrapped:{uid}`，没有任何用户可配置项）
- Dexie schema 仍是 `version(1)`，从未迁移过。改 `.stores({...})` 必须新增 `this.version(2)`，原样保留 v1 那段——就地修改不会触发升级，老用户拿不到新 store/index
- **前端不直接调用 LLM**：`callLLM` 把 `{ prompt, model }` POST 到 `VITE_PROXY_URL`，带上 Firebase ID token；由 Worker 去请求 DeepSeek 的 `/v1/chat/completions`
- DeepSeek API key 只存在于 Worker secret（`DEEPSEEK_API_KEY`），永不下发前端；用户不需要也无法自行填写
- 模型在 `getModel()` 里硬编码为 `deepseek-chat`；Settings 页面只有账号信息和退出登录，没有 LLM 配置 UI
- **删除操作绝不级联到 `word_cache` / `translation_cache`**：这两个 collection 全体用户共享（见 `firestore.rules`），删一条会毁掉所有人的缓存并触发重新付费调用 LLM。删 history 只删 history 行，`review_items` 同理
- 环境变量：`VITE_FIREBASE_*` + `VITE_PROXY_URL`（本地开发写 `.env.local`）
- 移动端优先（375px 基准宽度），桌面端居中显示，最大宽度 430px
- 极简风格，单一点缀色琥珀橙 `#BA7517`

## Firestore 安全规则

见 `firestore.rules`：
- `/word_cache/{lemma}`、`/translation_cache/{hash}`：任意已登录用户可读写
- `/users/{userId}/**`：仅本人（`request.auth.uid == userId`）可读写

首次部署或修改规则后需执行：`firebase deploy --only firestore:rules`

## LLM 代理（Cloudflare Worker）

见 `worker/src/index.ts`：
- 只接受 POST，校验 `Authorization: Bearer <Firebase ID token>`——用 Firebase JWKS 做 RS256 验签，并检查 `exp` / `aud` / `iss`
- 通过后用 Worker secret 里的 `DEEPSEEK_API_KEY` 请求 DeepSeek，`stream: true`、`temperature: 0.3`
- 把 SSE 的 delta 拼成 `text/plain` 流式返回；前端 `fetchViaProxy` 边读边触发 `onStream`（保留了旧版 JSON 响应的兼容分支）
- 模型白名单：`deepseek-chat`、`deepseek-reasoner`，其余一律 400

部署：在 `worker/` 下执行 `npx wrangler deploy`；密钥用 `npx wrangler secret put DEEPSEEK_API_KEY` 设置（不要写进 `wrangler.toml`）。部署后把 Worker URL 填到前端的 `VITE_PROXY_URL`。

## 字体规范

- **字体族**：`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`（系统字体，无 Web 字体）
- **字号**：全部为组件内联样式（无 CSS 变量），按用途分级如下：

| px  | 用途 |
|-----|------|
| 13  | BottomNav 标签、词性标签（POS chip） |
| 14  | 时间戳、分组标题、例句文本 |
| 16  | 音标、功能按钮、错误提示文字 |
| 17  | 正文、释义、Toast、按钮文字 |
| 18  | 输入框、列表项标题、主操作按钮 |
| 21  | 搜索输入框 |
| 23  | AppBar 标题（Glossy / Review / History） |
| 29  | WordPopup 词头 |
| 36  | 登录/注册 Logo、复习背面词头 |
| 39  | LookupResult 词头 |
| 42  | ReviewSession 正面词头 |

- **字体平滑**：`-webkit-font-smoothing: antialiased`
- **CSP**：`font-src 'self'`，不允许加载外部字体

## UI 参考

见 `docs/UI.md`，每个屏幕有详细的组件层级和交互描述。
颜色、字号、间距、圆角规范见 `docs/PRD.md` 附录 B。

## 完整文档

- `docs/PRD.md`：产品需求、数据模型、SM-2 算法实现代码、两个 LLM prompt 完整原文、所有屏幕说明、错误处理规范
- `docs/UI.md`：各屏幕的逐屏组件描述
