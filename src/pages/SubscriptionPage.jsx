import React, { useState, useMemo, useEffect } from 'react';
import { useAddresses } from '../hooks/useAddresses';
import { Pagination } from '../components/Pagination';
import { Toast } from '../components/Toast';
import { PageLoader } from '../components/PageLoader';
import { updateAddress } from '../services/apiService';
import {
  CheckSquare,
  Square,
  Sparkles,
  Calendar,
  Clock,
  User,
  X,
  CheckCircle2,
  XCircle,
  Filter,
  Hash,
  IndianRupee,
  LayoutGrid,
  List,
  Eye,
  Edit3,
  MapPin,
  Phone,
  MessageCircle,
  MessageSquare
} from 'lucide-react';

export function SubscriptionPage({ onNavigate, onEditAddress, onStatsChange }) {
  const {
    addresses,
    loading,
    initialLoading,
    params,
    setUId,
    refetch,
    optimisticUpdate
  } = useAddresses({ limit: 1000 }, onStatsChange);

  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'SUBSCRIBED' | 'UNSUBSCRIBED'
  const [dateFilter, setDateFilter] = useState('');
  const [amountFilter, setAmountFilter] = useState('');

  // View Mode: 'table' | 'cards' (default to cards on mobile)
  const [viewMode, setViewMode] = useState(() => {
    return typeof window !== 'undefined' && window.innerWidth < 768 ? 'cards' : 'table';
  });

  // Pagination state
  const [subPage, setSubPage] = useState(1);
  const [subLimit, setSubLimit] = useState(50);

  const [selectedRecord, setSelectedRecord] = useState(null);
  const [subscribingId, setSubscribingId] = useState(null);
  const [toast, setToast] = useState({ message: '', type: 'success' });

  // Reset pagination on filter changes
  useEffect(() => {
    setSubPage(1);
  }, [activeTab, dateFilter, amountFilter, params.u_id]);

  // Filter addresses based on active tab, date, amount
  const filteredAddresses = useMemo(() => {
    if (!addresses || !Array.isArray(addresses)) return [];

    return addresses.filter(item => {
      const isSub = Boolean(item.subscription);

      // Tab filter
      if (activeTab === 'SUBSCRIBED' && !isSub) return false;
      if (activeTab === 'UNSUBSCRIBED' && isSub) return false;

      // Date filter
      if (dateFilter.trim()) {
        const qDate = dateFilter.toLowerCase().trim();
        const itemDate = (item.subscription_date || '').toLowerCase();
        if (!itemDate.includes(qDate)) return false;
      }

      // Amount filter
      if (amountFilter.trim()) {
        const qAmt = amountFilter.trim().replace(/[^\d]/g, '');
        const itemAmt = String(item.subscription_amount || '');
        if (qAmt && !itemAmt.includes(qAmt)) return false;
      }

      return true;
    });
  }, [addresses, activeTab, dateFilter, amountFilter]);

  // Paginated slice for current page
  const paginatedAddresses = useMemo(() => {
    const start = (subPage - 1) * subLimit;
    return filteredAddresses.slice(start, start + subLimit);
  }, [filteredAddresses, subPage, subLimit]);

  const subTotalPages = Math.max(1, Math.ceil(filteredAddresses.length / subLimit));

  // Counts for tabs
  const counts = useMemo(() => {
    if (!addresses || !Array.isArray(addresses)) return { all: 0, sub: 0, unsub: 0 };
    const sub = addresses.filter(a => Boolean(a.subscription)).length;
    return {
      all: addresses.length,
      sub: sub,
      unsub: addresses.length - sub
    };
  }, [addresses]);

  const handleQuickSubscribe = async (record, e) => {
    if (e) e.stopPropagation();

    const now = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dateStr = `${String(now.getDate()).padStart(2, '0')}-${months[now.getMonth()]}-${now.getFullYear()}`;
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const timeStr = `${hours}:${minutes} ${ampm}`;

    const updates = {
      subscription: !record.subscription,
      subscription_date: !record.subscription ? (record.subscription_date || dateStr) : record.subscription_date,
      subscription_time: !record.subscription ? (record.subscription_time || timeStr) : record.subscription_time,
      subscription_amount: !record.subscription ? (record.subscription_amount || 500) : record.subscription_amount
    };

    // Instant optimistic update
    optimisticUpdate(record._id, updates);
    setToast({ message: `Subscription updated for ${record.name}!`, type: 'success' });

    try {
      await updateAddress(record._id, updates);
      if (onStatsChange) onStatsChange();
    } catch (err) {
      setToast({ message: err.message || 'Failed to update subscription', type: 'error' });
      refetch();
    }
  };

  const handleWhatsAppMessage = (record, e) => {
    if (e) e.stopPropagation();
    if (!record.phone) {
      setToast({ message: 'No phone number available for this contact', type: 'error' });
      return;
    }

    const amountVal = record.subscription ? (record.subscription_amount || 500) : 0;
    const message = `Hello, we have received your subscription payment of ₹${amountVal}. Thank you!`;

    const phoneNum = record.phone.replace(/\D/g, '');
    const finalPhone = phoneNum.length === 10 ? `91${phoneNum}` : phoneNum;

    window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleSmsMessage = (record, e) => {
    if (e) e.stopPropagation();
    if (!record.phone) {
      setToast({ message: 'No phone number available for this contact', type: 'error' });
      return;
    }

    const amountVal = record.subscription ? (record.subscription_amount || 500) : 0;
    const message = `Hello, we have received your subscription payment of ₹${amountVal}. Thank you!`;

    const phoneNum = record.phone.replace(/\D/g, '');

    window.open(`sms:${phoneNum}?body=${encodeURIComponent(message)}`, '_self');
  };

  if (initialLoading && (!addresses || addresses.length === 0)) {
    return (
      <PageLoader
        message="Loading subscription records..."
        subMessage="Tracking subscriber status and renewal schedules"
        icon={CheckSquare}
      />
    );
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Page Header */}
      <div className="sub-page-header" style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        marginBottom: '1.25rem'
      }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-primary)' }}>
            <CheckSquare size={26} style={{ color: '#2563eb' }} />
            <span>Subscription Management</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
            Manage directory address subscriptions, filter by Date, Amount, or U.Id, and view subscription details.
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={() => onNavigate('add')}
          className="btn btn-primary"
          style={{
            backgroundColor: '#2563eb',
            backgroundImage: 'linear-gradient(135deg, #2563eb 0%, #0284c7 100%)',
            color: '#ffffff',
            fontWeight: 700,
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)'
          }}
        >
          <Sparkles size={16} />
          <span>Add Subscribed Address</span>
        </button>
      </div>

      {/* Top Filter Bar 1: Tabs + U.Id Filter Box */}
      <div className="subscription-filter-card">
        {/* Filter Tabs: [ All ] [ Subscribed ] [ Unsubscribed ] */}
        <div className="subscription-tabs-group">
          <button
            onClick={() => setActiveTab('ALL')}
            style={{
              padding: '0.45rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              color: activeTab === 'ALL' ? '#ffffff' : 'var(--text-primary)',
              backgroundColor: activeTab === 'ALL' ? '#2563eb' : 'transparent',
              border: 'none',
              borderRadius: '0.45rem',
              cursor: 'pointer',
              boxShadow: activeTab === 'ALL' ? '0 2px 6px rgba(37, 99, 235, 0.3)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <span>All ({counts.all})</span>
          </button>

          <button
            onClick={() => setActiveTab('SUBSCRIBED')}
            style={{
              padding: '0.45rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              color: activeTab === 'SUBSCRIBED' ? '#ffffff' : '#047857',
              backgroundColor: activeTab === 'SUBSCRIBED' ? '#2563eb' : 'transparent',
              border: 'none',
              borderRadius: '0.45rem',
              cursor: 'pointer',
              boxShadow: activeTab === 'SUBSCRIBED' ? '0 2px 6px rgba(37, 99, 235, 0.3)' : 'none',
              transition: 'all 0.15s ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <CheckSquare size={14} style={{ flexShrink: 0 }} />
            <span className="desktop-tab-label">Subscribed ({counts.sub})</span>
            <span className="mobile-tab-label">Sub ({counts.sub})</span>
          </button>

          <button
            onClick={() => setActiveTab('UNSUBSCRIBED')}
            style={{
              padding: '0.45rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              color: activeTab === 'UNSUBSCRIBED' ? '#ffffff' : '#b91c1c',
              backgroundColor: activeTab === 'UNSUBSCRIBED' ? '#2563eb' : 'transparent',
              border: 'none',
              borderRadius: '0.45rem',
              cursor: 'pointer',
              boxShadow: activeTab === 'UNSUBSCRIBED' ? '0 2px 6px rgba(37, 99, 235, 0.3)' : 'none',
              transition: 'all 0.15s ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <Square size={14} style={{ flexShrink: 0 }} />
            <span className="desktop-tab-label">Unsubscribed ({counts.unsub})</span>
            <span className="mobile-tab-label">Unsub ({counts.unsub})</span>
          </button>
        </div>

        {/* U.Id Filter Box on Right Side */}
        <div className="subscription-uid-box">
          <Hash size={16} style={{ color: '#2563eb', flexShrink: 0 }} />
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              value={params.u_id || ''}
              onChange={(e) => setUId(e.target.value)}
              placeholder="Filter U.Id (e.g. T-0030)..."
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

      {/* Filter Bar 2: Date Filter (Left) & Amount Filter (Right) */}
      <div className="subscription-secondary-filter-card">
        {/* 1. Date Filter Box (Left) */}
        <div className="subscription-input-box">
          <Calendar size={16} style={{ color: '#2563eb', flexShrink: 0 }} />
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              placeholder="Filter Date (e.g. 31-Aug-2026)..."
              style={{
                fontSize: '0.85rem',
                color: 'var(--text-primary)',
                fontWeight: 600,
                backgroundColor: 'transparent',
                border: 'none',
                outline: 'none',
                padding: '0.35rem 0.5rem',
                paddingRight: dateFilter ? '2rem' : '0.5rem',
                width: '100%'
              }}
            />
            {dateFilter && (
              <button
                onClick={() => setDateFilter('')}
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
                title="Clear Date Filter"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* 2. Amount Filter Box (Right) */}
        <div className="subscription-input-box">
          <IndianRupee size={16} style={{ color: '#2563eb', flexShrink: 0 }} />
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              value={amountFilter}
              onChange={(e) => setAmountFilter(e.target.value)}
              placeholder="Filter Amount (e.g. 500)..."
              style={{
                fontSize: '0.85rem',
                color: 'var(--text-primary)',
                fontWeight: 600,
                backgroundColor: 'transparent',
                border: 'none',
                outline: 'none',
                padding: '0.35rem 0.5rem',
                paddingRight: amountFilter ? '2rem' : '0.5rem',
                width: '100%'
              }}
            />
            {amountFilter && (
              <button
                onClick={() => setAmountFilter('')}
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
                title="Clear Amount Filter"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Clear Date & Amount Filters Button */}
        {(dateFilter || amountFilter || params.u_id) && (
          <button
            onClick={() => {
              setDateFilter('');
              setAmountFilter('');
              setUId('');
            }}
            className="btn btn-secondary btn-sm"
            style={{ color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)', whiteSpace: 'nowrap' }}
          >
            <Filter size={14} />
            <span>Clear Filters</span>
          </button>
        )}

        {/* View Mode Toggle: [ Table ] [ Cards ] */}
        <div className="subscription-view-toggle">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              padding: '0.35rem 0.65rem',
              borderRadius: '0.4rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem'
            }}
            title="Table View"
          >
            <List size={14} />
            <span className="desktop-tab-label">Table</span>
            <span className="mobile-tab-label">Table</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`btn btn-sm ${viewMode === 'cards' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              padding: '0.35rem 0.65rem',
              borderRadius: '0.4rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem'
            }}
            title="Cards View"
          >
            <LayoutGrid size={14} />
            <span className="desktop-tab-label">Cards</span>
            <span className="mobile-tab-label">Cards</span>
          </button>
        </div>
      </div>

      {/* Main Content: Table or Cards Grid */}
      {loading ? (
        <PageLoader
          message="Loading subscription records..."
          subMessage="Tracking subscriber status and renewal schedules"
          minHeight="340px"
          icon={CheckSquare}
        />
      ) : filteredAddresses.length === 0 ? (
        <div className="card" style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: 'var(--text-primary)' }}>
          <Filter size={36} style={{ marginBottom: '0.75rem', opacity: 0.5, color: '#2563eb' }} />
          <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: 700 }}>No Subscription Records Found</h3>
          <p style={{ fontSize: '0.875rem', marginTop: '0.25rem', color: 'var(--text-muted)' }}>
            {activeTab === 'UNSUBSCRIBED'
              ? 'All directory contacts are currently subscribed!'
              : activeTab === 'SUBSCRIBED'
                ? 'No subscribed addresses found for the selected date/amount.'
                : 'Try adjusting your Date or Amount filter.'}
          </p>
        </div>
      ) : viewMode === 'cards' ? (
        /* CARDS GRID VIEW */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
          gap: '1rem',
          boxSizing: 'border-box'
        }}>
          {paginatedAddresses.map((record) => {
            const isSub = Boolean(record.subscription);
            const dateStr = record.subscription_date || (isSub ? '31-Aug-2026' : '-');
            const timeStr = record.subscription_time || (isSub ? '10:35 AM' : '-');
            const amountVal = isSub ? (record.subscription_amount || 500) : 0;
            const fullAddress = [record.door_no, record.address_line_1, record.area, record.city].filter(Boolean).join(', ');

            return (
              <div
                key={record._id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '0.85rem',
                  padding: '1rem',
                  borderRadius: '0.85rem',
                  border: isSub ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer'
                }}
                onClick={() => setSelectedRecord(record)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                }}
              >
                {/* Card Top: U.Id & Subscription Status Pill */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <span style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                    color: 'var(--warning)',
                    fontFamily: 'var(--font-sans)',
                    fontVariantNumeric: 'tabular-nums',
                    fontFeatureSettings: '"zero" 0'
                  }}>
                    {record.u_id || 'ID'}
                  </span>

                  <span
                    className={`badge ${isSub ? 'badge-success' : 'badge-secondary'}`}
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      backgroundColor: isSub ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                      color: isSub ? '#059669' : 'var(--text-muted)',
                      border: `1px solid ${isSub ? 'rgba(16, 185, 129, 0.35)' : 'var(--border-color)'}`
                    }}
                  >
                    {isSub ? '☑ Subscribed' : '☐ Unsubscribed'}
                  </span>
                </div>

                {/* Card Body: Name, Phone & Address */}
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>
                    {record.name}
                  </h3>

                  {record.phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', color: '#2563eb', fontWeight: 600, marginBottom: '0.35rem', fontFamily: 'var(--font-mono)' }}>
                      <Phone size={13} />
                      <span>{record.phone}</span>
                    </div>
                  )}

                  {fullAddress && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                      <MapPin size={13} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {fullAddress}, {record.district} - {record.pincode}
                      </span>
                    </div>
                  )}
                </div>

                {/* Subscription Metadata Box */}
                <div style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: '0.55rem',
                  backgroundColor: isSub ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-secondary)',
                  border: `1px solid ${isSub ? 'rgba(16, 185, 129, 0.25)' : 'var(--border-color)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.8rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 800, color: isSub ? '#059669' : 'var(--text-muted)' }}>
                    <IndianRupee size={14} />
                    <span>{isSub ? `₹${amountVal}` : '₹0'}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                    <Calendar size={13} style={{ color: '#2563eb' }} />
                    <span>{dateStr}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    <Clock size={13} />
                    <span>{timeStr}</span>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  paddingTop: '0.5rem',
                  borderTop: '1px solid var(--border-color)'
                }} onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={(e) => handleQuickSubscribe(record, e)}
                    disabled={subscribingId === record._id}
                    className={`btn btn-sm ${isSub ? 'btn-secondary' : 'btn-primary'}`}
                    style={{
                      flex: 1,
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      padding: '0.4rem 0.6rem',
                      color: isSub ? '#059669' : '#ffffff',
                      borderColor: isSub ? 'rgba(16, 185, 129, 0.35)' : undefined
                    }}
                    title={isSub ? "Click to unsubscribe" : "Click to subscribe"}
                  >
                    {subscribingId === record._id ? (
                      <div className="pulse-loader" />
                    ) : isSub ? (
                      <>
                        <CheckSquare size={14} />
                        <span>Subscribed</span>
                      </>
                    ) : (
                      <>
                        <Square size={14} />
                        <span>Subscribe</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRecord(record)}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.4rem 0.6rem', fontSize: '0.78rem' }}
                    title="View Full Details"
                  >
                    <Eye size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleWhatsAppMessage(record, e)}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.4rem 0.6rem', fontSize: '0.78rem', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.3)' }}
                    title="WhatsApp"
                  >
                    <MessageCircle size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleSmsMessage(record, e)}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.4rem 0.6rem', fontSize: '0.78rem', color: '#3b82f6', borderColor: 'rgba(59, 130, 246, 0.3)' }}
                    title="SMS"
                  >
                    <MessageSquare size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={() => onEditAddress(record)}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.4rem 0.6rem', fontSize: '0.78rem' }}
                    title="Edit Address"
                  >
                    <Edit3 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="card" style={{ padding: 0, overflow: 'hidden', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{
                  borderBottom: '2px solid var(--border-color)',
                  backgroundColor: 'var(--bg-secondary)',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  whiteSpace: 'nowrap'
                }}>
                  <th style={{ padding: '0.75rem 0.6rem', width: '50px', textAlign: 'center', whiteSpace: 'nowrap' }}>S.No</th>
                  <th style={{ padding: '0.75rem 0.6rem', width: '85px', whiteSpace: 'nowrap' }}>U.Id</th>
                  <th style={{ padding: '0.75rem 0.75rem', width: '180px', maxWidth: '200px', whiteSpace: 'nowrap' }}>Name</th>
                  <th style={{ padding: '0.75rem 0.6rem', width: '90px', textAlign: 'center', whiteSpace: 'nowrap' }}>Subscribed</th>
                  <th style={{ padding: '0.75rem 0.6rem', width: '85px', whiteSpace: 'nowrap' }}>Amount</th>
                  <th style={{ padding: '0.75rem 0.6rem', width: '105px', whiteSpace: 'nowrap' }}>Date</th>
                  <th style={{ padding: '0.75rem 0.6rem', width: '95px', whiteSpace: 'nowrap' }}>Time</th>
                  <th style={{ padding: '0.75rem 0.6rem', width: '80px', textAlign: 'center', whiteSpace: 'nowrap' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedAddresses.map((record, index) => {
                  const isSub = Boolean(record.subscription);
                  const dateStr = record.subscription_date || (isSub ? '31-Aug-2026' : '-');
                  const timeStr = record.subscription_time || (isSub ? '10:35 AM' : '-');
                  const amountVal = isSub ? (record.subscription_amount || 500) : 0;
                  const rowNumber = (subPage - 1) * subLimit + index + 1;

                  return (
                    <tr
                      key={record._id}
                      onClick={() => setSelectedRecord(record)}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                        whiteSpace: 'nowrap'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {/* S.No */}
                      <td style={{ padding: '0.75rem 0.6rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {rowNumber}
                      </td>

                      {/* U.Id */}
                      <td style={{ padding: '0.75rem 0.6rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        <span style={{
                          fontSize: '0.8rem',
                          padding: '3px 7px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(245, 158, 11, 0.18)',
                          color: 'var(--warning)',
                          fontFamily: 'var(--font-sans)',
                          fontVariantNumeric: 'tabular-nums',
                          fontFeatureSettings: '"zero" 0',
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                          display: 'inline-block',
                          letterSpacing: '0.5px'
                        }}>
                          {record.u_id || '-'}
                        </span>
                      </td>

                      {/* Name - Minimized & Responsive */}
                      <td style={{
                        padding: '0.75rem 0.75rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        fontSize: '0.88rem',
                        maxWidth: '200px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }} title={record.name}>
                        <span style={{ color: 'var(--text-primary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {record.name}
                        </span>
                      </td>

                      {/* Subscribed (Interactive Checkbox) */}
                      <td style={{ padding: '0.75rem 0.6rem', textAlign: 'center', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSub}
                          disabled={subscribingId === record._id}
                          onChange={(e) => handleQuickSubscribe(record, e)}
                          title={isSub ? "Subscribed" : "Unsubscribed"}
                          style={{
                            width: '18px',
                            height: '18px',
                            cursor: 'pointer',
                            accentColor: '#10b981'
                          }}
                        />
                      </td>

                      {/* Amount */}
                      <td style={{ padding: '0.75rem 0.6rem', fontWeight: 800, color: isSub ? '#10b981' : 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                        {isSub ? `₹${amountVal}` : '-'}
                      </td>

                      {/* Date */}
                      <td style={{ padding: '0.75rem 0.6rem', color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {dateStr}
                      </td>

                      {/* Time */}
                      <td style={{ padding: '0.75rem 0.6rem', color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {timeStr}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '0.75rem 0.6rem', textAlign: 'center', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            onClick={() => setSelectedRecord(record)}
                            className="btn btn-secondary btn-icon"
                            style={{ padding: '0.3rem', borderRadius: '0.35rem' }}
                            title="View Details"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleWhatsAppMessage(record, e)}
                            className="btn btn-secondary btn-icon"
                            style={{ padding: '0.3rem', borderRadius: '0.35rem', color: '#10b981' }}
                            title="Send WhatsApp"
                          >
                            <MessageCircle size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleSmsMessage(record, e)}
                            className="btn btn-secondary btn-icon"
                            style={{ padding: '0.3rem', borderRadius: '0.35rem', color: '#3b82f6' }}
                            title="Send SMS"
                          >
                            <MessageSquare size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditAddress(record)}
                            className="btn btn-secondary btn-icon"
                            style={{ padding: '0.3rem', borderRadius: '0.35rem' }}
                            title="Edit Address"
                          >
                            <Edit3 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Component */}
      {!loading && filteredAddresses.length > 0 && (
        <Pagination
          page={subPage}
          limit={subLimit}
          total={filteredAddresses.length}
          totalPages={subTotalPages}
          onPageChange={setSubPage}
          onLimitChange={setSubLimit}
        />
      )}

      {/* Subscribed Record View Modal */}
      {selectedRecord && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '1rem',
            width: '100%',
            maxWidth: '500px',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: selectedRecord.subscription ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-secondary)'
            }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Subscription Details
                </span>
                <h3 style={{ fontSize: '1.2rem', marginTop: '0.1rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                  {selectedRecord.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0.35rem',
                  borderRadius: '50%'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Name Details */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: selectedRecord.subscription ? 'rgba(16, 185, 129, 0.2)' : 'rgba(37, 99, 235, 0.15)',
                  color: selectedRecord.subscription ? '#10b981' : '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.1rem',
                  fontWeight: 800
                }}>
                  <User size={22} />
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Contact Name:</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {selectedRecord.name}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                    U.Id: {selectedRecord.u_id || '-'} | {selectedRecord.address_line_1 || selectedRecord.street || ''}, {selectedRecord.district || ''}
                  </div>
                </div>
              </div>

              {/* Subscription Card Details */}
              <div style={{
                backgroundColor: selectedRecord.subscription ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-secondary)',
                border: `1px solid ${selectedRecord.subscription ? 'rgba(16, 185, 129, 0.35)' : 'var(--border-color)'}`,
                borderRadius: '0.75rem',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.875rem'
              }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: selectedRecord.subscription ? '#10b981' : '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  Subscription Information
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status:</div>
                    <div style={{ fontWeight: 800, color: selectedRecord.subscription ? '#10b981' : '#ef4444', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      {selectedRecord.subscription ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                      <span>{selectedRecord.subscription ? 'Subscribed' : 'Unsubscribed'}</span>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Amount:</div>
                    <div style={{ fontWeight: 800, color: selectedRecord.subscription ? '#10b981' : 'var(--text-muted)', marginTop: '0.2rem', fontSize: '1rem' }}>
                      {selectedRecord.subscription ? `₹${selectedRecord.subscription_amount || 500}` : '-'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Date:</div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.2rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Calendar size={14} style={{ color: '#3b82f6' }} />
                      <span>{selectedRecord.subscription_date || (selectedRecord.subscription ? '31-Aug-2026' : '-')}</span>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Time:</div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.2rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Clock size={14} style={{ color: '#3b82f6' }} />
                      <span>{selectedRecord.subscription_time || (selectedRecord.subscription ? '10:35 AM' : '-')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              {!selectedRecord.subscription ? (
                <button
                  onClick={() => {
                    handleQuickSubscribe(selectedRecord);
                    setSelectedRecord(prev => ({
                      ...prev,
                      subscription: true,
                      subscription_date: '31-Aug-2026',
                      subscription_time: '10:35 AM',
                      subscription_amount: 500
                    }));
                  }}
                  className="btn btn-primary"
                  style={{ backgroundColor: '#2563eb', fontWeight: 700 }}
                >
                  <CheckSquare size={16} />
                  <span>Mark as Subscribed (₹500)</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    setSelectedRecord(null);
                    if (onEditAddress) onEditAddress(selectedRecord);
                  }}
                  className="btn btn-secondary"
                  style={{ color: 'var(--text-primary)', fontWeight: 600 }}
                >
                  Edit Record
                </button>
              )}

              <button
                onClick={() => setSelectedRecord(null)}
                className="btn btn-secondary"
                style={{ marginLeft: 'auto', color: 'var(--text-primary)', fontWeight: 600 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
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
