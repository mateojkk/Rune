import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Star, Upload, ArrowLeft, ArrowRight, Wallet, ExternalLink, Clock, AlertTriangle, Check } from 'lucide-react';
import type { FormSchema } from '../types/form';
import { addSubmission } from '../lib/forms';
import { storeBlobWithWallet } from '../lib/walrus';
import { getFormApi } from '../lib/api';
import { getWallets, isWalletWithRequiredFeatureSet } from '@mysten/wallet-standard';
import { getSuiChain } from '../lib/network';
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
            chain: getSuiChain(),
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

function BrandFooter() {
  return (
    <div className="fv-brand-footer">
      <span>Powered by</span>
      <div className="fv-brand-lockup">
        <strong>Rune</strong>
      </div>
    </div>
  );
}

export function FormViewer() {
  const { formId } = useParams();
  const navigate = useNavigate();

  const [walletAddr, setWalletAddr] = useState<string | null>(null);
  const [walletRef, setWalletRef] = useState<any>(null);
  const [form, setForm] = useState<FormSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(-1);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [fileNames, setFileNames] = useState<Record<string, string>>({});
  const [filePreviews, setFilePreviews] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const directionRef = useRef<'next' | 'back'>('next');
  const [minLoadingDone, setMinLoadingDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinLoadingDone(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const [profilePicture, setProfilePicture] = useState('');
  const [coverPicture, setCoverPicture] = useState('');

  useEffect(() => {
    if (!formId) return;
    (async () => {
      try {
        const data = await getFormApi(formId);
        if (data) {
          setForm(data as any);
          setProfilePicture(data.profilePicture || '');
          setCoverPicture(data.coverPicture || '');
        }
      } catch (e) {
        console.error('Failed to load form:', e);
      }
      setLoading(false);
    })();
  }, [formId]);

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
    setErrors(prev => ({ ...prev, [fieldId]: '' }));
  };

  const handleCheckbox = (fieldId: string, current: any, option: string) => {
    const list = Array.isArray(current) ? [...current] : [];
    const idx = list.indexOf(option);
    if (idx > -1) list.splice(idx, 1);
    else list.push(option);
    handleFieldChange(fieldId, list);
  };

  const handleStarRating = (fieldId: string, value: number) => {
    handleFieldChange(fieldId, value);
  };

  const handleFile = async (fieldId: string, file: File | null, type: string) => {
    if (!file) return;
    setFileNames(prev => ({ ...prev, [fieldId]: file.name }));
    
    if (type === 'image' || type === 'video') {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreviews(prev => ({ ...prev, [fieldId]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }

    setFormData(prev => ({ ...prev, [fieldId]: file }));
  };

  const validate = () => {
    if (!form) return false;
    const field = form.fields[step];
    if (field.required && !formData[field.id]) {
      setErrors(prev => ({ ...prev, [field.id]: 'This field is required' }));
      return false;
    }
    return true;
  };

  const goNext = () => {
    if (!validate() || !form) return;
    if (step < form.fields.length - 1) {
      directionRef.current = 'next';
      setStep(step + 1);
      setTimeout(() => inputRef.current?.focus(), 100);
    } else if (walletAddr) {
      handleSubmit();
    } else {
      setShowPicker(true);
    }
  };

  const goBack = () => {
    directionRef.current = 'back';
    setStep(step - 1);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleSubmit = async () => {
    if (!form || !walletAddr || !walletRef) return;
    setSubmitting(true);
    try {
      const finalData: Record<string, any> = { ...formData };
      for (const field of form.fields) {
        if (field.type === 'file' || field.type === 'image' || field.type === 'video') {
          const file = formData[field.id];
          if (file instanceof File) {
            const { blobId } = await storeBlobWithWallet(file, walletAddr, walletRef.signAndExecuteTransaction);
            finalData[field.id] = blobId;
          }
        }
      }

      await addSubmission(form.id, {
        data: finalData,
        walletAddress: walletAddr,
        submittedAt: new Date().toISOString(),
      });
      setSubmitted(true);
    } catch (e) {
      console.error('Submission failed:', e);
      alert('Failed to submit form. Please try again.');
    }
    setSubmitting(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      goNext();
    }
  };

  const isActuallyLoading = loading || !minLoadingDone;

  if (isActuallyLoading) {
    return (
      <div className="dark">
        <div className="fv-loading">
          <div className="fv-loading-brand">
            <span>powered by</span>
            <strong>Rune</strong>
          </div>
          <div className="fv-loading-bar-wrap">
            <div className="fv-loading-bar-fill" />
          </div>
        </div>
      </div>
    );
  }

  const isPreview = new URLSearchParams(window.location.search).get('preview') === 'true';

  if (!form || (!form.isPublished && !isPreview)) {
    return (
      <div className="dark">
        <div className="fv-center">
          <AlertTriangle size={32} />
          <h2>{!form ? 'Form not found' : 'Form not published'}</h2>
          <p>{!form ? "This form doesn't exist or has been removed" : "The creator hasn't published this form yet"}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="dark">
        <div className="fv-center" style={{ minHeight: '100vh' }}>
          <div className="fv-success-icon"><Check size={32} /></div>
          <h2>Submission Received</h2>
          <p>Thank you for your response!</p>
          <BrandFooter />
        </div>
      </div>
    );
  }

  const progress = ((step + 1) / form.fields.length) * 100;

  if (step < 0) {
    return (
      <div className="dark">
        <div className="fv-start" style={coverPicture ? { backgroundImage: `url(${coverPicture})` } : {}}>
          <button className="fv-back-editor" onClick={() => navigate(`/app/dashboard?edit=${formId}`)}>
            <ArrowLeft size={13} /> Editor
          </button>
          <div className="fv-start-overlay" />
          <div className="fv-start-body">
            {profilePicture && (
              <div className="fv-start-profile">
                <img src={profilePicture} alt="Profile" />
              </div>
            )}
            <h1 className="fv-start-title">{form.title}</h1>
            {form.description && <p className="fv-start-desc">{form.description}</p>}
            <div className="fv-start-actions">
              <button className="fv-start-btn" onClick={() => setStep(0)}>
                Start <ArrowRight size={18} />
              </button>
              <div className="fv-start-count">
                <Clock size={13} style={{ marginRight: 4 }} />
                Takes 1 minute
              </div>
            </div>
          </div>
          <BrandFooter />
        </div>
      </div>
    );
  }

  const field = form.fields[step];
  const isLast = step === form.fields.length - 1;

  return (
    <div className="dark">
      <div className="form-viewer fv-flow">
        <button className="fv-back-editor fv-back-editor-flow" onClick={() => navigate(`/app/dashboard?edit=${formId}`)}>
          <ArrowLeft size={13} /> Editor
        </button>
        <div className="fv-progress-bar">
          <div className="fv-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="fv-flow-container">
          <div className="fv-flow-header">
            {step > 0 && (
              <button className="fv-flow-back" onClick={goBack}>
                <ArrowLeft size={18} />
              </button>
            )}
          </div>

          <div key={field.id} className={`fv-flow-field fv-slide-${directionRef.current}`}>
            <div className="fv-step-meta">
              <span className="fv-step-count">Question {step + 1} of {form.fields.length}</span>
            </div>
            <label className="fv-label">
              {field.label}
              {field.required && <span className="fv-required">*</span>}
            </label>
            {field.description && <p className="fv-desc">{field.description}</p>}
            
            <div className="fv-input-wrap">
              {(field.type === 'text' || field.type === 'email' || field.type === 'url' || field.type === 'phone' || field.type === 'date') && (
                <input 
                  ref={inputRef as any} 
                  type={field.type === 'email' ? 'email' : field.type === 'date' ? 'date' : field.type === 'phone' ? 'tel' : 'text'} 
                  className="fv-line-input" 
                  placeholder={field.placeholder || (field.type === 'email' ? 'name@example.com' : field.type === 'date' ? '' : 'Type your answer...')}
                  value={formData[field.id] as string || ''}
                  onChange={e => handleFieldChange(field.id, e.target.value)}
                  onKeyDown={handleInputKeyDown} 
                />
              )}

              {field.type === 'number' && (
                <input ref={inputRef as any} type="number" className="fv-line-input" placeholder={field.placeholder || 'Type your answer...'}
                  value={formData[field.id] as number || ''}
                  onChange={e => handleFieldChange(field.id, Number(e.target.value))}
                  onKeyDown={handleInputKeyDown} />
              )}

              {field.type === 'textarea' && (
                <textarea ref={inputRef as any} className="fv-line-input fv-textarea" placeholder={field.placeholder || 'Type your answer...'} rows={3}
                  value={formData[field.id] as string || ''}
                  onChange={e => handleFieldChange(field.id, e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (isLast && walletAddr) handleSubmit(); else goNext(); } }} />
              )}

              {field.type === 'richtext' && (
                <textarea ref={inputRef as any} className="fv-line-input fv-textarea" placeholder={field.placeholder || 'Type your answer...'} rows={4}
                  value={formData[field.id] as string || ''}
                  onChange={e => handleFieldChange(field.id, e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (isLast && walletAddr) handleSubmit(); else goNext(); } }} />
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
                <label className="fv-checkbox" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={!!formData[field.id]}
                    onChange={e => { handleFieldChange(field.id, e.target.checked); setTimeout(goNext, 200); }} />
                  <span>{field.label}{field.required && <span className="fv-required">*</span>}</span>
                </label>
              )}

              {field.type === 'multiselect' && (
                <div className="fv-multiselect" onClick={e => e.stopPropagation()}>
                  {field.options?.map(opt => (
                    <label key={opt} className="fv-multi-opt" onClick={e => e.stopPropagation()}>
                      <input type="checkbox"
                        checked={(formData[field.id] as string[])?.includes(opt) || false}
                        onChange={() => handleCheckbox(field.id, formData[field.id], opt)} />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              )}

              {field.type === 'multipleChoice' && (
                <div className="fv-choice-list">
                  {field.options?.map(opt => (
                    <button key={opt} className={`fv-choice-btn ${formData[field.id] === opt ? 'active' : ''}`}
                      onClick={() => { handleFieldChange(field.id, opt); setTimeout(goNext, 300); }}>
                      <span className="fv-choice-label">{opt}</span>
                    </button>
                  ))}
                </div>
              )}

              {field.type === 'scale' && (
                <div className="fv-scale">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(val => (
                    <button key={val} className={`fv-scale-btn ${formData[field.id] === val ? 'active' : ''}`}
                      onClick={() => { handleFieldChange(field.id, val); setTimeout(goNext, 300); }}>
                      {val}
                    </button>
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
                <div className="fv-file-wrap">
                  {field.type === 'image' && filePreviews[field.id] && (
                    <img src={filePreviews[field.id]} alt="preview" className="fv-file-img-preview" />
                  )}
                  {field.type === 'video' && filePreviews[field.id] && (
                    <video src={filePreviews[field.id]} controls className="fv-file-video-preview" />
                  )}
                  <label className="fv-file">
                    <Upload size={20} />
                    <span>{fileNames[field.id] || `Upload ${field.type}`}</span>
                    <input type="file" accept={field.type === 'image' ? 'image/*' : field.type === 'video' ? 'video/*' : undefined}
                      onChange={e => { handleFile(field.id, e.target.files?.[0] || null, field.type); if (!filePreviews[field.id]) setTimeout(goNext, 300); }} />
                  </label>
                </div>
              )}

              {errors[field.id] && <p className="fv-error">{errors[field.id]}</p>}
            </div>

            <div className="fv-flow-actions">
              {isLast && !walletAddr ? (
                <div className="fv-connect-wrap">
                  <button className="fv-flow-submit" onClick={() => setShowPicker(!showPicker)}>
                    Connect Wallet to Submit
                  </button>
                  {showPicker && (
                    <div className="fv-picker-modal">
                      <div className="fv-picker-content">
                        <div className="fv-picker-header">
                          <h3>Select Wallet</h3>
                          <button onClick={() => setShowPicker(false)}>Close</button>
                        </div>
                        <WalletConnection onConnected={(addr, ref) => { setWalletAddr(addr); setWalletRef(ref); setShowPicker(false); }} />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button 
                  className="fv-next-btn"
                  onClick={goNext}
                  disabled={submitting}
                >
                  {isLast ? (submitting ? 'Submitting...' : 'Submit') : 'Next'}
                  {!submitting && (isLast ? <Check size={18} /> : <ArrowRight size={18} />)}
                </button>
              )}
              {!field.required && !isLast && (
                <button className="fv-flow-skip" onClick={goNext}>
                  Skip
                </button>
              )}
            </div>
          </div>
        </div>
        <BrandFooter />
      </div>
    </div>
  );
}
