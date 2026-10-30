# Glossy 产品需求文档

> 一款面向泛兴趣英语学习者的 PWA，提供查词、翻译和基于记忆曲线的复习功能。

---

## 1. 产品概述

### 1.1 产品定位

Glossy 是一款专注于"查得到、记得住"的英语学习工具。区别于传统词典 App 只解决"查"的问题，Glossy 把用户每一次查词和翻译都自动沉淀为可复习的素材，通过 SM-2 间隔重复算法帮助用户真正掌握。

### 1.2 目标用户

泛兴趣英语学习者：

- 看美剧、油管、英文社交媒体时遇到生词需要查询
- 想用英文写邮件、评论、社交内容，需要地道表达
- 不是为了应试，而是为了长期提升英语能力
- 愿意注册一个邮箱账号，以换取跨设备同步

不要求任何技术背景：LLM 由服务端代理调用，用户不接触也无法配置 API key。

### 1.3 核心价值

- **查得快**：本地缓存所有查过的词，再次查询无需联网
- **翻得地道**：调用大模型生成三种风格的翻译（口语 / 正式 / 地道）
- **记得住**：基于 FSRS 算法的科学复习机制，把查过的词和翻译过的句子彻底掌握
- **数据安全**：账号体系由 Firebase Auth 管理；学习数据通过 Firestore 跨设备同步，规则确保仅本人可访问

### 1.4 设计原则

- **本地优先**：IndexedDB 缓存所有查询结果，离线依然可用；登录后通过 Firestore 实时同步到云端
- **极简克制**：UI 大量留白、低饱和、单一点缀色（琥珀橙）
- **不打扰**：无推送、无每日提醒、不强制打卡
- **诚实透明**：明确告知数据流向——LLM 请求经自建 Worker 代理转发，密钥不下发前端

---

## 2. 功能范围

### 2.1 MVP 功能清单

| 模块 | 功能 |
|------|------|
| 查词 | 输入英文单词，返回音标、多个释义、双语例句 |
| 词形还原 | 自动识别 running → run、better → good 等变形 |
| 发音 | 显示英美音标，提供发音按钮 |
| 翻译 | 输入中文，返回三种风格英文翻译 |
| 翻译内查词 | 翻译结果中可点击单词或短语弹出快速查询 |
| 复习本 | 用户主动加入的待复习条目集合；复习页只显示今天的队列与统计 |
| 复习会话 | 卡片式复习：单词卡打字作答、系统判定，句子卡心里翻译后自评；新卡先介绍再考，可撤销 |
| 评分调度 | 四档评分（Again/Hard/Good/Easy），FSRS 算法调度，每天新卡 / 复习有上限；单词卡按判定给出建议评分 |
| 复习设置 | 每天新卡数与复习数上限、目标保留率、最长间隔、学习 / 重学步骤、新卡顺序、自动发音；跟账号走，各设备一致 |
| 语境采集 | 粘贴遇到的英文段落，点单词或整条短语，查它在这句话里的意思，连同原句一起存成卡片 |
| 词库 | 查过的词、翻译过的句子、读过的段落都在这里，可搜索、按学习状态筛选、排序，可补加复习或删除（取代原来的历史记录） |
| 统计 | 学过的词、连续天数、卡片状态分布、真实保持率、学习日历、每天的复习量和首答记住率（30 / 90 天）、未来 30 天的到期预测、记忆强度分布、最难的词 |
| 账号与同步 | 邮箱注册登录，学习数据经 Firestore 实时跨设备同步 |
| 本地缓存 | 查过的词和翻译永久缓存，离线可查 |

### 2.2 不在 MVP 范围内

- 复习提醒推送
- 数据导出 / 导入
- 词典 API 集成（一律用 LLM 生成）
- 中译英查词、英译中翻译
- 多语种支持（仅中英）

---

## 3. 用户旅程

### 3.1 首次使用

1. 打开 PWA → 未登录，自动跳转至登录页（`/login`）
2. 点击"注册"链接，进入注册页（`/register`）
3. 填写邮箱和密码（至少 6 位）→ 点击注册
4. 注册成功后自动登录，跳转至首页
5. 直接开始第一次查词——无需任何配置

### 3.2 主线一：查词

1. 首页查词 tab，输入英文单词回车
2. 系统检查本地缓存
   - 命中 → 直接渲染（无需联网）
   - 未命中 → 调用查词 LLM，获得结果后写入缓存
3. 渲染结果屏：音标、发音按钮、3 个默认释义、可展开更多
4. 用户点某条释义上的 `+` 只加入这个义项；点底部的 "Add all N meanings" 一次加入全部义项（仍是一个义项一张卡）
5. 同时记录一条 history

### 3.3 主线二：翻译

1. 首页切到翻译 tab，输入中文句子回车
2. 系统检查本地翻译缓存（按中文哈希）
   - 命中 → 直接渲染
   - 未命中 → 调用翻译 LLM
3. 渲染三个风格卡片：Casual / Formal / Idiomatic
4. 每个英文版本中，LLM 标记的"值得学习的跨度"加可点击样式
5. 用户点击某个跨度 → 弹出底部抽屉浮层，显示该词的释义
6. 浮层内可逐条加入义项、一键加入全部义项，或"打开完整查询"
7. 翻译三个版本可全部加入复习本（一张卡片同时呈现三个版本）

### 3.4 主线三：复习页

1. 底部导航第二个 tab 进入复习页
2. 顶部是今天这一轮：Due / New / Learning 三个数 + "Start review"；有义项因"每个词每天一个义项"留到明天、老卡超出每天的复习上限、或新卡超出每天的新卡上限时，下方各有一行说明
3. 四格统计：今天复习了几次（其中几张是新卡）、首答记住率、明天到期、卡片总数；右上角是连续复习天数
4. 复习页不列卡片：浏览、搜索、筛选、删除都在词库（3.6）
5. 用户主动点击 "Start review" 进入复习会话

### 3.5 主线四：复习会话

1. 开场一次排好今天的队列：在学的卡（新卡的学习步骤、忘了在重学的）最先，到期的老卡（最快要忘的先）与新卡穿插；老卡和新卡每天各有上限（默认 200 / 20，在设置里改）；同一个词一天只出一个义项，其余留到明天
2. 新单词卡先出介绍卡：词头、音标、释义和之后要考的那句例句。"Got it, test me" 后隔 3 张再考；"I know this" 直接按 Easy 记
3. 单词卡：显示英文释义和挖空的句子（找不到能挖空的句子时只显示释义），用户**输入**这个词——句子要什么词形就输入什么词形。可以要提示（先中文，再首字母和长度），也可以点 "Don't know"
4. 系统判定：正确 / 拼写差一点 / 词形不对 / 答错 / 不知道，显示逐字母对比，并按结果给出建议评分
5. 句子卡：显示中文原句，用户在心里翻译，点 "Show answer" 看三个英文版本
6. 用户从四档评分中选一个（单词卡上建议的那档按 Enter 即可确认，也可以改选）
7. 系统用 FSRS 更新该卡（写入的正是按钮上显示的间隔）并写一条复习日志，每张都立即落库；还在学习步骤里的卡（新卡、评 Again 的卡）几分钟后再问一次
8. 可以撤销上一张：卡片恢复原样、那条日志删除，可以一路撤回本轮第一张
9. 全部完成后显示完成屏：复习次数、记住率、新学数、用时，以及这一轮没记住的词

### 3.6 主线五：词库

1. 底部导航第三个 tab 进入词库（Library；原来的历史记录，旧地址 `/history` 跳转过来）
2. 分 Words / Sentences / Passages 三栏：词按词头归成一行（查了几次、加了几个义项都只算一条），句子按原文，段落是 Read 里粘贴过的
3. 每栏都能搜索（词栏也搜释义）、按学习状态筛选（未加入 / 新 / 学习中 / 复习中 / 已掌握，段落没有）、排序（最近 / 字母 / 下次复习，段落没有"下次复习"）
4. 已加入的条目每张卡一格进度条，并显示下次复习时间；未加入的可点 "+ add" 补加
5. 左滑删除：删掉这个词或句子的查询记录和全部复习卡；共享缓存不动

### 3.7 主线六：复习设置

1. 设置页的 Review 一节：每天新卡数、每天复习数、目标保留率、最长间隔、学习步骤、重学步骤、新卡顺序、自动发音
2. 改了即存，跟账号走：换一台设备，排出来的队列和间隔都一样
3. 下一轮复习开始时生效；和默认值不同时可以一键恢复默认

### 3.8 主线七：统计

1. 底部导航第四个 tab 进入统计（Stats，仿 wordloom 的"统计"）：复习页只看今天，这里看长期
2. 顶部四格：学过的词（其中已掌握的）、连续天数（及最长纪录）、此刻的预测记住率、累计复习次数
3. 卡片按状态分成 新 / 学习中 / 复习中 / 已掌握；最近 30 天到期复习时的真实保持率，和目标保留率对照，明显偏低时建议少加新卡
4. 最近半年的学习日历；每天的复习量和首答记住率，可切 30 / 90 天
5. 未来 30 天每天到期多少张（今天、明天两格就是复习页上的数）；复习中的卡记忆能撑多久的分布；最难的词，点开回到词条
6. 每张图点一下（或横滑）读出那一天的数字，也能切成表格；全部从本机的复习记录现算，只读

---

## 4. 界面设计

### 4.1 整体风格

- 极简克制 + 单一点缀色（琥珀橙 #BA7517 / Amber 600）
- 大量留白、低饱和、0.5px 细边框
- 圆角统一使用 8px / 10px / 14px 三档
- 移动端优先，375px 宽度为基准
- 桌面端通过最大宽度限制居中显示

### 4.2 点缀色使用规则

琥珀色仅用于以下场景，确保每次出现都有"前进 / 成就"的明确语义：

- 底部导航当前 tab
- "加入复习本"主按钮
- 复习页的 "Start review" 按钮和连续天数徽章
- 复习卡前的进度指示
- 词性标签 pill
- 统计页的图表：一条琥珀色阶（400 / 600 / 700 / 950）由浅到深表示卡片从学到会、复习从少到多；只有一组数据的图只用 600

### 4.3 字体规则

- 标题：18px / 22px，font-weight 500
- 正文：13-14px，font-weight 400
- 辅助文字：11-12px，font-weight 400

### 4.4 屏幕清单

| 编号 | 屏幕 | 说明 |
|------|------|------|
| 1 | 首页 | 默认查词 tab，最近查询列表 |
| 2 | 查词结果 | 音标、释义、例句、加入复习本 |
| 3 | 翻译结果 | 三个风格卡片，可点击词标记 |
| 4 | 翻译内查词浮层 | 底部抽屉，单词释义 + 加入按钮 |
| 5 | 复习页 | 今天的队列与统计 |
| 6 | 复习会话（提问） | 新卡介绍；单词卡打字作答；句子卡心里翻译 |
| 7 | 复习会话（揭晓与评分） | 判定 + 逐字母对比 + 建议评分 + 撤销；完成屏 |
| 8 | 词库 | 词 / 句子 / 段落三栏，搜索 + 状态筛选 + 排序 |
| 9 | 设置页 | 账号信息 + 退出登录 + 复习设置 + 中文显示 |
| 10 | 登录 | 邮箱密码登录，未登录时的落地页 |
| 11 | 注册 | 邮箱密码注册 |
| 12 | 语境采集 | 粘贴进来的段落，单词和短语都可点，点开后是"它在这句话里的意思" |
| 13 | 统计 | 学习概况、卡片状态、保持率、日历、每日复习量与记住率、到期预测、记忆强度、最难的词 |

---

## 5. 数据模型

### 5.1 存储方案

使用浏览器 IndexedDB，通过 Dexie.js 封装，作为本地读写层和离线缓存。登录后通过 Firebase Firestore 实时同步用户数据（history、review_items、review_logs）；word_cache 和 translation_cache 由全部已登录用户共享读写。

### 5.2 表结构

#### word_cache（单词缓存）

主键：lemma（词原形）

| 字段 | 类型 | 说明 |
|------|------|------|
| lemma | string | 词原形，主键 |
| queried_form | string | 用户最初查询的形式 |
| phonetic_uk | string | 英式音标 |
| phonetic_us | string | 美式音标 |
| audio_url_uk | string | 英式发音音频地址（可选） |
| audio_url_us | string | 美式发音音频地址（可选） |
| definitions | json | 释义数组（含词性、语体、英义、中义、例句） |
| created_at | timestamp | 缓存写入时间 |
| schema_version | number | 由哪一版 prompt 生成（2 = 含 `register` / `target`）。旧条目没有这个字段，照常渲染 |

definitions 结构：

```json
[
  {
    "pos": "v.",
    "en": "to move quickly on your feet, faster than walking",
    "cn": "跑；奔跑",
    "register": "neutral",
    "examples": [
      { "en": "I ran for the bus and still missed it.", "cn": "我追着公交车跑，还是没赶上。", "target": "ran" },
      { "en": "He runs five miles before work every morning.", "cn": "他每天上班前跑五英里。", "target": "runs" }
    ]
  }
]
```

#### translation_cache（翻译缓存）

主键：source_hash（中文原文哈希）

| 字段 | 类型 | 说明 |
|------|------|------|
| source_hash | string | 中文原文 SHA-256 前 16 位 |
| source_text | string | 完整中文原文 |
| casual_en | string | 口语版本 |
| formal_en | string | 正式版本 |
| idiomatic_en | string | 地道版本 |
| idiomatic_note | string\|null | 地道版本说明（无成语时 fallback） |
| spans | json | 值得学习的跨度数组 |
| created_at | timestamp | 缓存写入时间 |

spans 结构：

```json
[
  {
    "text": "pull off",
    "category": "phrasal_verb",
    "version": "idiomatic",
    "note": "managed something difficult. Warm, and very common in speech."
  }
]
```

`note` 是后加的字段，旧翻译缓存里没有；没有 note 的 span 只高亮，不显示说明行。

#### history（查询历史）

主键：id（UUID）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | UUID |
| type | string | "word" 或 "translation" |
| ref_key | string | 对应缓存表的主键 |
| display_text | string | 列表展示用文本 |
| queried_at | timestamp | 查询时间，建索引 |

#### review_items（复习本）

主键：id（UUID）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | UUID |
| type | string | "word" 或 "sentence" |
| snapshot | json | 加入时的完整内容快照 |
| state | number | FSRS 状态：0 新卡 · 1 学习中 · 2 复习 · 3 重学，初始 0 |
| stability | number | 记忆稳定度（天）：可提取度降到 90% 要多少天，初始 0 |
| difficulty | number | 难度 1–10，第一次评分时确定，初始 0 |
| elapsed_days | number | ts-fsrs `Card` 的字段（已标记弃用），原样保存 |
| scheduled_days | number | 这次排定的间隔天数 |
| learning_steps | number | 学习步骤走到了第几步 |
| reps | number | 评分总次数 |
| lapses | number | 复习时忘掉（评 Again）的次数 |
| due_at | timestamp | 下次复习时间，建索引 |
| added_at | timestamp | 加入时间 |
| last_reviewed_at | timestamp | 上次复习时间，新卡为 null |

从 `state` 到 `lapses` 加上两个日期，就是 ts-fsrs 的 `Card`（日期存成毫秒时间戳）。建卡用
`newSchedule()`、读卡用 `withSchedule()` / `scheduleOf()`（`src/algorithms/fsrs.ts`），不要手写默认值。
SM-2 时代的卡片带的是 `ease_factor` / `interval_days` / `repetitions`，换 FSRS 时一次性重置成新卡（见 6.1.5）。

snapshot 结构（单词）：一张卡只教**一个义项**，所以 "run" 可以在复习本里出现好几次，
每次对应用户真正遇到过的那个意思。

```json
{
  "lemma": "run",
  "phonetic_uk": "/rʌn/",
  "phonetic_us": "/rʌn/",
  "sense": {
    "pos": "v.",
    "en": "to be in charge of something and make it work",
    "cn": "经营；管理",
    "register": "neutral",
    "examples": [...]
  }
}
```

卡片还可以带 `contexts`——用户自己遇到这个词的句子，来自 Read 标签的采集：

```json
{
  "contexts": [
    {
      "en": "The pay was fine, but everything was up in the air.",
      "target": "up in the air",
      "source": "Podcast · hiring episode",
      "capture_id": "…"
    }
  ]
}
```

`pickWordCard()` 优先拿 `contexts` 当提问的句子，词典例句退到后面，留给成熟卡当"没见过的新句子"。
`capture_id` 只是指回出处，**不是依赖**：段落删了，卡片里的句子副本还在。

拆分义项之前加入的老卡片是 `{ lemma, phonetic_uk, phonetic_us, definitions: [...] }`，
**不迁移**：替用户从多个义项里挑一个，等于悄悄丢掉其余的。`snapshotSenses()`
（`src/db/index.ts`）统一返回 `sense ? [sense] : definitions`，两种形状都照常渲染。

卡片身份是"词 + 该义项的英文释义原文"（`senseKey()`）。重新生成词条会改写释义措辞，
改写后的义项算作新卡——已有的那张仍保留用户当初学的那套说法。

snapshot 结构（句子）：

```json
{
  "source_text": "这件事说起来容易做起来难",
  "casual_en": "...",
  "formal_en": "...",
  "idiomatic_en": "..."
}
```

#### review_logs（复习日志）

主键：id（UUID）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | UUID |
| item_id | string | 对应 review_items.id |
| rating | string | "again" / "hard" / "good" / "easy" |
| state | number | 评分**前**卡片的 FSRS 状态；0 表示这是这张卡第一次评分 |
| reviewed_at | timestamp | 评分时间 |

SM-2 时代的日志（带 `prev_interval` / `new_interval`、没有 `state`）在换 FSRS 时全部删除。

#### settings（设置）

key-value 存储。除最后一行外都是本地专属，不参与 Firestore 同步：

| key | value | 用途 |
|-----|-------|------|
| `bootstrapped:{uid}` | 写入时间戳字符串 | 标记本设备已为该用户跑过一次 `pushLocalOnlyItems`。缺了它，登录前就存在的本地数据会被反复上传，把其他设备已删除的条目重新拉回来 |
| `fsrs_reset:{uid}` | 写入时间戳字符串 | 标记本设备已为该用户跑过一次 `resetSchedulesForFsrs`（SM-2 换 FSRS 的一次性重置，见 6.1.5） |
| `chinese_display` | `always` / `tap` / `never` | 中文何时出现，默认 `tap`（点了才显示）。设置页可改，见屏幕 9。因为不同步，它是"本机显示偏好"而非学习数据 |
| `review_settings:{uid}` | JSON 字符串（`ReviewSettings`） | 复习设置（见下）。它是学习设置，跟账号走：真本在 Firestore `users/{uid}/prefs/review`，这一行是 `subscribeReviewSettings` 写下的本地镜像；设置页改的时候先写这里、再整份写到 Firestore |

#### ReviewSettings（复习设置）

Firestore 路径 `users/{uid}/prefs/review`，一个文档。读出来的值都过 `normalizeReviewSettings()`：数字夹到范围内，步骤重新校验，坏值退回默认——文档由各设备上不同版本的应用写入，一个坏值不能卡住队列和调度器。

| 字段 | 类型 | 默认 | 范围 / 说明 |
|------|------|------|-------------|
| newPerDay | number | 20 | 0–500，每天新卡上限（见 6.2） |
| reviewsPerDay | number | 200 | 0–5000，每天到期老卡上限（见 6.2） |
| retention | number | 0.9 | 0.80–0.97，即 FSRS 的 request_retention |
| maxIntervalDays | number | 36500 | 1–36500 |
| learningSteps | string[] | `["1m", "10m"]` | 每步是正整数 + `m` / `h` / `d`；可为空（新卡直接按天排） |
| relearningSteps | string[] | `["10m"]` | 同上，给忘了的卡 |
| newOrder | `newest` / `oldest` | `newest` | 新卡顺序 |
| autoSpeak | boolean | false | 介绍卡出现、揭晓答案时读出单词 |

### 5.3 索引

- history.queried_at：按时间倒序取查询记录
- history.type：可选，类型过滤
- review_items.due_at：复习本今日待复习查询的关键索引
- review_items.type：按单词 / 句子取卡
- review_logs.item_id：查询某张卡的复习历史

### 5.4 Dexie schema 定义

```javascript
// v1 原样保留：就地改它不会触发升级，老用户永远拿不到新 store
db.version(1).stores({
  word_cache: 'lemma, created_at',
  translation_cache: 'source_hash, created_at',
  history: 'id, queried_at, type, ref_key',
  review_items: 'id, due_at, type, added_at',
  review_logs: 'id, item_id, reviewed_at',
  settings: 'key'
});

// v2 加入 captures（Read 标签读过的段落）。只是多一个 store，老数据不动，
// 因此不需要 upgrade 函数
db.version(2).stores({
  word_cache: 'lemma, created_at',
  translation_cache: 'source_hash, created_at',
  history: 'id, queried_at, type, ref_key',
  review_items: 'id, due_at, type, added_at',
  review_logs: 'id, item_id, reviewed_at',
  settings: 'key',
  captures: 'id, created_at'
});
```

#### captures（读过的段落）

主键：id（UUID）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | UUID |
| text | string | 粘贴进来的整段英文 |
| source | string\|null | 出处，用户自己填（"Podcast · hiring episode"） |
| chunks | json | `findChunks()` 找出的可整体点击短语，随段落缓存，重开不再花钱 |
| created_at | timestamp | 建索引，Read 标签和词库的 Passages 栏按它倒序 |

卡片里的语境（`WordSnapshot.contexts`）带 `capture_id` 指回这里，但**不依赖**它：
段落删掉后，卡片仍留着自己那份句子副本。

### 5.5 数据关系说明

- word_cache 和 translation_cache 是缓存表，永不失效，重复查询直接命中
- history 通过 ref_key 引用缓存表，避免冗余
- review_items 的 snapshot 字段冗余存储完整内容，与缓存解耦，确保用户加入时看到的内容稳定不变
- review_logs 撑起复习页的全部统计（今日复习数、新学数、记住率、连续天数）、统计页的全部历史数字和每天的新卡上限；也为将来用自己的复习记录优化 FSRS 参数留着

---

## 6. 核心算法

### 6.1 FSRS 间隔重复调度

实现见 `src/algorithms/fsrs.ts`，算法来自 `ts-fsrs`（与 wordloom 同一版本、同一套参数）。

#### 6.1.1 记忆状态

FSRS 给每张卡一条自己的遗忘曲线：

- **stability（稳定度）**：可提取度从 100% 降到 90% 要多少天。答对时增长，忘了骤降
- **difficulty（难度）**：1–10，决定稳定度涨得多快
- **retrievability（可提取度）**：此刻想得起来的概率，由稳定度和距上次复习的天数算出，不存储
- **state**：New → Learning → Review；复习时忘了进入 Relearning，重学完回到 Review

#### 6.1.2 参数

前四项是默认值，用户可在设置页的 Review 里改（`ReviewSettings`，见 5.2）；`previewRatings(item, now, settings)` 每次按传入的设置取调度器，设置不变就复用同一个。

| 参数 | 默认值 | 说明 |
|------|--------|------|
| request_retention | 0.9 | 可提取度降到这个值时到期；可设 0.80–0.97 |
| learning_steps | 1m, 10m | 新卡的学习步骤，当天走完；可改、可为空 |
| relearning_steps | 10m | 忘了的卡重学的步骤；可改、可为空（为空时评 Again 直接按天排） |
| maximum_interval | 36500 天 | 可设 1–36500 |
| enable_short_term | true | 学习步骤按分钟计 |
| enable_fuzz | true | 间隔带一点随机，同一天学的卡不会扎堆在同一天到期 |
| 权重 w | ts-fsrs 默认值 | 还没有用自己的复习记录优化。可提取度由卡的稳定度、间隔天数和 w 算出，上面这些设置都不参与 |

#### 6.1.3 评分的效果

四档评分（Anki 风格），分钟数是默认步骤下的：

- **新卡**：Again 1 分钟、Hard 6 分钟、Good 10 分钟后再问（进入学习步骤）；Easy 直接毕业，约一周后复习。Again 是第一步，Hard 是前两步的平均，Good 是下一步——步骤改了，这几个数跟着变
- **学习步骤中**：Good 进入下一步，最后一步 Good 毕业（约 2 天后复习）；Again 回到第一步
- **复习**：Hard / Good / Easy 按稳定度给出由短到长的间隔（天）；Again 进入重学，10 分钟后再问，`lapses` + 1。重学步骤设为空时，Again 直接按天排

#### 6.1.4 UI 上的间隔预览

揭晓答案时，`StudySession.reveal()` 用 `previewRatings()` 一次算出四档结果并缓存，四个按钮显示各自到期时间离现在多久（`formatInterval()`：`<1m`、`10m`、`5h`、`3d`、`1.5mo`、`2.1y`）。评分时 `rate()` 原样写入缓存的那一档——fuzz 是随机的，评分时重算会得到另一个间隔，按钮上的数字就不作数了。"I know this" 不经过揭晓，评分时才算。

#### 6.1.5 从 SM-2 换到 FSRS

换 FSRS 时按用户要求清空复习记录、全部从头开始。`resetSchedulesForFsrs()`（`src/db/firestore-sync.ts`）在登录后、`pushLocalOnlyItems()` 之后跑一次：

- 读服务端（先 `waitForPendingWrites`，再 `getDocsFromServer`），只动仍是 SM-2 形状的数据：卡片看 `needsReset()`（没有 `state`、带着 `ease_factor`、或 `due_at` 不是有限数），日志看有没有 `state`
- 卡片重置为新卡：`newSchedule(added_at)`，删掉 `ease_factor` / `interval_days` / `repetitions`；快照（词、义项、句子、翻译）不动
- SM-2 复习日志全部删除；连续天数和今天的统计随之归零
- 成功后在 `settings` 写 `fsrs_reset:{uid}`；失败（离线、规则没部署）下次登录重试

只动 SM-2 形状的数据，所以每台设备各跑一次是安全的；也必须每台都跑：旧版本离线时或在没刷新的旧标签页里写下的 SM-2 评分，只有那台设备自己等得到。重置落地之前，`withSchedule()` 把 SM-2 卡当新卡读；每次写 schedule 都顺手删掉 SM-2 字段，免得一张卡同时带两套字段、又被当成待重置。

### 6.2 复习卡形态

实现见 `src/algorithms/cards.ts`。单词卡一律给出英文释义，让学习者**输入**这个词；有句子就挖空，要输入的是这个词在句中该用的形式（ran / running / pulled it off）：

| 形态 | 条件 | 问什么 |
|------|------|--------|
| `cloze` | 默认，从第一次复习起 | 保存时那句话，目标词挖空，释义作提示 —— 从意思想出词和词形 |
| `fresh` | 成熟卡（Review 状态、stability ≥ 21 天）且可用的句子多于一条 | 同样挖空，换一句这张卡没用过的句子 —— 考的是词，不是那句话 |
| `bare` | 没有一句能定位到目标词（多为 schema 2 之前的老词条） | 只有释义，输入词头 |

不问 "What does it mean here?"：认出意思只要有个模糊印象就像是会了，自己评分时容易高估；挖空只有一个正确答案，打出来对不对由系统判定。

三种形态方向一致，都是从意思到词：`bare` 也不再亮出光秃秃的词头让人回忆意思——脱离语境地认单词，正是本产品想替换掉的背单词表习惯。

挖空前要先在句中找到这个词，所以只有能定位的句子才算"可用"。`markTarget()` 只匹配整词——"ran" 不会落在 "Fran" 里；老例句里的 "running" 会整个挖掉，而不是挖掉 "run"、把 "ning" 露在外面。

`fresh` 在可用句子之间轮换（`1 + (reps % (usable.length - 1))`）：用户自己采集的句子排在最前，成熟后轮到词典例句；忘了进入重学时回到原句。按需给义项生成额外例句还没做。

#### 作答判定

`judgeAnswer()`（`src/algorithms/answer.ts`）把输入和答案归一后比较（不分大小写；弯引号、各种横线、句末标点、多余空格抹平；连字符和空格可互换）：

| 结果 | 条件 | 建议评分 |
|------|------|----------|
| correct | 相同 | Good；用过提示则 Hard |
| wrong_form | 逐词还原成原形后相同，或打的是词头而句子要别的形式（strike → struck） | Hard |
| typo | 答案 ≥ 4 个字母且编辑距离 ≤ 1（≥ 8 个字母时 ≤ 2；相邻两字母对调算 1） | Hard |
| wrong | 其余 | Again |
| gave_up | 点了 "Don't know" | Again |

建议评分（`suggestRating()`）只是 RatingBar 上默认的那档，用户可以改——明知是手滑打错，照样可以给 Good。判定结果只用于当场显示，不落库。

句子卡不判定：三个版本都算对，心里译成哪种都行，仍由用户自评（见附录 A "句子复习不强制输入英文"）。

#### 每日队列

`buildDailyQueue()`（`src/algorithms/queue.ts`）在会话开场时按当时的复习设置一次排定，这一轮里改设置不影响它：

- 在学的卡（FSRS 的 Learning / Relearning：新卡的学习步骤、忘了在重学的）最先，按到期时间，全部出
- 到期的老卡按可提取度升序（最快要忘的先出）；新卡默认按 `added_at` 降序（刚查的先学；设置里选 oldest 时按这个词最早加入的时间升序），均匀穿插在老卡之间
- **每天的老卡上限 `reviewsPerDay`**（默认 200）：今天已经评过的复习也算（review_logs 里 `state` 为 Review 的），留下最快要忘的，其余留到明天（`reviewsWaiting`），算进明日到期
- **每天的新卡上限 `newPerDay`**（默认 20）：今天已经第一次评过的也算（review_logs 里 `state` 为 0 的），超出的留到以后（`newWaiting`）。换 FSRS 时整本重置成了新卡，不设上限就会同一天全部到期
- **每个词每天只出一张卡**：同一个词的几个义项，答案都是这个词，第一个一考，后面的就白送了。其余义项留到明天（`held`），卡片数据不变；今天已经复习过的词也算占过名额。在学的卡不受此限
- 会话中：新单词卡先出介绍卡，隔 3 张再考。评完仍在学习步骤里、且今天之内到期的卡放回队列，到点再出，到点的排在最前；别的卡都出完了，就提前出 20 分钟内到期的，不让会话停在等待上

### 6.3 词形还原（Lemmatization）

用户输入的单词可能是各种变形（running、ran、better、children），缓存键和 LLM 查询都需要归一化到原形。

实现方式：使用 compromise.js 等纯前端 NLP 库，本地完成 lemmatize，无需联网。

匹配优先级：

1. 原始输入直接命中 word_cache → 返回
2. lemmatize 后命中 word_cache → 返回，并在 UI 顶部提示"running 是 run 的现在分词"
3. 都未命中 → 用 lemma 调 LLM 查询

---

## 7. LLM 集成

### 7.1 调用链路

前端不直接调用 LLM，请求经自建的 Cloudflare Worker 代理转发：

```
前端 fetchViaProxy（src/api/llm.ts）
  → POST VITE_PROXY_URL，body { prompt, model }
    Authorization: Bearer <Firebase ID token>
  → Worker（worker/src/index.ts）
      用 Firebase JWKS 做 RS256 验签，校验 exp / aud / iss
      模型白名单 deepseek-chat / deepseek-reasoner，其余一律 400
  → DeepSeek /v1/chat/completions（stream: true，temperature 0.3）
  → Worker 把 SSE 的 delta 拼成 text/plain 流式返回
  → 前端边读边触发 onStream
```

代价是模型不再可插拔——换供应商得改 Worker 并重新部署，前端改不动。换来的是
`DEEPSEEK_API_KEY` 只存在于 Worker secret，永不下发浏览器，用户也就不必自备密钥。

### 7.2 用户配置项

设置页（屏幕 9）有两组用户配置：复习设置（`ReviewSettings`，见 5.2，跟账号同步）和中文显示（`chinese_display`，本机偏好）。

Base URL、API key、模型名均不可配置：密钥在 Worker secret 里，模型由 `getModel()`
硬编码为 `deepseek-chat`。

### 7.3 查词 Prompt

源文件 `src/prompts/lookup.ts`（以代码为准，改动请同步本节）。`{WORD}` 由 `buildLookupPrompt()` 替换为 lemmatize 后的原形，而非用户原始输入。

```
You are an English-Chinese bilingual dictionary for Chinese learners. Audience: general-interest learners who watch American shows, read social media, and listen to podcasts — not exam-focused.

Given an English word or phrase, return a dictionary entry as strict JSON.

Rules:
1. At most 5 definitions. Skip rare, archaic, or technical senses unless that's the primary usage.
2. Group by part of speech: definitions sharing a "pos" must be consecutive, never interleaved with another part of speech. Order the groups by how common that part of speech is for this word, and order senses within each group the same way — so the very first definition is still the most common sense overall.
3. Each definition:
   - "pos": standard abbreviation (n., v., adj., adv., prep., conj., phrasal v., idiom, etc.)
   - "en": clear English definition, under 15 words. This is what the learner reads INSTEAD of the Chinese, so lean on common words and everyday phrasing wherever you can. Never use the word being defined, and never explain it with a word harder than it.
   - "cn": natural Chinese equivalent; multiple options separated by 顿号 if needed
   - "register": exactly one of "neutral", "formal", "informal", "slang" — how this sense sounds to a native speaker
4. Each definition gets exactly 2 example sentences:
   - Natural, conversational — Netflix/YouTube level, not textbook
   - The two must show different situations, not one sentence reworded
   - Keep surrounding vocabulary simple (the example showcases THIS word)
   - No word limit — give it as much context as the sense needs to be unmistakable
   - "target": the word or phrase exactly as it appears in that sentence, inflection included ("ran", "running", "pulled off"). It must match the sentence character for character, or the app cannot highlight it.
   - Add a fluent Chinese translation (not word-for-word)
5. Provide both UK and US IPA in slashes.
6. Output ONLY the JSON. No preamble or markdown fences.

Schema:
{
  "phonetic_uk": "/.../",
  "phonetic_us": "/.../",
  "definitions": [
    {
      "pos": "v.",
      "en": "...",
      "cn": "...",
      "register": "neutral",
      "examples": [{ "en": "...", "cn": "...", "target": "..." }]
    }
  ]
}

Word: {WORD}
```

`register` 和 `target` 是 schema 2 新增的字段（`WORD_CACHE_SCHEMA`）。两者都是可选的：
`word_cache` 全体用户共享且永不过期，旧条目不会批量重生成——每次重生成都是一次付费调用。
少了 `target` 时，`markTarget()`（`src/utils/highlight.ts`）用 lemma 及其词形变化去匹配例句，
匹配不到就原样渲染，退化成改版前的样子。

响应不含 `word` 字段——lemma 由前端 `lookupWord()` 自己填入 `WordCache`，不用模型回显（见 `src/api/lookup.ts`）。

### 7.4 翻译 Prompt

源文件 `src/prompts/translate.ts`（以代码为准，改动请同步本节）。`{TEXT}` 由
`buildTranslatePrompt()` 替换为用户输入的中文原文。

```
You are an expert translator helping Chinese learners of English. Produce natural English translations in three distinct styles, plus learnable expressions.

Given Chinese text, produce three translations and a list of learnable spans.

Styles:
1. CASUAL: How a native speaker would say it in conversation or on social media. Contractions fine; common slang OK.
2. FORMAL: For professional email, news, or academic writing. No contractions; precise vocabulary; complete sentences.
3. IDIOMATIC: Uses an idiom, phrasal verb, or set expression that captures the spirit of the original — something a learner couldn't easily reach on their own. If no genuine idiom fits naturally, return the casual version with idiomatic_note "(no distinct idiomatic version available)".

All versions preserve the original meaning. Keep proper nouns in their original form.

Learnable spans (2–4 total, quality over quantity):
Identify expressions across all three versions worth studying:
- "phrasal_verb": e.g. "pull off", "get over"
- "idiom": e.g. "easier said than done", "on the same page"
- "useful_word": uncommon but practical single words, e.g. "mitigate", "seamless" — NOT common words like "good", "make"

For each span:
- "text": the exact text as it appears in that version, character for character, so the app can highlight it
- "category", and "version" ("casual" / "formal" / "idiomatic"). If a span appears in multiple versions, list it once in the most prominent one.
- "note": one line of simple English — what it means here and where it belongs (under 20 words). The learner reads this instead of a Chinese gloss, so use everyday words. e.g. "finished after a struggle. Modest, and very common in speech."

Output ONLY the JSON. No preamble or markdown fences.

Schema:
{
  "casual": "...",
  "formal": "...",
  "idiomatic": "...",
  "idiomatic_note": null,
  "spans": [{ "text": "pull off", "category": "phrasal_verb", "version": "idiomatic", "note": "..." }]
}

Chinese text: {TEXT}
```

与查词 prompt 同理，响应不含 `source` 字段——中文原文前端本来就有，不必让模型回显。
spans 上限也从 2-5 收到 2-4（均为 `8f17b13` 的提速改动）。

### 7.5 语境采集 Prompt

源文件 `src/prompts/capture.ts`，对应 Read 标签的两步。

**找出可整体点击的短语**（`buildChunksPrompt()`）：段落打开时跑一次，结果缓存进 `captures.chunks`，
重开或换设备都不再花钱。要求最多 8 条、逐字照抄原文（否则前端定位不到）、跳过单个词和初学者已经会的表达。
返回 `{ "chunks": [{ "text": "up in the air" }] }`；`findChunks()` 还会再过滤一遍——不含空格的、
在原文里找不到的，一律丢掉。

**解释它在这句话里的意思**（`buildSensePrompt()`）：每次点击跑一次，只解释**当前这一句**里的那个意思，
不做词典式罗列。除了英文优先的 `en`，还返回 `lemma`（词典形，供"Open full"跳转）、`pos`、`cn`、
`register`、`target`（在句中的原样拼写）。返回单个对象，不是数组。

这一步**不缓存**：答案取决于句子，换一句就是另一个答案。

### 7.6 解析健壮性

LLM 偶尔输出非纯 JSON 内容（前后多一句话、包裹 markdown 代码块）。前端解析逻辑：

1. 用正则剥离 `\`\`\`json` 和 `\`\`\`` 标记
2. 尝试 JSON.parse
3. 失败则重试一次（同样的请求）
4. 仍失败则向用户提示"AI 模型返回格式异常，请稍后重试"

### 7.7 错误处理

API 调用可能的失败场景及对应人话提示：

`src/api/llm.ts` 把所有失败归为 5 个 `GlossyErrorCode`，`getErrorMessage()` 负责映射：

| code | 触发条件 | 用户看到的提示 |
|------|----------|----------------|
| `unauthenticated` | 未登录（`firebaseAuth.currentUser` 为空） | 请先登录后再使用 |
| `timeout` | 请求超过 60 秒（`AbortSignal.timeout`） | 网络连接超时，请检查网络后重试 |
| `network` | fetch 抛错，或 `navigator.onLine` 为 false | 当前无网络连接，无法获取新内容 |
| `server` | 响应非 2xx（401 / 402 / 404 / 5xx 均归此类） | AI 模型服务暂时不可用，请稍后重试 |
| `parse` | 重试一次后仍无法 `JSON.parse` | AI 模型返回格式异常，请稍后重试 |

余额不足、模型名错误不再单独提示：密钥和模型都由 Worker 掌管，用户无从修正，
细分错误码只会造成困惑，一律并入 `server`。

### 7.8 安全性说明

- `DEEPSEEK_API_KEY` 只存在于 Cloudflare Worker secret（`wrangler secret put` 设置），
  不写进 `wrangler.toml`，也永不下发前端
- Worker 只接受 POST，且必须携带有效的 Firebase ID token——用 Firebase JWKS 做 RS256
  验签并校验 `exp` / `aud` / `iss`，未登录者无法借道白嫖 DeepSeek
- 模型白名单硬编码在 Worker 内，前端传入白名单外的 model 一律 400
- 用户数据按 `users/{uid}/` 隔离，`firestore.rules` 限定仅本人可读写
- `word_cache` / `translation_cache` 由全体已登录用户共享读写——这是有意的成本优化
  （同一个词全网只调一次 LLM），代价是任何登录用户都能读写这两个 collection，
  因此其中不得存放任何用户私有信息，删除操作也绝不可级联到这里

---

## 8. 技术架构

### 8.1 技术栈

| 层 | 技术 |
|----|------|
| 框架 | React + Vite + TypeScript |
| 样式 | Tailwind CSS |
| 路由 | React Router |
| 本地数据库 | IndexedDB（通过 Dexie.js） |
| 云数据库 / 实时同步 | Firebase Firestore（persistentLocalCache + 多标签页管理） |
| 认证 | Firebase Auth（邮箱密码） |
| LLM 代理 | Cloudflare Worker（校验 Firebase ID token 后转发 DeepSeek，流式返回） |
| 词形还原 | compromise.js |
| PWA | Workbox（Service Worker） |
| 图标 | Lucide React |
| 部署 | 前端 Cloudflare Pages / Vercel / Netlify 任意；Worker 用 wrangler 单独部署 |

### 8.2 目录结构

```
/src
  /auth            Firebase Auth 上下文（AuthContext.tsx）
  /components      可复用 UI 组件
  /pages           页面级组件（Home、Lookup、Translate、Review、Library、Stats、Settings、Login、Register）
  /db              Dexie schema（index.ts）、查询层（queries.ts）、Firestore 同步层（firestore-sync.ts）、词库（library.ts）、统计（stats.ts）、设置（settings.ts）
  /algorithms      FSRS 调度、复习队列与会话等核心算法
  /api             调用 Worker 代理（llm.ts）与错误处理
  /prompts         查词与翻译的 prompt 文本（独立文件，便于迭代）
  /utils           lemmatize、hash 等工具函数
  firebase.ts      Firebase app 初始化（Auth + Firestore）
/worker
  src/index.ts     Cloudflare Worker：校验 Firebase ID token → 调用 DeepSeek → 流式转发
  wrangler.toml    Worker 配置（DEEPSEEK_API_KEY 是 secret，不在此文件里）
firestore.rules    Firestore 安全规则（需 firebase deploy 部署）
```

### 8.3 PWA 关键配置

- Service Worker 缓存静态资源，离线可访问
- manifest.json 配置图标、主题色
- iOS Safari 需用户手动"添加到主屏幕"才能完整体验
- 不做推送通知（产品决定）

### 8.4 API 调用骨架

前端只跟自己的 Worker 说话，不知道 DeepSeek 的存在：

```javascript
// src/api/llm.ts
async function fetchViaProxy(prompt, model, signal, onStream) {
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser) throw new GlossyError('Not authenticated', 'unauthenticated');

  const response = await fetch(import.meta.env.VITE_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await currentUser.getIdToken()}`
    },
    body: JSON.stringify({ prompt, model }),
    signal: AbortSignal.timeout(60_000)
  });

  if (!response.ok) throw new GlossyError(`HTTP ${response.status}`, 'server');

  // Worker 返回 text/plain 流，边读边拼
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    onStream?.();   // 首个 chunk 到达即把 UI 从"正在查询"切到"AI 正在回复"
  }
  return text;
}
```

外层 `callLLM` 负责 `JSON.parse`，失败时原样重发一次再放弃（见 7.5）。

---

## 9. 性能与体验目标

### 9.1 性能指标

- 首屏加载（PWA 已缓存）：< 1 秒
- 缓存命中的查词响应：< 100 毫秒
- LLM 调用的查词响应：deepseek-chat 流式返回，预期 1-3 秒（首字节到达即切换提示文案）
- LLM 调用的翻译响应：预期 2-5 秒
- 复习卡片切换：< 200 毫秒，包含 IndexedDB 写入

### 9.2 离线能力

- PWA 静态资源：完全离线可用
- 已缓存的查词和翻译：完全离线可用
- 复习功能：完全离线可用（所有数据本地）
- 新查词和新翻译：需要联网（调用 LLM）

---

## 10. 后续迭代方向

以下不在 MVP 范围，但作为产品演进方向记录：

### 10.1 短期（MVP 后 1-3 个月）

- 数据导出 / 导入（JSON 格式），用户换设备时手动迁移
- 设置项扩充：发音口音偏好（英 / 美）、字体大小、深浅色主题
- "重新生成"按钮：允许用户对当前查词或翻译结果调用 LLM 重新生成
- 复习卡片左右滑动手势

### 10.2 中期（3-6 个月）

- 复习提醒：基于浏览器 Notification API 的轻量提醒（用户手动开启）

### 10.3 长期（6 个月以上）

- 句子复习的"输入式"模式：让用户真打一遍英文翻译再对比
- 基于用户复习记录的个性化提示词调优
- 桌面端独立优化（分栏布局、键盘快捷键）
- 浏览器扩展形态：网页划词直接添加到 Glossy 复习本

---

## 11. 开放问题与待决策项

以下事项需要在开发过程中进一步决定：

| 项 | 待决策内容 |
|----|-----------|
| App 名称 | 当前用 Glossy 占位，正式发布前需确认 |
| 域名 | 部署到哪个域名 |
| 开源 / 闭源 | 是否开源代码托管 |
| Logo 与品牌 | 视觉品牌设计 |
| LLM 成本控制 | 代理由项目方付费，需要限流 / 配额策略，目前没有 |

---

## 附录 A：关键决策记录

记录产品设计过程中的重要决策与理由，便于后续回顾。

| 决策 | 理由 |
|------|------|
| word_cache / translation_cache 全体用户共享 | 同一个词全网只调一次 LLM，摊薄自建代理的调用成本 |
| PWA 而非原生 App | 一份代码跨平台，开发成本低，适合个人项目验证 |
| Firebase Auth + Firestore 同步 | 支持多设备无缝继续学习；IndexedDB 保留本地优先读写 |
| FSRS 而非 SM-2 | 按每张卡自己的遗忘曲线排期，同样的记住率下复习次数更少；`ts-fsrs` 现成可用，与 wordloom 同一套参数 |
| 四档评分而非六档 | Anki 已验证四档对用户更友好 |
| 翻译三个版本合并为一张复习卡 | 三个版本互相补充，分开复习割裂学习体验 |
| 句子复习不强制输入英文 | 降低复习门槛，避免用户因负担而放弃 |
| 释义和例句全部用 LLM 生成而非词典 API | 简化集成，统一风格，例句更生活化 |
| 所有查词记录进 history，仅主动加入的进复习本 | 区分被动留痕与主动学习意图 |
| 一张复习卡 = 一个义项 | 因为 "run a business" 查了 run，复习时却考 5 个不相干的义项——问题没有正确答案。加号落在每条释义上，卡片自然对应用户真正想记的那个意思 |
| 复习单词卡一律挖空，不问 "What does it mean here?" | 认出意思容易让人高估自己；挖空要求产出确切的词和词形，对错一眼可见，也更接近真正要用这个词的时候 |
| 单词卡打字作答，系统判定后给建议评分（仿 wordloom 的复习） | 打出来的词对不对，不靠自我感觉；判定区分"拼写差一点"和"词形不对"，比一句"错了"更有用。建议评分省掉犹豫，最终仍由用户决定 |
| 每个词每天只出一个义项 | 一个义项填过空，答案就是这个词，同一天再问它的别的义项等于白送；留到明天才是真回忆 |
| 换 FSRS 时清空复习记录、全部从头开始 | 用户的要求；SM-2 的易度和间隔换算不成 FSRS 的记忆状态。只重置调度、删掉日志，卡片内容一条不动；新加的字段不建索引，Dexie 不升版本 |
| 新卡每天默认最多 20 张，老卡 200 张，都可在设置里改 | 重置后整本都是新卡，不设上限就会同一天全部到期；20 是 wordloom 的默认值。老卡原本不设上限，200 在正常使用下碰不到，只在积压很多天之后把一天的量压住——留下的是最快要忘的 |
| 复习设置跟账号走，中文显示仍是本机偏好 | 上限、保留率、步骤决定的是排期本身，两台设备各用一套，同一张卡就会被排出两个间隔；中文显示只影响这台设备上怎么看 |
| 历史记录改成词库（仿 wordloom） | 按日期滚动的流水账找不到东西：词库按词归并，能搜、能按学习状态筛、能按下次复习排，复习页因此只留今天这一轮 |
| 词库左滑删除连卡带记录一起删 | 词库的一行代表"这个词"，只删查询记录、卡还在的话，这一行删完会原样再出现；复习日志保留，共享缓存绝不动 |
| 统计页从复习记录现算，不建汇总表（仿 wordloom 的统计） | 几千条日志在本地算一遍很快；汇总表要跨设备同步、要和日志保持一致，换来的只是省几毫秒。今天、明天的到期数直接用复习页的数，两页说法不会打架 |
| 统计图手写 SVG，不引图表库 | 只有柱、线、热力图三种，几百行就够；图表库动辄上百 KB，对一个手机上的 PWA 不划算 |
| 统计页不显示每天学习时长 | wordloom 有这张图，但 review_logs 不记作答用时；为一张图给每条日志加字段不值得 |
| "全部加入"仍是一个义项一张卡 | 只是省掉逐个点 `+`，不退回整词卡——复习时每张卡依然只有一个正确答案。按钮文案写明会加几条，因为折叠起来的、浮层没展示的义项也会一并加入 |
| 老卡片保留 `definitions` 而不迁移 | 替用户挑一个义项等于悄悄丢掉其余的；两种形状同时渲染成本很低 |
| 查词页的重新生成会覆盖共享缓存 | 词条一旦写坏或太单薄，对所有人都一样；这正是共享缓存的代价与好处 |
| 缓存数据与复习本快照解耦 | 避免缓存更新影响用户当初看到的复习内容 |
| Worker 内写死模型白名单 | 代理由项目方付费，不限制模型等于把账单敞开给任何登录用户 |
| LLM 经 Worker 代理而非前端直连 | 密钥不下发浏览器；用户无需自备 key，产品可面向非技术用户 |

---

## 附录 B：UI 设计规范摘要

### B.1 颜色

- 点缀色：琥珀橙 #BA7517 (Amber 600)
- 点缀色深：#412402 (Amber 900) 用于深色文字
- 点缀色浅：#FAEEDA (Amber 50) 用于强调背景

### B.2 字号

- h1：18px / 22px，weight 500
- h2：16px，weight 500
- 正文：13-14px，weight 400
- 辅助：11-12px，weight 400
- 大数字（如待复习数）：36px，weight 500

### B.3 圆角

- 小元素（按钮、tag）：8px
- 卡片：10px
- 大容器：14px
- 头像 / 圆形：50%

### B.4 间距

- 屏幕水平内边距：18px
- 卡片内边距：12px / 14px
- 列表项垂直间距：10px
- 段落间距：14px

### B.5 边框

- 默认：0.5px solid Border Tertiary
- 强调：0.5px solid Border Secondary
- 焦点：2px outline，琥珀色

---

文档版本：v1.0
最后更新：2026-05-07
