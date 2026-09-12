import React from 'react';
import { MapPin, Building2, Hash, Clock, RefreshCw } from 'lucide-react';

export function DashboardCards({ stats }) {
  const cards = [
    {
      title: 'Total Addresses',
      value: stats?.totalAddresses !== undefined && stats?.totalAddresses !== null ? stats.totalAddresses.toLocaleString() : '...',
      label: 'Active Directory Records',
      icon: MapPin,
      color: '#6366f1',
      bgGradient: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.05) 100%)',
      borderColor: 'rgba(99, 102, 241, 0.3)'
    },
    {
      title: 'Total Districts',
      value: stats?.totalDistricts !== undefined && stats?.totalDistricts !== null ? stats.totalDistricts.toLocaleString() : '...',
      label: 'Districts Covered',
      icon: Building2,
      color: '#10b981',
      bgGradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(52, 211, 153, 0.05) 100%)',
      borderColor: 'rgba(16, 185, 129, 0.3)'
    },
    {
      title: 'Total Pincodes',
      value: stats?.totalPincodes !== undefined && stats?.totalPincodes !== null ? stats.totalPincodes.toLocaleString() : '...',
      label: 'Pincodes Indexed',
      icon: Hash,
      color: '#3b82f6',
      bgGradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(96, 165, 250, 0.05) 100%)',
      borderColor: 'rgba(59, 130, 246, 0.3)'
    },
    {
      title: 'Recently Added',
      value: stats?.recentlyAdded !== undefined && stats?.recentlyAdded !== null ? stats.recentlyAdded.toLocaleString() : '...',
      label: 'Added in last 24h',
      icon: Clock,
      color: '#f59e0b',
      bgGradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(251, 191, 36, 0.05) 100%)',
      borderColor: 'rgba(245, 158, 11, 0.3)'
    },
    {
      title: 'Recently Updated',
      value: stats?.recentlyUpdated !== undefined && stats?.recentlyUpdated !== null ? stats.recentlyUpdated.toLocaleString() : '...',
      label: 'Modified in last 24h',
      icon: RefreshCw,
      color: '#ec4899',
      bgGradient: 'linear-gradient(135deg, rgba(236, 72, 153, 0.15) 0%, rgba(244, 114, 182, 0.05) 100%)',
      borderColor: 'rgba(236, 72, 153, 0.3)'
    }
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      gap: '1.25rem',
      marginBottom: '2rem'
    }}>
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <div
            key={index}
            className="card"
            style={{
              background: card.bgGradient,
              borderColor: card.borderColor,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {card.title}
              </span>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '0.5rem',
                backgroundColor: 'rgba(0, 0, 0, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: card.color
              }}>
                <Icon size={20} />
              </div>
            </div>

            <div>
              <div style={{ fontSize: '1.85rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--text-primary)', lineHeight: 1.1 }}>
                {card.value}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                {card.label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
