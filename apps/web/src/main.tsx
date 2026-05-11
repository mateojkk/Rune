import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { WalletProvider } from '@suiet/wallet-kit'
import { ConfigInitializer } from './components/ConfigInitializer'
import './index.css'
import App from './App.tsx'

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
