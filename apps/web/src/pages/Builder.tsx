import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Plus, Trash2, GripVertical, Save, ArrowLeft, Send, Star, CheckSquare, Upload, ChevronDown, FileText, Hash, Link as LinkIcon, List } from 'lucide-react';
import type { FormField, FieldType } from '../types/form';
import { createForm, updateForm, getForm, addField, updateField, deleteField, getCurrentUserAddress } from '../lib/forms';
import { storeForm } from '../lib/walrus';
import './Builder.css';

const FIELD_TYPES: { type: FieldType; label: string; icon: React.ReactNode }[] = [
  { type: 'text', label: 'Text Input', icon: <Hash size={18} /> },
  { type: 'textarea', label: 'Text Area', icon: <FileText size={18} /> },
  { type: 'richtext', label: 'Rich Text', icon: <FileText size={18} /> },
  { type: 'dropdown', label: 'Dropdown', icon: <ChevronDown size={18} /> },
  { type: 'checkbox', label: 'Checkbox', icon: <CheckSquare size={18} /> },
  { type: 'multiselect', label: 'Multi-Select', icon: <List size={18} /> },
  { type: 'starRating', label: 'Star Rating', icon: <Star size={18} /> },
  { type: 'file', label: 'File Upload', icon: <Upload size={18} /> },
  { type: 'image', label: 'Image Upload', icon: <Upload size={18} /> },
  { type: 'video', label: 'Video Upload', icon: <Upload size={18} /> },
  { type: 'url', label: 'URL', icon: <LinkIcon size={18} /> },
  { type: 'number', label: 'Number', icon: <Hash size={18} /> },
];

export function Builder() {
  const { formId } = useParams();
  const navigate = useNavigate();
  const address = getCurrentUserAddress();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<FormField[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [currentFormId, setCurrentFormId] = useState<string | undefined>(formId);

  useEffect(() => {
    if (formId) {
      const form = getForm(formId);
      if (form) {
        setTitle(form.title);
        setDescription(form.description);
        setFields(form.fields);
        setCurrentFormId(formId);
      }
    }
  }, [formId]);

  const handleCreateForm = () => {
    if (!address) {
      alert('Please connect your wallet first');
      return;
    }
    if (!title.trim()) {
      alert('Please enter a form title');
      return;
    }
    
    const form = createForm(title, description);
    setCurrentFormId(form.id);
    navigate(`/builder/${form.id}`);
  };

  const handleAddField = (type: FieldType) => {
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

    const field = addField(currentFormId, newField);
    if (field) {
      setFields([...fields, field]);
      setEditingField(field.id);
    }
  };

  const handleUpdateField = (fieldId: string, updates: Partial<FormField>) => {
    if (!currentFormId) return;
    
    updateField(currentFormId, fieldId, updates);
    setFields(fields.map(f => f.id === fieldId ? { ...f, ...updates } : f));
  };

  const handleDeleteField = (fieldId: string) => {
    if (!currentFormId) return;
    
    deleteField(currentFormId, fieldId);
    setFields(fields.filter(f => f.id !== fieldId));
    setEditingField(null);
  };

  const handleSaveToWalrus = async () => {
    if (!currentFormId || !address) return;
    
    setSaving(true);
    try {
      const form = getForm(currentFormId);
      if (!form) return;

      const result = await storeForm(form);
      
      updateForm(currentFormId, { blobId: result.blobId });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save to Walrus:', error);
      alert('Failed to save to Walrus');
    } finally {
      setSaving(false);
    }
  };

  if (!address) {
    return (
      <div className="builder-empty">
        <h2>Connect your wallet to create forms</h2>
        <p>Use the button in the navbar to connect</p>
      </div>
    );
  }

  return (
    <div className="builder">
      <div className="builder-sidebar">
        <div className="sidebar-header">
          <Link to="/" className="back-link">
            <ArrowLeft size={16} />
            <span>Back</span>
          </Link>
          <h2>Builder</h2>
        </div>

        <div className="form-meta">
          <div className="form-group">
            <label className="label">Form Title</label>
            <input
              type="text"
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter form title"
            />
          </div>
          <div className="form-group">
            <label className="label">Description</label>
            <textarea
              className="input textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this form is for"
              rows={3}
            />
          </div>
        </div>

        <div className="field-palette">
          <h3>Add Fields</h3>
          <div className="field-types">
            {FIELD_TYPES.map(ft => (
              <button
                key={ft.type}
                className="field-type-btn"
                onClick={() => handleAddField(ft.type)}
              >
                {ft.icon}
                <span>{ft.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="sidebar-actions">
          {currentFormId && (
            <>
              <button 
                className={`btn btn-primary save-btn ${saved ? 'saved' : ''}`}
                onClick={handleSaveToWalrus}
                disabled={saving}
              >
                {saving ? 'Saving...' : saved ? 'Saved!' : <><Save size={16} />Save to Walrus</>}
              </button>
              <Link to={`/form/${currentFormId}`} className="btn btn-secondary">
                <Send size={16} />
                <span>View Form</span>
              </Link>
            </>
          )}
          {!currentFormId && (
            <button className="btn btn-primary" onClick={handleCreateForm}>
              <Plus size={16} />
              Create Form
            </button>
          )}
        </div>
      </div>

      <div className="builder-canvas">
        {!currentFormId ? (
          <div className="canvas-empty">
            <h3>Start building your form</h3>
            <p>Enter a title and click "Create Form" to get started</p>
          </div>
        ) : (
          <>
            <div className="canvas-header">
              <h1>{title || 'Untitled Form'}</h1>
              <p>{description || 'No description'}</p>
            </div>
            
            {fields.length === 0 ? (
              <div className="canvas-empty">
                <h3>Add your first field</h3>
                <p>Click a field type from the sidebar to add it</p>
              </div>
            ) : (
              <div className="fields-list">
                {fields.map(field => (
                  <div 
                    key={field.id} 
                    className={`field-card ${editingField === field.id ? 'editing' : ''}`}
                    onClick={() => setEditingField(field.id)}
                  >
                    <div className="field-drag">
                      <GripVertical size={16} />
                    </div>
                    <div className="field-content">
                      <div className="field-header-row">
                        <span className="field-type-badge">{field.type}</span>
                        {field.required && <span className="required-badge">Required</span>}
                      </div>
                      <input
                        type="text"
                        className="field-label-input"
                        value={field.label}
                        onChange={(e) => handleUpdateField(field.id, { label: e.target.value })}
                        placeholder="Field label"
                      />
                      {(field.type === 'dropdown' || field.type === 'multiselect') && (
                        <div className="field-options">
                          <label className="label">Options (one per line)</label>
                          <textarea
                            className="input textarea"
                            value={field.options?.join('\n') || ''}
                            onChange={(e) => handleUpdateField(field.id, { 
                              options: e.target.value.split('\n').filter(o => o.trim()) 
                            })}
                            placeholder="Option 1&#10;Option 2&#10;Option 3"
                            rows={3}
                          />
                        </div>
                      )}
                      {field.type === 'starRating' && (
                        <div className="field-preview">
                          <div className="stars-preview">
                            {[1,2,3,4,5].map(s => (
                              <Star key={s} size={20} fill="#8B5CF6" stroke="#8B5CF6" />
                            ))}
                          </div>
                        </div>
                      )}
                      {field.type !== 'starRating' && field.type !== 'multiselect' && field.type !== 'checkbox' && (
                        <input
                          type={field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : 'text'}
                          className="input field-preview-input"
                          placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                          disabled
                        />
                      )}
                      {field.type === 'checkbox' && (
                        <div className="checkbox-preview">
                          <input type="checkbox" disabled />
                          <span>{field.label}</span>
                        </div>
                      )}
                      {field.type === 'multiselect' && (
                        <div className="multiselect-preview">
                          {field.options?.map(opt => (
                            <label key={opt} className="multiselect-option">
                              <input type="checkbox" disabled />
                              <span>{opt}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="field-actions">
                      <button
                        className="btn-icon delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteField(field.id);
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}