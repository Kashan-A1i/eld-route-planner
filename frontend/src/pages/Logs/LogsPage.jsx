import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Download, CheckCircle, MapPin, Truck, FileText, Flag } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import HOSChart from '../../components/HOSChart/HOSChart';
import { useAuth } from '../../context/AuthContext';
import './LogsPage.css';

const LogsPage = ({ hosEntries = [], tripForm = {}, currentDay = 1, setCurrentDay, totalDays = 1 }) => {
  const { user } = useAuth();
  
  // Calculate dynamic date based on the trip's current day
  const dateObj = new Date();
  dateObj.setDate(dateObj.getDate() + (currentDay - 1));
  
  const [remarks, setRemarks] = useState([]);
  const [newRemark, setNewRemark] = useState({ time: '', location: '', note: '' });
  
  const [shippingDocs, setShippingDocs] = useState({
    manifestNo: '',
    shipperCommodity: ''
  });

  const [showCertifyPopup, setShowCertifyPopup] = useState(false);

  const handleCertify = () => {
    setShowCertifyPopup(true);
    setTimeout(() => {
      setShowCertifyPopup(false);
    }, 3000);
  };

  const handleAddRemark = () => {
    if (newRemark.time && newRemark.note) {
      // Convert 24h time to 12h time string for display
      const [hours, minutes] = newRemark.time.split(':');
      const h = parseInt(hours, 10);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayHours = h % 12 || 12;
      const timeStr = `${displayHours}:${minutes} ${ampm}`;

      setRemarks([...remarks, { ...newRemark, time: timeStr }]);
      setNewRemark({ time: '', location: '', note: '' });
    }
  };

  const handlePrevDay = () => {
    if (setCurrentDay && currentDay > 1) {
      setCurrentDay(currentDay - 1);
    }
  };

  const handleNextDay = () => {
    if (setCurrentDay && currentDay < totalDays) {
      setCurrentDay(currentDay + 1);
    }
  };

  const handleToday = () => {
    if (setCurrentDay) {
      setCurrentDay(1);
    }
  };

  const currentDateStr = dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const shortDateStr = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Calculate total miles and read saved carrier info
  let totalMiles = 0;
  hosEntries.forEach(e => {
    totalMiles += (e.miles || 0);
  });
  const savedCarrier = JSON.parse(localStorage.getItem('carrierInfo') || '{}');

  const formInfo = {
    date: shortDateStr,
    fromLocation: tripForm.currentLocation || '',
    toLocation: tripForm.dropoffLocation || '',
    carrierName: savedCarrier.carrierName || '',
    mainOffice: savedCarrier.mainOffice || '',
    homeTerminal: savedCarrier.homeTerminal || '',
    truckNumber: user?.truckNumber || '',
    trailerNumber: '',
    totalMilesDriving: totalMiles > 0 ? Math.round(totalMiles) : '',
    totalMileage: totalMiles > 0 ? Math.round(totalMiles) : ''
  };

  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownloadPDF = async () => {
    const element = document.getElementById('logbook-content');
    if (!element) return;
    
    setIsGenerating(true);
    try {
      // Use html2canvas to take a snapshot of the logbook content
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      
      // Generate clean filename like Logbook_July_21_2026.pdf
      const filename = `Logbook_${shortDateStr.replace(/, /g, '_').replace(/ /g, '_')}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };


  return (
    <div className="logs-page" id="logbook-content" style={{ backgroundColor: 'var(--bg-main)' }}>
      <div className="page-header" data-html2canvas-ignore="true">
        <div>
          <h1 className="page-title">Logbook</h1>
          <p className="page-subtitle">View and manage your daily logs</p>
        </div>
      </div>

      <div className="date-navigation" data-html2canvas-ignore="true">
        <button className="icon-btn" onClick={handlePrevDay} disabled={currentDay <= 1}>
          <ChevronLeft size={20} />
        </button>
        <span className="current-date">
          Day {currentDay} • {currentDateStr}
        </span>
        <button className="icon-btn" onClick={handleNextDay} disabled={currentDay >= totalDays}>
          <ChevronRight size={20} />
        </button>
        <button className="today-btn" onClick={handleToday}>Day 1</button>
      </div>

      <div className="card log-form-card">
        <h2 className="section-title"><FileText size={18} /> Driver Daily Log Form</h2>
        <div className="form-grid">
          <div className="form-field">
            <span className="field-label">Date</span>
            <span className="field-value">{formInfo.date}</span>
          </div>
          <div className="form-field">
            <span className="field-label">Carrier Name</span>
            <span className="field-value">{formInfo.carrierName}</span>
          </div>
          <div className="form-field">
            <span className="field-label">From</span>
            <span className="field-value">{formInfo.fromLocation}</span>
          </div>
          <div className="form-field">
            <span className="field-label">Main Office Address</span>
            <span className="field-value">{formInfo.mainOffice}</span>
          </div>
          <div className="form-field">
            <span className="field-label">To</span>
            <span className="field-value">{formInfo.toLocation}</span>
          </div>
          <div className="form-field">
            <span className="field-label">Home Terminal</span>
            <span className="field-value">{formInfo.homeTerminal}</span>
          </div>
          <div className="form-field">
            <span className="field-label">Truck/Tractor Number</span>
            <span className="field-value">{formInfo.truckNumber}</span>
          </div>
          <div className="form-field">
            <span className="field-label">Total Miles Driving Today</span>
            <span className="field-value">{formInfo.totalMilesDriving}</span>
          </div>
          <div className="form-field">
            <span className="field-label">Trailer Number</span>
            <span className="field-value">{formInfo.trailerNumber}</span>
          </div>
          <div className="form-field">
            <span className="field-label">Total Mileage Today</span>
            <span className="field-value">{formInfo.totalMileage}</span>
          </div>
        </div>
      </div>

      <div className="card chart-card">
        <HOSChart entries={hosEntries} />
      </div>

      <div className="card add-remark-card" data-html2canvas-ignore="true">
        <h2 className="section-title"><Flag size={18} /> Add Remark</h2>
        <div className="form-grid remark-form-grid">
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="field-label">Time</label>
            <input type="time" className="form-input" value={newRemark.time} onChange={e => setNewRemark({...newRemark, time: e.target.value})} style={{ height: '40px', padding: '0 12px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-main)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
          </div>
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="field-label">Location</label>
            <input type="text" className="form-input" placeholder="e.g., Dallas, TX" value={newRemark.location} onChange={e => setNewRemark({...newRemark, location: e.target.value})} style={{ height: '40px', padding: '0 12px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-main)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
          </div>
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="field-label">Remark</label>
            <input type="text" className="form-input" placeholder="e.g., Pre-trip inspection" value={newRemark.note} onChange={e => setNewRemark({...newRemark, note: e.target.value})} style={{ height: '40px', padding: '0 12px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-main)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
          </div>
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="field-label" style={{ visibility: 'hidden' }}>Action</label>
            <button className="btn-primary" style={{ height: '40px', width: '100%', justifyContent: 'center', boxSizing: 'border-box', margin: 0 }} onClick={handleAddRemark}>Add</button>
          </div>
        </div>
      </div>

      <div className="two-col-grid">
        <div className="card remarks-card">
          <h2 className="section-title"><Flag size={18} /> Remarks</h2>
          {remarks.length > 0 ? (
            <ul className="remarks-list">
              {remarks.map((remark, index) => (
                <li key={index} className="remark-item">
                  <span className="remark-time">{remark.time}</span>
                  <span className="remark-location"><MapPin size={14} /> {remark.location}</span>
                  <span className="remark-note">{remark.note}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-section-text" style={{color: 'var(--text-muted)', fontSize: '14px'}}>No remarks found for this date.</p>
          )}
        </div>

        <div className="card shipping-card">
          <h2 className="section-title"><Truck size={18} /> Shipping Documents</h2>
          <div className="shipping-info" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label className="field-label">DVL or Manifest No.</label>
              <input type="text" className="form-input" placeholder="Enter manifest number" value={shippingDocs.manifestNo} onChange={e => setShippingDocs({...shippingDocs, manifestNo: e.target.value})} style={{ height: '40px', padding: '0 12px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-main)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
            </div>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label className="field-label">Shipper & Commodity</label>
              <input type="text" className="form-input" placeholder="e.g., AutoParts Co. — Auto Parts" value={shippingDocs.shipperCommodity} onChange={e => setShippingDocs({...shippingDocs, shipperCommodity: e.target.value})} style={{ height: '40px', padding: '0 12px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-main)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
            </div>
          </div>
        </div>
      </div>

      <div className="card certification-card">
        <div className="cert-info">
          <h2 className="section-title">Certification <span style={{fontSize: '13px', fontWeight: 'normal', color: 'var(--text-muted)', marginLeft: '12px'}}>*FMCSA Requirement</span></h2>
          <p className="cert-text">I hereby certify that my data entries and my record of duty status for this 24-hour period are true and correct.</p>
          <p style={{fontSize: '13px', color: 'var(--text-muted)', maxWidth: '600px', marginBottom: '16px'}}>
            By clicking "Certify Log", you are legally signing this daily logbook as required by the FMCSA to confirm all logged duty statuses are accurate.
          </p>
          <div className="signature-area">
            <div className="signature-line">
              <span className="signature-font">{user?.name || ''}</span>
            </div>
            <span className="signature-date">{shortDateStr}</span>
          </div>
        </div>
        <div className="cert-actions" data-html2canvas-ignore="true">
          <button className="btn-outline" onClick={handleDownloadPDF} disabled={isGenerating}>
            <Download size={16} /> {isGenerating ? 'Generating...' : 'Download PDF'}
          </button>
          
          <div style={{ position: 'relative', display: 'flex' }}>
            <button className="btn-primary" onClick={handleCertify}>
              <CheckCircle size={16} /> Certify Log
            </button>
            
            {showCertifyPopup && (
              <div className="certify-popup">
                <CheckCircle size={16} />
                <span>Certified Successfully</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogsPage;
