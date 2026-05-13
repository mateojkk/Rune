import { useEffect } from 'react';
import { useConfigStore } from '../stores/config';
import { useProfileStore } from '../stores/profile';

export function ConfigInitializer({ children }: { children: React.ReactNode }) {
  const fetchConfig = useConfigStore((s) => s.fetchConfig);
  const theme = useProfileStore((s) => s.theme);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return <>{children}</>;
}
