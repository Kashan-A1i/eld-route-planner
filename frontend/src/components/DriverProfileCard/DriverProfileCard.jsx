import React, { useState, useEffect } from 'react';
import { User, Truck, Building2, MapPin, Hash, UserCircle2 } from 'lucide-react';
import './DriverProfileCard.css';

const DriverProfileCard = ({ user }) => {
  const [carrierInfo, setCarrierInfo] = useState({
    carrierName: '',
    mainOffice: '',
    homeTerminal: ''
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem('carrierInfo');
      if (saved) {
        setCarrierInfo(JSON.parse(saved));
      }
    } catch (e) {}
  }, []);

  return (
    <div className="driver-profile-card">
      <div className="profile-header">
        <div className="avatar">
          <UserCircle2 size={40} strokeWidth={1.5} />
        </div>
        <div className="profile-titles">
          <h3 className="driver-name">{user?.name || 'Unknown Driver'}</h3>
          <span className="driver-role">Commercial Driver</span>
        </div>
      </div>

      <div className="profile-details">
        <div className="detail-row">
          <div className="detail-icon"><User size={16} /></div>
          <div className="detail-text">
            <span className="detail-label">Username</span>
            <span className="detail-val">{user?.username || 'Not Set'}</span>
          </div>
        </div>

        <div className="detail-row">
          <div className="detail-icon"><Truck size={16} /></div>
          <div className="detail-text">
            <span className="detail-label">Active Vehicle</span>
            <span className="detail-val">{user?.truckNumber || 'Not Set'}</span>
          </div>
        </div>

        <div className="detail-row">
          <div className="detail-icon"><Building2 size={16} /></div>
          <div className="detail-text">
            <span className="detail-label">Carrier Name</span>
            <span className="detail-val">{carrierInfo.carrierName || 'Not Set'}</span>
          </div>
        </div>

        <div className="detail-row">
          <div className="detail-icon"><MapPin size={16} /></div>
          <div className="detail-text">
            <span className="detail-label">Home Terminal</span>
            <span className="detail-val">{carrierInfo.homeTerminal || 'Not Set'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverProfileCard;
