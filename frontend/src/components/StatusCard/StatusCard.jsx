import React from 'react';
import { Truck, Map, Clock, Calendar } from 'lucide-react';
import './StatusCard.css';

const StatusCard = ({ active = false, dailyLogs = {} }) => {
  if (!active || Object.keys(dailyLogs).length === 0) {
    return (
      <div className="status-card">
        <div className="status-card-header">
          <span className="status-label">Trip Summary</span>
        </div>
        <div className="main-timer-section">
          <div className="empty-state-icon">
            <Map size={48} strokeWidth={1.2} />
          </div>
          <div className="main-timer idle">—</div>
          <div className="main-timer-label">No active plan</div>
          <div className="main-timer-hint">Plan a trip to view totals</div>
        </div>
      </div>
    );
  }

  // Calculate totals
  let totalDriveH = 0;
  let totalDutyH = 0;
  let totalMiles = 0;
  const totalDays = Object.keys(dailyLogs).length;

  Object.values(dailyLogs).forEach(log => {
    totalDriveH += (log.summary?.total_driving_hours || 0);
    totalDutyH += (log.summary?.total_on_duty_hours || 0);
    totalMiles += (log.summary?.total_miles || 0);
  });

  const formatHours = (decimalHours) => {
    const h = Math.floor(decimalHours);
    const m = Math.round((decimalHours - h) * 60);
    return `${h}h ${String(m).padStart(2, '0')}m`;
  };

  return (
    <div className="status-card">
      <div className="status-card-header">
        <span className="status-label">Trip Summary</span>
        <div className="status-indicator">
          <span className="pulse-dot" style={{backgroundColor: 'var(--primary-accent)'}}></span>
          <span className="status-text" style={{color: 'var(--primary-accent)'}}>PLANNED</span>
        </div>
      </div>

      <div className="main-timer-section" style={{ padding: '24px 0' }}>
        <div className="main-timer" style={{ fontSize: '48px', fontWeight: 'bold', color: 'var(--text-inverse)' }}>
          {Math.round(totalMiles).toLocaleString()}
        </div>
        <div className="main-timer-label" style={{ color: 'var(--text-inverse-muted)', fontSize: '15px' }}>Total Est. Miles</div>
      </div>

      <div className="sub-timers" style={{ borderTop: '1px solid var(--border-dark)', paddingTop: '20px', gap: '20px' }}>
        <div className="sub-timer" style={{ gap: '12px' }}>
          <div style={{ background: 'rgba(5, 150, 105, 0.1)', padding: '10px', borderRadius: '8px', color: 'var(--status-driving)' }}>
            <Truck size={24} />
          </div>
          <div className="sub-timer-info">
            <div className="sub-timer-label" style={{ fontSize: '13px', color: 'var(--text-inverse-muted)', marginBottom: '4px' }}>Total Driving</div>
            <div className="sub-timer-value" style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-inverse)' }}>{formatHours(totalDriveH)}</div>
          </div>
        </div>
        
        <div className="sub-timer" style={{ gap: '12px' }}>
           <div style={{ background: 'rgba(234, 88, 12, 0.1)', padding: '10px', borderRadius: '8px', color: 'var(--status-onduty)' }}>
            <Clock size={24} />
          </div>
          <div className="sub-timer-info">
            <div className="sub-timer-label" style={{ fontSize: '13px', color: 'var(--text-inverse-muted)', marginBottom: '4px' }}>Total On-Duty</div>
            <div className="sub-timer-value" style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-inverse)' }}>{formatHours(totalDutyH)}</div>
          </div>
        </div>

        <div className="sub-timer" style={{ gap: '12px' }}>
           <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '10px', borderRadius: '8px', color: 'var(--text-inverse-muted)' }}>
            <Calendar size={24} />
          </div>
          <div className="sub-timer-info">
            <div className="sub-timer-label" style={{ fontSize: '13px', color: 'var(--text-inverse-muted)', marginBottom: '4px' }}>Total Days</div>
            <div className="sub-timer-value" style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-inverse)' }}>{totalDays} {totalDays === 1 ? 'Day' : 'Days'}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusCard;
