import React from 'react';
import { FileText } from 'lucide-react';
import './LogEntries.css';

const LogEntries = ({ entries = [], currentDay = 1, onViewLogbook, onEditLog }) => {
  const hasData = entries && entries.length > 0;

  const getStatusClass = (status) => {
    const s = status.toLowerCase();
    if (s.includes('off duty')) return 'status-off-duty';
    if (s.includes('on duty')) return 'status-on-duty';
    if (s.includes('driving')) return 'status-driving';
    if (s.includes('sleeper')) return 'status-sleeper';
    return '';
  };

  return (
    <div className="log-entries-card">
      <div className="log-header">
        <h2>Day {currentDay} Log Entries</h2>
        <span className="log-badge">{entries.length} Entries</span>
      </div>

      {hasData ? (
        <div className="table-container">
          <table className="log-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Vehicle</th>
                <th>Location</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <tr key={entry.id}>
                  <td>{entry.time}</td>
                  <td>{entry.duration}</td>
                  <td>
                    <span className={`status-badge ${getStatusClass(entry.status)}`}>
                      {entry.status}
                    </span>
                  </td>
                  <td>{entry.vehicle}</td>
                  <td>{entry.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="log-empty-state">
          <FileText size={40} strokeWidth={1.2} className="log-empty-icon" />
          <p className="log-empty-title">No log entries yet</p>
          <p className="log-empty-sub">Entries will appear here after you plan a trip</p>
        </div>
      )}

      <div className="log-actions">
        <button className="btn-outline" onClick={onViewLogbook}>View Logbook</button>
        <button className="btn-outline" onClick={onEditLog}>Edit Log</button>
      </div>
    </div>
  );
};

export default LogEntries;
