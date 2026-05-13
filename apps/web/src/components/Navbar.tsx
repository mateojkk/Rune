import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Wallet, LogOut, Copy, Loader2, Settings, ChevronDown } from 'lucide-react';
import { useWalletStore } from '../context/wallet';
import { getCurrentUserAddress, setCurrentUser } from '../lib/forms';
import { getOAuthUrl, clearSession, type OAuthProvider } from '../lib/zklogin';
import { useProfileStore } from '../stores/profile';
import { WalletLogin } from './WalletLogin';
import { SettingsModal } from './SettingsModal';
import './Navbar.css';

function formatAddress(addr: string) {
  if (addr && addr.length >= 10) {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }
  return addr || '';
}

function getInitials(name: string, addr?: string) {
  if (name) return name.slice(0, 2).toUpperCase();
  if (addr) return addr.slice(0, 2).toUpperCase();
  return '?';
}

export function Navbar() {
  const { account, isConnected, isConnecting, connectWallet, disconnect } = useWalletStore();
  const { displayName, pfp } = useProfileStore();
  const [showDropdown, setShowDropdown] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'zklogin' | 'wallet'>('zklogin');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isConnected && account?.address && getCurrentUserAddress() !== account.address) {
      setCurrentUser(account.address);
    }
  }, [account?.address, isConnected]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDropdown]);

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
    setShowDropdown(false);
  };

  const copyAddress = async () => {
    if (account?.address) {
      await navigator.clipboard.writeText(account.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
            <div className="profile-dropdown-wrap" ref={dropdownRef}>
              <button className="profile-btn" onClick={() => setShowDropdown(!showDropdown)}>
                <div className="profile-avatar">
                  {pfp ? (
                    <img src={pfp} alt="" />
                  ) : (
                    <span>{getInitials(displayName, account.address)}</span>
                  )}
                </div>
                <span className="profile-name">{displayName || formatAddress(account.address)}</span>
                <ChevronDown size={12} className={`profile-chevron ${showDropdown ? 'open' : ''}`} />
              </button>

              {showDropdown && (
                <div className="profile-dropdown">
                  <div className="profile-dropdown-header">
                    <div className="profile-dropdown-avatar">
                      {pfp ? <img src={pfp} alt="" /> : <span>{getInitials(displayName, account.address)}</span>}
                    </div>
                    <div>
                      <div className="profile-dropdown-name">{displayName || 'User'}</div>
                      <div className="profile-dropdown-addr">{formatAddress(account.address)}</div>
                    </div>
                  </div>

                  <div className="profile-dropdown-items">
                    <button className="profile-dropdown-item" onClick={copyAddress}>
                      <Copy size={13} />
                      <span>{copied ? 'Copied!' : 'Copy Address'}</span>
                    </button>
                    <button className="profile-dropdown-item" onClick={() => { setShowSettings(true); setShowDropdown(false); }}>
                      <Settings size={13} />
                      <span>Settings</span>
                    </button>
                    <div className="profile-dropdown-divider" />
                    <button className="profile-dropdown-item profile-dropdown-danger" onClick={handleDisconnect}>
                      <LogOut size={13} />
                      <span>Disconnect</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
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
                <WalletLogin onConnected={(addr) => {
                  connectWallet(addr, 'wallet-extension');
                  setShowLogin(false);
                  navigate('/app/dashboard');
                }} />
              </div>
            )}
          </div>
        </div>
      )}

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </nav>
  );
}
