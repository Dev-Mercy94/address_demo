import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  PlusCircle, 
  Upload, 
  FileText, 
  Image as ImageIcon, 
  Search, 
  Filter, 
  Download, 
  CheckCircle2, 
  Layers, 
  MapPin, 
  CheckSquare, 
  Sparkles, 
  Languages, 
  CopyCheck, 
  Zap, 
  Hash, 
  IndianRupee, 
  Printer,
  CalendarHeart,
  MessageCircle,
  Gift,
  Heart,
  Server,
  Cpu,
  Lock,
  ArrowRight,
  LayoutGrid,
  List,
  BellRing,
  Bell,
  Smartphone,
  Edit3,
  Trash2,
  Eye,
  SlidersHorizontal,
  Compass,
  AlertCircle,
  HelpCircle,
  Volume2,
  Phone
} from 'lucide-react';
import creatorLogo from '../assets/creator-logo.png';
import { Toast } from '../components/Toast';
import { requestNotificationPermission, checkNotificationPermission } from '../services/notificationService';

export function SettingsPage({ onNavigate }) {
  const [permStatus, setPermStatus] = useState('checking');
  const [toast, setToast] = useState({ message: '', type: 'success' });

  useEffect(() => {
    async function check() {
      try {
        const granted = await checkNotificationPermission();
        setPermStatus(granted ? 'granted' : (typeof Notification !== 'undefined' ? Notification.permission : 'denied'));
      } catch (e) {
        setPermStatus('unknown');
      }
    }
    check();
  }, []);

  const handleRequestPermission = async () => {
    try {
      const granted = await requestNotificationPermission();
      if (granted) {
        setPermStatus('granted');
        setToast({ message: 'Device Notification Permission is GRANTED! Reminders will alert on schedule.', type: 'success' });
      } else {
        setPermStatus('denied');
        setToast({ message: 'Notification permission was denied. Please allow notifications in device/browser settings.', type: 'warning' });
      }
    } catch (err) {
      console.error('Permission error:', err);
      setToast({ message: 'Error checking permission: ' + err.message, type: 'error' });
    }
  };
  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto', paddingBottom: '2.5rem' }}>
      {/* Header Banner */}
      <div className="overview-page-header" style={{ marginBottom: '1.25rem' }}>
        <h2 style={{
          fontSize: '1.4rem',
          fontWeight: 800,
          marginBottom: '0.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          color: 'var(--text-primary)',
          letterSpacing: '-0.01em'
        }}>
          <Sparkles size={24} style={{ color: '#ea580c', flexShrink: 0 }} />
          <span>System Overview & Modern Feature Suite</span>
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
          Comprehensive architectural overview of newly introduced features, intelligent duplicate resolution, 1-click district navigation, multi-date reminder builder, customizable WhatsApp greetings, and high-speed cloud synchronization.
        </p>
      </div>

      {/* Security & Cloud Infrastructure Card */}
      <div className="card overview-security-card" style={{
        marginBottom: '1.25rem',
        padding: '1.15rem',
        borderColor: 'rgba(16, 185, 129, 0.35)',
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(37, 99, 235, 0.06) 100%)'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '0.75rem',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            color: '#10b981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <ShieldCheck size={24} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
              High-Availability Cloud Architecture & Security
            </h3>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
              The platform operates with automated SSL encryption and secure real-time cloud data synchronization. All customer records, contact addresses, important dates, and subscription transactions remain strictly protected with automated data verification.
            </p>
          </div>
        </div>
      </div>

      {/* 1. NEWLY ADDED INNOVATIONS & FEATURE HIGHLIGHTS */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '1.15rem' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#2563eb' }}>
          <Zap size={20} />
          <span>Core Innovations & System Features</span>
        </h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
          gap: '0.85rem'
        }}>
          
          {/* 1. Intelligent Duplicate Resolution & Staging Engine */}
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1.5px solid rgba(245, 158, 11, 0.35)',
            borderRadius: '0.75rem',
            padding: '1rem',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(16, 185, 129, 0.05) 100%)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.9rem', marginBottom: '0.4rem' }}>
              <CopyCheck size={18} style={{ color: '#d97706', flexShrink: 0 }} />
              <span>Intelligent Duplicate Staging Engine</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45, margin: 0, flex: 1 }}>
              Features multi-factor matching across <strong>U_ID</strong>, <strong>10-digit Phone</strong>, and <strong>Name + Address</strong>, plus synchronous <em>intra-file duplicate detection</em> (under 1ms). Provides side-by-side comparing cards with <strong>Save as New</strong>, <strong>Overwrite Existing</strong>, <strong>Move All to Success</strong>, and <strong>Remove All Duplicates</strong> actions.
            </p>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('import')}
                style={{
                  marginTop: '0.65rem',
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                Open Import & Duplicate Studio <ArrowRight size={13} />
              </button>
            )}
          </div>

          {/* 2. 1-Click Cross-Page District & Pincode Isolation */}
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1.5px solid rgba(14, 165, 233, 0.35)',
            borderRadius: '0.75rem',
            padding: '1rem',
            background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.05) 0%, rgba(99, 102, 241, 0.05) 100%)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.9rem', marginBottom: '0.4rem' }}>
              <Compass size={18} style={{ color: '#0ea5e9', flexShrink: 0 }} />
              <span>Direct District & Pincode Drilldown</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45, margin: 0, flex: 1 }}>
              Clicking <strong>"View Addresses"</strong> on any District card (e.g. Madurai, Thoothukudi, Chennai) or Pincode card instantly transitions to the Addresses Directory and isolates that exact district or postal code with live synchronized query state.
            </p>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('districts')}
                style={{
                  marginTop: '0.65rem',
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                Open Districts Hub <ArrowRight size={13} />
              </button>
            )}
          </div>

          {/* 3. Multi-Date Event Builder & In-App Reminders */}
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1.5px solid rgba(236, 72, 153, 0.35)',
            borderRadius: '0.75rem',
            padding: '1rem',
            background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.05) 0%, rgba(99, 102, 241, 0.05) 100%)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.9rem', marginBottom: '0.4rem' }}>
              <CalendarHeart size={18} style={{ color: '#ec4899', flexShrink: 0 }} />
              <span>Multi-Date Reminder Builder</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45, margin: 0, flex: 1 }}>
              Add multiple important dates (birthdays, wedding anniversaries, shop openings, memorials) for family members under a single contact or U.Id. Features instant cursor autofocus, milestone age computation, and multi-tier alert schedules (Today, 45d, 30d, 7d).
            </p>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('dates')}
                style={{
                  marginTop: '0.65rem',
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                Open Important Dates <ArrowRight size={13} />
              </button>
            )}
          </div>

          {/* 4. Customizable WhatsApp Greeting Studio */}
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1.5px solid rgba(37, 211, 102, 0.35)',
            borderRadius: '0.75rem',
            padding: '1rem',
            background: 'linear-gradient(135deg, rgba(37, 211, 102, 0.05) 0%, rgba(14, 165, 233, 0.05) 100%)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.9rem', marginBottom: '0.4rem' }}>
              <MessageCircle size={18} style={{ color: '#25D366', flexShrink: 0 }} />
              <span>Custom WhatsApp Greeting Studio</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45, margin: 0, flex: 1 }}>
              Compose and save custom greeting messages in your free time. Includes quick preset chips (Warm, Formal, Tamil), dynamic placeholder insertion (<code>{'{name}'}</code>, <code>{'{years}'}</code>), and instant 1-tap WhatsApp launch with full emoji support (🎂🎉✨).
            </p>
          </div>

          {/* 5. Subscription Management & Dual View Mode */}
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1.5px solid rgba(234, 88, 12, 0.35)',
            borderRadius: '0.75rem',
            padding: '1rem',
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.05) 0%, rgba(16, 185, 129, 0.05) 100%)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.9rem', marginBottom: '0.4rem' }}>
              <CheckSquare size={18} style={{ color: '#ea580c', flexShrink: 0 }} />
              <span>Dual-View Subscription Tracker</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45, margin: 0, flex: 1 }}>
              Toggle between a high-density <strong>Data Table</strong> and sleek <strong>Cards View</strong> with automatic mobile default. Filter by U.Id, Date, or Amount (₹), and toggle Subscribed status with a single tap.
            </p>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('subscription')}
                style={{
                  marginTop: '0.65rem',
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                Open Subscriptions <ArrowRight size={13} />
              </button>
            )}
          </div>

          {/* 6. 100% Mobile Media Responsiveness & GPU Speedups */}
          <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.4rem', fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
              <Smartphone size={18} style={{ color: '#f59e0b', flexShrink: 0 }} />
              <span>100% Mobile Responsiveness & Speed</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45, margin: 0 }}>
              Optimized down to 320px screens with zero horizontal overflow, touch-first responsive tables, subpixel GPU text antialiasing, and parallelized asynchronous batch data processing.
            </p>
          </div>

        </div>
      </div>

      {/* 2. DEVICE NOTIFICATIONS & IMPORTANT DAYS REMINDER GUIDANCE */}
      <div className="card" style={{
        marginBottom: '1.25rem',
        padding: '1.25rem',
        borderColor: 'rgba(236, 72, 153, 0.35)',
        background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.04) 0%, rgba(99, 102, 241, 0.04) 100%)'
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ec4899' }}>
              <BellRing size={20} />
              <span>Device Notifications & Important Days Setup Guidance</span>
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
              Complete step-by-step instructions to configure native Android & browser push notifications for birthday & anniversary reminders.
            </p>
          </div>

          {/* Quick Permission Status & Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: '999px',
              backgroundColor: permStatus === 'granted' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: permStatus === 'granted' ? '#059669' : '#dc2626',
              border: `1px solid ${permStatus === 'granted' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
            }}>
              {permStatus === 'granted' ? '✓ Notifications Active' : '⚠ Permission Required'}
            </span>

            <button
              type="button"
              onClick={handleRequestPermission}
              className="btn btn-primary btn-sm"
              style={{
                backgroundColor: '#ec4899',
                borderColor: '#db2777',
                fontSize: '0.78rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <Bell size={14} />
              <span>Enable Notifications</span>
            </button>

            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('dates')}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.78rem', fontWeight: 700 }}
              >
                <CalendarHeart size={14} style={{ color: '#ec4899' }} />
                <span>Open Important Dates</span>
              </button>
            )}
          </div>
        </div>

        {/* Guidance Steps Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))',
          gap: '0.85rem',
          marginBottom: '1rem'
        }}>
          {/* Step 1 */}
          <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '0.65rem', padding: '0.9rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem', fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
              <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#ec4899', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>1</span>
              <span>Grant Device Permission</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
              Click <strong>"Enable Notifications"</strong> above. When your phone or browser asks <em>"Show notifications?"</em>, click <strong>Allow</strong>.
            </p>
          </div>

          {/* Step 2 */}
          <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '0.65rem', padding: '0.9rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem', fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
              <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#ec4899', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>2</span>
              <span>Select Alert Schedules</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
              In the <strong>Important Dates</strong> page, choose alert tiers for each date: <strong>Today (0)</strong>, <strong>7 days</strong>, <strong>30 days</strong>, or <strong>45 days before</strong>.
            </p>
          </div>

          {/* Step 3 */}
          <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '0.65rem', padding: '0.9rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem', fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
              <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#ec4899', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>3</span>
              <span>9:00 AM Alert & WhatsApp</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
              Notifications ring automatically on your device at <strong>9:00 AM</strong>. Tapping the reminder directly opens WhatsApp with a ready greeting!
            </p>
          </div>

          {/* Step 4 */}
          <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '0.65rem', padding: '0.9rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem', fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
              <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#ec4899', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>4</span>
              <span>Android Battery Setting</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
              On Android phones (Xiaomi, Samsung, OnePlus, Vivo), open <em>Settings → Apps → AddressHub</em>, enable <strong>Autostart</strong> and set Battery to <strong>No Restrictions</strong>.
            </p>
          </div>
        </div>

        {/* Tip Box */}
        <div style={{
          padding: '0.75rem 0.9rem',
          borderRadius: '0.55rem',
          backgroundColor: 'rgba(99, 102, 241, 0.08)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.8rem',
          color: 'var(--text-secondary)'
        }}>
          <Volume2 size={16} style={{ color: '#6366f1', flexShrink: 0 }} />
          <span><strong>Sound & Vibration:</strong> Ensure your phone's notification volume is enabled so morning reminder chimes are audible.</span>
        </div>
      </div>

      {/* 3. MULTI-SOURCE DATA INGESTION */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '1.15rem' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0ea5e9' }}>
          <Layers size={20} style={{ color: '#0ea5e9' }} />
          <span>Multi-Source Ingestion & Document Processing</span>
        </h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
          gap: '0.75rem'
        }}>
          {/* Manual Entry */}
          <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '0.625rem', padding: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem', fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
              <PlusCircle size={15} style={{ color: '#4f46e5', flexShrink: 0 }} />
              <span>Manual 4-Section Form</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
              Interactive address studio with Tamil phonetic typing (<code>murali</code> → <code>முரளி</code>), phone auto-formatting, and live duplicate checks.
            </p>
          </div>

          {/* CSV Import */}
          <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '0.625rem', padding: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem', fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
              <Upload size={15} style={{ color: '#0ea5e9', flexShrink: 0 }} />
              <span>CSV Spreadsheet Ingestion</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
              Batch upload spreadsheets with automatic column mapping, Bamini font converter, and interactive editable table preview.
            </p>
          </div>

          {/* PDF Document Extraction */}
          <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '0.625rem', padding: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem', fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
              <FileText size={15} style={{ color: '#8b5cf6', flexShrink: 0 }} />
              <span>PDF, DOCX & WordPad</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
              Intelligent text extractor that parses customer tables from PDF documents, WordPad RTF files, and DOCX files.
            </p>
          </div>

          {/* Image OCR Reading */}
          <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '0.625rem', padding: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem', fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
              <ImageIcon size={15} style={{ color: '#ec4899', flexShrink: 0 }} />
              <span>Image OCR Scanner</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
              Convert printed customer address cards and photo documents into digital records via Optical Character Recognition.
            </p>
          </div>
        </div>
      </div>

      {/* 3. DIRECTORY EXPLORATION & PRINT STUDIO */}
      <div className="card" style={{ padding: '1.15rem' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981' }}>
          <Search size={20} style={{ color: '#10b981' }} />
          <span>Directory Search, Advanced Filters & Print Studio</span>
        </h3>

        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <CheckCircle2 size={16} style={{ color: 'var(--success)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>Live Global Search & Multi-Filters:</strong> Real-time debounced search matching across U.IDs, full names, door numbers, streets, areas, cities, districts, pincodes, and phones with a single-click <em>"Clear Filters"</em> button.
            </div>
          </li>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <CheckCircle2 size={16} style={{ color: 'var(--success)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>Dual Tamil & English Alphabet Index Bars:</strong> Instant A–Z and அ–ன letter navigation for rapid localized phonebook lookup.
            </div>
          </li>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <CheckCircle2 size={16} style={{ color: 'var(--success)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>District & Pincode Hubs:</strong> Explore customer distribution and total counts across all 38 districts with direct drill-down linking.
            </div>
          </li>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <CheckCircle2 size={16} style={{ color: 'var(--success)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>Print & PDF Studio:</strong> Export custom filtered views or complete directories into formatted, high-resolution printable PDF reports and label templates.
            </div>
          </li>
        </ul>
      </div>

      {/* Footer Creator Stamp - Centered Close-up Layout */}
      <div className="overview-footer-creator-stamp">
        <div className="overview-footer-inner-group">
          <div className="overview-footer-logo-box">
            <img 
              src={creatorLogo} 
              alt="Macro Minis Logo" 
              className="overview-footer-logo-img" 
            />
          </div>

          <div className="overview-footer-details">
            <div className="overview-footer-brand-row">
              <span>Created by</span>
              <strong className="overview-footer-brand-name">Macro Minis</strong>
              <span className="overview-footer-tagline">(Mini Makers. Macro Minds..)</span>
              <span className="overview-footer-dot">•</span>
              <div className="overview-footer-contact-wrapper">
                <span className="overview-footer-contact-label">Contact:</span>
                <a 
                  href="tel:7871744555" 
                  className="overview-footer-contact-link"
                  title="Call Creator: 7871744555"
                >
                  <Phone size={13} style={{ color: '#ea580c', flexShrink: 0 }} />
                  <span>7871744555</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: '', type: 'success' })}
      />
    </div>
  );
}

export default SettingsPage;

