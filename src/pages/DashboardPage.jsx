import React, { useState, useEffect } from 'react';
import { DashboardCards } from '../components/DashboardCards';
import { fetchStats } from '../services/apiService';
import { Building2, Search, PlusCircle, Upload, ArrowRight, CalendarHeart, CheckSquare } from 'lucide-react';

export function DashboardPage({ onNavigate, onSearchSelect }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quickSearch, setQuickSearch] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchStats();
        setStats(data);
      } catch (err) {
        console.error('Failed to load dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleQuickSearchSubmit = (e) => {
    e.preventDefault();
    if (quickSearch.trim()) {
      onSearchSelect(quickSearch.trim());
      onNavigate('addresses');
    }
  };

  return (
    <div>
      {/* Top Welcome Banner */}
      <div className="card dashboard-welcome-card" style={{
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.1) 100%)',
        borderColor: 'rgba(99, 102, 241, 0.3)',
        marginBottom: '1.75rem',
        padding: '2rem'
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
          <div>
            <h2 className="dashboard-hero-title" style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>
              Address Management System
            </h2>
            <p className="dashboard-hero-desc" style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '650px' }}>
              Enterprise serverless data manager optimized for querying address records with instant indexing, compound filtering, and CSV batch processing.
            </p>
          </div>

          <div className="dashboard-hero-actions" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button onClick={() => onNavigate('add')} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <PlusCircle size={17} /> Add New Address
            </button>
            <button onClick={() => onNavigate('dates')} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <CalendarHeart size={17} style={{ color: '#ec4899' }} /> Important Dates
            </button>
            <button onClick={() => onNavigate('subscription')} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <CheckSquare size={17} style={{ color: '#2563eb' }} /> Subscriptions
            </button>
            <button onClick={() => onNavigate('import')} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <Upload size={17} /> Import CSV
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Dashboard Cards */}
      <DashboardCards stats={stats} />

      {/* Quick Search Section */}
      <div style={{ marginBottom: '2rem' }}>
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Search size={18} style={{ color: 'var(--accent-primary)' }} />
            Quick Record Search
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            Search across addresses by name, pincode, district, city, or phone number.
          </p>

          <form onSubmit={handleQuickSearchSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              placeholder="e.g. 600001 or Chennai or John..."
              className="form-input"
            />
            <button type="submit" className="btn btn-primary">
              Search
            </button>
          </form>
        </div>
      </div>

      {/* Top Districts Breakdown */}
      {stats?.topDistricts && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Building2 size={19} style={{ color: 'var(--accent-primary)' }} />
              Top District Address Distribution
            </h3>
            <button onClick={() => onNavigate('districts')} className="btn btn-secondary btn-sm">
              View All Districts <ArrowRight size={14} />
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem'
          }}>
            {stats.topDistricts.map((d, i) => (
              <div
                key={i}
                onClick={() => {
                  onSearchSelect(d.district, 'district');
                  onNavigate('addresses');
                }}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.625rem',
                  padding: '1rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>District</div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>{d.district}</div>
                <div style={{ fontSize: '0.85rem', color: '#818cf8', fontWeight: 600, marginTop: '0.35rem' }}>
                  {d.count.toLocaleString()} addresses
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
