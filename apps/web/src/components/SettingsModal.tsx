import { useState } from 'react';
import { X, Sun, Moon, Image, User } from 'lucide-react';
import { useProfileStore } from '../stores/profile';
import { useWalletStore } from '../context/wallet';
import './SettingsModal.css';

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { displayName, pfp, theme, setDisplayName, setPfp, toggleTheme } = useProfileStore();
  const account = useWalletStore(s => s.account);
  const [name, setName] = useState(displayName);
  const [pfpUrl, setPfpUrl] = useState(pfp);

  const handleSave = () => {
    setDisplayName(name.trim());
    if (pfpUrl.trim()) setPfp(pfpUrl.trim());
    onClose();
  };

  const handlePfpPick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setPfpUrl(dataUrl);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="settings-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="settings-body">
          <div className="settings-section">
            <div className="settings-pfp-row">
              <div className="settings-pfp" onClick={handlePfpPick}>
                {pfpUrl ? (
                  <img src={pfpUrl} alt="" />
                ) : (
                  <User size={20} />
                )}
              </div>
              <div>
                <h3>{displayName || account?.address?.slice(0, 6) || 'User'}</h3>
                <span className="settings-address">{account?.address}</span>
              </div>
            </div>
          </div>

          <div className="settings-section">
            <label className="settings-label">Display Name</label>
            <input
              type="text"
              className="settings-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter your name"
            />
          </div>

          <div className="settings-section">
            <label className="settings-label">Profile Picture</label>
            <div className="settings-pfp-input-row">
              <input
                type="text"
                className="settings-input"
                value={pfpUrl}
                onChange={e => setPfpUrl(e.target.value)}
                placeholder="Paste image URL or upload"
              />
              <button className="settings-upload-btn" onClick={handlePfpPick} title="Upload image">
                <Image size={14} />
              </button>
            </div>
          </div>

          <div className="settings-section">
            <label className="settings-label">Preferences</label>
            <div className="settings-theme-row">
              <span className="settings-theme-label">{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
              <button className="settings-theme-toggle" onClick={toggleTheme}>
                {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
                <span>{theme === 'dark' ? 'Dark' : 'Light'}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="settings-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
