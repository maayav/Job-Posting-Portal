import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { api } from '../api/client';

const POLL_MS = 60000;

function timeAgo(value) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications ?? []);
      setUnreadCount(res.data.unreadCount ?? 0);
    } catch {
      // Notifications are best-effort; never block the navigation on them.
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    function onClickOutside(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  async function markRead(id) {
    setNotifications((current) => current.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((current) => Math.max(0, current - 1));
    try {
      await api.patch(`/notifications/${id}/read`);
    } catch {
      load();
    }
  }

  async function markAllRead() {
    setNotifications((current) => current.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await api.post('/notifications/read-all');
    } catch {
      load();
    }
  }

  return (
    <span className="notification-bell" ref={wrapRef}>
      <button
        type="button"
        className="theme-toggle notification-trigger"
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={open}
        onClick={() => { setOpen((current) => !current); if (!open) load(); }}
      >
        <Icon name="bell" />
        {unreadCount > 0 && <span className="notification-count">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="notification-panel card" role="dialog" aria-label="Notifications">
          <div className="notification-head">
            <strong>Notifications</strong>
            {unreadCount > 0 && <button type="button" className="link" onClick={markAllRead}>Mark all read</button>}
          </div>
          {notifications.length === 0 && <p className="muted small">No notifications yet.</p>}
          <ul className="notification-list">
            {notifications.map((notification) => (
              <li key={notification.id} className={notification.read ? 'is-read' : ''}>
                <button type="button" onClick={() => !notification.read && markRead(notification.id)}>
                  <span className="notification-dot" aria-hidden="true" />
                  <span className="notification-body">
                    <strong>{notification.title}</strong>
                    <span>{notification.message}</span>
                    <small>{timeAgo(notification.createdAt)}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </span>
  );
}