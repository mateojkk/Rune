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

export type PersonalMessageSigner = (msg: { message: Uint8Array }) => Promise<{ signature: string }>;

interface WalletState {
  isConnected: boolean;
  isConnecting: boolean;
  account: WalletAccount | null;
  jwt: string | null;
  token: string | null;
  isLoggingIn: boolean;
  ephemeralPrivateKey: string | null;
  zkLoginSession: any | null;
  personalMessageSigner: PersonalMessageSigner | null;
  
  setToken: (token: string | null) => void;
  setLoggingIn: (val: boolean) => void;
  setPersonalMessageSigner: (signer: PersonalMessageSigner | null) => void;
  connectZkLogin: (address: string, provider: string, jwt: string, session: any) => void;
  connectWallet: (address: string, provider: string, publicKey?: string, signer?: PersonalMessageSigner | null) => void;
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
      zkLoginSession: null,
      personalMessageSigner: null,

      setToken: (token: string | null) => {
        set({ token });
        if (typeof window !== 'undefined' && token) {
          sessionStorage.setItem('rune_token', token);
        } else if (typeof window !== 'undefined') {
          sessionStorage.removeItem('rune_token');
        }
      },

      setLoggingIn: (val: boolean) => {
        set({ isLoggingIn: val });
        if (typeof window !== 'undefined') {
          if (val) sessionStorage.setItem('rune_is_logging_in', 'true');
          else sessionStorage.removeItem('rune_is_logging_in');
        }
      },

      setPersonalMessageSigner: (signer: PersonalMessageSigner | null) => {
        set({ personalMessageSigner: signer });
      },

      connectZkLogin: (address: string, provider: string, jwt: string, session: any) => {
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
          ephemeralPrivateKey: session?.ephemeralKeyPair?.privateKey || null,
          zkLoginSession: session || null,
          personalMessageSigner: null,
        });

        setCurrentUser(normalizedAddress);
        
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('rune_jwt', jwt);
          if (session) sessionStorage.setItem('zklogin_session', JSON.stringify(session));
        }
      },

      connectWallet: (address: string, provider: string, publicKey?: string, signer?: PersonalMessageSigner | null) => {
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
          personalMessageSigner: signer || null,
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
          zkLoginSession: null,
          personalMessageSigner: null,
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
        ephemeralPrivateKey: state.ephemeralPrivateKey,
        zkLoginSession: state.zkLoginSession,
      }),
    }
  )
);

export const getStoredWallet = () => {
  const state = useWalletStore.getState();
  return state.account;
};

if (typeof window !== 'undefined') {
  (window as any).__getRuneToken = () => {
    const s = useWalletStore.getState();
    return s.token || s.jwt || null;
  };
  (window as any).__isRuneLoggingIn = () => useWalletStore.getState().isLoggingIn;
  (window as any).__disconnectRune = () => useWalletStore.getState().disconnect();
}
