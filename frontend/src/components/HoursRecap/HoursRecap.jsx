import React from 'react';
import { Info, BarChart3 } from 'lucide-react';
import './HoursRecap.css';

const HoursRecap = ({ active = false, dailyLogs = {} }) => {
  let data = [];
  
  if (active && Object.keys(dailyLogs).length > 0) {
    const days = Object.keys(dailyLogs).sort((a, b) => Number(a) - Number(b)).slice(0, 7);
    data = days.map(dayKey => {
      const log = dailyLogs[dayKey];
      return {
        day: `Day ${log.day}`,
        onDuty: log.total_on_duty_not_driving || 0,
        driving: log.total_driving || 0
      };
    });
    
    // Pad to 7 items if we have less than 7 days
    while (data.length < 7) {
      data.push({ day: '-', onDuty: 0, driving: 0 });
    }
  } else {
    data = [
      { day: 'Day 1', onDuty: 0, driving: 0 },
      { day: 'Day 2', onDuty: 0, driving: 0 },
      { day: 'Day 3', onDuty: 0, driving: 0 },
      { day: 'Day 4', onDuty: 0, driving: 0 },
      { day: 'Day 5', onDuty: 0, driving: 0 },
      { day: 'Day 6', onDuty: 0, driving: 0 },
      { day: 'Day 7', onDuty: 0, driving: 0 },
    ];
  }

  const maxHours = 14;
  const totalHours = data.reduce((sum, d) => sum + d.onDuty + d.driving, 0);

  const [showInfo, setShowInfo] = React.useState(false);

  // Close popup when clicking outside (simple hack: close on mouse leave or just toggle)

  return (
    <div className="hours-recap-card">
      <div className="recap-header">
        <div>
          <h3 className="recap-title">7-Day Hours Recap</h3>
          <p className="recap-subtitle">70-Hour / 8-Day Cycle</p>
        </div>
        <div className="info-icon-container">
          <Info 
            className="info-icon" 
            size={20} 
            onClick={() => setShowInfo(!showInfo)}
          />
          {showInfo && (
            <div className="recap-info-popup">
              <h4>70-Hour / 8-Day Rule</h4>
              <p>A driver may not drive after 70 hours on duty in 8 consecutive days. This chart shows your progress against this limit.</p>
            </div>
          )}
        </div>
      </div>

      <div className="chart-container">
        <div className="y-axis">
          <span>12h</span>
          <span>8h</span>
          <span>4h</span>
          <span>0h</span>
        </div>
        <div className="chart-bars">
          {data.map((item, index) => {
            const onDutyHeight = (item.onDuty / maxHours) * 100;
            const drivingHeight = (item.driving / maxHours) * 100;
            const isToday = index === data.length - 1;

            return (
              <div key={index} className="bar-wrapper">
                <div className={`bar-column ${isToday ? 'today' : ''}`}>
                  <div 
                    className="bar-driving" 
                    style={{ height: `${drivingHeight}%` }}
                    title={`Driving: ${item.driving}h`}
                  ></div>
                  <div 
                    className="bar-on-duty" 
                    style={{ height: `${onDutyHeight}%` }}
                    title={`On Duty: ${item.onDuty}h`}
                  ></div>
                </div>
                <div className="bar-label">{item.day}</div>
              </div>
            );
          })}
        </div>
      </div>

      {!active && (
        <div className="recap-empty-hint">
          <BarChart3 size={16} />
          <span>Data will populate after trip planning</span>
        </div>
      )}

      <div className="recap-footer">
        <div className="total-text">Total: {totalHours.toFixed(1)} / 70.0 hrs</div>
        <div className="progress-bar-container">
          <div className="progress-bar-fill" style={{ width: `${(totalHours / 70) * 100}%` }}></div>
        </div>
      </div>
    </div>
  );
};

export default HoursRecap;
