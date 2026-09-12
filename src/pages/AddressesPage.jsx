import React, { useState } from 'react';
import { useAddresses } from '../hooks/useAddresses';
import { SearchBar } from '../components/SearchBar';
import { AlphabetFilter } from '../components/AlphabetFilter';
import { FilterBar } from '../components/FilterBar';
import { AddressTable } from '../components/AddressTable';
import { Pagination } from '../components/Pagination';
import { AddressDetailsModal } from '../components/AddressDetailsModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { Toast } from '../components/Toast';
import { PageLoader } from '../components/PageLoader';
import { updateAddress, deleteAddress } from '../services/apiService';
import { PlusCircle, RefreshCw, FileText, FileSpreadsheet, CheckSquare, Square, Hash, X, MapPin } from 'lucide-react';
import { exportAddressesToPdf, exportAddressesToCsv } from '../utils/pdfExportHelper';

export function AddressesPage({ initialParams, onEditAddress, onAddAddress, onStatsChange }) {
  const {
    addresses,
    total,
    page,
    limit,
    totalPages,
    loading,
    initialLoading,
    error,
    params,
    setSearch,
    setUId,
    setDistrict,
    setPincode,
    setStreet,
    setAlphabet,
    setSort,
    setPage,
    setLimit,
    clearFilters,
    refetch,
    optimisticDelete,
    optimisticUpdate
  } = useAddresses(initialParams || {}, onStatsChange);

  const [subTabFilter, setSubTabFilter] = useState('ALL'); // 'ALL' | 'SUBSCRIBED' | 'UNSUBSCRIBED'
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [addressToDelete, setAddressToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'success' });

  const [langMode, setLangMode] = useState(() => {
    return localStorage.getItem('address_search_lang_mode') || 'TA';
  });

  const handleLangModeChange = (mode) => {
    setLangMode(mode);
    localStorage.setItem('address_search_lang_mode', mode);
  };

  const subTabCounts = React.useMemo(() => {
    if (!addresses || !Array.isArray(addresses)) return { all: total || 0, sub: 0, unsub: 0 };
    const sub = addresses.filter(a => Boolean(a.subscription)).length;
    return {
      all: total || addresses.length,
      sub: sub,
      unsub: (total || addresses.length) - sub
    };
  }, [addresses, total]);

  const displayedAddresses = React.useMemo(() => {
    if (!addresses || !Array.isArray(addresses)) return [];
    if (subTabFilter === 'SUBSCRIBED') {
      return addresses.filter(a => Boolean(a.subscription));
    }
    if (subTabFilter === 'UNSUBSCRIBED') {
      return addresses.filter(a => !Boolean(a.subscription));
    }
    return addresses;
  }, [addresses, subTabFilter]);

  const hasActiveFilters = Boolean(
    params.search ||
    params.u_id ||
    (params.district && params.district !== 'ALL') ||
    params.pincode ||
    params.street ||
    (params.alphabet && params.alphabet !== 'ALL')
  );

  // Instant 0ms Optimistic Inline Save
  const handleInlineSave = async (id, updates) => {
    optimisticUpdate(id, updates);
    setToast({ message: 'Address updated successfully!', type: 'success' });
    try {
      await updateAddress(id, updates);
      if (onStatsChange) onStatsChange();
    } catch (err) {
      setToast({ message: err.message || 'Failed to update address', type: 'error' });
      refetch();
    }
  };

  // Instant 0ms Optimistic Deletion
  const handleDeleteConfirm = async () => {
    if (!addressToDelete) return;
    const targetId = addressToDelete._id;
    
    // 1. Immediately close modal and remove from UI without waiting
    setAddressToDelete(null);
    optimisticDelete(targetId);
    setToast({ message: 'Address deleted successfully!', type: 'success' });

    // 2. Perform API delete in background
    try {
      await deleteAddress(targetId);
      if (onStatsChange) onStatsChange();
    } catch (err) {
      setToast({ message: err.message || 'Failed to delete address on server', type: 'error' });
      refetch();
    }
  };

  const handleExportCsv = () => {
    try {
      if (!displayedAddresses || displayedAddresses.length === 0) {
        setToast({ message: 'Validation Warning: No address records found to export.', type: 'warning' });
        return;
      }
      const filterLabel = params.district || 'All Districts';
      const res = exportAddressesToCsv(displayedAddresses, filterLabel);
      if (res?.success) {
        setToast({ message: `Download Validated: Successfully exported ${res.count} addresses to CSV (${res.fileName}).`, type: 'success' });
      }
    } catch (err) {
      console.error('CSV Export Error:', err);
      setToast({ message: 'Validation Error: Failed to export CSV file.', type: 'error' });
    }
  };

  const handleExportPdf = async () => {
    try {
      if (!displayedAddresses || displayedAddresses.length === 0) {
        setToast({ message: 'Validation Warning: No address records found to export.', type: 'warning' });
        return;
      }
      const filterLabel = params.district || 'All Districts';
      const res = await exportAddressesToPdf(displayedAddresses, filterLabel);
      if (res?.success) {
        setToast({ message: `Download Validated: Successfully exported ${res.count} addresses to PDF (${res.fileName}).`, type: 'success' });
      }
    } catch (err) {
      console.error('PDF Export Error:', err);
      setToast({ message: 'Validation Error: Failed to export PDF file.', type: 'error' });
    }
  };

  if (initialLoading && (!addresses || addresses.length === 0)) {
    return (
      <PageLoader 
        message="Loading address records..." 
        subMessage="Searching and indexing address database" 
        icon={MapPin}
      />
    );
  }

  return (
    <div>
      {/* Subscription Filter Tab Bar */}
      <div className="subscription-filter-card">
        {/* Filter Tabs: [ All ] [ Subscribed ] [ Unsubscribed ] */}
        <div className="subscription-tabs-group">
          <button
            onClick={() => setSubTabFilter('ALL')}
            style={{
              padding: '0.45rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              color: subTabFilter === 'ALL' ? '#ffffff' : 'var(--text-primary)',
              backgroundColor: subTabFilter === 'ALL' ? '#2563eb' : 'transparent',
              border: 'none',
              borderRadius: '0.45rem',
              cursor: 'pointer',
              boxShadow: subTabFilter === 'ALL' ? '0 2px 6px rgba(37, 99, 235, 0.3)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <span>All ({subTabCounts.all})</span>
          </button>

          <button
            onClick={() => setSubTabFilter('SUBSCRIBED')}
            style={{
              padding: '0.45rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              color: subTabFilter === 'SUBSCRIBED' ? '#ffffff' : '#047857',
              backgroundColor: subTabFilter === 'SUBSCRIBED' ? '#2563eb' : 'transparent',
              border: 'none',
              borderRadius: '0.45rem',
              cursor: 'pointer',
              boxShadow: subTabFilter === 'SUBSCRIBED' ? '0 2px 6px rgba(37, 99, 235, 0.3)' : 'none',
              transition: 'all 0.15s ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <CheckSquare size={14} style={{ flexShrink: 0 }} />
            <span className="desktop-tab-label">Subscribed ({subTabCounts.sub})</span>
            <span className="mobile-tab-label">Sub ({subTabCounts.sub})</span>
          </button>

          <button
            onClick={() => setSubTabFilter('UNSUBSCRIBED')}
            style={{
              padding: '0.45rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              color: subTabFilter === 'UNSUBSCRIBED' ? '#ffffff' : '#b91c1c',
              backgroundColor: subTabFilter === 'UNSUBSCRIBED' ? '#2563eb' : 'transparent',
              border: 'none',
              borderRadius: '0.45rem',
              cursor: 'pointer',
              boxShadow: subTabFilter === 'UNSUBSCRIBED' ? '0 2px 6px rgba(37, 99, 235, 0.3)' : 'none',
              transition: 'all 0.15s ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <Square size={14} style={{ flexShrink: 0 }} />
            <span className="desktop-tab-label">Unsubscribed ({subTabCounts.unsub})</span>
            <span className="mobile-tab-label">Unsub ({subTabCounts.unsub})</span>
          </button>
        </div>

        {/* U.Id Filter Box & Tablet-only Add Address Button */}
        <div className="subscription-uid-wrapper">
          <div className="subscription-uid-box">
            <Hash size={16} style={{ color: '#2563eb', flexShrink: 0 }} />
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                value={params.u_id || ''}
                onChange={(e) => setUId(e.target.value)}
                placeholder={langMode === 'TA' ? "U.Id வடிகட்டி (e.g. T-0030)..." : "Filter U.Id (e.g. T-0030)..."}
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  backgroundColor: 'transparent',
                  border: 'none',
                  outline: 'none',
                  padding: '0.35rem 0.5rem',
                  paddingRight: params.u_id ? '2rem' : '0.5rem',
                  width: '100%'
                }}
              />
              {params.u_id && (
                <button
                  onClick={() => setUId('')}
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
                    alignItems: 'center'
                  }}
                  title="Clear U.Id Filter"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Search & Top Action Row */}
      <div className="address-top-toolbar">
        <div className="address-search-wrapper">
          <SearchBar
            value={params.search}
            onChange={setSearch}
            loading={loading}
            langMode={langMode}
            onLangModeChange={handleLangModeChange}
          />
        </div>

        <div className="address-action-buttons-group">
          <button
            onClick={handleExportCsv}
            className="btn btn-secondary action-btn-export"
            title="Export Current View as CSV"
            disabled={!displayedAddresses || displayedAddresses.length === 0}
            style={{ color: '#059669', borderColor: '#059669' }}
          >
            <FileSpreadsheet size={16} />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleExportPdf}
            className="btn btn-secondary action-btn-export"
            title="Export Current View as PDF"
            disabled={!displayedAddresses || displayedAddresses.length === 0}
          >
            <FileText size={16} />
            <span>Export PDF</span>
          </button>

          <button
            onClick={() => refetch()}
            className="btn btn-secondary btn-icon action-btn-refresh"
            title="Refresh List"
          >
            <RefreshCw size={16} className={loading ? 'pulse-loader' : ''} />
          </button>

          <button
            onClick={onAddAddress}
            className="btn btn-primary action-btn-add"
          >
            <PlusCircle size={16} />
            <span>Add Address</span>
          </button>
        </div>
      </div>

      {/* Quick Alphabet Filter Bar */}
      <AlphabetFilter
        selectedAlphabet={params.alphabet}
        onSelectAlphabet={setAlphabet}
        langMode={langMode}
      />

      {/* Multi-Field Filter Bar */}
      <FilterBar
        district={params.district}
        pincode={params.pincode}
        street={params.street}
        sort={params.sort}
        onDistrictChange={setDistrict}
        onPincodeChange={setPincode}
        onStreetChange={setStreet}
        onSortChange={setSort}
        onClearFilters={clearFilters}
        hasActiveFilters={hasActiveFilters}
        langMode={langMode}
      />

      {/* Main Address Table */}
      <AddressTable
        addresses={displayedAddresses}
        page={page}
        limit={limit}
        loading={loading}
        onView={(addr) => setSelectedAddress(addr)}
        onEdit={(addr) => onEditAddress(addr)}
        onDelete={(addr) => setAddressToDelete(addr)}
        onInlineSave={handleInlineSave}
      />

      {/* Pagination Footer */}
      {!loading && total > 0 && (
        <Pagination
          page={page}
          limit={limit}
          total={total}
          totalPages={totalPages}
          onPageChange={setPage}
          onLimitChange={setLimit}
        />
      )}

      {/* View Address Details Modal */}
      {selectedAddress && (
        <AddressDetailsModal
          address={selectedAddress}
          onClose={() => setSelectedAddress(null)}
          onEdit={(addr) => {
            setSelectedAddress(null);
            onEditAddress(addr);
          }}
          onDelete={(addr) => {
            setSelectedAddress(null);
            setAddressToDelete(addr);
          }}
        />
      )}

      {/* Confirm Delete Modal */}
      {addressToDelete && (
        <ConfirmModal
          isOpen={Boolean(addressToDelete)}
          title="Delete Address"
          message={`Are you sure you want to delete "${addressToDelete.name}" from the address directory?`}
          confirmText="Delete Address"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setAddressToDelete(null)}
          loading={deleteLoading}
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
