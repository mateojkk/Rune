import { useEffect } from 'react';
import { useConfigStore } from '../stores/config';
import { useProfileStore } from '../stores/profile';
import { useWalletStore } from '../context/wallet';
import { fetchProfile } from '../lib/forms';

export function ConfigInitializer({ children }: { children: React.ReactNode }) {
  const fetchConfig = useConfigStore((s) => s.fetchConfig);
  const account = useWalletStore((s) => s.account);
  const jwt = useWalletStore((s) => s.jwt);
  const token = useWalletStore((s) => s.token);
  const isLoggingIn = useWalletStore((s) => s.isLoggingIn);
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
    if (!account?.address || (!jwt && !token) || isLoggingIn) return;
    (async () => {
      try {
        const p = await fetchProfile();
        setDisplayName(p.displayName || '');
        setPfp(p.pfp || '');
        setTheme((p.theme as 'light' | 'dark') || 'light');
      } catch (e) {
        console.error('Failed to fetch profile:', e);
      }
    })();
  }, [account?.address, jwt, token, setDisplayName, setPfp, setTheme]);

  return <>{children}</>;
}
