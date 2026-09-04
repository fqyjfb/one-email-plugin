import React from 'react';
import type { ToastMessage } from '../types';

interface ToastProps {
  toasts: ToastMessage[];
}

const toastClasses: Record<ToastMessage['type'], string> = {
  success: 'bg-green-600',
  error: 'bg-red-600',
  warning: 'bg-amber-500',
  info: 'bg-blue-600',
};

const Toast: React.FC<ToastProps> = ({ toasts }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-2 rounded-md text-sm text-white shadow-md ${toastClasses[t.type]}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
};

export default Toast;
