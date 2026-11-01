# Glossy — UI 组件描述

> 本文档描述每个屏幕的组件层级、交互行为和视觉细节，供开发时参考。
> 颜色、字号、间距等数值规范见 PRD 附录 B。

---

## 全局组件

### BottomNav（底部导航栏）

位置：固定在屏幕底部，所有主屏幕共用。

四个 tab，从左到右：

- **Home**：图标 `Home`，文字"Home"
- **Review**：图标 `BookOpen`，文字"Review"
- **Library**：图标 `Library`，文字"Library"（原 History；旧地址 `/history` 重定向到 `/library`）
- **Stats**：图标 `ChartColumn`，文字"Stats"

样式规则：

- 每个 tab 竖排：图标在上（20px），文字在下（10px）
- 非激活状态：图标和文字均为次要文字色
- 激活状态：图标和文字均为琥珀橙 `#BA7517`
- 顶部边框：0.5px，边框三级色
- 背景：与屏幕背景同色，无阴影

### AppBar（顶部栏）

每个屏幕单独定义，参见各屏描述。通用规则：

- 高度约 48px，水平内边距 18px。这 48px 不含状态栏 / 刘海：屏幕根节点用 `.screen`（`src/index.css`），它在 AppBar 上方垫 `env(safe-area-inset-top)`。安装版 iOS app 里该值为 0——`index.html` 不写 `apple-mobile-web-app-status-bar-style`，状态栏归平台，页面本来就从其下沿开始画；垫高只是仍报告 inset 的环境（旧 iOS、横屏刘海）的兜底，详见 CLAUDE.md
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

- 三个 tab：**Lookup**（默认激活）、**Translate**、**Read**
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

### 粘贴框（Read tab）

- 与翻译框同款：二级背景、圆角 10px、内边距 10px 12px
- textarea：4 行，18px（段落比一个词长，21px 会把三行文字挤出屏幕），placeholder "Paste English you met — a line, a paragraph"
- 右下角按钮 "Read it"（琥珀橙，圆角 6px，`SendHorizontal` 13px）：写入一条 `captures` 记录并跳到 `/read/:id`
  - 段落在打开的那一刻就落库——它是接下来要被"开采"的东西，卡片也要指回它
- 不用回车提交：粘进来的本来就是多行文本

### RecentList

- 标题："Recent"（11px 全大写，三级文字色，字母间距 0.5px）
- 三个 tab 各看各的：Lookup / Translate 看 `history`，Read 看 `captures`
- 列表：最多显示 10 条，按时间倒序
- 每行：
  - 左：单词或中文句子截断（最多 20 字，超出省略号），14px 正常色
  - 右：相对时间（"2 min ago" / "today" / "yesterday"），11px 三级色
  - 底部：0.5px 三级边框色分隔线，最后一行无分隔线
- 点击某行：直接进入对应的查词结果或翻译结果页

### 空状态（尚无查询记录时）

首次登录、尚无任何查询记录时，RecentList 区域整块不渲染（`recent.length > 0` 才输出
`<section>`），页面只剩 TabBar 和 SearchBar。

不再有"请先配置 AI 模型"引导卡片——LLM 由 Worker 代理，用户无需配置，登录后即可直接查词。

---

## 屏幕 2：查词结果（Lookup Result）

### 布局

```
StatusBar
AppBar
  左：ChevronLeft（返回首页）
  中："Lookup"（14px 次要色 weight400）
  右：RefreshCw 图标（重新生成词条：直接调 LLM 并覆盖本地和共享缓存，转动动画表示进行中）
Body（padding 水平 18px，可滚动）
  WordHeader
  LemmaHint（仅变形词时显示）
  DefinitionList
  ExpandButton（释义超过 3 条时显示）
底栏（固定底部）：回执（刚加入过才有）+ 全部加入按钮
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

每个释义块由 `SenseBlock`（`src/components/SenseBlock.tsx`）渲染，查词页、翻译浮层、语境采集页、复习介绍卡共用同一个组件（`size="full"` / `"compact"` / `"answer"` / `"intro"` 只改字号）：

- 首行：词性 pill + 语体标签 + 右侧操作槽（`action`）
  - 查词页和浮层往 `action` 里放 `AddSenseButton`：18px 的 `Plus`（三级色），点击后变成琥珀色 `Check`；图标虽小，点击区域是 44px
  - 词性 pill：词性缩写（v. / n. / adj. 等），14px（compact 13px），斜体，`#854F0B`，背景 `#FAEEDA`，圆角 4px，内边距 1px 7px
  - 语体标签：`register` 不是 `neutral` 时才显示（formal / informal / slang），14px，三级文字色
- 英文释义：17px，正常色，行高 1.45，margin-top 4px —— 这是学习者真正要读的一行
- 中文：默认不渲染。`chinese_display` 为 `tap`（默认）时，释义下方是一个 26px 高的"中文"chip（13px，三级色，0.5px 边框，圆角 8px），点开才展开中文释义和例句中文；`always` 直接展开且不出现 chip；`never` 完全不展示中文
- 例句列表（schema 2 起每个义项 2 条），每条：
  - 左侧：2px 竖线，三级边框色，与文字间距 8px（compact 6px）
  - 英文行：16px（compact 14px），正常色，行高 1.5，斜体；句中的目标词用 600 字重 + 2px 底线标出（`markTarget()` 定位，缺 `target` 的老缓存回落到 lemma 匹配，匹配不到就不标）
  - 中文行：同字号，次要色，跟着"中文"chip 一起显隐

释义块之间：0.5px 三级边框分隔线，最后一块无分隔线。
默认展示前 3 个释义。

### ExpandButton

- 仅当 definitions 超过 3 条时显示
- 文字："Show X more meanings"（X 为剩余数量），12px，琥珀橙
- 居中，点击后展开全部，按钮消失

### 底栏（固定底部）

每条释义上的 `+` 加的是那一条；底栏的按钮一次加入剩下的全部。两者造出来的卡完全一样——仍是一个义项一张卡（`addWordSenses()`），"全部加入"只是省掉逐个点 `+`，不是退回整词卡。

- 顶部：0.5px 三级边框，内边距 10px 18px 14px；词条载入后常驻
- **回执**（刚加入过才出现，在按钮上方）：
  - 左：`Check` 图标（16px，琥珀橙）
  - 中：第一行"Added to review"（17px，正常色）；第二行是刚加入的义项（14px，次要色，超出截断），一次加入多条时改为"4 meanings of run"
  - 右："Undo"（17px，琥珀橙，带 `Undo2` 图标）——撤销最近一次操作：单个 `+` 就删那一张，"全部加入"就删这一批，并把对应的 `+` 恢复
  - 重新生成词条时回执消失：措辞变了，回执指的卡片也就对不上了
- **全部加入按钮**（`AddAllButton`，与翻译页 CtaBar 同款：全宽，琥珀橙背景，白字 18px weight 500，圆角 10px，内边距 12px，左侧 `Plus` 14px）：
  - 文案写明这一下会加几条——折叠在 "Show X more meanings" 里的义项也算：只有 1 条时 "Add to review"，2 条 "Add both meanings"，更多 "Add all 5 meanings"；已加过一部分时 "Add 3 more meanings"
  - 点击后展开全部释义，刚加入的每一条都带着 ✓ 出现在屏幕上
  - 写入前重新读一遍复习本，跳过已有的义项（别的设备可能刚同步过来），所以连点、重复点都不会产生重复卡
  - 全部已在复习本里：变灰，`Check` 图标，文字 "All meanings added"；此时若回执还在，按钮直接隐藏，免得两行说同一件事

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
  - 18px，正常色，行高 1.6
  - LLM 返回的 spans 中属于本版本的，整条短语标成一个可点单位（`.clickable-chunk`：二级背景、圆角 4px、内边距 1px 4px、2px 底线、`white-space: nowrap`）——点 "pull off" 查的是短语，不是 "pull"
  - 其余单词照样可点（`.clickable-word`），但不加任何装饰
  - 点击任一处触发 WordPopup（见屏幕 4）
- 说明行（每个带 `note` 的 span 一行，紧跟正文）：
  - 短语本身：正常色，weight 500；破折号后是一句简单英文，说明它在这里的意思和适用场合
  - 14px，次要色，行高 1.5，margin-top 8px
  - 老缓存里的 span 没有 `note`，此时只高亮、不出说明行
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
  - 主按钮（`AddAllButton` 的 compact 版）：flex 1，琥珀橙背景，白色文字，17px weight500，左侧 `Plus` 图标（12px），圆角 8px，内边距 9px
    - 一次加入这个词的全部义项（每个义项一张卡），包括浮层没展示的第 3 条以后——所以文案写明条数："Add all 5 meanings" / "Add both meanings" / 只有一条时 "Add to review"；已加过一部分时 "Add 3 more meanings"
    - 只想要某一个义项，用该义项行上的 `+`
    - 加入后弹 Toast（"Added 5 meanings to review"）；全部已在复习本里时变灰，文字改为 "All meanings added"（只有一条时 "Added"）
  - 次按钮"Open full"：固定宽度，透明背景，0.5px 二级边框，12px 正常色，圆角 8px，内边距 9px 14px
    - 点击后：关闭浮层，导航到完整查词结果页（以该词为查询词）

---

## 屏幕 5：复习本（Review Book）

仿 wordloom 的"复习"页：只看今天这一轮和统计，不列卡片——浏览、搜索、筛选、删除都在词库（屏幕 8）。页上的数字全部由现有的 `review_items` / `review_logs` 和复习设置现算（`getReviewOverview()`，`src/db/queries.ts`），只读不写。

### 布局

```
StatusBar
AppBar
  左：日期（14px 三级色，如 "Thursday, October 29"）
      "Review"（23px weight500，正常色）
  右：StreakBadge（连续天数 > 0 时才有）
Body（padding 水平 18px，可滚动）
  TodayPanel（今天这一轮）
  StatGrid（2×2 统计格）
BottomNav（Review 激活）
```

### StreakBadge

- `Flame` 15px + "N-day streak"（14px weight500）
- 琥珀 50 底、琥珀 700 字，圆角 8px，内边距 5px 10px
- 连续天数：每天至少有一条 review_log 算一天，从今天往前数；今天还没复习就从昨天数起——一早打开不会显示"断了"

### TodayPanel

- 0.5px 二级边框，圆角 14px，内边距 16px
- 三列：**Due**（到期的老卡，每天上限 `reviewsPerDay`）/ **New**（从没复习过的卡，每天上限 `newPerDay`）/ **Learning**（还在学习步骤里的卡：新卡刚学、或忘了在重学）——两个上限在设置页的 Review 里改（屏幕 9），默认 200 / 20
  - 标签 14px 次要色，数字 36px weight500
  - 数字来自 `buildDailyQueue()`（规则见屏幕 6 的"队列"），已经扣掉留到明天的义项，和进会话后的计数一致
- 有卡：按钮 "Start review"——`GraduationCap` 19px + 文字，琥珀橙底白字，18px weight500，高 46px，圆角 10px，占满宽度；点击进入复习会话（屏幕 6/7）
- 没卡：`PartyPopper`（琥珀橙）+ "All done for today"（17px 次要色），不可点
- 按钮下面最多三行说明（14px 三级色，居中），解释能学却不在今天这一轮里的卡：
  - 有义项被留到明天时："1 more meaning waits for tomorrow: one meaning per word a day"（多个时为 "N more meanings wait …"）——这些卡在词库里仍显示 due today / overdue / new
  - 老卡超出当天上限时："1 more review waits for tomorrow: 200 reviews a day"（多个时为 "N more reviews wait …"）。留在今天的是最快要忘的；其余算进 Tomorrow
  - 新卡超出当天上限时："1 more new card waits for later days: 20 new a day"（多个时为 "N more new cards wait …"）。换 FSRS 时整本卡都重置成了新卡，头几周这一行会一直在
  - 后两行里的数字是复习设置里的当前上限

### StatGrid

两列网格，gap 10px。每格是 `StatTile`（`src/components/StatTile.tsx`）：0.5px 二级边框，圆角 12px，内边距 12px 14px；标签 14px 次要色，数值 23px weight500，副标 13px 三级色（单行截断）。

| 格 | 数值 | 副标 |
|----|------|------|
| Reviewed today | 今天的评分次数（今天的 review_logs 条数） | "N new"：今天第一次复习的卡 |
| Recalled | 今天每张卡**第一次**作答没评 Again 的比例；今天还没复习时为 "—" | "first try today" |
| Tomorrow | 明天到期的老卡（学过的），加上今天被留到明天的老卡义项、超出今天复习上限的老卡；今天这一轮里的卡当作今天会做完。新卡不算，它们每天来多少由上限决定 | "card due" / "cards due" |
| Cards | 复习本卡片总数 | "N words · M sentences"（单复数随数目） |

记住率只算每张卡当天的第一次作答：学习步骤里的重问都在看过答案几分钟之后，算进去就虚高了。"N new" 数的是今天日志里评分前 `state` 为 0 的卡。

### 空状态（复习本一张卡都没有）

- 不显示 TodayPanel 和 StatGrid；居中，内边距 56px 12px
- `BookOpen` 36px 三级色（`display: block; margin: 0 auto`——Tailwind 的 preflight 把 svg 设成了块级，光靠 `text-align: center` 居中不了）
- "Nothing to review yet"（18px weight500）
- "Look up a word and add a meaning — it shows up here, ready to practice."（16px 次要色）
- 按钮 "Look up a word"（琥珀橙底白字，18px，圆角 10px）→ 首页

---

## 屏幕 6：复习会话（提问）

仿 wordloom 的"复习"：单词卡要**打出**这个词，系统判对错、给建议评分。会话逻辑在 `StudySession`（`src/algorithms/session.ts`），纯逻辑、不碰 React 和数据库，读写经注入的 `saveRating` / `undoRating`（`src/db/queries.ts`）。

### 布局

全屏，无 BottomNav。

```
StatusBar
SessionBar
  左：X（结束复习，回复习本；键盘 Esc）
  中：进度条（高 6px，圆角 3px，二级背景；琥珀橙填充 = Done / 本轮总数）
  右：Undo（Undo2 图标 + "Undo"，16px 次要色；没有可撤销的就隐藏；键盘 Ctrl/⌘+Z）
  第二行：New N · Review N · Learning N · Done N（13px 次要色，Done 为三级色，等宽数字）
Card（flex-1，可滚动，内边距 20px 18px 28px）
Footer（固定底部，0.5px 三级上边框）：按钮，或 RatingBar
```

鼠标点按钮不会把焦点留在按钮上（会话根节点的 `onMouseDown` 拦掉了），否则点过"中文"或 Undo 之后按 Enter，按的是那个按钮而不是检查 / 评分；Tab 照常能聚焦按钮。手机上点提示时软键盘也因此不会收起。

### 队列

开场时读一次复习设置（屏幕 9），由 `getTodayQueue(settings)` → `buildDailyQueue()`（`src/algorithms/queue.ts`）一次排定，会话中不再变——这一轮里改设置，下一轮才生效：

1. **Learning** 在最前：FSRS 状态为 Learning / Relearning、今天到期的卡，按到期时间，全部出——学习步骤必须当天走完
2. **Review**（复习过的老卡）按可提取度升序：FSRS 算出的此刻想得起来的概率，最快要忘的先出。**每天最多 `reviewsPerDay` 张**（默认 200），今天已评过的复习（日志里评分前 `state` 为 Review）也算，超出的计入 `reviewsWaiting`，留到明天
3. **New**（FSRS 状态 New）默认按 `added_at` 降序（`newOrder: 'newest'`）：刚查的词最想学；"全部加入"给主义项盖最晚的时间戳，所以主义项打头。设成 `oldest` 时按这个词最早加入的时间升序，同一个词内仍是主义项打头。**每天最多 `newPerDay` 张**（默认 20），今天已第一次评过的也算，超出的计入 `newWaiting`。新卡均匀穿插在老卡之间（`interleave()`），不攒到最后
4. **每个词每天只出一张卡**：`studyKey()` 按词头归并。一个义项填过空，答案就是这个词，再问它的别的义项等于白送。其余义项留到明天（`held`）——卡片一个字段都不改，只是今天不出。今天已经复习过的词（看今天的 review_logs）也算占过名额。Learning 的卡不受此限

会话中：

- 评完仍在学习步骤里、且今天之内到期的卡放回队列，计入 Learning，到点再出：默认步骤下新卡 Again 1 分钟、Hard 6 分钟、Good 10 分钟，复习卡评 Again 10 分钟。步骤在复习设置里改；重学步骤留空时，复习卡评 Again 直接按天排，不回到这一轮。到点的学习卡排在最前
- 复习设置开了 **Pronounce words** 时：介绍卡一出现、单词卡揭晓答案时读出这个词（句子卡不读）
- 别的卡都出完了，就提前出 20 分钟内到期的学习卡（learn ahead），会话不会停在等待上——卡少的时候，新卡学完一步会紧接着再问一次
- 新的单词卡先出 IntroCard，"Got it, test me" 之后隔 3 张（`INTRO_GAP`）再考
- 别的设备同步过来的新卡要等下一轮

### IntroCard（新卡第一次出现）

只给从没复习过的单词卡；居中排版。

- 标签胶囊（13px weight500，琥珀 50 底、琥珀 700 字，圆角 8px）：这个词还没有复习过的卡 → "New word"；复习过它的别的义项 → "New meaning"
- 词头 42px weight500，字间距 -1px + 发音按钮（`Volume2` 20px 琥珀橙）
- UK / US 音标（16px 次要色）
- 义项框（0.5px 二级边框，圆角 14px）：`SenseBlock size="intro"`——词性 14px、释义 21px、例句 18px。例句只放一句：就是之后挖空要用的那句
- 拆分义项之前的老卡（`definitions` 数组）：其余义项收在 "Other meanings on this card (N)" 折叠块里（`SenseBlock size="compact"`）
- Footer："I know this"（次按钮；直接按 Easy 记一次，不再考；键 K）+ "Got it, test me"（主按钮；键 Enter / Space）；P 发音

### WordCard（打字作答）

`pickWordCard()`（`src/algorithms/cards.ts`）选出题形态，三种都是输入**这个词**，只是题面不同：

| 形态 | 题面 | 要输入 |
|------|------|--------|
| `cloze` | 英文释义 + 挖空的句子 | 句子里的那个词形（struck、running） |
| `fresh` | 同上，换一句这张卡没用过的句子，顶行挂 "new sentence" 标签 | 同上 |
| `bare` | 找不到能定位目标词的句子：只有英文释义 | 词头本身 |

- 顶行：词性胶囊（14px 斜体，琥珀 50 底、琥珀 700 字）+ 语域（非 neutral 时，14px 三级色）+ `fresh` 的 "new sentence" 标签；右侧 `cardPrompt()`（14px 三级色）："fill in the missing word" / "fill in N words"，`bare` 为 "type the word" / "type the N words"
- 英文释义：21px，行高 1.4。这是题面，不走 `SenseBlock`（中文要藏到提示里）
- 句子框（有句子时）：0.5px 二级边框，圆角 14px，内边距 16px 18px；句子 23px 斜体，行高 1.6；目标词挖成 `inline-block` 空白，2px 正常色底线，宽度按答案长度估算（56–190px）——透露长度，不透露拼写
- 输入框（`.review-answer`）：高 54px，圆角 12px，21px 居中；2px 二级边框，聚焦时琥珀橙；关掉自动更正、自动大写、拼写检查，软键盘回车键为 "go"；进卡自动聚焦。占位文字 "Type the missing word"（`bare`："Type the word"）
- 按钮行（gap 8px）：
  - 提示（`Lightbulb` + 下一步提示的名字；二级背景、16px 次要色、高 42px；Ctrl+H）
  - "Don't know"（同样式；Ctrl+G）
  - "Check"（琥珀橙主按钮，高 42px，占满剩余宽度；Enter）。答案为空时点 Check 只让输入框抖一下
- 提示分两步，用完按钮消失：
  1. 中文：义项有中文、且 `chinese_display` 不是 `never` 时才有这一步；释义下方一行 `Lightbulb` + 中文（17px 次要色）
  2. 首字母 + 长度：输入框下方 "r _ _ _ _ _ _"（等宽 21px 次要色；多词答案每个词一组）
  - 用过提示，答对也只建议 Hard

### SelfCard（心里作答，自己评分）

- 句子卡：顶部 "translate this sentence"（14px 三级色），中文原句 23px 居中，行高 1.6
- 一个义项都没有的单词卡（无从出题，极少见）："recall the meaning" + 词头 42px
- Footer："Show answer"（次按钮，占满宽度；Enter / Space）

---

## 屏幕 7：复习会话（揭晓与评分）

### 单词卡揭晓

点 Check 或 Don't know 后，题面原地变成答案（淡入 0.15s），不翻页：

- 句子框里的空填回去：目标词加粗、琥珀 50 底——先看这句话要的是哪个词形
  - 例句有中文时下面挂"中文"chip（`chinese_display` 控制，与 `SenseBlock` 共用 `ChineseToggle`）；用户自己采集的句子没有中文，不显示
- **Verdict**（`judgeAnswer()`，`src/algorithms/answer.ts`），配色借用评分按钮，所以下面的建议评分不会出人意料：

| 结果 | 判定 | 显示 | 建议评分 |
|------|------|------|----------|
| correct | 与答案相同。先归一：不分大小写，弯引号、各种横线、句末标点、多余空格都抹平；连字符和空格可互换 | 绿：`CircleCheck` + "Correct" + 答案 | Good（用过提示则 Hard） |
| wrong_form | 逐词还原成原形后相同，或打的是词头而句子要别的形式 | 琥珀：`TriangleAlert` + "Right word, wrong form" + "The sentence needs this form." + 对比 | Hard |
| typo | 答案 ≥ 4 个字母且编辑距离 ≤ 1（≥ 8 个字母时 ≤ 2；相邻两字母对调算 1） | 琥珀："Almost — check the spelling" + 对比 | Hard |
| wrong | 其余 | 红：`CircleX` + "Not quite" + 对比 | Again |
| gave_up | 点了 Don't know | 红："The answer is" + 答案 | Again |

- 对比（两行网格，等宽 21px）："Yours" 一行，对不上的字母加 2px 下划线；"Answer" 一行加粗，对不上的字母衬白底。按码点比较，输入 emoji 也不会错位
- 词头框（0.5px 二级边框，圆角 14px）：词头 36px weight500 + 发音按钮 + 音标；义项的中文同样收在"中文"chip 后
- 老卡其余义项：同 IntroCard 的折叠块

### 句子卡揭晓

- 原句下方一条 0.5px 三级分隔线，之后是 casual / formal / idiomatic 三个版本（只列有内容的）
  - 风格标签 14px 全大写，`#854F0B`，margin-bottom 5px
  - 英文译文 18px 正常色，行高 1.5；版本间距 14px
- 句子卡不判对错，RatingBar 上没有建议

### RatingBar（固定底部）

- 四个按钮，`grid-template-columns: repeat(4, 1fr)`，gap 6px；圆角 10px，padding 10px 4px
  - 上行评分名称 16px weight500；下行这一档的下次间隔（`formatInterval()`：`<1m` / `10m` / `5h` / `3d` / `1.5mo` / `2.1y`），13px，opacity 0.75
  - 间隔在揭晓答案那一刻由 `StudySession.reveal()` 算好并缓存，评分时原样写入：FSRS 开了 fuzz，评分时重算会和按钮上显示的不一样
  - **Again** `#FCEBEB` / `#791F1F`，**Hard** `#FAEEDA` / `#854F0B`，**Good** `#EAF3DE` / `#27500A`，**Easy** `#E6F1FB` / `#0C447C`
- 建议的那一档：外圈 2px 描边，头顶挂 "Suggested" 小标签（13px，正常色底、反色字）。只是建议，点哪档都算
- 键盘：Enter = 建议的那档，1–4 = Again / Hard / Good / Easy，P = 发音
- 点下立即：
  1. 揭晓时算好的那一档 FSRS 状态由 `saveRating()` 写回卡片，并写一条 review_logs（带评分前的 `state`）——每张卡评完就落库，中途退出不丢进度
  2. 卡片若已在别的设备上被删：什么都不写、不计数、不进撤销栈——对已删除的卡 merge 写会把它复活
  3. 进入下一张，无需确认

### 撤销

- SessionBar 的 Undo 或 Ctrl/⌘+Z：回到上一张卡重新作答，可以一路撤回本轮第一张
- `undoRating()` 把卡片整套 FSRS 字段（`state`、`stability`、`difficulty`、`reps`、`lapses`……`due_at`、`last_reviewed_at`）恢复原样，删掉那条 review_log（本地 + Firestore）；卡片已被删就不写回
- 那次评分放回队列的学习步骤一并撤掉，统计同步回退
- 输入框里有字时，Ctrl+Z 撤的是打字，不是上一张卡

### 复习完成屏

- 居中：`PartyPopper` 44px 琥珀橙 + "Session complete"（29px weight500）；一开始就没有卡时是 "Nothing to review right now"，不显示统计
- 2×2 `StatTile`：
  - Reviewed：本轮评分次数（Again 后的重问也算）
  - Recalled：没评 Again 的比例
  - New：第一次复习的新卡数
  - Time：本轮用时（"45s"、"12 min"、"1 h 5 min"）
- 本轮评过 Again 的词列成 chip（17px，0.5px 二级边框，圆角 8px），上方一行 "These slipped this time — worth another look:"，点开去查词页
- Footer："Back to review"（主按钮，占满宽度）→ 复习页

---

## 屏幕 8：词库（Library）

路由：`/library`（旧的 `/history` 重定向过来），需登录。仿 wordloom 的词库：查过的、加进复习的、读过的都在这里，分词 / 句子 / 段落三栏，每栏都能搜、能筛、能排。数据由 `loadLibrary()`（`src/db/library.ts`）从本地 IndexedDB 现拼——history 和复习卡按词（词头小写）/ 句子（`hashText(source_text)`）归成一条，一个词查了五次、加了两个义项，也只是一行。

### 布局

```
AppBar（高 48px）
  左："Library"（23px weight500）
Body（padding 水平 18px，可滚动）
  TabPills（Words N / Sentences N / Passages N）
  SearchBox
  Filters（Status + Sort；Passages 只有 Sort）
  列表（Recent 排序时按天分组："Today" / "Yesterday" / "Oct 27"，14px 三级色）
BottomNav（Library 激活）
```

### TabPills

- pill 按钮，圆角 14px，内边距 5px 14px，16px，gap 8px
- 激活：背景 `#412402`（琥珀 900），白字；非激活：二级背景色，次要文字色
- 数字是这一栏的条目总数，不随搜索、筛选变

### SearchBox

- 高 44px，二级背景，圆角 10px；左 `Search` 16px 三级色，有字时右侧 `X` 清空
- placeholder 随栏目："Search words or meanings" / "Search sentences" / "Search passages"
- 不分大小写的子串匹配：词栏搜词头和所有已知义项的英文、中文释义；句子栏搜中文原文和译文；段落栏搜原文和出处
- 输入框用本地 state，同时写进 URL 的 `q`——由 URL 驱动的受控输入会在 React Router 的 transition 里丢字

### Filters

- 两个原生 `<select>` 并排各占一半：二级背景，圆角 10px，左侧图标（`ListFilter` / `ArrowDownUp`，16px 三级色），右侧 `ChevronDown`
- **Status**：All statuses / Not added / New / Learning / Reviewing / Mastered，每项带这一栏的条数（不计搜索）。状态按条目算（`entryStatus()`）：
  - 没有卡 → Not added
  - 有卡还在学习步骤里（Learning / Relearning）→ Learning
  - 全是新卡 → New
  - 全是成熟卡（Review 状态且 stability ≥ 21 天，`isMature()`）→ Mastered
  - 其余 → Reviewing
- **Sort**：Recent（最后一次查询或加入，新的在前，按天分组）/ A–Z / Next review（最早到期的在前；没学过的排在后面，按字母）
- Passages 没有 Status，也没有 Next review：从别的栏带过来的参数在这里不起作用（Next review 退回 Recent）
- tab、status、sort、q 都写在 URL 参数里（`replace`，不进历史栈），从结果页返回时停在原处

### 词 / 句子行

- flex 横排，gap 12px，padding 10px 2px，0.5px 三级分隔线；点击打开结果页（`/lookup/:lemma` 或 `/translate/:hash`，只走缓存，不调 LLM、不写 history）
- 左：词（18px）或中文原文（17px），单行截断；下面一行 14px 次要色：词是卡片上的义项（多张卡用 "; " 连起来），没卡时是缓存里的第一条释义；句子是口语版译文
- 右，还没加入复习："+ add"（14px 琥珀橙）
  - 词加缓存里最常用的那个义项（`addWordSenses()`，写入前重读复习本去重）；要别的义项，点开词用该义项上的 `+`
  - 句子加整句（`addTranslationCard()`，按原文去重）
  - Toast："Added to review" / "Already in review"
- 右，已加入：
  - 每张卡一格进度条（14×6px，圆角 2px，间距 3px），学得最好的在前：成熟卡琥珀橙，学过的卡 40% 琥珀，新卡二级边框色
  - 下面一行（14px 三级色）是学过的卡里最早到期那张的 `dueLabel()`："due today" / "due tomorrow" / "in N days" / 红色 "overdue"；全是新卡时为 "new"——新卡的 `due_at` 只是加入时间，显示 overdue 会误导
- 左滑露出 Delete（`SwipeToDelete`）：删掉这一条的全部 history 行和全部复习卡（本地 + Firestore），复习日志保留；`word_cache` / `translation_cache` 全体用户共享，绝不动。Toast "Removed from library"

### 段落行（Passages）

- 主文字是段落开头（17px，单行截断），副文字 "出处 · 相对时间"（14px 三级色）；右侧 "N saved"（14px 三级色）——语境指向这段的卡数
- 点击回到 `/read/:id`；左滑删除只删段落（`deleteCapture()`），卡片里的句子副本不受影响

### 空状态

- 居中，内边距 48px 12px：`Library` 36px 三级色（块级居中），标题 18px weight500，说明 16px 次要色
- Words 空："No words yet" + "Look up a word and it shows up here, ready to add to review." + 按钮 "Look up a word" → 首页
- Sentences 空："No sentences yet" + "Translate something on Home and it shows up here."
- Passages 空："No passages yet" + "Paste English into Read on Home and it shows up here."
- 搜索或筛选没有结果："Nothing matches"；在词栏搜的像一个英文词或短语时，下面给按钮 "Look up “…”"，按查询词去查词页

---

## 屏幕 9：设置页（Settings）

路由：`/settings`，需登录。

### 布局

```
AppBar
  左：ChevronLeft（返回上一页）
  中："Settings"（18px 次要色 weight400）
  右：28px 占位空白（保证标题真正居中）
Body（padding 24px 18px，可滚动）
  SectionTitle："Account"
  AccountRow
  SectionTitle："Review" + 一行说明
  复习设置（8 项）
  SectionTitle："Learning"
  Chinese translation
```

### SectionTitle

- "Account" / "Review" / "Learning"，14px，三级文字色，全大写 + 字母间距 0.5px，weight 500，margin-bottom 12px；后两个上边距 28px
- 界面文案统一用英文：这是一款英文优先的产品，设置页也不例外

### AccountRow

- 二级背景色，圆角 10px，内边距 12px 14px，flex 两端对齐
- 左：`User` 图标（16px，次要色）+ 当前登录邮箱（17px，正常色）
- 右："Sign out"按钮 —— `LogOut` 图标（14px）+ 文字（17px，次要色），无背景无边框
  - 点击：`logout()` 成功后 `navigate('/login', { replace: true })`

### Review：复习设置

写进 `ReviewSettings`（`src/db/settings.ts`），跟账号走：Firestore `users/{uid}/prefs/review` 一个文档，`subscribeReviewSettings` 把它镜像到本地 `settings` 的 `review_settings:{uid}`——每台设备排同样的队列、按同样的参数调度。标题下一行说明："Saved to your account, so every device studies the same way."（14px 次要色）。设置还没读到时这一节先不渲染。

读出来的值都要过 `normalizeReviewSettings()`：数字夹到范围内，步骤重新校验，坏值退回默认——这个文档由各设备上不同版本的应用写入，一个坏值不能卡住队列和调度器。

每项一行：名称 17px 正常色，说明 14px 次要色，控件在右边或下面；padding 14px 0，0.5px 三级分隔线。

| 项 | 控件 | 默认 | 范围 / 作用 |
|----|------|------|-------------|
| New cards per day | 数字框（右，宽 92px，18px 居中） | 20 | 0–500；0 暂停新卡 |
| Reviews per day | 数字框 | 200 | 0–5000；最快要忘的先做，其余明天 |
| Target retention | 滑杆（下，琥珀橙）+ 右侧百分比（17px weight500） | 90% | 80%–97%，步长 1%；越高复习越多 |
| Maximum interval | 数字框 | 36500 | 1–36500 天 |
| Learning steps | 文本框（下，占满宽） | `1m 10m` | 整数 + m / h / d，空格或逗号分隔；留空则新卡直接按天排 |
| Relearning steps | 文本框（空时 placeholder "None"） | `10m` | 同上，给忘了的卡 |
| New cards | 分段控件：Newest first / Oldest first | Newest first | 刚查的先出 / 先来的先出 |
| Pronounce words | 开关（右，50×30px，开时琥珀橙，`role="switch"`） | 关 | 介绍卡出现、揭晓答案时读出单词 |

保存：

- 数字框失焦或回车才保存——打 "150" 途中的 "15" 不会写进去。超出范围的夹回范围内，不是数字的退回已存的值，值没变不写
- 滑杆松手才保存：用原生 `change` 事件，React 的 onChange 拖动时每一步都会触发；拖动时百分比跟着变
- 步骤写错（如 `1.5m`）就留在框里：红色描边 + 下方 "Use whole numbers with m, h or d — like 1m 10m."（16px 红色），不保存；一改字提示就消失。写对的规整成单空格分隔
- 分段控件和开关点一下即保存
- `setReviewSettings(patch)` 在一个 Dexie 事务里读、合并、写，再把整份写到 Firestore：从数字框直接去点开关时，两次保存几乎同时发生，也不会互相覆盖
- 别的设备改了设置、同步过来，框里显示的值跟着换
- 和默认值不一样时，最后出现 "Reset to defaults"（16px 琥珀橙文字按钮），恢复全部默认，Toast "Review settings reset"；保存失败时 Toast "Couldn't save that — try again"

### Learning：Chinese translation

应用里第一个用户可配置项，写入 `settings` 的 `chinese_display`（本机偏好，不同步）。

- 标题："Chinese translation"（17px，正常色）
- 说明："English comes first everywhere. Tap 中文 on a sense when you are stuck."（14px，次要色，行高 1.5）
- 三段分段控件（margin-top 12px）：
  - 容器：二级背景色，圆角 10px，内边距 3px，`gap: 3px`
  - 每段：flex 1，内边距 11px 0（约 44px 高，够得着），圆角 8px，16px
  - 选中：背景 `#412402`（琥珀 900），白字 weight 500；未选中：透明背景，次要文字色
  - 三个值：Always / On tap（默认）/ Never —— 对应释义里的中文始终展开、点开、完全不显示

### 没有 LLM 配置项

Base URL、API key、模型名都不在这里，用户也无从配置：LLM 请求经 Cloudflare Worker
代理，DeepSeek 密钥存在 Worker secret 中，模型由 `getModel()` 硬编码为 `deepseek-chat`。
因此本屏没有 LLM 表单。复习设置逐项即时保存，所以也没有保存按钮和底部 SaveBar。

---

## 屏幕 10：登录（Login）

路由：`/login`，无需认证即可访问。

布局：垂直居中全屏，最大宽度 360px，水平居中。

组件：

- **品牌标题**：App 名"Glossy"（28px，700，琥珀橙），副标题"登录继续"（13px，次要文字色）
- **邮箱输入框**：type=email，placeholder="邮箱"，autoComplete="email"
- **密码输入框**：type=password，placeholder="密码"，autoComplete="current-password"
- **错误提示**：表单内行内展示，红色（#dc2626），12px，居中
- **登录按钮**：全宽，琥珀橙背景，加载中时变灰并显示"登录中…"
- **注册链接**：按钮下方，"还没有账号？注册"，"注册"为琥珀橙链接，跳转 `/register`

交互：登录成功后 navigate 到 `/`。

---

## 屏幕 11：注册（Register）

路由：`/register`，无需认证即可访问。

布局：同登录屏，垂直居中全屏，最大宽度 360px。

组件：

- **品牌标题**：App 名"Glossy"，副标题"创建账号"
- **邮箱输入框**：type=email，autoComplete="email"
- **密码输入框**：placeholder="密码（至少 6 位）"，autoComplete="new-password"
- **确认密码输入框**：placeholder="确认密码"，autoComplete="new-password"
- **错误提示**：行内展示常见 Firebase 错误（邮箱已注册、密码过短、格式错误）
- **注册按钮**：全宽，琥珀橙，加载中时变灰并显示"注册中…"
- **登录链接**：按钮下方，"已有账号？登录"，"登录"为琥珀橙链接，跳转 `/login`

交互：注册成功后 navigate 到 `/`；密码与确认密码不一致时前端拦截，显示"两次输入的密码不一致"。

---

## 屏幕 12：语境采集（Read）

路由：`/read/:id`。段落来自 Home 的 Read tab，存在 `captures` 里。

### 布局

```
AppBar
  左：ChevronLeft（返回）
  中："Read"（18px 次要色）
Body（padding 16px 18px 28px，可滚动）
  SourceRow
  Passage
  Hint
Footer（固定底部）
SenseSheet（点词后从底部升起）
```

### SourceRow

- 未填时：`Tag` 图标（14px 三级色）+ "Where is this from?"（14px 三级色）
- 填了就直接显示出处文字；点一下变成输入框（二级背景、圆角 8px、16px），失焦或回车即存
- 出处挂在段落上，不是挂在每张卡上：一段话就是一个来源，存卡时自动带过去

### Passage

- 18px，行高 1.75 —— 比正文松，因为每个词都是可点的目标
- 单词：`.clickable-word`，可点但不加任何装饰
- 短语：`.clickable-chunk`，二级背景 + 圆角 4px + 2px 底线 + `nowrap`，整条一起点
  - 短语由 `findChunks()` 给出，只在段落第一次打开时问一次模型，结果存进 `captures.chunks`

### Hint

- 短语还没回来时："Finding the phrases worth learning…"（14px 三级色）
- 回来之后："Tap any word. Shaded phrases are looked up whole."

### Footer

- 左："N saved from this text"（14px 三级色，实时统计指回这段话的卡片数）
- 右："Done"（0.5px 边框，圆角 8px，内边距 11px 16px）→ 回首页

### SenseSheet（底部浮层）

- 遮罩 `rgba(0,0,0,0.35)`，点遮罩或 `X` 关闭
- Handle（32×3）+ 被点的词或短语（29px weight 500）
- 加载中："Reading the sentence…"（17px 三级色）
- 内容：
  - "in this sentence"（14px 三级色）+ 该句原文（17px 次要色），句中目标词转正常色加粗
  - `SenseBlock size="answer" maxExamples={0}`：词性 pill + 释义 23px weight 500 + "中文"chip
    - 只解释它在这句话里的意思，不列其他义项
- 操作：
  - 主按钮 "Save with this sentence"（琥珀橙，flex 1）：`addContextCard()` 把释义和**原句**一起存成卡片
    - 同一个义项再次遇到，只往已有卡片的 `contexts` 里追加句子，不会多出一张卡
  - 次按钮 "Open full"：跳到 `/lookup/:lemma`，看完整词条
- 存完后操作区换成回执：`Check`（琥珀橙）+ "Saved with this sentence" + "Keep reading"

---

## 屏幕 13：统计（Stats）

路由：`/stats`，需登录。仿 wordloom 的"统计"：复习页只看今天，这里看长期。全部数字由 `loadStats()`（`src/db/stats.ts`）从本地 `review_items` / `review_logs` 和复习设置现算，只读不写；live query 驱动，别的设备上复习完，这里跟着变。

### 布局

```
AppBar（高 48px）
  左："Stats"（23px weight500）
Body（padding 水平 18px，可滚动）
  StatTiles（2×2）
  Cards
  Retention
  Calendar
  "ACTIVITY" 分组标题 + 范围切换（30 days / 90 days）
  Reviews per day
  First-try recall
  "MEMORY" 分组标题
  Coming up
  Memory strength
  Hardest words
BottomNav（Stats 激活）
```

### StatTiles

复用复习页的 `StatTile`，两列，gap 10px：

- Words studied：学过的词（按词头归并，至少一个义项已经开始学），副行 "N mastered"（全部义项都已掌握）
- Streak：连续天数（与复习页同一个数），副行 "best N days"
- Recall now：复习中的卡（Review / Relearning）此刻的平均可提取度，FSRS 的预测；副行 "predicted, N cards"，还没有这样的卡时显示 "—"
- Reviews：累计作答次数，副行 "on N days"

### Panel（每张图的卡片）

- 0.5px 二级色边框，圆角 14px，内边距 16px，下间距 12px
- 标题 17px weight 500；说明 14px 次要色；右上角可放一个数（14px 三级色，如 "62 cards"）
- 图表卡右上角是表格切换（`Table2` / `ChartColumn`，18px 三级色）：换成同一组数字的表格（14px 等宽数字，表头 13px 三级色并吸顶，最高 300px 内部滚动）——不点图也能读到每一个数

### 读数（Readout）

图上方两行字（14px），高度固定，选中时图不跳：

- 没选中时是这张图的总结，选中一列（一天）时换成它的数字
- 选中：手指点一下（再点同一列取消）、按住横滑、鼠标悬停（移出取消）、方向键（Esc 取消）；竖向滑动照常滚动页面（`touch-action: pan-y`）
- `aria-live="polite"`，读屏会读出变化
- 被选中的柱子以外的柱子变淡（35%）；折线图画一道竖线和圆点

### Cards

- 右上角 "N cards"；说明 "Mastered once a card should stay remembered for three weeks"
- 一根 8px 分段条（段间 2px 白缝），下方 2×2：New / Learning / Reviewing / Mastered，各有色块、数量（18px weight 500）和占比（14px 三级色）
- 口径同词库：学习中 = Learning / Relearning，已掌握 = `isMature()`（Review 且 stability ≥ 21 天）
- 颜色：New 灰轨道色，Learning `--amber-400`，Reviewing `--amber-700`，Mastered `--amber-950`；页面里别的图用到卡片状态时颜色相同

### Retention

- 最近 30 天里，作答时处于 Review 状态的卡没按 Again 的比例（真实保持率）：36px weight 500，旁边 "target 90%"（复习设置的目标保留率）
- Meter：8px，`--amber-50` 轨道 + 琥珀填充，目标处一道 2px 深色刻度
- "405 of 489 reviews remembered."；比目标低 5 个百分点以上时接一句 "Well below your target — fewer new cards a day may help."（同 wordloom）
- 还没有卡到期复习过时，换成一段说明

### Calendar

- 最近 26 周的热力图：一列一周，周一在上；左侧 M / W / F，上方月份（13px 三级色）
- 0 次是灰轨道色，其余按最忙那天的四分之一分四档（`--amber-400` / `600` / `700` / `950`）；右下角图例写出每档范围
- 读数："Studied on N of the last M days" / "N reviews"；选中某天："N reviews" / 日期；方向键左右跨一周、上下跨一天
- 表格只列有复习的日子，最近的在上

### 范围切换

"ACTIVITY" 标题右侧的分段控件（设置页 Segmented 的样式，14px，内边距 6px 12px）：30 days / 90 days，存在 URL 参数 `range`（默认 30 不写）。只管下面两张图。

### Reviews per day

- 每天的作答次数，堆叠柱：下段 Due（作答时处于 Review 状态，`--amber-700`），上段 Learning（新卡和学习 / 重学步骤里的卡，`--amber-400`），段间 2px 白缝；图例在读数上方
- 纵轴在右，刻度取 0 加两到三格整数，顶格刚好盖过最高的柱子
- 横轴最右是 "Today"，往前每 7 天（90 天时每 28 天）一个日期，每个标签居中在自己那一列下
- 读数："862 reviews in the last 30 days" / "studied on 28 days"；选中："32 reviews — 21 due · 11 learning" / 日期 · 其中几张新卡
- 表格：Day / Due / Learning / New / Total

### First-try recall

- 每张卡当天第一次作答没按 Again 的比例（同复习页的首答记住率）：30 天按天，90 天按自然周（周一开始，最早那周可能不满，本周还没过完）
- 折线 2px + 10% 琥珀浅底，没有作答的日子断开；最新的点画圆点
- 目标保留率是一条虚线，数值标在右侧刻度里——标在图里会压在折线上；和 100% 挨得太近时 100% 让位
- 表格：Day（或 Week）/ Cards / Remembered / Recall

### Coming up

- 学过的卡未来 30 天每天到期多少张，单色柱（`--amber-600`）
- Today = 今天这一轮还剩的 Due + Learning，Tomorrow = 复习页的 Tomorrow（已含每天上限和"一个词一天一卡"留下的），之后按到期日数；新卡不算，它们何时出由每日上限决定
- 读数："9 due tomorrow" / "18 cards in the next 7 days"

### Memory strength

- 复习中的卡按 stability 分六组：Under a day / 1–7 days / 1–3 weeks / 3 weeks – 3 months / 3 months – 1 year / Over a year
- 横向条形列表：组名（14px 次要色）+ 8px 琥珀条（按最多那组的比例）+ 数量（16px）；每个数都写出来，不用点
- 右上角 "N cards"；没有复习中的卡时换成一段说明

### Hardest words

- 至少答过 3 次、按过 Again 的词，按遗忘次数（各义项 lapses 之和）降序、记住率升序，取前 10
- 每行：词（17px）+ 释义（14px 次要色，单行省略）| Forgot | Reviews | Recall（16px 等宽数字）
- 有义项 lapses ≥ 8 的词，词后加红色 "stubborn"（13px，`#dc2626`）：同样的复习再来多少次也难有起色
- 点一行跳 `/lookup/:lemma`（走缓存，不调 LLM）；没有时显示 "None yet. Words you get wrong show up here."

### 空状态

一张卡、一条复习记录都没有时：`ChartColumn` 图标（36px 三级色，块级居中）+ "No stats yet"（18px weight 500）+ 一句说明 + "Look up a word" 按钮（琥珀橙）→ 回首页

---

## 交互状态汇总

| 状态 | 描述 |
|------|------|
| Loading | 调用 LLM 时，搜索框或翻译按钮显示 spinner，内容区显示骨架屏 |
| Error | AppBar 下方显示错误横幅，包含错误原因和重试建议 |
| Empty（复习本无内容） | 复习页显示空状态："Nothing to review yet" + "Look up a word" 按钮（屏幕 5） |
| Empty（词库无内容） | 词库各栏显示空状态："No words yet" / "No sentences yet" / "No passages yet"；搜索、筛选没结果时 "Nothing matches"（屏幕 8） |
| Empty（统计无内容） | 没有卡也没有复习记录时："No stats yet" + "Look up a word" 按钮；有卡但还没复习过时各图照常显示，空的几块换成一句说明（屏幕 13） |
| Offline（缓存命中） | 正常展示，无特殊提示 |
| Offline（需要 LLM） | 错误横幅："当前无网络连接，无法获取新内容" |
