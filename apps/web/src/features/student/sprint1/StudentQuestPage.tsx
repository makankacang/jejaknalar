import { useEffect, useRef, useState } from 'react';
import { TARGET_LABELS, type InteractionTarget, type ProximityState } from '../../../game/sprint1/proximity';
import { PhaserStage } from './PhaserStage';
import { prepareEvidenceHunt, reasoningQuestions, practiceByPath } from '../../../game/sprint1/content';
import { QuestFlow, type QuestSnapshot } from '../../../game/sprint1/flow';
import { MockQuestRepositoryV1 } from '../../../game/sprint0/repositories-v1';
import { DemoAssessmentRepository } from '../../../game/sprint1/demo-repository';
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
export function StudentQuestPage() {
  const [flow, setFlow] = useState<QuestFlow | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [repository, setRepository] = useState<DemoAssessmentRepository | null>(null);
  const [reload, setReload] = useState(0);
  const [practice, setPractice] = useState<LearningPath | null>(null);
  const [failNext, setFailNext] = useState(false);
  const [nearby, setNearby] = useState<ProximityState>({ npc: false, document: false, challenge: false });
  const [rangeNotice, setRangeNotice] = useState<string | null>(null);
  const snapshot = useQuestSnapshot(flow);
  const activePanel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (snapshot?.state === 'EXPLORING') {
      document.querySelector<HTMLElement>('.jn-game-canvas')?.focus({ preventScroll: true });
    } else if (snapshot?.state !== 'SUBMITTING') {
      activePanel.current?.focus({ preventScroll: true });
      activePanel.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [snapshot?.state, snapshot?.overlay]);
  useEffect(() => {
    let mounted = true;
    setLoadingError(null);
    new MockQuestRepositoryV1().getPublishedQuest('QUEST-DEMO-001')
      .then(payload => {
        if (!mounted) return;
        const { quest, content } = prepareEvidenceHunt(payload);
        const repo = new DemoAssessmentRepository(() => ({ hintsUsed: game.getSnapshot().hintsUsed, attemptCount: game.getSnapshot().attemptCount }));
        const game: QuestFlow = new QuestFlow(quest, content, repo);
        setRepository(repo);
        setFlow(game);
        game.start();
      })
      .catch(() => { if (mounted) setLoadingError('Quest tidak tersedia. Periksa mock data dan referensi scene.'); });
    return () => { mounted = false; };
  }, [reload]);

  const content = flow?.content;
  return <main className="jn-main">
    <header className="jn-head">
      <div><span className="jn-eyebrow">JEJAKNALAR · EVIDENCE HUNT</span>
        <h1>{content?.title ?? 'Misteri Perpustakaan'}</h1>
        <p>Berpetualang, membaca sumber, lalu tunjukkan bukti dari teks.</p>
      </div>
      <span className="jn-tag">DEMO DATA SINTETIS · TANPA AI</span>
    </header>
    {loadingError && <div className="jn-error" role="alert">{loadingError}<button onClick={() => setReload(n => n + 1)}>Muat ulang quest</button></div>}
    {!flow && !loadingError && <p role="status">Memuat petualangan…</p>}
    {flow && snapshot && content && <>
      <section className="jn-layout">
        <div className="jn-map-card">
          <div className="jn-card-title">Ruang Perpustakaan <span>{snapshot.state}</span></div>
          <PhaserStage
            isExploring={() => flow.getSnapshot().state === 'EXPLORING'}
            onNpc={() => flow.interactNpc()}
            onDocument={() => flow.openDocument()}
            onChallenge={() => {
              if (!flow.getSnapshot().hasReadDocument) {
                setRangeNotice('Baca dokumen dahulu sebelum memulai tantangan.');
                return;
              }
              flow.openChallenge();
            }}
            onProximityChange={(next) => { setNearby(next); setRangeNotice(null); }}
            onOutOfRange={(target: InteractionTarget) => {
              setRangeNotice(`Kamu terlalu jauh dari ${TARGET_LABELS[target]}. Dekati objek dahulu.`);
            }}
          />
          <p className="jn-tip">Gerakkan karakter dengan WASD / panah atau klik/tap lantai. Saat dekat, klik objek atau tekan E untuk berinteraksi. Klik objek dari jauh tidak akan membuka dialog.</p>
          <div className="jn-range" role="status" aria-live="polite">
            {rangeNotice ?? (
              nearby.npc || nearby.document || nearby.challenge
                ? `Dalam jangkauan: ${[
                    nearby.npc ? TARGET_LABELS.npc : null,
                    nearby.document ? TARGET_LABELS.document : null,
                    nearby.challenge ? TARGET_LABELS.challenge : null,
                  ].filter(Boolean).join(', ')}. Klik objek / tekan E.`
                : 'Belum dekat objek interaktif. Bergeraklah menuju Bu Rani, dokumen, atau tantangan.'
            )}
          </div>
          <div className="jn-actions">
            <button onClick={() => { if (nearby.npc) flow.interactNpc(); }} disabled={!nearby.npc || snapshot.state !== 'EXPLORING'}>Bicara dengan NPC</button>
            <button onClick={() => { if (nearby.document) flow.openDocument(); }} disabled={!nearby.document || snapshot.state !== 'EXPLORING'}>Buka dokumen</button>
            <button onClick={() => { if (nearby.challenge && snapshot.hasReadDocument) flow.openChallenge(); }} disabled={!nearby.challenge || !snapshot.hasReadDocument || snapshot.state !== 'EXPLORING'}>Kerjakan tantangan</button>
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
          <p className="jn-tip">Demo lokal tanpa akun: progres hanya selama tab ini terbuka. Skor latihan bukan nilai akademik resmi.</p>
        </aside>
      </section>
      {snapshot.overlay === 'npc' && <section ref={activePanel} tabIndex={-1} className="jn-panel" role="dialog" aria-label="Dialog pustakawan">
        <h2>{content.npc.name}</h2><p>{content.npc.message}</p>
        <button onClick={() => flow.closeInteraction()}>Tutup dialog</button>
      </section>}
      {snapshot.overlay === 'document' && <section ref={activePanel} tabIndex={-1} className="jn-panel" role="dialog" aria-label="Dokumen perpustakaan">
        <h2>{content.document.title}</h2>
        {content.document.paragraphs.map(p => <p key={p.id}><strong>{p.id}</strong> — {p.text}</p>)}
        <button onClick={() => flow.closeInteraction()}>Saya sudah membaca</button>
      </section>}
      {(snapshot.state === 'ASSESSMENT' || snapshot.state === 'SUBMITTING') && <section ref={activePanel} tabIndex={-1} className="jn-panel" aria-label="Assessment Evidence Hunt">
        <h2>Tantangan · Percobaan {snapshot.attemptCount}</h2>
        {practice && <div className="jn-practice"><h3>{practiceByPath[practice].title}</h3><p>{practiceByPath[practice].passage}</p><p>{practiceByPath[practice].guidance}</p></div>}<p>{content.challenge.prompt}</p>
        <fieldset disabled={snapshot.state !== 'ASSESSMENT'}>
          <legend>Pilih kutipan yang menurutmu relevan:</legend>
          {content.document.paragraphs.map(p => <label key={p.id} className="jn-option">
            <input type="radio" name="evidence-choice" checked={snapshot.selectedEvidenceId === p.id} onChange={() => flow.selectEvidence(p.id)}/>
            <span>{p.text}</span>
          </label>)}
        </fieldset>
        {reasoningQuestions.map(q => <fieldset key={q.id} disabled={snapshot.state !== 'ASSESSMENT'}>
          <legend>{q.prompt}</legend>
          {q.options.map(o => <label key={o.id} className="jn-option"><input type="radio" name={q.id} checked={snapshot.answers[q.id] === o.id} onChange={() => flow.selectAnswer(q.id, o.id)}/><span>{o.text}</span></label>)}
        </fieldset>)}
        {snapshot.state === 'ASSESSMENT' && <div className="jn-actions">
          <button className="jn-primary" disabled={!snapshot.selectedEvidenceId || reasoningQuestions.some(q => !snapshot.answers[q.id]) || snapshot.busy} onClick={() => void flow.submit()}>Kirim jawaban</button>
          <button onClick={() => flow.hint()} disabled={snapshot.hintsUsed >= 2}>Petunjuk</button>
        </div>}
        {snapshot.hintsUsed > 0 && <p className="jn-tip">{snapshot.hintsUsed === 1 ? 'Petunjuk 1: cari dua angka dari periode berbeda. Apa yang berubah?' : 'Petunjuk 2: pisahkan bukti kenaikan jumlah dari klaim penyebab. Data sebagian peserta tidak mewakili semua siswa.'}</p>}
        {snapshot.state === 'SUBMITTING' && <p aria-live="polite">{snapshot.busy ? 'Mengirim jawaban...' : 'Menunggu pengiriman ulang.'}</p>}
        {snapshot.submitError && <div className="jn-error" role="alert">{snapshot.submitError}<button onClick={() => void flow.submit()} disabled={snapshot.busy}>Coba lagi</button></div>}
      </section>}
      {snapshot.state === 'FEEDBACK' && snapshot.result && <section ref={activePanel} tabIndex={-1} className="jn-panel" aria-live="polite">
        <h2>Feedback Assessment</h2><p><strong>SIMULASI.</strong> Skor latihan lokal: {snapshot.result.score}/100. Dihitung oleh aturan deterministik pada server demo lokal, bukan nilai resmi Supabase.</p>
        {snapshot.result.feedback.map((item, index) => <p key={item.item_id ?? index}>{item.message}</p>)}
        <div className="jn-actions"><button className="jn-primary" onClick={() => flow.nextPath()}>Lihat BedaJalur</button><button onClick={() => flow.retry()}>Perbaiki jawaban</button></div>
      </section>}
      {snapshot.state === 'ADAPTIVE_TRANSITION' && snapshot.result && <section ref={activePanel} tabIndex={-1} className="jn-panel">
        <h2>BedaJalur: {adaptiveText[snapshot.result.next_path].title}</h2>
        <p>{adaptiveText[snapshot.result.next_path].description}</p>
        <p className="jn-tip">Rekomendasi latihan berasal dari tiga aktivitas, petunjuk, dan percobaan. Ini bukan label kemampuan tetap. Konten latihan masih draf untuk ditinjau guru/PIC C.</p>
        <div className="jn-practice"><h3>{practiceByPath[snapshot.result.next_path].title}</h3><p>{practiceByPath[snapshot.result.next_path].passage}</p><p>{practiceByPath[snapshot.result.next_path].guidance}</p></div>
        <div className="jn-actions"><button className="jn-primary" onClick={() => { setPractice(snapshot.result!.next_path); flow.retry(); }}>Latihan ulang dengan bantuan jalur ini</button><button onClick={() => flow.finish()}>Selesaikan misi</button></div>
      </section>}
      {snapshot.state === 'COMPLETED' && <section ref={activePanel} tabIndex={-1} className="jn-panel"><h2>Petualangan selesai!</h2><p>Kamu berhasil menelusuri misi hingga tahap BedaJalur. Progres ini hanya ada di memori browser.</p><button onClick={() => { setPractice(null); flow.retry(); }}>Latihan lagi</button></section>}
      <details className="jn-panel"><summary>Pengujian pengiriman demo</summary><p>Aktifkan sebelum mengirim untuk menguji kegagalan jaringan satu kali. Klik Coba lagi setelah pesan gagal muncul.</p><label><input type="checkbox" checked={failNext} disabled={snapshot.state === 'SUBMITTING'} onChange={e => { setFailNext(e.target.checked); if (repository) repository.failNext = e.target.checked; }}/> Gagalkan pengiriman berikutnya sekali</label><p>Flag habis setelah satu kegagalan. Matikan lalu aktifkan lagi untuk mengulang simulasi.</p></details>
    </>}
  </main>;
}
