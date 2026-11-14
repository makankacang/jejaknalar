import { Link } from 'react-router-dom';

export default function LandingPage(): React.JSX.Element {
  return (
    <main className="jn-landing">
      <div className="jn-landing-shell">
        <header className="jn-landing-header">
          <Link to="/" className="jn-landing-brand">
            <span className="jn-brand-mark">J</span>
            <span>JejakNalar</span>
          </Link>

          <span className="jn-landing-edition">
            WARM ADVENTURE · ACADEMIC FANTASY
          </span>
        </header>

        <section className="jn-landing-hero">
          <div className="jn-landing-copy">
            <span className="jn-landing-eyebrow">
              PETUALANGAN EDUKATIF
            </span>

            <h1>
              Belajar dengan menjelajah.
              <span> Memahami dengan menemukan.</span>
            </h1>

            <p className="jn-landing-description">
              JejakNalar mengubah pembelajaran menjadi perjalanan berbasis
              quest. Jelajahi dunia, baca sumber, temukan bukti, dan bangun
              pemahaman melalui pengalaman belajar yang bermakna.
            </p>

            <div className="jn-landing-actions">
              <Link to="/demo" className="jn-landing-button jn-landing-button-primary">
                Jelajahi Demo <span aria-hidden="true">→</span>
              </Link>

              <Link to="/login" className="jn-landing-button jn-landing-button-secondary">
                Masuk sebagai Guru
              </Link>
            </div>

            <div className="jn-landing-footnote">
              <span className="jn-landing-footnote-dot" />
              Mulai petualangan tanpa perlu login
            </div>
          </div>

          <aside className="jn-landing-world" aria-label="Ilustrasi dunia pembelajaran JejakNalar">
            <div className="jn-world-orbit jn-world-orbit-one" />
            <div className="jn-world-orbit jn-world-orbit-two" />

            <div className="jn-world-topline">
              <span>THE WORLD OF KNOWLEDGE</span>
              <span className="jn-world-star">✦</span>
            </div>

            <div className="jn-world-book">
              <span className="jn-world-book-label">YOUR NEXT QUEST</span>
              <div className="jn-world-book-icon">✧</div>
              <h2>Perpustakaan Pengetahuan</h2>
              <p>Setiap halaman menyimpan petunjuk. Setiap perjalanan membuka pemahaman.</p>
              <div className="jn-world-book-rule" />
              <span className="jn-world-book-footer">CHAPTER 01 · THE BEGINNING</span>
            </div>

            <div className="jn-world-steps">
              <span><b>01</b> Jelajahi</span>
              <span><b>02</b> Temukan</span>
              <span><b>03</b> Pahami</span>
            </div>

            <div className="jn-world-caption">
              <span>JEJAKNALAR</span>
              <span>LEARN THROUGH ADVENTURE</span>
            </div>
          </aside>
        </section>

        <footer className="jn-landing-footer">
          <span>JEJAKNALAR © 2026</span>
          <span>Belajar adalah sebuah perjalanan.</span>
        </footer>
      </div>
    </main>
  );
}
