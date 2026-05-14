import { Routes, Route, Navigate } from 'react-router-dom';
import { Home } from './pages/Home';
import { Builder } from './pages/Builder';
import { Dashboard } from './pages/Dashboard';
import { FormViewer } from './pages/FormViewer';
import { AppPage } from './pages/AppPage';
import { AuthCallback } from './pages/AuthCallback';
import './App.css';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/app" element={<AppPage />}>
        <Route path="builder" element={<Builder />} />
        <Route path="builder/:formId" element={<Builder />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="dashboard/:formId" element={<Dashboard />} />
        <Route path="auth/callback" element={<AuthCallback />} />
        <Route index element={<Navigate to="/app/dashboard" replace />} />
      </Route>
      <Route path="/:formId" element={<FormViewer />} />
    </Routes>
  );
}

export default App;
