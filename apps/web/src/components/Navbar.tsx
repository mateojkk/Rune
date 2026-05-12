import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Wallet, Cloud, RefreshCw, LogOut, Copy, Check, Loader2 } from 'lucide-react';
import { useWalletStore } from '../context/wallet';
import { useWallet } from '@suiet/wallet-kit';
import { getCurrentUserAddress, setCurrentUser } from '../lib/forms';
import { getOAuthUrl, clearSession, type OAuthProvider } from '../lib/zklogin';
import './Navbar.css';

function formatAddress(addr: string) {
  if (addr && addr.length >= 10) {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }
  return addr || '';
}

export function Navbar() {
  const { account, isConnected, isConnecting, connectWallet, disconnect } = useWalletStore();
  const { address, select, connecting: walletConnecting, allAvailableWallets } = useWallet();
  const [copied, setCopied] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [showLogin, setShowLogin] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'zklogin' | 'wallet'>('zklogin');
  const [pendingWalletName, setPendingWalletName] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isConnected && account?.address && getCurrentUserAddress() !== account.address) {
      setCurrentUser(account.address);
    }
  }, [account?.address, isConnected]);

  useEffect(() => {
    if (!pendingWalletName || !address) return;
    connectWallet(address, pendingWalletName);
    setPendingWalletName(null);
    setShowLogin(false);
    navigate('/app/dashboard');
  }, [address, connectWallet, navigate, pendingWalletName]);

  const handleZkLogin = async (provider: OAuthProvider) => {
    setConnecting(true);
    try {
      const oauthUrl = await getOAuthUrl(provider);
      window.location.href = oauthUrl;
    } catch {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    clearSession();
    disconnect();
    setSyncStatus('idle');
  };

  const copyAddress = async () => {
    if (account?.address) {
      await navigator.clipboard.writeText(account.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSync = async () => {
    if (!account?.address) return;
    setSyncing(true);
    setSyncStatus('syncing');
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setSyncStatus('success');
    } catch {
      setSyncStatus('error');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to={isConnected && account ? '/app/dashboard' : '/'} className="navbar-brand">
          <img src="/runelogo.png" alt="Rune" className="navbar-logo" />
        </Link>

        <div className="navbar-actions">
          {isConnected && account ? (
            <>
              <button className="wallet-btn" onClick={copyAddress} title="Copy address">
                <Wallet size={14} />
                <span>{formatAddress(account.address)}</span>
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>
              <div className="wallet-actions">
                <button
                  className={`sidebar-icon-btn ${syncStatus}`}
                  onClick={handleSync}
                  disabled={syncing}
                  title="Sync to Walrus"
                >
                  {syncing ? <RefreshCw size={13} className="spin" /> : <Cloud size={13} />}
                </button>
                <button className="sidebar-icon-btn" onClick={handleDisconnect} title="Disconnect">
                  <LogOut size={13} />
                </button>
              </div>
            </>
          ) : (
            <button className="connect-btn" onClick={() => setShowLogin(!showLogin)}>
              {isConnecting ? <Loader2 size={14} className="spin" /> : <Wallet size={14} />}
              sign in
            </button>
          )}
        </div>
      </div>

      {showLogin && (
        <div className="login-dropdown" onClick={() => setShowLogin(false)}>
          <div className="login-dropdown-inner" onClick={e => e.stopPropagation()}>
            <div className="login-header">
              <h4>{loginMethod === 'zklogin' ? 'sign in with' : 'connect wallet'}</h4>
              <p>{loginMethod === 'zklogin' ? 'no wallet required' : 'using wallet extension'}</p>
              <div className="method-toggle">
                <button className={loginMethod === 'zklogin' ? 'active' : ''} onClick={() => setLoginMethod('zklogin')}>zk login</button>
                <button className={loginMethod === 'wallet' ? 'active' : ''} onClick={() => setLoginMethod('wallet')}>wallet</button>
              </div>
            </div>
            {loginMethod === 'zklogin' ? (
              <div className="login-body">
                <button className="oauth-btn google" onClick={() => handleZkLogin('google')} disabled={connecting}>
                  <img src="https://www.google.com/favicon.ico" alt="" />
                  <span>{connecting ? 'connecting...' : 'google'}</span>
                </button>
              </div>
            ) : (
              <div className="login-body">
                {allAvailableWallets.map(wallet => (
                  <button key={wallet.name} className="wallet-option" onClick={async () => {
                    try {
                      await select(wallet.name);
                      setPendingWalletName(wallet.name);
                    } catch { /* ignore */ }
                  }} disabled={walletConnecting}>
                    <Wallet size={18} />
                    <span>{wallet.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
