import { useEffect, useState } from 'react';
import { Wallet, Loader2 } from 'lucide-react';

export function WalletLogin({ onConnected }: { onConnected: (address: string) => void }) {
  const [WalletProvider, setWalletProvider] = useState<any>(null);
  const [Inner, setInner] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const kit = await import('@suiet/wallet-kit');
      setWalletProvider(() => kit.WalletProvider);
      setInner(() => function WalletInner() {
        const { address, select, connecting, allAvailableWallets } = kit.useWallet();

        useEffect(() => {
          if (address) onConnected(address);
        }, [address]);

        return (
          <>
            {allAvailableWallets.map((wallet: any) => (
              <button key={wallet.name} className="wallet-option" onClick={async () => {
                try {
                  await select(wallet.name);
                } catch { /* ignore */ }
              }} disabled={connecting}>
                <Wallet size={18} />
                <span>{wallet.name}</span>
              </button>
            ))}
          </>
        );
      });
    })();
  }, []);

  if (!WalletProvider || !Inner) {
    return <div className="wallet-option"><Loader2 size={14} className="spin" /><span>Loading...</span></div>;
  }

  return <WalletProvider><Inner /></WalletProvider>;
}
