import { useState, useEffect } from 'react';

function App() {
  const [statusMessage, setStatusMessage] = useState("Connecting to Django...");
  const [tripLogs, setTripLogs] = useState([]); 
  const [formData, setFormData] = useState({
    currentLocation: '',
    pickupLocation: '',
    dropoffLocation: '',
    cycleUsed: 0
  });

  useEffect(() => {
    fetch('http://localhost:8000/api/test/')
      .then((res) => res.json())
      .then(() => setStatusMessage("Backend Connected ✓"))
      .catch(() => setStatusMessage("Backend Disconnected ✗"));
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setStatusMessage("Calculating route...");
    setTripLogs([]); // Clear old logs

    fetch('http://localhost:8000/api/plan-trip/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    })
    .then(res => res.json())
    .then(data => {
      if(data.error) {
        setStatusMessage("Error: " + data.error);
      } else {
        setStatusMessage(data.message);
        // THE FIX: We add "|| []" so if logs are missing, it defaults to an empty list instead of crashing!
        setTripLogs(data.logs || []); 
      }
    })
    .catch(err => setStatusMessage("Error sending data to Django."));
  };

  const containerStyle = { fontFamily: 'system-ui, sans-serif', maxWidth: '600px', margin: '3rem auto', padding: '2rem', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0', backgroundColor: '#ffffff' };
  const inputGroupStyle = { marginBottom: '1.25rem' };
  const labelStyle = { display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#334155' };
  const inputStyle = { width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '1rem', boxSizing: 'border-box' };
  const buttonStyle = { width: '100%', padding: '0.75rem', backgroundColor: '#0f172a', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', marginTop: '1rem' };

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '2rem 1rem' }}>
      <div style={containerStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1 style={{ margin: 0, color: '#0f172a' }}>LogMapper</h1>
          <span style={{ fontSize: '0.875rem', color: statusMessage.includes('✓') || statusMessage.includes('Success') ? '#16a34a' : '#dc2626', fontWeight: '500' }}>
            {statusMessage}
          </span>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={inputGroupStyle}>
            <label style={labelStyle}>Current Location</label>
            <input type="text" name="currentLocation" value={formData.currentLocation} onChange={handleChange} placeholder="e.g., Chicago" style={inputStyle} required />
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}>Pickup Location</label>
            <input type="text" name="pickupLocation" value={formData.pickupLocation} onChange={handleChange} placeholder="e.g., Detroit" style={inputStyle} required />
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}>Dropoff Location</label>
            <input type="text" name="dropoffLocation" value={formData.dropoffLocation} onChange={handleChange} placeholder="e.g., Atlanta" style={inputStyle} required />
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}>Current Cycle Used (Hours)</label>
            <input type="number" name="cycleUsed" value={formData.cycleUsed} onChange={handleChange} min="0" max="70" step="0.5" style={inputStyle} required />
          </div>

          <button type="submit" style={buttonStyle}>Calculate Route & Logs</button>
        </form>

        {/* --- Display the Logs safely --- */}
        {tripLogs && tripLogs.length > 0 && (
          <div style={{ marginTop: '2rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', color: '#0f172a', marginBottom: '1rem' }}>Hours of Service Schedule</h2>
            {tripLogs.map((log, index) => (
              <div key={index} style={{ 
                padding: '0.75rem', 
                marginBottom: '0.5rem', 
                backgroundColor: log.status === 'Driving' ? '#eff6ff' : '#f1f5f9',
                borderLeft: log.status === 'Driving' ? '4px solid #3b82f6' : '4px solid #94a3b8',
                borderRadius: '0 6px 6px 0'
              }}>
                <strong>Day {log.day}:</strong> {log.status} for {log.hours} hours
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

export default App;