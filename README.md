# Glossy

Local-first English learning PWA. Look up words, translate sentences, and remember them with spaced repetition — all running in your browser, with your data stored only on your device.

## What it does

- **Lookup** — Type an English word, get UK/US phonetics, the three most common definitions, and an example sentence each. Auto-lemmatizes (`running` → `run`, `better` → `good`).
- **Translate** — Paste Chinese text, get three English versions: casual, formal, and idiomatic. Key phrases are tappable to look up the words inline.
- **Review** — Words and sentences you save are scheduled with the SM-2 spaced repetition algorithm. The front of the card hides the answer; rate yourself Again / Hard / Good / Easy.
- **History** — Everything you've ever looked up, grouped by day, one tap to revisit.

## Local-first by design

- All data lives in IndexedDB on your device. There is no Glossy server.
- No accounts, no cloud sync, no analytics, no telemetry.
- You bring your own LLM API key. The app calls the LLM directly from your browser; nothing routes through a third party other than the model provider you configured.

## Quick start

```bash
npm install
npm run dev
```

Open the app, then go to **Settings** and configure:

- **Base URL** — any OpenAI-compatible endpoint. Default: `https://api.deepseek.com/v1`
- **API key** — yours
- **Models** — both default to `deepseek-chat`. Anything OpenAI-compatible works: DeepSeek, OpenAI (`gpt-4o-mini`), Google (`gemini-2.0-flash`), Anthropic models via OpenRouter, Moonshot, Qwen, GLM, Ollama, etc. Faster TTFT models give a noticeably snappier feel.

## Build & deploy

```bash
npm run build
```

The `dist/` folder is a static PWA — deploy to Cloudflare Pages, Vercel, Netlify, GitHub Pages, or any static host.

## Tech stack

- React 19 + TypeScript + Vite 8
- Tailwind CSS v4
- Dexie (IndexedDB wrapper) — 6 stores: word_cache, translation_cache, history, review_items, review_logs, settings
- React Router v7
- vite-plugin-pwa (Workbox service worker, offline-first)
- compromise (client-side lemmatization, no network)
- lucide-react (icons)

## Project layout

```
src/
  algorithms/    SM-2 spaced repetition
  api/           LLM client (streaming SSE) + lookup/translate flows
  components/    Reusable UI (BottomNav, Toast, ErrorBoundary, SkeletonLoader, ...)
  db/            Dexie schema and queries
  pages/         Route pages (Home, LookupResult, TranslateResult, ReviewBook, ReviewSession, History, Settings)
  prompts/       LLM prompt templates for lookup and translate
  utils/         Lemmatize, hash, time formatting
docs/
  PRD.md         Full product spec (data model, SM-2 details, prompt text, error mapping)
  UI.md          Per-screen component breakdowns
```

Full product spec is in [`docs/PRD.md`](docs/PRD.md); per-screen UI details are in [`docs/UI.md`](docs/UI.md).
