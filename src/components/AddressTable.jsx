import React, { useState, memo, useCallback } from 'react';
import { Eye, Edit3, Trash2, Check, X, Phone, MapPin } from 'lucide-react';

const AddressTableRow = memo(function AddressTableRow({
  addr,
  index,
  page,
  limit,
  isSelected,
  onToggleSelect,
  isEditing,
  isSaving,
  onStartInlineEdit,
  onCancelInlineEdit,
  onSaveInline,
  onView,
  onEdit,
  onDelete,
  onSubscriptionToggle
}) {
  const [localFormData, setLocalFormData] = useState({});

  React.useEffect(() => {
    if (isEditing) {
      setLocalFormData({
        name: addr.name || '',
        phone: addr.phone || '',
        pincode: addr.pincode || '',
        district: addr.district || '',
        city: addr.city || '',
        addressGroup: (addr.addressGroup || 'CONTRIBUTOR').toUpperCase()
      });
    }
  }, [isEditing, addr]);

  const onEditChange = (field, val) => {
    let cleanVal = val;
    if (field === 'name' && typeof cleanVal === 'string') {
      cleanVal = cleanVal
        .replace(/(?:Cell|Mobile|Ph|Mob|Tel|Phone)[\s\:\.\-]*\+?\d[\d\s\-]*/gi, '')
        .replace(/(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/g, '')
        .replace(/(?:\+?91[\s-]?)?[6-9]\d{9}/g, '')
        .replace(/\b\d{10}\b/g, '')
        .replace(/\b(Cell|Mobile|Phone|Tel|Mob)\b/gi, '');
    }
    setLocalFormData(prev => ({ ...prev, [field]: cleanVal }));
  };

  const serialNo = (page - 1) * limit + index + 1;

  const fullAddressText = [
    addr.door_no,
    addr.address_line_1,
    addr.address_line_2
  ].filter(Boolean).join(', ');

  const currentGroup = (addr.addressGroup || 'CONTRIBUTOR').toUpperCase();
  const baseGroupClass = currentGroup === 'VIP'
    ? 'row-group-vip'
    : (currentGroup === 'ADVERTISEMENT'
      ? 'row-group-advertisement'
      : (currentGroup === 'HELP'
        ? 'row-group-help'
        : 'row-group-contributor'));

  const rowGroupClass = `${baseGroupClass} ${isSelected ? 'row-selected' : ''}`;

  return (
    <tr className={rowGroupClass}>
      {/* Selection Checkbox */}
      <td style={{ textAlign: 'center', width: '42px' }}>
        <input
          type="checkbox"
          checked={Boolean(isSelected)}
          onChange={() => onToggleSelect && onToggleSelect(addr._id)}
          aria-label={`Select address ${addr.name || addr.u_id}`}
          style={{
            width: '18px',
            height: '18px',
            cursor: 'pointer',
            accentColor: '#2563eb'
          }}
        />
      </td>

      {/* S.No */}
      <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>
        {serialNo}
      </td>

      {/* U.Id */}
      <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
        <span style={{
          fontSize: '0.82rem',
          padding: '4px 8px',
          borderRadius: '4px',
          backgroundColor: 'rgba(245, 158, 11, 0.12)',
          color: 'var(--warning)',
          fontFamily: 'var(--font-sans)',
          fontVariantNumeric: 'tabular-nums',
          fontFeatureSettings: '"zero" 0',
          fontWeight: 700,
          whiteSpace: 'nowrap',
          display: 'inline-block',
          letterSpacing: '0.5px'
        }}>
          {addr.u_id || '-'}
        </span>
      </td>

      {/* Name */}
      <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
        {isEditing ? (
          <input
            type="text"
            value={localFormData.name || ''}
            onChange={(e) => onEditChange('name', e.target.value)}
            className="form-input"
            style={{ padding: '0.25rem 0.5rem', height: '32px' }}
          />
        ) : (
          <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>{addr.name}</span>
        )}
      </td>

      {/* Address */}
      <td style={{ maxWidth: '260px', color: 'var(--text-primary)', fontWeight: 500 }}>
        <span title={fullAddressText} style={{ color: 'var(--text-primary)' }}>
          {fullAddressText.length > 55 ? `${fullAddressText.substring(0, 55)}...` : fullAddressText}
        </span>
      </td>

      {/* Area */}
      <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{addr.area || '-'}</td>

      {/* City */}
      <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
        {isEditing ? (
          <input
            type="text"
            value={localFormData.city || ''}
            onChange={(e) => onEditChange('city', e.target.value)}
            className="form-input"
            style={{ padding: '0.25rem 0.5rem', height: '32px' }}
          />
        ) : (
          <span style={{ color: 'var(--text-primary)' }}>{addr.city || '-'}</span>
        )}
      </td>

      {/* District */}
      <td>
        {isEditing ? (
          <input
            type="text"
            value={localFormData.district || ''}
            onChange={(e) => onEditChange('district', e.target.value)}
            className="form-input"
            style={{ padding: '0.25rem 0.5rem', height: '32px' }}
          />
        ) : (
          <span className="badge badge-warning" style={{ fontWeight: 700 }}>
            {addr.district}
          </span>
        )}
      </td>

      {/* Pincode */}
      <td>
        {isEditing ? (
          <input
            type="text"
            value={localFormData.pincode || ''}
            onChange={(e) => onEditChange('pincode', e.target.value)}
            className="form-input"
            style={{ padding: '0.25rem 0.5rem', height: '32px', width: '90px' }}
          />
        ) : (
          <span className="badge badge-warning" style={{ fontWeight: 700 }}>{addr.pincode}</span>
        )}
      </td>

      {/* Phone */}
      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>
        {isEditing ? (
          <input
            type="text"
            value={localFormData.phone || ''}
            onChange={(e) => onEditChange('phone', e.target.value)}
            className="form-input"
            style={{ padding: '0.25rem 0.5rem', height: '32px', width: '120px' }}
          />
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-primary)' }}>
            <Phone size={13} style={{ color: 'var(--warning)' }} />
            {addr.phone || '-'}
          </span>
        )}
      </td>

      {/* Address Group / Category */}
      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
        {isEditing ? (
          <select
            value={localFormData.addressGroup || 'CONTRIBUTOR'}
            onChange={(e) => onEditChange('addressGroup', e.target.value)}
            className="form-select"
            style={{ padding: '0.2rem 0.4rem', height: '32px', fontSize: '0.8rem', fontWeight: 700 }}
          >
            <option value="VIP">VIP</option>
            <option value="ADVERTISEMENT">ADVERTISEMENT</option>
            <option value="HELP">HELP</option>
            <option value="CONTRIBUTOR">CONTRIBUTOR</option>
            <option value="CANCEL">CANCEL</option>
            <option value="CALLBACK">CALLBACK</option>
            <option value="MATRIMONY">MATRIMONY</option>
          </select>
        ) : (
          <span className={`badge-group badge-group-${currentGroup.toLowerCase()}`}>
            {currentGroup}
          </span>
        )}
      </td>

      {/* Subscription (Checkbox Only) */}
      <td style={{ textAlign: 'center' }}>
        <input
          type="checkbox"
          checked={Boolean(addr.subscription)}
          onChange={(e) => onSubscriptionToggle(addr, e.target.checked)}
          title={addr.subscription ? "Subscribed" : "Unsubscribed"}
          style={{
            width: '20px',
            height: '20px',
            cursor: 'pointer',
            accentColor: '#10b981'
          }}
        />
      </td>

      {/* Actions */}
      <td style={{ textAlign: 'center' }}>
        {isEditing ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
            <button
              onClick={() => onSaveInline(addr._id, localFormData)}
              disabled={isSaving}
              className="btn btn-sm"
              style={{ backgroundColor: 'var(--success)', color: '#ffffff', padding: '0.25rem 0.5rem' }}
              title="Save Inline Edit"
            >
              <Check size={15} />
            </button>
            <button
              onClick={onCancelInlineEdit}
              className="btn btn-secondary btn-sm"
              style={{ padding: '0.25rem 0.5rem' }}
              title="Cancel Inline Edit"
            >
              <X size={15} />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
            <button
              onClick={() => onView(addr)}
              className="btn btn-secondary btn-sm"
              style={{ padding: '0.3rem 0.45rem' }}
              title="View Details"
            >
              <Eye size={15} />
            </button>
            <button
              onClick={() => onEdit(addr)}
              className="btn btn-secondary btn-sm"
              style={{ padding: '0.3rem 0.45rem' }}
              title="Full Edit Form"
            >
              <Edit3 size={15} />
            </button>
            <button
              onClick={() => onStartInlineEdit(addr)}
              className="btn btn-secondary btn-sm"
              style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem', fontWeight: 600 }}
              title="Quick Inline Edit"
            >
              Quick
            </button>
            <button
              onClick={() => onDelete(addr)}
              className="btn btn-sm"
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '0.3rem 0.45rem' }}
              title="Delete Address"
            >
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
});

export function AddressTable({
  addresses,
  page,
  limit,
  loading,
  selectedIds = [],
  onToggleSelect,
  onToggleSelectAll,
  onView,
  onEdit,
  onDelete,
  onInlineSave
}) {
  const [editingId, setEditingId] = useState(null);
  const [savingInlineId, setSavingInlineId] = useState(null);

  const selectedSet = React.useMemo(() => new Set(selectedIds || []), [selectedIds]);
  const isAllSelected = Boolean(
    addresses &&
    addresses.length > 0 &&
    addresses.every(a => selectedSet.has(a._id))
  );
  const isSomeSelected = Boolean(
    addresses &&
    addresses.length > 0 &&
    addresses.some(a => selectedSet.has(a._id)) &&
    !isAllSelected
  );

  const startInlineEdit = useCallback((address) => {
    setEditingId(address._id);
  }, []);

  const cancelInlineEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const handleSaveInline = useCallback(async (id, formData) => {
    setSavingInlineId(id);
    try {
      await onInlineSave(id, formData);
      setEditingId(null);
    } catch (error) {
      console.error('Inline save failed:', error);
    } finally {
      setSavingInlineId(null);
    }
  }, [onInlineSave]);

  const handleSubscriptionToggle = useCallback(async (addr, checked) => {
    if (onInlineSave) {
      const now = new Date();
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dateStr = `${String(now.getDate()).padStart(2, '0')}-${months[now.getMonth()]}-${now.getFullYear()}`;
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const timeStr = `${hours}:${minutes} ${ampm}`;

      await onInlineSave(addr._id, {
        subscription: checked,
        subscription_date: checked ? (addr.subscription_date || dateStr) : addr.subscription_date,
        subscription_time: checked ? (addr.subscription_time || timeStr) : addr.subscription_time,
        subscription_amount: checked ? (addr.subscription_amount || 500) : addr.subscription_amount
      });
    }
  }, [onInlineSave]);

  if (loading && (!addresses || addresses.length === 0)) {
    return (
      <div className="table-wrapper" style={{ position: 'relative', overflowX: 'auto', overflowY: 'hidden' }}>
        <div className="table-top-progress-bar" />
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '42px', textAlign: 'center' }}>
                <input type="checkbox" disabled style={{ width: '18px', height: '18px' }} />
              </th>
              <th style={{ width: '60px', textAlign: 'center' }}>S.No</th>
              <th style={{ width: '85px' }}>U.Id</th>
              <th>Name</th>
              <th>Address</th>
              <th>Area</th>
              <th>City</th>
              <th>District</th>
              <th>Pincode</th>
              <th>Phone</th>
              <th style={{ width: '110px', textAlign: 'center' }}>Group</th>
              <th style={{ textAlign: 'center' }}>Subscription</th>
              <th style={{ width: '130px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map((i) => (
              <tr key={i} style={{ opacity: 0.6 }}>
                <td style={{ textAlign: 'center' }}><div className="skeleton-line" style={{ width: '18px', margin: '0 auto' }} /></td>
                <td style={{ textAlign: 'center' }}><div className="skeleton-line" style={{ width: '24px', margin: '0 auto' }} /></td>
                <td><div className="skeleton-line" style={{ width: '50px' }} /></td>
                <td><div className="skeleton-line" style={{ width: '120px' }} /></td>
                <td><div className="skeleton-line" style={{ width: '180px' }} /></td>
                <td><div className="skeleton-line" style={{ width: '80px' }} /></td>
                <td><div className="skeleton-line" style={{ width: '70px' }} /></td>
                <td><div className="skeleton-line" style={{ width: '80px' }} /></td>
                <td><div className="skeleton-line" style={{ width: '60px' }} /></td>
                <td><div className="skeleton-line" style={{ width: '90px' }} /></td>
                <td style={{ textAlign: 'center' }}><div className="skeleton-line" style={{ width: '60px', margin: '0 auto' }} /></td>
                <td style={{ textAlign: 'center' }}><div className="skeleton-line" style={{ width: '20px', margin: '0 auto' }} /></td>
                <td><div className="skeleton-line" style={{ width: '80px', margin: '0 auto' }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!addresses || addresses.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3.5rem 2rem' }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          color: '#818cf8',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1rem'
        }}>
          <MapPin size={28} />
        </div>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>No Addresses Found</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto' }}>
          No records match your active search terms or filters. Try adjusting your query or clearing filters.
        </p>
      </div>
    );
  }

  return (
    <div className="table-wrapper" style={{ position: 'relative', overflowX: 'auto' }}>
      {loading && <div className="table-top-progress-bar" />}
      <table className="data-table">
        <thead>
          <tr>
            <th style={{ width: '42px', textAlign: 'center', whiteSpace: 'nowrap' }}>
              <input
                type="checkbox"
                checked={isAllSelected}
                ref={el => { if (el) el.indeterminate = isSomeSelected; }}
                onChange={onToggleSelectAll}
                title={isAllSelected ? "Deselect all on this page" : "Select all on this page"}
                aria-label="Select all addresses on this page"
                style={{
                  width: '18px',
                  height: '18px',
                  cursor: 'pointer',
                  accentColor: '#2563eb'
                }}
              />
            </th>
            <th style={{ width: '60px', textAlign: 'center', whiteSpace: 'nowrap' }}>S.No</th>
            <th style={{ width: '95px', minWidth: '90px', whiteSpace: 'nowrap' }}>U.ID</th>
            <th>Name</th>
            <th>Address</th>
            <th>Area</th>
            <th>City</th>
            <th>District</th>
            <th>Pincode</th>
            <th>Phone</th>
            <th style={{ width: '120px', textAlign: 'center', whiteSpace: 'nowrap' }}>Group</th>
            <th style={{ textAlign: 'center' }}>Subscription</th>
            <th style={{ width: '130px', textAlign: 'center' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {addresses.map((addr, index) => (
            <AddressTableRow
              key={addr._id || index}
              addr={addr}
              index={index}
              page={page}
              limit={limit}
              isSelected={selectedSet.has(addr._id)}
              onToggleSelect={onToggleSelect}
              isEditing={editingId === addr._id}
              isSaving={savingInlineId === addr._id}
              onStartInlineEdit={startInlineEdit}
              onCancelInlineEdit={cancelInlineEdit}
              onSaveInline={handleSaveInline}
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
              onSubscriptionToggle={handleSubscriptionToggle}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

