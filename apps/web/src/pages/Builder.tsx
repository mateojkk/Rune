import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, GripVertical, Save, ArrowLeft, Star, CheckSquare, Upload, ChevronDown, FileText, Hash, Link as LinkIcon, List, AlertTriangle, Eye, Clock, Folder, Copy, Check, Image as ImageIcon, X } from 'lucide-react';
import type { FormField, FieldType, Workspace, FormSchema } from '../types/form';
import { createForm, updateForm, getForm, addField, updateField, deleteField, getCurrentUserAddress, getAllForms, getSubmissions, getWorkspaces } from '../lib/forms';
import { WalletProvider } from '@suiet/wallet-kit';
import './Builder.css';

const FIELD_TYPES: { type: FieldType; label: string; icon: React.ReactNode }[] = [
  { type: 'text', label: 'Text Input', icon: <Hash size={16} /> },
  { type: 'textarea', label: 'Text Area', icon: <FileText size={16} /> },
  { type: 'richtext', label: 'Rich Text', icon: <FileText size={16} /> },
  { type: 'dropdown', label: 'Dropdown', icon: <ChevronDown size={16} /> },
  { type: 'checkbox', label: 'Checkbox', icon: <CheckSquare size={16} /> },
  { type: 'multiselect', label: 'Multi-Select', icon: <List size={16} /> },
  { type: 'starRating', label: 'Star Rating', icon: <Star size={16} /> },
  { type: 'file', label: 'File Upload', icon: <Upload size={16} /> },
  { type: 'image', label: 'Image Upload', icon: <Upload size={16} /> },
  { type: 'video', label: 'Video Upload', icon: <Upload size={16} /> },
  { type: 'url', label: 'URL', icon: <LinkIcon size={16} /> },
  { type: 'number', label: 'Number', icon: <Hash size={16} /> },
];

function BuilderInner() {
  const { formId } = useParams();
  const navigate = useNavigate();
  const address = getCurrentUserAddress();
  const [searchParams] = useSearchParams();
  const workspaceContext = searchParams.get('ws');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<FormField[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [currentFormId, setCurrentFormId] = useState<string | undefined>(formId);
  const [error, setError] = useState<string | null>(null);
  const [showFieldPalette, setShowFieldPalette] = useState(false);

  const [recentForms, setRecentForms] = useState<FormSchema[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [submissionCounts, setSubmissionCounts] = useState<Record<string, number>>({});
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState('');
  const [publishedUrl, setPublishedUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [profilePicture, setProfilePicture] = useState('');
  const [coverPicture, setCoverPicture] = useState('');

  const paletteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      const [ws, all] = await Promise.all([getWorkspaces(), getAllForms()]);
      setWorkspaces(ws);

      if (!formId) {
        const filtered = all
          .filter(f => f.fields.length > 0 || f.title.trim())
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        setRecentForms(filtered);

        const counts: Record<string, number> = {};
        const results = await Promise.all(filtered.map(f => getSubmissions(f.id)));
        filtered.forEach((f, i) => { counts[f.id] = results[i].length; });
        setSubmissionCounts(counts);
      }

      if (formId) {
        const form = await getForm(formId);
        if (form) {
          setTitle(form.title);
          setDescription(form.description);
          setFields(form.fields);
          setCurrentFormId(formId);
          setCurrentWorkspaceId(form.workspaceId || '');
          setProfilePicture(form.profilePicture || '');
          setCoverPicture(form.coverPicture || '');
          setPublishedUrl(`${window.location.origin}/form/${formId}`);
          setSaved(true);
        }
      }
    };
    load();
  }, [formId]);

  useEffect(() => {
    if (showFieldPalette) {
      const handler = (e: MouseEvent) => {
        if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) {
          setShowFieldPalette(false);
        }
      };
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }
  }, [showFieldPalette]);

  const handleCreateForm = async () => {
    if (!address) {
      setError('Connect your wallet first');
      return;
    }
    if (!title.trim()) {
      setError('Enter a form title');
      return;
    }

    const form = await createForm(title, description, workspaceContext || undefined);
    setCurrentFormId(form.id);
    setCurrentWorkspaceId(form.workspaceId || '');
    setPublishedUrl('');
    setError(null);
    navigate(`/app/builder/${form.id}`);
  };

  const handleAddField = async (type: FieldType) => {
    if (!currentFormId) {
      handleCreateForm();
      return;
    }

    const newField: Omit<FormField, 'id'> = {
      type,
      label: `New ${type} field`,
      required: false,
      placeholder: '',
      options: type === 'dropdown' || type === 'multiselect' ? ['Option 1', 'Option 2'] : undefined,
    };

    const field = await addField(currentFormId, newField);
    if (field) {
      setFields([...fields, field]);
      setEditingField(field.id);
      setShowFieldPalette(false);
    }
  };

  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  const handleUpdateField = (fieldId: string, updates: Partial<FormField>) => {
    if (!currentFormId) return;
    setFields(fields => fields.map(f => f.id === fieldId ? { ...f, ...updates } : f));
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      updateField(currentFormId, fieldId, updates).catch(() => {});
    }, 500);
  };

  const handleDeleteField = async (fieldId: string) => {
    if (!currentFormId) return;
    await deleteField(currentFormId, fieldId);
    setFields(fields.filter(f => f.id !== fieldId));
    if (editingField === fieldId) setEditingField(null);
  };

  const handleSaveToWalrus = async () => {
    if (!currentFormId || !address) return;
    setSaving(true);
    setError(null);
    try {
      const form = await getForm(currentFormId);
      if (!form) return;

      await updateForm(currentFormId, { title: form.title, description: form.description, fields: form.fields });
      setSaved(true);
      setPublishedUrl(`${window.location.origin}/form/${currentFormId}`);
      setTimeout(() => { setSaved(false); }, 4000);
    } catch (e) {
      setError(`Failed to save: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    if (!publishedUrl) return;
    try {
      await navigator.clipboard.writeText(publishedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* */ }
  };

  const handleImagePick = (type: 'profile' | 'cover') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || !currentFormId) return;
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        if (type === 'profile') {
          setProfilePicture(dataUrl);
          await updateForm(currentFormId, { profilePicture: dataUrl });
        } else {
          setCoverPicture(dataUrl);
          await updateForm(currentFormId, { coverPicture: dataUrl });
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleRemoveImage = async (type: 'profile' | 'cover') => {
    if (!currentFormId) return;
    if (type === 'profile') {
      setProfilePicture('');
      await updateForm(currentFormId, { profilePicture: '' });
    } else {
      setCoverPicture('');
      await updateForm(currentFormId, { coverPicture: '' });
    }
  };

  const fieldTypeLabel = (type: FieldType) => FIELD_TYPES.find(f => f.type === type)?.label || type;

  const renderFieldPreview = (field: FormField) => {
    switch (field.type) {
      case 'dropdown':
        return (
          <div className="b-field-preview select-preview">
            <span className="select-placeholder">{field.placeholder || `Select ${field.label.toLowerCase()}`}</span>
            <ChevronDown size={14} />
          </div>
        );
      case 'checkbox':
        return (
          <div className="b-field-preview checkbox-preview">
            <div className="checkbox-fake" />
            <span>{field.label}</span>
          </div>
        );
      case 'multiselect':
        return (
          <div className="b-field-preview multiselect-preview">
            {(field.options?.length ? field.options : ['Option 1', 'Option 2']).map(opt => (
              <label key={opt} className="multi-option">
                <div className="checkbox-fake" />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        );
      case 'starRating':
        return (
          <div className="b-field-preview stars-preview">
            {[1, 2, 3, 4, 5].map(s => (
              <Star key={s} size={18} fill="var(--accent)" stroke="var(--accent)" opacity={s <= 3 ? 1 : 0.25} />
            ))}
          </div>
        );
      case 'file':
      case 'image':
      case 'video':
        return (
          <div className="b-field-preview upload-preview">
            <Upload size={16} />
            <span>{field.placeholder || `Upload ${field.type}`}</span>
          </div>
        );
      default:
        return (
          <div className="b-field-preview text-preview">
            {field.placeholder || `Enter ${field.label.toLowerCase()}`}
          </div>
        );
    }
  };

  if (!address) {
    return (
      <div className="b-empty">
        <div className="b-empty-icon"><AlertTriangle size={32} /></div>
        <h2>Connect your wallet</h2>
        <p>Use the navbar button to connect and start building</p>
      </div>
    );
  }

  return (
    <div className="builder">
      <aside className="b-sidebar">
        <div className="b-sidebar-top">
          <Link to="/app/dashboard" className="b-back">
            <ArrowLeft size={14} />
            Dashboard
          </Link>
        </div>

        <div className="b-form-meta">
          <div className="b-field">
            <label className="b-label">Title</label>
            <input
              type="text"
              className="b-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Form title"
            />
          </div>
          <div className="b-field">
            <label className="b-label">Description</label>
            <textarea
              className="b-input b-textarea"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
            />
          </div>
        </div>

        <div className="b-field-palette">
          <div className="b-palette-header">
            <span className="b-label">Field Types</span>
            <span className="b-field-count">{fields.length}</span>
          </div>
          <div className="b-field-types">
            {FIELD_TYPES.map(ft => (
              <button
                key={ft.type}
                className="b-type-btn"
                disabled={!currentFormId}
                onClick={() => handleAddField(ft.type)}
              >
                {ft.icon}
                <span>{ft.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="b-sidebar-bottom">
          {error && (
            <div className="b-error">
              <AlertTriangle size={12} />
              {error}
            </div>
          )}
          {currentFormId ? (
            <>
              <button
                className={`b-save-btn ${saved ? 'saved' : ''}`}
                onClick={handleSaveToWalrus}
                disabled={saving}
              >
                {saving ? 'Saving...' : publishedUrl ? <><CheckSquare size={15} /> Share Link</> : <><Save size={15} /> Publish</>}
              </button>
              {publishedUrl && (
                <div className="b-share-link">
                  <span className="b-share-label">Shareable link</span>
                  <div className="b-share-row">
                    <input type="text" className="b-share-input" value={publishedUrl} readOnly onClick={e => (e.target as HTMLInputElement).select()} />
                    <button className="b-share-copy" onClick={copyLink} title="Copy link">
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              )}
              <Link to={`/app/form/${currentFormId}`} className="b-view-btn">
                <Eye size={15} />
                Preview Form
              </Link>
            </>
          ) : (
            <button className="b-create-btn" onClick={handleCreateForm}>
              <Plus size={15} />
              Create Form
            </button>
          )}
        </div>
      </aside>

      <main className="b-canvas">
        {!currentFormId ? (
          <div className="b-workspace">
            <header className="b-workspace-header">
              <h1>Your Forms</h1>
              <p>Pick up where you left off or start something new</p>
            </header>

            {recentForms.length === 0 ? (
              <div className="b-canvas-empty">
                <FileText size={36} />
                <h3>No forms yet</h3>
                <p>Enter a title in the sidebar and click "Create Form" to get started</p>
              </div>
            ) : (
              <div className="b-recent-grid">
                {workspaces.filter(ws => ws.formIds.some(id => recentForms.some(f => f.id === id))).map(ws => {
                  const wsForms = recentForms.filter(f => f.workspaceId === ws.id);
                  return (
                    <div key={ws.id} className="b-ws-block">
                      <div className="b-ws-block-header">
                        <Folder size={14} />
                        <span>{ws.name}</span>
                        <span className="b-ws-block-count">{wsForms.length}</span>
                      </div>
                      {wsForms.map(form => {
                        const subCount = submissionCounts[form.id] || 0;
                        return (
                          <Link
                            key={form.id}
                            to={`/app/builder/${form.id}`}
                            className="b-recent-card"
                          >
                            <div className="b-recent-card-top">
                              <FileText size={18} />
                              <span className="b-recent-card-fields">{form.fields.length} fields</span>
                            </div>
                            <h3 className="b-recent-card-title">{form.title || 'Untitled'}</h3>
                            {form.description && (
                              <p className="b-recent-card-desc">{form.description}</p>
                            )}
                            <div className="b-recent-card-footer">
                              <span className="b-recent-card-subs">
                                {subCount} submission{subCount !== 1 ? 's' : ''}
                              </span>
                              <span className="b-recent-card-date">
                                <Clock size={11} />
                                {new Date(form.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <>
            <header className="b-canvas-header">
              <div className="b-canvas-ws-badge">
                <Folder size={12} />
                {workspaces.find(w => w.id === currentWorkspaceId)?.name || 'General'}
              </div>
              {coverPicture ? (
                <div className="b-cover-wrap">
                  <img src={coverPicture} alt="Cover" className="b-cover-img" />
                  <button className="b-img-remove" onClick={() => handleRemoveImage('cover')} title="Remove cover"><X size={14} /></button>
                </div>
              ) : (
                <button className="b-cover-add" onClick={() => handleImagePick('cover')}>
                  <ImageIcon size={18} />
                  <span>Add cover image</span>
                </button>
              )}
              <div className="b-title-row">
                {profilePicture ? (
                  <div className="b-profile-wrap">
                    <img src={profilePicture} alt="Profile" className="b-profile-img" />
                    <button className="b-img-remove" onClick={() => handleRemoveImage('profile')} title="Remove profile"><X size={12} /></button>
                  </div>
                ) : (
                  <button className="b-profile-add" onClick={() => handleImagePick('profile')}>
                    <ImageIcon size={14} />
                  </button>
                )}
                <div className="b-title-text">
                  <h1>{title || 'Untitled Form'}</h1>
                  {description && <p>{description}</p>}
                </div>
              </div>
            </header>

            {fields.length === 0 ? (
              <div className="b-canvas-empty">
                <Plus size={28} />
                <h3>Add a field</h3>
                <p>Click a field type in the sidebar to add it to your form</p>
              </div>
            ) : (
              <div className="b-fields">
                {fields.map((field, idx) => (
                  <div
                    key={field.id}
                    className={`b-field-card ${editingField === field.id ? 'editing' : ''}`}
                    onClick={() => setEditingField(field.id)}
                  >
                    <div className="b-field-drag">
                      <GripVertical size={14} />
                    </div>

                    <div className="b-field-main">
                      <div className="b-field-top">
                        <div className="b-field-badges">
                          <span className="b-field-badge">{fieldTypeLabel(field.type)}</span>
                          {field.required && <span className="b-field-badge required">Required</span>}
                        </div>
                        <span className="b-field-index">#{idx + 1}</span>
                      </div>

                      <input
                        type="text"
                        className="b-field-label"
                        value={field.label}
                        onChange={e => handleUpdateField(field.id, { label: e.target.value })}
                        placeholder="Field label"
                        onClick={e => e.stopPropagation()}
                      />

                      {(field.type === 'dropdown' || field.type === 'multiselect') && editingField === field.id && (
                        <div className="b-field-options">
                          <label className="b-label">Options (one per line)</label>
                          <textarea
                            className="b-input b-textarea b-options-input"
                            value={field.options?.join('\n') || ''}
                            onChange={e => handleUpdateField(field.id, {
                              options: e.target.value.split('\n').filter(o => o.trim())
                            })}
                            placeholder="Option 1&#10;Option 2&#10;Option 3"
                            rows={3}
                            onClick={e => e.stopPropagation()}
                          />
                        </div>
                      )}

                      {(field.type === 'text' || field.type === 'number' || field.type === 'url') && editingField === field.id && (
                        <input
                          type="text"
                          className="b-input b-placeholder-input"
                          value={field.placeholder || ''}
                          onChange={e => handleUpdateField(field.id, { placeholder: e.target.value })}
                          placeholder="Placeholder text"
                          onClick={e => e.stopPropagation()}
                        />
                      )}

                      {editingField === field.id && (
                        <label className="b-required-toggle" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={e => handleUpdateField(field.id, { required: e.target.checked })}
                          />
                          <span>Required</span>
                        </label>
                      )}

                      {editingField !== field.id && renderFieldPreview(field)}
                    </div>

                    <div className="b-field-actions">
                      <button
                        className="b-field-action-btn delete"
                        onClick={e => { e.stopPropagation(); handleDeleteField(field.id); }}
                        title="Delete field"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export function Builder() {
  return (
    <WalletProvider>
      <BuilderInner />
    </WalletProvider>
  );
}
