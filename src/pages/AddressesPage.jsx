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
import { fetchAddresses, updateAddress, deleteAddress, bulkDeleteAddresses } from '../services/apiService';
import { PlusCircle, RefreshCw, FileText, FileSpreadsheet, CheckSquare, Square, Hash, X, MapPin, Trash2 } from 'lucide-react';
import { exportAddressesToPdf, exportAddressesToCsv, exportAddressesToWord } from '../utils/pdfExportHelper';

export function AddressesPage({ initialParams, onEditAddress, onAddAddress, onStatsChange }) {
  const {
    addresses,
    total,
    totalDatabaseCount,
    groupCounts,
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
    setGroup,
    setSort,
    setPage,
    setLimit,
    clearFilters,
    refetch,
    optimisticDelete,
    optimisticBulkDelete,
    optimisticUpdate
  } = useAddresses(initialParams || {}, onStatsChange);

  const [subTabFilter, setSubTabFilter] = useState('ALL'); // 'ALL' | 'SUBSCRIBED' | 'UNSUBSCRIBED'
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [addressToDelete, setAddressToDelete] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
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
    (params.group && params.group !== 'ALL') ||
    params.pincode ||
    params.street ||
    (params.alphabet && params.alphabet !== 'ALL')
  );

  // Reset selection when page or filters change
  React.useEffect(() => {
    setSelectedIds([]);
  }, [page, params.district, params.group, params.pincode, params.street, params.alphabet, params.search, subTabFilter]);

  const handleToggleSelect = (id) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleToggleSelectAll = () => {
    if (!displayedAddresses || displayedAddresses.length === 0) return;
    const displayedIds = displayedAddresses.map(a => a._id);
    const allSelected = displayedIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !displayedIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...displayedIds])));
    }
  };

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

  // Instant 0ms Optimistic Single Deletion
  const handleDeleteConfirm = async () => {
    if (!addressToDelete) return;
    const targetId = addressToDelete._id;
    
    // 1. Immediately close modal and remove from UI without waiting
    setAddressToDelete(null);
    setSelectedIds(prev => prev.filter(i => i !== targetId));
    optimisticDelete(targetId);
    setToast({ message: 'Address deleted successfully!', type: 'success' });

    // 2. Perform API delete in background
    try {
      await deleteAddress(targetId);
      if (onStatsChange) onStatsChange();
      await refetch();
    } catch (err) {
      setToast({ message: err.message || 'Failed to delete address on server', type: 'error' });
      refetch();
    }
  };

  // Instant 0ms Optimistic Bulk Deletion
  const handleBulkDeleteConfirm = async () => {
    if (!selectedIds || selectedIds.length === 0) return;
    const idsToDelete = [...selectedIds];
    const count = idsToDelete.length;

    // 1. Immediately close modal and remove from UI without waiting
    setShowBulkDeleteModal(false);
    setSelectedIds([]);
    optimisticBulkDelete(idsToDelete);
    setToast({ message: `Successfully deleted ${count} address${count > 1 ? 'es' : ''}!`, type: 'success' });

    // 2. Perform Bulk API delete in background
    try {
      await bulkDeleteAddresses(idsToDelete);
      if (onStatsChange) onStatsChange();
      await refetch();
    } catch (err) {
      setToast({ message: err.message || 'Failed to delete selected addresses on server', type: 'error' });
      refetch();
    }
  };

  const handleExportCsv = async () => {
    try {
      if (!total || total === 0) {
        setToast({ message: 'Validation Warning: No address records found to export.', type: 'warning' });
        return;
      }
      setToast({ message: 'Fetching all records for export...', type: 'info' });
      const allRes = await fetchAddresses({ ...params, limit: 15000, page: 1 });
      const recordsToExport = allRes.addresses || [];
      
      const filterLabel = params.district || 'All Districts';
      const res = exportAddressesToCsv(recordsToExport, filterLabel);
      if (res?.success) {
        setToast({ message: `Download Validated: Successfully exported ${res.count} addresses to CSV (${res.fileName}).`, type: 'success' });
      }
    } catch (err) {
      console.error('CSV Export Error:', err);
      setToast({ message: 'Validation Error: Failed to fetch and export CSV file.', type: 'error' });
    }
  };

  const handleExportPdf = async () => {
    try {
      if (!total || total === 0) {
        setToast({ message: 'Validation Warning: No address records found to export.', type: 'warning' });
        return;
      }
      setToast({ message: 'Fetching all records for PDF export...', type: 'info' });
      const allRes = await fetchAddresses({ ...params, limit: 15000, page: 1 });
      const recordsToExport = allRes.addresses || [];

      const filterLabel = params.district || 'All Districts';
      const res = await exportAddressesToPdf(recordsToExport, filterLabel);
      if (res?.success) {
        setToast({ message: `Download Validated: Successfully exported ${res.count} addresses to PDF (${res.fileName}).`, type: 'success' });
      }
    } catch (err) {
      console.error('PDF Export Error:', err);
      setToast({ message: 'Validation Error: Failed to fetch and export PDF file.', type: 'error' });
    }
  };

  const handleExportWord = async () => {
    try {
      if (!total || total === 0) {
        setToast({ message: 'Validation Warning: No address records found to export.', type: 'warning' });
        return;
      }
      setToast({ message: 'Fetching all records for Word export...', type: 'info' });
      const allRes = await fetchAddresses({ ...params, limit: 15000, page: 1 });
      const recordsToExport = allRes.addresses || [];

      const filterLabel = params.district || 'All Districts';
      const res = exportAddressesToWord(recordsToExport, filterLabel);
      if (res?.success) {
        setToast({ message: `Download Validated: Successfully exported ${res.count} addresses to Word (${res.fileName}).`, type: 'success' });
      }
    } catch (err) {
      console.error('Word Export Error:', err);
      setToast({ message: 'Validation Error: Failed to fetch and export Word file.', type: 'error' });
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

  const grandTotal = totalDatabaseCount || total || 0;
  const currentGroupFilter = params.group || 'ALL';

  return (
    <div>
      {/* 4 Group Summary Cards + Total Count */}
      <div className="group-summary-header">
        <div className="group-summary-grid">
          {/* Total Addresses Card */}
          <div
            onClick={() => setGroup('ALL')}
            className={`group-summary-card group-summary-card-total ${currentGroupFilter === 'ALL' ? 'active-group-filter' : ''}`}
            title="Click to view all addresses"
          >
            <div className="group-card-top-row">
              <span className="group-card-title">Total Addresses</span>
              <span className="group-card-indicator" style={{ backgroundColor: '#2563eb' }} />
            </div>
            <div className="group-card-count">
              {grandTotal.toLocaleString()}
            </div>
          </div>

          {/* VIP Group Card */}
          <div
            onClick={() => setGroup(currentGroupFilter === 'VIP' ? 'ALL' : 'VIP')}
            className={`group-summary-card group-summary-card-vip ${currentGroupFilter === 'VIP' ? 'active-group-filter' : ''}`}
            title="Click to filter by VIP group"
          >
            <div className="group-card-top-row">
              <span className="group-card-title" style={{ color: '#854d0e' }}>⭐ VIP</span>
              <span className="group-card-indicator" style={{ backgroundColor: '#eab308' }} />
            </div>
            <div className="group-card-count" style={{ color: '#854d0e' }}>
              {(groupCounts?.VIP || 0).toLocaleString()}
            </div>
          </div>

          {/* ADVERTISEMENT Group Card */}
          <div
            onClick={() => setGroup(currentGroupFilter === 'ADVERTISEMENT' ? 'ALL' : 'ADVERTISEMENT')}
            className={`group-summary-card group-summary-card-advertisement ${currentGroupFilter === 'ADVERTISEMENT' ? 'active-group-filter' : ''}`}
            title="Click to filter by Advertisement group"
          >
            <div className="group-card-top-row">
              <span className="group-card-title" style={{ color: '#0369a1' }}>📢 ADVERTISEMENT</span>
              <span className="group-card-indicator" style={{ backgroundColor: '#0284c7' }} />
            </div>
            <div className="group-card-count" style={{ color: '#0369a1' }}>
              {(groupCounts?.ADVERTISEMENT || 0).toLocaleString()}
            </div>
          </div>

          {/* HELP Group Card */}
          <div
            onClick={() => setGroup(currentGroupFilter === 'HELP' ? 'ALL' : 'HELP')}
            className={`group-summary-card group-summary-card-help ${currentGroupFilter === 'HELP' ? 'active-group-filter' : ''}`}
            title="Click to filter by Help group"
          >
            <div className="group-card-top-row">
              <span className="group-card-title" style={{ color: '#15803d' }}>🤝 HELP</span>
              <span className="group-card-indicator" style={{ backgroundColor: '#16a34a' }} />
            </div>
            <div className="group-card-count" style={{ color: '#15803d' }}>
              {(groupCounts?.HELP || 0).toLocaleString()}
            </div>
          </div>

          {/* NORMAL Group Card */}
          <div
            onClick={() => setGroup(currentGroupFilter === 'CONTRIBUTOR' ? 'ALL' : 'CONTRIBUTOR')}
            className={`group-summary-card group-summary-card-contributor ${currentGroupFilter === 'CONTRIBUTOR' ? 'active-group-filter' : ''}`}
            title="Click to filter by Contributor group"
          >
            <div className="group-card-top-row">
              <span className="group-card-title" style={{ color: '#475569' }}>📋 CONTRIBUTOR</span>
              <span className="group-card-indicator" style={{ backgroundColor: '#94a3b8' }} />
            </div>
            <div className="group-card-count" style={{ color: '#475569' }}>
              {(groupCounts?.CONTRIBUTOR || 0).toLocaleString()}
            </div>
          </div>

          {/* CANCEL Group Card */}
          <div
            onClick={() => setGroup(currentGroupFilter === 'CANCEL' ? 'ALL' : 'CANCEL')}
            className={`group-summary-card group-summary-card-cancel ${currentGroupFilter === 'CANCEL' ? 'active-group-filter' : ''}`}
            title="Click to filter by Cancel group"
          >
            <div className="group-card-top-row">
              <span className="group-card-title" style={{ color: '#991b1b' }}>🚫 CANCEL</span>
              <span className="group-card-indicator" style={{ backgroundColor: '#ef4444' }} />
            </div>
            <div className="group-card-count" style={{ color: '#991b1b' }}>
              {(groupCounts?.CANCEL || 0).toLocaleString()}
            </div>
          </div>

          {/* CALLBACK Group Card */}
          <div
            onClick={() => setGroup(currentGroupFilter === 'CALLBACK' ? 'ALL' : 'CALLBACK')}
            className={`group-summary-card group-summary-card-callback ${currentGroupFilter === 'CALLBACK' ? 'active-group-filter' : ''}`}
            title="Click to filter by Callback group"
          >
            <div className="group-card-top-row">
              <span className="group-card-title" style={{ color: '#9a3412' }}>📞 CALLBACK</span>
              <span className="group-card-indicator" style={{ backgroundColor: '#f97316' }} />
            </div>
            <div className="group-card-count" style={{ color: '#9a3412' }}>
              {(groupCounts?.CALLBACK || 0).toLocaleString()}
            </div>
          </div>

          {/* MATRIMONY Group Card */}
          <div
            onClick={() => setGroup(currentGroupFilter === 'MATRIMONY' ? 'ALL' : 'MATRIMONY')}
            className={`group-summary-card group-summary-card-matrimony ${currentGroupFilter === 'MATRIMONY' ? 'active-group-filter' : ''}`}
            title="Click to filter by Matrimony group"
          >
            <div className="group-card-top-row">
              <span className="group-card-title" style={{ color: '#9d174d' }}>💍 MATRIMONY</span>
              <span className="group-card-indicator" style={{ backgroundColor: '#ec4899' }} />
            </div>
            <div className="group-card-count" style={{ color: '#9d174d' }}>
              {(groupCounts?.MATRIMONY || 0).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

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
          {selectedIds.length > 0 && (
            <button
              onClick={() => setShowBulkDeleteModal(true)}
              className="btn btn-danger action-btn-bulk-delete"
              title={`Delete ${selectedIds.length} Selected Addresses`}
              style={{
                backgroundColor: '#dc2626',
                color: '#ffffff',
                borderColor: '#dc2626',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontWeight: 700
              }}
            >
              <Trash2 size={16} />
              <span>Delete Selected ({selectedIds.length})</span>
            </button>
          )}

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
            onClick={handleExportWord}
            className="btn btn-secondary action-btn-export"
            title="Export Current View as MS Word"
            disabled={!displayedAddresses || displayedAddresses.length === 0}
            style={{ color: '#2563eb', borderColor: '#2563eb' }}
          >
            <FileText size={16} />
            <span>Export Word</span>
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

      {/* Multi-Field Filter Bar with Group Filter */}
      <FilterBar
        district={params.district}
        pincode={params.pincode}
        street={params.street}
        group={params.group}
        sort={params.sort}
        onDistrictChange={setDistrict}
        onPincodeChange={setPincode}
        onStreetChange={setStreet}
        onGroupChange={setGroup}
        onSortChange={setSort}
        onClearFilters={clearFilters}
        hasActiveFilters={hasActiveFilters}
        langMode={langMode}
      />

      {/* Bulk Selection Notification Bar */}
      {selectedIds.length > 0 && (
        <div className="bulk-selection-bar">
          <div className="bulk-selection-info">
            <CheckSquare size={18} style={{ color: '#dc2626' }} />
            <span>{selectedIds.length} address{selectedIds.length > 1 ? 'es' : ''} selected</span>
          </div>
          <div className="bulk-selection-actions">
            <button
              onClick={() => setSelectedIds([])}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
            >
              Clear Selection
            </button>
            <button
              onClick={() => setShowBulkDeleteModal(true)}
              className="btn btn-danger btn-sm"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                backgroundColor: '#dc2626',
                color: '#ffffff',
                fontSize: '0.82rem',
                fontWeight: 700,
                padding: '0.35rem 0.85rem'
              }}
            >
              <Trash2 size={15} />
              <span>Delete Selected ({selectedIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Address Table */}
      <AddressTable
        addresses={displayedAddresses}
        page={page}
        limit={limit}
        loading={loading}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        onToggleSelectAll={handleToggleSelectAll}
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

      {/* Confirm Single Delete Modal */}
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

      {/* Confirm Bulk Delete Modal */}
      {showBulkDeleteModal && (
        <ConfirmModal
          isOpen={showBulkDeleteModal}
          title={`Delete ${selectedIds.length} Addresses`}
          message={`Are you sure you want to delete all ${selectedIds.length} selected address records? This action will permanently remove them from the database.`}
          confirmText={`Yes, Delete ${selectedIds.length} Addresses`}
          onConfirm={handleBulkDeleteConfirm}
          onCancel={() => setShowBulkDeleteModal(false)}
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

