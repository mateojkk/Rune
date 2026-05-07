import { create } from 'zustand';

export interface NetworkConfig {
  network: string;
  isMainnet: boolean;
  walrus: {
    publisher: string;
    aggregator: string;
  };
  seal: {
    packageId: string;
    keyServers: Array<{ objectId: string; weight: number }>;
  };
}

interface ConfigState {
  config: NetworkConfig | null;
  apiBase: string;
  loading: boolean;
  error: string | null;
  fetchConfig: () => Promise<void>;
}

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

const DEFAULT_WALRUS_URLS = {
  publisher: import.meta.env.VITE_WALRUS_PUBLISHER_URL || 'https://publisher.testnet.walrus.space',
  aggregator: import.meta.env.VITE_WALRUS_AGGREGATOR_URL || 'https://aggregator.testnet.walrus.space',
};

const DEFAULT_SEAL_CONFIG = {
  packageId: import.meta.env.VITE_SEAL_PACKAGE_ID || '0x8d90881fc48eb30d4422db68083b49e7d0f879658444e3a0ed85ce47feaa54b2',
  keyServers: [
    { objectId: import.meta.env.VITE_SEAL_KEY_SERVER_1 || '0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75', weight: 1 },
    { objectId: import.meta.env.VITE_SEAL_KEY_SERVER_2 || '0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8', weight: 1 },
  ],
};

export const useConfigStore = create<ConfigState>((set) => ({
  config: {
    network: import.meta.env.VITE_NETWORK || 'testnet',
    isMainnet: import.meta.env.VITE_NETWORK === 'mainnet',
    walrus: DEFAULT_WALRUS_URLS,
    seal: DEFAULT_SEAL_CONFIG,
  },
  apiBase: API_BASE,
  loading: false,
  error: null,

  fetchConfig: async () => {
    set({ loading: true, error: null });
    try {
      const response = await fetch(`${API_BASE}/api/config`);
      if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.statusText}`);
      }
      const config = await response.json();
      set({ config, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load config',
        loading: false,
      });
    }
  },
}));

export function useWalrusUrls() {
  const config = useConfigStore((s) => s.config);
  return config?.walrus ?? DEFAULT_WALRUS_URLS;
}

export function useSealConfig() {
  const config = useConfigStore((s) => s.config);
  return config?.seal ?? DEFAULT_SEAL_CONFIG;
}

export function useIsMainnet() {
  return useConfigStore((s) => s.config?.isMainnet ?? false);
}

export function useApiBase() {
  return useConfigStore((s) => s.apiBase);
}