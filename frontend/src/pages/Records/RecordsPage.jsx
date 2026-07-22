import React from 'react';
import { Download, CheckCircle, Clock, AlertCircle, Search, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import './RecordsPage.css';

const RecordsPage = ({ active = false, dailyLogs = {} }) => {
  const formatHours = (decimalHours) => {
    const h = Math.floor(decimalHours);
    const m = Math.round((decimalHours - h) * 60);
    return `${h}h ${String(m).padStart(2, '0')}m`;
  };

  const records = Object.values(dailyLogs).map(log => {
    // Generate dates sequentially from today
    const d = new Date();
    d.setDate(d.getDate() + (parseInt(log.day) - 1));
    const dateStr = d.toISOString().split('T')[0];
    const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });

    const driveH = log.summary?.total_driving_hours || 0;
    const dutyH = log.summary?.total_on_duty_hours || 0;

    return {
      id: log.day,
      date: dateStr,
      day: dayName,
      driving: formatHours(driveH),
      onDuty: formatHours(dutyH),
      total: formatHours(driveH + dutyH),
      miles: Math.round(log.summary?.total_miles || 0),
      status: 'Pending'
    };
  });

  const totalRecords = records.length;

  const stats = [
    { label: 'Total Records', value: totalRecords, color: 'var(--text-primary)', icon: <Clock size={20} /> },
    { label: 'Certified', value: 0, color: 'var(--status-driving)', icon: <CheckCircle size={20} /> },
    { label: 'Pending', value: totalRecords, color: 'var(--status-onduty)', icon: <AlertCircle size={20} /> },
    { label: 'Amended', value: 0, color: 'var(--status-sleeper)', icon: <Clock size={20} /> }
  ];

  const getStatusBadge = (status) => {
    let className = 'status-badge ';
    if (status === 'Certified') className += 'status-certified';
    if (status === 'Pending') className += 'status-pending';
    if (status === 'Amended') className += 'status-amended';
    return <span className={className}>{status}</span>;
  };

  return (
    <div className="records-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Records</h1>
          <p className="page-subtitle">Historical duty status records & documents</p>
        </div>
      </div>

      <div className="filter-bar card">
        <div className="filter-inputs">
          <div className="input-group">
            <label>From</label>
            <input type="date" defaultValue="2026-07-01" className="form-input" />
          </div>
          <div className="input-group">
            <label>To</label>
            <input type="date" defaultValue="2026-07-21" className="form-input" />
          </div>
          <div className="input-group">
            <label>Status</label>
            <select className="form-input">
              <option>All Statuses</option>
              <option>Certified</option>
              <option>Pending</option>
              <option>Amended</option>
            </select>
          </div>
          <div className="input-group search-group">
            <label>Search</label>
            <div className="search-input-wrapper">
              <Search size={16} className="search-icon" />
              <input type="text" placeholder="Search records..." className="form-input" />
            </div>
          </div>
        </div>
        <button className="btn-outline"><Download size={16} /> Export CSV</button>
      </div>

      <div className="stats-row">
        {stats.map((stat, i) => (
          <div className="stat-card card" key={i}>
            <div className="stat-icon" style={{ color: stat.color }}>{stat.icon}</div>
            <div className="stat-info">
              <span className="stat-value" style={{ color: stat.color }}>{stat.value}</span>
              <span className="stat-label">{stat.label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="table-card card">
        <table className="records-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Day</th>
              <th>Driving</th>
              <th>On Duty</th>
              <th>Total</th>
              <th>Miles</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.length > 0 ? (
              records.map(record => (
                <tr key={record.id}>
                  <td>{record.date}</td>
                  <td>{record.day}</td>
                  <td>{record.driving}</td>
                  <td>{record.onDuty}</td>
                  <td>{record.total}</td>
                  <td>{record.miles}</td>
                  <td>{getStatusBadge(record.status)}</td>
                  <td>
                    <button className="btn-icon"><Eye size={16} /> View</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>
                  No historical records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
        
        <div className="pagination">
          <span className="pagination-info">
            Showing {records.length > 0 ? `1-${Math.min(10, records.length)} of ${records.length} records` : '0 records'}
          </span>
          <div className="pagination-controls">
            <button className="page-btn" disabled><ChevronLeft size={16} /></button>
            {records.length > 0 ? (
              Array.from({ length: Math.max(1, Math.ceil(records.length / 10)) }, (_, i) => (
                <button key={i} className={`page-btn ${i === 0 ? 'active' : ''}`}>{i + 1}</button>
              ))
            ) : (
              <button className="page-btn active">1</button>
            )}
            <button className="page-btn" disabled><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecordsPage;
