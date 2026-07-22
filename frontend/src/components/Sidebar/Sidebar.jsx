import React from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  ClipboardList, 
  User, 
  Settings, 
  HelpCircle,
  ShieldCheck,
  Truck,
  LogOut
} from 'lucide-react';
import './Sidebar.css';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'logs', label: 'Logs', icon: FileText },
  { id: 'records', label: 'Records', icon: ClipboardList },
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'help', label: 'Help', icon: HelpCircle },
];

const Sidebar = ({ currentPage = 'dashboard', onNavigate, onLogout, user }) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <Truck className="sidebar-logo-icon" size={28} />
        <span className="sidebar-logo-text">LogMapper ELD</span>
      </div>

      <nav className="sidebar-nav">
        <ul>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <li key={item.id}>
                <button 
                  className={`nav-button ${isActive ? 'active' : ''}`}
                  onClick={() => onNavigate && onNavigate(item.id)}
                >
                  <Icon size={20} className="nav-icon" />
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="sidebar-footer">
        {onLogout && (
          <button className="logout-button" onClick={onLogout}>
            <LogOut size={18} />
            <span>{user?.isGuest ? 'Login' : 'Sign Out'}</span>
          </button>
        )}
        <div className="fmcsa-badge">
          <ShieldCheck size={16} />
          <span>FMCSA Compliant</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
