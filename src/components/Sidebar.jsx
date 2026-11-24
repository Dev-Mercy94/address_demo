import React from 'react';
import {
  LayoutDashboard,
  MapPin,
  PlusCircle,
  CheckSquare,
  Upload,
  Download,
  Building2,
  Hash,
  Settings,
  X,
  LogOut,
  CalendarHeart
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Sidebar({ activePage, setActivePage, stats, isMobileMenuOpen, onCloseMobileMenu }) {
  const { user, logout } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'addresses', label: 'Addresses', icon: MapPin },
    { id: 'add', label: 'Add Address', icon: PlusCircle },
    { id: 'dates', label: 'Important Dates', icon: CalendarHeart },
    { id: 'subscription', label: 'Subscription', icon: CheckSquare },
    { id: 'import', label: 'Import CSV', icon: Upload },
    { id: 'export', label: 'Export PDF', icon: Download },
    { id: 'districts', label: 'Districts', icon: Building2 },
    { id: 'pincodes', label: 'Pincodes', icon: Hash },
    { id: 'settings', label: 'System Overview', icon: Settings }
  ];

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      logout();
    }
  };

  return (
    <aside
      className={`sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`}
      style={{
        width: '210px',
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
        flexShrink: 0,
        zIndex: 90
      }}
    >
      {/* Brand Header */}
      <div style={{
        padding: '1.15rem 1rem',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.6rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '0.625rem',
            background: 'var(--accent-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 4px 12px rgba(234, 88, 12, 0.4)'
          }}>
            <MapPin size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.2rem', lineHeight: 1.1 }}>AddressHub</h2>
          </div>
        </div>

        {/* Mobile Close Button */}
        {onCloseMobileMenu && (
          <button
            onClick={onCloseMobileMenu}
            className="btn btn-secondary btn-icon mobile-close-btn"
            title="Close Menu"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav style={{ padding: '1rem 0.75rem', flex: 1 }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 0.75rem 0.5rem' }}>
          Navigation
        </div>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => {
                    setActivePage(item.id);
                    if (onCloseMobileMenu) onCloseMobileMenu();
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.875rem',
                    borderRadius: '0.5rem',
                    border: 'none',
                    backgroundColor: isActive ? 'rgba(234, 88, 12, 0.15)' : 'transparent',
                    color: isActive ? '#f97316' : 'var(--text-secondary)',
                    fontWeight: isActive ? 600 : 500,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Icon size={18} style={{ color: isActive ? '#f97316' : 'var(--text-muted)' }} />
                    <span>{item.label}</span>
                  </div>
                  {item.count !== undefined && item.count !== null && (
                    <span className="badge badge-primary">
                      {typeof item.count === 'number' ? item.count.toLocaleString() : item.count}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer System Status & Logout */}
      <div style={{
        padding: '0.85rem 1rem',
        borderTop: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-secondary)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'var(--success)' }}></span>
            <span>Active: {user?.username || 'admin'}</span>
          </div>
          <button
            onClick={handleLogout}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--danger)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '2px 4px',
              borderRadius: '4px'
            }}
            title="Sign Out"
          >
            <LogOut size={13} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
