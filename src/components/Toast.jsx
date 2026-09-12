import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export function Toast({ message, type = 'success', onClose, duration = 4000 }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, type, duration, onClose]);

  if (!message) return null;

  const icons = {
    success: <CheckCircle2 size={18} style={{ color: '#10b981' }} />,
    error: <AlertCircle size={18} style={{ color: '#ef4444' }} />,
    warning: <AlertCircle size={18} style={{ color: '#f59e0b' }} />,
    info: <Info size={18} style={{ color: '#3b82f6' }} />
  };

  const borders = {
    success: 'rgba(16, 185, 129, 0.4)',
    error: 'rgba(239, 68, 68, 0.4)',
    warning: 'rgba(245, 158, 11, 0.4)',
    info: 'rgba(59, 130, 246, 0.4)'
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '1.5rem',
      right: '1.5rem',
      zIndex: 2000,
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      backgroundColor: 'var(--bg-card)',
      border: `1px solid ${borders[type] || borders.success}`,
      borderRadius: '0.75rem',
      padding: '0.875rem 1.25rem',
      boxShadow: 'var(--shadow-lg)',
      animation: 'fadeIn 0.2s ease-out',
      maxWidth: '420px'
    }}>
      {icons[type]}
      <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)', flex: 1 }}>
        {message}
      </span>
      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          padding: '0.2rem',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <X size={15} />
      </button>
    </div>
  );
}
