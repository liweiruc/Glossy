# Glossy — 开发上下文

## 这是什么

一个英语学习 PWA。核心功能：查词、翻译、SM-2 间隔重复复习。
无后端、无账号、无云同步，纯本地数据。

## 技术栈

- **框架**：React + Vite + TypeScript
- **样式**：Tailwind CSS
- **路由**：React Router
- **数据库**：IndexedDB，通过 Dexie.js 封装
- **词形还原**：compromise.js（纯前端，无需联网）
- **PWA**：Workbox（Service Worker + 离线缓存）
- **图标**：Lucide React
- **部署**：Cloudflare Pages / Vercel / Netlify 均可

## 目录结构

```
/src
  /components       可复用 UI 组件
  /pages            页面级组件（Home、Lookup、Translate、Review、History、Settings）
  /db               Dexie schema 与数据访问层
  /algorithms       SM-2 等核心算法
  /api              LLM API 调用与错误处理
  /prompts          查词与翻译的 prompt 文本（独立文件，便于迭代）
  /utils            lemmatize、hash 等工具函数
  /styles           全局样式
/docs
  PRD.md            完整产品需求文档
  UI.md             每个屏幕的详细组件描述
```

## 关键约束

- 所有数据存 IndexedDB，共 6 个 store：
  `word_cache`、`translation_cache`、`history`、`review_items`、`review_logs`、`settings`
- LLM 调用统一走 OpenAI 兼容协议（`/chat/completions`），配置从 `settings` store 读取
- 无后端代理，API key 由用户自己填，直接从前端发请求
- 移动端优先（375px 基准宽度），桌面端居中显示，最大宽度 430px
- 极简风格，单一点缀色琥珀橙 `#BA7517`

## UI 参考

见 `docs/UI.md`，每个屏幕有详细的组件层级和交互描述。
颜色、字号、间距、圆角规范见 `docs/PRD.md` 附录 B。

## 完整文档

- `docs/PRD.md`：产品需求、数据模型、SM-2 算法实现代码、两个 LLM prompt 完整原文、所有屏幕说明、错误处理规范
- `docs/UI.md`：10 个屏幕的逐屏组件描述

## 开发顺序

1. 搭脚手架（Vite + React + TypeScript + Tailwind）
2. 建 Dexie schema（`src/db/`）
3. 设置页 + API 配置读写（最小可验证闭环）
4. 查词流程：输入 → lemmatize → 查缓存 → 调 LLM → 写缓存 → 渲染
5. 翻译流程：输入 → 查缓存 → 调 LLM → 写缓存 → 渲染 → 可点击 span
6. 加入复习本（查词和翻译都支持）
7. 复习本主屏 + SM-2 调度查询
8. 复习会话（单词卡 + 句子卡，四档评分）
9. 历史记录屏
10. PWA 配置（manifest.json + Workbox Service Worker）
