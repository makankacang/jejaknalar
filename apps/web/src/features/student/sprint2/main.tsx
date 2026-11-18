import React from 'react';
import { createRoot } from 'react-dom/client';
import { QuestGame } from './QuestGame';
import './sprint2.css';

const mode = new URLSearchParams(window.location.search)
  .get('mode') === 'student' ? 'student' : 'preview';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QuestGame mode={mode} />
  </React.StrictMode>
);
