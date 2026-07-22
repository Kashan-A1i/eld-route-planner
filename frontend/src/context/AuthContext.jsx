import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

const API_URL = 'http://localhost:8000/api/auth';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check auth status on load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch(`${API_URL}/me/`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'success') {
            setUser({
              ...data.user,
              cdlNumber: '',
              truckNumber: '',
              carrier: '',
              homeTerminal: '',
              isGuest: false,
            });
          }
        }
      } catch (e) {
        console.error('Auth check failed', e);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);
  
  const loginAsGuest = () => {
    setUser({
      name: 'Guest Driver',
      email: '',
      cdlNumber: '',
      truckNumber: '',
      carrier: '',
      homeTerminal: '',
      isGuest: true,
    });
  };
  
  const login = async (email, password) => {
    try {
      const res = await fetch(`${API_URL}/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });
      const data = await res.json();
      if (data.status === 'success') {
        setUser({
          ...data.user,
          cdlNumber: '',
          truckNumber: '',
          carrier: '',
          homeTerminal: '',
          isGuest: false,
        });
        return { success: true };
      }
      return { success: false, error: data.error || 'Invalid credentials' };
    } catch (e) {
      return { success: false, error: 'Network error' };
    }
  };

  const register = async (email, password) => {
    try {
      const res = await fetch(`${API_URL}/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });
      const data = await res.json();
      if (data.status === 'success') {
        setUser({
          ...data.user,
          cdlNumber: '',
          truckNumber: '',
          carrier: '',
          homeTerminal: '',
          isGuest: false,
        });
        return { success: true };
      }
      return { success: false, error: data.error || 'Registration failed' };
    } catch (e) {
      return { success: false, error: 'Network error' };
    }
  };
  
  const logout = async () => {
    try {
      await fetch(`${API_URL}/logout/`, { method: 'POST', credentials: 'include' });
    } catch (e) {}
    setUser(null);
  };
  
  const updateProfile = (updates) => {
    setUser(prev => prev ? { ...prev, ...updates } : null);
  };
  
  return (
    <AuthContext.Provider value={{
      user,
      login,
      register,
      loginAsGuest,
      logout,
      updateProfile,
      isAuthenticated: !!user,
      loading
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
