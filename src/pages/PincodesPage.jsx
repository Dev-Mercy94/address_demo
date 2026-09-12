import React, { useState, useEffect } from 'react';
import { fetchPincodes } from '../services/apiService';
import { Hash, Search, ArrowRight, MapPin } from 'lucide-react';
import { PageLoader } from '../components/PageLoader';

export function PincodesPage({ onSelectPincode }) {
  const [pincodes, setPincodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchPincodes();
        setPincodes(data);
      } catch (err) {
        console.error('Failed to load pincodes:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredPincodes = pincodes.filter(p =>
    p.pincode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.district && p.district.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <PageLoader 
        message="Loading pincodes directory..." 
        subMessage="Fetching postal code records and district associations" 
        icon={Hash}
      />
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', marginBottom: '0.25rem' }}>Pincode Lookup Directory</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Search or filter addresses by specific Postal Index Numbers (PIN codes).
          </p>
        </div>

        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search pincode or district..."
            className="form-input"
            style={{ paddingLeft: '2.25rem', height: '38px' }}
          />
        </div>
      </div>

      <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '1.25rem'
        }}>
          {filteredPincodes.map((item, idx) => (
            <div
              key={idx}
              className="card"
              onClick={() => onSelectPincode(item.pincode)}
              style={{
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-primary)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--glass-border)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '0.5rem',
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  color: '#60a5fa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Hash size={18} />
                </div>
                <span className="badge badge-info">{item.district || 'Unspecified'}</span>
              </div>

              <div>
                <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-mono)', marginBottom: '0.2rem' }}>
                  {item.pincode}
                </h3>
                <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                  {item.city || item.district}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#818cf8', fontWeight: 600, marginTop: '0.35rem' }}>
                  {item.count.toLocaleString()} Addresses
                </div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                marginTop: '1rem',
                fontSize: '0.8rem',
                color: '#818cf8',
                fontWeight: 600,
                gap: '0.25rem'
              }}>
                Filter Addresses <ArrowRight size={14} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
