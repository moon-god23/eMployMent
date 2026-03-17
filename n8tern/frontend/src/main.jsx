import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3500,
        style: {
          background: 'rgba(17,17,27,0.95)',
          color: '#e2e8f0',
          border: '1px solid rgba(124,58,237,0.3)',
          backdropFilter: 'blur(16px)',
          borderRadius: '12px',
          fontSize: '14px',
        },
        success: { iconTheme: { primary: '#a855f7', secondary: '#1e1e2e' } },
        error:   { iconTheme: { primary: '#f87171', secondary: '#1e1e2e' } },
      }}
    />
  </React.StrictMode>
);
