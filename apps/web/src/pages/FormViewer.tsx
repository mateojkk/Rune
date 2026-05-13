import { useState, useEffect } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { Star, CheckSquare, Upload, FileText, ArrowLeft, Loader2, Wallet, ExternalLink } from 'lucide-react';
import type { FormSchema, FormField } from '../types/form';
import { addSubmission } from '../lib/forms';
import { storeBlobWithWallet } from '../lib/walrus';
import { getFormApi } from '../lib/api';
import { getWallets, isWalletWithRequiredFeatureSet } from '@mysten/wallet-standard';
import './FormViewer.css';

function WalletConnection({ onConnected }: { onConnected: (address: string, wallet: any) => void }) {
  const [wallets, setWallets] = useState<any[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => {
    const registry = getWallets();
    const sui = registry.get().filter((w: any) => isWalletWithRequiredFeatureSet(w, ['sui:signAndExecuteTransaction']));
    setWallets(sui);

    const unregister = registry.on('register', () => {
      const updated = getWallets().get();
      setWallets(updated.filter((w: any) => isWalletWithRequiredFeatureSet(w, ['sui:signAndExecuteTransaction'])));
    });

    return () => unregister();
  }, []);

  const connect = async (wallet: any) => {
    setConnecting(wallet.name);
    try {
      const connectFeature = wallet.features['standard:connect'];
      if (!connectFeature) throw new Error('Wallet does not support connect');
      const { accounts } = await connectFeature.connect();
      const account = accounts[0];
      if (!account?.address) throw new Error('No account address received');

      const signFeature = wallet.features['sui:signAndExecuteTransaction'];
      if (!signFeature) throw new Error('Wallet does not support signing');

      onConnected(account.address, {
        signAndExecuteTransaction: async (tx: any) => {
          const result = await signFeature.signAndExecuteTransaction({
            transaction: tx.transaction || tx,
            account,
            chain: 'sui:mainnet',
          });
          return result as unknown as Record<string, unknown>;
        },
      });
    } catch (e) {
      console.error('Wallet connection failed:', e);
    }
    setConnecting(null);
  };

  if (wallets.length === 0) {
    return (
      <div className="fv-wallet-list">
        <div className="wallet-option" style={{ justifyContent: 'center', opacity: 0.6, cursor: 'default' }}>
          <span>No Sui wallet found</span>
        </div>
        <a href="https://chromewebstore.google.com/detail/sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil" target="_blank" rel="noopener noreferrer" className="wallet-option" style={{ textDecoration: 'none', justifyContent: 'center', color: 'var(--accent)' }}>
          <ExternalLink size={14} />
          <span>Install Sui Wallet</span>
        </a>
      </div>
    );
  }

  return (
    <div className="fv-wallet-list">
      {wallets.map(w => (
        <button key={w.name} className="wallet-option" onClick={() => connect(w)} disabled={connecting === w.name}>
          {w.icon ? <img src={w.icon} alt="" style={{ width: 18, height: 18 }} /> : <Wallet size={18} />}
          <span>{connecting === w.name ? 'Connecting...' : w.name}</span>
        </button>
      ))}
    </div>
  );
}

export function FormViewer() {
  const { formId } = useParams();
  const location = useLocation();
  const isEmbedded = location.pathname.startsWith('/app/');

  const [walletAddr, setWalletAddr] = useState<string | null>(null);
  const [walletRef, setWalletRef] = useState<any>(null);
  const [showPicker, setShowPicker] = useState(false);

  const [form, setForm] = useState<FormSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [profilePicture, setProfilePicture] = useState('');
  const [coverPicture, setCoverPicture] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fileNames, setFileNames] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!formId) return;
    (async () => {
      setLoading(true);
      const f = await getFormApi(formId);
      if (f) {
        setForm({
          id: f.id, title: f.title, description: f.description,
          workspaceId: f.workspaceId, fields: f.fields as FormField[],
          createdAt: f.createdAt, updatedAt: f.updatedAt,
          blobId: f.blobId, profilePicture: f.profilePicture,
          coverPicture: f.coverPicture,
        });
        setProfilePicture(f.profilePicture || '');
        setCoverPicture(f.coverPicture || '');
      }
      setLoading(false);
    })();
  }, [formId]);

  const handleFieldChange = (fieldId: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
    if (errors[fieldId]) setErrors(prev => ({ ...prev, [fieldId]: '' }));
  };

  const handleStarRating = (fieldId: string, rating: number) => {
    setFormData(prev => ({ ...prev, [fieldId]: rating }));
  };

  const handleCheckbox = (fieldId: string, currentValue: unknown, option: string) => {
    const current = (currentValue as string[]) || [];
    const newValue = current.includes(option)
      ? current.filter(o => o !== option)
      : [...current, option];
    setFormData(prev => ({ ...prev, [fieldId]: newValue }));
  };

  const handleFile = (fieldId: string, file: File | null) => {
    if (file) {
      setFileNames(prev => ({ ...prev, [fieldId]: file.name }));
      handleFieldChange(fieldId, file.name);
    }
  };

  const validate = (): boolean => {
    if (!form) return false;
    const newErrors: Record<string, string> = {};
    for (const field of form.fields) {
      if (field.required) {
        const value = formData[field.id];
        if (value === undefined || value === null || value === '') {
          newErrors[field.id] = 'This field is required';
        } else if (Array.isArray(value) && value.length === 0) {
          newErrors[field.id] = 'This field is required';
        }
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!form || !validate() || !walletAddr || !walletRef) return;
    setSubmitting(true);
    try {
      const submissionData = { data: formData, submittedAt: new Date().toISOString() };
      const blobData = { type: 'submission', version: '1.0', ...submissionData };

      const result = await storeBlobWithWallet(
        blobData,
        walletAddr,
        async (tx: Record<string, unknown>) =>
          (await walletRef.signAndExecuteTransaction({ transaction: tx as never, chain: 'sui:mainnet' } as never)) as unknown as Record<string, unknown>,
      );

      await addSubmission(form.id, { blobId: result.blobId, submittedAt: submissionData.submittedAt }, walletAddr);
      setSubmitted(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to submit form');
    } finally {
      setSubmitting(false);
    }
  };

  const onWalletConnected = (address: string, w: any) => {
    setWalletAddr(address);
    setWalletRef(w);
    setShowPicker(false);
  };

  if (loading) {
    return <div className="fv-loading"><FileText size={32} /><p>Loading form...</p></div>;
  }

  if (!form) {
    return (
      <div className="fv-center">
        <FileText size={36} />
        <h2>Form not found</h2>
        <p>This form doesn't exist or has been removed</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="fv-center" style={{ gap: 12 }}>
        <img src="/runelogo.png" alt="Rune" style={{ height: 36, opacity: 0.5, marginBottom: 4 }} />
        <div className="fv-success-icon"><CheckSquare size={40} /></div>
        <h2>Thank you!</h2>
        <p>Your response has been submitted</p>
        <p style={{ fontSize: '0.8rem', color: 'var(--subtle)', marginTop: 4 }}>
          Powered by <strong>Rune</strong> — decentralized feedback forms on Walrus
        </p>
        <a href="https://runeso.vercel.app" target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm" style={{ marginTop: 8 }}>
          Try Rune
        </a>
      </div>
    );
  }

  return (
    <div className="form-viewer">
      <div className="fv-container">
        <header className="fv-header">
          {isEmbedded && (
            <Link to="/app/dashboard" className="fv-back">
              <ArrowLeft size={14} />
              Back to Dashboard
            </Link>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <img src="/runelogo.png" alt="Rune" style={{ height: 16, filter: 'invert(1)' }} />
          </div>
          {coverPicture && (
            <div className="fv-cover-wrap">
              <img src={coverPicture} alt="" className="fv-cover-img" />
            </div>
          )}
          <div className="fv-title-row">
            {profilePicture && <img src={profilePicture} alt="" className="fv-profile-img" />}
            <div>
              <h1>{form.title}</h1>
              {form.description && <p>{form.description}</p>}
            </div>
          </div>
        </header>

        <div className="fv-fields">
          {form.fields.map(field => (
            <div key={field.id} className={`fv-field ${errors[field.id] ? 'error' : ''}`}>
              {field.type !== 'checkbox' && (
                <label className="fv-label">
                  {field.label}
                  {field.required && <span className="fv-required">*</span>}
                </label>
              )}

              {field.type === 'text' && (
                <input type="text" className="fv-input" placeholder={field.placeholder}
                  value={formData[field.id] as string || ''}
                  onChange={e => handleFieldChange(field.id, e.target.value)} />
              )}

              {field.type === 'number' && (
                <input type="number" className="fv-input" placeholder={field.placeholder}
                  value={formData[field.id] as number || ''}
                  onChange={e => handleFieldChange(field.id, Number(e.target.value))} />
              )}

              {field.type === 'url' && (
                <input type="url" className="fv-input" placeholder={field.placeholder}
                  value={formData[field.id] as string || ''}
                  onChange={e => handleFieldChange(field.id, e.target.value)} />
              )}

              {field.type === 'textarea' && (
                <textarea className="fv-input fv-textarea" placeholder={field.placeholder} rows={4}
                  value={formData[field.id] as string || ''}
                  onChange={e => handleFieldChange(field.id, e.target.value)} />
              )}

              {field.type === 'richtext' && (
                <textarea className="fv-input fv-textarea fv-richtext" placeholder={field.placeholder} rows={6}
                  value={formData[field.id] as string || ''}
                  onChange={e => handleFieldChange(field.id, e.target.value)} />
              )}

              {field.type === 'dropdown' && (
                <select className="fv-input fv-select"
                  value={formData[field.id] as string || ''}
                  onChange={e => handleFieldChange(field.id, e.target.value)}>
                  <option value="">Select an option</option>
                  {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              )}

              {field.type === 'checkbox' && (
                <label className="fv-checkbox">
                  <input type="checkbox" checked={!!formData[field.id]}
                    onChange={e => handleFieldChange(field.id, e.target.checked)} />
                  <span>{field.label}{field.required && <span className="fv-required">*</span>}</span>
                </label>
              )}

              {field.type === 'multiselect' && (
                <div className="fv-multiselect">
                  {field.options?.map(opt => (
                    <label key={opt} className="fv-multi-opt">
                      <input type="checkbox"
                        checked={(formData[field.id] as string[])?.includes(opt) || false}
                        onChange={() => handleCheckbox(field.id, formData[field.id], opt)} />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              )}

              {field.type === 'starRating' && (
                <div className="fv-stars">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button key={star} type="button"
                      className={`fv-star-btn ${(formData[field.id] as number) >= star ? 'filled' : ''}`}
                      onClick={() => handleStarRating(field.id, star)}>
                      <Star size={28} fill={(formData[field.id] as number) >= star ? 'var(--accent)' : 'none'} stroke="var(--accent)" />
                    </button>
                  ))}
                </div>
              )}

              {(field.type === 'file' || field.type === 'image' || field.type === 'video') && (
                <label className="fv-file">
                  <Upload size={20} />
                  <span>{fileNames[field.id] || `Upload ${field.type}`}</span>
                  <input type="file" accept={field.type === 'image' ? 'image/*' : field.type === 'video' ? 'video/*' : undefined}
                    onChange={e => handleFile(field.id, e.target.files?.[0] || null)} />
                </label>
              )}

              {field.description && field.type !== 'checkbox' && (
                <p className="fv-desc">{field.description}</p>
              )}
              {errors[field.id] && <p className="fv-error">{errors[field.id]}</p>}
            </div>
          ))}
          {form.fields.length > 0 && (
            <div className="fv-actions">
              {walletAddr ? (
                <button className="fv-submit" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? <Loader2 size={16} className="spin" /> : null}
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
              ) : (
                <div className="fv-connect-wrap">
                  <button className="fv-submit" onClick={() => setShowPicker(!showPicker)}>
                    <Wallet size={16} />
                    Connect Wallet
                  </button>
                  {showPicker && (
                    <div className="fv-picker-dropdown" onClick={() => setShowPicker(false)}>
                      <div className="fv-picker-inner" onClick={e => e.stopPropagation()}>
                        <WalletConnection onConnected={onWalletConnected} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="fv-powered" style={{ textAlign: 'center', marginTop: 20, fontSize: '0.72rem', color: 'var(--subtle)' }}>
            submissions stored on walrus. <span style={{ opacity: 0.5 }}>powered by rune</span>
          </div>
        </div>
      </div>
    </div>
  );
}
