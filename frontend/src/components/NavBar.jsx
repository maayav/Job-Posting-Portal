import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from './ThemeToggle';
import NotificationBell from './NotificationBell';
import { createPortal } from 'react-dom';

const NAV_ITEMS = [
  { to: '/jobs', label: 'Jobs' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/analyze', label: 'New Analysis' },
  { to: '/assistant', label: 'AI Assistant' },
];

export default function NavBar() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  // New Analysis is a student-only workflow; administrators review candidates instead.
  const navItems = NAV_ITEMS.filter((item) => item.to !== '/analyze' || user?.role === 'student');

  return createPortal(
    <header className="topbar">
      <Link className="brand-lockup" to="/">
        <span className="brand-mark">V</span>
        <span>Vortex</span>
      </Link>
      <nav className="topbar-user" aria-label="Main navigation">
        <div className="nav-pill">
          {navItems.map((item) => (
            <Link key={item.to} to={item.to} aria-current={pathname === item.to ? 'page' : undefined} className={pathname === item.to ? 'active-link' : undefined}>
              {item.label}
            </Link>
          ))}
          {user?.role === 'admin' && (
            <Link to="/admin/jobs" aria-current={pathname === '/admin/jobs' ? 'page' : undefined} className={pathname === '/admin/jobs' ? 'active-link' : undefined}>
              Admin Jobs
            </Link>
          )}
          {user?.role === 'admin' && (
            <Link to="/admin/applications" aria-current={pathname === '/admin/applications' ? 'page' : undefined} className={pathname === '/admin/applications' ? 'active-link' : undefined}>
              Applications
            </Link>
          )}
          {user?.role === 'student' && (
            <Link to="/applications" aria-current={pathname === '/applications' ? 'page' : undefined} className={pathname === '/applications' ? 'active-link' : undefined}>
              My Applications
            </Link>
          )}
        </div>
        <div className="nav-actions">
          <NotificationBell />
          <span className="user-chip" title={user?.name}><i aria-hidden="true">{user?.name?.slice(0, 1).toUpperCase()}</i><span>{user?.name}</span></span>
          <ThemeToggle />
          <button className="link logout-link" onClick={logout}>Log out</button>
        </div>
      </nav>
    </header>, document.body
  );
}
