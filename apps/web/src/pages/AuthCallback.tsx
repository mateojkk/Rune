import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { handleOAuthCallback } from '../lib/zklogin';
import { useWalletStore } from '../context/wallet';
import { loginWithEphemeralKey } from '../lib/auth-helper';
import './FormViewer.css';

export function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  // Track whether we've already started processing to prevent double-runs
  const hasRun = useRef(false);

  useEffect(() => {
    // Guard: only run once even if the effect fires multiple times
    if (hasRun.current) return;
    hasRun.current = true;

    let cancelled = false;

    async function completeSignIn() {
      try {
        const result = await handleOAuthCallback();

        if (!result) {
          throw new Error('No Google sign-in response was found.');
        }

        const privKey = result.session.ephemeralKeyPair.privateKey;

        // Access store imperatively — avoids stale closure / changing ref issues
        const store = useWalletStore.getState();
        store.connectZkLogin(result.address, result.provider, result.jwt, privKey);

        // Login to backend with the ephemeral key
        const token = await loginWithEphemeralKey(result.address, privKey);
        useWalletStore.getState().setToken(token);

        // Clean up the hash so navigating back doesn't re-trigger
        window.location.hash = '';

        if (!cancelled) {
          navigate('/app/dashboard', { replace: true });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Google sign-in failed.');
        }
      }
    }

    completeSignIn();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run exactly once on mount — store is accessed imperatively

  if (!error) {
    return (
      <div className="fv-center" style={{ minHeight: '100vh' }}>
        <h2>Finishing sign-in...</h2>
        <p>Verifying your Google login and preparing your dashboard.</p>
      </div>
    );
  }

  return (
    <div className="fv-center" style={{ minHeight: '100vh' }}>
      <h2>Sign-in could not be completed</h2>
      <p>{error}</p>
      <Link to="/app" className="btn btn-primary">
        Back to App
      </Link>
    </div>
  );
}
