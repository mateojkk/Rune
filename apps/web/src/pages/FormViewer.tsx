import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Send, Star, CheckSquare, Upload } from 'lucide-react';
import type { FormSchema, FormSubmission } from '../types/form';
import { getForm, addSubmission, getCurrentUserAddress } from '../lib/forms';
import { storeSubmission } from '../lib/walrus';
import './FormViewer.css';

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function FormViewer() {
  const { formId } = useParams();
  const address = getCurrentUserAddress();
  
  const [form, setForm] = useState<FormSchema | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (formId) {
      const loadedForm = getForm(formId);
      setForm(loadedForm);
    }
  }, [formId]);

  const handleFieldChange = (fieldId: string, value: unknown) => {
    setFormData({ ...formData, [fieldId]: value });
    if (errors[fieldId]) {
      setErrors({ ...errors, [fieldId]: '' });
    }
  };

  const handleStarRating = (fieldId: string, rating: number) => {
    setFormData({ ...formData, [fieldId]: rating });
  };

  const handleCheckbox = (fieldId: string, currentValue: unknown, option: string) => {
    const current = (currentValue as string[]) || [];
    const newValue = current.includes(option)
      ? current.filter(o => o !== option)
      : [...current, option];
    setFormData({ ...formData, [fieldId]: newValue });
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
    if (!form || !validate()) return;
    
    setSubmitting(true);
    try {
      const submission: FormSubmission = {
        id: uuidv4(),
        formId: form.id,
        data: formData,
        submittedAt: new Date().toISOString(),
        walletAddress: address || undefined,
      };

      try {
        await storeSubmission(submission);
      } catch (err) {
        console.log('Walrus store failed (continuing locally):', err);
      }

      addSubmission(form.id, formData, address || undefined);
      setSubmitted(true);
    } catch (error) {
      console.error('Failed to submit:', error);
      alert('Failed to submit form');
    } finally {
      setSubmitting(false);
    }
  };

  if (!form) {
    return (
      <div className="form-viewer-empty">
        <h2>Form not found</h2>
        <p>This form doesn't exist or has been removed</p>
        <Link to="/builder" className="btn btn-primary">
          Create New Form
        </Link>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="form-viewer-success">
        <div className="success-icon">
          <CheckSquare size={48} />
        </div>
        <h2>Thank you!</h2>
        <p>Your response has been submitted</p>
        <Link to="/dashboard" className="btn btn-secondary">
          View Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="form-viewer">
      <div className="form-viewer-container">
        <div className="form-header">
          <Link to="/" className="back-link">
            <ArrowLeft size={16} />
            <span>Back</span>
          </Link>
          <h1>{form.title}</h1>
          {form.description && <p>{form.description}</p>}
        </div>

        <div className="form-fields">
          {form.fields.map(field => (
            <div key={field.id} className={`form-field ${errors[field.id] ? 'error' : ''}`}>
              <label className="field-label">
                {field.type !== 'checkbox' && (
                  <>
                    {field.label}
                    {field.required && <span className="required">*</span>}
                  </>
                )}
              </label>

              {field.type === 'text' && (
                <input
                  type="text"
                  className="input"
                  placeholder={field.placeholder}
                  value={formData[field.id] as string || ''}
                  onChange={(e) => handleFieldChange(field.id, e.target.value)}
                />
              )}

              {field.type === 'number' && (
                <input
                  type="number"
                  className="input"
                  placeholder={field.placeholder}
                  value={formData[field.id] as number || ''}
                  onChange={(e) => handleFieldChange(field.id, Number(e.target.value))}
                />
              )}

              {field.type === 'url' && (
                <input
                  type="url"
                  className="input"
                  placeholder={field.placeholder}
                  value={formData[field.id] as string || ''}
                  onChange={(e) => handleFieldChange(field.id, e.target.value)}
                />
              )}

              {field.type === 'textarea' && (
                <textarea
                  className="input textarea"
                  placeholder={field.placeholder}
                  rows={4}
                  value={formData[field.id] as string || ''}
                  onChange={(e) => handleFieldChange(field.id, e.target.value)}
                />
              )}

              {field.type === 'richtext' && (
                <textarea
                  className="input textarea richtext"
                  placeholder={field.placeholder}
                  rows={6}
                  value={formData[field.id] as string || ''}
                  onChange={(e) => handleFieldChange(field.id, e.target.value)}
                />
              )}

              {field.type === 'dropdown' && (
                <select
                  className="input"
                  value={formData[field.id] as string || ''}
                  onChange={(e) => handleFieldChange(field.id, e.target.value)}
                >
                  <option value="">Select an option</option>
                  {field.options?.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )}

              {field.type === 'checkbox' && (
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={!!formData[field.id]}
                    onChange={(e) => handleFieldChange(field.id, e.target.checked)}
                  />
                  <span>
                    {field.label}
                    {field.required && <span className="required">*</span>}
                  </span>
                </label>
              )}

              {field.type === 'multiselect' && (
                <div className="multiselect-field">
                  {field.options?.map(opt => (
                    <label key={opt} className="multiselect-option">
                      <input
                        type="checkbox"
                        checked={(formData[field.id] as string[])?.includes(opt) || false}
                        onChange={() => handleCheckbox(field.id, formData[field.id], opt)}
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              )}

              {field.type === 'starRating' && (
                <div className="star-field">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      className={`star-btn ${(formData[field.id] as number) >= star ? 'active' : ''}`}
                      onClick={() => handleStarRating(field.id, star)}
                    >
                      <Star size={32} fill={(formData[field.id] as number) >= star ? '#8B5CF6' : 'none'} stroke="#8B5CF6" />
                    </button>
                  ))}
                </div>
              )}

              {field.type === 'file' && (
                <div className="file-field">
                  <Upload size={24} />
                  <span>Click to upload file</span>
                  <input type="file" className="input" disabled />
                </div>
              )}

              {field.type === 'image' && (
                <div className="file-field">
                  <Upload size={24} />
                  <span>Click to upload image</span>
                  <input type="file" className="input" accept="image/*" disabled />
                </div>
              )}

              {field.type === 'video' && (
                <div className="file-field">
                  <Upload size={24} />
                  <span>Click to upload video</span>
                  <input type="file" className="input" accept="video/*" disabled />
                </div>
              )}

              {field.description && field.type !== 'checkbox' && (
                <p className="field-description">{field.description}</p>
              )}

              {errors[field.id] && (
                <p className="field-error">{errors[field.id]}</p>
              )}
            </div>
          ))}
        </div>

        {form.fields.length > 0 && (
          <div className="form-actions">
            <button 
              className="btn btn-primary submit-btn"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : <><Send size={18} />Submit</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}