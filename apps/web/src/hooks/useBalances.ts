import { useState, useEffect } from 'react';
import { getSuiRpcUrl } from '../lib/network';

const WAL_COIN_TYPE = '0x2134d52768ea07e8c43570ef975eb3e4c27a39fa6396bef985b5abc58d03ddd2::wal::WAL';

function formatBalance(balance: string): string {
  const val = Number(balance) / 1e9;
  if (val === 0) return '0';
  if (val < 0.001) return '<0.001';
  return val.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

async function fetchBalance(owner: string, coinType?: string): Promise<string> {
  const res = await fetch(getSuiRpcUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'suix_getBalance',
      params: coinType ? [owner, coinType] : [owner],
    }),
  });
  const data = await res.json();
  return data.result?.totalBalance ?? '0';
}

export function useBalances(address: string | undefined) {
  const [sui, setSui] = useState<string | null>(null);
  const [wal, setWal] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setSui(null);
      setWal(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const [suiBal, walBal] = await Promise.all([
          fetchBalance(address),
          fetchBalance(address, WAL_COIN_TYPE),
        ]);
        if (!cancelled) {
          setSui(suiBal);
          setWal(walBal);
        }
      } catch {
        if (!cancelled) {
          setSui(null);
          setWal(null);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [address]);

  return {
    sui: sui !== null ? formatBalance(sui) : null,
    wal: wal !== null ? formatBalance(wal) : null,
  };
}
