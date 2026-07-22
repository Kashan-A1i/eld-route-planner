import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { User, Truck, Building, Mail, Phone, Hash, CreditCard, ShieldAlert } from 'lucide-react';
import './ProfilePage.css';

const ProfilePage = () => {
  const { user, updateProfile } = useAuth();
  
  // Personal Info State
  const [personalInfo, setPersonalInfo] = useState({
    name: user?.name || '',
    email: user?.email || '',
    cdlNumber: '',
    phone: '',
    homeTerminal: '',
  });

  // Vehicle Info State
  const [vehicleInfo, setVehicleInfo] = useState({
    truckNumber: user?.truckNumber || '',
    trailerNumber: '',
    licensePlate: '',
    makeModel: '',
    vin: '',
  });

  // Carrier Info State
  const [carrierInfo, setCarrierInfo] = useState(() => {
    const saved = localStorage.getItem('eld-carrierInfo');
    return saved ? JSON.parse(saved) : {
      carrierName: '',
      mainOffice: '',
      dotNumber: '',
      mcNumber: '',
    };
  });

  useEffect(() => {
    if (user) {
      setPersonalInfo(prev => ({ ...prev, name: user.name || '', email: user.email || '' }));
      setVehicleInfo(prev => ({ ...prev, truckNumber: user.truckNumber || '' }));
    }
  }, [user]);

  const handlePersonalChange = (e) => {
    const { name, value } = e.target;
    setPersonalInfo(prev => ({ ...prev, [name]: value }));
  };

  const handleVehicleChange = (e) => {
    const { name, value } = e.target;
    setVehicleInfo(prev => ({ ...prev, [name]: value }));
  };

  const savePersonalInfo = () => {
    if (updateProfile) {
      updateProfile({ name: personalInfo.name, email: personalInfo.email });
    }
  };

  const saveVehicleInfo = () => {
    if (updateProfile) {
      updateProfile({ truckNumber: vehicleInfo.truckNumber });
    }
  };

  const handleCarrierChange = (e) => {
    const { name, value } = e.target;
    setCarrierInfo(prev => ({ ...prev, [name]: value }));
  };

  const saveCarrierInfo = () => {
    localStorage.setItem('eld-carrierInfo', JSON.stringify(carrierInfo));
    alert('Carrier information saved locally.');
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <div className="profile-page-container">
      <div className="profile-page-header">
        <h1>Driver Profile</h1>
        <p>Manage your personal & vehicle information</p>
      </div>

      {user?.isGuest && (
        <div className="guest-banner">
          <ShieldAlert size={20} />
          <span>You are using guest mode. Sign in to save your profile.</span>
        </div>
      )}

      <div className="profile-hero-card">
        <div className="profile-avatar">
          {getInitials(user?.name)}
        </div>
        <div className="profile-hero-info">
          <h2>{user?.name || 'Unknown Driver'}</h2>
          <p className="profile-role">Commercial Driver</p>
          <p className="profile-member-since">Member since {new Date().getFullYear()}</p>
        </div>
      </div>

      <div className="profile-grid">
        <div className="profile-card">
          <div className="card-header">
            <User className="card-icon" />
            <h3>Personal Information</h3>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label>Full Name</label>
              <input type="text" name="name" value={personalInfo.name} onChange={handlePersonalChange} />
            </div>
            <div className="form-group">
              <label>Email Address</label>
              <input type="email" name="email" value={personalInfo.email} onChange={handlePersonalChange} />
            </div>
            <div className="form-group">
              <label>CDL Number</label>
              <input type="text" name="cdlNumber" value={personalInfo.cdlNumber} onChange={handlePersonalChange} />
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <input type="tel" name="phone" value={personalInfo.phone} onChange={handlePersonalChange} />
            </div>
            <div className="form-group">
              <label>Home Terminal</label>
              <input type="text" name="homeTerminal" value={personalInfo.homeTerminal} onChange={handlePersonalChange} />
            </div>
            <button className="btn-primary" onClick={savePersonalInfo}>Save Changes</button>
          </div>
        </div>

        <div className="profile-card">
          <div className="card-header">
            <Truck className="card-icon" />
            <h3>Vehicle Information</h3>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label>Truck/Tractor Number</label>
              <input type="text" name="truckNumber" value={vehicleInfo.truckNumber} onChange={handleVehicleChange} />
            </div>
            <div className="form-group">
              <label>Trailer Number</label>
              <input type="text" name="trailerNumber" value={vehicleInfo.trailerNumber} onChange={handleVehicleChange} />
            </div>
            <div className="form-group">
              <label>License Plate</label>
              <input type="text" name="licensePlate" value={vehicleInfo.licensePlate} onChange={handleVehicleChange} />
            </div>
            <div className="form-group">
              <label>Vehicle Make/Model</label>
              <input type="text" name="makeModel" value={vehicleInfo.makeModel} onChange={handleVehicleChange} />
            </div>
            <div className="form-group">
              <label>VIN</label>
              <input type="text" name="vin" value={vehicleInfo.vin} onChange={handleVehicleChange} />
            </div>
            <button className="btn-primary" onClick={saveVehicleInfo}>Update Vehicle</button>
          </div>
        </div>
      </div>

      <div className="profile-card">
        <div className="card-header">
          <Building className="card-icon" />
          <h3>Carrier Information</h3>
        </div>
        <div className="card-body">
          <div className="form-group">
            <label>Carrier Name</label>
            <input type="text" name="carrierName" value={carrierInfo.carrierName} onChange={handleCarrierChange} placeholder="e.g. Acme Trucking" />
          </div>
          <div className="form-group">
            <label>Main Office</label>
            <input type="text" name="mainOffice" value={carrierInfo.mainOffice} onChange={handleCarrierChange} placeholder="Enter full address" />
          </div>
          <div className="form-group">
            <label>DOT Number</label>
            <input type="text" name="dotNumber" value={carrierInfo.dotNumber} onChange={handleCarrierChange} placeholder="USDOT Number" />
          </div>
          <div className="form-group">
            <label>MC Number</label>
            <input type="text" name="mcNumber" value={carrierInfo.mcNumber} onChange={handleCarrierChange} placeholder="MC Number" />
          </div>
          <button className="btn-primary" onClick={saveCarrierInfo}>Save Carrier Info</button>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
