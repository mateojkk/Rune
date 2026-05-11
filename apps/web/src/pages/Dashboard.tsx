import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Trash2, Search, FileText, Plus, Eye } from 'lucide-react';
import type { FormSchema, FormSubmission } from '../types/form';
import { getAllForms, getForm, getSubmissions, deleteForm, filterSubmissions, deleteSubmission, getCurrentUserAddress } from '../lib/forms';
import './Dashboard.css';

export function Dashboard() {
  const { formId } = useParams();
  const navigate = useNavigate();
  const address = getCurrentUserAddress();
  
  const [forms, setForms] = useState<FormSchema[]>([]);
  const [selectedForm, setSelectedForm] = useState<FormSchema | null>(null);
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredSubs, setFilteredSubs] = useState<FormSubmission[]>([]);

  useEffect(() => {
    const allForms = getAllForms();
    setForms(allForms);
    
    if (formId) {
      const form = getForm(formId);
      if (form) {
        setSelectedForm(form);
        setSubmissions(getSubmissions(formId));
      }
    } else if (allForms.length > 0) {
      setSelectedForm(allForms[0]);
      setSubmissions(getSubmissions(allForms[0].id));
    }
  }, [formId]);

  useEffect(() => {
    if (selectedForm) {
      const filtered = filterSubmissions(selectedForm.id, { search: searchQuery });
      setFilteredSubs(filtered);
    }
  }, [searchQuery, selectedForm, submissions]);

  const handleDeleteForm = (id: string) => {
    if (!confirm('Are you sure you want to delete this form?')) return;
    deleteForm(id);
    setForms(forms.filter(f => f.id !== id));
    if (selectedForm?.id === id) {
      setSelectedForm(null);
      navigate('/app/dashboard');
    }
  };

  const handleDeleteSubmission = (submissionId: string) => {
    if (!selectedForm) return;
    if (!confirm('Delete this submission?')) return;
    deleteSubmission(selectedForm.id, submissionId);
    setSubmissions(submissions.filter(s => s.id !== submissionId));
  };

  const handleExportCSV = () => {
    if (!selectedForm) return;
    
    const headers = ['Submitted At', 'Wallet Address', ...selectedForm.fields.map(f => f.label)];
    const rows = filteredSubs.map(sub => {
      const row = [
        sub.submittedAt,
        sub.walletAddress || 'anonymous',
        ...selectedForm.fields.map(f => {
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
    a.download = `${selectedForm.title}-submissions.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!address) {
    return (
      <div className="dashboard-empty">
        <h2>Connect your wallet to view dashboards</h2>
        <p>Use the button in the navbar to connect</p>
      </div>
    );
  }

  const displaySubmissions = searchQuery ? filteredSubs : submissions;

  return (
    <div className="dashboard">
      <div className="dashboard-sidebar">
        <div className="sidebar-header">
          <Link to="/" className="back-link">
            <ArrowLeft size={16} />
            <span>Back</span>
          </Link>
          <h2>Dashboard</h2>
        </div>

        <div className="forms-list">
          <div className="list-header">
            <h3>Your Forms</h3>
            <Link to="/app/builder" className="btn-icon">
              <Plus size={16} />
            </Link>
          </div>
          
          {forms.length === 0 ? (
            <div className="list-empty">
              <p>No forms yet</p>
              <Link to="/app/builder" className="btn btn-secondary btn-sm">
                Create Form
              </Link>
            </div>
          ) : (
            <div className="form-items">
              {forms.map(form => (
                <div 
                  key={form.id}
                  className={`form-item ${selectedForm?.id === form.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedForm(form);
                    navigate(`/app/dashboard/${form.id}`);
                  }}
                >
                  <div className="form-item-icon">
                    <FileText size={16} />
                  </div>
                  <div className="form-item-content">
                    <span className="form-item-title">{form.title}</span>
                    <span className="form-item-meta">
                      {form.fields.length} fields · {getSubmissions(form.id).length} submissions
                    </span>
                  </div>
                  <button
                    className="btn-icon delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteForm(form.id);
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="dashboard-main">
        {!selectedForm ? (
          <div className="main-empty">
            <h3>Select a form to view submissions</h3>
            <p>Choose a form from the sidebar or create a new one</p>
          </div>
        ) : (
          <>
            <div className="main-header">
              <div className="header-left">
                <h1>{selectedForm.title}</h1>
                <p>{selectedForm.description || 'No description'}</p>
              </div>
              <div className="header-actions">
                <Link to={`/form/${selectedForm.id}`} className="btn btn-secondary">
                  <Eye size={16} />
                  View Form
                </Link>
                <button className="btn btn-primary" onClick={handleExportCSV}>
                  <Download size={16} />
                  Export CSV
                </button>
              </div>
            </div>

            <div className="submissions-toolbar">
              <div className="search-box">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Search submissions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="results-count">
                {displaySubmissions.length} submission{displaySubmissions.length !== 1 ? 's' : ''}
              </div>
            </div>

            {displaySubmissions.length === 0 ? (
              <div className="submissions-empty">
                <h3>No submissions yet</h3>
                <p>Share your form to start collecting responses</p>
                <Link to={`/form/${selectedForm.id}`} className="btn btn-secondary">
                  <Eye size={16} />
                  View Form
                </Link>
              </div>
            ) : (
              <div className="submissions-table">
                <div className="table-header">
                  <div className="col-wallet">Wallet</div>
                  {selectedForm.fields.slice(0, 4).map(field => (
                    <div key={field.id} className="col-field">{field.label}</div>
                  ))}
                  <div className="col-date">Submitted</div>
                  <div className="col-actions"></div>
                </div>
                <div className="table-body">
                  {displaySubmissions.map(sub => (
                    <div key={sub.id} className="table-row">
                      <div className="col-wallet">
                        {sub.walletAddress ? `${sub.walletAddress.slice(0, 6)}...${sub.walletAddress.slice(-4)}` : 'anonymous'}
                      </div>
                      {selectedForm.fields.slice(0, 4).map(field => {
                        const value = sub.data[field.id];
                        let displayValue: string;
                        if (value === undefined || value === null) {
                          displayValue = '—';
                        } else if (typeof value === 'object') {
                          displayValue = Array.isArray(value) ? value.join(', ') : JSON.stringify(value);
                        } else {
                          displayValue = String(value);
                        }
                        return (
                          <div key={field.id} className="col-field" title={displayValue}>
                            {displayValue.slice(0, 50)}{displayValue.length > 50 ? '...' : ''}
                          </div>
                        );
                      })}
                      <div className="col-date">
                        {new Date(sub.submittedAt).toLocaleDateString()}
                      </div>
                      <div className="col-actions">
                        <button
                          className="btn-icon delete"
                          onClick={() => handleDeleteSubmission(sub.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
