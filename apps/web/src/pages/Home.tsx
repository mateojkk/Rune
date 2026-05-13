import { Link } from 'react-router-dom';
import { ArrowRight, Database, Lock, Globe, FileText, Star, Zap } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { useConfigStore } from '../stores/config';
import './Home.css';

export function Home() {
  const network = useConfigStore(s => s.config?.network ?? 'testnet');

  return (
    <div className="home">
      <Navbar />
      <section className="hero">
        <div className="home-shell hero-layout">
          <div className="hero-content">
            <span className="hero-eyebrow">walrus-native feedback collection</span>
            <h1 className="hero-title">
              feedback, <em>permanently stored.</em>
            </h1>
            <p className="hero-subtitle">
              build forms. collect submissions. store immutably on walrus.
            </p>
            <div className="hero-actions">
              <Link to="/app" className="btn btn-primary hero-cta">
                Go to App <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          <div className="hero-panel">
            <div className="hero-panel-card">
              <span className="hero-panel-label">deployment context</span>
              <div className="hero-panel-network">{network}</div>
              <p>forms, submissions, and access flow designed for decentralized storage from the start.</p>
            </div>
            <div className="hero-metrics">
              <div className="hero-metric">
                <span>12+</span>
                <p>input types for feedback, files, ratings, and structured responses.</p>
              </div>
              <div className="hero-metric">
                <span>0</span>
                <p>backend setup required to publish a public form and start collecting data.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="ticker">
        <div className="ticker-track">
          <span>walrus</span><span>//</span><span>seal</span><span>//</span>
          <span>{network}</span><span>//</span><span>decentralized</span><span>//</span>
          <span>walrus</span><span>//</span><span>seal</span><span>//</span>
          <span>{network}</span><span>//</span><span>decentralized</span><span>//</span>
          <span>walrus</span><span>//</span><span>seal</span><span>//</span>
          <span>{network}</span><span>//</span><span>decentralized</span>
        </div>
      </section>

      <section className="feature-section">
        <div className="home-shell">
          <div className="feature-header">
            <h2>built for builders.</h2>
            <p>everything you need to collect structured feedback. no infrastructure required.</p>
          </div>
          <div className="card-grid">
            <div className="feature-card">
              <Database size={24} />
              <h3>walrus storage</h3>
              <p>submissions stored immutably on walrus testnet. no database setup.</p>
            </div>
            <div className="feature-card">
              <Lock size={24} />
              <h3>seal encryption</h3>
              <p>private submissions encrypted with seal threshold encryption.</p>
            </div>
            <div className="feature-card">
              <Globe size={24} />
              <h3>shareable links</h3>
              <p>generate public urls for any form. no auth required for submitters.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="split-section">
        <div className="home-shell split-layout">
          <div className="split-content">
            <h2>form builder,<br />native feel.</h2>
            <p>drag-and-drop interface for creating feedback forms. 12+ input types including files, ratings, and rich text.</p>
          </div>
          <div className="feature-list">
            <div className="feature-item">
              <div className="feature-item-icon"><FileText size={20} /></div>
              <div className="feature-item-content">
                <h4>12+ input types</h4>
                <p>text, textarea, select, checkbox, star rating, file upload, and more.</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-item-icon"><Star size={20} /></div>
              <div className="feature-item-content">
                <h4>rich interactions</h4>
                <p>star ratings, multi-select, and file uploads with drag-and-drop.</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-item-icon"><Zap size={20} /></div>
              <div className="feature-item-content">
                <h4>instant export</h4>
                <p>download all submissions as csv. filter, search, and manage.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="home-shell cta-layout">
          <div>
            <h2>ready to build?</h2>
            <p>sign in to start building forms.</p>
          </div>
          <Link to="/app" className="btn btn-primary">
            sign in <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}
