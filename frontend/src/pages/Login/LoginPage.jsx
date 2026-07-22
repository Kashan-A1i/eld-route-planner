import React, { useState } from 'react';
import { Truck, Mail, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './LoginPage.css';

const LoginPage = () => {
  const { login, loginAsGuest } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  
  const handleLogin = (e) => {
    e.preventDefault();
    setError('');
    
    if (!email) {
      setError('Email is required.');
      return;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    
    const success = login(email, password);
    if (!success) {
      setError('Invalid credentials.');
    }
  };

  return (
    <div className="login-page-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <Truck size={32} className="login-logo-icon" />
            <h1 className="login-title">LogMapper ELD</h1>
          </div>
          <p className="login-subtitle">Electronic Logging Device — FMCSA Compliant</p>
        </div>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form className="login-form" onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div className="input-wrapper">
              <input 
                type="email" 
                className="form-input" 
                placeholder="driver@carrier.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          
          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-wrapper">
              <input 
                type={showPassword ? 'text' : 'password'} 
                className="form-input" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button 
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          
          <div className="form-options">
            <label className="checkbox-wrapper">
              <input type="checkbox" className="checkbox-input" />
              Remember me
            </label>
            <a href="#" className="forgot-password">Forgot password?</a>
          </div>
          
          <button type="submit" className="btn-primary">
            Sign In
          </button>
        </form>
        
        <div className="login-divider">or</div>
        
        <button type="button" className="btn-outline" onClick={loginAsGuest}>
          Continue as Guest
        </button>
        
        <div className="login-footer">
          <div className="footer-text">
            <ShieldCheck size={16} className="footer-icon" />
            <span>FMCSA §395.8 Compliant • ELD Mandate Ready</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
