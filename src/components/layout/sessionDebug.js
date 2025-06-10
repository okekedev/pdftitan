// src/components/SessionDebug.js (Optional - for testing)
// Add this to your header or footer to debug session storage

import React, { useState, useEffect } from 'react';
import sessionManager from '../services/sessionManager';

function SessionDebug() {
  const [sessionInfo, setSessionInfo] = useState(null);
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    const updateSessionInfo = () => {
      const session = sessionManager.getUserSession();
      if (session) {
        const timeLeft = Math.round((session.expiresAt - Date.now()) / 1000);
        setSessionInfo({
          isLoggedIn: true,
          user: session.user.email,
          timeLeft: timeLeft,
          loginTime: new Date(session.loginTime).toLocaleString()
        });
      } else {
        setSessionInfo({ isLoggedIn: false });
      }
    };

    updateSessionInfo();
    const interval = setInterval(updateSessionInfo, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  if (!showDebug) {
    return (
      <button 
        onClick={() => setShowDebug(true)}
        style={{
          position: 'fixed',
          bottom: '10px',
          right: '10px',
          background: '#333',
          color: 'white',
          border: 'none',
          padding: '5px 10px',
          borderRadius: '4px',
          fontSize: '12px',
          cursor: 'pointer',
          zIndex: 1000
        }}
      >
        🐛 Session Debug
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      background: 'rgba(0,0,0,0.9)',
      color: 'white',
      padding: '10px',
      borderRadius: '8px',
      fontSize: '12px',
      fontFamily: 'monospace',
      zIndex: 1000,
      minWidth: '250px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
        <strong>🐛 Session Debug</strong>
        <button 
          onClick={() => setShowDebug(false)}
          style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}
        >
          ✕
        </button>
      </div>
      
      {sessionInfo ? (
        <div>
          <div>Status: {sessionInfo.isLoggedIn ? '✅ Logged In' : '❌ Not Logged In'}</div>
          {sessionInfo.isLoggedIn && (
            <>
              <div>User: {sessionInfo.user}</div>
              <div>Expires: {sessionInfo.timeLeft}s</div>
              <div>Login: {sessionInfo.loginTime}</div>
            </>
          )}
          <div style={{ marginTop: '10px' }}>
            <button 
              onClick={() => {
                sessionManager.clearSession();
                window.location.reload();
              }}
              style={{
                background: '#dc3545',
                color: 'white',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              Clear Session
            </button>
          </div>
        </div>
      ) : (
        <div>Loading...</div>
      )}
    </div>
  );
}

export default SessionDebug;