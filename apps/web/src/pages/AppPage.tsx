import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import './AppPage.css';

export function AppPage() {
  return (
    <div className="app-container">
      <Navbar />
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}