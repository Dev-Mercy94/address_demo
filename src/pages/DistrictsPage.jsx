import React, { useState, useEffect } from 'react';
import { fetchDistricts } from '../services/apiService';
import { Building2, Search, ArrowRight, MapPin } from 'lucide-react';
import { PageLoader } from '../components/PageLoader';

export function DistrictsPage({ onSelectDistrict }) {
  const [districts, setDistricts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchDistricts();
        setDistricts(data);
      } catch (err) {
        console.error('Failed to load districts:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredDistricts = districts.filter(d =>
    d.district.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <PageLoader
        message="Loading district metrics..."
        subMessage="Aggregating records across all 38 districts"
        icon={Building2}
      />
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', marginBottom: '0.25rem' }}>District Management Directory</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Select any district to immediately view and edit matching address records.
          </p>
        </div>

        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search district name..."
            className="form-input"
            style={{ paddingLeft: '2.25rem', height: '38px' }}
          />
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
        gap: '1.25rem'
      }}>
        {filteredDistricts.map((item, idx) => (
          <div
            key={idx}
            className="card"
            onClick={() => onSelectDistrict(item.district)}
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
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                color: '#818cf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Building2 size={18} />
              </div>
              <span className="badge badge-primary">{item.state || 'Tamil Nadu'}</span>
            </div>

            <div>
              <h3 style={{ fontSize: '1.15rem', marginBottom: '0.2rem' }}>{item.district}</h3>
              <div style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 600 }}>
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
              View Addresses <ArrowRight size={14} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
