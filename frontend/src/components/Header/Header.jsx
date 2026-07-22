import React, { useState, useEffect } from 'react';
import { Bell, User } from 'lucide-react';
import './Header.css';

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  logs: 'Logbook',
  records: 'Records',
  profile: 'Profile',
  settings: 'Settings',
  help: 'Help Center',
};

const Header = ({ currentPage = 'dashboard', user }) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formattedDate = currentTime.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const formattedTime = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  const driverName = user?.name || 'Guest Driver';
  const truckNumber = user?.truckNumber || 'TRK-0000';
  const pageTitle = PAGE_TITLES[currentPage] || 'Dashboard';

  return (
    <header className="header">
      <div className="header-left">
        <h1 className="page-title">{pageTitle}</h1>
      </div>
      
      <div className="header-right">
        <div className="driver-info">
          <span className="driver-name">
            <User size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            {driverName}
            {user?.isGuest && <span className="guest-tag">GUEST</span>}
          </span>
          <span className="truck-number">{truckNumber}</span>
        </div>

        <div className="datetime-display">
          <span className="date">{formattedDate}</span>
          <span className="time">{formattedTime}</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
