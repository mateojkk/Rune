import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserProfile {
  address: string;
  publicKey?: string;
  createdAt: string;
}

interface WalletState {
  address: string | null;
  isConnected: boolean;
  profile: UserProfile | null;
  
  connect: (address: string) => void;
  disconnect: () => void;
  getAddress: () => string | null;
  getProfile: () => UserProfile | null;
}

export const useWallet = create<WalletState>()(
  persist(
    (set, get) => ({
      address: null,
      isConnected: false,
      profile: null,

      connect: (address: string) => {
        const normalizedAddress = address.toLowerCase().trim();
        const profile: UserProfile = {
          address: normalizedAddress,
          createdAt: new Date().toISOString(),
        };
        
        set({
          address: normalizedAddress,
          isConnected: true,
          profile,
        });
      },

      disconnect: () => {
        set({
          address: null,
          isConnected: false,
          profile: null,
        });
      },

      getAddress: () => get().address,
      getProfile: () => get().profile,
    }),
    {
      name: 'rune-wallet',
    }
  )
);

export const getStoredAddress = () => useWallet.getState().address;
export const isWalletConnected = () => useWallet.getState().isConnected;