import { useEffect } from 'react';
import { useWallet } from '@suiet/wallet-kit';
import { useWalletStore } from '../context/wallet';

/**
 * Syncs the browser wallet extension state with our persistent wallet store.
 * This ensures that after a page refresh, the 'personalMessageSigner' is restored
 * for regular wallet users, enabling Seal decryption without manual reconnection.
 */
export function WalletRelinker() {
  const { address, connected, signPersonalMessage } = useWallet();
  const { account, connectWallet } = useWalletStore();

  useEffect(() => {
    // If we have an address from the wallet kit and a signer, 
    // but our store is missing the signer, restore it.
    if (connected && address && signPersonalMessage) {
      if (account?.method === 'wallet' && account.address.toLowerCase() === address.toLowerCase()) {
        const store = useWalletStore.getState();
        if (!store.personalMessageSigner) {
          connectWallet(address, 'wallet-extension', undefined, signPersonalMessage);
        }
      }
    }
  }, [address, connected, signPersonalMessage, account, connectWallet]);

  return null;
}
