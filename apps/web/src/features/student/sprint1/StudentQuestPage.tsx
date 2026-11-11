import { useEffect, useState } from 'react';
import { PhaserStage } from './PhaserStage';
import { prepareEvidenceHunt } from '../../../game/sprint1/content';
import { QuestFlow, type QuestSnapshot } from '../../../game/sprint1/flow';
import { MockQuestRepositoryV1, MockAssessmentRepositoryV1 } from '../../../game/sprint0/repositories-v1';
import type { LearningPath } from '../../../game/sprint0/types';

const adaptiveText: Record<LearningPath, { title: string; description: string }> = {
  needs_support: { title: 'Penguatan', description: 'Coba baca kembali paragraf dengan bantuan petunjuk bertahap. Tujuan belajarnya tetap sama.' },
  developing: { title: 'Pengembangan', description: 'Latih kemampuan memilih bukti dalam konteks berbeda. Tujuan belajarnya tetap sama.' },
  ready_for_extension: { title: 'Perluasan', description: 'Coba bandingkan dua sumber dan jelaskan kesimpulannya. Tujuan belajarnya tetap sama.' },
  need_more_evidence: { title: 'Butuh bukti tambahan', description: 'Belum ada bukti cukup untuk rekomendasi. Kerjakan aktivitas tambahan sebelum menentukan jalur.' },
};
function useQuestSnapshot(flow: QuestFlow | null): QuestSnapshot | null {
  const [snapshot, setSnapshot] = useState<QuestSnapshot | null>(null);
  useEffect(() => {
    if (!flow) { setSnapshot(null); return; }
    setSnapshot(flow.getSnapshot());
    return flow.subscribe(() => setSnapshot(flow.getSnapshot()));
  }, [flow]);
  return snapshot;
}

/** Halaman mandiri PIC D; tidak mengedit routing milik PIC A. */
export function StudentQuestPage({ demoPath = 'need_more_evidence' }: { demoPath?: LearningPath }) {
  const [flow, setFlow] = useState<QuestFlow | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const snapshot = useQuestSnapshot(flow);
  useEffect(() => {
    let mounted = true;
    new MockQuestRepositoryV1().getPublishedQuest('QUEST-DEMO-001')
      .then(payload => {
        if (!mounted) return;
        const { quest, content } = prepareEvidenceHunt(payload);
        const game = new QuestFlow(quest, content, new MockAssessmentRepositoryV1(demoPath));
        setFlow(game);
        game.start();
      })
      .catch(() => { if (mounted) setLoadingError('Quest tidak tersedia. Periksa mock data dan referensi scene.'); });
    return () => { mounted = false; };
  }, [demoPath]);

  const content = flow?.content;
  return <main className="jn-main">
    <header className="jn-head">
      <div><span className="jn-eyebrow">JEJAKNALAR · EVIDENCE HUNT</span>
        <h1>{content?.title ?? 'Misteri Perpustakaan'}</h1>
        <p>Berpetualang, membaca sumber, lalu tunjukkan bukti dari teks.</p>
      </div>
      <span className="jn-tag">DEMO DATA SINTETIS · TANPA AI</span>
    </header>
    {loadingError && <div className="jn-error" role="alert">{loadingError}</div>}
    {flow && snapshot && content && <>
      <section className="jn-layout">
        <div className="jn-map-card">
          <div className="jn-card-title">Ruang Perpustakaan <span>{snapshot.state}</span></div>
          <PhaserStage onNpc={() => flow.interactNpc()} onDocument={() => flow.openDocument()} onChallenge={() => flow.openChallenge()} />
          <p className="jn-tip">Gerakkan karakter dengan WASD / panah, atau klik/tap peta. Klik NPC, dokumen, atau tantangan untuk berinteraksi.</p>
          <div className="jn-actions">
            <button onClick={() => flow.interactNpc()} disabled={snapshot.state !== 'EXPLORING'}>Bicara dengan NPC</button>
            <button onClick={() => flow.openDocument()} disabled={snapshot.state !== 'EXPLORING'}>Buka dokumen</button>
            <button onClick={() => flow.openChallenge()} disabled={!snapshot.hasReadDocument || snapshot.state !== 'EXPLORING'}>Kerjakan tantangan</button>
          </div>
        </div>
        <aside className="jn-info-card">
          <div className="jn-card-title">Misi Pembelajaran</div>
          <h2>Menemukan bukti teks</h2>
          <p>Tujuan: menarik kesimpulan berdasarkan bukti dari laporan.</p>
          <ol>
            <li>Bicara dengan Bu Rani</li>
            <li>Baca laporan perpustakaan</li>
            <li>Pilih kalimat bukti</li>
            <li>Kirim assessment & lihat BedaJalur</li>
          </ol>
          <div className="jn-progress">Dokumen dibaca: <strong>{snapshot.hasReadDocument ? 'Sudah' : 'Belum'}</strong></div>
          <div className="jn-progress">Learning events lokal: <strong>{snapshot.events.length}</strong></div>
          <p className="jn-tip">Learning events belum tersimpan di server. Nilai mock bukan nilai akademik.</p>
        </aside>
      </section>
      {snapshot.overlay === 'npc' && <section className="jn-panel" role="dialog" aria-label="Dialog pustakawan">
        <h2>{content.npc.name}</h2><p>{content.npc.message}</p>
        <button onClick={() => flow.closeInteraction()}>Tutup dialog</button>
      </section>}
      {snapshot.overlay === 'document' && <section className="jn-panel" role="dialog" aria-label="Dokumen perpustakaan">
        <h2>{content.document.title}</h2>
        {content.document.paragraphs.map(p => <p key={p.id}><strong>{p.id}</strong> — {p.text}</p>)}
        <button onClick={() => flow.closeInteraction()}>Saya sudah membaca</button>
      </section>}
      {(snapshot.state === 'ASSESSMENT' || snapshot.state === 'SUBMITTING') && <section className="jn-panel" aria-label="Assessment Evidence Hunt">
        <h2>Challenge: Pilih Bukti</h2><p>{content.challenge.prompt}</p>
        <fieldset disabled={snapshot.state !== 'ASSESSMENT'}>
          <legend>Pilih kutipan yang menurutmu relevan:</legend>
          {content.document.paragraphs.map(p => <label key={p.id} className="jn-option">
            <input type="radio" name="evidence-choice" checked={snapshot.selectedEvidenceId === p.id} onChange={() => flow.selectEvidence(p.id)}/>
            <span>{p.text}</span>
          </label>)}
        </fieldset>
        {snapshot.state === 'ASSESSMENT' && <div className="jn-actions">
          <button className="jn-primary" disabled={!snapshot.selectedEvidenceId || snapshot.busy} onClick={() => void flow.submit()}>Kirim jawaban</button>
          <button onClick={() => { flow.hint(); setShowHint(true); }}>Petunjuk</button>
        </div>}
        {showHint && <p className="jn-tip">Petunjuk: perhatikan bagian laporan yang menyediakan angka atau fakta yang dapat dibandingkan.</p>}
        {snapshot.state === 'SUBMITTING' && <p aria-live="polite">{snapshot.busy ? 'Mengirim jawaban...' : 'Menunggu pengiriman ulang.'}</p>}
        {snapshot.submitError && <div className="jn-error" role="alert">{snapshot.submitError}<button onClick={() => void flow.submit()} disabled={snapshot.busy}>Coba lagi</button></div>}
      </section>}
      {snapshot.state === 'FEEDBACK' && snapshot.result && <section className="jn-panel" aria-live="polite">
        <h2>Feedback Assessment</h2><p><strong>SIMULASI.</strong> Skor mock {snapshot.result.score} adalah placeholder, bukan penilaian jawaban yang sebenarnya.</p>
        {snapshot.result.feedback.map((item, index) => <p key={item.item_id ?? index}>{item.message}</p>)}
        <button className="jn-primary" onClick={() => flow.nextPath()}>Lihat BedaJalur</button>
      </section>}
      {snapshot.state === 'ADAPTIVE_TRANSITION' && snapshot.result && <section className="jn-panel">
        <h2>BedaJalur: {adaptiveText[snapshot.result.next_path].title}</h2>
        <p>{adaptiveText[snapshot.result.next_path].description}</p>
        <p className="jn-tip">Rekomendasi simulasi dipilih dari dropdown preview. Logika server dan konten varian asli menunggu integrasi PIC B/C.</p>
        <button className="jn-primary" onClick={() => flow.finish()}>Selesaikan misi</button>
      </section>}
      {snapshot.state === 'COMPLETED' && <section className="jn-panel"><h2>Petualangan selesai!</h2><p>Kamu berhasil menelusuri misi hingga tahap BedaJalur. Progress ini hanya ada di memori browser.</p></section>}
    </>}
  </main>;
}
