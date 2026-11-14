import { Link } from 'react-router-dom';
import { StudentQuestPage } from '../features/student/sprint1/StudentQuestPage';
import '../features/student/sprint1/sprint1.css';

/** Isolated public preview. Uses synthetic repositories only, never official student attempts. */
export default function StudentDemoPage(): React.JSX.Element {
  return (
    <div>
      <nav aria-label="Navigasi demo" style={{ padding: '12px 20px', fontFamily: 'system-ui, sans-serif' }}>
        <Link to="/demo">← Kembali ke info demo</Link>
      </nav>
      <div role="note" style={{ background: '#fff7d6', color: '#603b00', padding: '14px 20px', fontFamily: 'system-ui, sans-serif', borderBottom: '2px solid #dfbd53' }}>
        <strong>DEMO LOKAL / SIMULASI.</strong> Quest, penilaian, dan jalur BedaJalur di halaman ini menggunakan data sintetis.
        Tidak ada login siswa, publikasi Quest, penyimpanan progres, atau scoring resmi di server.
      </div>
      <StudentQuestPage demoPath="developing" />
    </div>
  );
}
