# Glossy 产品需求文档

> 一款面向泛兴趣英语学习者的 PWA，提供查词、翻译和基于记忆曲线的复习功能。

---

## 1. 产品概述

### 1.1 产品定位

Glossy 是一款专注于"查得到、记得住"的英语学习工具。区别于传统词典 App 只解决"查"的问题，Glossy 把用户每一次查词和翻译都自动沉淀为可复习的素材，通过 SM-2 间隔重复算法帮助用户真正掌握。

### 1.2 目标用户

愿意自行配置 AI 模型 API 的泛兴趣英语学习者：

- 看美剧、油管、英文社交媒体时遇到生词需要查询
- 想用英文写邮件、评论、社交内容，需要地道表达
- 不是为了应试，而是为了长期提升英语能力
- 有一定技术理解力，能够注册 AI 模型账号并获取 API key

明确不覆盖的用户：完全不愿配置 API 的非技术用户。

### 1.3 核心价值

- **查得快**：本地缓存所有查过的词，再次查询无需联网
- **翻得地道**：调用大模型生成三种风格的翻译（口语 / 正式 / 地道）
- **记得住**：基于 SM-2 算法的科学复习机制，把查过的词和翻译过的句子彻底掌握
- **数据安全**：账号体系由 Firebase Auth 管理；学习数据通过 Firestore 跨设备同步，规则确保仅本人可访问

### 1.4 设计原则

- **本地优先**：IndexedDB 缓存所有查询结果，离线依然可用；登录后通过 Firestore 实时同步到云端
- **极简克制**：UI 大量留白、低饱和、单一点缀色（琥珀橙）
- **不打扰**：无推送、无每日提醒、不强制打卡
- **诚实透明**：用户带自己的 API key，明确告知数据流向

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
| 复习本 | 用户主动加入的待复习条目集合 |
| 复习会话 | 卡片式复习，支持单词卡和句子卡 |
| 评分调度 | 四档评分（Again/Hard/Good/Easy），SM-2 算法调度 |
| 历史记录 | 所有查询自动留痕，可追溯、可补加复习 |
| API 配置 | 用户设置自定义 OpenAI 兼容 API |
| 本地缓存 | 查过的词和翻译永久缓存，离线可查 |

### 2.2 不在 MVP 范围内

- 复习提醒推送
- 数据导出 / 导入
- 词典 API 集成（一律用 LLM 生成）
- 中译英查词、英译中翻译
- 学习统计仪表盘
- 多语种支持（仅中英）

---

## 3. 用户旅程

### 3.1 首次使用

1. 打开 PWA → 未登录，自动跳转至登录页（`/login`）
2. 点击"注册"链接，进入注册页（`/register`）
3. 填写邮箱和密码（至少 6 位）→ 点击注册
4. 注册成功后自动登录，跳转至首页
5. 首页显示空状态卡片："请先配置 AI 模型"
6. 点击进入设置页，填入 API 配置（base URL、API key、两个模型名）
7. 保存返回首页，开始第一次查词

### 3.2 主线一：查词

1. 首页查词 tab，输入英文单词回车
2. 系统检查本地缓存
   - 命中 → 直接渲染（无需联网）
   - 未命中 → 调用查词 LLM，获得结果后写入缓存
3. 渲染结果屏：音标、发音按钮、3 个默认释义、可展开更多
4. 用户可点击"加入复习本"按钮，将该词加入复习池
5. 同时记录一条 history

### 3.3 主线二：翻译

1. 首页切到翻译 tab，输入中文句子回车
2. 系统检查本地翻译缓存（按中文哈希）
   - 命中 → 直接渲染
   - 未命中 → 调用翻译 LLM
3. 渲染三个风格卡片：Casual / Formal / Idiomatic
4. 每个英文版本中，LLM 标记的"值得学习的跨度"加可点击样式
5. 用户点击某个跨度 → 弹出底部抽屉浮层，显示该词的释义
6. 浮层内可"加入复习本"或"打开完整查询"
7. 翻译三个版本可全部加入复习本（一张卡片同时呈现三个版本）

### 3.4 主线三：复习本管理

1. 底部导航第二个 tab 进入复习本
2. 顶部琥珀色卡片显示"今日待复习 N 个"
3. 下方分单词 / 句子两个子 tab，列出所有已加入条目
4. 每条显示词或句子原文、下次复习时间、掌握程度（5 个圆点）
5. 用户主动点击"开始复习"进入复习会话

### 3.5 主线四：复习会话

1. 系统按 due_at 顺序加载今日待复习卡片
2. 卡片回忆面：
   - 单词卡 → 显示英文词
   - 句子卡 → 显示中文原句
3. 用户在心里回忆答案，点击"显示答案"
4. 卡片揭晓面：
   - 单词卡 → 显示音标、所有释义、例句
   - 句子卡 → 显示三个英文风格版本
5. 用户从四档评分中选择一个
6. 系统应用 SM-2 算法更新该卡的状态，写入 IndexedDB
7. 自动进入下一张卡，全部完成后显示完成屏

### 3.6 主线五：历史记录

1. 底部导航第三个 tab 进入历史
2. 按日期分组列出所有查询记录
3. 单词和翻译用 W/T 图标区分
4. 已加入复习本的标记 "added"，未加入的可补加

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
- "今日待复习"数字卡片
- 复习卡前的进度指示
- 词性标签 pill
- 设置页保存按钮

### 4.3 字体规则

- 标题：18px / 22px，font-weight 500
- 正文：13-14px，font-weight 400
- 辅助文字：11-12px，font-weight 400
- 代码 / API key 字段：等宽字体

### 4.4 屏幕清单

| 编号 | 屏幕 | 说明 |
|------|------|------|
| 1 | 首页 | 默认查词 tab，最近查询列表 |
| 2 | 查词结果 | 音标、释义、例句、加入复习本 |
| 3 | 翻译结果 | 三个风格卡片，可点击词标记 |
| 4 | 翻译内查词浮层 | 底部抽屉，单词释义 + 加入按钮 |
| 5 | 复习本 | 待复习卡片 + 列表 + 子 tab |
| 6 | 复习卡（回忆面） | 极简，单词或中文句子 |
| 7 | 复习卡（揭晓面） | 完整释义 + 四档评分按钮 |
| 8 | 历史记录 | 按日期分组的查询记录 |
| 9 | 首次空状态 | API 未配置时的引导卡片 |
| 10 | 设置页 | API 配置 + 安全说明 |

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
| definitions | json | 释义数组（含词性、英义、中义、例句） |
| created_at | timestamp | 缓存写入时间 |

definitions 结构：

```json
[
  {
    "pos": "v.",
    "en": "Move quickly on foot",
    "cn": "跑；奔跑",
    "examples": [
      { "en": "She runs every morning.", "cn": "她每天早晨跑步。" }
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
    "version": "idiomatic"
  }
]
```

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
| ease_factor | number | SM-2 易度因子，初始 2.5 |
| interval_days | number | 当前间隔天数，初始 0 |
| repetitions | number | 连续答对次数，初始 0 |
| due_at | timestamp | 下次复习时间，建索引 |
| added_at | timestamp | 加入时间 |
| last_reviewed_at | timestamp | 上次复习时间 |

snapshot 结构（单词）：

```json
{
  "lemma": "ephemeral",
  "phonetic_uk": "/ɪˈfem.ər.əl/",
  "phonetic_us": "/əˈfem.ər.əl/",
  "definitions": [...]
}
```

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
| prev_interval | number | 评分前的间隔 |
| new_interval | number | 评分后的间隔 |
| reviewed_at | timestamp | 评分时间 |

#### settings（设置）

key-value 单条记录存储

| 字段 | 类型 | 默认值 |
|------|------|--------|
| api_base_url | string | "https://api.deepseek.com/v1" |
| api_key | string | （空） |
| model_lookup | string | "deepseek-chat" |
| model_translate | string | "deepseek-chat" |

### 5.3 索引

- history.queried_at：历史 tab 时间倒序
- history.type：可选，类型过滤
- review_items.due_at：复习本今日待复习查询的关键索引
- review_items.type：单词 / 句子子 tab 切换
- review_logs.item_id：查询某张卡的复习历史

### 5.4 Dexie schema 定义

```javascript
db.version(1).stores({
  word_cache: 'lemma, created_at',
  translation_cache: 'source_hash, created_at',
  history: 'id, queried_at, type, ref_key',
  review_items: 'id, due_at, type, added_at',
  review_logs: 'id, item_id, reviewed_at',
  settings: 'key'
});
```

### 5.5 数据关系说明

- word_cache 和 translation_cache 是缓存表，永不失效，重复查询直接命中
- history 通过 ref_key 引用缓存表，避免冗余
- review_items 的 snapshot 字段冗余存储完整内容，与缓存解耦，确保用户加入时看到的内容稳定不变
- review_logs 不是 MVP 强需求，但建议保留以支持未来的统计和调试

---

## 6. 核心算法

### 6.1 SM-2 间隔重复算法

#### 6.1.1 状态变量

每张复习卡维护三个状态：

- `repetitions`：连续答对次数，初始 0，答错归零
- `interval_days`：当前间隔天数，初始 0
- `ease_factor`：易度因子，初始 2.5，最低 1.30

#### 6.1.2 评分映射规则

经典 SM-2 用 0-5 六档评分，本产品采用 Anki 风格四档：

##### Again（完全没记住）

- repetitions = 0
- interval_days = 0
- ease_factor = max(1.30, ease_factor - 0.20)
- due_at = 今天（当天再次出现）

##### Hard（记起来很费劲）

- repetitions += 1
- interval_days = max(1, round(上次 interval × 1.2))
- ease_factor = max(1.30, ease_factor - 0.15)

##### Good（顺利想起来）

- repetitions += 1
- 第 1 次：interval_days = 1
- 第 2 次：interval_days = 6
- 第 3 次及以后：interval_days = round(上次 interval × ease_factor)
- ease_factor 不变

##### Easy（毫不费力）

- repetitions += 1
- 先按 Good 计算 interval_days
- 再乘以 1.3 并取整
- ease_factor += 0.15

#### 6.1.3 算法实现

```javascript
function applyRating(item, rating) {
  let { repetitions, interval_days: i, ease_factor: ef } = item;

  if (rating === 'again') {
    repetitions = 0;
    i = 0;
    ef = Math.max(1.30, ef - 0.20);
  } else if (rating === 'hard') {
    repetitions += 1;
    i = Math.max(1, Math.round(i * 1.2));
    ef = Math.max(1.30, ef - 0.15);
  } else if (rating === 'good') {
    repetitions += 1;
    if (repetitions === 1) i = 1;
    else if (repetitions === 2) i = 6;
    else i = Math.round(i * ef);
  } else if (rating === 'easy') {
    repetitions += 1;
    if (repetitions === 1) i = 1;
    else if (repetitions === 2) i = 6;
    else i = Math.round(i * ef);
    i = Math.round(i * 1.3);
    ef = ef + 0.15;
  }

  return {
    repetitions,
    interval_days: i,
    ease_factor: ef,
    due_at: addDays(new Date(), i),
    last_reviewed_at: new Date()
  };
}
```

#### 6.1.4 UI 上的间隔预览

复习卡揭晓面的四个评分按钮上显示该评分对应的下次间隔（如 `<1m / 2d / 4d / 7d`）。这些数值实时计算，让用户的评分有可见后果。

### 6.2 词形还原（Lemmatization）

用户输入的单词可能是各种变形（running、ran、better、children），缓存键和 LLM 查询都需要归一化到原形。

实现方式：使用 compromise.js 等纯前端 NLP 库，本地完成 lemmatize，无需联网。

匹配优先级：

1. 原始输入直接命中 word_cache → 返回
2. lemmatize 后命中 word_cache → 返回，并在 UI 顶部提示"running 是 run 的现在分词"
3. 都未命中 → 用 lemma 调 LLM 查询

---

## 7. LLM 集成

### 7.1 协议规范

仅支持 OpenAI 兼容的 chat completions API。意味着以下服务都可以通过同一套代码调用：

- DeepSeek
- OpenAI
- Anthropic Claude（兼容端点）
- Moonshot Kimi
- 智谱 GLM
- OpenRouter（聚合多家模型）
- 本地 Ollama
- 任何其他 OpenAI 兼容的服务

### 7.2 用户配置项

| 项 | 说明 |
|----|------|
| Base URL | API endpoint，默认 https://api.deepseek.com/v1 |
| API Key | 用户的密钥，明文存 IndexedDB |
| Lookup Model | 查词用的模型名，默认 deepseek-chat |
| Translate Model | 翻译用的模型名，默认 deepseek-chat |

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
   - "en": clear, short English definition (under 15 words)
   - "cn": natural Chinese equivalent; multiple options separated by 顿号 if needed
4. Each definition gets exactly 1 example sentence:
   - Natural, conversational — Netflix/YouTube level, not textbook
   - Keep surrounding vocabulary simple (the example showcases THIS word)
   - No word limit — give it as much context as the sense needs to be unmistakable
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
      "examples": [{ "en": "...", "cn": "..." }]
    }
  ]
}

Word: {WORD}
```

响应不含 `word` 字段——lemma 由前端 `lookupWord()` 自己填入 `WordCache`，不用模型回显（见 `src/api/lookup.ts`）。

### 7.4 翻译 Prompt

```
You are an expert translator helping Chinese learners of English.
Your goal is to produce English translations that sound natural to
native speakers, with three distinct styles, and to flag expressions
worth learning.

Given a Chinese sentence (or short paragraph), produce three English
translations and a list of "learnable spans" found across them.

The three styles:

1. CASUAL: How a native English speaker would actually say this in
   everyday conversation, texting a friend, or commenting on social
   media. Contractions are fine. Allow common slang if appropriate.
   The goal is naturalness, not formality.

2. FORMAL: How this would appear in a professional email, business
   document, news article, or academic context. Full forms (no
   contractions for "don't" etc.), precise vocabulary, complete
   sentence structure.

3. IDIOMATIC: A version that uses an English idiom, phrasal verb, or
   set expression that captures the spirit of the Chinese original
   in a way the casual or formal versions don't. This is the version
   that teaches the learner something they couldn't easily reach
   themselves. If no genuine idiom fits naturally, return the casual
   version with a note "(no distinct idiomatic version available)"
   in idiomatic_note — never force a bad idiom.

Rules:
- All three versions should preserve the original meaning faithfully.
  Style differs; meaning does not.
- Keep each version to one or two sentences, matching the original's
  length unless the target language genuinely requires more or fewer
  words.
- Do not translate proper nouns into Chinese (keep names in original).

Learnable spans:
After producing the three translations, identify expressions across
all three versions that a Chinese learner would benefit from studying.
Three categories:
- "phrasal_verb": phrasal verbs (e.g., "pull off", "get over", "take on")
- "idiom": multi-word idioms or set expressions (e.g., "easier said
  than done", "on the same page", "a piece of cake")
- "useful_word": single words that are uncommon but practical (e.g.,
  "mitigate", "articulate", "seamless"). Do NOT include common words
  like "good", "very", "make", "the".

For each span, return:
- "text": the exact text as it appears in one of the translations
- "category": one of the three above
- "version": which version it appears in ("casual" / "formal" / "idiomatic")

If a span appears in multiple versions, list it once, picking the
version where it's most prominent. Aim for 2-5 spans total — not
every translation will have many. Quality over quantity.

Output ONLY the JSON. No preamble, no explanation, no markdown fences.

Schema:
{
  "source": "<original Chinese>",
  "casual": "...",
  "formal": "...",
  "idiomatic": "...",
  "idiomatic_note": null,
  "spans": [
    {
      "text": "pull off",
      "category": "phrasal_verb",
      "version": "idiomatic"
    }
  ]
}

Chinese to translate: {TEXT}
```

### 7.5 解析健壮性

LLM 偶尔输出非纯 JSON 内容（前后多一句话、包裹 markdown 代码块）。前端解析逻辑：

1. 用正则剥离 `\`\`\`json` 和 `\`\`\`` 标记
2. 尝试 JSON.parse
3. 失败则重试一次（同样的请求）
4. 仍失败则向用户提示"AI 模型返回格式异常，请稍后重试"

### 7.6 错误处理

API 调用可能的失败场景及对应人话提示：

| 错误 | 用户看到的提示 |
|------|----------------|
| 401 Unauthorized | API key 似乎不正确，请到设置页检查 |
| 402 / 余额不足 | 您的账户余额不足，请到 AI 模型提供商充值 |
| 404 模型不存在 | 模型名称似乎不正确，请到设置页检查 |
| 网络超时 | 网络连接超时，请检查网络后重试 |
| 5xx 服务异常 | AI 模型服务暂时不可用，请稍后重试 |
| JSON 解析失败 | AI 模型返回格式异常，请稍后重试 |

### 7.7 安全性说明

- API key 存储在用户浏览器 IndexedDB 中，明文存储
- 不做"前端加密"——加密密钥也存在用户能访问的地方，是自欺欺人
- 设置页明确提示用户："请勿在公共或共享设备上输入 API key"
- API 请求直接从前端发往用户配置的 endpoint，不经过任何第三方服务器

---

## 8. 技术架构

### 8.1 技术栈

| 层 | 技术 |
|----|------|
| 框架 | React + Vite |
| 样式 | Tailwind CSS |
| 路由 | React Router |
| 数据库 | IndexedDB（通过 Dexie.js） |
| 词形还原 | compromise.js |
| PWA | Workbox（Service Worker） |
| 图标 | Lucide React |
| 部署 | Cloudflare Pages / Vercel / Netlify 任意 |

### 8.2 目录结构建议

```
/src
  /components       UI 组件
  /pages           页面级组件（首页、查词、翻译、复习、历史、设置）
  /db              Dexie schema 与数据访问层
  /algorithms      SM-2 等核心算法
  /api             LLM API 调用与错误处理
  /prompts         查词与翻译的 prompt 文本（独立文件，便于版本管理）
  /utils           lemmatize、hash 等工具函数
  /styles          全局样式
```

### 8.3 PWA 关键配置

- Service Worker 缓存静态资源，离线可访问
- manifest.json 配置图标、主题色
- iOS Safari 需用户手动"添加到主屏幕"才能完整体验
- 不做推送通知（产品决定）

### 8.4 API 调用骨架

```javascript
async function callLLM(prompt, model) {
  const settings = await db.settings.get('config');

  const response = await fetch(`${settings.api_base_url}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.api_key}`
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    })
  });

  if (!response.ok) {
    throw mapHttpError(response.status);
  }

  const data = await response.json();
  const text = data.choices[0].message.content;

  return parseJSON(text);
}
```

---

## 9. 性能与体验目标

### 9.1 性能指标

- 首屏加载（PWA 已缓存）：< 1 秒
- 缓存命中的查词响应：< 100 毫秒
- LLM 调用的查词响应：取决于用户选择的模型，预期 1-3 秒
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

- 复习统计：连续打卡天数、本月复习量、掌握度分布
- 复习提醒：基于浏览器 Notification API 的轻量提醒（用户手动开启）
- 输入历史搜索：在历史 tab 内搜索已查询过的词或句子
- 复习本搜索

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
| 用户文档站点 | API 配置详细指南托管在哪里 |

---

## 附录 A：关键决策记录

记录产品设计过程中的重要决策与理由，便于后续回顾。

| 决策 | 理由 |
|------|------|
| 用户群定为泛兴趣学习者中愿意自配 API 的用户 | 避免承担 LLM 调用成本，保留产品长期可持续性 |
| PWA 而非原生 App | 一份代码跨平台，开发成本低，适合个人项目验证 |
| Firebase Auth + Firestore 同步 | 支持多设备无缝继续学习；IndexedDB 保留本地优先读写 |
| SM-2 而非 FSRS | SM-2 实现简单且经过验证，FSRS 复杂度过高 |
| 四档评分而非六档 | Anki 已验证四档对用户更友好 |
| 翻译三个版本合并为一张复习卡 | 三个版本互相补充，分开复习割裂学习体验 |
| 句子复习不强制输入英文 | 降低复习门槛，避免用户因负担而放弃 |
| 释义和例句全部用 LLM 生成而非词典 API | 简化集成，统一风格，例句更生活化 |
| 所有查词记录进 history，仅主动加入的进复习本 | 区分被动留痕与主动学习意图 |
| 缓存数据与复习本快照解耦 | 避免缓存更新影响用户当初看到的复习内容 |
| LLM 协议统一为 OpenAI 兼容 | 一份代码支持几乎所有主流 LLM 服务 |
| API key 不做前端加密 | 加密密钥也在前端，加密无意义且误导用户 |

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
