import { useState, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import './App.css';

// Layout
import Sidebar from './components/Sidebar/Sidebar';
import Header from './components/Header/Header';

// Dashboard components
import HOSChart from './components/HOSChart/HOSChart';
import DriverProfileCard from './components/DriverProfileCard/DriverProfileCard';
import LogEntries from './components/LogEntries/LogEntries';
import ViolationsCard from './components/ViolationsCard/ViolationsCard';
import HoursRecap from './components/HoursRecap/HoursRecap';

// Pages
import LoginPage from './pages/Login/LoginPage';
import LogsPage from './pages/Logs/LogsPage';
import RecordsPage from './pages/Records/RecordsPage';
import ProfilePage from './pages/Profile/ProfilePage';
import SettingsPage from './pages/Settings/SettingsPage';
import HelpPage from './pages/Help/HelpPage';

import { MapPin, Navigation, Truck, ChevronLeft, ChevronRight } from 'lucide-react';

function App() {
  const { user, isAuthenticated, logout } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');

  // ----- Trip Planner State (connected to backend) -----
  const [tripForm, setTripForm] = useState({
    currentLocation: '',
    pickupLocation: '',
    dropoffLocation: '',
    cycleUsed: 0,
  });
  const [tripStatus, setTripStatus] = useState(null);
  const [isPlanning, setIsPlanning] = useState(false);

  // ----- Backend-driven ELD data -----
  const [tripLogs, setTripLogs] = useState([]);
  const [dailyLogs, setDailyLogs] = useState({});
  const [currentDay, setCurrentDay] = useState(1);
  const [hasTripData, setHasTripData] = useState(false);

  const handleNavigate = useCallback((page) => {
    setCurrentPage(page);
  }, []);

  const handleLogout = useCallback(() => {
    logout();
    setCurrentPage('dashboard');
    setTripLogs([]);
    setHosEntries([]);
    setDailyLogs({});
    setHasTripData(false);
    setTripStatus(null);
  }, [logout]);

  const handleTripFormChange = (e) => {
    const { name, value } = e.target;
    setTripForm((prev) => ({
      ...prev,
      [name]: name === 'cycleUsed' ? parseFloat(value) || 0 : value,
    }));
  };

  const handlePlanTrip = async (e) => {
    e.preventDefault();
    setIsPlanning(true);
    setTripStatus({ type: 'loading', message: 'Calculating route & HOS schedule…' });
    setTripLogs([]);
    setDailyLogs({});
    setCurrentDay(1);
    setHasTripData(false);

    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL 
        ? import.meta.env.VITE_API_BASE_URL.replace('/auth', '') 
        : 'http://localhost:8000/api';
      const res = await fetch(`${baseUrl}/plan-trip/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tripForm),
      });
      const data = await res.json();

      if (data.error) {
        setTripStatus({ type: 'error', message: data.error });
      } else {
        setTripStatus({ type: 'success', message: data.message });
        setTripLogs(data.logs || []);
        setDailyLogs(data.daily_logs || {});
        setCurrentDay(1);
        setHasTripData(true);
      }
    } catch {
      setTripStatus({
        type: 'error',
        message: 'Unable to reach the backend. Make sure Django is running on port 8000.',
      });
    } finally {
      setIsPlanning(false);
    }
  };

  // Derive hosEntries dynamically from currentDay
  const hosEntries = dailyLogs[String(currentDay)]?.entries || [];

  // Convert backend logs to LogEntries format (Sync exactly with HOS Chart current day data)
  const formattedLogEntries = hosEntries.length > 0
    ? hosEntries.slice(0, 10).map((log, i) => {
        const startH = log.start_hour || 0;
        const endH = log.end_hour || 0;
        const formatTime = (h) => {
          const hrs = Math.floor(h);
          const mins = Math.round((h - hrs) * 60);
          const period = hrs >= 12 ? 'PM' : 'AM';
          const display = hrs === 0 ? 12 : hrs > 12 ? hrs - 12 : hrs;
          return `${display}:${String(mins).padStart(2, '0')} ${period}`;
        };
        const duration = log.hours || 0;
        const durH = Math.floor(duration);
        const durM = Math.round((duration - durH) * 60);
        const statusMap = { D: 'Driving', ON: 'On Duty (Not Driving)', OFF: 'Off Duty', SB: 'Sleeper Berth' };
        
        let locationStr = '—';
        if (log.status_code === 'D') {
          locationStr = 'En Route';
        } else if (i === 0) {
          locationStr = tripForm.currentLocation || 'Origin';
        } else if (i === hosEntries.length - 1) {
          locationStr = tripForm.dropoffLocation || 'Destination';
        } else {
          locationStr = tripForm.pickupLocation || 'Stop';
        }

        return {
          id: i + 1,
          time: `${formatTime(startH)} - ${formatTime(endH)}`,
          duration: `${durH}h ${String(durM).padStart(2, '0')}m`,
          status: statusMap[log.status_code] || log.status_label || 'Unknown',
          vehicle: user?.truckNumber || 'TRK-0000',
          location: locationStr,
        };
      })
    : [];

  // ===============================
  // If not authenticated → show Login
  // ===============================
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Calculate remaining hours for StatusCard
  let driveTotal = 0;
  let shiftTotal = 0;
  if (hosEntries) {
    hosEntries.forEach(e => {
      if (e.status_code === 'D') driveTotal += e.hours;
      if (e.status_code === 'D' || e.status_code === 'ON') shiftTotal += e.hours;
    });
  }
  const driveRemaining = Math.max(0, 11 - driveTotal);
  const shiftRemaining = Math.max(0, 14 - shiftTotal);
  const cycleRemaining = Math.max(0, 70 - shiftTotal - (tripForm.cycleUsed || 0));

  // Derive current status from the last log entry
  const lastLog = tripLogs.length > 0 ? tripLogs[tripLogs.length - 1] : null;
  const statusCodeToLabel = { D: 'DRIVING', ON: 'ON DUTY', OFF: 'OFF DUTY', SB: 'SLEEPER' };
  const currentStatus = lastLog ? (statusCodeToLabel[lastLog.status_code] || lastLog.status_label || 'OFF DUTY') : 'OFF DUTY';
  const currentStatusCode = lastLog ? lastLog.status_code : 'OFF';

  // ===============================
  // Render the page for current nav
  // ===============================
  const renderPage = () => {
    switch (currentPage) {
      case 'logs':
        return <LogsPage 
                 hosEntries={hosEntries} 
                 tripForm={tripForm} 
                 currentDay={currentDay}
                 setCurrentDay={setCurrentDay}
                 totalDays={Object.keys(dailyLogs).length}
               />;
      case 'records':
        return <RecordsPage 
                 active={hasTripData} 
                 dailyLogs={dailyLogs} 
                 onViewRecord={(dayId) => {
                   setCurrentDay(parseInt(dayId));
                   handleNavigate('logs');
                 }}
               />;
      case 'profile':
        return <ProfilePage />;
      case 'settings':
        return <SettingsPage />;
      case 'help':
        return <HelpPage />;
      case 'dashboard':
      default:
        return (
          <div className="dashboard-container">
            {/* ---- HOS Timeline (Full Width) ---- */}
            <section className="dashboard-hos-section" id="hos-summary">
              {hasTripData && Object.keys(dailyLogs).length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '0 8px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>Daily Activity Log</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-main)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <button 
                      className="icon-btn" 
                      onClick={() => setCurrentDay(Math.max(1, currentDay - 1))}
                      disabled={currentDay === 1}
                      style={{ padding: '4px', opacity: currentDay === 1 ? 0.3 : 1, cursor: currentDay === 1 ? 'not-allowed' : 'pointer' }}
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <span style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)', width: '85px', textAlign: 'center' }}>
                      Day {currentDay} of {Object.keys(dailyLogs).length}
                    </span>
                    <button 
                      className="icon-btn" 
                      onClick={() => setCurrentDay(Math.min(Object.keys(dailyLogs).length, currentDay + 1))}
                      disabled={currentDay === Object.keys(dailyLogs).length}
                      style={{ padding: '4px', opacity: currentDay === Object.keys(dailyLogs).length ? 0.3 : 1, cursor: currentDay === Object.keys(dailyLogs).length ? 'not-allowed' : 'pointer' }}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              )}
              <HOSChart entries={hosEntries} />
            </section>

            {/* ---- Middle Row: Status + Log Table ---- */}
            <section className="dashboard-middle-grid">
              <div id="current-status">
                <DriverProfileCard user={user} />
              </div>
              <div id="log-entries">
                <LogEntries
                  entries={formattedLogEntries}
                  currentDay={currentDay}
                  onViewLogbook={() => handleNavigate('logs')}
                  onEditLog={() => handleNavigate('logs')}
                  onCertifyLog={() => {}}
                />
              </div>
            </section>

            {/* ---- Bottom Row: Violations + 7-Day Recap ---- */}
            <section className="dashboard-bottom-grid">
              <div id="violations-card">
                <ViolationsCard />
              </div>
              <div id="hours-recap">
                <HoursRecap active={hasTripData} dailyLogs={dailyLogs} />
              </div>
            </section>

            {/* ---- Trip Planner (Connected to Backend) ---- */}
            <section className="dashboard-trip-section" id="trip-planner">
              <div className="trip-planner-card">
                <h2>
                  <Navigation size={20} />
                  Trip Planner
                </h2>
                <p className="section-subtitle">
                  Plan a route with FMCSA-compliant HOS scheduling
                </p>

                <form className="trip-form" onSubmit={handlePlanTrip}>
                  <div className="trip-form-group">
                    <label htmlFor="currentLocation">Current Location</label>
                    <input
                      type="text"
                      id="currentLocation"
                      name="currentLocation"
                      value={tripForm.currentLocation}
                      onChange={handleTripFormChange}
                      placeholder="e.g., Chicago, IL"
                      required
                    />
                  </div>

                  <div className="trip-form-group">
                    <label htmlFor="pickupLocation">Pickup Location</label>
                    <input
                      type="text"
                      id="pickupLocation"
                      name="pickupLocation"
                      value={tripForm.pickupLocation}
                      onChange={handleTripFormChange}
                      placeholder="e.g., Detroit, MI"
                      required
                    />
                  </div>

                  <div className="trip-form-group">
                    <label htmlFor="dropoffLocation">Dropoff Location</label>
                    <input
                      type="text"
                      id="dropoffLocation"
                      name="dropoffLocation"
                      value={tripForm.dropoffLocation}
                      onChange={handleTripFormChange}
                      placeholder="e.g., Atlanta, GA"
                      required
                    />
                  </div>

                  <div className="trip-form-group">
                    <label htmlFor="cycleUsed">Cycle Used (hrs)</label>
                    <input
                      type="number"
                      id="cycleUsed"
                      name="cycleUsed"
                      value={tripForm.cycleUsed}
                      onChange={handleTripFormChange}
                      min="0"
                      max="70"
                      step="0.5"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="trip-submit-btn"
                    disabled={isPlanning}
                  >
                    {isPlanning ? 'Planning…' : 'Plan Trip'}
                  </button>
                </form>

                {tripStatus && tripStatus.type !== 'success' && (
                  <div className={`trip-status ${tripStatus.type}`}>
                    {tripStatus.type === 'loading' && <Truck size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />}
                    {tripStatus.message}
                  </div>
                )}

                {hasTripData && tripStatus?.type === 'success' && (
                  <div className="trip-results-block" style={{ marginTop: '24px', background: 'var(--bg-main)', borderRadius: '12px', padding: '20px', border: '1px solid var(--primary-accent)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--primary-accent)' }}>
                      <MapPin size={20} />
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Trip Successfully Planned</h3>
                    </div>
                    
                    {(() => {
                      let tDrive = 0, tDuty = 0, tMiles = 0;
                      Object.values(dailyLogs).forEach(log => {
                        tDrive += (log.total_driving || 0);
                        tDuty += (log.total_on_duty_not_driving || 0);
                        tMiles += (log.total_miles || 0);
                      });
                      
                      const formatH = (dec) => {
                        const h = Math.floor(dec);
                        const m = Math.round((dec - h) * 60);
                        return `${h}h ${String(m).padStart(2, '0')}m`;
                      };

                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                          <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Total Est. Miles</div>
                            <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{Math.round(tMiles).toLocaleString()}</div>
                          </div>
                          <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Total Driving</div>
                            <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--status-driving)' }}>{formatH(tDrive)}</div>
                          </div>
                          <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Total On-Duty</div>
                            <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--status-onduty)' }}>{formatH(tDuty)}</div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </section>
          </div>
        );
    }
  };

  return (
    <div className="app-layout">
      <Sidebar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        user={user}
      />
      <Header currentPage={currentPage} user={user} />

      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;