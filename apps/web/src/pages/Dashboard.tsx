import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Search, FileText, Wallet, X, Check, PenLine, Eye, ChevronDown, Calendar, Download, ArrowLeft, Clock, Folder, Copy } from 'lucide-react';
import type { FormSchema, FormSubmission } from '../types/form';
import { getAllForms, deleteForm, getSubmissions, cacheSubmissions, getCachedSubmissions, filterSubmissions, deleteSubmission, getCurrentUserAddress, getWorkspaces } from '../lib/forms';
import { useWalletStore } from '../context/wallet';
import { downloadBlob, decryptAndRead } from '../lib/encrypted-storage';
import { createZkLoginPersonalMessageSigner } from '../lib/zklogin';
import type { Workspace } from '../types/form';
import { BuilderModal } from './BuilderModal';
import './Dashboard.css';

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function shortAddress(addr?: string) {
  if (!addr) return 'anonymous';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function Dashboard() {
  const address = getCurrentUserAddress();
  const [searchParams] = useSearchParams();
  const workspaceFilter = searchParams.get('ws');

  const [forms, setForms] = useState<FormSchema[]>([]);
  const [allForms, setAllForms] = useState<FormSchema[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [editingFormId, setEditingFormId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [workspaceId, setWorkspaceId] = useState('');

  // Submissions view state
  const [viewingSubs, setViewingSubs] = useState<FormSchema | null>(null);
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSub, setExpandedSub] = useState<string | null>(null);
  const [confirmDeleteSub, setConfirmDeleteSub] = useState<string | null>(null);
  const [deletingSub, setDeletingSub] = useState<string | null>(null);
  const [copiedFormId, setCopiedFormId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const activeWorkspaceId = workspaceFilter || workspaceId;

  const copyFormLink = async (formId: string, publishId?: string) => {
    const link = publishId
      ? `${window.location.origin}/form/${publishId}`
      : `${window.location.origin}/${formId}`;
    await navigator.clipboard.writeText(link);
    setCopiedFormId(formId);
    setTimeout(() => setCopiedFormId(null), 2000);
  };

  const displaySubmissions = useMemo(() => {
    if (!searchQuery || !viewingSubs) return submissions;
    return filterSubmissions(viewingSubs.id, { search: searchQuery });
  }, [searchQuery, viewingSubs, submissions]);

  const refreshForms = async (wsId?: string) => {
    const [all, wss] = await Promise.all([getAllForms(), getWorkspaces()]);
    setAllForms(all);
    setWorkspaces(wss);
    const filtered = wsId ? all.filter(f => f.workspaceId === wsId) : all;
    setForms(filtered);
  };

  const token = useWalletStore((s) => s.token);

  useEffect(() => {
    if (!address || !token) return;
    (async () => {
      const wsId = workspaceFilter || '';
      setWorkspaceId(wsId);
      await refreshForms(wsId || undefined);

      const editId = searchParams.get('edit');
      if (editId) {
        setEditingFormId(editId);
      }
    })();
  }, [workspaceFilter, searchParams]);

  const openSubmissions = async (form: FormSchema) => {
    setViewingSubs(form);
    setEditingFormId(null);
    setShowNewForm(false);
    setSearchQuery('');
    setExpandedSub(null);
    const subs = await getSubmissions(form.id);

    // Decrypt any encrypted submissions
    const decrypted = await Promise.all(subs.map(async (sub) => {
      const legacyBlobData = sub.data as Record<string, unknown> | undefined;
      const blobId = sub.blobId || (typeof legacyBlobData?.blobId === 'string' ? legacyBlobData.blobId : undefined);
      if (!blobId) return sub;
      try {
        const raw = await downloadBlob(blobId);
        if (!raw) return sub;

        const walletState = useWalletStore.getState();
        const currentAddress = getCurrentUserAddress();
        if (!currentAddress) return sub;

        let signer:
          | { toSuiAddress(): string; signPersonalMessage(msg: Uint8Array): Promise<{ signature: string }> }
          | null = null;

        if (walletState.account?.method === 'zklogin') {
          signer = await createZkLoginPersonalMessageSigner(currentAddress);
        } else if (walletState.personalMessageSigner) {
          const signPersonalMessage = walletState.personalMessageSigner;
          signer = {
            toSuiAddress: () => currentAddress,
            signPersonalMessage: async (msg: Uint8Array) => {
              const { signature } = await signPersonalMessage({ message: msg });
              return { signature };
            },
          };
        }

        const decryptedData = await decryptAndRead(raw, signer, currentAddress);
        return { ...sub, data: decryptedData as any };
      } catch (err) {
        console.error(`[Dashboard] Decryption failed for blob ${blobId}:`, err);
        return sub;
      }
    }));

    cacheSubmissions(form.id, decrypted);
    setSubmissions(decrypted);
  };

  const closeSubmissions = () => {
    setViewingSubs(null);
    setSubmissions([]);
    setSearchQuery('');
  };

  const handleDeleteForm = async (id: string) => {
    await deleteForm(id);
    setConfirmDelete(null);
    await refreshForms(workspaceId || undefined);
  };

  const handleDeleteSubmission = async (submissionId: string) => {
    if (!viewingSubs) return;
    setDeletingSub(submissionId);
    await new Promise(r => setTimeout(r, 200));
    await deleteSubmission(viewingSubs.id, submissionId);
    const subs = await getSubmissions(viewingSubs.id);
    cacheSubmissions(viewingSubs.id, subs);
    setSubmissions(subs);
    setDeletingSub(null);
    setConfirmDeleteSub(null);
  };

  const handleExportCSV = () => {
    if (!viewingSubs || displaySubmissions.length === 0) return;
    const headers = ['Submitted At', 'Wallet Address', ...viewingSubs.fields.map(f => f.label)];
    const rows = displaySubmissions.map(sub => {
      const row = [
        sub.submittedAt,
        sub.walletAddress || 'anonymous',
        ...viewingSubs.fields.map(f => {
          const value = sub.data[f.id];
          if (value === undefined || value === null) return '';
          if (typeof value === 'object') return JSON.stringify(value);
          return String(value);
        }),
      ];
      return row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${viewingSubs.title}-submissions.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderFieldValue = (sub: FormSubmission, field: { id: string; type: string; label: string }) => {
    const raw = sub.data[field.id];
    if (raw === undefined || raw === null) return <span className="d-sub-field-value">—</span>;
    if (field.type === 'image' && typeof raw === 'string' && raw.startsWith('data:image')) {
      return <img src={raw} alt={field.label} style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, border: '1px solid var(--border)', marginTop: 4 }} />;
    }
    if (field.type === 'video' && typeof raw === 'string' && raw.startsWith('data:video')) {
      return <video src={raw} controls style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, border: '1px solid var(--border)', marginTop: 4 }} />;
    }
    const text = typeof raw === 'object' ? (Array.isArray(raw) ? raw.join(', ') : JSON.stringify(raw)) : String(raw);
    // Truncate very long base64 blobs gracefully
    const display = text.startsWith('data:') ? '[file uploaded]' : text;
    return <span className="d-sub-field-value">{display}</span>;
  };

  const handleFormSaved = () => {
    setShowNewForm(false);
    setEditingFormId(null);
    refreshForms(workspaceId);
  };

  const startEditForm = (id: string) => {
    setEditingFormId(id);
    setShowNewForm(false);
  };

  const startNewForm = () => {
    setShowNewForm(true);
    setEditingFormId(null);
  };

  const closeModal = () => {
    setShowNewForm(false);
    setEditingFormId(null);
    refreshForms(workspaceId);
  };

  if (!address) {
    return (
      <div className="d-empty">
        <div className="d-empty-icon"><Wallet size={32} /></div>
        <h2>Connect your wallet</h2>
        <p>Use the button in the navbar to view your forms</p>
      </div>
    );
  }

  // Submissions view
  if (viewingSubs) {
    return (
      <div className="dashboard">
        <div className="d-main">
          <div className="d-subs-header">
            <button className="d-subs-back" onClick={closeSubmissions}>
              <ArrowLeft size={14} />
              Back
            </button>
            <h1>{viewingSubs.title}</h1>
            <div className="d-subs-header-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => startEditForm(viewingSubs.id)}>
                <PenLine size={13} />
                Edit
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleExportCSV} disabled={displaySubmissions.length === 0}>
                <Download size={13} />
                CSV
              </button>
            </div>
          </div>

          <div className="d-stats-row">
            <span>{displaySubmissions.length} submission{displaySubmissions.length !== 1 ? 's' : ''}</span>
            <span>·</span>
            <span>{viewingSubs.fields.length} field{viewingSubs.fields.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="d-toolbar">
            <div className="d-search">
              <Search size={14} />
              <input ref={searchRef} type="text" placeholder="Search submissions..." value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)} />
              {searchQuery && (
                <button className="d-search-clear" onClick={() => { setSearchQuery(''); searchRef.current?.focus(); }}>
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {displaySubmissions.length === 0 ? (
            <div className="d-sub-empty">
              <FileText size={24} />
              <h3>{searchQuery ? 'No results' : 'No submissions yet'}</h3>
              <p>{searchQuery ? `No submissions match "${searchQuery}"` : 'Share your form to start collecting responses'}</p>
              {searchQuery && <button className="btn btn-secondary btn-sm" onClick={() => setSearchQuery('')}>Clear search</button>}
            </div>
          ) : (
            <div className="d-subs">
              {displaySubmissions.map(sub => (
                <div key={sub.id} className={`d-sub ${expandedSub === sub.id ? 'expanded' : ''} ${deletingSub === sub.id ? 'deleting' : ''}`}>
                  <button className="d-sub-header" onClick={() => setExpandedSub(expandedSub === sub.id ? null : sub.id)}>
                    <div className="d-sub-header-left">
                      <span className="d-sub-wallet">{shortAddress(sub.walletAddress)}</span>
                      <span className="d-sub-date"><Calendar size={11} />{formatDate(sub.submittedAt)}</span>
                    </div>
                    <div className="d-sub-header-right">
                      {confirmDeleteSub === sub.id ? (
                        <div className="d-sub-confirm" onClick={e => e.stopPropagation()}>
                          <span className="d-sub-confirm-text">Delete?</span>
                          <button className="d-icon-btn confirm-yes" onClick={() => handleDeleteSubmission(sub.id)}><Check size={11} /></button>
                          <button className="d-icon-btn confirm-no" onClick={e => { e.stopPropagation(); setConfirmDeleteSub(null); }}><X size={11} /></button>
                        </div>
                      ) : (
                        <div className="d-sub-actions">
                          <button className="d-icon-btn delete" onClick={e => { e.stopPropagation(); setConfirmDeleteSub(sub.id); }} title="Delete submission"><Trash2 size={12} /></button>
                          <span className={`d-sub-expand-icon ${expandedSub === sub.id ? 'rotated' : ''}`}><ChevronDown size={13} /></span>
                        </div>
                      )}
                    </div>
                  </button>
                  {expandedSub === sub.id && (
                    <div className="d-sub-body">
                      <div className="d-sub-field-group">
                        <span className="d-sub-field-label">Wallet</span>
                        <span className="d-sub-field-value mono">{sub.walletAddress || 'anonymous'}</span>
                      </div>
                      <div className="d-sub-field-group">
                        <span className="d-sub-field-label">Submitted</span>
                        <span className="d-sub-field-value">{formatDate(sub.submittedAt)}</span>
                      </div>
                      {viewingSubs.fields.map(field => (
                        <div key={field.id} className="d-sub-field-group">
                          <span className="d-sub-field-label">{field.label}</span>
                          {renderFieldValue(sub, field)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {editingFormId && (
          <BuilderModal formId={editingFormId} workspaceId={activeWorkspaceId} onClose={closeModal} onSaved={handleFormSaved} />
        )}
      </div>
    );
  }

  // Home overview
  if (!workspaceFilter) {
    const totalForms = allForms.length;
    const totalSubs = allForms.reduce((acc, f) => acc + getCachedSubmissions(f.id).length, 0);
    const recentForms = [...allForms]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 8);

    return (
      <div className="dashboard">
        <div className="d-main">
          <header className="d-home-header">
            <h1>Overview</h1>
            <button className="btn btn-primary btn-sm" onClick={startNewForm}>
              <Plus size={14} />
              New Form
            </button>
          </header>

          <div className="d-stats-row">
            <span>{totalForms} form{totalForms !== 1 ? 's' : ''}</span>
            <span>·</span>
            <span>{totalSubs} submission{totalSubs !== 1 ? 's' : ''}</span>
          </div>

          {totalForms === 0 ? (
            <div className="d-main-empty">
              <FileText size={36} />
              <h3>No forms yet</h3>
              <p>Create your first form to start collecting responses</p>
            </div>
          ) : (
            <>
              <h3 className="d-home-section-title">Recent Forms</h3>
              <div className="d-home-recent">
                {recentForms.map(form => {
                  const ws = workspaces.find(w => w.id === form.workspaceId);
                  const subCount = getCachedSubmissions(form.id).length;
                  return (
                    <div key={form.id} className="d-home-card" onClick={() => startEditForm(form.id)}>
                      <div className="d-home-card-top">
                        <FileText size={16} />
                        <span className="d-home-card-meta">{form.fields.length}f · {subCount}s</span>
                      </div>
                      <h3 className="d-home-card-title">{form.title || 'Untitled'}</h3>
                      {form.description && <p className="d-home-card-desc">{form.description}</p>}
                      <div className="d-home-card-footer">
                        {ws && <span><Folder size={11} />{ws.name}</span>}
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span><Clock size={11} />{new Date(form.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          {confirmDelete === form.id ? (
                            <span className="d-form-card-del-confirm" onClick={e => e.stopPropagation()}>
                              <button className="d-icon-btn confirm-yes" onClick={() => handleDeleteForm(form.id)}><Check size={9} /></button>
                              <button className="d-icon-btn confirm-no" onClick={() => setConfirmDelete(null)}><X size={9} /></button>
                            </span>
                          ) : (
                            <button className="d-form-card-del" onClick={e => { e.stopPropagation(); setConfirmDelete(form.id); }} title="Delete">
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {(showNewForm || editingFormId) && (
          <BuilderModal formId={editingFormId} workspaceId={activeWorkspaceId} onClose={closeModal} onSaved={handleFormSaved} />
        )}
      </div>
    );
  }

  // Workspace forms list
  return (
    <div className="dashboard">
      <div className="d-main">
        <header className="d-ws-header">
          <h1>Forms</h1>
          <button className="btn btn-primary btn-sm" onClick={startNewForm}>
            <Plus size={14} />
            New Form
          </button>
        </header>

        {forms.length === 0 ? (
          <div className="d-main-empty">
            <FileText size={36} />
            <h3>No forms yet</h3>
            <p>Create your first form to start collecting responses</p>
          </div>
        ) : (
          <div className="d-form-grid">
            {[...forms]
              .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
              .map(form => {
                const subCount = getCachedSubmissions(form.id).length;
                return (
                  <div key={form.id} className="d-form-card">
                    <div className="d-form-card-body">
                      <h3>{form.title || 'Untitled'}</h3>
                      <div className="d-form-card-meta">{form.fields.length}f · {subCount}s</div>
                    </div>
                    <div className="d-form-card-actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => openSubmissions(form)}>
                        <Eye size={12} /> {subCount}
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => copyFormLink(form.id, form.publishId)} title="Copy form link">
                        {copiedFormId === form.id ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => startEditForm(form.id)}>
                        <PenLine size={12} />
                      </button>
                      {confirmDelete === form.id ? (
                        <div className="d-form-card-del-confirm">
                          <span>Delete?</span>
                          <button className="d-icon-btn confirm-yes" onClick={() => handleDeleteForm(form.id)}><Check size={10} /></button>
                          <button className="d-icon-btn confirm-no" onClick={() => setConfirmDelete(null)}><X size={10} /></button>
                        </div>
                      ) : (
                        <button className="d-form-card-del" onClick={() => setConfirmDelete(form.id)} title="Delete">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {(showNewForm || editingFormId) && (
        <BuilderModal formId={editingFormId} workspaceId={activeWorkspaceId} onClose={closeModal} onSaved={handleFormSaved} />
      )}
    </div>
  );
}
