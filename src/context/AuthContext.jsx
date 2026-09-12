import React, { createContext, useContext, useState, useEffect } from 'react';
import { loginAdmin, registerAdmin, changeAdminPassword, updateAdminProfile } from '../services/apiService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('address_auth_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem('address_auth_token') || null;
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const login = async (username, password) => {
    setLoading(true);
    setError(null);
    try {
      const res = await loginAdmin(username, password);
      if (res && res.success && res.user) {
        setUser(res.user);
        setToken(res.token || res.user.token);
        localStorage.setItem('address_auth_user', JSON.stringify(res.user));
        localStorage.setItem('address_auth_token', res.token || res.user.token);
        return { success: true, user: res.user };
      } else {
        throw new Error(res.error || 'Authentication response failed');
      }
    } catch (err) {
      const errMsg = err.message || 'Login failed. Please check credentials.';
      setError(errMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (username, password, name) => {
    setLoading(true);
    setError(null);
    try {
      const res = await registerAdmin(username, password, name);
      if (res && res.success && res.user) {
        setUser(res.user);
        setToken(res.token || res.user.token);
        localStorage.setItem('address_auth_user', JSON.stringify(res.user));
        localStorage.setItem('address_auth_token', res.token || res.user.token);
        return { success: true, user: res.user };
      } else {
        throw new Error(res.error || 'Registration response failed');
      }
    } catch (err) {
      const errMsg = err.message || 'Registration failed.';
      setError(errMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    if (!user?.username) throw new Error('No active user logged in');
    return await changeAdminPassword(user.username, currentPassword, newPassword);
  };

  const updateProfile = async (newName, newUsername) => {
    if (!user?.username) throw new Error('No active user logged in');
    const res = await updateAdminProfile(user.username, newName, newUsername);
    if (res && res.user) {
      const updated = { ...user, ...res.user };
      setUser(updated);
      localStorage.setItem('address_auth_user', JSON.stringify(updated));
    }
    return res;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('address_auth_user');
    localStorage.removeItem('address_auth_token');
  };

  const isAuthenticated = Boolean(user && token);

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, loading, error, login, register, changePassword, updateProfile, logout, setError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
