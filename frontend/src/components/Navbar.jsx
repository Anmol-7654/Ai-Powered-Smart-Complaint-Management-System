import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationError, setNotificationError] = useState('');

  useEffect(() => {
    if (!user) return undefined;

    let active = true;
    const loadNotifications = async () => {
      try {
        const { data } = await api.get('/notifications');
        if (active) {
          setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
          setUnreadCount(data.unreadCount || 0);
          setNotificationError('');
        }
      } catch (error) {
        if (active) {
          console.error('Failed to load notifications', error);
          setNotificationError('Notifications could not be loaded.');
        }
      }
    };

    loadNotifications();
    const intervalId = window.setInterval(loadNotifications, 45000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [user]);

  const handleLogout = () => {
    setNotifications([]);
    setUnreadCount(0);
    setNotificationsOpen(false);
    logout();
    navigate('/login');
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.readAt) {
      try {
        await api.patch(`/notifications/${notification._id}/read`);
        setNotifications((current) =>
          current.map((item) =>
            item._id === notification._id ? { ...item, readAt: new Date().toISOString() } : item
          )
        );
        setUnreadCount((count) => Math.max(0, count - 1));
      } catch (error) {
        console.error('Failed to mark notification as read', error);
        setNotificationError('Could not mark this notification as read.');
      }
    }

    setNotificationsOpen(false);
    navigate(notification.complaint?._id
      ? `/complaints/${notification.complaint._id}`
      : '/complaints');
  };

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          readAt: notification.readAt || new Date().toISOString(),
        }))
      );
      setUnreadCount(0);
      setNotificationError('');
    } catch (error) {
      console.error('Failed to mark all notifications as read', error);
      setNotificationError('Could not update notifications.');
    }
  };

  return (
    <header className="navbar">
      <Link to={user ? '/dashboard' : '/login'} className="navbar-brand">
        <span className="navbar-mark">CM</span>
        <span className="navbar-brand-copy">
          <strong>Resolve</strong>
          <small>Complaint management</small>
        </span>
      </Link>

      {user ? (
        <nav className="navbar-links">
          <NavLink to="/dashboard">Overview</NavLink>
          <NavLink to="/complaints">Complaints</NavLink>
          <NavLink to="/chat">Support chat</NavLink>
          <div className="notification-menu">
            <button
              type="button"
              className="notification-button"
              aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
              aria-expanded={notificationsOpen}
              onClick={() => setNotificationsOpen((open) => !open)}
            >
              <span aria-hidden="true">Notifications</span>
              {unreadCount > 0 ? (
                <span className="notification-count">{unreadCount > 99 ? '99+' : unreadCount}</span>
              ) : null}
            </button>
            {notificationsOpen ? (
              <section className="notification-popover" aria-label="Notifications">
                <div className="notification-heading">
                  <strong>Notifications</strong>
                  {unreadCount > 0 ? (
                    <button type="button" onClick={handleMarkAllRead}>Mark all read</button>
                  ) : null}
                </div>
                {notificationError ? <p className="notification-error" role="alert">{notificationError}</p> : null}
                {notifications.length ? (
                  <ul className="notification-list">
                    {notifications.map((notification) => (
                      <li key={notification._id}>
                        <button
                          type="button"
                          className={`notification-item${notification.readAt ? '' : ' notification-item--unread'}`}
                          onClick={() => handleNotificationClick(notification)}
                        >
                          <strong>{notification.title}</strong>
                          <span>{notification.message}</span>
                          <small>{new Date(notification.createdAt).toLocaleString()}</small>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="notification-empty">You're all caught up.</p>
                )}
              </section>
            ) : null}
          </div>
          <Link to="/complaints/new" className="btn btn--primary navbar-new-ticket">
            <span aria-hidden="true">+</span> New complaint
          </Link>
          <span className="navbar-user" title={user.name}>
            <span className="navbar-avatar" aria-hidden="true">
              {user.name?.trim()?.charAt(0)?.toUpperCase() || 'U'}
            </span>
            <span className="navbar-user-copy">
              <strong>{user.name?.split(' ')[0] || 'Account'}</strong>
              <small>{user.role === 'admin' ? 'Administrator' : 'Customer'}</small>
            </span>
          </span>
          <button type="button" className="btn btn--ghost" onClick={handleLogout}>
            Sign out
          </button>
        </nav>
      ) : (
        <nav className="navbar-links">
          <NavLink to="/login">Sign in</NavLink>
          <Link to="/register" className="btn btn--primary">Create account</Link>
        </nav>
      )}
    </header>
  );
};

export default Navbar;