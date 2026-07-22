import React, { useState } from 'react';
import { Bell, Monitor, Clock, Shield, Info, AlertTriangle, Trash2, Download, Eraser } from 'lucide-react';
import './SettingsPage.css';

const SettingsPage = () => {
  const [toggles, setToggles] = useState(() => {
    const saved = localStorage.getItem('eld-toggles');
    return saved ? JSON.parse(saved) : {
      hosAlerts: true,
      breakReminders: true,
      shiftEndWarnings: true,
      emailNotifications: false,
      pushNotifications: true,
    };
  });

  const [displaySettings, setDisplaySettings] = useState(() => {
    const saved = localStorage.getItem('eld-displaySettings');
    return saved ? JSON.parse(saved) : {
      timeFormat: '12-Hour (AM/PM)',
      distanceUnits: 'Miles',
      theme: 'Light'
    };
  });

  const [hosRules, setHosRules] = useState(() => {
    const saved = localStorage.getItem('eld-hosRules');
    return saved ? JSON.parse(saved) : {
      cycleRule: '70-Hour/8-Day',
    };
  });

  // Apply theme and save settings
  React.useEffect(() => {
    localStorage.setItem('eld-toggles', JSON.stringify(toggles));
    localStorage.setItem('eld-displaySettings', JSON.stringify(displaySettings));
    localStorage.setItem('eld-hosRules', JSON.stringify(hosRules));

    // Handle Theme
    const isDark = displaySettings.theme === 'Dark' || 
                   (displaySettings.theme === 'System' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    if (isDark) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }, [toggles, displaySettings, hosRules]);

  const handleToggle = (key) => {
    setToggles(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDisplayChange = (key, value) => {
    setDisplaySettings(prev => ({ ...prev, [key]: value }));
  };

  const [showConfirm, setShowConfirm] = useState(false);

  const ruleConfig = {
    'US 70-Hour/8-Day (Federal)': {
      shiftLimit: '14 consecutive hours',
      driveLimit: '11 hours maximum',
      restPeriod: '10 consecutive hours',
      restart: '34 consecutive hours',
      break: '30 mins after 8 hours driving'
    },
    'US 60-Hour/7-Day (Federal)': {
      shiftLimit: '14 consecutive hours',
      driveLimit: '11 hours maximum',
      restPeriod: '10 consecutive hours',
      restart: '34 consecutive hours',
      break: '30 mins after 8 hours driving'
    },
    'California Intrastate (80/8)': {
      shiftLimit: '16 consecutive hours',
      driveLimit: '12 hours maximum',
      restPeriod: '10 consecutive hours',
      restart: '34 consecutive hours',
      break: '30 mins after 8 hours driving'
    },
    'Canada South (70/7)': {
      shiftLimit: '16 consecutive hours',
      driveLimit: '13 hours maximum',
      restPeriod: '10 hours (min 8 consecutive)',
      restart: '36 consecutive hours',
      break: 'Not federally required (30m optional)'
    }
  };

  const selectedRule = ruleConfig[hosRules.cycleRule] || ruleConfig['US 70-Hour/8-Day (Federal)'];

  return (
    <div className="settings-page-container">
      <div className="settings-page-header">
        <h1>Settings</h1>
        <p>Configure your ELD preferences</p>
      </div>

      <div className="settings-grid">
        {/* Notification Settings */}
        <div className="settings-card">
          <div className="card-header">
            <Bell className="card-icon" />
            <h3>Notification Settings</h3>
          </div>
          <div className="card-body">
            <div className="toggle-row">
              <div className="toggle-info">
                <h4>HOS Violation Alerts</h4>
                <p>Get notified when approaching violations</p>
              </div>
              <label className="switch">
                <input type="checkbox" checked={toggles.hosAlerts} onChange={() => handleToggle('hosAlerts')} />
                <span className="slider round"></span>
              </label>
            </div>
            <div className="toggle-row">
              <div className="toggle-info">
                <h4>Break Reminders</h4>
                <p>Alert 30 mins before required breaks</p>
              </div>
              <label className="switch">
                <input type="checkbox" checked={toggles.breakReminders} onChange={() => handleToggle('breakReminders')} />
                <span className="slider round"></span>
              </label>
            </div>
            <div className="toggle-row">
              <div className="toggle-info">
                <h4>Shift End Warnings</h4>
                <p>Notifications for 14-hour shift limits</p>
              </div>
              <label className="switch">
                <input type="checkbox" checked={toggles.shiftEndWarnings} onChange={() => handleToggle('shiftEndWarnings')} />
                <span className="slider round"></span>
              </label>
            </div>
            <div className="toggle-row">
              <div className="toggle-info">
                <h4>Email Notifications</h4>
                <p>Receive daily summary reports via email</p>
              </div>
              <label className="switch">
                <input type="checkbox" checked={toggles.emailNotifications} onChange={() => handleToggle('emailNotifications')} />
                <span className="slider round"></span>
              </label>
            </div>
            <div className="toggle-row">
              <div className="toggle-info">
                <h4>Push Notifications</h4>
                <p>Important alerts pushed to device</p>
              </div>
              <label className="switch">
                <input type="checkbox" checked={toggles.pushNotifications} onChange={() => handleToggle('pushNotifications')} />
                <span className="slider round"></span>
              </label>
            </div>
          </div>
        </div>

        {/* HOS Rules */}
        <div className="settings-card">
          <div className="card-header">
            <Clock className="card-icon" />
            <h3>HOS Rules Configuration</h3>
          </div>
          <div className="card-body">
            <div className="setting-group">
              <h4>Cycle Rule</h4>
              <select className="select-input" value={hosRules.cycleRule} onChange={(e) => setHosRules({ cycleRule: e.target.value })}>
                <option value="US 70-Hour/8-Day (Federal)">US 70-Hour/8-Day (Federal)</option>
                <option value="US 60-Hour/7-Day (Federal)">US 60-Hour/7-Day (Federal)</option>
                <option value="California Intrastate (80/8)">California Intrastate (80/8)</option>
                <option value="Canada South (70/7)">Canada South (70/7)</option>
              </select>
            </div>
            
            <div className="readonly-rule">
              <span className="rule-label">Shift Limit</span>
              <span className="rule-value">{selectedRule.shiftLimit}</span>
            </div>
            <div className="readonly-rule">
              <span className="rule-label">Driving Limit</span>
              <span className="rule-value">{selectedRule.driveLimit}</span>
            </div>
            <div className="readonly-rule">
              <span className="rule-label">Rest Period</span>
              <span className="rule-value">{selectedRule.restPeriod}</span>
            </div>
            <div className="readonly-rule">
              <span className="rule-label">Restart Period</span>
              <span className="rule-value">{selectedRule.restart}</span>
            </div>
            <div className="readonly-rule">
              <span className="rule-label">Break Requirement</span>
              <span className="rule-value">{selectedRule.break}</span>
            </div>
          </div>
        </div>

        {/* Data & Privacy */}
        <div className="settings-card">
          <div className="card-header">
            <Shield className="card-icon" />
            <h3>Data & Privacy</h3>
          </div>
          <div className="card-body">
            <div className="button-group-vertical">
              <button className="btn-outline">
                <Download size={18} /> Export All Data
              </button>
              <button className="btn-outline danger-text">
                <Eraser size={18} /> Clear Local Data
              </button>
              <button className="btn-danger" onClick={() => setShowConfirm(true)}>
                <Trash2 size={18} /> Delete Account
              </button>
            </div>
            
            {showConfirm && (
              <div className="confirm-dialog">
                <AlertTriangle className="alert-icon" />
                <div>
                  <h4>Are you sure?</h4>
                  <p>This action cannot be undone.</p>
                  <div className="dialog-actions">
                    <button className="btn-secondary" onClick={() => setShowConfirm(false)}>Cancel</button>
                    <button className="btn-danger-small" onClick={() => setShowConfirm(false)}>Confirm Delete</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* About */}
        <div className="settings-card about-card">
          <div className="card-header">
            <Info className="card-icon" />
            <h3>About</h3>
          </div>
          <div className="card-body">
            <div className="about-item">
              <span className="about-label">App Version</span>
              <span className="about-value">LogMapper ELD v2.1.0</span>
            </div>
            <div className="about-item">
              <span className="about-label">Build</span>
              <span className="about-value">2026.07.21</span>
            </div>
            <div className="about-item">
              <span className="about-label">ELD Registration</span>
              <span className="about-value">ELD-2847-FMCSA</span>
            </div>
            <div className="about-item">
              <span className="about-label">Last Sync</span>
              <span className="about-value">July 21, 2026 at 12:45 PM</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SettingsPage;
