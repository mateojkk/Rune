import { useState, useEffect } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { Star, CheckSquare, Upload, FileText, ArrowLeft, Wallet, Loader2 } from 'lucide-react';
import type { FormSchema, FormField } from '../types/form';
import { addSubmission } from '../lib/forms';
import { useWalletStore } from '../context/wallet';
import { getOAuthUrl } from '../lib/zklogin';
import { storeBlobWithKeypair } from '../lib/walrus';
import { getFormApi } from '../lib/api';
import './FormViewer.css';

export function FormViewer() {
  const { formId } = useParams();
  const location = useLocation();
  const isEmbedded = location.pathname.startsWith('/app/');
  const { account, isConnected } = useWalletStore();

  const [form, setForm] = useState<FormSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [profilePicture, setProfilePicture] = useState('');
  const [coverPicture, setCoverPicture] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fileNames, setFileNames] = useState<Record<string, string>>({});
  const [connecting, setConnecting] = useState(false);

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

  const handleZkLogin = async () => {
    setConnecting(true);
    try {
      const oauthUrl = await getOAuthUrl('google');
      window.location.href = oauthUrl;
    } catch {
      setConnecting(false);
    }
  };

  const handleSubmit = async () => {
    if (!form || !validate() || !account?.address) return;
    try {
      const blobData = { type: 'submission', version: '1.0', formId: form.id, data: formData, submittedAt: new Date().toISOString() };

      if (account.method === 'zklogin') {
        const ephemeralKey = useWalletStore.getState().ephemeralPrivateKey;
        if (ephemeralKey) {
          try {
            const { Secp256k1Keypair } = await import('@mysten/sui/keypairs/secp256k1');
            const keypair = Secp256k1Keypair.fromSecretKey(ephemeralKey);
            await storeBlobWithKeypair(blobData, keypair as never, account.address);
          } catch { /* walrus optional */ }
        }
      }

      await addSubmission(form.id, formData);
      setSubmitted(true);
    } catch {
      alert('Failed to submit form');
    }
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, opacity: 0.4 }}>
            <img src="/runelogo.png" alt="Rune" style={{ height: 16 }} />
            <span style={{ fontSize: '0.68rem', color: 'var(--subtle)' }}>Rune · walrus form</span>
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

        {!isConnected || !account?.address ? (
          <div className="fv-gate">
            <Wallet size={28} />
            <h3>Sign in to submit</h3>
            <p>Connect your wallet or sign in with Google to submit this form. You'll sign a Walrus storage transaction to store your response on-chain.</p>
            <div className="fv-gate-actions">
              <button className="btn btn-primary btn-sm" onClick={handleZkLogin} disabled={connecting}>
                {connecting ? <Loader2 size={14} className="spin" /> : null}
                Sign in with Google
              </button>
            </div>
          </div>
        ) : (
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
              <button className="fv-submit" onClick={handleSubmit}>
                Submit
              </button>
            </div>
          )}
          <div className="fv-powered" style={{ textAlign: 'center', marginTop: 20, fontSize: '0.72rem', color: 'var(--subtle)' }}>
            submissions stored on walrus. <span style={{ opacity: 0.5 }}>powered by rune</span>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
