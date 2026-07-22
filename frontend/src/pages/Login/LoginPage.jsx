import React, { useState } from 'react';
import { Truck, Mail, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './LoginPage.css';

const LoginPage = () => {
  const { login, register, loginAsGuest } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [forgotPopup, setForgotPopup] = useState('');
  
  const handleAuth = async (e) => {
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
    
    if (isRegistering) {
      const res = await register(email, password);
      if (!res.success) setError(res.error);
    } else {
      const res = await login(email, password);
      if (!res.success) setError(res.error);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address first.');
      return;
    }
    try {
      const res = await fetch('http://localhost:8000/api/auth/forgot-password/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setForgotPopup(data.message);
        setTimeout(() => setForgotPopup(''), 4000);
      }
    } catch (e) {
      setError('Failed to send request.');
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

        <form className="login-form" onSubmit={handleAuth}>
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
            <div style={{ position: 'relative' }}>
              <a href="#" className="forgot-password" onClick={handleForgot}>Forgot password?</a>
              {forgotPopup && (
                <div style={{
                  position: 'absolute', top: '-45px', right: 0, backgroundColor: 'var(--primary-accent)', 
                  color: 'white', padding: '8px 12px', borderRadius: '6px', fontSize: '12px',
                  boxShadow: '0 4px 12px rgba(37,99,235,0.3)', whiteSpace: 'nowrap', zIndex: 10
                }}>
                  {forgotPopup}
                </div>
              )}
            </div>
          </div>
          
          <button type="submit" className="btn-primary">
            {isRegistering ? 'Create Account' : 'Sign In'}
          </button>
        </form>
        
        <div className="auth-toggle">
          {isRegistering ? "Already have an account? " : "Don't have an account? "}
          <button type="button" className="text-btn" onClick={() => { setIsRegistering(!isRegistering); setError(''); }}>
            {isRegistering ? 'Sign In' : 'Sign Up'}
          </button>
        </div>
        
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
