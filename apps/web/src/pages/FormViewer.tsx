import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Star, CheckSquare, Upload, FileText, ArrowLeft, ArrowRight, Loader2, Wallet, ExternalLink } from 'lucide-react';
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

  const [walletAddr, setWalletAddr] = useState<string | null>(null);
  const [walletRef, setWalletRef] = useState<any>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [step, setStep] = useState(-1);

  const [form, setForm] = useState<FormSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [profilePicture, setProfilePicture] = useState('');
  const [coverPicture, setCoverPicture] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fileNames, setFileNames] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);
  const directionRef = useRef<'forward' | 'backward'>('forward');

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

  useEffect(() => {
    if (step >= 0) inputRef.current?.focus();
  }, [step]);

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

  const validateField = (fieldId: string): boolean => {
    if (!form) return false;
    const field = form.fields.find(f => f.id === fieldId);
    if (!field?.required) return true;
    const value = formData[fieldId];
    if (value === undefined || value === null || value === '') {
      setErrors(prev => ({ ...prev, [fieldId]: 'This field is required' }));
      return false;
    }
    if (Array.isArray(value) && value.length === 0) {
      setErrors(prev => ({ ...prev, [fieldId]: 'This field is required' }));
      return false;
    }
    return true;
  };

  const goNext = () => {
    if (!form) return;
    if (step < 0) { setStep(0); return; }
    const field = form.fields[step];
    if (field && !validateField(field.id)) return;
    if (step < form.fields.length - 1) {
      directionRef.current = 'forward';
      setStep(step + 1);
    }
  };

  const goBack = () => {
    if (step > 0) {
      directionRef.current = 'backward';
      setStep(step - 1);
    }
    else setStep(-1);
  };

  const handleSubmit = async () => {
    if (!form || !walletAddr || !walletRef) return;
    const last = form.fields[form.fields.length - 1];
    if (last && !validateField(last.id)) return;
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

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      if (form && step === form.fields.length - 1 && walletAddr) {
        handleSubmit();
      } else {
        goNext();
      }
    }
  };

  const progress = form ? ((step + 1) / (form.fields.length + 1)) * 100 : 0;

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
          Powered by <strong>Rune</strong>
        </p>
      </div>
    );
  }

  if (step < 0) {
    return (
      <div className="form-viewer">
        <Link to={`/app/builder/${formId}`} className="fv-back-editor">
          <ArrowLeft size={13} /> Editor
        </Link>
        <div className="fv-start" style={coverPicture ? { backgroundImage: `url(${coverPicture})` } : {}}>
          <div className="fv-start-overlay" />
          <div className="fv-start-body">
            {profilePicture && <img src={profilePicture} alt="" className="fv-start-profile" />}
            <h1>{form.title}</h1>
            {form.description && <p>{form.description}</p>}
            <div className="fv-start-footer">
              <span className="fv-start-count">{form.fields.length} question{form.fields.length !== 1 ? 's' : ''}</span>
              <button className="fv-start-btn" onClick={() => { setStep(0); setTimeout(() => inputRef.current?.focus(), 100); }}>
                Start
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const field = form.fields[step];
  const isLast = step === form.fields.length - 1;

  return (
    <div className="form-viewer fv-flow">
      <Link to={`/app/builder/${formId}`} className="fv-back-editor fv-back-editor-flow">
        <ArrowLeft size={13} /> Editor
      </Link>
      <div className="fv-progress-bar">
        <div className="fv-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="fv-container fv-flow-container">
        {step > 0 && (
          <button className="fv-flow-back" onClick={goBack}>
            <ArrowLeft size={16} />
          </button>
        )}

        <div key={step} className={`fv-flow-field fv-slide-${directionRef.current}`}>
          {field.type !== 'checkbox' && (
            <label className="fv-label">
              {field.label}
              {field.required && <span className="fv-required">*</span>}
            </label>
          )}
          {field.description && field.type !== 'checkbox' && (
            <p className="fv-desc">{field.description}</p>
          )}

          {field.type === 'text' && (
            <input ref={inputRef as any} type="text" className="fv-line-input" placeholder={field.placeholder || 'Type your answer...'}
              value={formData[field.id] as string || ''}
              onChange={e => handleFieldChange(field.id, e.target.value)}
              onKeyDown={handleInputKeyDown} />
          )}

          {field.type === 'number' && (
            <input ref={inputRef as any} type="number" className="fv-line-input" placeholder={field.placeholder || 'Type your answer...'}
              value={formData[field.id] as number || ''}
              onChange={e => handleFieldChange(field.id, Number(e.target.value))}
              onKeyDown={handleInputKeyDown} />
          )}

          {field.type === 'url' && (
            <input ref={inputRef as any} type="url" className="fv-line-input" placeholder={field.placeholder || 'Type your answer...'}
              value={formData[field.id] as string || ''}
              onChange={e => handleFieldChange(field.id, e.target.value)}
              onKeyDown={handleInputKeyDown} />
          )}

          {field.type === 'textarea' && (
            <textarea ref={inputRef as any} className="fv-line-input fv-textarea" placeholder={field.placeholder || 'Type your answer...'} rows={3}
              value={formData[field.id] as string || ''}
              onChange={e => handleFieldChange(field.id, e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (form && step === form.fields.length - 1 && walletAddr) handleSubmit(); else goNext(); } }} />
          )}

          {field.type === 'richtext' && (
            <textarea ref={inputRef as any} className="fv-line-input fv-textarea" placeholder={field.placeholder || 'Type your answer...'} rows={4}
              value={formData[field.id] as string || ''}
              onChange={e => handleFieldChange(field.id, e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (form && step === form.fields.length - 1 && walletAddr) handleSubmit(); else goNext(); } }} />
          )}

          {field.type === 'dropdown' && (
            <select ref={inputRef as any} className="fv-line-input fv-select"
              value={formData[field.id] as string || ''}
              onChange={e => { handleFieldChange(field.id, e.target.value); setTimeout(goNext, 200); }}>
              <option value="">Select an option</option>
              {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          )}

          {field.type === 'checkbox' && (
            <label className="fv-checkbox">
              <input type="checkbox" checked={!!formData[field.id]}
                onChange={e => { handleFieldChange(field.id, e.target.checked); setTimeout(goNext, 200); }} />
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
                  onClick={() => { handleStarRating(field.id, star); setTimeout(goNext, 300); }}>
                  <Star size={32} fill={(formData[field.id] as number) >= star ? 'var(--accent)' : 'none'} stroke="var(--accent)" />
                </button>
              ))}
            </div>
          )}

          {(field.type === 'file' || field.type === 'image' || field.type === 'video') && (
            <label className="fv-file">
              <Upload size={20} />
              <span>{fileNames[field.id] || `Upload ${field.type}`}</span>
              <input type="file" accept={field.type === 'image' ? 'image/*' : field.type === 'video' ? 'video/*' : undefined}
                onChange={e => { handleFile(field.id, e.target.files?.[0] || null); setTimeout(goNext, 300); }} />
            </label>
          )}

          {errors[field.id] && <p className="fv-error">{errors[field.id]}</p>}

          {renderActions()}
        </div>
      </div>
    </div>
  );

  function renderActions() {
    const autoAdvance = ['dropdown', 'checkbox', 'starRating', 'file', 'image', 'video'];
    if (autoAdvance.includes(field.type)) {
      return field.type === 'dropdown' || field.type === 'starRating' ? (
        <div className="fv-flow-actions">
          <button className="fv-flow-skip" onClick={goNext}>
            Skip <ArrowRight size={14} />
          </button>
        </div>
      ) : null;
    }
    return (
      <div className="fv-flow-actions">
        {!walletAddr && isLast ? (
          <div className="fv-connect-wrap">
            <button className="fv-flow-submit" onClick={() => setShowPicker(!showPicker)}>
              <Wallet size={15} />
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
        ) : (
          <button className="fv-flow-submit" onClick={isLast && walletAddr ? handleSubmit : goNext} disabled={submitting}>
            {isLast && walletAddr ? (submitting ? <Loader2 size={15} className="spin" /> : null) : null}
            {isLast && walletAddr ? (submitting ? 'Submitting...' : 'Submit') : 'OK'}
            {!isLast || !walletAddr ? <ArrowRight size={15} /> : null}
          </button>
        )}
      </div>
    );
  }
}
