
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth/AuthProvider';

export default function TeacherDashboardPage(): React.JSX.Element {
  const { user, mode } = useAuth();

  const displayName = user?.email?.split('@')[0] || 'Guru';

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div>
            <span style={styles.eyebrow}>RUANG GURU / DASHBOARD</span>
            <h1 style={styles.title}>Dashboard Guru</h1>
            <p style={styles.subtitle}>
              Selamat datang kembali, {displayName}.
              Mari siapkan pengalaman belajar yang lebih menarik
              untuk siswa.
            </p>
          </div>

          <span style={mode === 'live' ? styles.liveBadge : styles.demoBadge}>
            {mode === 'live' ? 'SESI LIVE' : 'MODE DEMO'}
          </span>
        </header>

        <section style={styles.welcomeCard}>
          <div>
            <span style={styles.welcomeLabel}>RUANG KERJA GURU</span>
            <h2>Mulai perjalanan belajar hari ini.</h2>
            <p>
              Pilih materi pembelajaran atau unggah modul sendiri
              untuk mempersiapkan tujuan pembelajaran berbasis quest.
            </p>
          </div>

          <div style={styles.actions}>
            <Link to="/teacher/modules/upload" style={styles.primaryButton}>
              + Upload Modul
            </Link>

            <Link to="/teacher/modules" style={styles.secondaryButton}>
              Jelajahi Katalog
            </Link>
          </div>
        </section>

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <h2>Menu Utama</h2>
              <p>Akses fitur utama ruang kerja guru.</p>
            </div>
          </div>

          <div style={styles.menuGrid}>
            <article style={styles.menuCard}>
              <span style={styles.cardNumber}>01</span>
              <h3>Katalog Modul</h3>
              <p>
                Temukan materi pembelajaran bawaan yang dapat
                dijadikan dasar pengembangan quest.
              </p>
              <Link to="/teacher/modules" style={styles.cardLink}>
                Buka katalog →
              </Link>
            </article>

            <article style={styles.menuCard}>
              <span style={styles.cardNumber}>02</span>
              <h3>Upload Modul</h3>
              <p>
                Unggah materi berformat PDF atau DOCX untuk
                diproses dan dianalisis.
              </p>
              <Link
                to="/teacher/modules/upload"
                style={styles.cardLink}
              >
                Mulai upload →
              </Link>
            </article>
          </div>
        </section>

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <h2>Alur Pengembangan Pembelajaran</h2>
              <p>
                Tahapan yang dilalui guru dalam menyiapkan
                pengalaman belajar siswa.
              </p>
            </div>
          </div>

          <div style={styles.workflow}>
            <div style={styles.workflowItem}>
              <span style={styles.stepNumber}>1</span>
              <div>
                <strong>Pilih atau Upload Materi</strong>
                <p>
                  Gunakan modul bawaan atau unggah dokumen
                  pembelajaran sendiri.
                </p>
              </div>
            </div>

            <div style={styles.workflowItem}>
              <span style={styles.stepNumber}>2</span>
              <div>
                <strong>Analisis Tujuan Pembelajaran</strong>
                <p>
                  Sistem memproses materi dan membantu
                  mengidentifikasi Learning Objectives.
                </p>
              </div>
            </div>

            <div style={styles.workflowItem}>
              <span style={styles.stepNumber}>3</span>
              <div>
                <strong>Review dan Persiapan Quest</strong>
                <p>
                  Guru meninjau tujuan pembelajaran sebelum
                  masuk ke tahap pengembangan quest.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section style={styles.integrationNotice}>
          <strong>Informasi integrasi</strong>
          <p>
            Katalog modul saat ini masih menggunakan data demonstrasi.
            Proses upload dan analisis memiliki jalur integrasi LIVE,
            sedangkan penyimpanan approval dan publikasi quest
            masih dalam pengembangan.
          </p>
        </section>
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: 'calc(100vh - 64px)',
    padding: '12px 0 48px',
    color: '#172033',
  },
  container: {
    maxWidth: '1000px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: '18px',
    marginBottom: '28px',
  },
  eyebrow: {
    color: '#64748b',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '1.5px',
  },
  title: {
    margin: '9px 0',
    fontSize: '30px',
  },
  subtitle: {
    maxWidth: '650px',
    color: '#64748b',
    fontSize: '14px',
    lineHeight: 1.7,
  },
  liveBadge: {
    padding: '8px 12px',
    borderRadius: '7px',
    background: '#dcfce7',
    color: '#166534',
    fontSize: '11px',
    fontWeight: 700,
  },
  demoBadge: {
    padding: '8px 12px',
    borderRadius: '7px',
    background: '#fef3c7',
    color: '#92400e',
    fontSize: '11px',
    fontWeight: 700,
  },
  welcomeCard: {
    padding: '30px',
    borderRadius: '15px',
    background: '#172033',
    color: '#ffffff',
  },
  welcomeLabel: {
    color: '#cbd5e1',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '1.5px',
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '10px',
    marginTop: '22px',
  },
  primaryButton: {
    display: 'inline-block',
    padding: '11px 16px',
    borderRadius: '8px',
    background: '#ffffff',
    color: '#172033',
    textDecoration: 'none',
    fontSize: '13px',
    fontWeight: 700,
  },
  secondaryButton: {
    display: 'inline-block',
    padding: '11px 16px',
    border: '1px solid #64748b',
    borderRadius: '8px',
    color: '#ffffff',
    textDecoration: 'none',
    fontSize: '13px',
    fontWeight: 600,
  },
  section: {
    marginTop: '34px',
  },
  sectionHeader: {
    marginBottom: '17px',
  },
  menuGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '16px',
  },
  menuCard: {
    padding: '22px',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    background: '#ffffff',
  },
  cardNumber: {
    color: '#94a3b8',
    fontSize: '11px',
    fontWeight: 700,
  },
  cardLink: {
    display: 'inline-block',
    marginTop: '8px',
    color: '#1e293b',
    fontSize: '13px',
    fontWeight: 700,
    textDecoration: 'none',
  },
  workflow: {
    display: 'grid',
    gap: '12px',
  },
  workflowItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '15px',
    padding: '18px',
    border: '1px solid #e2e8f0',
    borderRadius: '11px',
    background: '#ffffff',
  },
  stepNumber: {
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
    width: '30px',
    height: '30px',
    borderRadius: '8px',
    background: '#e2e8f0',
    color: '#334155',
    fontSize: '12px',
    fontWeight: 700,
  },
  integrationNotice: {
    padding: '17px',
    marginTop: '28px',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    background: '#f8fafc',
    color: '#475569',
    fontSize: '12px',
    lineHeight: 1.7,
  },
};
