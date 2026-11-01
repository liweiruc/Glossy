## LLM 代理（Cloudflare Worker）

部署：在 `worker/` 下执行 `npx wrangler deploy`；密钥用 `npx wrangler secret put DEEPSEEK_API_KEY` 设置（不要写进 `wrangler.toml`）。部署后把 Worker URL 填到前端的 `VITE_PROXY_URL`。
