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
      truckNumber: 'TRK-0000',
      carrier: 'Demo Carrier LLC',
      homeTerminal: 'Dallas, TX',
      isGuest: true,
    });
  };
  
  const login = (email, password) => {
    if (!email) return false;
    setUser({
      name: 'John Mitchell',
      email: email,
      cdlNumber: 'TX-CDL-482951',
      truckNumber: 'TRK-4521',
      carrier: 'Mitchell Freight Inc.',
      homeTerminal: 'Dallas, TX',
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
