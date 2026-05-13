import { useConfigStore } from '../stores/config';

export type SuiNetwork = 'mainnet' | 'testnet';

function normalizeNetwork(value?: string | null): SuiNetwork {
  return value === 'mainnet' ? 'mainnet' : 'testnet';
}

export function getCurrentNetwork(): SuiNetwork {
  const configured = useConfigStore.getState().config?.network;
  return normalizeNetwork(configured || import.meta.env.VITE_NETWORK);
}

export function getSuiChain(): `sui:${SuiNetwork}` {
  return `sui:${getCurrentNetwork()}`;
}

export function getSuiRpcUrl(): string {
  return getCurrentNetwork() === 'mainnet'
    ? 'https://fullnode.mainnet.sui.io:443'
    : 'https://fullnode.testnet.sui.io:443';
}

export function getWalrusAggregatorUrl(): string {
  const configured = useConfigStore.getState().config?.walrus?.aggregator;
  if (configured) {
    return configured;
  }

  return getCurrentNetwork() === 'mainnet'
    ? 'https://aggregator.walrus.space'
    : 'https://aggregator.walrus-testnet.walrus.space';
}
