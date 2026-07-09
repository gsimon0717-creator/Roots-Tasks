import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
// SECURITY FIX (2026-07-09): must be imported before App so the fetch
// patch is installed before any component makes an API call. See
// src/authFetch.ts.
import './authFetch';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
