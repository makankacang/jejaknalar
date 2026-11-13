export default function TeacherDashboardPage(): React.JSX.Element {
  return (
    <main style={styles.container}>
      <h1 style={styles.heading}>Dashboard Guru</h1>
      <p style={styles.notice}>
        Belum terhubung ke backend. Fitur dashboard akan tersedia setelah integrasi selesai.
      </p>
      <p style={styles.body}>
        Sprint 0 — placeholder. Autentikasi belum diimplementasikan pada ticket ini.
      </p>
    </main>
  );
}

const styles = {
  container: {
    maxWidth: 800,
    margin: '0 auto',
    padding: '32px 24px',
    fontFamily: 'system-ui, sans-serif',
  },
  heading: {
    fontSize: '1.75rem',
    fontWeight: 700,
    marginBottom: '1rem',
  },
  notice: {
    padding: '0.75rem 1rem',
    borderRadius: '6px',
    background: '#eff6ff',
    border: '1px solid #93c5fd',
    color: '#1e40af',
    marginBottom: '1rem',
    fontSize: '0.95rem',
  },
  body: {
    color: '#555',
  },
} as const;
