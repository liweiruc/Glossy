import { createContext, useContext, useState, useCallback, useRef } from 'react'
import type { ReactNode } from 'react'

interface ToastItem {
  id: number
  message: string
}

interface ToastContextValue {
  showToast: (message: string) => void
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const counter = useRef(0)

  const showToast = useCallback((message: string) => {
    const id = ++counter.current
    setToasts(prev => [...prev, { id, message }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 2000)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{
        position: 'fixed',
        bottom: 76, /* above BottomNav (56px) + 20px margin */
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        zIndex: 9999,
        pointerEvents: 'none',
        maxWidth: 430,
        margin: '0 auto',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: '#1a1a1a',
            color: '#ffffff',
            borderRadius: 8,
            padding: '10px 16px',
            fontSize: 13,
            lineHeight: 1.4,
            maxWidth: 300,
            textAlign: 'center',
          }}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
