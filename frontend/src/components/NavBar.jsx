import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { to: '/jobs', label: 'Jobs' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/analyze', label: 'New Analysis' },
  { to: '/assistant', label: 'AI Assistant' },
];

export default function NavBar() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();

  return (
    <header className="topbar">
      <div>
        <strong>SkillGap Tracker</strong>
      </div>
      <nav className="topbar-user" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => (
          <Link key={item.to} to={item.to} className={pathname === item.to ? 'active-link' : undefined}>
            {item.label}
          </Link>
        ))}
        {user?.role === 'admin' && (
          <Link to="/admin/jobs" className={pathname === '/admin/jobs' ? 'active-link' : undefined}>
            Admin Jobs
          </Link>
        )}
        <span>
          {user?.name} ({user?.role})
        </span>
        <button className="link" onClick={logout}>Log out</button>
      </nav>
    </header>
  );
}