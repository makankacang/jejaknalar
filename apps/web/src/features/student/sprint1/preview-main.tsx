import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { StudentQuestPage } from './StudentQuestPage';
import './sprint1.css';
const root = document.getElementById('root');
if (!root) throw new Error('Preview root tidak ditemukan');
createRoot(root).render(<StrictMode><div className="jn-dev-toolbar"><strong>JEJAKNALAR · SPRINT 1 PIC D</strong><span>Latihan lokal · Data sintetis · Tanpa Supabase / AI</span></div><StudentQuestPage/></StrictMode>);
