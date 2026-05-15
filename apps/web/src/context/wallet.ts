import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { clearCurrentUser, setCurrentUser } from '../lib/forms';
import { useProfileStore } from '../stores/profile';

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
  token: string | null;
  isLoggingIn: boolean;
  ephemeralPrivateKey: string | null;
  
  setToken: (token: string | null) => void;
  setLoggingIn: (val: boolean) => void;
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
      token: null,
      isLoggingIn: false,
      ephemeralPrivateKey: null,

      setToken: (token: string | null) => {
        set({ token });
        if (typeof window !== 'undefined' && token) {
          sessionStorage.setItem('rune_token', token);
        } else if (typeof window !== 'undefined') {
          sessionStorage.removeItem('rune_token');
        }
      },

      setLoggingIn: (val: boolean) => set({ isLoggingIn: val }),

      connectZkLogin: (address: string, provider: string, jwt: string, ephemeralKey?: string) => {
        const normalizedAddress = address.toLowerCase();
        set({
          isConnected: true,
          isConnecting: false,
          account: {
            address: normalizedAddress,
            provider,
            method: 'zklogin',
          },
          jwt,
          ephemeralPrivateKey: ephemeralKey || null,
        });

        setCurrentUser(normalizedAddress);
        
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('rune_jwt', jwt);
        }
      },

      connectWallet: (address: string, provider: string, publicKey?: string) => {
        const normalizedAddress = address.toLowerCase();
        set({
          isConnected: true,
          isConnecting: false,
          account: {
            address: normalizedAddress,
            provider,
            method: 'wallet',
            publicKey,
          },
        });

        setCurrentUser(normalizedAddress);
      },

      disconnect: () => {
        const currentAccount = get().account;
        
        set({
          isConnected: false,
          account: null,
          jwt: null,
          token: null,
          ephemeralPrivateKey: null,
          isLoggingIn: false,
        });

        clearCurrentUser();
        useProfileStore.getState().reset();
        
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('rune_jwt');
          sessionStorage.removeItem('rune_token');
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
        jwt: state.jwt,
        token: state.token,
        isLoggingIn: state.isLoggingIn,
      }),
    }
  )
);

export const getStoredWallet = () => {
  const state = useWalletStore.getState();
  return state.account;
};
