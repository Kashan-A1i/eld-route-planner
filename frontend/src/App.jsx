import { useState, useEffect } from 'react';

function App() {
  const [statusMessage, setStatusMessage] = useState("Connecting to Django backend...");

  useEffect(() => {
    fetch('http://localhost:8000/api/test/')
      .then((res) => res.json())
      .then((data) => setStatusMessage(data.message))
      .catch((err) => setStatusMessage("Error: Could not connect to Django backend."));
  }, []);

  const isSuccess = statusMessage.includes('Success');

  const containerStyle = {
    fontFamily: 'system-ui, sans-serif',
    maxWidth: '600px',
    margin: '3rem auto',
    padding: '2rem',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    border: '1px solid #e2e8f0'
  };

  const statusBoxStyle = {
    marginTop: '1.5rem',
    padding: '1rem 1.25rem',
    borderRadius: '8px',
    fontWeight: '500',
    backgroundColor: isSuccess ? '#f0fdf4' : '#fff1f2',
    border: isSuccess ? '1px solid #bbf7d0' : '1px solid #fecdd3',
    color: isSuccess ? '#166534' : '#9f1239'
  };

  return (
    <div style={containerStyle}>
      <h1 style={{ color: '#0f172a', margin: 0 }}>LogMapper</h1>
      <p style={{ color: '#64748b' }}>Full-Stack ELD & Route Planner Setup</p>

      <div style={statusBoxStyle}>
        {statusMessage}
      </div>
    </div>
  );
}

export default App;