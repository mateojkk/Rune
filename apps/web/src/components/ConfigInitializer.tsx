import { useEffect } from 'react';
import { useConfigStore } from '../stores/config';
import { useProfileStore } from '../stores/profile';
import { useWalletStore } from '../context/wallet';
import { fetchProfile } from '../lib/forms';

export function ConfigInitializer({ children }: { children: React.ReactNode }) {
  const fetchConfig = useConfigStore((s) => s.fetchConfig);
  const account = useWalletStore((s) => s.account);
  const theme = useProfileStore((s) => s.theme);
  const setDisplayName = useProfileStore((s) => s.setDisplayName);
  const setPfp = useProfileStore((s) => s.setPfp);
  const setTheme = useProfileStore((s) => s.setTheme);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    if (!account?.address) return;
    (async () => {
      const p = await fetchProfile();
      if (p.displayName) setDisplayName(p.displayName);
      if (p.pfp) setPfp(p.pfp);
      if (p.theme) setTheme(p.theme as 'light' | 'dark');
    })();
  }, [account?.address]);
  // Only run when account address changes, not profile actions

  return <>{children}</>;
}
