import React from 'react';
import { Calendar, Clock } from 'lucide-react';
import './HOSChart.css';

const STATUS_ROWS = [
  { id: 'OFF', label: '1. Off Duty', colorVar: 'var(--color-off-duty)' },
  { id: 'SB', label: '2. Sleeper Berth', colorVar: 'var(--color-sleeper)' },
  { id: 'D', label: '3. Driving', colorVar: 'var(--color-driving)' },
  { id: 'ON', label: '4. On Duty (Not Driving)', colorVar: 'var(--color-on-duty)' }
];

const HOSChart = ({ entries = [], date = new Date().toLocaleDateString() }) => {
  const hasData = entries && entries.length > 0;

  // Calculate total hours per status
  const totals = { OFF: 0, SB: 0, D: 0, ON: 0 };
  if (hasData) {
    entries.forEach(entry => {
      if (totals[entry.status_code] !== undefined) {
        totals[entry.status_code] += entry.hours;
      }
    });
  }

  const renderBars = () => {
    if (!hasData) return null;

    const elements = [];

    entries.forEach((entry, index) => {
      const rowIndex = STATUS_ROWS.findIndex(r => r.id === entry.status_code);
      if (rowIndex === -1) return;

      const top = `${rowIndex * 25 + 12.5}%`;
      const left = `${(entry.start_hour / 24) * 100}%`;
      const width = `${(entry.hours / 24) * 100}%`;

      // Horizontal Status Bar
      elements.push(
        <div
          key={`bar-${index}`}
          className="hos-bar"
          style={{
            top,
            left,
            width,
            backgroundColor: STATUS_ROWS[rowIndex].colorVar
          }}
          title={`${entry.status_code}: ${entry.start_hour} - ${entry.end_hour} (${entry.hours}h)`}
        />
      );

      // Vertical Transition Connecting Line
      if (index > 0) {
        const prevEntry = entries[index - 1];
        if (prevEntry.end_hour === entry.start_hour && prevEntry.status_code !== entry.status_code) {
          const prevRowIndex = STATUS_ROWS.findIndex(r => r.id === prevEntry.status_code);
          const minRow = Math.min(rowIndex, prevRowIndex);
          const maxRow = Math.max(rowIndex, prevRowIndex);

          const tTop = `${minRow * 25 + 12.5}%`;
          const tHeight = `${(maxRow - minRow) * 25}%`;

          elements.push(
            <div
              key={`trans-${index}`}
              className="hos-transition"
              style={{
                left,
                top: tTop,
                height: tHeight
              }}
            />
          );
        }
      }
    });

    return elements;
  };

  return (
    <div className="hos-card">
      <div className="hos-header">
        <div>
          <h2 className="hos-title">Hours of Service — Daily Log</h2>
          <div className="hos-subtitle">
            <Calendar size={16} />
            <span>{date}</span>
          </div>
        </div>
      </div>

      <div className="hos-chart-body">
        {/* Left Y-Axis Labels */}
        <div className="hos-y-axis">
          {STATUS_ROWS.map(row => (
            <div key={row.id} className="hos-y-label">
              {row.label}
            </div>
          ))}
        </div>

        {/* Main 24h Timeline Grid */}
        <div className="hos-timeline-container">
          {/* Top X-Axis Labels */}
          <div className="hos-x-axis-labels">
            {Array.from({ length: 25 }).map((_, i) => {
              let label = i % 12 || 12;
              if (i === 0) label = 'Mid';
              else if (i === 12) label = 'Noon';
              else if (i === 24) label = 'Mid';

              return (
                <div
                  key={`x-label-${i}`}
                  className="hos-x-label"
                  style={{ left: `${(i / 24) * 100}%` }}
                >
                  {label}
                </div>
              );
            })}
          </div>

          {/* Background Columns: Hours & Quarter Hours Gridlines */}
          <div className="hos-grid-bg">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={`bg-hour-${i}`} className="hos-hour-block">
                <div className="hos-quarter-block"></div>
                <div className="hos-quarter-block half"></div>
                <div className="hos-quarter-block"></div>
                <div className="hos-quarter-block"></div>
              </div>
            ))}
          </div>

          {/* Horizontal Row Divider Lines */}
          <div className="hos-row-lines">
            {STATUS_ROWS.map((_, i) => (
              <div key={`row-line-${i}`} className="hos-row-line"></div>
            ))}
          </div>

          {/* Data Bars Layer */}
          <div className="hos-bars-layer">
            {renderBars()}
          </div>

          {/* Empty State Overlay */}
          {!hasData && (
            <div className="hos-empty-overlay">
              <Clock size={32} className="hos-empty-icon" />
              <p className="hos-empty-text">No log data yet</p>
              <p className="hos-empty-sub">Plan a trip below to start recording</p>
            </div>
          )}
        </div>

        {/* Right Totals Column */}
        <div className="hos-totals-col">
          <div className="hos-total-header">Total</div>
          {STATUS_ROWS.map(row => (
            <div key={`total-${row.id}`} className="hos-total-val">
              {totals[row.id].toFixed(1)}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Footer Summary */}
      <div className="hos-footer">
        {STATUS_ROWS.map(row => (
          <div key={`summary-${row.id}`} className="hos-summary-item">
            <div
              className="hos-summary-dot"
              style={{ backgroundColor: row.colorVar }}
            />
            <span className="hos-summary-text">
              {row.label.substring(3)}: {totals[row.id].toFixed(1)}h
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HOSChart;
