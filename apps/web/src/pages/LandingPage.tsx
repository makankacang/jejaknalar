import { Link } from 'react-router-dom';

export default function LandingPage(): React.JSX.Element {
  return (
    <main style={styles.container}>
      <h1 style={styles.heading}>JejakNalar</h1>
      <p style={styles.tagline}>
        Edu-Roguelike: platform pembelajaran berbasis quest untuk guru dan siswa.
      </p>
      <nav style={styles.nav}>
        <Link to="/demo" style={styles.linkPrimary}>
          Demo Publik
        </Link>
        <Link to="/login" style={styles.linkSecondary}>
          Masuk sebagai Guru
        </Link>
      </nav>
    </main>
  );
}

const styles = {
  container: {
    maxWidth: 640,
    margin: '80px auto',
    padding: '0 24px',
    fontFamily: 'system-ui, sans-serif',
    textAlign: 'center' as const,
  },
  heading: {
    fontSize: '2.5rem',
    fontWeight: 700,
    marginBottom: '0.5rem',
  },
  tagline: {
    fontSize: '1.1rem',
    color: '#555',
    marginBottom: '2rem',
  },
  nav: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'center',
    flexWrap: 'wrap' as const,
  },
  linkPrimary: {
    display: 'inline-block',
    padding: '0.6rem 1.4rem',
    borderRadius: '6px',
    background: '#1a56db',
    color: '#fff',
    textDecoration: 'none',
    fontWeight: 600,
  },
  linkSecondary: {
    display: 'inline-block',
    padding: '0.6rem 1.4rem',
    borderRadius: '6px',
    border: '1.5px solid #1a56db',
    color: '#1a56db',
    textDecoration: 'none',
    fontWeight: 600,
  },
} as const;
