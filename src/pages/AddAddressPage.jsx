import React, { useState, useEffect } from 'react';
import { createAddress, updateAddress, checkDuplicateAddress } from '../services/apiService';
import { DuplicateModal } from '../components/DuplicateModal';
import { Toast } from '../components/Toast';
import {
  Save,
  Plus,
  ArrowLeft,
  User,
  MapPin,
  Phone,
  FileText,
  Compass,
  CheckSquare,
  Square,
  IndianRupee,
  Calendar,
  Clock,
  Sparkles,
  Building,
  CheckCircle2
} from 'lucide-react';

const DISTRICTS_LIST = [
  'Ariyalur', 'Chengalpattu', 'Chennai', 'Coimbatore', 'Cuddalore', 'Dharmapuri',
  'Dindigul', 'Erode', 'Kallakurichi', 'Kanchipuram', 'Kanyakumari', 'Karur',
  'Krishnagiri', 'Madurai', 'Mayiladuthurai', 'Nagapattinam', 'Namakkal', 'Nilgiris',
  'Perambalur', 'Pudukkottai', 'Ramanathapuram', 'Ranipet', 'Salem', 'Sivaganga',
  'Tenkasi', 'Thanjavur', 'Theni', 'Thoothukudi', 'Tiruchirappalli', 'Tirunelveli',
  'Tirupathur', 'Tiruppur', 'Tiruvallur', 'Tiruvannamalai', 'Tiruvarur', 'Vellore',
  'Viluppuram', 'Virudhunagar'
];

export function AddAddressPage({ initialData = null, onNavigate, onComplete, onStatsChange }) {
  const isEditing = Boolean(initialData && initialData._id);

  const [formData, setFormData] = useState({
    u_id: '',
    name: '',
    door_no: '',
    address_line_1: '',
    address_line_2: '',
    area: '',
    city: '',
    district: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    pincode: '',
    phone: '',
    alt_phone: '',
    landmark: '',
    notes: '',
    subscription: false,
    subscription_date: '31-Aug-2026',
    subscription_time: '10:35 AM',
    subscription_amount: 500
  });

  const [saving, setSaving] = useState(false);
  const [duplicateMatch, setDuplicateMatch] = useState(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const [pendingAddAnother, setPendingAddAnother] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        u_id: initialData.u_id || initialData.code || '',
        name: initialData.name || '',
        door_no: initialData.door_no || '',
        address_line_1: initialData.address_line_1 || '',
        address_line_2: initialData.address_line_2 || '',
        area: initialData.area || '',
        city: initialData.city || '',
        district: initialData.district || 'Chennai',
        state: initialData.state || 'Tamil Nadu',
        country: initialData.country || 'India',
        pincode: initialData.pincode || '',
        phone: initialData.phone || '',
        alt_phone: initialData.alt_phone || '',
        landmark: initialData.landmark || '',
        notes: initialData.notes || '',
        subscription: Boolean(initialData.subscription),
        subscription_date: initialData.subscription_date || '31-Aug-2026',
        subscription_time: initialData.subscription_time || '10:35 AM',
        subscription_amount: initialData.subscription_amount !== undefined ? initialData.subscription_amount : 500
      });
    }
  }, [initialData]);

  const cleanNameInput = (val) => {
    if (!val || typeof val !== 'string') return '';
    return val
      .replace(/(?:Cell|Mobile|Ph|Mob|Tel|Phone)[\s\:\.\-]*\+?\d[\d\s\-]*/gi, '')
      .replace(/(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/g, '')
      .replace(/(?:\+?91[\s-]?)?[6-9]\d{9}/g, '')
      .replace(/\b\d{10}\b/g, '')
      .replace(/\b(Cell|Mobile|Phone|Tel|Mob)\b/gi, '');
  };

  const handleChange = (e) => {
    let { name, value } = e.target;
    if (name === 'name') {
      value = cleanNameInput(value).trimStart();
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNameBlur = () => {
    setFormData(prev => ({
      ...prev,
      name: cleanNameInput(prev.name).trim()
    }));
  };

  const handleFormSubmit = async (e, addAnother = false) => {
    e.preventDefault();
    setSaving(true);
    setPendingAddAnother(addAnother);

    try {
      // If creating new record, run pre-creation duplicate detection
      if (!isEditing) {
        const dupResult = await checkDuplicateAddress(formData);
        if (dupResult.duplicateFound && dupResult.existingAddress) {
          setDuplicateMatch(dupResult.existingAddress);
          setShowDuplicateModal(true);
          setSaving(false);
          return;
        }
      }

      await executeSave(addAnother);
    } catch (err) {
      setToast({ message: err.message || 'Failed to save address', type: 'error' });
      setSaving(false);
    }
  };

  const executeSave = async (addAnother = false) => {
    try {
      if (isEditing) {
        await updateAddress(initialData._id, formData);
        setToast({ message: 'Address record updated successfully!', type: 'success' });
      } else {
        await createAddress(formData);
        setToast({ message: 'New address record created successfully!', type: 'success' });
      }

      if (onStatsChange) onStatsChange();

      if (addAnother) {
        setFormData({
          u_id: '',
          name: '',
          door_no: '',
          address_line_1: '',
          address_line_2: '',
          area: '',
          city: '',
          district: 'Chennai',
          state: 'Tamil Nadu',
          country: 'India',
          pincode: '',
          phone: '',
          alt_phone: '',
          landmark: '',
          notes: '',
          subscription: false,
          subscription_date: '31-Aug-2026',
          subscription_time: '10:35 AM',
          subscription_amount: 500
        });
      } else {
        setTimeout(() => {
          if (onComplete) onComplete();
          else onNavigate('addresses');
        }, 800);
      }
    } catch (err) {
      setToast({ message: err.message || 'Error saving document', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '880px', margin: '0 auto', paddingBottom: '2.5rem' }}>
      {/* Page Header Banner */}
      <div className="add-page-header-banner" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        marginBottom: '1.25rem',
        background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.15) 0%, rgba(14, 165, 233, 0.08) 100%)',
        border: '1px solid rgba(56, 189, 248, 0.2)',
        borderRadius: '1rem',
        padding: '1rem 1.25rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '0.65rem',
            background: 'var(--accent-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 4px 12px rgba(6, 182, 212, 0.3)',
            flexShrink: 0
          }}>
            <Building size={22} />
          </div>
          <div>
            <h2 style={{
              fontSize: '1.25rem',
              fontWeight: 800,
              margin: '0 0 0.15rem 0',
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em'
            }}>
              {isEditing ? 'Edit Address Record' : 'Add New Address Card'}
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
              {isEditing ? 'Update contact, physical address, and subscription settings' : 'Fill in contact details, postal address, and subscription status'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('addresses')}
          className="btn btn-secondary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}
        >
          <ArrowLeft size={15} />
          <span>Back to Directory</span>
        </button>
      </div>

      <form onSubmit={(e) => handleFormSubmit(e, false)} className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

        {/* SECTION 1: Contact & Identifier Information */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '0.85rem',
          border: '1px solid var(--border-color)',
          padding: '1.15rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            <User size={18} style={{ color: '#38bdf8' }} />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              1. Contact & Identity Information
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            {/* U.Id */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span>U.Id (Unique Identifier)</span>
              </label>
              <input
                type="text"
                name="u_id"
                value={formData.u_id}
                onChange={handleChange}
                placeholder="e.g. T-0021"
                className="form-input"
                style={{ fontWeight: 700, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}
              />
            </div>

            {/* Name * */}
            <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                onBlur={handleNameBlur}
                placeholder="e.g. A. Devendran / S. Priya"
                required
                className="form-input"
                style={{ fontWeight: 600 }}
              />
            </div>

            {/* Phone */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Phone size={13} style={{ color: '#10b981' }} />
                <span>Phone Number</span>
              </label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="e.g. 9876543210"
                className="form-input"
                style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}
              />
            </div>

            {/* Alt Phone */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Phone size={13} style={{ color: '#64748b' }} />
                <span>Alternate Phone</span>
              </label>
              <input
                type="text"
                name="alt_phone"
                value={formData.alt_phone}
                onChange={handleChange}
                placeholder="e.g. 9876543211"
                className="form-input"
                style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: Location & Address Details */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '0.85rem',
          border: '1px solid var(--border-color)',
          padding: '1.15rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            <MapPin size={18} style={{ color: '#06b6d4' }} />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              2. Postal Address & Location
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            {/* Door No */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Door No / Flat No</label>
              <input
                type="text"
                name="door_no"
                value={formData.door_no}
                onChange={handleChange}
                placeholder="e.g. 12/4, Flat B-3"
                className="form-input"
              />
            </div>

            {/* Address Line 1 * */}
            <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
              <label className="form-label">Address Line 1 *</label>
              <input
                type="text"
                name="address_line_1"
                value={formData.address_line_1}
                onChange={handleChange}
                placeholder="e.g. Netaji Street / Main Road"
                required
                className="form-input"
              />
            </div>

            {/* Address Line 2 */}
            <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
              <label className="form-label">Address Line 2</label>
              <input
                type="text"
                name="address_line_2"
                value={formData.address_line_2}
                onChange={handleChange}
                placeholder="e.g. Near Bus Stand / Opp Post Office"
                className="form-input"
              />
            </div>

            {/* Area */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Area / Locality</label>
              <input
                type="text"
                name="area"
                value={formData.area}
                onChange={handleChange}
                placeholder="e.g. Anna Nagar / T. Nagar"
                className="form-input"
              />
            </div>

            {/* City */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">City / Town</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="e.g. Chennai"
                className="form-input"
              />
            </div>

            {/* District * */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">District *</label>
              <select
                name="district"
                value={formData.district}
                onChange={handleChange}
                required
                className="form-select"
                style={{ fontWeight: 600 }}
              >
                {DISTRICTS_LIST.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* State * */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">State *</label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                required
                className="form-input"
              />
            </div>

            {/* Country */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Country</label>
              <input
                type="text"
                name="country"
                value={formData.country}
                onChange={handleChange}
                className="form-input"
              />
            </div>

            {/* Pincode * */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Pincode *</label>
              <input
                type="text"
                name="pincode"
                value={formData.pincode}
                onChange={handleChange}
                placeholder="e.g. 600001"
                required
                className="form-input"
                style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: Landmark & Additional Notes */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '0.85rem',
          border: '1px solid var(--border-color)',
          padding: '1.15rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            <Compass size={18} style={{ color: '#f59e0b' }} />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              3. Landmark & Internal Notes
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            {/* Landmark */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Landmark</label>
              <input
                type="text"
                name="landmark"
                value={formData.landmark}
                onChange={handleChange}
                placeholder="e.g. Behind Water Tank"
                className="form-input"
              />
            </div>

            {/* Notes */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Additional Notes</label>
              <input
                type="text"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Internal tags or delivery instructions..."
                className="form-input"
              />
            </div>
          </div>
        </div>

        {/* SECTION 4: Subscription & Payment Status */}
        <div style={{
          backgroundColor: formData.subscription ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-secondary)',
          borderRadius: '0.85rem',
          border: formData.subscription ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-color)',
          padding: '1.15rem',
          transition: 'all 0.25s ease'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <IndianRupee size={18} style={{ color: formData.subscription ? '#10b981' : '#64748b' }} />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: formData.subscription ? '#10b981' : 'var(--text-primary)', margin: 0 }}>
                4. Subscription & Payment Status
              </h3>
            </div>

            <span className={`badge ${formData.subscription ? 'badge-success' : 'badge-secondary'}`} style={{ fontSize: '0.78rem', padding: '0.2rem 0.65rem' }}>
              {formData.subscription ? '☑ Active Subscriber' : '☐ Unsubscribed'}
            </span>
          </div>

          {/* Toggle Checkbox Row */}
          <label style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.75rem',
            cursor: 'pointer',
            padding: '0.65rem 0.9rem',
            borderRadius: '0.6rem',
            border: `1px solid ${formData.subscription ? 'rgba(16, 185, 129, 0.5)' : 'var(--border-color)'}`,
            backgroundColor: formData.subscription ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-card)',
            transition: 'all 0.2s ease',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <input
              type="checkbox"
              name="subscription"
              checked={Boolean(formData.subscription)}
              onChange={(e) => {
                const checked = e.target.checked;
                setFormData(prev => ({
                  ...prev,
                  subscription: checked,
                  subscription_date: checked ? (prev.subscription_date || '31-Aug-2026') : prev.subscription_date,
                  subscription_time: checked ? (prev.subscription_time || '10:35 AM') : prev.subscription_time,
                  subscription_amount: checked ? (prev.subscription_amount || 500) : prev.subscription_amount
                }));
              }}
              style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#10b981' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 700, fontSize: '0.875rem', color: formData.subscription ? '#10b981' : 'var(--text-primary)' }}>
                {formData.subscription ? 'Address is Subscribed' : 'Mark as Subscribed'}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Enable subscription tracking for annual/monthly renewal records
              </span>
            </div>
          </label>

          {/* Expanded Subscription Meta Fields */}
          {formData.subscription && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0.85rem',
              marginTop: '1rem',
              paddingTop: '0.85rem',
              borderTop: '1px dashed rgba(16, 185, 129, 0.3)'
            }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Calendar size={13} style={{ color: '#06b6d4' }} />
                  <span>Subscription Date</span>
                </label>
                <input
                  type="text"
                  name="subscription_date"
                  value={formData.subscription_date || '31-Aug-2026'}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="e.g. 31-Aug-2026"
                  style={{ height: '36px', fontSize: '0.85rem' }}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Clock size={13} style={{ color: '#06b6d4' }} />
                  <span>Subscription Time</span>
                </label>
                <input
                  type="text"
                  name="subscription_time"
                  value={formData.subscription_time || '10:35 AM'}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="e.g. 10:35 AM"
                  style={{ height: '36px', fontSize: '0.85rem' }}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <IndianRupee size={13} style={{ color: '#10b981' }} />
                  <span>Amount Paid (₹)</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: '#10b981' }}>₹</span>
                  <input
                    type="number"
                    name="subscription_amount"
                    value={formData.subscription_amount !== undefined ? formData.subscription_amount : 500}
                    onChange={handleChange}
                    className="form-input"
                    style={{ paddingLeft: '1.8rem', height: '36px', fontSize: '0.85rem', fontWeight: 700 }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons Footer */}
        <div className="modal-actions-row" style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '0.75rem',
          borderTop: '1px solid var(--border-color)',
          paddingTop: '1.25rem'
        }}>
          <button
            type="button"
            onClick={() => onNavigate('addresses')}
            className="btn btn-secondary"
            disabled={saving}
          >
            Cancel
          </button>

          {!isEditing && (
            <button
              type="button"
              onClick={(e) => handleFormSubmit(e, true)}
              className="btn btn-secondary"
              disabled={saving}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Plus size={16} /> Save & Add Another
            </button>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', minWidth: '130px', justifyContent: 'center' }}
          >
            {saving ? (
              <div className="pulse-loader" />
            ) : (
              <>
                <Save size={16} /> {isEditing ? 'Save Changes' : 'Save Address'}
              </>
            )}
          </button>
        </div>
      </form>

      {/* Duplicate Alert Modal */}
      {showDuplicateModal && duplicateMatch && (
        <DuplicateModal
          isOpen={showDuplicateModal}
          existingAddress={duplicateMatch}
          onViewExisting={() => {
            setShowDuplicateModal(false);
            onNavigate('addresses');
          }}
          onContinue={() => {
            setShowDuplicateModal(false);
            executeSave(pendingAddAnother);
          }}
          onCancel={() => setShowDuplicateModal(false)}
        />
      )}

      {/* Toast Notification */}
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: '', type: 'success' })}
      />
    </div>
  );
}

