import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigInitializer } from './components/ConfigInitializer'
import { WalletRelinker } from './components/WalletRelinker'
import './index.css'
import App from './App.tsx'

function Root() {
  const [WalletProvider, setWalletProvider] = useState<any>(null);

  useEffect(() => {
    import('@suiet/wallet-kit').then(kit => {
      setWalletProvider(() => kit.WalletProvider);
    });
  }, []);

  if (!WalletProvider) return null;

  return (
    <WalletProvider>
      <BrowserRouter>
        <ConfigInitializer>
          <WalletRelinker />
          <App />
        </ConfigInitializer>
      </BrowserRouter>
    </WalletProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
