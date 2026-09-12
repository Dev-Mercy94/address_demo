import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  User,
  ShieldCheck,
  KeyRound,
  Lock,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Save,
  LogOut,
  Sparkles,
  Clock,
  IdCard
} from 'lucide-react';

export function ProfilePage({ onNavigate }) {
  const { user, changePassword, updateProfile, logout } = useAuth();

  // Profile Edit State
  const [name, setName] = useState(user?.name || 'Administrator');
  const [username, setUsername] = useState(user?.username || 'admin');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ text: '', type: 'success' });

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState({ text: '', type: 'success' });

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!name.trim() || !username.trim()) {
      setProfileMsg({ text: 'Name and username cannot be empty.', type: 'error' });
      return;
    }

    setProfileSaving(true);
    setProfileMsg({ text: '', type: 'success' });
    try {
      await updateProfile(name.trim(), username.trim());
      setProfileMsg({ text: 'Admin profile updated successfully!', type: 'success' });
    } catch (err) {
      setProfileMsg({ text: err.message || 'Failed to update profile.', type: 'error' });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      setPasswordMsg({ text: 'Please fill in all password fields.', type: 'error' });
      return;
    }
    if (newPassword.length < 4) {
      setPasswordMsg({ text: 'New password must be at least 4 characters long.', type: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: 'New passwords do not match. Please verify.', type: 'error' });
      return;
    }

    setPasswordSaving(true);
    setPasswordMsg({ text: '', type: 'success' });
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordMsg({ text: 'Password successfully changed and updated securely!', type: 'success' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordMsg({ text: err.message || 'Failed to change password.', type: 'error' });
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto', paddingBottom: '2.5rem' }}>
      {/* Header Banner */}
      <div className="profile-page-header-banner" style={{
        marginBottom: '1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 style={{
            fontSize: '1.35rem',
            fontWeight: 800,
            marginBottom: '0.2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: 'var(--text-primary)',
            letterSpacing: '-0.01em'
          }}>
            <IdCard size={22} style={{ color: '#2563eb', flexShrink: 0 }} />
            <span>Admin Profile & Security</span>
          </h2>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
            Manage administrator credentials, profile details, and account password
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (window.confirm('Sign out of admin session?')) logout();
          }}
          className="btn btn-secondary btn-sm"
          style={{
            color: 'var(--danger)',
            borderColor: 'rgba(239, 68, 68, 0.3)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            flexShrink: 0,
            padding: '0.4rem 0.75rem',
            fontSize: '0.8rem'
          }}
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Grid: Profile Card + Password Card */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
        gap: '1rem'
      }}>

        {/* CARD 1: Profile Details */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: '1.15rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.15rem' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '0.75rem',
              background: 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
              fontWeight: 800,
              fontSize: '1.15rem',
              flexShrink: 0
            }}>
              {(user?.name || user?.username || 'A')[0].toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.15rem 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.name || 'Administrator'}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span className="badge badge-primary" style={{ fontSize: '0.68rem', textTransform: 'uppercase', padding: '0.1rem 0.45rem' }}>
                  {user?.role || 'admin'}
                </span>
              </div>
            </div>
          </div>

          {/* Profile Alert */}
          {profileMsg.text && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.55rem 0.75rem',
              backgroundColor: profileMsg.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              border: `1px solid ${profileMsg.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              borderRadius: '0.5rem',
              color: profileMsg.type === 'success' ? '#10b981' : '#ef4444',
              fontSize: '0.8rem',
              marginBottom: '0.85rem'
            }}>
              {profileMsg.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
              <span>{profileMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', flex: 1 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>Display / Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Master Admin"
                className="form-input"
                style={{ height: '38px', fontSize: '0.85rem' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin"
                className="form-input"
                style={{ height: '38px', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '0.75rem' }}>
              <button
                type="submit"
                disabled={profileSaving}
                className="btn btn-primary"
                style={{ width: '100%', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
              >
                <Save size={15} />
                <span>{profileSaving ? 'Saving Changes...' : 'Save Profile Details'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* CARD 2: Change Password */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: '1.15rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '1.15rem' }}>
            <KeyRound size={18} style={{ color: '#f59e0b', flexShrink: 0 }} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
              Change Account Password
            </h3>
          </div>

          {/* Password Alert */}
          {passwordMsg.text && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.55rem 0.75rem',
              backgroundColor: passwordMsg.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              border: `1px solid ${passwordMsg.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              borderRadius: '0.5rem',
              color: passwordMsg.type === 'success' ? '#10b981' : '#ef4444',
              fontSize: '0.8rem',
              marginBottom: '0.85rem'
            }}>
              {passwordMsg.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
              <span>{passwordMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
            {/* Current Password */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>Current Password *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  required
                  className="form-input"
                  style={{ paddingRight: '2.5rem', height: '38px', fontSize: '0.85rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  style={{
                    position: 'absolute',
                    right: '0.65rem',
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
                >
                  {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>New Password * (min 4 chars)</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  className="form-input"
                  style={{ paddingRight: '2.5rem', height: '38px', fontSize: '0.85rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  style={{
                    position: 'absolute',
                    right: '0.65rem',
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
                >
                  {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>Confirm New Password *</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                required
                className="form-input"
                style={{ height: '38px', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '0.75rem' }}>
              <button
                type="submit"
                disabled={passwordSaving}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  height: '40px',
                  backgroundColor: '#f59e0b',
                  borderColor: '#f59e0b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  color: '#ffffff',
                  fontSize: '0.85rem'
                }}
              >
                <Lock size={15} />
                <span>{passwordSaving ? 'Updating Password...' : 'Update Password'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
