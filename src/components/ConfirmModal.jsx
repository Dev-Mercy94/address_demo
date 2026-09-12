import React from 'react';
import { AlertTriangle } from 'lucide-react';

export function ConfirmModal({ isOpen, title, message, confirmText = 'Delete', cancelText = 'Cancel', onConfirm, onCancel, loading }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '0.35rem' }}>{title || 'Confirm Deletion'}</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {message || 'Are you sure you want to delete this address record? This operation cannot be undone.'}
            </p>
          </div>
        </div>

        <div className="modal-actions-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '0.75rem' }}>
          <button onClick={onCancel} className="btn btn-secondary" disabled={loading}>
            {cancelText}
          </button>
          <button onClick={onConfirm} className="btn btn-danger" disabled={loading}>
            {loading ? <div className="pulse-loader" /> : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
