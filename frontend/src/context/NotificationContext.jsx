import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

const NotificationContext = createContext(null);

const STORAGE_KEY = 'halleyx_notifications';
const MAX_NOTIFICATIONS = 50;

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveToStorage(notifications) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)));
  } catch { /* ignore storage errors */ }
}

export const NotificationProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [bellNotifications, setBellNotifications] = useState(() => loadFromStorage());
  const shownRef = useRef(new Set());

  // Persist to localStorage on every change
  useEffect(() => {
    saveToStorage(bellNotifications);
  }, [bellNotifications]);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Legacy: addToast for notification step toasts (delivery notifications)
  const addToast = useCallback((notification) => {
    const id = Date.now() + Math.random();
    const toast = { ...notification, id };
    setToasts(prev => [...prev, toast]);

    setBellNotifications(prev => [
      {
        ...toast, read: false,
        type: 'info',
        title: notification.step_name || 'Notification sent',
        message: notification.template ? `📧 ${notification.to}: "${notification.template}"` : `Notification sent to ${notification.to}`,
        time: notification.sent_at || new Date().toISOString()
      },
      ...prev
    ].slice(0, MAX_NOTIFICATIONS));

    setTimeout(() => removeToast(id), 4000);
    return id;
  }, [removeToast]);

  /**
   * Add a typed notification to the bell.
   * @param {'info'|'success'|'warning'|'error'} type
   * @param {string} title
   * @param {string} message
   * @param {Object} [meta] - optional { execution_id, workflow_name, step_name }
   */
  const addNotification = useCallback((type, title, message, meta = {}) => {
    const id = Date.now() + Math.random();
    const notif = {
      id, type, title, message,
      read: false,
      time: new Date().toISOString(),
      execution_id: meta.execution_id || null,
      workflow_name: meta.workflow_name || null,
      step_name: meta.step_name || null,
    };

    setBellNotifications(prev => [notif, ...prev].slice(0, MAX_NOTIFICATIONS));
    return id;
  }, []);

  const markAllRead = useCallback(() => {
    setBellNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setBellNotifications([]);
  }, []);

  const getShownRef = useCallback(() => shownRef, []);

  return (
    <NotificationContext.Provider value={{
      toasts, bellNotifications,
      addToast, addNotification, removeToast,
      markAllRead, clearAll, getShownRef
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
