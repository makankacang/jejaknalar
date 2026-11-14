import { useState } from 'react';
import type { ObjectPresentation } from '../../../game/sprint2/learning-object-presentation';
import './LearningObjectCloseup.css';

type Excerpt = { title: string; locator: string; text: string };
const LABELS: Record<ObjectPresentation['closeup_type'], string> = {
  book: 'Buku', folder: 'Map dokumen', board: 'Papan bukti', poster: 'Poster',
  screen: 'Layar', letter: 'Surat', panel: 'Panel', instrument: 'Alat pembelajaran',
};

/** One shared physical close-up for story-driven quests. Text comes only from
 * versioned source_refs, not frontend answer keys or fixtures.
 */
export function LearningObjectCloseup({presentation, excerpts, viewed, onView}: {
  presentation: ObjectPresentation;
  excerpts: Excerpt[];
  viewed: number[];
  onView: (index: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  if (excerpts.length === 0) return <p role="alert">Belum ada kutipan sumber untuk objek ini.</p>;
  const physical = presentation.closeup_type;
  const entry = excerpts[page];
  const isBook = physical === 'book';
  const totalViewed = excerpts.filter((_,i)=>viewed.includes(i)).length;
  return <section className={`jn-learning-closeup jn-object-${physical}`} data-state-marker={presentation.state_marker} aria-label={`Close-up ${LABELS[physical]}: ${presentation.label}`}>
    {!open ? <div className="jn-object-cover">
      <span aria-hidden="true" className="jn-object-seal">{isBook ? '✦' : physical === 'folder' ? '▤' : physical === 'board' ? '▦' : '▣'}</span>
      <p className="jn-cover-kicker">{LABELS[physical].toUpperCase()} · ARSIP PEMBELAJARAN</p>
      <h4>{presentation.label}</h4>
      <p>{isBook ? 'Baca halaman buku sesuai materi dan periksa bukti.' : 'Periksa tampilan objek dan kutipan sumber pembelajaran.'}</p>
      <p className="jn-read-count">{totalViewed}/{excerpts.length} bagian telah diperiksa</p>
      <small className="jn-runtime-state">Status aktivitas: {presentation.state_marker === 'completed' ? 'selesai' : presentation.state_marker === 'active' ? 'aktif' : 'belum dimulai'}</small>
      <button type="button" onClick={()=>setOpen(true)}>{isBook ? 'Buka buku' : `Periksa ${LABELS[physical].toLowerCase()}`}</button>
    </div> : <div className="jn-object-body">
      <div className="jn-physical-left" aria-hidden="true">
        <span className="jn-physical-tag">{LABELS[physical].toUpperCase()}</span>
        <div className="jn-physical-symbol">{isBook ? '✦' : physical === 'folder' ? '▤' : physical === 'board' ? '▧' : physical === 'screen' ? '▣' : '◆'}</div>
        <h4>{presentation.label}</h4>
        <span className="jn-physical-number">{page+1} / {excerpts.length}</span>
      </div>
      <article className="jn-physical-paper">
        <small className="jn-paper-kicker">{entry.title} · {entry.locator}</small>
        <p className="jn-paper-excerpt">{entry.text}</p>
        <button className={viewed.includes(page)?'jn-marked':''} type="button" onClick={()=>onView(page)}>
          {viewed.includes(page) ? '✓ Sudah dibaca' : 'Tandai sudah dibaca'}
        </button>
        <nav className="jn-page-nav" aria-label="Navigasi isi objek">
          <button type="button" disabled={page===0} onClick={()=>setPage(p=>p-1)}>← Sebelumnya</button>
          <span>{page+1} / {excerpts.length}</span>
          <button type="button" disabled={page===excerpts.length-1} onClick={()=>setPage(p=>p+1)}>Berikutnya →</button>
        </nav>
        <button className="jn-close-prop" type="button" onClick={()=>setOpen(false)}>{isBook ? 'Tutup buku' : 'Tutup tampilan objek'}</button>
      </article>
    </div>}
    <small className="jn-source-footnote">Sumber: Story Bundle, versi dokumen yang disetujui. Ini pratinjau lokal; belum ada penilaian server.</small>
  </section>;
}
