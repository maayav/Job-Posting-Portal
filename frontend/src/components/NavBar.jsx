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
      <Link className="brand-lockup" to="/">
        <span className="brand-mark">S</span>
        <span>SkillGap</span>
      </Link>
      <nav className="topbar-user" aria-label="Main navigation">
        <div className="nav-pill">
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
        </div>
        <span className="user-chip"><i />{user?.name}</span>
        <button className="link logout-link" onClick={logout}>Exit</button>
      </nav>
    </header>
  );
}
