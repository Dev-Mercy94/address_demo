import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  MapPin, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  ShieldCheck, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2,
  UserPlus,
  LogIn
} from 'lucide-react';

export function LoginPage() {
  const { login, register, loading } = useAuth();
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  
  // Login State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Register State
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage('Please enter both username and password.');
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    try {
      await login(username.trim(), password);
    } catch (err) {
      setErrorMessage(err.message || 'Invalid username or password.');
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!regUsername.trim() || !regPassword) {
      setErrorMessage('Username and password are required.');
      return;
    }
    if (regPassword.length < 4) {
      setErrorMessage('Password must be at least 4 characters long.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMessage('Passwords do not match. Please verify.');
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    try {
      await register(regUsername.trim(), regPassword, regName.trim() || 'Administrator');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to create admin account.');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at top, #1e293b 0%, #0f172a 100%)',
      padding: '1.25rem',
      boxSizing: 'border-box',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Ambient background glow orbs */}
      <div style={{
        position: 'absolute',
        top: '-15%',
        left: '20%',
        width: '450px',
        height: '450px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(37, 99, 235, 0.25) 0%, rgba(37, 99, 235, 0) 70%)',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-15%',
        right: '20%',
        width: '450px',
        height: '450px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, rgba(99, 102, 241, 0) 70%)',
        pointerEvents: 'none'
      }} />

      {/* Main Glassmorphic Login Container */}
      <div style={{
        width: '100%',
        maxWidth: '440px',
        backgroundColor: 'rgba(30, 41, 59, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '1.25rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        padding: '2.25rem 2rem',
        boxSizing: 'border-box',
        position: 'relative',
        zIndex: 10
      }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '1rem',
            background: 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 8px 20px rgba(37, 99, 235, 0.4)',
            marginBottom: '0.75rem'
          }}>
            <MapPin size={28} />
          </div>

          <h1 style={{
            fontSize: '1.6rem',
            fontWeight: 800,
            color: '#ffffff',
            letterSpacing: '-0.025em',
            margin: '0 0 0.25rem 0'
          }}>
            AddressHub
          </h1>
          <p style={{
            fontSize: '0.85rem',
            color: '#94a3b8',
            margin: 0
          }}>
            {authMode === 'login' ? 'Administrator Authentication Portal' : 'Create Custom Administrator Account'}
          </p>
        </div>

        {/* Tab Switcher: Sign In vs Create Admin */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '0.75rem',
          padding: '4px',
          marginBottom: '1.5rem'
        }}>
          <button
            type="button"
            onClick={() => {
              setAuthMode('login');
              setErrorMessage('');
              setSuccessMessage('');
            }}
            style={{
              padding: '0.5rem',
              fontSize: '0.825rem',
              fontWeight: 700,
              color: authMode === 'login' ? '#ffffff' : '#94a3b8',
              backgroundColor: authMode === 'login' ? '#2563eb' : 'transparent',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              transition: 'all 0.15s ease',
              boxShadow: authMode === 'login' ? '0 2px 8px rgba(37, 99, 235, 0.4)' : 'none'
            }}
          >
            <LogIn size={15} />
            <span>Sign In</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAuthMode('register');
              setErrorMessage('');
              setSuccessMessage('');
            }}
            style={{
              padding: '0.5rem',
              fontSize: '0.825rem',
              fontWeight: 700,
              color: authMode === 'register' ? '#ffffff' : '#94a3b8',
              backgroundColor: authMode === 'register' ? '#2563eb' : 'transparent',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              transition: 'all 0.15s ease',
              boxShadow: authMode === 'register' ? '0 2px 8px rgba(37, 99, 235, 0.4)' : 'none'
            }}
          >
            <UserPlus size={15} />
            <span>Create Admin</span>
          </button>
        </div>

        {/* Error Alert Box */}
        {errorMessage && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.65rem',
            padding: '0.75rem 1rem',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '0.625rem',
            color: '#fca5a5',
            fontSize: '0.84rem',
            marginBottom: '1.25rem',
            lineHeight: 1.4
          }}>
            <AlertCircle size={17} style={{ flexShrink: 0, marginTop: '1px' }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* MODE 1: SIGN IN FORM */}
        {authMode === 'login' ? (
          <form onSubmit={handleLoginSubmit} autoComplete="off" style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            {/* Username Field */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: '#cbd5e1',
                marginBottom: '0.4rem',
                letterSpacing: '0.01em'
              }}>
                Admin Username
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute',
                  left: '0.9rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <User size={18} />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="e.g. admin"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoFocus
                  required
                  style={{
                    width: '100%',
                    height: '44px',
                    paddingLeft: '2.6rem',
                    paddingRight: '1rem',
                    backgroundColor: 'rgba(15, 23, 42, 0.75)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '0.625rem',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    fontWeight: 500,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: '#cbd5e1',
                marginBottom: '0.4rem',
                letterSpacing: '0.01em'
              }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute',
                  left: '0.9rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  style={{
                    width: '100%',
                    height: '44px',
                    paddingLeft: '2.6rem',
                    paddingRight: '2.75rem',
                    backgroundColor: 'rgba(15, 23, 42, 0.75)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '0.625rem',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    fontWeight: 500,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '0.8rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                height: '46px',
                backgroundColor: '#2563eb',
                backgroundImage: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '0.625rem',
                fontSize: '0.925rem',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
                marginTop: '0.5rem',
                opacity: loading ? 0.8 : 1
              }}
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        ) : (
          /* MODE 2: CREATE ADMIN FORM */
          <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Full Name */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: '#cbd5e1',
                marginBottom: '0.35rem'
              }}>
                Administrator Name
              </label>
              <input
                type="text"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="e.g. Master Admin"
                style={{
                  width: '100%',
                  height: '42px',
                  padding: '0 0.9rem',
                  backgroundColor: 'rgba(15, 23, 42, 0.75)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '0.625rem',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Username */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: '#cbd5e1',
                marginBottom: '0.35rem'
              }}>
                Username *
              </label>
              <input
                type="text"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                placeholder="e.g. boss_admin"
                required
                style={{
                  width: '100%',
                  height: '42px',
                  padding: '0 0.9rem',
                  backgroundColor: 'rgba(15, 23, 42, 0.75)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '0.625rem',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Password */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: '#cbd5e1',
                marginBottom: '0.35rem'
              }}>
                Password * (min 4 characters)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showRegPassword ? 'text' : 'password'}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Create strong password"
                  required
                  style={{
                    width: '100%',
                    height: '42px',
                    padding: '0 2.5rem 0 0.9rem',
                    backgroundColor: 'rgba(15, 23, 42, 0.75)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '0.625rem',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  style={{
                    position: 'absolute',
                    right: '0.8rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  {showRegPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: '#cbd5e1',
                marginBottom: '0.35rem'
              }}>
                Confirm Password *
              </label>
              <input
                type="password"
                value={regConfirmPassword}
                onChange={(e) => setRegConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                required
                style={{
                  width: '100%',
                  height: '42px',
                  padding: '0 0.9rem',
                  backgroundColor: 'rgba(15, 23, 42, 0.75)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '0.625rem',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Submit Create Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                height: '46px',
                backgroundColor: '#10b981',
                backgroundImage: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '0.625rem',
                fontSize: '0.925rem',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                marginTop: '0.4rem',
                opacity: loading ? 0.8 : 1
              }}
            >
              {loading ? (
                <span>Creating Account...</span>
              ) : (
                <>
                  <span>Create Admin & Sign In</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
