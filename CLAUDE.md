# Glossy — 开发上下文

## 这是什么

一个英语学习 PWA。核心功能：查词、翻译、FSRS 间隔重复复习。
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
  /pages            页面级组件（Home、Lookup、Translate、CaptureText、Review、Library、Stats、Settings、Login、Register）
  /db               Dexie schema（index.ts）、查询层（queries.ts）、Firestore 同步层（firestore-sync.ts）、词库（library.ts）、统计（stats.ts）、设置（settings.ts）
  /algorithms       FSRS 调度（fsrs.ts）、复习队列与会话、作答判定等核心算法
  /api              调用 Worker 代理（llm.ts）与错误处理
  /prompts          查词、翻译、语境采集的 prompt 文本（独立文件，便于迭代）
  /utils            lemmatize、hash、markTarget、sentenceAt 等工具函数
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
  4. `resetSchedulesForFsrs(uid)` — 紧接在 3 之后（才能重置 3 刚传上去的数据）：SM-2 换 FSRS 时的**一次性**重置，成功后写 `fsrs_reset:{uid}` 标记
- FSRS 重置是用户要求的**破坏性、不可逆**操作：所有卡片回到新卡（`newSchedule(added_at)`，删掉 `ease_factor` / `interval_days` / `repetitions`），所有 SM-2 复习日志删除（本地 + Firestore），连续天数随之归零；卡片内容（词、义项、句子、翻译）不动。它读的是服务端（先 `waitForPendingWrites`，再 `getDocsFromServer`），只动仍是 SM-2 形状的数据——`needsReset()`：没有 `state`、带着 `ease_factor`、或 `due_at` 不是有限数；日志看有没有 `state`。所以每台设备各跑一次既安全又必要：旧版本离线时或在没刷新的旧标签页里写下的 SM-2 评分，只有那台设备自己等得到
- 重置落地之前，`withSchedule()` 把 SM-2 形状的卡当新卡读；每次写 schedule（`writeSchedule()`）都顺手删掉 SM-2 字段——一张卡同时带两套字段会被当成待重置，又变回新卡
- `pushLocalOnlyItems` **不是**离线补传机制：离线写入由 Firestore `persistentLocalCache` 自动排队重试。它每设备每用户只跑一次——重复执行会把其他设备已删除的条目重新传上去（本地有、远端没有的行，无法区分「待上传」和「已被删除」）
- 每个 collection 在拿到首个**服务端权威快照**时对账一次：删掉本地存在但远端没有的行，否则「设备关闭期间在别处删除的条目」永远不会消失。两个前置条件缺一不可：
  - `snap.metadata.fromCache === false` — 离线快照来自本地缓存，误当权威会清空本地数据
  - 已 bootstrap — 首次登录时本地数据是「待上传」而非「已删除」，此时对账会删掉正要上传的数据
- **共享缓存**（任意已登录用户可读写）：Firestore `word_cache`、`translation_cache`
  - 共享缓存不会整体同步到本地：本地 `word_cache` / `translation_cache` 只有本设备查过或打开过的内容。所以从词库 / 复习会话 / 直接 URL 打开结果页、以及词库的「+ add」，必须走 `getCachedWord` / `getCachedTranslation`（先 IndexedDB，再共享缓存；不调 LLM、不写 history）——只查 IndexedDB 的话，换一台设备就打不开同步过来的条目
  - 翻译页刷新走 `generateTranslation`：直接调 LLM 并覆盖本地和共享缓存，全体用户都会看到新结果。走 `translateText` 会先命中共享缓存，永远拿回旧结果
- **用户私有数据**（Firestore 路径 `users/{uid}/`）：`history`、`review_items`、`review_logs`、`captures`，以及复习设置文档 `prefs/review`（见下文「复习设置」）
- Firestore 使用 `persistentLocalCache` + `persistentMultipleTabManager`，离线写入自动排队并在上线后重试

## 关键约束

- 本地 IndexedDB 共 7 个 store：
  `word_cache`、`translation_cache`、`history`、`review_items`、`review_logs`、`settings`、`captures`
  （`settings` 存同步标记 `bootstrapped:{uid}`、`fsrs_reset:{uid}` 和显示偏好 `chinese_display`，这三样本地专属、不参与同步；另有 `review_settings:{uid}`——Firestore `users/{uid}/prefs/review` 的本地镜像，由 `subscribeReviewSettings` 写入）
- Dexie schema 当前是 `version(2)`（v2 加了 `captures`）。再改 `.stores({...})` 必须新增 `this.version(3)`，并原样保留 v1、v2 那两段——就地修改不会触发升级，老用户拿不到新 store/index。换 FSRS 加的字段都不建索引，所以没有升版本
- **前端不直接调用 LLM**：`callLLM` 把 `{ prompt, model }` POST 到 `VITE_PROXY_URL`，带上 Firebase ID token；由 Worker 去请求 DeepSeek 的 `/v1/chat/completions`
- DeepSeek API key 只存在于 Worker secret（`DEEPSEEK_API_KEY`），永不下发前端；用户不需要也无法自行填写
- 模型在 `getModel()` 里硬编码为 `deepseek-chat`；Settings 页面是账号、复习设置和中文显示，没有 LLM 配置 UI
- **删除操作绝不级联到 `word_cache` / `translation_cache`**：这两个 collection 全体用户共享（见 `firestore.rules`），删一条会毁掉所有人的缓存并触发重新付费调用 LLM。删 history 只删 history 行，`review_items` 同理
- **英文优先**：中文默认折叠，点"中文"才展开，由 `chinese_display`（`always` / `tap` / `never`，默认 `tap`）控制。查词页、翻译浮层、语境采集页、复习介绍卡共用 `SenseBlock`（`src/components/SenseBlock.tsx`）——释义的排版只有这一处。例外是复习作答卡：释义是题面，中文要留作提示，所以单独排版；但答案面的"中文"chip 用的仍是 `SenseBlock` 导出的 `ChineseToggle`
- **语境采集**（Home 的 Read 标签 → `/read/:id`）：粘贴的段落存进 `captures`，`findChunks()` 一次性问出值得整体学的短语并缓存在这条记录上；点词或短语走 `explainInContext()`，只解释它在**这句话**里的意思（`sentenceAt()` 负责切出那一句）。保存时写的是 `addContextCard()`——同一个义项再次遇到只往 `contexts` 里追加句子，不会多出一张卡
- **卡片自带语境**：`WordSnapshot.contexts` 存用户自己遇到的句子，`pickWordCard()` 优先用它，词典例句退居其后（留给成熟卡的"没见过的新句子"）
- **复习卡一律挖空、打字作答**：`pickWordCard()`（`src/algorithms/cards.ts`）返回 `cloze` / `fresh` / `bare`。有句子就把词挖掉、给英文释义，让学习者**输入**这个词在句中的词形——不问 "What does it mean here?"；`fresh` 是成熟卡（Review 状态、stability ≥ 21 天）按 `reps` 轮换一句没用过的句子再挖空，忘了重学时回到原句。找不到能定位目标词的句子时是 `bare`：只给释义、输入词头——同样从意思到词，不再亮出光词头让人回忆意思。挖空靠 `markTarget()` 定位，它只匹配整词，否则会挖掉半个词（"I'm ___ning late"）。判定在 `judgeAnswer()`（`src/algorithms/answer.ts`）：correct / typo / wrong_form / wrong；`suggestRating()` 据此和用过的提示给出建议评分——只是 RatingBar 上的默认项，用户可改。句子卡仍是心里翻译、自己评分
- **复习会话**（仿 wordloom 的"复习"）：`StudySession`（`src/algorithms/session.ts`）是纯逻辑，读写经注入的 `saveRating` / `undoRating`。队列由 `buildDailyQueue()`（`src/algorithms/queue.ts`）开场一次排定：Learning（FSRS 的 Learning / Relearning）在前，到期老卡按 retrievability 从低到高（最快要忘的先出）、和新卡穿插。**每天新卡最多 `newPerDay` 张、到期老卡最多 `reviewsPerDay` 张**（复习设置，默认 20 / 200），今天已评过的都算在内（新卡数 state 0 的日志，老卡数 state 为 Review 的日志）。超出的新卡计入 `newWaiting`——重置后整本都是新卡，不设上限就会同一天全部到期；老卡留下最快要忘的，其余计入 `reviewsWaiting`、算进明日到期。新卡顺序看 `newOrder`（默认 `newest`，刚查的先出）。**每个词每天只出一张卡**（`studyKey()` 按词头归并）：一个义项填过空，答案就是这个词，其余义项留到明天（`held`）——卡片数据不动，只是今天不出，复习页的 Tomorrow 把其中的老卡算进去（新卡归每日上限管，不算）。新单词卡先出介绍卡，隔 3 张再考。评完仍在学习步骤里、且今天之内到期的卡放回队列，到点再出（新卡 1m / 6m / 10m，忘了的卡 10m）；别的卡都出完了就提前出（20 分钟内到期的）。撤销只回滚本轮自己写的：恢复卡片整套 FSRS 字段、删掉那条 review_log（本地 + Firestore），放回队列的那份一并撤掉。`saveRating` / `undoRating` 都先确认卡片还在——对别的设备上已删除的卡 merge 写会把它复活
- **按钮上的间隔就是会写进去的间隔**：揭晓答案时 `reveal()` 用 `previewRatings()` 算一次四档结果并缓存，`rate()` 原样写入。别在评分时重算——FSRS 开了 fuzz，再算一次间隔会变
- **调度是 FSRS**（`ts-fsrs`，`src/algorithms/fsrs.ts`；默认参数同 wordloom：保留率 0.9、学习步骤 1m / 10m、重学 10m、开 fuzz、最长 36500 天。保留率、最长间隔和两组步骤可在复习设置里改，所以 `previewRatings(item, now, settings)` 必须传设置；retrievability 只用默认参数算，与设置无关）。`ReviewItem` 平铺存 ts-fsrs Card 的字段（`state` / `stability` / `difficulty` / `elapsed_days` / `scheduled_days` / `learning_steps` / `reps` / `lapses`），两个日期沿用 `due_at` / `last_reviewed_at`；`ReviewLog` 记 `rating`、评分**前**的 `state`（0 = 这张卡第一次评）和 `reviewed_at`。读卡经 `withSchedule()` / `scheduleOf()`，建卡用 `newSchedule()`——别再手写默认字段。复习页只有今天这一轮和统计，不列卡片；数字（今日复习数、新学数、首答记住率、明日到期、连续天数）全部由 `getReviewOverview()` 从 `review_logs` 现算、只读；作答判定结果不落库
- **复习设置**（Settings → Review；`ReviewSettings`，`src/db/settings.ts`）：每天新卡 / 复习上限、目标保留率（0.80–0.97）、最长间隔、学习 / 重学步骤（`1m 10m` 这样，正整数 + m/h/d，可为空）、新卡顺序、自动发音（介绍卡出现、揭晓答案时读出单词）。学习设置跟账号走：存 Firestore `users/{uid}/prefs/review`，本地 `settings` 只是镜像；中文显示仍是本机偏好。读写都过 `normalizeReviewSettings()`（夹范围、校验步骤、坏值退回默认）——各设备跑的版本可能不同，一个坏值不能卡住队列和调度器。`setReviewSettings(patch)` 在一个 Dexie 事务里读-合并-写再整份推到 Firestore，几乎同时的两次保存不会互相覆盖。会话开场读一次（`getTodayQueue(settings)`、`new StudySession(deps, entries, settings)`），这一轮里改设置下一轮才生效。设置页数字框失焦 / 回车才存，滑杆用原生 `change` 事件松手才存（React 的 onChange 拖动中每一步都触发），步骤写错就留在框里标红、不存
- **词库**（Library，`/library`，取代 History；`/history` 重定向过来）：Words / Sentences / Passages 三栏，各有搜索、状态筛选（段落没有）和排序（Recent / A–Z / Next review，段落没有 Next review）。`loadLibrary()`（`src/db/library.ts`）把 history 和复习卡按词（词头小写）/ 句子（`hashText(source_text)`）归成一条；状态 `entryStatus()` 按条目算：没卡 = 未加入，有卡在学习步骤 = 学习中，全是新卡 = 新，全是成熟卡（`isMature()`：Review 且 stability ≥ 21 天）= 已掌握，其余 = 复习中。每张卡一格进度条（新 / 学过 / 成熟），新卡的到期栏显示 `new`。tab / status / sort / q 存在 URL 参数里，但搜索框本身是本地 state——由 URL 驱动的受控输入会在路由 transition 里丢字。左滑删除删的是这条的全部 history 行和全部卡（复习日志保留，缓存绝不动）；段落删的是 capture。「+ add」走 `addWordSenses()` / `addTranslationCard()`，都会先查重。空状态的图标要 `display: block; margin: 0 auto`——Tailwind preflight 把 svg 设成块级，`text-align: center` 居中不了
- **统计**（Stats，`/stats`，BottomNav 第四个 tab，仿 wordloom 的"统计"）：`loadStats()`（`src/db/stats.ts`）从本地 `review_items` / `review_logs` 和复习设置现算，只读、不建汇总表，`useLiveQuery` 驱动。口径一律跟已有页面对齐，别另起一套：连续天数取 `getReviewOverview()`；到期预测的 Today 是今天这一轮还剩的 Due + Learning、Tomorrow 就是复习页的 Tomorrow，第三天起才按 `due_at` 数，新卡不算（何时出由每日上限决定）；首答记住率 = 每张卡当天第一次作答没按 Again，同复习页；词的状态走 `entryStatus()`、已掌握走 `isMature()`，同词库；真实保持率只算作答时处于 Review 状态的日志。图表是 `src/components/Charts.tsx` 里手写的 SVG（不引图表库）：按容器宽度画，点 / 横滑 / 悬停 / 方向键选中一列，数字写在图上方的读数里，带表格切换。配色是验证过的一条琥珀色阶：卡片状态 新 = 灰轨道、学习中 `--amber-400`、复习中 `--amber-700`、已掌握 `--amber-950`，热力图 400 / 600 / 700 / 950，单一数据的图只用 600。相邻的 400 和 600 正常视力下都难分，不能当堆叠图的两段——每日复习量因此只分 Due（700）和 Learning（400）
- 会话页根节点的 `onMouseDown` 拦掉了按钮的鼠标聚焦：桌面浏览器会把焦点留在点过的按钮上，之后按 Enter 按的是它（再折一次"中文"、再撤一张卡），而不是检查 / 评分。别删；键盘 Tab 聚焦不受影响
- **一张复习卡 = 一个义项**：`WordSnapshot.sense` 存单个 `Definition`，卡片身份是 `senseKey()`（词 + 释义原文）。拆分之前的老卡片带的是 `definitions: Definition[]`，**不迁移**——用 `snapshotSenses()` 读，两种形状都能渲染。新增入口：`addWordSense()`；查词页底栏和浮层的"全部加入"走 `addWordSenses()`——仍是一个义项一张卡，且写入前会重新读复习本、跳过已有的义项（别的设备可能刚同步过来），重复点不会产生重复卡
- 查词页右上角的重新生成走 `generateWord()`：直接调 LLM 并覆盖本地和共享缓存（全体用户可见）。`lookupWord()` 会先命中缓存，永远不会重新生成
- `word_cache` 带 `schema_version`（`WORD_CACHE_SCHEMA`，当前为 2）。给 prompt 加字段时把它 +1，且新字段必须可选：共享缓存里的旧条目不会批量重生成（每次都是付费调用），渲染必须能降级。`markTarget()`（`src/utils/highlight.ts`）就是这么处理缺 `target` 的老例句的
- 多词短语整体查询：例句和译文里的 chunk 用 `.clickable-chunk` 标成一个整体，点 "pull off" 查的是短语而不是 "pull"。单个词仍可点，但不加任何装饰——每个词都画线，整段就没法读了
- **`src/main.tsx` 里的 `import { registerSW } from 'virtual:pwa-register'` 不能删**：`injectRegister` 默认 `auto`，只要没有任何源码 import 这个虚拟模块，vite-plugin-pwa 就退回去生成一段光秃秃的 `dist/registerSW.js`（只有一句 `navigator.serviceWorker.register`）。那样新 worker 装上也没人刷新页面，用户会一直停在旧版本。删掉时构建不报错，只有线上更不动——`registerSW()` 的 autoUpdate 分支才带 `location.reload()`
- iOS 把独立 PWA 挂起后唤醒不触发 `load`，所以 `onRegisteredSW` 里挂了 `visibilitychange` → `registration.update()` 主动查更新；`public/_headers` 给 `sw.js` / `index.html` / `manifest.webmanifest` 配了 `Cache-Control: no-cache`，`sw.js` 被 HTTP 缓存挡住的话整条更新链路就断了
- 环境变量：`VITE_FIREBASE_*` + `VITE_PROXY_URL`（本地开发写 `.env.local`）
- 移动端优先（375px 基准宽度），桌面端居中显示，最大宽度 430px
- **每个整屏的根节点用 `.screen`（`src/index.css`），别再手写 `height: 100dvh` 的容器**：`index.html` 的 `viewport-fit=cover` 让页面一直铺到状态栏和刘海下面，而 iOS 会在那一带画自己的毛玻璃状态栏——顶栏的标题和按钮要是从 y=0 开始，就被糊在里面看不清。`.screen` 在顶部垫了 `env(safe-area-inset-top)`（底部同理：`BottomNav` 和各页滚动区垫的是 `env(safe-area-inset-bottom)`）。桌面和系统本来就把页面放在状态栏下面的场景，这个值是 0，什么都不会动。`apple-mobile-web-app-status-bar-style` 保持 `default`：别的项目报告过，iOS 26.1 起 `black-translucent` 会在状态栏上叠一层页面关不掉的系统渐变 / 模糊；这个值是**添加到主屏幕时**读的，改了要删掉图标重新添加才生效
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
| 13  | BottomNav 标签、词性标签（POS chip）、图表坐标轴 |
| 14  | 时间戳、分组标题、例句文本 |
| 16  | 音标、功能按钮、错误提示文字 |
| 17  | 正文、释义、Toast、按钮文字 |
| 18  | 输入框、列表项标题、主操作按钮 |
| 21  | 搜索输入框、复习卡的释义与作答输入框 |
| 23  | AppBar 标题（Glossy / Review / Library / Stats）、复习卡挖空句、统计格数字 |
| 29  | WordPopup 词头、复习完成屏标题 |
| 36  | 登录/注册 Logo、复习揭晓的词头、复习页今日数字、统计页保持率 |
| 39  | LookupResult 词头 |
| 42  | 复习介绍卡（IntroCard）词头 |

- **字体平滑**：`-webkit-font-smoothing: antialiased`
- **CSP**：`font-src 'self'`，不允许加载外部字体

## UI 参考

见 `docs/UI.md`，每个屏幕有详细的组件层级和交互描述。
颜色、字号、间距、圆角规范见 `docs/PRD.md` 附录 B。

## 完整文档

- `docs/PRD.md`：产品需求、数据模型、FSRS 调度规则、两个 LLM prompt 完整原文、所有屏幕说明、错误处理规范
- `docs/UI.md`：各屏幕的逐屏组件描述
