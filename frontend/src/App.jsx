import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [backendStatus, setBackendStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkBackend = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:5000/api/health');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setBackendStatus(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkBackend();
  }, []);

  return (
    <div className="container">
      <header className="header">
        <h1>Order Store Platform</h1>
        <p className="subtitle">React Frontend + Node.js Express Backend</p>
      </header>

      <main className="main-content">
        <div className="card">
          <h2>Backend Connection Status</h2>
          {loading && <p className="status loading">Connecting to backend (http://localhost:5000)...</p>}
          {error && (
            <div className="status-box error">
              <span className="badge badge-error">Offline / Error</span>
              <p>Cannot reach backend: {error}</p>
              <small>Make sure backend server is running: <code>cd backend && npm run dev</code></small>
            </div>
          )}
          {backendStatus && (
            <div className="status-box success">
              <span className="badge badge-success">Online</span>
              <p><strong>Message:</strong> {backendStatus.message}</p>
              <p><strong>Timestamp:</strong> {backendStatus.timestamp}</p>
            </div>
          )}
          <button className="btn" onClick={checkBackend} disabled={loading}>
            {loading ? 'Checking...' : 'Re-check Connection'}
          </button>
        </div>
      </main>
    </div>
  );
}

export default App;
