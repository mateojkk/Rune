import { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Home, Plus, Check, X, Wallet, Trash2 } from 'lucide-react';
import { getWorkspaces, createWorkspace, deleteWorkspace, type Workspace } from '../lib/forms';
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

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [deletingWs, setDeletingWs] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = useWalletStore.persist.onFinishHydration(() => setHydrated(true));
    if (useWalletStore.persist.hasHydrated()) setHydrated(true);
    return () => unsub();
  }, []);

  const refresh = async () => setWorkspaces(await getWorkspaces());

  useEffect(() => { refresh(); }, [path]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createWorkspace(newName.trim());
    setNewName('');
    setCreating(false);
    refresh();
  };

  const handleDeleteWorkspace = async (wsId: string) => {
    await deleteWorkspace(wsId);
    setDeletingWs(null);
    refresh();
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
          {workspaces.map(ws => (
            <div key={ws.id} className="app-ws-row">
              <Link
                to={`/app/dashboard?ws=${ws.id}`}
                className={`app-nav-item app-ws-item ${currentWs === ws.id ? 'active' : ''}`}
              >
                <span className="app-ws-dot" />
                <span className="app-ws-name">{ws.name}</span>
                <span className="app-ws-count">{ws.formIds.length}</span>
              </Link>
              {workspaces.length > 1 && deletingWs === ws.id ? (
                <div className="app-ws-del-confirm">
                  <button className="app-ws-del-yes" onClick={() => handleDeleteWorkspace(ws.id)} title="Delete"><Check size={10} /></button>
                  <button className="app-ws-del-no" onClick={() => setDeletingWs(null)} title="Cancel"><X size={10} /></button>
                </div>
              ) : workspaces.length > 1 ? (
                <button className="app-ws-del" onClick={() => setDeletingWs(ws.id)} title="Delete workspace">
                  <Trash2 size={11} />
                </button>
              ) : null}
            </div>
          ))}

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
              <button className="app-ws-btn confirm" onClick={handleCreate}><Check size={11} /></button>
              <button className="app-ws-btn" onClick={() => { setCreating(false); setNewName(''); }}><X size={11} /></button>
            </div>
          ) : (
            <button className="app-nav-item app-ws-new" onClick={() => setCreating(true)}>
              <Plus size={14} />
              <span>New Workspace</span>
            </button>
          )}
        </nav>
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
