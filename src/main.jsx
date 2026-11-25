import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/index.css';

// Default to light mode on initial load
const savedTheme = localStorage.getItem('theme');
const activeTheme = savedTheme === 'dark' ? 'dark' : 'light';
document.documentElement.setAttribute('data-theme', activeTheme);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
