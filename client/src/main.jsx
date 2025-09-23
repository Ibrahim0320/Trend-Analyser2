import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

// Absolutely require the #root element (see index.html)
const el = document.getElementById('root');
if (!el) {
  // Fail loudly (you'd otherwise see a blank page)
  throw new Error('Missing <div id="root"></div> in index.html');
}

const root = createRoot(el);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
