import React from 'react';
import { ShieldCheck, Check } from 'lucide-react';
import './ViolationsCard.css';

const ViolationsCard = () => {
  return (
    <div className="violations-card">
      <div className="violations-header">
        <h3 className="violations-title">Violations</h3>
        <ShieldCheck className="shield-icon" size={24} />
      </div>
      
      <div className="violations-content">
        <div className="violations-count">0</div>
        <div className="violations-subtitle">No violations detected</div>
      </div>

      <ul className="rules-list">
        <li>
          <span>11-Hour Rule</span>
          <Check className="check-icon" size={16} />
        </li>
        <li>
          <span>14-Hour Rule</span>
          <Check className="check-icon" size={16} />
        </li>
        <li>
          <span>30-Min Break</span>
          <Check className="check-icon" size={16} />
        </li>
        <li>
          <span>70-Hour Rule</span>
          <Check className="check-icon" size={16} />
        </li>
      </ul>
    </div>
  );
};

export default ViolationsCard;
