import React from 'react';
import { Copy, Eye, ArrowRight } from 'lucide-react';

export function DuplicateModal({ isOpen, existingAddress, onViewExisting, onContinue, onCancel }) {
  if (!isOpen || !existingAddress) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            color: '#f59e0b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Copy size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', lineHeight: 1.2 }}>Possible Duplicate Address Found</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              An address with matching name, phone, or location already exists.
            </span>
          </div>
        </div>

        {/* Existing Address Preview Box */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '0.625rem',
          padding: '1rem',
          marginBottom: '1.25rem'
        }}>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1rem' }}>
            {existingAddress.name}
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            {[existingAddress.door_no, existingAddress.address_line_1, existingAddress.area, existingAddress.city].filter(Boolean).join(', ')}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', fontSize: '0.8rem' }}>
            <span className="badge badge-info">{existingAddress.district}</span>
            <span className="badge badge-primary">{existingAddress.pincode}</span>
            <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Phone: {existingAddress.phone || 'N/A'}</span>
          </div>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Would you like to view/edit the existing record or continue creating a new address?
        </p>

        <div className="modal-actions-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '0.75rem' }}>
          <button onClick={onCancel} className="btn btn-secondary">
            Cancel
          </button>
          <button onClick={onViewExisting} className="btn btn-secondary">
            <Eye size={16} /> View Existing
          </button>
          <button onClick={onContinue} className="btn btn-primary">
            Continue Creating <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
