import { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Home, Plus, Check, X, Wallet, Trash2, PenLine, Loader2, ChevronDown } from 'lucide-react';
import { getWorkspaces, createWorkspace, deleteWorkspace, renameWorkspace, type Workspace } from '../lib/forms';
import { useWalletStore } from '../context/wallet';
import './AppPage.css';

export function AppPage() {
  const location = useLocation();
  const path = location.pathname;
  const searchParams = new URLSearchParams(location.search);
  const currentWs = searchParams.get('ws');
  const isConnected = useWalletStore(s => s.isConnected);
  const account = useWalletStore(s => s.account);
  const [hydrated, setHydrated] = useState(false);
  const navigate = useNavigate();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [renamingWs, setRenamingWs] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [creatingWs, setCreatingWs] = useState(false);
  const [confirmDeleteWs, setConfirmDeleteWs] = useState<string | null>(null);
  const [deletingWsId, setDeletingWsId] = useState<string | null>(null);
  const [renamingLoading, setRenamingLoading] = useState(false);
  const [wsPickerOpen, setWsPickerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = useWalletStore.persist.onFinishHydration(() => setHydrated(true));
    if (useWalletStore.persist.hasHydrated()) setHydrated(true);
    return () => unsub();
  }, []);

  const refresh = async () => setWorkspaces(await getWorkspaces());

  useEffect(() => { refresh(); }, [path]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setWsPickerOpen(false);
      }
    };
    if (wsPickerOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [wsPickerOpen]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreatingWs(true);
    try {
      await createWorkspace(newName.trim());
      setNewName('');
      setCreating(false);
      await refresh();
    } finally {
      setCreatingWs(false);
    }
  };

  const handleDeleteWorkspace = async (wsId: string) => {
    setDeletingWsId(wsId);
    try {
      await deleteWorkspace(wsId);
      await refresh();
    } finally {
      setConfirmDeleteWs(null);
      setDeletingWsId(null);
    }
  };

  const handleRename = async (wsId: string) => {
    if (!renameValue.trim()) return;
    setRenamingLoading(true);
    try {
      await renameWorkspace(wsId, renameValue.trim());
      setRenamingWs(null);
      setRenameValue('');
      await refresh();
    } finally {
      setRenamingLoading(false);
    }
  };

  const startRename = (ws: Workspace) => {
    setRenamingWs(ws.id);
    setRenameValue(ws.name);
    setTimeout(() => renameRef.current?.focus(), 0);
  };

  const isHome = path === '/app/dashboard' && !currentWs;
  const isAuthCallback = path.startsWith('/app/auth');

  if (isAuthCallback) {
    return <Outlet />;
  }

  if (!hydrated || !isConnected || !account) {
    return (
      <div className="app-gate">
        <Navbar />
        <div className="app-gate-body">
          <div className="app-gate-card">
            <Wallet size={36} />
            <h2>{hydrated ? 'Sign in to continue' : 'Loading...'}</h2>
            <p>{hydrated ? 'Connect your wallet or sign in with Google to access the app.' : ''}</p>
            {hydrated && <Link to="/" className="btn btn-primary">Go to Home</Link>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Navbar />
      <div className="app-body">
        <nav className="app-sidebar">
          <Link
            to="/app/dashboard"
            className={`app-nav-item ${isHome ? 'active' : ''}`}
          >
            <Home size={16} />
            <span>Home</span>
          </Link>

          <div className="app-sidebar-label-inline">My Workspace</div>

          <div className="app-ws-desktop-list">
            {workspaces.map(ws => (
              <div key={ws.id} className="app-ws-row">
                {renamingWs === ws.id ? (
                  <div className="app-ws-rename">
                    <input
                      ref={renameRef}
                      type="text"
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRename(ws.id);
                        if (e.key === 'Escape') { setRenamingWs(null); setRenameValue(''); }
                      }}
                      onBlur={() => { setRenamingWs(null); setRenameValue(''); }}
                      autoFocus
                    />
                    <button className="app-ws-btn confirm" onClick={() => handleRename(ws.id)} disabled={renamingLoading}>
                      {renamingLoading ? <Loader2 size={10} className="spin" /> : <Check size={10} />}
                    </button>
                    <button className="app-ws-btn" onClick={() => { setRenamingWs(null); setRenameValue(''); }} disabled={renamingLoading}><X size={10} /></button>
                  </div>
                ) : (
                  <Link
                    to={`/app/dashboard?ws=${ws.id}`}
                    className={`app-nav-item app-ws-item ${currentWs === ws.id ? 'active' : ''}`}
                  >
                    <span className="app-ws-dot" />
                    <span className="app-ws-name">{ws.name}</span>
                    <span className="app-ws-count">{ws.formIds.length}</span>
                  </Link>
                )}
                {renamingWs !== ws.id && workspaces.length > 1 && confirmDeleteWs === ws.id ? (
                  <div className="app-ws-del-confirm">
                    <button className="app-ws-del-yes" onClick={() => handleDeleteWorkspace(ws.id)} title="Delete" disabled={!!deletingWsId}>
                      {deletingWsId === ws.id ? <Loader2 size={10} className="spin" /> : <Check size={10} />}
                    </button>
                    <button className="app-ws-del-no" onClick={() => setConfirmDeleteWs(null)} disabled={!!deletingWsId}><X size={10} /></button>
                  </div>
                ) : renamingWs !== ws.id && workspaces.length > 1 ? (
                  <div className="app-ws-actions">
                    <button className="app-ws-action" onClick={() => startRename(ws)} title="Rename">
                      <PenLine size={10} />
                    </button>
                    <button className="app-ws-action" onClick={() => setConfirmDeleteWs(ws.id)} title="Delete workspace">
                      <Trash2 size={10} />
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {creating ? (
            <div className="app-ws-create">
              <input
                ref={inputRef}
                type="text"
                placeholder="Workspace name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreate();
                  if (e.key === 'Escape') { setCreating(false); setNewName(''); }
                }}
                autoFocus
              />
              <button className="app-ws-btn confirm" onClick={handleCreate} disabled={creatingWs}>
                {creatingWs ? <Loader2 size={11} className="spin" /> : <Check size={11} />}
              </button>
              <button className="app-ws-btn" onClick={() => { setCreating(false); setNewName(''); }} disabled={creatingWs}><X size={11} /></button>
            </div>
          ) : (
            <button className="app-nav-item app-ws-new" onClick={() => setCreating(true)}>
              <Plus size={14} />
              <span>New Workspace</span>
            </button>
          )}
        </nav>
        <main className="app-main">
          <div className="app-ws-mobile-bar">
            {creating ? (
              <div className="app-ws-create">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Workspace name"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreate();
                    if (e.key === 'Escape') { setCreating(false); setNewName(''); }
                  }}
                  autoFocus
                />
                <button className="app-ws-btn confirm" onClick={handleCreate} disabled={creatingWs}>
                  {creatingWs ? <Loader2 size={11} className="spin" /> : <Check size={11} />}
                </button>
                <button className="app-ws-btn" onClick={() => { setCreating(false); setNewName(''); }} disabled={creatingWs}><X size={11} /></button>
              </div>
            ) : (
              <div className="app-ws-mobile-picker" ref={pickerRef}>
                <button className="app-ws-mobile-btn" onClick={() => setWsPickerOpen(!wsPickerOpen)}>
                  <span>{workspaces.find(w => w.id === currentWs)?.name || 'Home'}</span>
                  <ChevronDown size={12} className={`app-ws-mobile-chevron ${wsPickerOpen ? 'open' : ''}`} />
                </button>
                {wsPickerOpen && (
                  <div className="app-ws-mobile-options">
                    <button className={`app-ws-mobile-option ${!currentWs ? 'active' : ''}`} onClick={() => { navigate('/app/dashboard'); setWsPickerOpen(false); }}>
                      Home
                    </button>
                    {workspaces.map(ws => (
                      <button key={ws.id} className={`app-ws-mobile-option ${currentWs === ws.id ? 'active' : ''}`} onClick={() => { navigate(`/app/dashboard?ws=${ws.id}`); setWsPickerOpen(false); }}>
                        <span className="app-ws-mobile-opt-dot" />
                        <span>{ws.name}</span>
                        <span className="app-ws-mobile-opt-count">{ws.formIds.length}</span>
                      </button>
                    ))}
                    <div className="app-ws-mobile-divider" />
                    <button className="app-ws-mobile-option app-ws-mobile-opt-new" onClick={() => { setWsPickerOpen(false); setCreating(true); }}>
                      <Plus size={13} />
                      <span>New Workspace</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
