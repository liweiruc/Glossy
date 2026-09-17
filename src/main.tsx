import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'

// 这个 import 必须留着：没有它，vite-plugin-pwa 会退回去注入一段光秃秃的
// navigator.serviceWorker.register()，新 worker 装上了也没人刷新页面，
// 用户永远停在旧版本。registerSW() 带的 autoUpdate 分支才会在新 worker
// 激活时 reload。
//
// iOS 把独立 PWA 挂起后再唤醒，不会触发 load，也就永远不会去查更新。
// 所以每次回到前台自己 update() 一次——桌面端长开的标签页由定时器兜底。
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return
    const checkForUpdate = () => {
      if (document.visibilityState === 'visible') void registration.update()
    }
    document.addEventListener('visibilitychange', checkForUpdate)
    setInterval(checkForUpdate, 60 * 60 * 1000)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
