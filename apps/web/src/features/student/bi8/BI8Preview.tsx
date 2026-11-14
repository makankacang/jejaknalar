/**
 * PIC D isolated BI8 preview. Real C-03 draft story text + D-06 Phaser world,
 * NOT a published QuestV1, official assessment, or replacement for student runtime.
 */
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import Phaser from 'phaser';
import { AdventureScene } from '../../../game/sprint2/scene';
import { isTextEntryTarget } from '../../../game/sprint2/keyboard-focus';
import { ROOMS, safeSpawn, type Point, type Target, type Heading } from '../../../game/sprint2/world';
import type { State } from '../../../game/sprint2/state';
import type { PendingAssessment } from '../../../game/sprint2/backend-b05/assessment';
import type { StoryTask } from '../../../game/sprint2/story-c03/adapter';
import { MobileJoystick } from '../sprint2/MobileJoystick';
import { LearningObjectCloseup } from '../sprint2/LearningObjectCloseup';
import { resolveGuide } from '../../../game/sprint2/mission-guidance';
import { presentationForTask } from '../../../game/sprint2/learning-object-presentation';
import { TaskTracker, LocalMap, WorldAtlas, type TaskRow } from '../sprint2/MissionUI';
import {
  completeStoryInteraction,
  openStoryDialogue, currentStoryDialogue, chooseStoryDialogue,
  closeStoryDialogue, type StoryProgress,
} from '../../../game/sprint2/story-c03/runtime';
import {
  story, previewPlan, activityLabels, emptyAnswer, canComplete, evidenceOptionsForParagraph,
  serializeBi8Assessment, activeMission, isActivityAllowed, initialSpatialState, completedPreviewState,
  newProgress, missionGuidance, missingAssessmentFields, type LocalAnswer,
} from './bi8-model';

const plan = previewPlan(); // Validates the *actual* C-03 JSON and D-06 slots before rendering.
type Modal = 'intro' | 'dialogue' | 'task' | 'journal' | 'map' | 'finished' | null;
type AnswerStore = Record<string, LocalAnswer>;
const missionCount = story.missions.length;
const note = 'DEMO LOKAL · PREVIEW BI8 · Respons tidak dikirim ke server dan belum dinilai';
const draftStorageKey = `jejaknalar:bi8:local-drafts:${story.quest_version_id}:v2`;

const taskLabel = (task: StoryTask) => activityLabels[task.activity_id] ?? task.instruction;
const isLocalAnswer = (value: unknown): value is LocalAnswer => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<LocalAnswer>;
  return Array.isArray(item.viewedSourceIndices) && item.viewedSourceIndices.every(value => Number.isInteger(value)) &&
    typeof item.comparison === 'string' && Array.isArray(item.categories) && item.categories.length === 2 && item.categories.every(v => typeof v === 'string') &&
    Array.isArray(item.evidenceIndices) && item.evidenceIndices.length === 2 && item.evidenceIndices.every(v => Number.isInteger(v)) &&
    Array.isArray(item.reasons) && item.reasons.length === 2 && item.reasons.every(v => typeof v === 'string');
};
const loadLocalDrafts = (): AnswerStore => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(draftStorageKey);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, LocalAnswer] => isLocalAnswer(entry[1])));
  } catch { return {}; }
};
const stopGameKeyCapture = (event: ReactKeyboardEvent<HTMLElement>) => event.stopPropagation();

export function BI8Preview({pendingAssessment = null}: {pendingAssessment?: PendingAssessment | null} = {}) {
  const [modal, setModal] = useState<Modal>('intro');
  const [nearby, setNearby] = useState<Target | null>(null);
  const [room, setRoom] = useState(plan.startRoom);
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState<StoryProgress>(newProgress);
  const [selectedTask, setSelectedTask] = useState<StoryTask | null>(null);
  const [answer, setAnswer] = useState<LocalAnswer>(emptyAnswer);
  const [storedAnswers, setStoredAnswers] = useState<AnswerStore>(loadLocalDrafts);
  // Keep the latest local drafts available to stable Phaser callbacks without stale closures.
  const draftsRef = useRef<AnswerStore>(storedAnswers);
  draftsRef.current = storedAnswers;
  const [run, setRun] = useState(false);
  const [debug, setDebug] = useState(false);
  const [visited, setVisited] = useState<string[]>([plan.startRoom]);
  const [guideExpanded, setGuideExpanded] = useState(false);
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

  // Reuse the REV5 engine's legal route, marker and off-screen arrow logic.
  // The active target is derived from the Story Bundle, never from fixture Task IDs.
  const activeSceneGuide = useCallback(() => {
    const spatialNow = spatial.current;
    const active = missionGuidance(progressRef.current, spatialNow.room, null);
    if (!active.roomId || !active.targetId) return null;
    return resolveGuide({
      world: 'school', room: spatialNow.room, position: spatialNow.position,
      objectiveRoom: active.roomId, objectiveTargetId: active.targetId,
      statuses: spatialNow.statuses,
    });
  }, []);
  const activeSceneMarker = useCallback((target: Target) => {
    const spatialNow = spatial.current;
    const active = missionGuidance(progressRef.current, spatialNow.room, null);
    if (active.roomId === spatialNow.room && active.targetId === target.id) return 'active' as const;
    if (target.kind === 'task') {
      const activity = plan.tasks.find(task => task.room_id === spatialNow.room && task.object_id === target.objectId);
      if (activity && progressRef.current.completedActivityIds.includes(activity.activity_id)) return 'completed' as const;
    }
    return 'explore' as const;
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
      guidance: activeSceneGuide,
      markerStatus: activeSceneMarker,
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
  }, [onInteract, savePosition, activeSceneGuide, activeSceneMarker]);

  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(() => setMessage(''), 6000);
    return () => window.clearTimeout(id);
  }, [message]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target;
      const editing = target instanceof HTMLElement && isTextEntryTarget(target);
      if (editing) return;
      if (event.key === 'Escape' && modalRef.current) {
        setModal(null);
        setStory(closeStoryDialogue(progressRef.current));
      }
      if (event.key.toLowerCase() === 'm' && !modalRef.current) setModal('map');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setStory]);

  useEffect(() => {
    try { window.localStorage.setItem(draftStorageKey, JSON.stringify(storedAnswers)); }
    catch { /* Drafts remain available in memory when browser storage is disabled. */ }
  }, [storedAnswers]);

  const updateAnswer = (patch: Partial<LocalAnswer>) => {
    const next = {...answer, ...patch};
    setAnswer(next);
    if (selectedTask) setStoredAnswers(current => ({...current, [selectedTask.activity_id]: next}));
  };
  const completeTask = (answerToSave: LocalAnswer = answer) => {
    if (!selectedTask || !presentationForTask(selectedTask.room_id, selectedTask.object_id) || !canComplete(selectedTask, answerToSave) || !isActivityAllowed(selectedTask, progressRef.current)) return;
    const before = progressRef.current;
    const next = completeStoryInteraction(plan, before, selectedTask.room_id, selectedTask.object_id);
    if (next === before) { setMessage('Aktivitas belum dapat diselesaikan dalam urutan misi.'); return; }
    setStoredAnswers(current => ({...current, [selectedTask.activity_id]: {...answerToSave}}));
    setStory(next);
    setSelectedTask(null);
    setModal(next.completedActivityIds.length === plan.tasks.length ? 'finished' : null);
    setMessage(selectedTask.template === 'decide'
      ? 'Respons tersimpan di preview lokal (DEMO). Belum dikirim ke server dan belum dinilai.'
      : selectedTask.template === 'observe'
        ? 'Bacaan selesai. Target misi berikutnya sudah terbuka.'
        : 'Catatan perbandingan tersimpan di jurnal preview lokal.');
  };
  const finishReading = () => {
    if (!selectedTask) return;
    const allViewed = selectedTask.source_refs.map((_, index) => index);
    const nextAnswer = {...answer, viewedSourceIndices: allViewed};
    updateAnswer({viewedSourceIndices: allViewed});
    if (selectedTask.template === 'observe') completeTask(nextAnswer);
    else setMessage('Bacaan selesai. Silakan lanjutkan aktivitas dengan jawabanmu sendiri.');
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
    try { window.localStorage.removeItem(draftStorageKey); } catch { /* Optional local recovery. */ }
    setRoom(plan.startRoom);
    setPosition({...spatial.current.position});
    setVisited([plan.startRoom]);
    setSelectedTask(null);
    setNearby(null);
    setModal('intro');
    setMessage('Preview dimulai ulang. Belum ada hasil siswa tersimpan.');
  };

  const mission = activeMission(progress);
  const currentDialogue = currentStoryDialogue(plan, progress);
  const canRecord = selectedTask ? canComplete(selectedTask, answer) : false;
  const missingFields = selectedTask?.template === 'decide' ? missingAssessmentFields(selectedTask, answer) : [];
  const completed = progress.completedActivityIds.length;
  const guide = missionGuidance(progress, room, nearby?.id ?? null);
  const taskRows: TaskRow[] = story.missions.map((m): TaskRow => {
    const task = story.tasks.find(t => m.activity_ids.includes(t.activity_id));
    const done = m.activity_ids.every(id => progress.completedActivityIds.includes(id));
    const isCurrent = mission?.mission_id === m.mission_id;
    return { id: m.mission_id,
      label: task ? taskLabel(task) : 'Aktivitas redaksi',
      place: ROOMS[m.room_id]?.title ?? m.room_id,
      status: done ? 'completed' : isCurrent ? 'active' : 'locked',
    };
  });
  const navigationGuide = resolveGuide({
    world: 'school', room, position,
    objectiveRoom: guide.roomId, objectiveTargetId: guide.targetId ?? undefined,
    statuses: spatial.current.statuses,
  });
  const guideTarget = navigationGuide?.target;
  const deltaX = guideTarget ? guideTarget.x - position.x : 0;
  const deltaY = guideTarget ? guideTarget.y - position.y : 0;
  const guideDirection = guideTarget && Math.hypot(deltaX, deltaY) > 65
    ? `${Math.abs(deltaY) > 45 ? (deltaY > 0 ? '↓' : '↑') : ''}${Math.abs(deltaX) > 45 ? (deltaX > 0 ? '→' : '←') : ''}`
    : guideTarget ? '!' : '◇';
  const taskPresentation = selectedTask ? presentationForTask(
    selectedTask.room_id, selectedTask.object_id,
    progress.completedActivityIds.includes(selectedTask.activity_id) ? 'completed' : 'active',
  ) : null;


  return <main className="bi8-layout">
    <div className="bi8-game">
      <div className="bi8-phaser" ref={sceneHost} role="application" aria-label="Dunia sekolah. Gunakan WASD atau tombol panah untuk bergerak, E untuk berinteraksi, M untuk peta." />

      <div className="bi8-brand"><span className="bi8-logo">J</span><div><strong>JejakNalar</strong><small>BAHASA INDONESIA · KELAS VIII</small></div></div>
      <span className="bi8-badge">DRAFT · PREVIEW LOKAL</span>
      <div className="bi8-minimap" role="group" aria-label="Peta ruangan saat ini">
        <LocalMap room={ROOMS[room]} position={position} heading={spatial.current.heading} compact />
        <button className="bi8-minimap-open" onClick={() => setModal('map')} aria-label="Buka peta seluruh sekolah">Peta · M</button>
      </div>

      <TaskTracker rows={taskRows} open={() => setModal('journal')} completed={completed === missionCount} />
      {pendingAssessment?.status === 'pending_scoring' && <aside className="bi8-pending-scoring" role="status">Jawaban berhasil diterima dan sedang menunggu penilaian. Nilai dan rekomendasi belajar belum tersedia.</aside>}

      <aside className="bi8-guide" aria-label="Panduan langkah demi langkah">
        <div className="bi8-guide-top"><b>PANDUAN MISI · {Math.min(guide.step, missionCount)}/{missionCount}</b><button aria-expanded={guideExpanded} onClick={() => setGuideExpanded(v => !v)}>{guideExpanded ? 'Ringkas −' : 'Buka +'}</button></div>
        <strong>{guide.heading}</strong>
        {guideExpanded && <>
          <p>{guide.instruction}</p>
          <div className="bi8-guide-next"><span className="bi8-arrow">{guideDirection}</span><span>{guide.callToAction}</span></div>
          <small>{guideTarget ? 'Arah panah adalah perkiraan posisi objek, bukan navigasi otomatis.' : `Tujuan: ${ROOMS[guide.location]?.title ?? guide.location}`}</small>
        </>}
      </aside>

      {!modal && guide.targetId && <div className="bi8-wayfinding" aria-label="Petunjuk arah tujuan aktif" role="status">
        <span className="bi8-wayfinding-icon" aria-hidden="true">{guideDirection}</span>
        <span className="bi8-wayfinding-title">{navigationGuide?.label ?? guide.heading}</span>
        <small>{navigationGuide?.viaDoor ? 'Ikuti pintu menuju ruangan misi' : 'Dekati objek bertanda !'}</small>
      </div>}
      <div className="bi8-location">{ROOMS[room]?.title ?? room} · PREVIEW</div>
      <nav className="bi8-tools" aria-label="Menu permainan"><button onClick={() => setModal('journal')}>Jurnal · {completed}/{missionCount}</button><button onClick={() => setModal('map')}>Peta</button><button onClick={() => setModal('intro')}>Cerita</button></nav>
      {message && !modal && <p className="bi8-toast" role="status">{message}</p>}
      {!modal && <div className="bi8-controls">
        <MobileJoystick onMove={direction => {joystick.current = direction;}} />
        <div className="bi8-controls-right"><button onClick={() => setRun(v => !v)} aria-pressed={run}>LARI · {run?'ON':'OFF'}</button><button className="bi8-interact" disabled={!nearby} onClick={() => scene.current?.interactNearest()}>{nearby ? `E · ${nearby.label}` : 'E · Dekati objek'}</button></div>
      </div>}
    </div>
    <div className="bi8-footer"><span>{note}</span><button onClick={() => setDebug(v=>!v)}>{debug ? 'Tutup debug' : 'Debug collision'}</button></div>

    {modal && <div className="bi8-modal-shade" role="presentation"><section className="bi8-modal" role="dialog" aria-modal="true" aria-label={modal === 'task' ? 'Aktivitas redaksi' : 'Menu misi redaksi'}>
      <div className="bi8-modal-head"><span>{modal === 'task' ? 'AKTIVITAS PEMBELAJARAN' : modal === 'intro' ? 'PROLOG' : modal === 'dialogue' ? 'PERCAKAPAN' : modal === 'journal' ? 'JURNAL EVIDENCE' : modal === 'map' ? 'PETA SEKOLAH' : 'MISI SELESAI'}</span><button onClick={() => {setModal(null); setStory(closeStoryDialogue(progressRef.current));}}>Tutup ×</button></div>

      {modal === 'intro' && <div className="bi8-modal-body"><p className="bi8-overline">BAHASA INDONESIA · KELAS VIII · DRAFT PIC C</p><h1>{story.title}</h1><p>{story.opening}</p><div className="bi8-note">Mulai di Perpustakaan. Dekati Bu Maya (pustakawan), tekan E, lalu pilih percakapan untuk membuka misi. Bergerak dengan WASD / panah atau joystick di ponsel.</div><button className="bi8-primary" onClick={() => setModal(null)}>Mulai menjelajah</button></div>}

      {modal === 'dialogue' && <div className="bi8-modal-body"><h2>Bu Maya · Pustakawan</h2>{currentDialogue ? <><p className="bi8-dialogue">{currentDialogue.node.text}</p><div className="bi8-choice-buttons">{currentDialogue.node.choices.map(choice => <button key={choice.choice_id} onClick={() => chooseDialogue(choice.choice_id)}>{choice.label}</button>)}</div></> : <p>Dialog berakhir. Silakan melanjutkan aktivitas.</p>}</div>}

      {modal === 'task' && selectedTask && <div className="bi8-modal-body">
        <p className="bi8-overline">{taskLabel(selectedTask)} · {ROOMS[selectedTask.room_id]?.title}</p>
        <h2>{selectedTask.template === 'observe' ? 'Amati panduan redaksi' : selectedTask.template === 'investigate' ? 'Bandingkan isi paragraf' : 'Buat klasifikasi disertai bukti'}</h2>
        <p>{selectedTask.instruction}</p>
        <h3>Periksa sumber pembelajaran</h3>
        {taskPresentation ? <LearningObjectCloseup key={selectedTask.activity_id}
          presentation={taskPresentation}
          excerpts={selectedTask.source_refs.map((ref, index) => ({
            title: selectedTask.template === 'observe' ? 'Panduan redaksi'
              : selectedTask.template === 'investigate' ? (index === 0 ? 'Paragraf A · Sepeda Mira' : 'Paragraf B · Sepeda motor')
              : index === 0 ? 'Panduan redaksi' : index === 1 ? 'Paragraf A · Sepeda Mira' : 'Paragraf B · Sepeda motor',
            text: ref.excerpt,
          }))}
          viewed={answer.viewedSourceIndices}
          onView={index => updateAnswer({
            viewedSourceIndices: [...new Set([...answer.viewedSourceIndices,index])].sort((a,b)=>a-b),
          })}
          onFinish={finishReading}
        /> : <p role="alert" className="bi8-note">Objek pembelajaran belum mempunyai visual close-up yang tervalidasi. Hubungi pengelola materi.</p>}

        {selectedTask.template === 'investigate' && <div className="bi8-form-group"><label htmlFor="bi8-compare">Apa perbedaan cara kedua paragraf menyajikan informasi?</label><textarea id="bi8-compare" rows={4} value={answer.comparison} onChange={e => updateAnswer({comparison: e.target.value})} onKeyDownCapture={stopGameKeyCapture} placeholder="Tuliskan pengamatanmu dengan kalimat sendiri." /><small>Tulis pengamatan dengan alasan yang jelas. Ini pemeriksaan kelengkapan, bukan penilaian akademik.</small></div>}

        {selectedTask.template === 'decide' && <>
          <div className="bi8-assessment-intro"><p className="bi8-overline">MISI REDAKSI · AUDIT DUA PARAGRAF</p><p>Bacalah kedua paragraf. Tentukan jenisnya, pilih bagian teks yang menjadi bukti, lalu jelaskan alasanmu menggunakan kalimat sendiri.</p></div>
          <div className="bi8-two-answers">
            {([0,1] as const).map((i) => {
              const evidenceOptions = evidenceOptionsForParagraph(selectedTask, i);
              return <fieldset className="bi8-answer-card" key={i}>
                <legend>{i===0 ? 'Paragraf A · Sepeda Mira' : 'Paragraf B · Sepeda motor'}</legend>
                <label>Jenis paragraf<select value={answer.categories[i]} onChange={e => updateAnswer({categories: i === 0 ? [e.target.value,answer.categories[1]] : [answer.categories[0],e.target.value]})} onKeyDownCapture={stopGameKeyCapture}><option value="">Pilih jenis paragraf</option><option value="deskripsi">Deskripsi</option><option value="eksposisi">Eksposisi</option></select></label>
                <label>Bagian teks sebagai bukti<select value={answer.evidenceIndices[i]} onChange={e => updateAnswer({evidenceIndices: i === 0 ? [Number(e.target.value),answer.evidenceIndices[1]] : [answer.evidenceIndices[0],Number(e.target.value)]})} onKeyDownCapture={stopGameKeyCapture}><option value={-1}>Pilih kutipan dari paragraf</option>{evidenceOptions.map((quote, index) => <option value={index} key={`${i}-${index}`}>{quote}</option>)}</select></label>
                <label>Alasan berdasarkan bukti<textarea rows={4} value={answer.reasons[i]} onChange={e => updateAnswer({reasons: i === 0 ? [e.target.value, answer.reasons[1]] : [answer.reasons[0],e.target.value]})} onKeyDownCapture={stopGameKeyCapture} placeholder="Jelaskan dengan kalimatmu sendiri. Jawaban tidak harus sama dengan contoh." /></label>
              </fieldset>;
            })}
          </div>
          <p className="bi8-note">Isi semua bagian untuk Paragraf A dan B: klasifikasi, bukti, dan alasan. Jawaban tidak harus benar atau sama dengan contoh. Permainan hanya memeriksa kelengkapan isian, bukan menilai benar atau salah.</p>
        </>}
        {selectedTask.template === 'investigate' && <p className="bi8-note">Kamu boleh menuliskan pengamatan dengan kata-katamu sendiri. Ini catatan aktivitas lokal, bukan nilai.</p>}
        {selectedTask.template === 'observe' && <p className="bi8-note">Baca materi sampai selesai, lalu tekan “Selesai membaca” pada tampilan buku untuk membuka tujuan berikutnya.</p>}
        <div className="bi8-modal-actions">
          {selectedTask.template !== 'observe' && <button className="bi8-primary" disabled={!canRecord} onClick={() => completeTask()}>{selectedTask.template === 'decide' ? 'Kirim respons · DEMO LOKAL' : 'Catat hasil perbandingan'}</button>}
          <button className="bi8-secondary" onClick={() => setModal(null)}>Lanjutkan nanti</button>
        </div>
        {selectedTask.template === 'decide' && <small className="bi8-input-hint" role="status" aria-live="polite">{canRecord
          ? 'Semua enam bagian sudah terisi. Jawaban bebas; preview ini tidak menilai benar atau salah.'
          : `Belum lengkap: ${missingFields.join(', ')}. Lengkapi semua bagian sebelum mengirim. Jawaban tidak harus benar.`}</small>}
      </div>}

      {modal === 'journal' && <div className="bi8-modal-body"><h2>Jurnal perjalanan redaksi</h2><p>Progres lokal: {completed} dari {missionCount} aktivitas. Evidence berikut tidak menunjukkan penguasaan akademik.</p><ol className="bi8-journal">{story.missions.map(m => {const t = story.tasks.find(a => m.activity_ids.includes(a.activity_id)); const done = !!t && progress.completedActivityIds.includes(t.activity_id); const evidence = story.evidence.filter(e => e.mission_id === m.mission_id); return <li key={m.mission_id}><strong>{t ? taskLabel(t) : m.mission_id}</strong><span>{done ? '✓ Tercatat' : 'Belum selesai'}</span>{done && evidence.map(e => <div key={e.evidence_id}><b>{e.title}</b><p>{e.summary}</p></div>)}{done && t && storedAnswers[t.activity_id]?.comparison && <p><i>Catatan pengamatan:</i> {storedAnswers[t.activity_id].comparison}</p>}{done && t?.template === 'decide' && storedAnswers[t.activity_id] && <details className="bi8-local-response"><summary>Lihat respons yang dicatat · DEMO LOKAL</summary><pre>{serializeBi8Assessment(t, storedAnswers[t.activity_id])}</pre><small>Belum dikirim ke backend dan belum dinilai.</small></details>}</li>;})}</ol><button className="bi8-secondary" onClick={() => setModal(null)}>Kembali ke permainan</button></div>}

      {modal === 'map' && <div className="bi8-modal-body bi8-unified-map">
        <WorldAtlas
          world="school" room={ROOMS[room]} visited={visited}
          position={position} heading={spatial.current.heading} guide={null}
          openJournal={() => setModal('journal')} close={() => setModal(null)}
        />
        <p className="bi8-note">Peta menampilkan rute dan ruang untuk eksplorasi. Perpindahan tetap melalui pintu dalam game; peta tidak melakukan teleport.</p>
      </div>}

      {modal === 'finished' && <div className="bi8-modal-body"><p className="bi8-overline">3/3 AKTIVITAS SELESAI</p><h2>Catatan redaksi selesai</h2><p>{story.endings.ready_for_extension ?? 'Semua aktivitas lokal selesai. Hasil belum dinilai.'}</p><p className="bi8-note">Ini adalah penyelesaian preview non-published, bukan hasil assessment resmi, mastery, atau BedaJalur produksi.</p><div className="bi8-modal-actions"><button className="bi8-primary" onClick={() => setModal('journal')}>Lihat jurnal</button><button className="bi8-secondary" onClick={resetPreview}>Ulangi preview</button><button className="bi8-secondary" onClick={() => setModal(null)}>Tetap menjelajah</button></div></div>}
    </section></div>}
  </main>;
}
