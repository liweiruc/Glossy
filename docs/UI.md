# Glossy — UI 组件描述

> 本文档描述每个屏幕的组件层级、交互行为和视觉细节，供开发时参考。
> 颜色、字号、间距等数值规范见 PRD 附录 B。

---

## 全局组件

### BottomNav（底部导航栏）

位置：固定在屏幕底部，所有主屏幕共用。

三个 tab，从左到右：

- **Home**：图标 `Home`，文字"Home"
- **Review**：图标 `BookOpen`，文字"Review"
- **History**：图标 `Clock`，文字"History"

样式规则：

- 每个 tab 竖排：图标在上（20px），文字在下（10px）
- 非激活状态：图标和文字均为次要文字色
- 激活状态：图标和文字均为琥珀橙 `#BA7517`
- 顶部边框：0.5px，边框三级色
- 背景：与屏幕背景同色，无阴影

### AppBar（顶部栏）

每个屏幕单独定义，参见各屏描述。通用规则：

- 高度约 48px，水平内边距 18px
- 左区：返回按钮（`ChevronLeft` 图标，20px）或页面标题
- 中区：页面标题（首页为 App 名"Glossy"，子页为页面名）
- 右区：操作图标（可选）

### Toast 提示

- 从屏幕底部 BottomNav 上方弹出，停留 2 秒后自动消失
- 背景：深色（`#1a1a1a`），文字白色，圆角 8px，水平内边距 16px，垂直 10px
- 文字：13px
- 示例："已加入复习本"、"已从复习本移除"

### 错误提示横幅

- 显示在 AppBar 正下方
- 背景：浅红色，左侧 3px 红色边框
- 图标：`AlertCircle`（红色，16px）+ 错误文字（13px）
- 支持手动关闭（右侧 `X` 图标）

---

## 屏幕 1：首页（Home）

### 布局

```
StatusBar
AppBar
  左：无
  中："Glossy"（18px weight500）
  右：Settings 图标（`Settings`，20px，次要色）
Body（padding 水平 18px）
  TabBar（查词 / 翻译）
  SearchBar
  RecentList
BottomNav（Home 激活）
```

### TabBar

- 两个 tab：**Lookup**（默认激活）和 **Translate**
- 下边框：整体 0.5px 三级边框色
- 激活 tab：底部 2px 实线，琥珀橙；文字正常色；weight 500
- 非激活 tab：文字次要色
- 切换时 SearchBar 的 placeholder 随之改变

### SearchBar

- 圆角 10px，背景：二级背景色
- 左侧 `Search` 图标（16px，三级文字色）
- 输入框：14px，无边框，背景透明
  - Lookup 状态 placeholder："Type an English word"
  - Translate 状态 placeholder："输入中文，获取地道英文翻译"
- 回车 / 点击搜索图标触发查询
- API key 未配置时：整个 SearchBar 置灰（opacity 0.5），不可交互

### RecentList

- 标题："Recent"（11px 全大写，三级文字色，字母间距 0.5px）
- 列表：最多显示 10 条，按 queried_at 倒序
- 每行：
  - 左：单词或中文句子截断（最多 20 字，超出省略号），14px 正常色
  - 右：相对时间（"2 min ago" / "today" / "yesterday"），11px 三级色
  - 底部：0.5px 三级边框色分隔线，最后一行无分隔线
- 点击某行：直接进入对应的查词结果或翻译结果页

### 空状态（API 未配置时）

替换 RecentList 区域，显示引导卡片：

- 背景：`#FAEEDA`（琥珀 50），圆角 14px，内边距 22px 18px
- 顶部图标：`Key`（22px，琥珀橙），放在 44px 圆形白色背景中，居中
- 标题："Set up your AI model first"（15px weight500，`#412402`）
- 描述："Glossy uses any OpenAI-compatible API to look up words and translate. Bring your own key — your data stays on your device."（12px，`#854F0B`，行高 1.5）
- 按钮："Open settings"（琥珀橙背景，白色文字，13px weight500，左侧 `ArrowRight` 图标）
- 卡片下方小字："DeepSeek, OpenAI, Claude, OpenRouter, Ollama, and most others all work."（11px，三级色，居中）

---

## 屏幕 2：查词结果（Lookup Result）

### 布局

```
StatusBar
AppBar
  左：ChevronLeft（返回首页）
  中："Lookup"（14px 次要色 weight400）
  右：MoreHorizontal 图标（预留，暂无功能）
Body（padding 水平 18px，可滚动）
  WordHeader
  LemmaHint（仅变形词时显示）
  DefinitionList
  ExpandButton（释义超过 3 条时显示）
CtaBar（固定底部）
```

### WordHeader

- 单词大字：30px，weight 500，字母间距 -0.5px，正常色
- 音标行（大字下方，margin-top 4px）：
  - 格式："UK /rʌn/" + `Volume2` 图标（14px 琥珀橙）+ 间距 + "US /rʌn/" + `Volume2` 图标
  - 点击 `Volume2` 图标：调用 Web Speech API 播放发音（UK/US 分别对应不同 lang 参数）
  - 字号：13px，次要色

### LemmaHint

- 仅当用户输入的是变形词时显示（如输入 "running" 查到 "run"）
- 样式：圆角 6px，二级背景色，内边距 6px 10px
- 文字："'running' is the present participle of run"（11px，三级色）

### DefinitionList

每个释义块（DefinitionBlock）包含：

- 词性 pill：
  - 文字：词性缩写（v. / n. / adj. 等），11px，斜体，`#854F0B`
  - 背景：`#FAEEDA`，圆角 4px，内边距 1px 7px
- 英文释义：13px，正常色，行高 1.45，margin-top 4px
- 中文释义：13px，次要色，行高 1.45，margin-bottom 6px
- 例句列表（1-2 条），每条 ExampleItem：
  - 左侧：2px 竖线，三级边框色
  - 英文行：12px，正常色，行高 1.5，斜体
  - 中文行：12px，次要色，行高 1.5
  - 竖线和文字间距：padding-left 8px

释义块之间：0.5px 三级边框分隔线，最后一块无分隔线。
默认展示前 3 个释义。

### ExpandButton

- 仅当 definitions 超过 3 条时显示
- 文字："Show X more meanings"（X 为剩余数量），12px，琥珀橙
- 居中，点击后展开全部，按钮消失

### CtaBar（固定底部）

- 顶部：0.5px 三级边框
- 按钮"Add to review"：
  - 全宽，圆角 10px，背景琥珀橙，白色文字，14px weight500
  - 左侧 `Plus` 图标（14px）
  - 点击后：写入 review_items，按钮变灰（二级背景色，次要文字色），文字改为"Added to review"，同时弹出 Toast"已加入复习本"
  - 已加入状态下再次点击：无操作

---

## 屏幕 3：翻译结果（Translate Result）

### 布局

```
StatusBar
AppBar
  左：ChevronLeft（返回首页）
  中："Translate"（14px 次要色 weight400）
  右：RefreshCw 图标（点击重新调用 LLM，覆盖缓存）
Body（padding 水平 18px，可滚动）
  SourceText（原文展示区）
  SectionTitle："Three versions"
  StyleCard × 3（Casual / Formal / Idiomatic）
CtaBar（固定底部）
```

### SourceText

- 背景：二级背景色，圆角 10px，内边距 12px
- 文字：14px，正常色，行高 1.5
- 不可编辑（只读展示）

### StyleCard

每张卡片（CardWrapper）：

- 边框：0.5px 三级边框色，圆角 10px，内边距 11px 12px，margin-bottom 10px
- 卡片顶部（CardHeader，flex 两端对齐）：
  - 左：风格标签（11px，全大写，字母间距 0.4px，`#854F0B`，weight 500）
    - 三个标签分别为："Casual" / "Formal" / "Idiomatic"
  - 右：`Plus` 图标（18px，三级色）；已加入后变为 `Check` 图标（琥珀橙）
- 卡片正文：
  - 14px，正常色，行高 1.5
  - LLM 返回的 spans 字段中标记的文字添加可点击样式：
    - 底部虚线下划线（`border-bottom: 1px dotted`，二级边框色）
    - 点击触发 WordPopup（见屏幕 7）
- Idiomatic 卡片特殊情况：
  - 若 `idiomatic_note` 不为 null，在译文下方显示一行小字（11px，三级色）："No distinct idiomatic version available"

### CtaBar（固定底部）

- 按钮"Add all to review"：
  - 将三个版本合并为一张句子卡加入 review_items（snapshot 包含三个版本）
  - 加入后变灰，文字改为"Added to review"
- 若用户已通过单张卡片的 `+` 图标加入（任意一张），CtaBar 按钮改为"Already added"并置灰

---

## 屏幕 4：翻译内查词浮层（Word Popup）

### 触发方式

用户点击翻译结果屏中带虚线下划线的词或短语。

### 布局

- 背景遮罩：`rgba(0,0,0,0.35)`，覆盖全屏，点击遮罩关闭浮层
- 浮层本体（Bottom Sheet）：
  - 固定在屏幕底部，left 14px，right 14px，bottom 14px
  - 背景：主背景色，圆角 16px，内边距 14px 16px 12px
  - 边框：0.5px 二级边框色

### 浮层内容（从上到下）

- **Handle**：32px × 3px 圆角矩形，三级边框色，居中，margin-bottom 12px
- **PopupHeader**（flex 两端对齐）：
  - 左：
    - 词或短语大字（22px，weight 500，正常色，字母间距 -0.3px）
    - 音标行（12px，次要色）+ `Volume2` 图标（琥珀橙，可点击播放）
  - 右：`X` 图标（20px，三级色，关闭浮层）
- **PopupDefinitions**：
  - 顶部 0.5px 分隔线
  - 显示前 2 个最常用释义（格式与屏幕 2 的 DefinitionBlock 相同，字号略小：英文 13px，中文 13px，例句 11px）
  - 若超过 2 个释义，不在浮层展示（引导用户点"Open full"查看）
- **PopupActions**（顶部 0.5px 分隔线，margin-top 12px，flex 横排）：
  - 主按钮"Add to review"：flex 1，琥珀橙背景，白色文字，13px weight500，左侧 `Plus` 图标（12px），圆角 8px，内边距 9px
    - 已加入后变灰，文字改为"Added"
  - 次按钮"Open full"：固定宽度，透明背景，0.5px 二级边框，12px 正常色，圆角 8px，内边距 9px 14px
    - 点击后：关闭浮层，导航到完整查词结果页（以该词为查询词）

---

## 屏幕 5：复习本（Review Book）

### 布局

```
StatusBar
AppBar
  左："Review"（18px weight500，正常色）
  右：Search 图标（复习本内搜索，MVP 可暂不实现）
Body（padding 水平 18px）
  DueCard（今日待复习卡片）
  SubTabBar（Words / Sentences）
  ReviewItemList（可滚动）
BottomNav（Review 激活）
```

### DueCard

- 背景：`#FAEEDA`（琥珀 50），圆角 14px，内边距 18px 16px，margin 6px 0 14px
- 内容居中：
  - 待复习数字：36px，weight 500，`#633806`，行高 1
  - 标签："due today"（12px，`#854F0B`，margin-top 4px）
  - 按钮"Start review"（margin-top 12px）：
    - 背景 `#BA7517`，白色文字，13px weight500，圆角 8px，内边距 9px 22px
    - 点击导航到复习会话（屏幕 6/7）
- 若今日无待复习项（due 数为 0）：
  - 按钮改为"All caught up!"，置灰不可点

### SubTabBar

- 两个 tab：**Words N**（N 为单词总数）和 **Sentences N**
- 样式：pill 形按钮，圆角 14px
  - 激活：背景 `#412402`（琥珀 900），白色文字，12px
  - 非激活：二级背景色，次要文字色，12px
- 切换后 ReviewItemList 内容随之过滤

### ReviewItemList

每行（ReviewItem）：

- flex 横排，两端对齐，padding 10px 2px，底部 0.5px 三级分隔线
- 左侧（Left）：
  - 词或句子原文（14px，正常色），超出截断加省略号
  - 下次复习时间（11px，三级色）：
    - 当天："due today"
    - 明天："due tomorrow"
    - N 天后："in N days"
    - 已逾期："overdue（红色）"
- 右侧（Right）：掌握程度圆点（5 个 `●`）
  - 亮点数 = min(repetitions, 5)
  - 亮色：`#BA7517`；暗色：三级边框色
  - 圆点大小：6px × 6px，间距 3px
- 长按或左滑显示"删除"操作（从复习本移除，不删除缓存）

---

## 屏幕 6：复习卡（回忆面）

### 布局

全屏复习模式，无 BottomNav。

```
StatusBar
AppBar
  左：X 图标（退出复习，返回复习本主屏）
  中：进度指示（如"3 / 12"，11px 次要色）
  右：空白占位（保持居中）
CardFront（flex-1，居中布局）
  ProgressHint
  MainContent（单词或中文句子）
  SubHint
  ShowButton
```

### CardFront

- 整个 Body 垂直水平居中
- **ProgressHint**：固定在卡片内容上方
  - 文字："recall the meaning"（单词卡）或 "translate this sentence"（句子卡）
  - 11px，三级色，margin-bottom auto（把内容推向中间）
- **MainContent**：
  - 单词卡：英文单词，42px，weight 500，正常色，字母间距 -1px
  - 句子卡：中文原句，18px，weight 400，正常色，行高 1.6，最大宽度 280px，居中
- **SubHint**："tap to reveal"（12px，三级色，margin-top 14px，margin-bottom 30px）
- **ShowButton**："Show answer"
  - 透明背景，0.5px 二级边框，圆角 8px，内边距 9px 22px，13px 正常色
  - 点击：卡片翻到揭晓面（动画：Y 轴 flip，duration 300ms）

---

## 屏幕 7：复习卡（揭晓面）

### 布局

```
StatusBar
AppBar（同回忆面）
CardBack（flex-1，可滚动）
  WordHeader 或 SentenceHeader
  DefinitionArea 或 TranslationArea
RatingBar（固定底部）
```

### 单词卡揭晓面

**WordHeader**（顶部，左对齐，padding 14px 18px 0）：

- 单词（24px，weight 500，正常色）
- 音标行（12px，次要色）+ `Volume2` 图标（琥珀橙，可点击）

**DefinitionArea**（padding 0 18px，可滚动）：

- 完整渲染用户加入时 snapshot 里的所有释义和例句
- 格式与屏幕 2 的 DefinitionBlock 相同（词性 pill + 英文释义 + 中文释义 + 例句）
- 注意：此处用的是 snapshot 快照，不是缓存中的当前数据

### 句子卡揭晓面

**SentenceHeader**（padding 14px 18px 0）：

- 中文原句（14px，次要色，行高 1.5）

**TranslationArea**（padding 0 18px，可滚动）：

- 三个版本纵向排列，每个版本：
  - 风格标签（11px 全大写，`#854F0B`，margin-bottom 5px）
  - 英文译文（14px，正常色，行高 1.5）
  - 版本间距：margin-bottom 14px
- 若 `idiomatic_note` 不为 null，在地道版本下方显示小灰字说明

### RatingBar（固定底部）

- 顶部：0.5px 三级边框
- 内边距：10px 14px 14px
- 四个评分按钮，`grid-template-columns: repeat(4, 1fr)`，gap 6px

每个 RatingButton：

- 圆角 8px，无边框，padding 10px 4px
- 上行：评分名称（11px，weight500）
- 下行：下次复习间隔预览（10px，opacity 0.75）
  - 由当前 item 状态实时计算，应用 SM-2 公式后得出
- 颜色方案：
  - **Again**：背景 `#FCEBEB`，文字 `#791F1F`
  - **Hard**：背景 `#FAEEDA`，文字 `#854F0B`
  - **Good**：背景 `#EAF3DE`，文字 `#27500A`
  - **Easy**：背景 `#E6F1FB`，文字 `#0C447C`
- 点击后立即：
  1. 调用 SM-2 算法更新 item 状态
  2. 写入 review_logs
  3. 将结果写入 IndexedDB（每张卡评分后立即持久化，不等到会话结束）
  4. 进入下一张卡（无需确认）

### 复习完成屏

全部卡片评分完毕后显示：

- 居中布局
- 图标：`CheckCircle`（绿色，48px）
- 标题："Session complete"（20px weight500）
- 统计：
  - "Reviewed: N"
  - "Remembered: N"（Good + Easy 的数量）
  - "Need more practice: N"（Again 的数量）
  - 字号 14px，次要色，行高 2
- 按钮"Back to review book"：导航回复习本主屏

---

## 屏幕 8：历史记录（History）

### 布局

```
StatusBar
AppBar
  左："History"（18px weight500）
  右：Filter 图标（预留，MVP 暂不实现）
Body（padding 水平 18px，可滚动）
  按日期分组的 HistoryList
BottomNav（History 激活）
```

### HistoryList

按 queried_at 日期分组，从新到旧。

**日期分组标题**（DayDivider）：

- 文字："Today" / "Yesterday" / 具体日期（如"May 6"）
- 11px，三级色，padding 10px 0 4px 2px

**HistoryItem**（每行）：

- flex 横排，垂直居中，gap 10px，padding 10px 2px，底部 0.5px 三级分隔线
- 左：类型图标（TypeBadge）
  - 28px × 28px，圆角 6px
  - 单词（W）：二级背景色，次要文字色，14px
  - 翻译（T）：`#FAEEDA` 背景，`#854F0B` 文字，14px
- 中（flex-1，min-width 0）：
  - 主文字：13px，正常色，单行截断省略（`white-space: nowrap; overflow: hidden; text-overflow: ellipsis`）
    - 单词：显示词原形（如"ephemeral"）
    - 翻译：显示中文原文（超长截断）
  - 副文字：11px，三级色，margin-top 1px
    - 显示相对时间（"2 min ago" / "1 h ago" / "yesterday"）
- 右（flex-shrink 0）：
  - 已加入复习本："added"（11px，三级色，不可点击）
  - 未加入："+ add"（11px，琥珀橙，可点击，点击后加入复习本并变为"added"）

---

## 屏幕 9：首次空状态（First Use）

即首页在 API key 未配置时的状态，见屏幕 1"空状态（API 未配置时）"章节，不重复描述。

---

## 屏幕 10：设置页（Settings）

### 布局

```
StatusBar
AppBar
  左：ChevronLeft（返回，保存后返回 / 未改动直接返回）
  中："Settings"（14px 次要色 weight400）
  右：空白
Body（padding 水平 18px，可滚动）
  SectionTitle："AI model"
  GuideCard（获取 API key 的步骤引导）
  Field × 4（Base URL、API Key、Lookup Model、Translate Model）
  SecurityNote
SaveBar（固定底部）
```

### GuideCard

- 背景：二级背景色，圆角 10px，内边距 12px 14px，margin-bottom 14px
- 标题行：`Info` 图标（14px，琥珀橙）+ "How to get an API key"（12px weight500，正常色）
- 步骤列表（`<ol>`，11px，次要色，行高 1.6，padding-left 16px）：
  1. Sign up at the provider's site
  2. Top up a small balance (a few dollars goes far)
  3. Create an API key in their dashboard
  4. Paste it below
- 底部链接："DeepSeek setup guide"（11px，琥珀橙）+ `ExternalLink` 图标（11px）
  - 点击：在新 tab 打开详细指引页（你需要自己创建这个指引页）

### Field（表单字段）

每个字段（FieldGroup）包含：

- **FieldLabel**（flex 两端对齐）：
  - 左：字段名（13px，正常色）
  - 右：必填标记 `*`（12px，红色）—— Base URL 和 API Key 有此标记
- **FieldInput**：
  - 全宽，二级背景色，0.5px 三级边框，圆角 8px，内边距 9px 11px，13px
  - URL 和 model 字段：等宽字体（`font-family: monospace`）
  - API Key 字段：
    - 默认 `type="password"`（内容显示为圆点）
    - 右侧有 `Eye` / `EyeOff` 图标切换明文/密文显示
    - 用 `InputWrapper`（position: relative）包裹，图标绝对定位在右侧
- **FieldHelp**（字段说明，margin-top 5px）：
  - 11px，三级色，行高 1.5
  - 各字段说明：
    - Base URL："The endpoint for an OpenAI-compatible API. Default is DeepSeek."
    - API Key："Stored only on this device. Never sent anywhere except to the API."
    - Lookup Model："Used for word lookups. A faster, cheaper model is fine here."
    - Translate Model："Used for sentence translation. A stronger model gives more natural results."

四个字段的默认值：

| 字段 | 默认值 |
|------|--------|
| Base URL | `https://api.deepseek.com/v1` |
| API Key | （空） |
| Lookup Model | `deepseek-v4-flash` |
| Translate Model | `deepseek-v4-pro` |

### SecurityNote

- flex 横排，gap 8px，二级背景色，圆角 8px，内边距 10px 12px，margin-top 14px
- 左：`ShieldCheck` 图标（16px，三级色，flex-shrink 0，margin-top 1px）
- 右：11px，次要色，行高 1.5
  - 文字："Your API key lives in this browser only. Don't enter it on a shared or public computer. Clearing site data will erase it."

### SaveBar（固定底部）

- 顶部：0.5px 三级边框
- 内边距：10px 18px 14px
- 按钮"Save"：
  - 全宽，琥珀橙背景，白色文字，14px weight500，圆角 10px
  - 左侧 `Check` 图标（14px）
  - 点击：将四个字段值写入 `settings` store，弹出 Toast"设置已保存"，返回上一页

---

## 交互状态汇总

| 状态 | 描述 |
|------|------|
| Loading | 调用 LLM 时，搜索框或翻译按钮显示 spinner，内容区显示骨架屏 |
| Error | AppBar 下方显示错误横幅，包含错误原因和重试建议 |
| Empty（复习本无内容） | 复习本列表显示空状态图："还没有加入复习的内容，查词或翻译后点击加入" |
| Empty（历史无记录） | 历史列表显示空状态图："还没有查询记录" |
| Offline（缓存命中） | 正常展示，无特殊提示 |
| Offline（需要 LLM） | 错误横幅："当前无网络连接，无法获取新内容" |
