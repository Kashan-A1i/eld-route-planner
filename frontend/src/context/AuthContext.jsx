import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); 
  
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
  
  const login = (email, password) => {
    if (!email) return false;
    setUser({
      name: email.split('@')[0], // Use email prefix as default name
      email: email,
      cdlNumber: '',
      truckNumber: '',
      carrier: '',
      homeTerminal: '',
      isGuest: false,
    });
    return true;
  };
  
  const logout = () => setUser(null);
  
  const updateProfile = (updates) => {
    setUser(prev => prev ? { ...prev, ...updates } : null);
  };
  
  return (
    <AuthContext.Provider value={{
      user,
      login,
      loginAsGuest,
      logout,
      updateProfile,
      isAuthenticated: !!user
    }}>
      {children}
    </AuthContext.Provider>
  );
};
