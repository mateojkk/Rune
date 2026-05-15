import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, GripVertical, Save, Star, CheckSquare, Upload, ChevronDown, ChevronUp, FileText, AlignLeft, Hash, Link as LinkIcon, List, AlertTriangle, Eye, Folder, Copy, Check, Image as ImageIcon, X, Mail, Calendar, Phone, Sliders, CircleDot, ExternalLink } from 'lucide-react';
import type { FormField, FieldType, Workspace } from '../types/form';
import { createForm, updateForm, getForm, addField, updateField, deleteField, getCurrentUserAddress, getWorkspaces } from '../lib/forms';
import './Builder.css';

const FIELD_TYPES: { type: FieldType; label: string; icon: React.ReactNode }[] = [
  { type: 'text', label: 'Short Text', icon: <FileText size={16} /> },
  { type: 'textarea', label: 'Long Text', icon: <AlignLeft size={16} /> },
  { type: 'richtext', label: 'Rich Text', icon: <FileText size={16} /> },
  { type: 'email', label: 'Email', icon: <Mail size={16} /> },
  { type: 'phone', label: 'Phone Number', icon: <Phone size={16} /> },
  { type: 'number', label: 'Number', icon: <Hash size={16} /> },
  { type: 'date', label: 'Date', icon: <Calendar size={16} /> },
  { type: 'url', label: 'Website URL', icon: <LinkIcon size={16} /> },
  { type: 'multipleChoice', label: 'Multiple Choice', icon: <CircleDot size={16} /> },
  { type: 'checkbox', label: 'Checkbox', icon: <CheckSquare size={16} /> },
  { type: 'dropdown', label: 'Dropdown', icon: <ChevronDown size={16} /> },
  { type: 'multiselect', label: 'Multi-Select', icon: <List size={16} /> },
  { type: 'scale', label: 'Opinion Scale', icon: <Sliders size={16} /> },
  { type: 'starRating', label: 'Star Rating', icon: <Star size={16} /> },
  { type: 'image', label: 'Image Upload', icon: <ImageIcon size={16} /> },
  { type: 'video', label: 'Video Upload', icon: <Upload size={16} /> },
  { type: 'file', label: 'File Upload', icon: <Upload size={16} /> },
];

interface Props {
  formId: string | null;
  workspaceId: string;
  onClose: () => void;
  onSaved: () => void;
}

function BuilderModalInner({ formId, workspaceId, onClose }: Props) {
  const address = getCurrentUserAddress();
  const workspacePickerRef = useRef<HTMLDivElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<FormField[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [currentFormId, setCurrentFormId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [profilePicture, setProfilePicture] = useState('');
  const [coverPicture, setCoverPicture] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(workspaceId);
  const [showWorkspacePicker, setShowWorkspacePicker] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [optionDraft, setOptionDraft] = useState<Record<string, string>>({});
  const [isPublished, setIsPublished] = useState(false);
  const [publishId, setPublishId] = useState<string | undefined>(undefined);

  useEffect(() => {
    (async () => {
      const loaded = await getWorkspaces();
      setWorkspaces(loaded);
      setSelectedWorkspaceId(current => current || workspaceId || loaded[0]?.id || '');
    })();
  }, [workspaceId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (workspacePickerRef.current && !workspacePickerRef.current.contains(e.target as Node)) {
        setShowWorkspacePicker(false);
      }
    };
    if (showWorkspacePicker) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showWorkspacePicker]);

  useEffect(() => {
    if (formId) {
      (async () => {
        const form = await getForm(formId);
        if (form) {
          setTitle(form.title);
          setDescription(form.description);
          setFields(form.fields);
          setCurrentFormId(formId);
          setProfilePicture(form.profilePicture || '');
          setCoverPicture(form.coverPicture || '');
          setSelectedWorkspaceId(form.workspaceId || '');
          setIsPublished(!!form.isPublished);
          setPublishId(form.publishId);
        }
      })();
    } else {
      setTitle('');
      setDescription('');
      setFields([]);
      setCurrentFormId(undefined);
      setProfilePicture('');
      setCoverPicture('');
      setSelectedWorkspaceId(workspaceId);
      setIsPublished(false);
    }
  }, [formId]);

  const handleCreateForm = async () => {
    if (!address) { setError('Connect your wallet first'); return; }
    if (!title.trim()) { setError('Enter a form title'); return; }
    if (!selectedWorkspaceId) { setError('Select a workspace first'); return; }
    const form = await createForm(title, description, selectedWorkspaceId);
    setCurrentFormId(form.id);
    setError(null);
  };

  const handleAddField = async (type: FieldType) => {
    if (!currentFormId) { setError('Create the form first'); return; }
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
    }
  };

  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const titleTimer = useRef<ReturnType<typeof setTimeout>>();
  const descTimer = useRef<ReturnType<typeof setTimeout>>();

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!currentFormId) return;
    clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => {
      updateForm(currentFormId, { title: value }).catch(() => {});
    }, 500);
  };

  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    if (!currentFormId) return;
    clearTimeout(descTimer.current);
    descTimer.current = setTimeout(() => {
      updateForm(currentFormId, { description: value }).catch(() => {});
    }, 500);
  };

  const handleUpdateField = (fieldId: string, updates: Partial<FormField>) => {
    if (!currentFormId) return;
    setFields(fields => fields.map(f => f.id === fieldId ? { ...f, ...updates } : f));
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      updateField(currentFormId, fieldId, updates).catch(() => {});
    }, 500);
  };

  const handlePublish = async () => {
    if (!currentFormId) return;
    const next = !isPublished;
    await updateForm(currentFormId, { isPublished: next });
    const form = await getForm(currentFormId);
    if (form) {
      setIsPublished(!!form.isPublished);
      setPublishId(form.publishId);
    }
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
      setTimeout(() => setSaved(false), 4000);
    } catch (e) {
      setError(`Failed to save: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally { setSaving(false); }
  };

  const copyLink = async () => {
    if (!currentFormId) return;
    try {
      const link = publishId
        ? `${window.location.origin}/form/${publishId}`
        : `${window.location.origin}/${currentFormId}`;
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* */ }
  };

  const handleImagePick = (type: 'profile' | 'cover') => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || !currentFormId) return;
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        if (type === 'profile') { setProfilePicture(dataUrl); await updateForm(currentFormId, { profilePicture: dataUrl }); }
        else { setCoverPicture(dataUrl); await updateForm(currentFormId, { coverPicture: dataUrl }); }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleRemoveImage = async (type: 'profile' | 'cover') => {
    if (!currentFormId) return;
    if (type === 'profile') { setProfilePicture(''); await updateForm(currentFormId, { profilePicture: '' }); }
    else { setCoverPicture(''); await updateForm(currentFormId, { coverPicture: '' }); }
  };

  const fieldTypeLabel = (type: FieldType) => FIELD_TYPES.find(f => f.type === type)?.label || type;

  const renderFieldPreview = (field: FormField) => {
    switch (field.type) {
      case 'textarea': case 'richtext':
        return <textarea className="b-field-preview b-textarea-preview" placeholder={field.placeholder || 'Long answer text...'} rows={3} readOnly />;
      case 'dropdown':
        return <div className="b-field-preview select-preview"><span className="select-placeholder">{field.placeholder || `Select ${field.label.toLowerCase()}`}</span><ChevronDown size={14} /></div>;
      case 'checkbox':
        return <div className="b-field-preview checkbox-preview"><div className="checkbox-fake" /><span>{field.label}</span></div>;
      case 'multiselect':
        return <div className="b-field-preview multiselect-preview">{(field.options?.length ? field.options : ['Option 1', 'Option 2']).map(opt => <label key={opt} className="multi-option"><div className="checkbox-fake" /><span>{opt}</span></label>)}</div>;
      case 'multipleChoice':
        return <div className="b-field-preview multiselect-preview">{(field.options?.length ? field.options : ['Option A', 'Option B']).map(opt => <label key={opt} className="multi-option"><div className="radio-fake" /><span>{opt}</span></label>)}</div>;
      case 'starRating':
        return <div className="b-field-preview stars-preview">{[1, 2, 3, 4, 5].map(s => <Star key={s} size={18} fill="var(--accent)" stroke="var(--accent)" opacity={s <= 3 ? 1 : 0.25} />)}</div>;
      case 'file':
        return <div className="b-field-preview upload-preview"><Upload size={16} /><span>{field.placeholder || 'Upload file'}</span></div>;
      case 'image':
        return <div className="b-field-preview upload-preview"><ImageIcon size={16} /><span>{field.placeholder || 'Upload image'}</span></div>;
      case 'video':
        return <div className="b-field-preview upload-preview"><Upload size={16} /><span>{field.placeholder || 'Upload video'}</span></div>;
      default:
        return <div className="b-field-preview text-preview">{field.placeholder || `Enter ${field.label.toLowerCase()}`}</div>;
    }
  };

  const showPublish = currentFormId && fields.length > 0;

  return (
    <div className="b-modal-overlay" onClick={onClose}>
      <div className="b-modal" onClick={e => e.stopPropagation()}>
        <div className="b-modal-header">
          <h2>{currentFormId ? 'Edit Form' : 'New Form'}</h2>
          <button className="b-modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="b-modal-body">
          {!sidebarOpen && (
            <button className="b-sidebar-toggle-open" onClick={() => setSidebarOpen(true)} title="Show sidebar">
              <ChevronDown size={14} /> Fields
            </button>
          )}
          <div className={`b-modal-sidebar ${sidebarOpen ? '' : 'closed'}`}>
            <div className="b-modal-sidebar-header">
              <span className="b-label">Form Details</span>
              <button className="b-sidebar-toggle-close" onClick={() => setSidebarOpen(false)} title="Minimize sidebar">
                <ChevronUp size={14} />
              </button>
            </div>
            <div className="b-field">
              <label className="b-label">Title</label>
              <input type="text" className="b-input" value={title} onChange={e => handleTitleChange(e.target.value)} placeholder="Form title" />
            </div>
            <div className="b-field">
              <label className="b-label">Description</label>
              <textarea className="b-input b-textarea" value={description} onChange={e => handleDescriptionChange(e.target.value)} placeholder="Optional description" rows={2} />
            </div>
            {!currentFormId && (
              <div className="b-field" ref={workspacePickerRef}>
                <label className="b-label">Workspace</label>
                <button type="button" className="b-picker-trigger" onClick={() => setShowWorkspacePicker(v => !v)}>
                  <span>{workspaces.find(ws => ws.id === selectedWorkspaceId)?.name || 'Select workspace'}</span>
                  <ChevronDown size={14} />
                </button>
                {showWorkspacePicker && (
                  <div className="b-picker-menu">
                    {workspaces.map(ws => (
                      <button
                        key={ws.id}
                        type="button"
                        className={`b-picker-option ${selectedWorkspaceId === ws.id ? 'active' : ''}`}
                        onClick={() => { setSelectedWorkspaceId(ws.id); setShowWorkspacePicker(false); }}
                      >
                        <span>{ws.name}</span>
                        {selectedWorkspaceId === ws.id ? <Check size={14} /> : null}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="b-field-palette">
              <div className="b-palette-header">
                <span className="b-label">Field Types</span>
                <span className="b-field-count">{fields.length}</span>
              </div>
              <div className="b-field-types">
                {FIELD_TYPES.map(ft => (
                  <button key={ft.type} className="b-type-btn" disabled={!currentFormId} onClick={() => handleAddField(ft.type)}>
                    {ft.icon}<span>{ft.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {!currentFormId && (
              <button className="b-create-btn" onClick={handleCreateForm}>
                <Plus size={15} /> Create Form
              </button>
            )}
          </div>

          <div className="b-modal-canvas">
            {!currentFormId ? (
              <div className="b-canvas-empty" style={{ minHeight: 200 }}>
                <FileText size={28} />
                <h3>Enter a title and click "Create Form"</h3>
                <p>Then add fields from the sidebar</p>
              </div>
            ) : (
              <>
                <div className="b-canvas-ws-badge" style={{ marginBottom: 8 }}>
                  <Folder size={12} /> Editing
                </div>
                {coverPicture ? (
                  <div className="b-cover-wrap"><img src={coverPicture} alt="Cover" className="b-cover-img" /><button className="b-img-remove" onClick={() => handleRemoveImage('cover')}><X size={14} /></button></div>
                ) : (
                  <button className="b-cover-add" onClick={() => handleImagePick('cover')}><ImageIcon size={18} /><span>Add cover image</span></button>
                )}
                <div className="b-title-row">
                  {profilePicture ? (
                    <div className="b-profile-wrap"><img src={profilePicture} alt="Profile" className="b-profile-img" /><button className="b-img-remove" onClick={() => handleRemoveImage('profile')}><X size={12} /></button></div>
                  ) : (
                    <button className="b-profile-add" onClick={() => handleImagePick('profile')}><ImageIcon size={14} /></button>
                  )}
                  <div className="b-title-text">
                    <h1 style={{ fontSize: '1.3rem' }}>{title || 'Untitled Form'}</h1>
                    {description && <p>{description}</p>}
                  </div>
                </div>

                <div className="b-fields">
                  {fields.map((field, idx) => (
                    <div
                      key={field.id}
                      className={`b-field-card ${editingField === field.id ? 'editing' : ''} ${dragIndex === idx ? 'dragging' : ''} ${dragOverIndex === idx && dragIndex !== idx ? 'drag-over' : ''}`}
                      draggable
                      onDragStart={e => { setDragIndex(idx); e.dataTransfer.effectAllowed = 'move'; }}
                      onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                      onDragOver={e => { e.preventDefault(); if (dragOverIndex !== idx) setDragOverIndex(idx); }}
                      onDrop={e => {
                        e.preventDefault();
                        if (dragIndex === null || dragIndex === idx) return;
                        const next = [...fields];
                        const [moved] = next.splice(dragIndex, 1);
                        next.splice(idx, 0, moved);
                        setFields(next);
                        setDragIndex(null);
                        setDragOverIndex(null);
                        if (currentFormId) {
                          updateField(currentFormId, moved.id, { order: idx } as any).catch(() => {});
                        }
                      }}
                      onClick={() => setEditingField(field.id)}
                    >
                      <div className="b-field-drag" title="Drag to reorder"><GripVertical size={14} /></div>
                      <div className="b-field-main">
                        <div className="b-field-top">
                          <div className="b-field-badges">
                            <span className="b-field-badge">{fieldTypeLabel(field.type)}</span>
                            {field.required && <span className="b-field-badge required">Required</span>}
                          </div>
                          <span className="b-field-index">#{idx + 1}</span>
                        </div>
                        <input type="text" className="b-field-label" value={field.label}
                          onChange={e => handleUpdateField(field.id, { label: e.target.value })}
                          placeholder="Field label" onClick={e => e.stopPropagation()} />
                        {(field.type === 'dropdown' || field.type === 'multiselect' || field.type === 'multipleChoice' || field.type === 'scale') && editingField === field.id && (
                          <div className="b-field-options">
                            <label className="b-label">Options (one per line)</label>
                            <textarea
                              className="b-input b-textarea b-options-input"
                              value={optionDraft[field.id] ?? (field.options?.join('\n') || '')}
                              onChange={e => {
                                const raw = e.target.value;
                                setOptionDraft(d => ({ ...d, [field.id]: raw }));
                                handleUpdateField(field.id, { options: raw.split('\n').filter(o => o.trim()) });
                              }}
                              onBlur={() => setOptionDraft(d => { const next = { ...d }; delete next[field.id]; return next; })}
                              placeholder="Option 1&#10;Option 2&#10;Option 3"
                              rows={3}
                              onClick={e => e.stopPropagation()}
                            />
                          </div>
                        )}
                        {(field.type === 'text' || field.type === 'textarea' || field.type === 'richtext' || field.type === 'number' || field.type === 'url' || field.type === 'email' || field.type === 'phone' || field.type === 'date' || field.type === 'file' || field.type === 'image' || field.type === 'video') && editingField === field.id && (
                          <input type="text" className="b-input b-placeholder-input" value={field.placeholder || ''}
                            onChange={e => handleUpdateField(field.id, { placeholder: e.target.value })}
                            placeholder="Placeholder text" onClick={e => e.stopPropagation()} />
                        )}
                        {editingField === field.id && (
                          <div className="b-required-toggle-wrap" onClick={e => e.stopPropagation()}>
                            <label className="b-required-toggle">
                              <input
                                type="checkbox"
                                checked={field.required}
                                onChange={e => handleUpdateField(field.id, { required: e.target.checked })}
                                onClick={e => e.stopPropagation()}
                              />
                              <span>Required</span>
                            </label>
                          </div>
                        )}
                        {editingField !== field.id && renderFieldPreview(field)}
                      </div>
                      <div className="b-field-actions">
                        <button className="b-field-action-btn delete" onClick={e => { e.stopPropagation(); handleDeleteField(field.id); }} title="Delete field">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {error && <div className="b-error" style={{ marginTop: 12 }}><AlertTriangle size={12} />{error}</div>}

                {showPublish && (
                  <div className="b-modal-footer-actions">
                    <button className={`b-save-btn ${saved ? 'saved' : ''}`} onClick={handleSaveToWalrus} disabled={saving}>
                      {saving ? 'Saving...' : saved ? <><CheckSquare size={15} /> Saved</> : <><Save size={15} /> Save Form</>}
                    </button>
                    
                    <button className={`b-publish-btn ${isPublished ? 'active' : ''}`} onClick={handlePublish}>
                      {isPublished ? 'Unpublish' : 'Publish'}
                    </button>

                    {currentFormId && isPublished && (
                      <div className="b-share-link">
                        <span className="b-share-label">Public Share Link</span>
                        <div className="b-share-row">
                          <input type="text" className="b-share-input" value={`${window.location.origin}/form/${publishId || currentFormId}`} readOnly onClick={e => (e.target as HTMLInputElement).select()} />
                          <button className="b-share-copy" onClick={copyLink} title="Copy public link">
                            {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy Link</>}
                          </button>
                        </div>
                        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                          <Link to={`/form/${publishId || currentFormId}`} target="_blank" className="btn btn-secondary btn-sm" style={{ flex: 1, textDecoration: 'none' }}>
                            <ExternalLink size={14} /> View Live Form
                          </Link>
                          <Link to={`/${currentFormId}?preview=true`} className="btn btn-secondary btn-sm" style={{ flex: 1, textDecoration: 'none', opacity: 0.7 }}>
                            <Eye size={14} /> Preview Mode
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function BuilderModal(props: Props) {
  return <BuilderModalInner {...props} />;
}
