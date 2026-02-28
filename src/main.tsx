import React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import App from './App';

if (import.meta.env.DEV) {
  console.log('🚀 TitanPDF starting in development mode');
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if (!import.meta.env.DEV) {
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
  });
}
