import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Calendar, 
  Gift, 
  Heart, 
  MessageCircle, 
  Plus, 
  Search, 
  Filter, 
  Clock, 
  Trash2, 
  Edit, 
  X, 
  Check, 
  Copy, 
  ExternalLink,
  Sparkles,
  Building,
  Store,
  Briefcase,
  AlertCircle,
  Phone,
  User,
  Hash,
  CalendarHeart,
  Bell,
  BellRing,
  CheckCircle2,
  Flame,
  Send,
  LayoutGrid,
  List,
  Save,
  RotateCcw
} from 'lucide-react';
import { 
  fetchImportantDates, 
  createImportantDate, 
  updateImportantDate, 
  deleteImportantDate,
  fetchAddresses 
} from '../services/apiService';
import { 
  scheduleReminders, 
  getActiveInAppReminders, 
  requestNotificationPermission, 
  checkNotificationPermission 
} from '../services/notificationService';
import { Toast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
import { Pagination } from '../components/Pagination';
import { PageLoader } from '../components/PageLoader';

// Helper to format phone for WhatsApp with full UTF-8 Emoji support
function getWhatsAppUrl(phone, message) {
  if (!phone) return '';
  let cleanPhone = phone.replace(/[^\d]/g, '');
  if (cleanPhone.length === 10) {
    cleanPhone = '91' + cleanPhone;
  }
  const encodedText = encodeURIComponent(message || '');
  return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
}

function cleanPersonName(raw) {
  if (!raw) return '';
  let first = raw.split(/[\n,]/)[0].trim();
  first = first.replace(/\s+\d+\/[\w\d]+.*/, '').trim();
  return first || raw;
}

// Helper to generate default greeting message
function generateDefaultGreeting(item) {
  if (!item) return '';
  const rawName = item.name || 'Friend';
  const name = cleanPersonName(rawName);
  const type = (item.type || '').toLowerCase();
  const relation = item.relation ? ` (${item.relation})` : '';
  const contactHead = item.contact_person && item.contact_person !== item.name ? cleanPersonName(item.contact_person) : null;
  
  if (type === 'birthday') {
    if (contactHead) {
      if (item.age) {
        return `Dear ${contactHead}, warm wishes on ${name}'s ${item.age}th Birthday! 🎂🎉 Wishing them wonderful happiness, health, and bright success ahead!`;
      }
      return `Dear ${contactHead}, Happy Birthday to ${name}${relation}! 🎂🎉 Wishing them wonderful joy, good health, and success!`;
    }
    if (item.age) {
      return `Happy Birthday, ${name}! 🎉🎂 Wishing you a wonderful ${item.age}th year ahead filled with happiness, good health, and success!`;
    }
    return `Happy Birthday, ${name}! 🎉🎂 Wishing you a wonderful year ahead filled with joy, happiness, and great success!`;
  }
  
  if (type === 'wedding') {
    if (item.years_completed) {
      return `Happy ${item.years_completed}th Wedding Anniversary, ${name}! 💐💍 Wishing you and your family endless love, happiness, and togetherness!`;
    }
    return `Happy Wedding Anniversary, ${name}! 💐💍 Wishing you both a lifetime of love and togetherness!`;
  }
  
  if (type === 'shop_opening') {
    if (item.years_completed) {
      return `Congratulations on the ${item.years_completed}th Shop Opening Anniversary, ${name}! 🎊🏪 Wishing you huge prosperity, expansion, and great success!`;
    }
    return `Congratulations on your Shop Opening Anniversary, ${name}! 🎊🏪 Wishing you continued success and prosperity!`;
  }
  
  if (type === 'death') {
    return `Remembering and honoring the sacred memory of ${name} on this memorial anniversary. May peace and grace always be with the family. 🕯️🙏`;
  }
  
  if (type === 'business_anniversary') {
    if (item.years_completed) {
      return `Happy ${item.years_completed}th Business Anniversary, ${name}! 🚀💼 Wishing you greater milestones and flourishing success ahead!`;
    }
    return `Happy Business Anniversary, ${name}! 🚀💼 Wishing you greater milestones and flourishing business growth!`;
  }
  
  return `Warmest greetings and best wishes on this special day, ${name}! 🌟`;
}

// Get type label and style
function getTypeMeta(type) {
  switch ((type || '').toLowerCase()) {
    case 'birthday':
      return { label: 'Birthday', iconText: '🎂', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)', icon: Gift };
    case 'wedding':
      return { label: 'Wedding Anniversary', iconText: '💍', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.12)', icon: Heart };
    case 'death':
      return { label: 'Death Anniversary', iconText: '🕯️', color: '#64748b', bg: 'rgba(100, 116, 139, 0.15)', icon: Calendar };
    case 'shop_opening':
      return { label: 'Shop Opening', iconText: '🏪', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', icon: Store };
    case 'business_anniversary':
      return { label: 'Business Anniversary', iconText: '💼', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', icon: Briefcase };
    default:
      return { label: 'Other Special Date', iconText: '📅', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', icon: CalendarHeart };
  }
}

export function ImportantDatesPage({ onNavigate }) {
  // Category Filter Tab: 'ALL' | 'birthday' | 'wedding' | 'death' | 'shop_opening' | 'other'
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Timeframe Filter: 'all' | 'today' | 'tomorrow' | 'this_week' | 'this_month' | 'upcoming'
  const [timeframe, setTimeframe] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Data & Status
  const [allRawDates, setAllRawDates] = useState([]);
  const [datesList, setDatesList] = useState([]);
  const [counts, setCounts] = useState({
    total: 0,
    birthday: 0,
    wedding: 0,
    death: 0,
    shop_opening: 0,
    other: 0,
    today: 0,
    tomorrow: 0,
    upcoming: 0
  });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // View Mode: 'table' | 'grid'
  const [viewMode, setViewMode] = useState(() => {
    return typeof window !== 'undefined' && window.innerWidth < 768 ? 'grid' : 'table';
  });

  // Notification status
  const [notificationEnabled, setNotificationEnabled] = useState(false);

  // Modals
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // WhatsApp Wish Composer Modal
  const [wishModalItem, setWishModalItem] = useState(null);
  const [customWishMessage, setCustomWishMessage] = useState('');
  const [copiedWish, setCopiedWish] = useState(false);

  // Toast
  const [toast, setToast] = useState({ message: '', type: 'success' });

  // Address search suggestions for Add/Edit Modal
  const [addressSearchTerm, setAddressSearchTerm] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [isSearchingAddresses, setIsSearchingAddresses] = useState(false);

  // Form State - Contact Level
  const [contactData, setContactData] = useState({
    u_id: '',
    name: '',
    phone: '',
    address_id: ''
  });

  // Dynamic Array of Dates for Add Modal
  const [dateEntries, setDateEntries] = useState([
    {
      id: 1,
      name: '',
      relation: 'Self',
      phone: '',
      type: 'birthday',
      date: new Date().toISOString().split('T')[0],
      notes: '',
      reminders: [0, 45, 30, 7],
      customEnabled: false,
      customDays: ''
    }
  ]);

  // Editing Single Item Form State
  const [editFormData, setEditFormData] = useState({
    u_id: '',
    name: '',
    relation: 'Self',
    contact_person: '',
    phone: '',
    type: 'birthday',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    reminders: [0, 45, 30, 7],
    customEnabled: false,
    customDays: '',
    address_id: ''
  });

  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Check initial notification permission
  useEffect(() => {
    checkNotificationPermission().then(granted => setNotificationEnabled(granted));
  }, []);

  // Fetch Dates
  const loadDates = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        limit: 1000,
        page: 1
      };

      const res = await fetchImportantDates(params);
      const items = res.items || [];
      setAllRawDates(items);

      // Schedule local notifications for Android / Web
      scheduleReminders(items);

      // Calculate Category Counts
      const newCounts = {
        total: items.length,
        birthday: items.filter(i => i.type === 'birthday').length,
        wedding: items.filter(i => i.type === 'wedding').length,
        death: items.filter(i => i.type === 'death').length,
        shop_opening: items.filter(i => i.type === 'shop_opening').length,
        other: items.filter(i => !['birthday', 'wedding', 'death', 'shop_opening'].includes(i.type)).length,
        today: items.filter(i => i.days_until === 0).length,
        tomorrow: items.filter(i => i.days_until === 1).length,
        upcoming: items.filter(i => i.days_until >= 0 && i.days_until <= 7).length
      };
      setCounts(newCounts);
    } catch (err) {
      console.error('Error fetching important dates:', err);
      setToast({ message: 'Failed to load important dates.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDates();
  }, [loadDates]);

  // Derive active reminders (for today, tomorrow / 1 day before, 7 days before, 30 days, 45 days, custom)
  const activeReminders = useMemo(() => {
    return getActiveInAppReminders(allRawDates);
  }, [allRawDates]);

  // Filtered & Paginated records
  const displayedItems = useMemo(() => {
    let filtered = [...allRawDates];

    // 1. Category Filter
    if (categoryFilter !== 'ALL') {
      if (categoryFilter === 'other') {
        filtered = filtered.filter(i => !['birthday', 'wedding', 'death', 'shop_opening'].includes(i.type));
      } else {
        filtered = filtered.filter(i => (i.type || '').toLowerCase() === categoryFilter.toLowerCase());
      }
    }

    // 2. Timeframe Filter
    if (timeframe === 'today') {
      filtered = filtered.filter(i => i.days_until === 0);
    } else if (timeframe === 'tomorrow') {
      filtered = filtered.filter(i => i.days_until === 1);
    } else if (timeframe === 'this_week') {
      filtered = filtered.filter(i => i.days_until >= 0 && i.days_until <= 7);
    } else if (timeframe === 'this_month') {
      filtered = filtered.filter(i => i.is_this_month);
    } else if (timeframe === 'upcoming') {
      filtered = filtered.filter(i => i.days_until >= 0 && i.days_until <= 30);
    }

    // 3. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(i => 
        (i.name || '').toLowerCase().includes(q) ||
        (i.contact_person || '').toLowerCase().includes(q) ||
        (i.relation || '').toLowerCase().includes(q) ||
        (i.u_id || '').toLowerCase().includes(q) ||
        (i.phone || '').includes(q) ||
        (i.notes || '').toLowerCase().includes(q)
      );
    }

    // Sort by nearest upcoming date
    filtered.sort((a, b) => (a.days_until ?? 999) - (b.days_until ?? 999));

    setTotalCount(filtered.length);
    setTotalPages(Math.ceil(filtered.length / limit) || 1);

    const startIndex = (page - 1) * limit;
    return filtered.slice(startIndex, startIndex + limit);
  }, [allRawDates, categoryFilter, timeframe, searchQuery, page, limit]);

  // Reset page when switching filters
  useEffect(() => {
    setPage(1);
  }, [categoryFilter, timeframe, searchQuery]);

  // Address search debounce for autocomplete
  useEffect(() => {
    if (!addressSearchTerm || addressSearchTerm.trim().length < 2) {
      setAddressSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingAddresses(true);
      try {
        const res = await fetchAddresses({ search: addressSearchTerm.trim(), limit: 5 });
        setAddressSuggestions(res.addresses || []);
      } catch (e) {
        console.warn('Address suggestion error:', e);
      } finally {
        setIsSearchingAddresses(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [addressSearchTerm]);

  // Handle Opening Add Modal
  const handleOpenAddModal = (presetType) => {
    const defaultType = presetType || (categoryFilter !== 'ALL' ? categoryFilter : 'birthday');
    const firstRowId = 'date_row_' + Date.now();
    setEditingItem(null);
    setContactData({
      u_id: '',
      name: '',
      phone: '',
      address_id: ''
    });
    setDateEntries([
      {
        id: firstRowId,
        name: '',
        relation: 'Self',
        phone: '',
        type: defaultType,
        date: new Date().toISOString().split('T')[0],
        notes: '',
        custom_message: '',
        reminders: [0, 45, 30, 7],
        customEnabled: false,
        customDays: ''
      }
    ]);
    setAddressSearchTerm('');
    setAddressSuggestions([]);
    setFormErrors({});
    setIsAddEditOpen(true);

    // Auto-focus on primary contact name or first date name on mobile & desktop
    setTimeout(() => {
      const firstInput = document.getElementById('contact-name-input') || document.getElementById(`date-name-input-${firstRowId}`);
      if (firstInput) {
        firstInput.focus();
      }
    }, 120);
  };

  // Add another date card row to contact in modal & auto-focus cursor into new date name
  const handleAddAnotherDateRow = () => {
    const newId = 'date_row_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    setDateEntries(prev => [
      ...prev,
      {
        id: newId,
        name: '',
        relation: 'Spouse',
        phone: '',
        type: 'birthday',
        date: new Date().toISOString().split('T')[0],
        notes: '',
        custom_message: '',
        reminders: [0, 45, 30, 7],
        customEnabled: false,
        customDays: ''
      }
    ]);

    // Render and immediately move cursor focus to the newly added date's Name input field
    setTimeout(() => {
      const inputEl = document.getElementById(`date-name-input-${newId}`);
      if (inputEl) {
        inputEl.focus();
        inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  // Remove a date card row
  const handleRemoveDateRow = (rowId) => {
    if (dateEntries.length <= 1) {
      setToast({ message: 'At least one date is required.', type: 'warning' });
      return;
    }
    setDateEntries(prev => prev.filter(r => r.id !== rowId));
  };

  // Update a single date row property
  const handleUpdateDateRow = (rowId, key, value) => {
    setDateEntries(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      return { ...row, [key]: value };
    }));
  };

  // Handle Opening Edit Modal
  const handleOpenEditModal = (item) => {
    setEditingItem(item);
    const rems = Array.isArray(item.reminders) ? item.reminders.map(Number) : [0, 45, 30, 7];
    const standardPresets = [0, 45, 30, 7];
    const customVal = rems.find(r => !standardPresets.includes(r));

    setEditFormData({
      u_id: item.u_id || '',
      name: item.name || '',
      relation: item.relation || 'Self',
      contact_person: item.contact_person || item.name || '',
      phone: item.phone || '',
      type: item.type || 'birthday',
      date: item.date || '',
      notes: item.notes || '',
      custom_message: item.custom_message || '',
      reminders: rems,
      customEnabled: customVal !== undefined,
      customDays: customVal !== undefined ? String(customVal) : '',
      address_id: item.address_id || ''
    });
    setAddressSearchTerm('');
    setAddressSuggestions([]);
    setFormErrors({});
    setIsAddEditOpen(true);
  };

  // Handle Form Submit
  const handleSaveForm = async (e) => {
    e.preventDefault();
    const errors = {};

    // In Edit Mode
    if (editingItem) {
      if (!editFormData.name.trim()) errors.name = 'Person / Event Name is required';
      if (!editFormData.date.trim()) errors.date = 'Date is required';

      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return;
      }

      const standardPresets = [0, 45, 30, 7];
      let finalReminders = editFormData.reminders.filter(r => standardPresets.includes(r));
      if (editFormData.customEnabled) {
        const parsedCustom = parseInt(editFormData.customDays, 10);
        if (!isNaN(parsedCustom) && parsedCustom > 0) {
          finalReminders.push(parsedCustom);
        }
      }
      finalReminders = Array.from(new Set(finalReminders));

      const payload = {
        u_id: editFormData.u_id,
        name: editFormData.name,
        relation: editFormData.relation,
        contact_person: editFormData.contact_person || editFormData.name,
        phone: editFormData.phone,
        type: editFormData.type,
        date: editFormData.date,
        notes: editFormData.notes,
        custom_message: editFormData.custom_message,
        address_id: editFormData.address_id,
        reminders: finalReminders
      };

      setFormSubmitting(true);
      try {
        await updateImportantDate(editingItem._id, payload);
        setToast({ message: 'Important date updated successfully!', type: 'success' });
        setIsAddEditOpen(false);
        loadDates();
      } catch (err) {
        setToast({ message: err.message || 'Failed to save record', type: 'error' });
      } finally {
        setFormSubmitting(false);
      }
      return;
    }

    // In Add (Multi-Date) Mode
    if (!contactData.name.trim()) errors.name = 'Primary Family Head / Contact Name is required';

    // Validate date entries
    const invalidDate = dateEntries.find(d => !d.date);
    if (invalidDate) {
      errors.date = 'All added events must have a valid date';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const standardPresets = [0, 45, 30, 7];
    const itemsToSave = dateEntries.map(entry => {
      let finalReminders = (entry.reminders || []).filter(r => standardPresets.includes(r));
      if (entry.customEnabled) {
        const parsed = parseInt(entry.customDays, 10);
        if (!isNaN(parsed) && parsed > 0) finalReminders.push(parsed);
      }
      finalReminders = Array.from(new Set(finalReminders));

      const specificName = (entry.name && entry.name.trim()) ? entry.name.trim() : contactData.name.trim();

      return {
        u_id: contactData.u_id,
        name: specificName,
        relation: entry.relation || 'Self',
        contact_person: contactData.name.trim(),
        phone: (entry.phone && entry.phone.trim()) ? entry.phone.trim() : contactData.phone,
        address_id: contactData.address_id,
        type: entry.type || 'birthday',
        date: entry.date,
        notes: entry.notes || '',
        custom_message: entry.custom_message || '',
        reminders: finalReminders
      };
    });

    setFormSubmitting(true);
    try {
      if (itemsToSave.length === 1) {
        await createImportantDate(itemsToSave[0]);
        setToast({ message: 'Important date added successfully!', type: 'success' });
      } else {
        await createImportantDate({ items: itemsToSave });
        setToast({ message: `All ${itemsToSave.length} important dates added successfully!`, type: 'success' });
      }
      setIsAddEditOpen(false);
      loadDates();
    } catch (err) {
      setToast({ message: err.message || 'Failed to save records', type: 'error' });
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle Delete (Instant Optimistic)
  const handleDeleteConfirm = async () => {
    if (!deletingItem) return;
    const targetId = deletingItem._id;

    // 1. Instantly remove from local lists & close modal
    setIsDeleteOpen(false);
    setDeletingItem(null);
    setAllRawDates(prev => prev.filter(d => d._id !== targetId));
    setDatesList(prev => prev.filter(d => d._id !== targetId));
    setToast({ message: 'Important date deleted successfully!', type: 'success' });

    // 2. Perform API delete in background
    try {
      await deleteImportantDate(targetId);
    } catch (err) {
      setToast({ message: err.message || 'Failed to delete record on server', type: 'error' });
      loadDates();
    }
  };

  const [savingWishMsg, setSavingWishMsg] = useState(false);

  // Handle Open WhatsApp Wish Composer
  const handleOpenWhatsAppWish = (item) => {
    setWishModalItem(item);
    const msg = item.custom_message || generateDefaultGreeting(item);
    setCustomWishMessage(msg);
    setCopiedWish(false);
  };

  // Direct 1-Click WhatsApp Trigger
  const handleDirectWhatsAppSend = (item, e) => {
    if (e) e.stopPropagation();
    if (!item.phone) {
      handleOpenWhatsAppWish(item);
      return;
    }
    const msg = item.custom_message || generateDefaultGreeting(item);
    const url = getWhatsAppUrl(item.phone, msg);
    window.open(url, '_blank');
  };

  // Save customized WhatsApp greeting for this contact/date
  const handleSaveWishMessage = async () => {
    if (!wishModalItem || !wishModalItem._id) return;
    setSavingWishMsg(true);
    try {
      await updateImportantDate(wishModalItem._id, { custom_message: customWishMessage });
      setWishModalItem(prev => prev ? { ...prev, custom_message: customWishMessage } : null);
      setDatesList(prev => prev.map(d => d._id === wishModalItem._id ? { ...d, custom_message: customWishMessage } : d));
      setAllRawDates(prev => prev.map(d => d._id === wishModalItem._id ? { ...d, custom_message: customWishMessage } : d));
      setToast({ message: 'WhatsApp reminder message saved for this contact!', type: 'success' });
    } catch (err) {
      setToast({ message: err.message || 'Failed to save custom message', type: 'error' });
    } finally {
      setSavingWishMsg(false);
    }
  };

  const handleCopyWishMessage = () => {
    if (customWishMessage) {
      navigator.clipboard.writeText(customWishMessage);
      setCopiedWish(true);
      setTimeout(() => setCopiedWish(false), 2500);
    }
  };

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    setNotificationEnabled(granted);
    if (granted) {
      setToast({ message: '🔔 Reminders & Notifications enabled successfully!', type: 'success' });
      scheduleReminders(allRawDates);
      // Trigger a live sample notification in browser
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('🔔 AddressHub Reminders Enabled!', {
            body: 'Your important dates & phone reminders are now actively scheduled.',
            icon: '/favicon.ico'
          });
        } catch (e) {
          // ignore
        }
      }
    } else {
      const isBlocked = typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'denied';
      if (isBlocked) {
        setToast({ 
          message: 'Notifications are blocked in your browser. Click the site settings icon (🔒 / 🎚️) in the address bar and change Notifications to "Allow".', 
          type: 'warning' 
        });
      } else {
        setToast({ message: 'Notification permission was not granted.', type: 'warning' });
      }
    }
  };

  if (loading && (!allRawDates || allRawDates.length === 0)) {
    return (
      <PageLoader 
        message="Loading important dates & reminders..." 
        subMessage="Checking birthdays, anniversaries, and phone reminders" 
        icon={CalendarHeart}
      />
    );
  }

  return (
    <div className="id-page-container">
      {/* Toast Notification */}
      {toast.message && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ message: '', type: 'success' })}
        />
      )}

      {/* Hero Header Banner */}
      <div className="id-hero-banner">
        <div className="id-hero-title-group">
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '0.75rem',
            background: 'var(--accent-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
            flexShrink: 0
          }}>
            <CalendarHeart size={24} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span>Important Dates</span>
              <span className="badge badge-primary" style={{ fontSize: '0.78rem', padding: '0.15rem 0.55rem' }}>
                {counts.total} Records
              </span>
            </h1>
          </div>
        </div>

        <div className="id-hero-actions">
          {!notificationEnabled && (
            <button
              onClick={handleEnableNotifications}
              className="btn btn-secondary"
              style={{
                fontSize: '0.825rem',
                padding: '0.55rem 0.85rem',
                borderRadius: '0.6rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                color: '#2563eb',
                borderColor: 'rgba(37, 99, 235, 0.3)'
              }}
              title="Enable Phone & In-App Notification Reminders"
            >
              <BellRing size={15} />
              <span>Enable Reminders</span>
            </button>
          )}

          <button
            onClick={() => handleOpenAddModal()}
            className="btn btn-primary"
            style={{
              padding: '0.6rem 1.1rem',
              fontWeight: 600,
              fontSize: '0.875rem',
              borderRadius: '0.6rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
            }}
          >
            <Plus size={17} />
            <span>Add Important Date</span>
          </button>
        </div>
      </div>

      {/* Active App Reminders Notification Center Banner */}
      {activeReminders.length > 0 && (
        <div className="id-reminders-box">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: '#e0f2fe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0284c7'
              }}>
                <BellRing size={16} />
              </div>
              <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Active Reminders ({activeReminders.length})
              </span>
            </div>
          </div>

          <div className="id-reminders-grid">
            {activeReminders.map(rem => (
              <div
                key={rem._id}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.65rem',
                  padding: '0.75rem 0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                  <span style={{ fontSize: '1.4rem' }}>{rem.icon}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor: rem.days_until === 0 ? '#10b981' : (rem.days_until === 1 ? '#f59e0b' : '#3b82f6'),
                        color: '#ffffff'
                      }}>
                        {rem.badge}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{rem.display_date}</span>
                    </div>

                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', marginTop: '0.15rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {rem.name}
                    </div>
                  </div>
                </div>

                {rem.days_until === 0 ? (
                  <button
                    onClick={(e) => handleDirectWhatsAppSend(rem, e)}
                    className="btn btn-success"
                    style={{
                      backgroundColor: '#25D366',
                      borderColor: '#25D366',
                      color: '#ffffff',
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      borderRadius: '0.45rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      flexShrink: 0
                    }}
                    title="Send WhatsApp Greeting Today"
                  >
                    <MessageCircle size={14} />
                    <span>Wish</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setSearchQuery(rem.name);
                    }}
                    className="btn btn-secondary"
                    style={{
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      borderRadius: '0.45rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      flexShrink: 0
                    }}
                    title="View & Plan in App"
                  >
                    <Calendar size={14} />
                    <span>View</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Category Tree Tabs: [ All ] [ 🎂 Birthdays ] [ 💍 Wedding ] [ 🕯️ Death ] [ 🏪 Shop Opening ] [ 📅 Other ] */}
      <div className="id-category-tabs-row">
        {/* 1. All */}
        <button
          onClick={() => setCategoryFilter('ALL')}
          className="id-tab-btn"
          style={{
            backgroundColor: categoryFilter === 'ALL' ? '#2563eb' : 'transparent',
            color: categoryFilter === 'ALL' ? '#ffffff' : 'var(--text-secondary)',
            boxShadow: categoryFilter === 'ALL' ? '0 2px 8px rgba(37, 99, 235, 0.3)' : 'none'
          }}
        >
          <CalendarHeart size={15} />
          <span>All ({counts.total})</span>
        </button>

        {/* 2. 🎂 Birthdays */}
        <button
          onClick={() => setCategoryFilter('birthday')}
          className="id-tab-btn"
          style={{
            backgroundColor: categoryFilter === 'birthday' ? '#ec4899' : 'transparent',
            color: categoryFilter === 'birthday' ? '#ffffff' : 'var(--text-secondary)',
            boxShadow: categoryFilter === 'birthday' ? '0 2px 8px rgba(236, 72, 153, 0.3)' : 'none'
          }}
        >
          <span>🎂</span>
          <span>Birthdays ({counts.birthday})</span>
        </button>

        {/* 3. 💍 Wedding */}
        <button
          onClick={() => setCategoryFilter('wedding')}
          className="id-tab-btn"
          style={{
            backgroundColor: categoryFilter === 'wedding' ? '#a855f7' : 'transparent',
            color: categoryFilter === 'wedding' ? '#ffffff' : 'var(--text-secondary)',
            boxShadow: categoryFilter === 'wedding' ? '0 2px 8px rgba(168, 85, 247, 0.3)' : 'none'
          }}
        >
          <span>💍</span>
          <span>Wedding ({counts.wedding})</span>
        </button>

        {/* 4. 🕯️ Death Anniversary */}
        <button
          onClick={() => setCategoryFilter('death')}
          className="id-tab-btn"
          style={{
            backgroundColor: categoryFilter === 'death' ? '#475569' : 'transparent',
            color: categoryFilter === 'death' ? '#ffffff' : 'var(--text-secondary)',
            boxShadow: categoryFilter === 'death' ? '0 2px 8px rgba(71, 85, 105, 0.3)' : 'none'
          }}
        >
          <span>🕯️</span>
          <span>Death ({counts.death})</span>
        </button>

        {/* 5. 🏪 Shop Opening */}
        <button
          onClick={() => setCategoryFilter('shop_opening')}
          className="id-tab-btn"
          style={{
            backgroundColor: categoryFilter === 'shop_opening' ? '#10b981' : 'transparent',
            color: categoryFilter === 'shop_opening' ? '#ffffff' : 'var(--text-secondary)',
            boxShadow: categoryFilter === 'shop_opening' ? '0 2px 8px rgba(168, 85, 247, 0.3)' : 'none'
          }}
        >
          <span>🏪</span>
          <span>Shop Opening ({counts.shop_opening})</span>
        </button>

        {/* 6. 📅 Other */}
        <button
          onClick={() => setCategoryFilter('other')}
          className="id-tab-btn"
          style={{
            backgroundColor: categoryFilter === 'other' ? '#f59e0b' : 'transparent',
            color: categoryFilter === 'other' ? '#ffffff' : 'var(--text-secondary)',
            boxShadow: categoryFilter === 'other' ? '0 2px 8px rgba(245, 158, 11, 0.3)' : 'none'
          }}
        >
          <span>📅</span>
          <span>Other ({counts.other})</span>
        </button>
      </div>

      {/* Filter & Search Bar + View Mode Toggle */}
      <div className="id-filter-bar">
        {/* Search Input + View Mode Toggle */}
        <div className="id-filter-search-row">
          <div className="id-search-box">
            <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search by name, U.Id, phone, notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* View Mode Toggle: Table vs Cards */}
          <div className="id-view-toggle">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', borderRadius: '0.4rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
              title="Table View"
            >
              <List size={14} />
              <span className="desktop-tab-label">Table</span>
              <span className="mobile-tab-label">Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', borderRadius: '0.4rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
              title="Cards Grid View"
            >
              <LayoutGrid size={14} />
              <span className="desktop-tab-label">Cards</span>
              <span className="mobile-tab-label">Cards</span>
            </button>
          </div>
        </div>

        {/* Quick Filter Horizontal Carousel Pills */}
        <div className="id-quick-filters">
          <button
            onClick={() => setTimeframe('all')}
            className={`btn btn-sm ${timeframe === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
          >
            All Dates
          </button>
          <button
            onClick={() => setTimeframe('today')}
            className={`btn btn-sm ${timeframe === 'today' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
          >
            🎉 Today ({counts.today})
          </button>
          <button
            onClick={() => setTimeframe('tomorrow')}
            className={`btn btn-sm ${timeframe === 'tomorrow' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
          >
            🔔 Tomorrow ({counts.tomorrow})
          </button>
          <button
            onClick={() => setTimeframe('this_week')}
            className={`btn btn-sm ${timeframe === 'this_week' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
          >
            🗓️ In 7 Days ({counts.upcoming})
          </button>
          <button
            onClick={() => setTimeframe('this_month')}
            className={`btn btn-sm ${timeframe === 'this_month' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
          >
            📅 This Month
          </button>
        </div>
      </div>

      {/* Main Content: Cards Grid or Table View */}
      {displayedItems.length === 0 ? (
        <div className="card" style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
          <CalendarHeart size={44} style={{ color: 'var(--text-muted)', margin: '0 auto 0.75rem auto', opacity: 0.5 }} />
          <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.4rem 0' }}>No Important Dates Found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 1.25rem 0' }}>
            No records match the selected category or filter.
          </p>
          <button onClick={() => handleOpenAddModal()} className="btn btn-primary btn-sm">
            <Plus size={15} /> Add New Date
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* Cards Grid View (Matching Subscription Page Sleek Direct Card UI) */
        <div className="id-cards-grid">
          {displayedItems.map(item => {
            const meta = getTypeMeta(item.type);
            const isToday = item.days_until === 0;
            const isTomorrow = item.days_until === 1;
            const reminders = Array.isArray(item.reminders) ? item.reminders.map(Number) : [0, 45, 30, 7];

            return (
              <div
                key={item._id}
                className="card id-date-card"
                style={{
                  border: isToday ? '1px solid rgba(16, 185, 129, 0.45)' : isTomorrow ? '1px solid rgba(245, 158, 11, 0.45)' : '1px solid var(--border-color)',
                  boxShadow: isToday ? '0 4px 14px rgba(16, 185, 129, 0.12)' : 'var(--shadow-sm)'
                }}
              >
                {/* Card Top: U.Id Badge + Category & Status Pill (Like Subscription Page) */}
                <div className="id-card-top">
                  <span style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(37, 99, 235, 0.15)',
                    color: '#2563eb',
                    fontFamily: 'var(--font-sans)',
                    fontVariantNumeric: 'tabular-nums',
                    fontFeatureSettings: '"zero" 0'
                  }}>
                    {item.u_id || 'ID'}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.2rem 0.55rem',
                      borderRadius: '999px',
                      backgroundColor: meta.bg,
                      color: meta.color,
                      fontSize: '0.75rem',
                      fontWeight: 700
                    }}>
                      <span>{meta.iconText}</span>
                      <span>{meta.label}</span>
                    </span>

                    {isToday ? (
                      <span className="badge badge-success" style={{ backgroundColor: '#10b981', color: '#ffffff', fontWeight: 800, fontSize: '0.72rem', padding: '0.2rem 0.55rem' }}>
                        🎉 Today!
                      </span>
                    ) : isTomorrow ? (
                      <span style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#d97706', fontWeight: 800, fontSize: '0.72rem', padding: '2px 6px', borderRadius: '4px' }}>
                        🔔 Tomorrow
                      </span>
                    ) : item.days_until !== undefined && item.days_until <= 7 ? (
                      <span style={{ backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#2563eb', fontWeight: 700, fontSize: '0.72rem', padding: '2px 6px', borderRadius: '4px' }}>
                        In {item.days_until}d
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Card Body: Name, Relation, Phone */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                      {item.name}
                    </h3>
                    {item.relation && (
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor: item.relation === 'Self' ? 'rgba(37, 99, 235, 0.1)' : 'rgba(168, 85, 247, 0.12)',
                        color: item.relation === 'Self' ? '#2563eb' : '#7c3aed'
                      }}>
                        {item.relation}
                      </span>
                    )}
                  </div>

                  {item.phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', color: '#2563eb', fontWeight: 600, marginBottom: '0.35rem', fontFamily: 'var(--font-mono)' }}>
                      <Phone size={13} />
                      <a href={`tel:${item.phone}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        {item.phone}
                      </a>
                    </div>
                  )}
                </div>

                {/* Metadata Box (Identical Sleek 3-Column Layout to Subscription Page) */}
                <div className="id-metadata-box" style={{
                  backgroundColor: isToday ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-secondary)',
                  borderColor: isToday ? 'rgba(16, 185, 129, 0.25)' : 'var(--border-color)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 800, color: meta.color, whiteSpace: 'nowrap' }}>
                    <span>{item.age !== undefined && item.age !== null ? `${item.age}th ${meta.label}` : item.years_completed !== undefined && item.years_completed !== null && item.type !== 'birthday' ? `${item.years_completed}th Yr` : meta.label}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', justifyContent: 'center' }}>
                    <Calendar size={13} style={{ color: '#2563eb', flexShrink: 0 }} />
                    <span>{item.display_date || item.date}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', justifyContent: 'flex-end' }}>
                    <Clock size={13} style={{ flexShrink: 0 }} />
                    <span>{isToday ? 'Today!' : isTomorrow ? 'Tomorrow' : item.days_until !== undefined ? `${item.days_until}d left` : '-'}</span>
                  </div>
                </div>

                {/* Reminders Chips & Notes */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap', marginBottom: item.notes ? '0.35rem' : 0 }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginRight: '0.15rem' }}>Reminders:</span>
                    {reminders.includes(0) && <span style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: '3px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontWeight: 600 }}>Today</span>}
                    {reminders.includes(45) && <span style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: '3px', backgroundColor: 'rgba(139, 92, 246, 0.12)', color: '#7c3aed', fontWeight: 600 }}>45d</span>}
                    {reminders.includes(30) && <span style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: '3px', backgroundColor: 'rgba(99, 102, 241, 0.12)', color: '#4f46e5', fontWeight: 600 }}>30d</span>}
                    {reminders.includes(7) && <span style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: '3px', backgroundColor: 'rgba(37, 99, 235, 0.12)', color: '#2563eb', fontWeight: 600 }}>7d</span>}
                    {reminders.filter(r => ![0, 45, 30, 7].includes(r)).map(cust => (
                      <span key={cust} style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: '3px', backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#059669', fontWeight: 600 }}>{cust}d</span>
                    ))}
                  </div>

                  {item.notes && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontStyle: 'italic', backgroundColor: 'var(--bg-secondary)', padding: '0.3rem 0.5rem', borderRadius: '0.4rem' }}>
                      "{item.notes}"
                    </div>
                  )}
                </div>

                {/* Card Actions Footer: 100% Fit & No Overflow */}
                <div className="id-card-actions">
                  <button
                    type="button"
                    onClick={(e) => handleDirectWhatsAppSend(item, e)}
                    className="btn btn-success btn-sm"
                    style={{
                      backgroundColor: '#25D366',
                      borderColor: '#25D366',
                      color: '#ffffff',
                      padding: '0.4rem 0.6rem',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      borderRadius: '0.45rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.3rem',
                      flex: 2,
                      minWidth: 0,
                      whiteSpace: 'nowrap'
                    }}
                    title="Direct WhatsApp Chat"
                  >
                    <MessageCircle size={14} style={{ flexShrink: 0 }} />
                    <span>Wish</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenWhatsAppWish(item)}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.4rem 0.55rem', fontSize: '0.78rem', borderRadius: '0.45rem', flex: 1, minWidth: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Customize & Preview WhatsApp Greeting"
                  >
                    <Sparkles size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(item)}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.4rem 0.55rem', fontSize: '0.78rem', borderRadius: '0.45rem', flex: 1, minWidth: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Edit Record"
                  >
                    <Edit size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDeletingItem(item);
                      setIsDeleteOpen(true);
                    }}
                    className="btn btn-danger btn-sm"
                    style={{ padding: '0.4rem 0.55rem', fontSize: '0.78rem', borderRadius: '0.45rem', flex: 1, minWidth: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Delete Record"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="id-table-container">
            <table className="id-table table">
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '0.85rem 1rem', width: '90px' }}>U.Id</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Name & Contact</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Category</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Date & Countdown</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Reminders Config</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Notes</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>WhatsApp Wish</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedItems.map(item => {
                  const meta = getTypeMeta(item.type);
                  const Icon = meta.icon;
                  const isToday = item.days_until === 0;
                  const isTomorrow = item.days_until === 1;
                  const reminders = Array.isArray(item.reminders) ? item.reminders.map(Number) : [0, 1, 7];

                  return (
                    <tr key={item._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      {/* U.Id */}
                      <td style={{ padding: '0.85rem 1rem', fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"zero" 0', fontWeight: 700, color: 'var(--accent-primary)' }}>
                        {item.u_id || '—'}
                      </td>

                      {/* Name & Contact */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                            {item.name}
                          </span>
                          {item.relation && (
                            <span style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: '4px',
                              backgroundColor: item.relation === 'Self' ? 'rgba(37, 99, 235, 0.1)' : 'rgba(168, 85, 247, 0.12)',
                              color: item.relation === 'Self' ? '#2563eb' : '#7c3aed'
                            }}>
                              {item.relation}
                            </span>
                          )}
                        </div>
                        {item.phone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                            <Phone size={12} />
                            <span>{item.phone}</span>
                          </div>
                        )}
                      </td>

                      {/* Category Badge */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.25rem 0.65rem',
                          borderRadius: '999px',
                          backgroundColor: meta.bg,
                          color: meta.color,
                          fontSize: '0.8rem',
                          fontWeight: 700
                        }}>
                          <span>{meta.iconText}</span>
                          <span>{meta.label}</span>
                        </span>
                      </td>

                      {/* Date & Countdown */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                            {item.display_date || item.date}
                          </span>

                          {isToday ? (
                            <span className="badge badge-success" style={{ backgroundColor: '#10b981', color: '#ffffff', fontWeight: 800, fontSize: '0.72rem' }}>
                              🎉 Today!
                            </span>
                          ) : isTomorrow ? (
                            <span style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#d97706', fontWeight: 800, fontSize: '0.72rem', padding: '1px 6px', borderRadius: '4px' }}>
                              🔔 Tomorrow
                            </span>
                          ) : item.days_until !== undefined && item.days_until <= 7 ? (
                            <span style={{ backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#2563eb', fontWeight: 700, fontSize: '0.72rem', padding: '1px 6px', borderRadius: '4px' }}>
                              In {item.days_until} days
                            </span>
                          ) : null}
                        </div>

                        {item.age !== undefined && item.age !== null && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 600, marginTop: '0.1rem' }}>
                            {item.age}th Birthday
                          </div>
                        )}
                        {item.years_completed !== undefined && item.years_completed !== null && item.type !== 'birthday' && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                            {item.years_completed}th year milestone
                          </div>
                        )}
                      </td>

                      {/* Reminders Config */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                          {reminders.includes(0) && (
                            <span style={{ fontSize: '0.7rem', padding: '1px 5px', borderRadius: '3px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                              Today
                            </span>
                          )}
                          {reminders.includes(45) && (
                            <span style={{ fontSize: '0.7rem', padding: '1px 5px', borderRadius: '3px', backgroundColor: 'rgba(139, 92, 246, 0.12)', color: '#7c3aed' }}>
                              45d
                            </span>
                          )}
                          {reminders.includes(30) && (
                            <span style={{ fontSize: '0.7rem', padding: '1px 5px', borderRadius: '3px', backgroundColor: 'rgba(99, 102, 241, 0.12)', color: '#4f46e5' }}>
                              30d
                            </span>
                          )}
                          {reminders.includes(7) && (
                            <span style={{ fontSize: '0.7rem', padding: '1px 5px', borderRadius: '3px', backgroundColor: 'rgba(37, 99, 235, 0.12)', color: '#2563eb' }}>
                              7d
                            </span>
                          )}
                          {reminders.filter(r => ![0, 45, 30, 7].includes(r)).map(cust => (
                            <span key={cust} style={{ fontSize: '0.7rem', padding: '1px 5px', borderRadius: '3px', backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#059669' }}>
                              {cust}d
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Notes */}
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                        {item.notes || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>

                      {/* WhatsApp Wish Button */}
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          <button
                            onClick={(e) => handleDirectWhatsAppSend(item, e)}
                            className="btn btn-success"
                            style={{
                              backgroundColor: '#25D366',
                              borderColor: '#25D366',
                              color: '#ffffff',
                              padding: '0.35rem 0.75rem',
                              fontSize: '0.82rem',
                              fontWeight: 700,
                              borderRadius: '0.45rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              boxShadow: '0 2px 8px rgba(37, 211, 102, 0.3)'
                            }}
                            title="Directly launch WhatsApp chat"
                          >
                            <MessageCircle size={15} />
                            <span>WhatsApp</span>
                          </button>

                          <button
                            onClick={() => handleOpenWhatsAppWish(item)}
                            className="btn btn-secondary btn-icon"
                            style={{ padding: '0.35rem', borderRadius: '0.45rem' }}
                            title="Preview & customize greeting message"
                          >
                            <Sparkles size={14} />
                          </button>
                        </div>
                      </td>

                      {/* Edit / Delete Actions */}
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.35rem' }}>
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="btn btn-secondary btn-icon"
                            style={{ padding: '0.35rem', borderRadius: '0.4rem' }}
                            title="Edit Record"
                          >
                            <Edit size={15} />
                          </button>
                          <button
                            onClick={() => {
                              setDeletingItem(item);
                              setIsDeleteOpen(true);
                            }}
                            className="btn btn-danger btn-icon"
                            style={{ padding: '0.35rem', borderRadius: '0.4rem' }}
                            title="Delete Record"
                          >
                            <Trash2 size={15} />
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ padding: '0.75rem 0', marginTop: '0.5rem' }}>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(newPage) => setPage(newPage)}
            totalItems={totalCount}
            itemsPerPage={limit}
            onLimitChange={(newLimit) => {
              setLimit(newLimit);
              setPage(1);
            }}
          />
        </div>
      )}


      {/* WhatsApp Wish Preview & Composer Modal */}
      {wishModalItem && (
        <div className="modal-overlay" onClick={() => setWishModalItem(null)}>
          <div
            className="modal-content id-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '580px', borderRadius: '1rem' }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '0.75rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.4rem' }}>{getTypeMeta(wishModalItem.type).iconText}</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                    Wish {cleanPersonName(wishModalItem.name)}
                  </h3>
                  {wishModalItem.phone && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      📱 {wishModalItem.phone}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setWishModalItem(null)}
                className="btn btn-secondary btn-icon"
                style={{ padding: '0.35rem' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Template Presets Bar */}
            <div style={{ marginBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <label style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Greeting Message Text:
                </label>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Set & save message in free time
                </span>
              </div>

              {/* Preset Chips Carousel */}
              <div style={{
                display: 'flex',
                gap: '0.35rem',
                overflowX: 'auto',
                paddingBottom: '0.4rem',
                marginBottom: '0.5rem',
                WebkitOverflowScrolling: 'touch'
              }}>
                <button
                  type="button"
                  onClick={() => {
                    const cName = cleanPersonName(wishModalItem.name);
                    setCustomWishMessage(`அன்புள்ள ${cName}, இனிய பிறந்தநாள் நல்வாழ்த்துகள்! 🎂🎉 நல்ல ஆரோக்கியம், நீண்ட ஆயுள், அளவற்ற மகிழ்ச்சி மற்றும் அனைத்து வெற்றிகளும் கிடைக்க மனமார வாழ்த்துகிறோம்! 🌟`);
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', flexShrink: 0, borderRadius: '999px' }}
                >
                  🎂 பிறந்தநாள் (Tamil)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const cName = cleanPersonName(wishModalItem.name);
                    setCustomWishMessage(`Dear ${cName}, Happy Birthday! 🎂🎉 Wishing you wonderful happiness, good health, and bright success in the year ahead! 🌟`);
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', flexShrink: 0, borderRadius: '999px' }}
                >
                  🎂 Birthday (Eng)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const cName = cleanPersonName(wishModalItem.name);
                    setCustomWishMessage(`Dear ${cName}, Happy Wedding Anniversary! 💐💍 Wishing you and your family endless love, happiness, peace, and togetherness! ✨`);
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', flexShrink: 0, borderRadius: '999px' }}
                >
                  💐 திருமண நாள்
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const cName = cleanPersonName(wishModalItem.name);
                    setCustomWishMessage(`Congratulations on the Shop Opening Anniversary, ${cName}! 🎊🏪 Wishing you huge prosperity, expansion, and flourishing business growth! 🚀💼`);
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', flexShrink: 0, borderRadius: '999px' }}
                >
                  🏪 Shop Opening
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const cName = cleanPersonName(wishModalItem.name);
                    setCustomWishMessage(`அன்புள்ள ${cName}, எங்களின் மனமார்ந்த நல்வாழ்த்துகள்! எப்பொழுதும் நலமுடன் வாழ இறைவனை பிரார்த்திக்கிறோம். 🙏✨`);
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', flexShrink: 0, borderRadius: '999px' }}
                >
                  🙏 நல்வாழ்த்துகள்
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCustomWishMessage(generateDefaultGreeting(wishModalItem));
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', flexShrink: 0, borderRadius: '999px', color: '#2563eb' }}
                  title="Reset to default computed template"
                >
                  <RotateCcw size={12} /> Reset
                </button>
              </div>

              <textarea
                value={customWishMessage}
                onChange={(e) => setCustomWishMessage(e.target.value)}
                rows={5}
                placeholder="Type your custom WhatsApp reminder greeting here..."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '0.6rem',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  lineHeight: 1.5,
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Actions: Save for Free Time, Copy Text, Close, Send */}
            <div className="modal-actions-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.65rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleSaveWishMessage}
                  disabled={savingWishMsg}
                  className="btn btn-primary"
                  style={{ fontSize: '0.825rem', backgroundColor: '#2563eb' }}
                  title="Save this text into record for future reminders"
                >
                  {savingWishMsg ? <div className="pulse-loader" /> : <Save size={15} />}
                  <span>{savingWishMsg ? 'Saving...' : 'Save Message'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyWishMessage}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.825rem' }}
                >
                  {copiedWish ? <Check size={15} color="var(--success)" /> : <Copy size={15} />}
                  <span>{copiedWish ? 'Copied!' : 'Copy Text'}</span>
                </button>
              </div>

              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setWishModalItem(null)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.825rem' }}
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!wishModalItem.phone) {
                      alert('Please provide a phone number for this contact first.');
                      return;
                    }
                    const url = getWhatsAppUrl(wishModalItem.phone, customWishMessage);
                    window.open(url, '_blank');
                    setWishModalItem(null);
                  }}
                  className="btn btn-success"
                  style={{
                    backgroundColor: '#25D366',
                    borderColor: '#25D366',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.825rem',
                    boxShadow: '0 4px 12px rgba(37, 211, 102, 0.4)'
                  }}
                >
                  <MessageCircle size={15} />
                  <span>Open WhatsApp</span>
                  <ExternalLink size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Important Date Modal */}
      {isAddEditOpen && (
        <div className="modal-overlay" onClick={() => setIsAddEditOpen(false)}>
          <div
            className="modal-content id-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '560px', borderRadius: '1rem' }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.25rem',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '0.75rem'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                {editingItem ? 'Edit Important Date' : 'Add Important Date'}
              </h3>
              <button
                onClick={() => setIsAddEditOpen(false)}
                className="btn btn-secondary btn-icon"
                style={{ padding: '0.35rem' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveForm} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Quick Link from Address */}
              {!editingItem && (
                <div style={{
                  padding: '0.85rem',
                  backgroundColor: 'var(--bg-card-hover)',
                  borderRadius: '0.6rem',
                  border: '1px solid var(--border-color)'
                }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    🔗 Quick Link from Address (Auto-populates U.Id, Name & Phone):
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      placeholder="Type person name, U.ID, or phone to auto-fill..."
                      value={addressSearchTerm}
                      onChange={(e) => setAddressSearchTerm(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.45rem 0.75rem',
                        borderRadius: '0.4rem',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-input)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        outline: 'none'
                      }}
                    />
                    {isSearchingAddresses && (
                      <span style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Searching...
                      </span>
                    )}

                    {addressSuggestions.length > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 100,
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '0.4rem',
                        marginTop: '0.2rem',
                        boxShadow: 'var(--shadow-md)',
                        maxHeight: '160px',
                        overflowY: 'auto'
                      }}>
                        {addressSuggestions.map(addr => (
                          <div
                            key={addr._id}
                            onClick={() => {
                              setContactData({
                                u_id: addr.u_id || '',
                                name: addr.name || '',
                                phone: addr.phone || '',
                                address_id: addr._id || ''
                              });
                              setAddressSearchTerm('');
                              setAddressSuggestions([]);
                            }}
                            style={{
                              padding: '0.5rem 0.75rem',
                              cursor: 'pointer',
                              borderBottom: '1px solid var(--border-color)',
                              fontSize: '0.82rem'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <span style={{ fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"zero" 0', fontWeight: 700, color: 'var(--accent-primary)', marginRight: '0.4rem' }}>
                              [{addr.u_id || 'ID'}]
                            </span>
                            <strong>{addr.name}</strong> • {addr.phone || 'No phone'} ({addr.district || addr.city || ''})
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Contact Information (U.Id, Name, Phone) */}
              {editingItem ? (
                /* EDIT MODE SINGLE RECORD CONTACT HEADER */
                <>
                  <div className="id-form-row-uid-name">
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                        U.Id
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. T-0001"
                        value={editFormData.u_id}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, u_id: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '0.55rem 0.75rem',
                          borderRadius: '0.5rem',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-input)',
                          color: 'var(--text-primary)',
                          fontSize: '0.9rem',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 600,
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>

                  <div className="id-form-row-2col">
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                        Person / Milestone Name <span style={{ color: 'var(--danger)' }}>*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Arun Kumar / Rahul"
                        value={editFormData.name}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '0.55rem 0.75rem',
                          borderRadius: '0.5rem',
                          border: formErrors.name ? '1px solid var(--danger)' : '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-input)',
                          color: 'var(--text-primary)',
                          fontSize: '0.9rem',
                          outline: 'none'
                        }}
                      />
                      {formErrors.name && (
                        <span style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.2rem', display: 'block' }}>
                          {formErrors.name}
                        </span>
                      )}
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                        Relation to Family Head
                      </label>
                      <select
                        value={editFormData.relation || 'Self'}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, relation: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '0.55rem 0.75rem',
                          borderRadius: '0.5rem',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-input)',
                          color: 'var(--text-primary)',
                          fontSize: '0.9rem',
                          fontWeight: 600,
                          outline: 'none'
                        }}
                      >
                        <option value="Self">👤 Self (Family Head)</option>
                        <option value="Wife">💍 Wife</option>
                        <option value="Husband">💍 Husband</option>
                        <option value="Spouse">💍 Spouse</option>
                        <option value="Son">👦 Son</option>
                        <option value="Daughter">👧 Daughter</option>
                        <option value="Father">👴 Father</option>
                        <option value="Mother">👵 Mother</option>
                        <option value="Brother">👨 Brother</option>
                        <option value="Sister">👩 Sister</option>
                        <option value="Business">🏪 Business / Shop</option>
                        <option value="Other">🌟 Other Relation</option>
                      </select>
                    </div>
                  </div>

                  <div className="id-form-row-2col">
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                        Family Head Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Arun Kumar"
                        value={editFormData.contact_person}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, contact_person: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '0.55rem 0.75rem',
                          borderRadius: '0.5rem',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-input)',
                          color: 'var(--text-primary)',
                          fontSize: '0.9rem',
                          outline: 'none'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                        Phone Number (for WhatsApp)
                      </label>
                      <input
                        type="tel"
                        placeholder="e.g. 9876543210"
                        value={editFormData.phone}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, phone: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '0.55rem 0.75rem',
                          borderRadius: '0.5rem',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-input)',
                          color: 'var(--text-primary)',
                          fontSize: '0.9rem',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>

                  {/* Single Date Edit Fields */}
                  <div className="id-form-row-2col">
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                        Date Type <span style={{ color: 'var(--danger)' }}>*</span>
                      </label>
                      <select
                        value={editFormData.type}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, type: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '0.55rem 0.75rem',
                          borderRadius: '0.5rem',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-input)',
                          color: 'var(--text-primary)',
                          fontSize: '0.9rem',
                          fontWeight: 600,
                          outline: 'none'
                        }}
                      >
                        <option value="birthday">🎂 Birthday</option>
                        <option value="wedding">💍 Wedding Anniversary</option>
                        <option value="death">🕯️ Death Anniversary</option>
                        <option value="shop_opening">🏪 Shop Opening</option>
                        <option value="business_anniversary">💼 Business Anniversary</option>
                        <option value="other">📅 Other</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                        Date <span style={{ color: 'var(--danger)' }}>*</span>
                      </label>
                      <input
                        type="date"
                        value={editFormData.date}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, date: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '0.55rem 0.75rem',
                          borderRadius: '0.5rem',
                          border: formErrors.date ? '1px solid var(--danger)' : '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-input)',
                          color: 'var(--text-primary)',
                          fontSize: '0.9rem',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>

                  {/* Edit Reminders */}
                  <div style={{
                    padding: '0.85rem 1rem',
                    backgroundColor: 'var(--bg-card-hover)',
                    borderRadius: '0.6rem',
                    border: '1.5px solid #38bdf8'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.55rem' }}>
                      <Bell size={16} style={{ color: '#0284c7' }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        Phone & In-App Reminders:
                      </span>
                    </div>

                    <div className="id-reminders-checkbox-grid">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={editFormData.reminders.includes(0)}
                          onChange={(e) => {
                            const val = 0;
                            setEditFormData(prev => ({
                              ...prev,
                              reminders: e.target.checked
                                ? [...prev.reminders, val]
                                : prev.reminders.filter(r => r !== val)
                            }));
                          }}
                        />
                        <span>☑ On the Day (9:00 AM)</span>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={editFormData.reminders.includes(45)}
                          onChange={(e) => {
                            const val = 45;
                            setEditFormData(prev => ({
                              ...prev,
                              reminders: e.target.checked
                                ? [...prev.reminders, val]
                                : prev.reminders.filter(r => r !== val)
                            }));
                          }}
                        />
                        <span>☑ 45 days before</span>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={editFormData.reminders.includes(30)}
                          onChange={(e) => {
                            const val = 30;
                            setEditFormData(prev => ({
                              ...prev,
                              reminders: e.target.checked
                                ? [...prev.reminders, val]
                                : prev.reminders.filter(r => r !== val)
                            }));
                          }}
                        />
                        <span>☑ 30 days before</span>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={editFormData.reminders.includes(7)}
                          onChange={(e) => {
                            const val = 7;
                            setEditFormData(prev => ({
                              ...prev,
                              reminders: e.target.checked
                                ? [...prev.reminders, val]
                                : prev.reminders.filter(r => r !== val)
                            }));
                          }}
                        />
                        <span>☑ 7 days before</span>
                      </label>
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      borderTop: '1px dashed #bae6fd',
                      paddingTop: '0.5rem',
                      marginTop: '0.4rem'
                    }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={editFormData.customEnabled}
                          onChange={(e) => setEditFormData(prev => ({ ...prev, customEnabled: e.target.checked }))}
                        />
                        <span>Custom Reminder:</span>
                      </label>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <input
                          type="number"
                          min="1"
                          max="365"
                          placeholder="e.g. 75"
                          value={editFormData.customDays}
                          onChange={(e) => setEditFormData(prev => ({ ...prev, customDays: e.target.value, customEnabled: true }))}
                          disabled={!editFormData.customEnabled}
                          style={{
                            width: '75px',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '0.35rem',
                            border: '1px solid var(--border-color)',
                            backgroundColor: editFormData.customEnabled ? 'var(--bg-input)' : 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            textAlign: 'center'
                          }}
                        />
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>days before</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                      Notes / Description
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 40th Birthday celebration, etc."
                      value={editFormData.notes}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, notes: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-input)',
                        color: 'var(--text-primary)',
                        fontSize: '0.9rem',
                        outline: 'none'
                      }}
                    />
                  </div>
                </>
              ) : (
                /* ADD MODE: MULTI-DATES BUILDER FOR ONE CONTACT / U.ID */
                <>
                  <div className="id-form-row-uid-name">
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                        U.Id
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. T-0030"
                        value={contactData.u_id}
                        onChange={(e) => setContactData(prev => ({ ...prev, u_id: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '0.55rem 0.75rem',
                          borderRadius: '0.5rem',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-input)',
                          color: 'var(--text-primary)',
                          fontSize: '0.9rem',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 600,
                          outline: 'none'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                        Full Name / Primary Contact <span style={{ color: 'var(--danger)' }}>*</span>
                      </label>
                      <input
                        id="contact-name-input"
                        type="text"
                        placeholder="e.g. Arun Kumar"
                        value={contactData.name}
                        onChange={(e) => setContactData(prev => ({ ...prev, name: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '0.55rem 0.75rem',
                          borderRadius: '0.5rem',
                          border: formErrors.name ? '1px solid var(--danger)' : '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-input)',
                          color: 'var(--text-primary)',
                          fontSize: '0.9rem',
                          outline: 'none'
                        }}
                      />
                      {formErrors.name && (
                        <span style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.2rem', display: 'block' }}>
                          {formErrors.name}
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                      Phone Number (for WhatsApp)
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. 9876543210"
                      value={contactData.phone}
                      onChange={(e) => setContactData(prev => ({ ...prev, phone: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-input)',
                        color: 'var(--text-primary)',
                        fontSize: '0.9rem',
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* Dynamic Date Entries List */}
                  <div style={{ marginTop: '0.75rem' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0.65rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <CalendarHeart size={18} style={{ color: 'var(--accent-primary)' }} />
                        <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                          Important Dates ({dateEntries.length})
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={handleAddAnotherDateRow}
                        className="btn btn-primary btn-sm"
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          padding: '0.35rem 0.75rem',
                          borderRadius: '0.5rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}
                        title="Add another milestone date for this contact"
                      >
                        <Plus size={15} />
                        <span>Add Date</span>
                      </button>
                    </div>

                    {/* Render Date Cards */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      {dateEntries.map((entry, index) => (
                        <div key={entry.id} className="id-multi-date-item">
                          <div className="id-multi-date-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                              <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--accent-primary)' }}>
                                📅 Date #{index + 1}
                              </span>
                              {entry.relation && (
                                <span className="badge badge-primary" style={{ fontSize: '0.72rem', padding: '2px 7px' }}>
                                  {entry.relation}
                                </span>
                              )}
                            </div>

                            {dateEntries.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveDateRow(entry.id)}
                                className="btn btn-secondary btn-sm"
                                title="Cancel / Remove this date"
                                style={{
                                  color: 'var(--danger)',
                                  borderColor: 'rgba(239, 68, 68, 0.4)',
                                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                                  padding: '0.25rem 0.55rem',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  borderRadius: '0.45rem'
                                }}
                              >
                                <X size={14} />
                                <span>Cancel Date</span>
                              </button>
                            )}
                          </div>

                          {/* Row 1: Person / Milestone Name and Relation */}
                          <div className="id-form-row-2col" style={{ marginBottom: '0.65rem' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                                Person / Event Name <span style={{ color: 'var(--danger)' }}>*</span>
                              </label>
                              <input
                                id={`date-name-input-${entry.id}`}
                                type="text"
                                placeholder={`e.g. ${contactData.name ? contactData.name + ' / Member' : 'Priya / Rahul'}`}
                                value={entry.name}
                                onChange={(e) => handleUpdateDateRow(entry.id, 'name', e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '0.5rem 0.7rem',
                                  borderRadius: '0.45rem',
                                  border: '1px solid var(--border-color)',
                                  backgroundColor: 'var(--bg-input)',
                                  color: 'var(--text-primary)',
                                  fontSize: '0.875rem',
                                  fontWeight: 600,
                                  outline: 'none'
                                }}
                              />
                            </div>

                            <div>
                              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                                Relation to Family Head
                              </label>
                              <select
                                value={entry.relation || 'Self'}
                                onChange={(e) => handleUpdateDateRow(entry.id, 'relation', e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '0.5rem 0.7rem',
                                  borderRadius: '0.45rem',
                                  border: '1px solid var(--border-color)',
                                  backgroundColor: 'var(--bg-input)',
                                  color: 'var(--text-primary)',
                                  fontSize: '0.875rem',
                                  fontWeight: 600,
                                  outline: 'none'
                                }}
                              >
                                <option value="Self">👤 Self (Family Head)</option>
                                <option value="Wife">💍 Wife</option>
                                <option value="Husband">💍 Husband</option>
                                <option value="Spouse">💍 Spouse</option>
                                <option value="Son">👦 Son</option>
                                <option value="Daughter">👧 Daughter</option>
                                <option value="Father">👴 Father</option>
                                <option value="Mother">👵 Mother</option>
                                <option value="Brother">👨 Brother</option>
                                <option value="Sister">👩 Sister</option>
                                <option value="Business">🏪 Business / Shop</option>
                                <option value="Other">🌟 Other Relation</option>
                              </select>
                            </div>
                          </div>

                          {/* Row 2: Date Type & Event Date */}
                          <div className="id-form-row-2col" style={{ marginBottom: '0.65rem' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                                Date Type <span style={{ color: 'var(--danger)' }}>*</span>
                              </label>
                              <select
                                value={entry.type}
                                onChange={(e) => handleUpdateDateRow(entry.id, 'type', e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '0.5rem 0.7rem',
                                  borderRadius: '0.45rem',
                                  border: '1px solid var(--border-color)',
                                  backgroundColor: 'var(--bg-input)',
                                  color: 'var(--text-primary)',
                                  fontSize: '0.875rem',
                                  fontWeight: 600,
                                  outline: 'none'
                                }}
                              >
                                <option value="birthday">🎂 Birthday</option>
                                <option value="wedding">💍 Wedding Anniversary</option>
                                <option value="death">🕯️ Death Anniversary</option>
                                <option value="shop_opening">🏪 Shop Opening</option>
                                <option value="business_anniversary">💼 Business Anniversary</option>
                                <option value="other">📅 Other</option>
                              </select>
                            </div>

                            <div>
                              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                                Date <span style={{ color: 'var(--danger)' }}>*</span>
                              </label>
                              <input
                                type="date"
                                value={entry.date}
                                onChange={(e) => handleUpdateDateRow(entry.id, 'date', e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '0.5rem 0.7rem',
                                  borderRadius: '0.45rem',
                                  border: '1px solid var(--border-color)',
                                  backgroundColor: 'var(--bg-input)',
                                  color: 'var(--text-primary)',
                                  fontSize: '0.875rem',
                                  outline: 'none'
                                }}
                              />
                            </div>
                          </div>

                          {/* Row 3: Member Personal Phone (Optional) & Notes */}
                          <div className="id-form-row-2col" style={{ marginBottom: '0.65rem' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                                Member Phone (Optional)
                              </label>
                              <input
                                type="tel"
                                placeholder={contactData.phone ? `Default: ${contactData.phone}` : 'e.g. 9876543210'}
                                value={entry.phone || ''}
                                onChange={(e) => handleUpdateDateRow(entry.id, 'phone', e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '0.5rem 0.7rem',
                                  borderRadius: '0.45rem',
                                  border: '1px solid var(--border-color)',
                                  backgroundColor: 'var(--bg-input)',
                                  color: 'var(--text-primary)',
                                  fontSize: '0.875rem',
                                  outline: 'none'
                                }}
                              />
                            </div>

                            <div>
                              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                                Notes / Description
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. 10th Birthday, Boutique opening..."
                                value={entry.notes}
                                onChange={(e) => handleUpdateDateRow(entry.id, 'notes', e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '0.5rem 0.7rem',
                                  borderRadius: '0.45rem',
                                  border: '1px solid var(--border-color)',
                                  backgroundColor: 'var(--bg-input)',
                                  color: 'var(--text-primary)',
                                  fontSize: '0.875rem',
                                  outline: 'none'
                                }}
                              />
                            </div>
                          </div>

                          {/* Reminders Compact Box */}
                          <div style={{
                            padding: '0.65rem 0.85rem',
                            backgroundColor: 'var(--bg-secondary)',
                            borderRadius: '0.5rem',
                            border: '1px solid var(--border-color)'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.45rem' }}>
                              <Bell size={14} style={{ color: '#0284c7' }} />
                              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                Reminders:
                              </span>
                            </div>

                            <div className="id-reminders-checkbox-grid">
                              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={(entry.reminders || []).includes(0)}
                                  onChange={(e) => {
                                    const val = 0;
                                    const rems = entry.reminders || [];
                                    handleUpdateDateRow(
                                      entry.id,
                                      'reminders',
                                      e.target.checked ? [...rems, val] : rems.filter(r => r !== val)
                                    );
                                  }}
                                />
                                <span>☑ On the Day (9:00 AM)</span>
                              </label>

                              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={(entry.reminders || []).includes(45)}
                                  onChange={(e) => {
                                    const val = 45;
                                    const rems = entry.reminders || [];
                                    handleUpdateDateRow(
                                      entry.id,
                                      'reminders',
                                      e.target.checked ? [...rems, val] : rems.filter(r => r !== val)
                                    );
                                  }}
                                />
                                <span>☑ 45 days before</span>
                              </label>

                              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={(entry.reminders || []).includes(30)}
                                  onChange={(e) => {
                                    const val = 30;
                                    const rems = entry.reminders || [];
                                    handleUpdateDateRow(
                                      entry.id,
                                      'reminders',
                                      e.target.checked ? [...rems, val] : rems.filter(r => r !== val)
                                    );
                                  }}
                                />
                                <span>☑ 30 days before</span>
                              </label>

                              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={(entry.reminders || []).includes(7)}
                                  onChange={(e) => {
                                    const val = 7;
                                    const rems = entry.reminders || [];
                                    handleUpdateDateRow(
                                      entry.id,
                                      'reminders',
                                      e.target.checked ? [...rems, val] : rems.filter(r => r !== val)
                                    );
                                  }}
                                />
                                <span>☑ 7 days before</span>
                              </label>
                            </div>

                            {/* Custom Reminder for entry */}
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              borderTop: '1px dashed var(--border-color)',
                              paddingTop: '0.4rem',
                              marginTop: '0.3rem'
                            }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={entry.customEnabled || false}
                                  onChange={(e) => handleUpdateDateRow(entry.id, 'customEnabled', e.target.checked)}
                                />
                                <span>Custom:</span>
                              </label>
                              <input
                                type="number"
                                min="1"
                                max="365"
                                placeholder="75"
                                value={entry.customDays || ''}
                                onChange={(e) => {
                                  handleUpdateDateRow(entry.id, 'customDays', e.target.value);
                                  handleUpdateDateRow(entry.id, 'customEnabled', true);
                                }}
                                disabled={!entry.customEnabled}
                                style={{
                                  width: '65px',
                                  padding: '0.2rem 0.4rem',
                                  borderRadius: '0.3rem',
                                  border: '1px solid var(--border-color)',
                                  backgroundColor: entry.customEnabled ? 'var(--bg-input)' : 'var(--bg-card)',
                                  color: 'var(--text-primary)',
                                  fontSize: '0.8rem',
                                  fontWeight: 700,
                                  textAlign: 'center'
                                }}
                              />
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>days before</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Form Actions with All 3 Buttons in One Single Compact Line */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
                marginTop: '0.85rem',
                borderTop: '1px solid var(--border-color)',
                paddingTop: '0.75rem',
                flexWrap: 'nowrap'
              }}>
                {!editingItem ? (
                  <button
                    type="button"
                    onClick={handleAddAnotherDateRow}
                    className="btn btn-secondary"
                    style={{
                      padding: '0.4rem 0.75rem',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: '#0284c7',
                      borderColor: '#38bdf8',
                      backgroundColor: 'rgba(56, 189, 248, 0.08)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      borderRadius: '0.45rem',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                    title="Add another date row for this contact"
                  >
                    <Plus size={14} />
                    <span>+ Add Another Date</span>
                  </button>
                ) : <div />}

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => setIsAddEditOpen(false)}
                    className="btn btn-secondary"
                    disabled={formSubmitting}
                    style={{
                      padding: '0.4rem 0.8rem',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      borderRadius: '0.45rem',
                      minWidth: '70px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={formSubmitting}
                    style={{
                      padding: '0.4rem 0.95rem',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      borderRadius: '0.45rem',
                      minWidth: '110px',
                      boxShadow: '0 2px 10px rgba(37, 99, 235, 0.25)',
                      whiteSpace: 'nowrap',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    {formSubmitting ? (
                      <div className="pulse-loader" />
                    ) : (
                      <>
                        <Save size={14} />
                        <span>{editingItem ? 'Save Changes' : `Save All (${dateEntries.length}) Dates`}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteOpen && deletingItem && (
        <ConfirmModal
          isOpen={isDeleteOpen}
          title="Delete Important Date"
          message={`Are you sure you want to delete ${deletingItem.name}'s ${getTypeMeta(deletingItem.type).label} record?`}
          confirmText="Delete Date"
          onConfirm={handleDeleteConfirm}
          onCancel={() => {
            setIsDeleteOpen(false);
            setDeletingItem(null);
          }}
          loading={isDeleting}
        />
      )}
    </div>
  );
}
