'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import PopupNotification, { type NotificationType } from '@/components/ui/PopupNotification';

type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
};

type NotificationContextValue = {
  notify: (type: NotificationType, title: string, message?: string, duration?: number) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  dismiss: (id: string) => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotification(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used within NotificationProvider');
  return ctx;
}

let counter = 0;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<NotificationItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const notify = useCallback(
    (type: NotificationType, title: string, message?: string, duration = 4000) => {
      const id = `notif-${++counter}`;
      setItems((prev) => [...prev.slice(-4), { id, type, title, message, duration }]);
    },
    [],
  );

  const success = useCallback((title: string, message?: string) => notify('success', title, message), [notify]);
  const error = useCallback((title: string, message?: string) => notify('error', title, message, 6000), [notify]);
  const warning = useCallback((title: string, message?: string) => notify('warning', title, message, 5000), [notify]);
  const info = useCallback((title: string, message?: string) => notify('info', title, message), [notify]);

  return (
    <NotificationContext.Provider value={{ notify, success, error, warning, info, dismiss }}>
      {children}
      <div className="pointer-events-none fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-3">
        {items.map((item) => (
          <PopupNotification
            key={item.id}
            type={item.type}
            title={item.title}
            message={item.message}
            duration={item.duration}
            onDismiss={() => dismiss(item.id)}
          />
        ))}
      </div>
    </NotificationContext.Provider>
  );
}
