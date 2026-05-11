import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { handleOAuthCallback } from '../lib/zklogin';
import { useWalletStore } from '../context/wallet';
import './FormViewer.css';

export function AuthCallback() {
  const navigate = useNavigate();
  const connectZkLogin = useWalletStore((s) => s.connectZkLogin);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function completeSignIn() {
      try {
        const result = await handleOAuthCallback();

        if (!result) {
          throw new Error('No Google sign-in response was found.');
        }

        connectZkLogin(result.address, result.provider, result.jwt, result.session.ephemeralKeyPair.privateKey);
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
  }, [connectZkLogin, navigate]);

  if (!error) {
    return (
      <div className="form-viewer-success">
        <h2>Finishing sign-in...</h2>
        <p>We’re verifying your Google login and preparing your dashboard.</p>
      </div>
    );
  }

  return (
    <div className="form-viewer-empty">
      <h2>Sign-in could not be completed</h2>
      <p>{error}</p>
      <Link to="/app" className="btn btn-primary">
        Back to App
      </Link>
    </div>
  );
}
