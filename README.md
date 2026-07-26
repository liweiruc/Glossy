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
- Cloudflare Worker（LLM 代理，校验 Firebase ID token 后转发 DeepSeek）
- vite-plugin-pwa（PWA / Service Worker）

## 本地开发

### 前置条件

- Node.js 18+
- 一个 Firebase 项目（需开启 Authentication → 邮箱/密码，以及 Firestore Database）
- 一个 Cloudflare 账号和一份 DeepSeek API key（用于部署下面的 LLM 代理 Worker）

### 部署 LLM 代理 Worker

前端不直接调用 LLM，请求经 `worker/` 下的 Cloudflare Worker 转发：Worker 用 Firebase JWKS 校验请求携带的 ID token，通过后再用自己持有的密钥请求 DeepSeek。密钥只存在于 Worker secret，永不下发浏览器，因此用户无需也无法自行配置。

```bash
cd worker
npx wrangler secret put DEEPSEEK_API_KEY
npx wrangler deploy
```

记下输出的 Worker URL，下一步要用。

### 配置环境变量

在项目根目录创建 `.env.local`：

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

VITE_PROXY_URL=https://<your-worker>.workers.dev
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

## 构建

```bash
npm run build
```

产物输出到 `dist/`，可直接部署到 Cloudflare Pages / Vercel / Netlify 等静态托管，需在对应平台配置上述 `VITE_FIREBASE_*` 和 `VITE_PROXY_URL` 环境变量。
