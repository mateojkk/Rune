import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { WalletProvider } from '@suiet/wallet-kit'
import { useConfigStore } from './stores/config'
import './index.css'
import App from './App.tsx'

function ConfigInitializer({ children }: { children: React.ReactNode }) {
  const fetchConfig = useConfigStore((s) => s.fetchConfig)
  
  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])
  
  return <>{children}</>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <WalletProvider>
        <ConfigInitializer>
          <App />
        </ConfigInitializer>
      </WalletProvider>
    </BrowserRouter>
  </StrictMode>,
)