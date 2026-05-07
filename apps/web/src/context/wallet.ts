import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ConnectionMethod = 'zklogin' | 'wallet';

export interface WalletAccount {
  address: string;
  provider: string;
  method: ConnectionMethod;
  publicKey?: string;
}

interface WalletState {
  isConnected: boolean;
  isConnecting: boolean;
  account: WalletAccount | null;
  jwt: string | null;
  ephemeralPrivateKey: string | null;
  
  connectZkLogin: (address: string, provider: string, jwt: string, ephemeralKey?: string) => void;
  connectWallet: (address: string, provider: string, publicKey?: string) => void;
  disconnect: () => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      isConnected: false,
      isConnecting: false,
      account: null,
      jwt: null,
      ephemeralPrivateKey: null,

      connectZkLogin: (address: string, provider: string, jwt: string, ephemeralKey?: string) => {
        set({
          isConnected: true,
          isConnecting: false,
          account: {
            address: address.toLowerCase(),
            provider,
            method: 'zklogin',
          },
          jwt,
          ephemeralPrivateKey: ephemeralKey || null,
        });
        
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('rune_jwt', jwt);
        }
      },

      connectWallet: (address: string, provider: string, publicKey?: string) => {
        set({
          isConnected: true,
          isConnecting: false,
          account: {
            address: address.toLowerCase(),
            provider,
            method: 'wallet',
            publicKey,
          },
        });
      },

      disconnect: () => {
        const currentAccount = get().account;
        
        set({
          isConnected: false,
          account: null,
          jwt: null,
          ephemeralPrivateKey: null,
        });
        
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('rune_jwt');
          sessionStorage.removeItem('zklogin_session');
          sessionStorage.removeItem('zklogin_jwt');
          sessionStorage.removeItem('zklogin_provider');
          sessionStorage.removeItem('zklogin_nonce');
          
          if (currentAccount?.method === 'zklogin' && currentAccount.address) {
            localStorage.removeItem(`rune_salt_${currentAccount.address}`);
          }
        }
      },
    }),
    {
      name: 'rune-wallet',
      partialize: (state) => ({
        isConnected: state.isConnected,
        account: state.account,
      }),
    }
  )
);

export const getStoredWallet = () => {
  const state = useWalletStore.getState();
  return state.account;
};