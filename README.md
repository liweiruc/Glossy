# Glossy

一款专注于"查得到、记得住"的英语学习 PWA。查词、翻译、SM-2 间隔重复复习，登录后实时跨设备同步。

## 功能

- **查词**：输入英文单词，返回音标、多个释义、双语例句；LLM 生成，首次需联网，结果永久缓存后离线可查
- **翻译**：输入中文，返回口语 / 正式 / 地道三种英文翻译，结果中的词可点击弹出快速查词
- **复习本**：查词和翻译自动沉淀为可复习素材，SM-2 算法科学调度复习时间
- **跨设备同步**：登录后通过 Firestore 实时同步，换设备无缝继续

## 技术栈

- React 19 + Vite + TypeScript
- Tailwind CSS v4
- Firebase（Auth + Firestore）
- Dexie.js（IndexedDB 本地缓存）
- vite-plugin-pwa（PWA / Service Worker）

## 本地开发

### 前置条件

- Node.js 18+
- 一个 Firebase 项目（需开启 Authentication → 邮箱/密码，以及 Firestore Database）
- 一个 OpenAI 兼容的 LLM API（如 OpenAI、DeepSeek 等）

### 配置环境变量

在项目根目录创建 `.env.local`，填入 Firebase 项目配置：

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### 部署 Firestore 安全规则

```bash
firebase deploy --only firestore:rules
```

### 启动开发服务器

```bash
npm install
npm run dev
```

LLM API 配置（base URL、API key、模型名）在应用内的设置页填写，存入 IndexedDB，无需环境变量。

## 构建

```bash
npm run build
```

产物输出到 `dist/`，可直接部署到 Cloudflare Pages / Vercel / Netlify 等静态托管，需在对应平台配置上述 `VITE_FIREBASE_*` 环境变量。
