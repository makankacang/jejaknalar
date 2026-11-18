/**
 * PIC D isolated BI8 preview. Real C-03 draft story text + D-06 Phaser world,
 * NOT a published QuestV1, official assessment, or replacement for student runtime.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { AdventureScene } from '../../../game/sprint2/scene';
import { ROOMS, safeSpawn, type Point, type Target, type Heading } from '../../../game/sprint2/world';
import type { State } from '../../../game/sprint2/state';
import type { StoryTask } from '../../../game/sprint2/story-c03/adapter';
import {
  completeStoryInteraction,
  openStoryDialogue, currentStoryDialogue, chooseStoryDialogue,
  closeStoryDialogue, type StoryProgress,
} from '../../../game/sprint2/story-c03/runtime';
import {
  story, previewPlan, activityLabels, emptyAnswer, canComplete,
  activeMission, isActivityAllowed, initialSpatialState, completedPreviewState,
  newProgress, missionGuidance, type LocalAnswer,
} from './bi8-model';

const plan = previewPlan(); // Validates the *actual* C-03 JSON and D-06 slots before rendering.
type Modal = 'intro' | 'dialogue' | 'task' | 'journal' | 'map' | 'finished' | null;
type AnswerStore = Record<string, LocalAnswer>;
const missionCount = story.missions.length;
const note = 'DRAFT BI8 v0.1 · PREVIEW LOKAL · Tidak mengirim jawaban atau nilai ke server';

const taskLabel = (task: StoryTask) => activityLabels[task.activity_id] ?? task.instruction;
const sourceLabel = (index: number, sourceMapId: string) => `Dokumen ${index + 1} · ${sourceMapId}`;
const sourceLocator = (ref: StoryTask['source_refs'][number]) => ref.locator.kind === 'docx_paragraph'
  ? `Paragraf ${ref.locator.paragraph_index}` : `Halaman ${ref.locator.page}`;

export function BI8Preview() {
  const [modal, setModal] = useState<Modal>('intro');
  const [nearby, setNearby] = useState<Target | null>(null);
  const [room, setRoom] = useState(plan.startRoom);
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState<StoryProgress>(newProgress);
  const [selectedTask, setSelectedTask] = useState<StoryTask | null>(null);
  const [answer, setAnswer] = useState<LocalAnswer>(emptyAnswer);
  const [storedAnswers, setStoredAnswers] = useState<AnswerStore>({});
  const draftsRef = useRef<AnswerStore>({});
  const [run, setRun] = useState(false);
  const [debug, setDebug] = useState(false);
  const [visited, setVisited] = useState<string[]>([plan.startRoom]);
  const [guideExpanded, setGuideExpanded] = useState(true);
  const sceneHost = useRef<HTMLDivElement>(null);
  const scene = useRef<AdventureScene | null>(null);
  const joystick = useRef<Point>({x: 0, y: 0});
  const spatial = useRef<State>(initialSpatialState(plan));
  const [position, setPosition] = useState<Point>(() => ({...spatial.current.position}));
  const lastPositionRender = useRef(0);
  const progressRef = useRef(progress);
  const modalRef = useRef<Modal>(modal);
  const runRef = useRef(run);
  const debugRef = useRef(debug);
  modalRef.current = modal;
  runRef.current = run;
  debugRef.current = debug;
  progressRef.current = progress;

  const setStory = useCallback((next: StoryProgress) => {
    progressRef.current = next;
    setProgress(next);
    spatial.current = completedPreviewState(spatial.current, next);
  }, []);

  const savePosition = useCallback((position: Point, heading: Heading) => {
    spatial.current = {...spatial.current, position, heading};
    if (Date.now() - lastPositionRender.current > 300) {
      lastPositionRender.current = Date.now();
      setPosition({...position});
    }
  }, []);

  const onInteract = useCallback((target: Target) => {
    const s = spatial.current;
    if (target.kind === 'door') {
      const destination = target.to && ROOMS[target.to];
      if (!destination || destination.world !== 'school') {
        setMessage('Pintu ini tidak tersedia di dunia Sekolah.');
        return;
      }
      const required = target.required ? story.tasks.find(t => t.template === target.required) : undefined;
      if (required && !progressRef.current.completedActivityIds.includes(required.activity_id)) {
        setMessage('Aula belum dapat dimasuki. Selesaikan kegiatan membandingkan paragraf di Ruang Guru.');
        return;
      }
      const position = safeSpawn(destination, target.portal?.target_spawn ?? destination.spawn);
      spatial.current = {...s, room: destination.id, position, visited: [...new Set([...s.visited, destination.id])]};
      setRoom(destination.id);
      setVisited(spatial.current.visited);
      setNearby(null);
      setMessage(`Memasuki ${destination.title}.`);
      return;
    }
    if (target.kind === 'npc') {
      const opened = openStoryDialogue(plan, progressRef.current, target.id, s.room);
      if (!opened.activeDialogue) {
        setMessage('Tokoh ini dapat disapa, tetapi tidak memiliki dialog untuk misi redaksi.');
        return;
      }
      setStory(opened);
      setModal('dialogue');
      return;
    }
    if (target.kind === 'task') {
      const activity = plan.tasks.find(t => t.room_id === s.room && t.object_id === target.objectId);
      if (!activity) {
        setMessage('Objek ini bukan bagian dari misi redaksi yang sedang dikerjakan.');
        return;
      }
      if (progressRef.current.completedActivityIds.includes(activity.activity_id)) {
        setMessage('Aktivitas ini sudah dicatat. Buka Jurnal untuk melihat evidence.');
        return;
      }
      if (!isActivityAllowed(activity, progressRef.current)) {
        setMessage(progressRef.current.unlockedMissionIds.length === 0
          ? 'Temui Bu Maya di Perpustakaan dan pilih mulai misi terlebih dahulu.'
          : 'Selesaikan satu aktivitas sebelumnya agar misi berikutnya terbuka.');
        return;
      }
      setSelectedTask(activity);
      setAnswer(draftsRef.current[activity.activity_id] ?? emptyAnswer());
      setModal('task');
      return;
    }
    if (target.kind === 'map') { setModal('map'); return; }
    setMessage('Objek ini bagian dari lingkungan sekolah, tetapi tidak diperlukan untuk misi redaksi saat ini.');
  }, [setStory]);

  useEffect(() => {
    const host = sceneHost.current;
    if (!host) return;
    const adventure = new AdventureScene({
      snapshot: () => spatial.current,
      active: () => modalRef.current === null,
      direction: () => joystick.current,
      position: savePosition,
      interact: onInteract,
      nearby: setNearby,
      message: setMessage,
      reduced: () => false,
      running: () => runRef.current,
      debug: () => debugRef.current,
    });
    scene.current = adventure;
    const game = new Phaser.Game({
      type: Phaser.CANVAS, parent: host, pixelArt: true, roundPixels: true,
      backgroundColor: '#173641',
      scale: {mode: Phaser.Scale.RESIZE, width: Math.max(320, host.clientWidth),
        height: Math.max(300, host.clientHeight), autoCenter: Phaser.Scale.CENTER_BOTH},
      scene: adventure, input: {activePointers: 3},
    });
    const resize = () => {
      if (!game.isBooted || !host.isConnected) return;
      const w = Math.floor(host.clientWidth), h = Math.floor(host.clientHeight);
      if (w >= 150 && h >= 150) { game.scale.resize(w, h); adventure.reframe(); }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    const clearJoystick = () => { joystick.current = {x: 0, y: 0}; };
    window.addEventListener('blur', clearJoystick);
    return () => {
      observer.disconnect();
      window.removeEventListener('blur', clearJoystick);
      clearJoystick();
      scene.current = null;
      game.destroy(true);
    };
  }, [onInteract, savePosition]);

  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(() => setMessage(''), 6000);
    return () => window.clearTimeout(id);
  }, [message]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && modalRef.current) {
        setModal(null);
        setStory(closeStoryDialogue(progressRef.current));
      }
      if (event.key.toLowerCase() === 'm' && !modalRef.current && !(event.target instanceof HTMLInputElement)) setModal('map');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setStory]);

  useEffect(() => { if (selectedTask) draftsRef.current[selectedTask.activity_id] = answer; }, [answer, selectedTask]);

  const updateAnswer = (patch: Partial<LocalAnswer>) => setAnswer(a => ({...a, ...patch}));
  const completeTask = () => {
    if (!selectedTask || !canComplete(selectedTask, answer) || !isActivityAllowed(selectedTask, progressRef.current)) return;
    const before = progressRef.current;
    const next = completeStoryInteraction(plan, before, selectedTask.room_id, selectedTask.object_id);
    if (next === before) { setMessage('Aktivitas belum dapat diselesaikan dalam urutan misi.'); return; }
    setStoredAnswers(current => ({...current, [selectedTask.activity_id]: {...answer}}));
    delete draftsRef.current[selectedTask.activity_id];
    setStory(next);
    setSelectedTask(null);
    setModal(next.completedActivityIds.length === plan.tasks.length ? 'finished' : null);
    setMessage('Bukti dan progres berhasil dicatat di jurnal preview lokal.');
  };

  const chooseDialogue = (choiceId: string) => {
    const next = chooseStoryDialogue(plan, progressRef.current, choiceId);
    setStory(next);
    if (!next.activeDialogue) setModal(null);
  };

  const resetPreview = () => {
    const fresh = newProgress();
    spatial.current = initialSpatialState(plan);
    setStory(fresh);
    setStoredAnswers({});
    draftsRef.current = {};
    setRoom(plan.startRoom);
    setPosition({...spatial.current.position});
    setVisited([plan.startRoom]);
    setSelectedTask(null);
    setNearby(null);
    setModal('intro');
    setMessage('Preview dimulai ulang. Belum ada hasil siswa tersimpan.');
  };

  const mission = activeMission(progress);
  const nextTask = mission && story.tasks.find(t => mission.activity_ids.includes(t.activity_id));
  const unlocked = !!mission && (mission.prerequisites.length > 0 || progress.unlockedMissionIds.includes(mission.mission_id));
  const objective = mission ? (unlocked && nextTask ? taskLabel(nextTask) : 'Temui Bu Maya, lalu mulai misi redaksi') : 'Semua aktivitas selesai';
  const currentDialogue = currentStoryDialogue(plan, progress);
  const checked = selectedTask && canComplete(selectedTask, answer);
  const completed = progress.completedActivityIds.length;
  const guide = missionGuidance(progress, room, nearby?.id ?? null);
  const guideTarget = guide.targetId && guide.roomId === room
    ? ROOMS[room]?.targets.find(t => t.id === guide.targetId) : undefined;
  const deltaX = guideTarget ? guideTarget.x - position.x : 0;
  const deltaY = guideTarget ? guideTarget.y - position.y : 0;
  const guideDirection = guideTarget && Math.hypot(deltaX, deltaY) > 65
    ? `${Math.abs(deltaY) > 45 ? (deltaY > 0 ? '↓' : '↑') : ''}${Math.abs(deltaX) > 45 ? (deltaX > 0 ? '→' : '←') : ''}`
    : guideTarget ? '✓' : '◇';


  return <main className="bi8-layout">
    <div className="bi8-game">
      <div className="bi8-phaser" ref={sceneHost} role="application" aria-label="Dunia sekolah. Gunakan WASD atau tombol panah untuk bergerak, E untuk berinteraksi, M untuk peta." />

      <div className="bi8-brand"><span className="bi8-logo">J</span><div><strong>JejakNalar</strong><small>BAHASA INDONESIA · KELAS VIII</small></div></div>
      <span className="bi8-badge">DRAFT · PREVIEW LOKAL</span>
      <button className="bi8-minimap" onClick={() => setModal('map')} aria-label="Lihat peta seluruh sekolah">
        <svg viewBox={`0 0 ${ROOMS[room].width} ${ROOMS[room].height}`} aria-hidden="true">
          <rect width={ROOMS[room].width} height={ROOMS[room].height} fill="#83998b" />
          {ROOMS[room].walls.map((w,i) => <rect key={i} x={w.x} y={w.y} width={w.width} height={w.height} fill="#364d4b" />)}
          {ROOMS[room].solids.map(o => <rect key={o.id} x={o.x} y={o.y} width={o.width} height={o.height} fill="#344943" />)}
          {guideTarget && <circle cx={guideTarget.x} cy={guideTarget.y} r={18} fill="#f1be60" stroke="#fff0c0" strokeWidth={10} />}
          <circle cx={position.x} cy={position.y} r={17} fill="#163749" stroke="#fef2d4" strokeWidth={7} />
        </svg>
        <span>Peta · M</span>
      </button>

      <aside className="bi8-guide" aria-label="Panduan langkah demi langkah">
        <div className="bi8-guide-top"><b>PANDUAN MISI · {Math.min(guide.step, missionCount)}/{missionCount}</b><button aria-expanded={guideExpanded} onClick={() => setGuideExpanded(v => !v)}>{guideExpanded ? 'Ringkas −' : 'Buka +'}</button></div>
        <strong>{guide.heading}</strong>
        {guideExpanded && <>
          <p>{guide.instruction}</p>
          <div className="bi8-guide-next"><span className="bi8-arrow">{guideDirection}</span><span>{guide.callToAction}</span></div>
          <small>{guideTarget ? 'Arah panah adalah perkiraan posisi objek, bukan navigasi otomatis.' : `Tujuan: ${ROOMS[guide.location]?.title ?? guide.location}`}</small>
        </>}
      </aside>

      <aside className="bi8-hud" aria-label="Objektif aktif">
        <div className="bi8-hud-kicker">OBJEKTIF AKTIF · {completed}/{missionCount} AKTIVITAS</div>
        <strong>{objective}</strong>
        <p>{guide.callToAction} · {ROOMS[guide.location]?.title ?? guide.location}</p>
        <div className="bi8-progress-track"><span style={{width: `${completed / missionCount * 100}%`}} /></div>
        <button onClick={() => setGuideExpanded(true)}>Lihat petunjuk</button>
      </aside>

      <div className="bi8-location">{ROOMS[room]?.title ?? room} · PREVIEW</div>
      <nav className="bi8-tools" aria-label="Menu permainan"><button onClick={() => setModal('journal')}>Jurnal · {completed}/{missionCount}</button><button onClick={() => setModal('map')}>Peta</button><button onClick={() => setModal('intro')}>Cerita</button></nav>
      {message && !modal && <p className="bi8-toast" role="status">{message}</p>}
      {!modal && <div className="bi8-controls">
        <div className="bi8-dpad" aria-label="Kontrol arah di layar">
          {([{label:'↑',x:0,y:-1,side:'up'},{label:'←',x:-1,y:0,side:'left'},{label:'↓',x:0,y:1,side:'down'},{label:'→',x:1,y:0,side:'right'}] as const).map(d =>
            <button key={d.side} className={`bi8-${d.side}`} aria-label={`Gerak ${d.side}`} onPointerDown={e => {e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); joystick.current={x:d.x,y:d.y};}} onPointerUp={() => {joystick.current={x:0,y:0};}} onPointerCancel={() => {joystick.current={x:0,y:0};}} onLostPointerCapture={() => {joystick.current={x:0,y:0};}}>{d.label}</button>
          )}
        </div>
        <div className="bi8-controls-right"><button onClick={() => setRun(v => !v)} aria-pressed={run}>LARI · {run?'ON':'OFF'}</button><button className="bi8-interact" disabled={!nearby} onClick={() => scene.current?.interactNearest()}>{nearby ? `E · ${nearby.label}` : 'E · Dekati objek'}</button></div>
      </div>}
    </div>
    <div className="bi8-footer"><span>{note}</span><button onClick={() => setDebug(v=>!v)}>{debug ? 'Tutup debug' : 'Debug collision'}</button></div>

    {modal && <div className="bi8-modal-shade" role="presentation"><section className="bi8-modal" role="dialog" aria-modal="true" aria-label={modal === 'task' ? 'Aktivitas redaksi' : 'Menu misi redaksi'}>
      <div className="bi8-modal-head"><span>{modal === 'task' ? 'AKTIVITAS PEMBELAJARAN' : modal === 'intro' ? 'PROLOG' : modal === 'dialogue' ? 'PERCAKAPAN' : modal === 'journal' ? 'JURNAL EVIDENCE' : modal === 'map' ? 'PETA SEKOLAH' : 'MISI SELESAI'}</span><button onClick={() => {setModal(null); setStory(closeStoryDialogue(progressRef.current));}}>Tutup ×</button></div>

      {modal === 'intro' && <div className="bi8-modal-body"><p className="bi8-overline">BAHASA INDONESIA · KELAS VIII · DRAFT PIC C</p><h1>{story.title}</h1><p>{story.opening}</p><div className="bi8-note">Mulai di Perpustakaan. Dekati Bu Maya (pustakawan), tekan E, lalu pilih percakapan untuk membuka misi. Bergerak dengan WASD / panah atau tombol arah di ponsel.</div><button className="bi8-primary" onClick={() => setModal(null)}>Mulai menjelajah</button></div>}

      {modal === 'dialogue' && <div className="bi8-modal-body"><h2>Bu Maya · Pustakawan</h2>{currentDialogue ? <><p className="bi8-dialogue">{currentDialogue.node.text}</p><div className="bi8-choice-buttons">{currentDialogue.node.choices.map(choice => <button key={choice.choice_id} onClick={() => chooseDialogue(choice.choice_id)}>{choice.label}</button>)}</div></> : <p>Dialog berakhir. Silakan melanjutkan aktivitas.</p>}</div>}

      {modal === 'task' && selectedTask && <div className="bi8-modal-body">
        <p className="bi8-overline">{taskLabel(selectedTask)} · {ROOMS[selectedTask.room_id]?.title}</p>
        <h2>{selectedTask.template === 'observe' ? 'Amati panduan redaksi' : selectedTask.template === 'investigate' ? 'Bandingkan isi paragraf' : 'Buat klasifikasi disertai bukti'}</h2>
        <p>{selectedTask.instruction}</p>
        <h3>Periksa kutipan dari materi</h3>
        {selectedTask.source_refs.map((ref,i) => <article className="bi8-source" key={`${ref.source_map_id}-${i}`}>
          <div className="bi8-source-head"><strong>{sourceLabel(i,ref.source_map_id)}</strong><small>{sourceLocator(ref)}</small></div>
          <p>{ref.excerpt}</p>
          <button className={answer.viewedSourceIndices.includes(i) ? 'bi8-read' : ''} onClick={() => updateAnswer({viewedSourceIndices: [...new Set([...answer.viewedSourceIndices,i])].sort((a,b)=>a-b)})}>{answer.viewedSourceIndices.includes(i) ? '✓ Sudah diperiksa' : 'Tandai sudah dibaca'}</button>
        </article>)}

        {selectedTask.template === 'investigate' && <div className="bi8-form-group"><label htmlFor="bi8-compare">Apa perbedaan cara kedua paragraf menyajikan informasi?</label><textarea id="bi8-compare" rows={4} value={answer.comparison} onChange={e => updateAnswer({comparison: e.target.value})} placeholder="Tuliskan pengamatanmu berdasarkan dua kutipan di atas." /><small>Minimal 15 karakter. Catatan ini tidak dinilai otomatis.</small></div>}

        {selectedTask.template === 'decide' && <div className="bi8-two-answers">
          {([0,1] as const).map((i) => <fieldset className="bi8-answer-card" key={i}><legend>{i===0 ? 'Paragraf A · Sepeda Mira' : 'Paragraf B · Sepeda motor'}</legend>
            <label>Jenis paragraf<select value={answer.categories[i]} onChange={e => updateAnswer({categories: i === 0 ? [e.target.value,answer.categories[1]] : [answer.categories[0],e.target.value]})}><option value="">Pilih jenis paragraf</option><option value="deskripsi">Deskripsi</option><option value="eksposisi">Eksposisi</option></select></label>
            <label>Bagian teks sebagai bukti<select value={answer.evidenceIndices[i]} onChange={e => updateAnswer({evidenceIndices: i === 0 ? [Number(e.target.value),answer.evidenceIndices[1]] : [answer.evidenceIndices[0],Number(e.target.value)]})}><option value={-1}>Pilih kutipan pendukung</option>{selectedTask.source_refs.slice(1).map((ref,j) => <option value={j+1} key={ref.source_map_id}>{ref.source_map_id}: {ref.excerpt.slice(0,70)}…</option>)}</select></label>
            <label>Alasan berdasarkan bukti<textarea rows={3} value={answer.reasons[i]} onChange={e => updateAnswer({reasons: i === 0 ? [e.target.value, answer.reasons[1]] : [answer.reasons[0],e.target.value]})} placeholder="Jelaskan ciri paragraf yang mendukung pilihanmu." /></label>
          </fieldset>)}
        </div>}
        <p className="bi8-note">Semua sumber harus ditandai dibaca. Jawaban disimpan hanya dalam memori preview, bukan dikirim atau dinilai oleh backend.</p>
        <div className="bi8-modal-actions"><button className="bi8-primary" disabled={!checked} onClick={completeTask}>Catat aktivitas ke jurnal</button><button className="bi8-secondary" onClick={() => setModal(null)}>Lanjutkan nanti</button></div>
      </div>}

      {modal === 'journal' && <div className="bi8-modal-body"><h2>Jurnal perjalanan redaksi</h2><p>Progres lokal: {completed} dari {missionCount} aktivitas. Evidence berikut tidak menunjukkan penguasaan akademik.</p><ol className="bi8-journal">{story.missions.map(m => {const t = story.tasks.find(a => m.activity_ids.includes(a.activity_id)); const done = !!t && progress.completedActivityIds.includes(t.activity_id); const evidence = story.evidence.filter(e => e.mission_id === m.mission_id); return <li key={m.mission_id}><strong>{t ? taskLabel(t) : m.mission_id}</strong><span>{done ? '✓ Tercatat' : 'Belum selesai'}</span>{done && evidence.map(e => <div key={e.evidence_id}><b>{e.title}</b><p>{e.summary}</p></div>)}{done && t && storedAnswers[t.activity_id]?.comparison && <p><i>Catatan pengamatan:</i> {storedAnswers[t.activity_id].comparison}</p>}{done && t?.template === 'decide' && storedAnswers[t.activity_id] && <p>Alasan klasifikasi tercatat dalam preview lokal (belum dinilai).</p>}</li>;})}</ol><button className="bi8-secondary" onClick={() => setModal(null)}>Kembali ke permainan</button></div>}

      {modal === 'map' && <div className="bi8-modal-body"><h2>Jalur eksplorasi sekolah</h2><p>Berpindah ruangan melalui pintu di dunia game. Pintu Aula memerlukan aktivitas Perbandingan selesai.</p><div className="bi8-maplist">{['school.library','school.corridor','school.staff_room','school.discussion_hall'].map(id=><div key={id} className={room===id?'bi8-current':''}><strong>{ROOMS[id]?.title ?? id}</strong><small>{room===id?'Lokasimu sekarang':visited.includes(id)?'Sudah dikunjungi':'Belum dikunjungi'}</small></div>)}</div><button className="bi8-secondary" onClick={() => setModal(null)}>Kembali ke permainan</button></div>}

      {modal === 'finished' && <div className="bi8-modal-body"><p className="bi8-overline">3/3 AKTIVITAS SELESAI</p><h2>Catatan redaksi selesai</h2><p>{story.endings.ready_for_extension ?? 'Semua aktivitas lokal selesai. Hasil belum dinilai.'}</p><p className="bi8-note">Ini adalah penyelesaian preview non-published, bukan hasil assessment resmi, mastery, atau BedaJalur produksi.</p><div className="bi8-modal-actions"><button className="bi8-primary" onClick={() => setModal('journal')}>Lihat jurnal</button><button className="bi8-secondary" onClick={resetPreview}>Ulangi preview</button><button className="bi8-secondary" onClick={() => setModal(null)}>Tetap menjelajah</button></div></div>}
    </section></div>}
  </main>;
}
