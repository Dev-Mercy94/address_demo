import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardPage } from './pages/DashboardPage';
import { AddressesPage } from './pages/AddressesPage';
import { ScrollToTopButton } from './components/ScrollToTopButton';
import { fetchStats } from './services/apiService';

// Lazy-load secondary and heavier pages to keep initial bundle tiny and ultra-fast
const AddAddressPage = lazy(() => import('./pages/AddAddressPage').then(m => ({ default: m.AddAddressPage })));
const SubscriptionPage = lazy(() => import('./pages/SubscriptionPage').then(m => ({ default: m.SubscriptionPage })));
const ImportantDatesPage = lazy(() => import('./pages/ImportantDatesPage').then(m => ({ default: m.ImportantDatesPage })));
const ImportPage = lazy(() => import('./pages/ImportPage').then(m => ({ default: m.ImportPage })));
const ExportPage = lazy(() => import('./pages/ExportPage').then(m => ({ default: m.ExportPage })));
const DistrictsPage = lazy(() => import('./pages/DistrictsPage').then(m => ({ default: m.DistrictsPage })));
const PincodesPage = lazy(() => import('./pages/PincodesPage').then(m => ({ default: m.PincodesPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));

function LazyPageFallback() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '280px',
      color: 'var(--text-muted)',
      fontSize: '0.9rem'
    }}>
      <div className="table-top-progress-bar" style={{ position: 'fixed', top: 0, left: 0, right: 0 }} />
      <span>Loading page view...</span>
    </div>
  );
}

function AuthenticatedApp() {
  const { isAuthenticated } = useAuth();
  const [activePage, setActivePage] = useState('dashboard');
  const [pageHistory, setPageHistory] = useState(['dashboard']);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [editingAddress, setEditingAddress] = useState(null);
  const [stats, setStats] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [addressFilterParams, setAddressFilterParams] = useState({});

  const navigateTo = (newPage) => {
    if (newPage !== 'add') setEditingAddress(null);
    if (newPage !== activePage) {
      setPageHistory(prev => [...prev, newPage]);
      setActivePage(newPage);
    }
  };

  const handleGoBack = () => {
    if (pageHistory.length > 1) {
      const updatedHistory = [...pageHistory];
      updatedHistory.pop(); // Pop current page
      const prevPage = updatedHistory[updatedHistory.length - 1];
      setPageHistory(updatedHistory);
      if (prevPage !== 'add') setEditingAddress(null);
      setActivePage(prevPage);
    } else {
      setActivePage('dashboard');
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const refreshStats = useCallback((overrideData) => {
    if (overrideData && typeof overrideData === 'object' && overrideData.totalAddresses !== undefined) {
      setStats(prev => prev ? { ...prev, totalAddresses: overrideData.totalAddresses } : { totalAddresses: overrideData.totalAddresses });
    }
    fetchStats()
      .then(data => {
        setStats(prev => ({ ...prev, ...data, ...(overrideData || {}) }));
      })
      .catch(err => console.warn('Could not refresh stats:', err));
  }, []);

  // Fetch stats once on mount / login
  useEffect(() => {
    if (isAuthenticated) {
      refreshStats();
    }
  }, [isAuthenticated, refreshStats]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleEditAddress = (address) => {
    setEditingAddress(address);
    navigateTo('add');
  };

  const handleAddNewAddress = () => {
    setEditingAddress(null);
    navigateTo('add');
  };

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const renderContent = () => {
    switch (activePage) {
      case 'dashboard':
        return (
          <DashboardPage
            onNavigate={navigateTo}
            onSearchSelect={(term, type) => {
              if (type === 'district') {
                setAddressFilterParams({ district: term, search: '', pincode: '', page: 1 });
              } else {
                setAddressFilterParams({ search: term, district: 'ALL', pincode: '', page: 1 });
              }
              navigateTo('addresses');
            }}
          />
        );
      case 'addresses':
        return (
          <AddressesPage
            initialParams={addressFilterParams}
            onEditAddress={handleEditAddress}
            onAddAddress={handleAddNewAddress}
            onStatsChange={refreshStats}
          />
        );
      case 'add':
        return (
          <Suspense fallback={<LazyPageFallback />}>
            <AddAddressPage
              initialData={editingAddress}
              onNavigate={navigateTo}
              onStatsChange={refreshStats}
              onComplete={() => {
                setEditingAddress(null);
                refreshStats();
                navigateTo('addresses');
              }}
            />
          </Suspense>
        );
      case 'subscription':
      case 'subscriptions':
        return (
          <Suspense fallback={<LazyPageFallback />}>
            <SubscriptionPage
              onNavigate={navigateTo}
              onEditAddress={handleEditAddress}
              onStatsChange={refreshStats}
            />
          </Suspense>
        );
      case 'dates':
        return (
          <Suspense fallback={<LazyPageFallback />}>
            <ImportantDatesPage
              onNavigate={navigateTo}
            />
          </Suspense>
        );
      case 'import':
        return (
          <Suspense fallback={<LazyPageFallback />}>
            <ImportPage onNavigate={navigateTo} onStatsChange={refreshStats} />
          </Suspense>
        );
      case 'export':
        return (
          <Suspense fallback={<LazyPageFallback />}>
            <ExportPage />
          </Suspense>
        );
      case 'districts':
        return (
          <Suspense fallback={<LazyPageFallback />}>
            <DistrictsPage
              onSelectDistrict={(district) => {
                setAddressFilterParams({ district, search: '', pincode: '', street: '', alphabet: 'ALL', page: 1 });
                navigateTo('addresses');
              }}
            />
          </Suspense>
        );
      case 'pincodes':
        return (
          <Suspense fallback={<LazyPageFallback />}>
            <PincodesPage
              onSelectPincode={(pincode) => {
                setAddressFilterParams({ pincode, district: 'ALL', search: '', street: '', alphabet: 'ALL', page: 1 });
                navigateTo('addresses');
              }}
            />
          </Suspense>
        );
      case 'settings':
        return (
          <Suspense fallback={<LazyPageFallback />}>
            <SettingsPage onNavigate={navigateTo} onStatsChange={refreshStats} />
          </Suspense>
        );
      case 'profile':
        return (
          <Suspense fallback={<LazyPageFallback />}>
            <ProfilePage onNavigate={navigateTo} />
          </Suspense>
        );
      default:
        return <DashboardPage onNavigate={navigateTo} />;
    }
  };

  return (
    <div className="app-container">
      {/* Mobile Drawer Backdrop Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="sidebar-backdrop"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <Sidebar
        activePage={activePage}
        setActivePage={(page) => navigateTo(page)}
        stats={stats}
        isMobileMenuOpen={isMobileMenuOpen}
        onCloseMobileMenu={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Container */}
      <div className="main-content">
        <Header
          activePage={activePage}
          setActivePage={(page) => navigateTo(page)}
          theme={theme}
          toggleTheme={toggleTheme}
          totalCount={stats?.totalAddresses}
          onGoBack={handleGoBack}
          onToggleMobileMenu={() => setIsMobileMenuOpen(prev => !prev)}
        />

        <main className="page-container">
          {renderContent()}
        </main>
      </div>

      {/* Floating Scroll to Top Round Arrow Button */}
      <ScrollToTopButton />
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}

export default App;
