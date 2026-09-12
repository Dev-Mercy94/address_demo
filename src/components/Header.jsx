import React from 'react';
import { PlusCircle, Sun, Moon, ArrowLeft, Menu, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Header({ activePage, setActivePage, theme, toggleTheme, totalCount, onGoBack, onToggleMobileMenu }) {
  const { user } = useAuth();

  const pageTitles = {
    dashboard: 'Dashboard Overview',
    addresses: 'Address Directory',
    add: 'Create New Address',
    dates: 'Important Dates',
    subscription: 'Subscription Management',
    import: 'Batch Address Importer',
    export: 'Export Addresses to PDF',
    districts: 'Districts Directory',
    pincodes: 'Pincodes Directory',
    settings: 'System Overview',
    profile: 'Admin Profile & Security'
  };

  const shortTitles = {
    dashboard: 'Dashboard',
    addresses: 'Addresses',
    add: 'New Address',
    dates: 'Dates',
    subscription: 'Subscription',
    import: 'Import CSV',
    export: 'Export PDF',
    districts: 'Districts',
    pincodes: 'Pincodes',
    settings: 'Overview',
    profile: 'Profile'
  };

  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0, flex: 1 }}>
        {/* Responsive Hamburger Toggle Button */}
        <button
          onClick={onToggleMobileMenu}
          className="btn btn-secondary btn-icon hamburger-btn"
          title="Toggle Navigation Menu"
          style={{ width: '36px', height: '36px', minWidth: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <Menu size={19} />
        </button>

        {activePage !== 'dashboard' && (
          <button
            onClick={onGoBack}
            className="btn btn-secondary btn-icon"
            style={{ width: '36px', height: '36px', minWidth: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderRadius: '50%' }}
            title="Go Back"
            aria-label="Go Back"
          >
            <ArrowLeft size={18} />
          </button>
        )}

        <div style={{ minWidth: 0, overflow: 'hidden' }}>
          <h1 className="header-title-text" style={{ fontWeight: 800, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>
            <span className="desktop-header-title">{pageTitles[activePage] || 'Address Management'}</span>
            <span className="mobile-header-title">{shortTitles[activePage] || 'AddressHub'}</span>
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span className="header-dataset-label">Dataset:</span>
            <span style={{ color: 'var(--success)', fontWeight: 700 }}>
              {totalCount ? `${totalCount.toLocaleString()} Records` : 'Active'}
            </span>
            <span className="header-system-subtitle">• AddressHub</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
        {/* Quick Add Button - only show when not already on the add page */}
        {activePage !== 'add' && (
          <button
            onClick={() => setActivePage('add')}
            className="btn btn-primary header-quick-add-btn"
            style={{ padding: '0.4rem 0.65rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            title="Create New Address"
          >
            <PlusCircle size={15} />
            <span className="header-btn-label">Add Address</span>
          </button>
        )}

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="btn btn-secondary btn-icon"
          style={{ width: '36px', height: '36px', minWidth: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Admin Profile Round Button */}
        <button
          onClick={() => setActivePage('profile')}
          className="btn btn-secondary btn-icon"
          style={{
            width: '36px',
            height: '36px',
            minWidth: '36px',
            borderRadius: '50%',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderColor: activePage === 'profile' ? '#2563eb' : undefined,
            color: activePage === 'profile' ? '#2563eb' : undefined
          }}
          title="Admin Profile & Security"
          aria-label="Admin Profile"
        >
          <UserCheck size={16} style={{ color: '#2563eb' }} />
        </button>
      </div>
    </header>
  );
}
