import { useEffect } from 'react';
import { useConfigStore } from '../stores/config';

export function ConfigInitializer({ children }: { children: React.ReactNode }) {
  const fetchConfig = useConfigStore((s) => s.fetchConfig);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return <>{children}</>;
}
