import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { LearningPath } from '../../../game/sprint0/types';
import { StudentQuestPage } from './StudentQuestPage';
import './sprint1.css';
function Preview() {
  const [path, setPath] = useState<LearningPath>('need_more_evidence');
  return <StrictMode><div className="jn-dev-toolbar">
    <strong>PREVIEW LOKAL PIC D</strong>
    <label>Simulasi jalur hasil backend: <select value={path} onChange={e => setPath(e.target.value as LearningPath)}>
      <option value="need_more_evidence">Need More Evidence</option>
      <option value="needs_support">Needs Support</option>
      <option value="developing">Developing</option>
      <option value="ready_for_extension">Ready for Extension</option>
    </select></label>
  </div><StudentQuestPage key={path} demoPath={path}/></StrictMode>;
}
const root = document.getElementById('root');
if (!root) throw new Error('Preview root tidak ditemukan');
createRoot(root).render(<Preview/>);
