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
  publisher: import.meta.env.VITE_WALRUS_PUBLISHER_URL || '',
  aggregator: import.meta.env.VITE_WALRUS_AGGREGATOR_URL || 'https://aggregator.walrus.space',
};

const DEFAULT_SEAL_CONFIG = {
  packageId: import.meta.env.VITE_SEAL_PACKAGE_ID || '0xcb83a248bda5f7a0a431e6bf9e96d184e604130ec5218696e3f1211113b447b7',
  keyServers: [
    { objectId: import.meta.env.VITE_SEAL_KEY_SERVER_1 || '0x145540d931f182fef76467dd8074c9839aea126852d90d18e1556fcbbd1208b6', weight: 1 },
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