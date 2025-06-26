// src/index.js - Updated Entry Point
import React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css'; // Use our comprehensive global styles
import App from './App';

// Performance monitoring (optional)
if (process.env.NODE_ENV === 'development') {
  console.log('🚀 TitanPDF starting in development mode');
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Optional: Add global error boundary for production
if (process.env.NODE_ENV === 'production') {
  // Log any unhandled errors
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
  });
  
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
  });
}