import React from 'react';
import { createRoot } from 'react-dom/client';
import { BI8Preview } from './BI8Preview';
import './bi8.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode><BI8Preview /></React.StrictMode>
);
