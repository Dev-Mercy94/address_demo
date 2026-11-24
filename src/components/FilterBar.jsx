import React from 'react';
import { FilterX, ArrowUpDown, Building2, Hash, MapPin, Tag, X } from 'lucide-react';
import { SORTED_TAMIL_DISTRICTS } from '../utils/tamilHelper';

export function FilterBar({
  district,
  pincode,
  street,
  group,
  sort,
  onDistrictChange,
  onPincodeChange,
  onStreetChange,
  onGroupChange,
  onSortChange,
  onClearFilters,
  hasActiveFilters,
  langMode = 'TA'
}) {
  return (
    <div className="address-filter-bar">
      {/* Address Group / Category Dropdown */}
      <div className="address-filter-item" style={{ minWidth: '160px' }}>
        <Tag size={16} style={{ color: '#ea580c', flexShrink: 0 }} />
        <select
          value={group || 'ALL'}
          onChange={(e) => onGroupChange && onGroupChange(e.target.value)}
          className="form-select"
          style={{ height: '38px', fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 700, width: '100%' }}
        >
          <option value="ALL">All Groups</option>
          <option value="VIP">⭐ VIP</option>
          <option value="ADVERTISEMENT">📢 ADVERTISEMENT</option>
          <option value="HELP">🤝 HELP</option>
          <option value="CONTRIBUTOR">📋 CONTRIBUTOR</option>
          <option value="CANCEL">🚫 CANCEL</option>
          <option value="CALLBACK">📞 CALLBACK</option>
          <option value="MATRIMONY">💍 MATRIMONY</option>
          <option value="PAYLATER">⏳ PAYLATER</option>
          <option value="NEWS">📰 NEWS</option>
        </select>
      </div>

      {/* Tamil District Dropdown (Sorted in Tamil Alphabetical Order) */}
      <div className="address-filter-item" style={{ minWidth: '190px' }}>
        <Building2 size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <select
          value={district || 'ALL'}
          onChange={(e) => onDistrictChange(e.target.value)}
          className="form-select"
          style={{ height: '38px', fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600, width: '100%' }}
        >
          <option value="ALL">
            {langMode === 'TA' ? `அனைத்து மாவட்டங்கள் (${SORTED_TAMIL_DISTRICTS.length})` : `All Districts (${SORTED_TAMIL_DISTRICTS.length})`}
          </option>
          {SORTED_TAMIL_DISTRICTS.map(d => (
            <option key={d.id} value={d.id} style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}>
              {d.ta} ({d.en})
            </option>
          ))}
        </select>
      </div>

      {/* Street Name Filter */}
      <div className="address-filter-item">
        <MapPin size={16} style={{ color: '#ea580c', flexShrink: 0 }} />
        <div style={{ position: 'relative', width: '100%' }}>
          <input
            type="text"
            value={street || ''}
            onChange={(e) => onStreetChange(e.target.value)}
            placeholder={langMode === 'TA' ? "தெரு / பகுதி வடிக்கட்டி..." : "Filter Street / Area..."}
            className="form-input"
            style={{
              height: '38px',
              fontSize: '0.85rem',
              color: 'var(--text-primary)',
              fontWeight: 600,
              width: '100%',
              paddingRight: street ? '2rem' : '0.75rem',
              boxSizing: 'border-box'
            }}
          />
          {street && (
            <button
              type="button"
              onClick={() => onStreetChange('')}
              style={{
                position: 'absolute',
                right: '0.5rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '50%'
              }}
              title={langMode === 'TA' ? "தெரு வடிக்கட்டியை நீக்கு" : "Clear Street / Area Filter"}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Pincode Filter */}
      <div className="address-filter-item" style={{ flex: '0 1 130px' }}>
        <Hash size={16} style={{ color: '#ea580c', flexShrink: 0 }} />
        <div style={{ position: 'relative', width: '100%' }}>
          <input
            type="text"
            value={pincode || ''}
            onChange={(e) => onPincodeChange(e.target.value)}
            placeholder="Pincode..."
            className="form-input"
            style={{
              height: '38px',
              fontSize: '0.85rem',
              color: 'var(--text-primary)',
              fontWeight: 600,
              width: '100%',
              paddingRight: pincode ? '2rem' : '0.75rem',
              boxSizing: 'border-box'
            }}
          />
          {pincode && (
            <button
              type="button"
              onClick={() => onPincodeChange('')}
              style={{
                position: 'absolute',
                right: '0.5rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '50%'
              }}
              title="Clear Pincode Filter"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Sort Selector with Group and Alphabetical options */}
      <div className="address-filter-item" style={{ minWidth: '190px' }}>
        <ArrowUpDown size={16} style={{ color: '#ea580c', flexShrink: 0 }} />
        <select
          value={sort || 'name_asc'}
          onChange={(e) => onSortChange(e.target.value)}
          className="form-select"
          style={{ height: '38px', fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600, width: '100%' }}
        >
          <option value="name_asc" style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}>
            {langMode === 'TA' ? 'பெயர்: தமிழ் அகரவரிசை (அ → ன)' : 'Name: Tamil Alphabetical (அ → ன / A → Z)'}
          </option>
          <option value="name_desc" style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}>
            {langMode === 'TA' ? 'பெயர்: தலைகீழ் (ன → அ)' : 'Name: Z → A / ன → அ'}
          </option>
          <option value="district_asc" style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}>District: A → Z</option>
          <option value="group_asc" style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}>Group: VIP → CONTRIBUTOR</option>
          <option value="group_desc" style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}>Group: CONTRIBUTOR → VIP</option>
          <option value="pincode_asc" style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}>Pincode: Low → High</option>
          <option value="pincode_desc" style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}>Pincode: High → Low</option>
          <option value="created_desc" style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}>Recently Added</option>
          <option value="updated_desc" style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}>Recently Updated</option>
        </select>
      </div>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <button
          onClick={onClearFilters}
          className="btn btn-secondary btn-sm address-filter-clear-btn"
          style={{ color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)', whiteSpace: 'nowrap' }}
        >
          <FilterX size={15} />
          <span>{langMode === 'TA' ? 'வடிகட்டிகளை நீக்கு' : 'Clear Filters'}</span>
        </button>
      )}
    </div>
  );
}


