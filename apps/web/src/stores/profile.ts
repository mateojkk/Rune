import { create } from 'zustand';

export type Theme = 'light' | 'dark';

interface ProfileState {
  displayName: string;
  pfp: string;
  theme: Theme;
  setDisplayName: (name: string) => void;
  setPfp: (url: string) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useProfileStore = create<ProfileState>()((set, get) => ({
  displayName: '',
  pfp: '',
  theme: 'light',
  setDisplayName: (name: string) => set({ displayName: name }),
  setPfp: (url: string) => set({ pfp: url }),
  setTheme: (theme: Theme) => set({ theme }),
  toggleTheme: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
}));
