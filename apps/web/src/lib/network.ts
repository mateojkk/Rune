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
    ? 'https://rpc.mainnet.sui.io'
    : 'https://rpc.testnet.sui.io';
}

export function getWalrusAggregatorUrl(): string {
  return getWalrusAggregatorUrls()[0];
}

export function getWalrusAggregatorUrls(): string[] {
  const configured = useConfigStore.getState().config?.walrus?.aggregator;
  const defaults = getCurrentNetwork() === 'mainnet'
    ? ['https://aggregator.walrus-mainnet.walrus.space', 'https://aggregator.walrus.space']
    : ['https://aggregator.walrus-testnet.walrus.space'];

  return configured
    ? [configured, ...defaults.filter(url => url !== configured)]
    : defaults;
}
