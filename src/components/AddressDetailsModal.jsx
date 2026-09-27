import React from 'react';
import { X, Edit3, Trash2, MapPin, Phone, Clock, Compass, FileText, Download } from 'lucide-react';
import { exportAddressesToPdf } from '../utils/pdfExportHelper';

export function AddressDetailsModal({ address, onClose, onEdit, onDelete }) {
  if (!address) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '620px' }}>
        {/* Modal Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '1rem',
          marginBottom: '1.25rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '0.625rem',
              background: 'var(--accent-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}>
              <MapPin size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.3rem', lineHeight: 1.2 }}>{address.name}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.3rem', flexWrap: 'wrap' }}>
                {address.u_id && (
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(79, 70, 229, 0.1)', color: '#4f46e5', fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"zero" 0' }}>
                    U.Id: {address.u_id}
                  </span>
                )}
                <span className={`badge-group badge-group-${(address.addressGroup || 'CONTRIBUTOR').toLowerCase()}`}>
                  {address.addressGroup || 'CONTRIBUTOR'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-secondary btn-icon"
            style={{ borderRadius: '50%', padding: '0.4rem' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content Details Grid */}
        <div className="address-details-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.15rem', marginBottom: '1.5rem' }}>
          <div>
            <div className="form-label">Address Group / Category</div>
            <div style={{ marginTop: '0.2rem' }}>
              <span className={`badge-group badge-group-${(address.addressGroup || 'CONTRIBUTOR').toLowerCase()}`}>
                {address.addressGroup || 'CONTRIBUTOR'}
              </span>
            </div>
          </div>

          <div>
            <div className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <MapPin size={14} /> Door No / Address Line 1
            </div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.2rem', wordBreak: 'break-word' }}>
              {address.door_no ? `${address.door_no}, ` : ''}{address.address_line_1}
            </div>
          </div>

          <div>
            <div className="form-label">Address Line 2</div>
            <div style={{ color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              {address.address_line_2 || '-'}
            </div>
          </div>

          <div>
            <div className="form-label">Area</div>
            <div style={{ color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              {address.area || '-'}
            </div>
          </div>

          <div>
            <div className="form-label">City</div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
              {address.city || '-'}
            </div>
          </div>

          <div>
            <div className="form-label">District</div>
            <div style={{ marginTop: '0.2rem' }}>
              <span className="badge badge-info">{address.district}</span>
            </div>
          </div>

          <div>
            <div className="form-label">State / Country</div>
            <div style={{ color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              {address.state || 'Tamil Nadu'}, {address.country || 'India'}
            </div>
          </div>

          <div>
            <div className="form-label">Pincode</div>
            <div style={{ marginTop: '0.2rem' }}>
              <span className="badge badge-primary" style={{ fontSize: '0.85rem' }}>{address.pincode}</span>
            </div>
          </div>

          <div>
            <div className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Phone size={14} /> Phone Number
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
              {address.phone || '-'}
            </div>
          </div>

          <div>
            <div className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Phone size={14} /> Alternative Number
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
              {address.alt_phone || address.alternative_phone || address.secondary_phone || '-'}
            </div>
          </div>

          <div>
            <div className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Compass size={14} /> Landmark
            </div>
            <div style={{ color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              {(address.landmark && !address.landmark.includes('Imported from') && !address.landmark.includes('Uploaded from') && !address.landmark.includes('WordPad') && !address.landmark.includes('Tamil Box Label')) ? address.landmark : '-'}
            </div>
          </div>
        </div>

        {/* Subscription Status Details Card */}
        <div style={{
          backgroundColor: address.subscription ? 'rgba(16, 185, 129, 0.06)' : 'var(--bg-secondary)',
          border: `1px solid ${address.subscription ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-color)'}`,
          borderRadius: '0.75rem',
          padding: '1rem 1.25rem',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Subscription Status
            </div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: address.subscription ? '#059669' : '#ef4444', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>{address.subscription ? '☑ Subscribed' : '☐ Unsubscribed'}</span>
            </div>
          </div>

          {address.subscription && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Date: </span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{address.subscription_date || '31-Aug-2026'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Time: </span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{address.subscription_time || '10:35 AM'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Amount: </span>
                <span style={{ fontWeight: 700, color: '#10b981' }}>₹{address.subscription_amount || 500}</span>
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        {address.notes && (
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '0.625rem',
            padding: '0.875rem',
            marginBottom: '1.5rem'
          }}>
            <div className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem' }}>
              <FileText size={14} /> Notes
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{address.notes}</p>
          </div>
        )}

        {/* Timestamps */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          borderTop: '1px solid var(--border-color)',
          paddingTop: '0.875rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Clock size={13} /> Created: {new Date(address.created_at || Date.now()).toLocaleString()}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            Updated: {new Date(address.updated_at || Date.now()).toLocaleString()}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="modal-actions-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '0.65rem' }}>
          <button
            onClick={() => exportAddressesToPdf([address], address.district || 'Single Address')}
            className="btn btn-secondary"
            title="Download Address PDF"
          >
            <Download size={16} /> PDF Export
          </button>
          <button onClick={() => { onClose(); onEdit(address); }} className="btn btn-secondary">
            <Edit3 size={16} /> Edit
          </button>
          <button onClick={() => { onClose(); onDelete(address); }} className="btn btn-danger">
            <Trash2 size={16} /> Delete
          </button>
          <button onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
