
import { AssessmentController, MockAssessmentPort, assessmentItem, type MockScenario, type AssessmentEnvelope, type Submission } from '../../../game/sprint2/assessment';
import { DIALOGUE } from '../../../game/sprint2/dialogue';
import { StoryBook, EnergyLab, NoticeBoard } from './RpgInteractions';
import { TaskTracker, LocalMap, WorldAtlas, type TaskRow } from './MissionUI';
import { MobileJoystick } from './MobileJoystick';
import type { Guide } from '../../../game/sprint2/mission-guidance';
import { markerStatus, resolveGuide } from '../../../game/sprint2/mission-guidance';
import type { StoryPlan } from '../../../game/sprint2/story-c03/adapter';
import { initialStoryProgress, activeStoryObjective, completeStoryInteraction, openStoryDialogue, currentStoryDialogue, chooseStoryDialogue, closeStoryDialogue } from '../../../game/sprint2/story-c03/runtime';
import { useCallback, useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { Dialog, LocationBadge } from './overlays';
import { AdventureScene } from '../../../game/sprint2/scene';
import { ROOMS, type Target, type WorldId, type Point } from '../../../game/sprint2/world';
import { fixture, ENDINGS, type Episode, type Task } from '../../../game/sprint2/content';
import { PreviewSessionAdapter, initial, restore, emptyDraft, ready, type Intent, type State, type TaskDraft } from '../../../game/sprint2/state';
export type QuestGameProps = { mode: 'preview' | 'student'; presentation?: { title?: string; reducedMotion?: boolean }; sessionAdapter?: PreviewSessionAdapter; storyPlan?: StoryPlan; };
type Modal = 'prologue' | 'feedback' | 'dialogue' | 'journal' | 'map' | 'ending' | 'help' | 'task' | null;
const makeMockPort = () => new MockAssessmentPort({read:key=>localStorage.getItem(`jejaknalar:D-sprint2:preview-receipt:${key}`),write:(key,value)=>localStorage.setItem(`jejaknalar:D-sprint2:preview-receipt:${key}`,value)});
const keyFor = (ep: Episode, explorer: boolean) => `jejaknalar:D-sprint2:preview:${ep.id}:${explorer ? 'explorer' : 'story'}`;
/** In-world archive desk: academic data remains a demo fixture, actions remain generic and typed. */
function StaffInvestigation({task, draft, change, done, pending}: {task: Task; draft: TaskDraft; change:(d:TaskDraft)=>void; done:boolean; pending:boolean}) {
  const [openIndex,setOpenIndex]=useState<number|null>(null);
  const fileTitles=['Buku Kunjungan','Jadwal Kegiatan','Laporan Petugas'];
  const read=(i:number)=>{change({...draft,seen:[...new Set([...draft.seen,i])]});setOpenIndex(null);};
  return <section className="vn-staff-investigation" aria-label="Investigasi bersama petugas">
    <div className="vn-staff-speech"><span className="vn-staff-name">Pak Arif · Ruang Guru</span><p>“Ayo periksa catatan asli. Jangan langsung menyimpulkan hanya dari satu kabar.”</p></div>
    {openIndex === null ? <><h3>Meja Arsip Guru</h3><p>Pilih berkas, baca isinya, lalu kembalikan ke meja.</p>
      <div className="vn-evidence-desk">{task.sections.map((_,i)=><button key={i} className={'vn-evidence-card '+(draft.seen.includes(i)?'reviewed':'')} aria-pressed={draft.seen.includes(i)} disabled={done||pending} onClick={()=>setOpenIndex(i)}><span className="vn-paperclip">▤</span><b>{fileTitles[i]??`Catatan ${i+1}`}</b><small>{draft.seen.includes(i)?'✓ Sudah diperiksa':'Buka berkas →'}</small></button>)}</div>
      <div className="vn-staff-speech"><span className="vn-staff-name">Pak Arif</span><p>“Setelah melihat semua berkas, apa yang sebaiknya kita cocokkan dahulu?”</p></div>
      <div className="vn-dialogue-choices">{(task.options??[]).map((choice,i)=><button key={i} aria-pressed={draft.selection===i} disabled={done||pending||draft.seen.length!==task.sections.length} onClick={()=>change({...draft,selection:i})}>{draft.selection===i?'✓ ':''}{choice}</button>)}</div></>
    : <div className="vn-casefile"><span className="vn-casefile-clip" aria-hidden="true">▤</span><p className="vn-eyebrow">BERKAS {openIndex+1} / {task.sections.length}</p><h3>{fileTitles[openIndex]??`Catatan ${openIndex+1}`}</h3><p className="vn-casefile-body">{task.sections[openIndex]}</p><p>Periksa waktu dan konteksnya sebelum membuat kesimpulan.</p><button className="vn-primary" onClick={()=>read(openIndex)}>Tutup berkas & tandai diperiksa</button><button onClick={()=>setOpenIndex(null)}>Kembali tanpa mencatat</button></div>}
    <p className="vn-note">Berkas di sini merupakan contoh sintetis, bukan penilaian akademik resmi.</p>
  </section>;
}
function TaskView({ task, draft, complete, change, done, pending = false }: { task: Task; draft: TaskDraft; complete: () => void; change: (d: TaskDraft) => void; done: boolean; pending?: boolean }) {
  const selectSource = (i: number) => change({ ...draft, seen: [...new Set([...draft.seen, i])] });
  return <><p>{task.task_id === 'investigate' ? 'Temui Pak Arif, telaah arsip, lalu tentukan dokumen yang perlu dicocokkan.' : task.prompt}</p><p className="vn-note">SUMBER CONTOH LOKAL · bukan modul guru atau nilai resmi</p>
    {task.task_id === 'investigate' && <StaffInvestigation task={task} draft={draft} change={change} done={done} pending={pending} />}
    {task.kind === 'observe' && <StoryBook key={task.task_id} task={task} draft={draft} change={change} finish={complete} done={done} />}
    {task.kind === 'operate' && <EnergyLab draft={draft} change={change} done={done} />}
    {task.kind === 'decide' && <NoticeBoard task={task} />}
    {task.kind === 'investigate' && task.task_id !== 'investigate' && <div className="vn-sources">{task.sections.map((section,i)=><button key={i} onClick={()=>selectSource(i)} disabled={done||pending} aria-pressed={draft.seen.includes(i)}>{draft.seen.includes(i)?'✓ ':''}Buka catatan {i+1}: {section}</button>)}</div>}
    {task.options && task.task_id !== 'investigate' && <fieldset disabled={done || pending}><legend>Pilih tanggapan</legend>{task.options.map((option, i) => <label className="vn-option" key={i}><input type="radio" name={task.task_id} checked={draft.selection === i} onChange={() => change({ ...draft, selection: i })} />{option}</label>)}</fieldset>}
    <details><summary>Sumber dan konteks</summary>{task.source_refs.map((r, i) => <p key={i}>{r.excerpt} — Dokumen contoh, {r.locator.kind === 'pdf_page' ? `halaman ${r.locator.page}` : `paragraf ${r.locator.paragraph_index}`}</p>)}</details>
    {task.kind !== 'observe' && <button className="vn-primary" disabled={done || pending || !ready(task, draft)} onClick={complete}>{pending ? 'Mengirim…' : done ? 'Tercatat di jurnal' : task.kind === 'decide' ? 'Submit jawaban · SIMULASI' : task.task_id === 'investigate' ? 'Catat hasil investigasi' : 'Selesaikan aktivitas'}</button>}{!done && !pending && <button onClick={() => change(emptyDraft())}>Ulangi interaksi</button>}<p className="vn-note">{done?'✓ Bukti telah disimpan di Jurnal.':'Bisa ditutup dan dilanjutkan; progres tetap tersimpan di sesi ini.'}</p></>;
}
export function QuestGame(props: QuestGameProps) {
  if (props.mode === 'student') return <main className="vn-gate"><h1>Mode siswa belum tersedia di D-07</h1><p>BACKEND_NOT_READY</p><p>Student Runtime dan C04 berada di fitur integrasi berikutnya, bukan di branch Mobile UI.</p><a href="sprint2.preview.html">Buka preview lokal</a></main>;
  if (['c04','pic-c'].includes(new URLSearchParams(location.search).get('episode') ?? new URLSearchParams(location.search).get('fixture') ?? '')) return <main className="vn-gate"><h1>Preview C04 belum terpasang di D-07</h1><p>C04 merupakan fitur terpisah. Jangan menampilkan fixture lain sebagai pengganti.</p><a href="sprint2.preview.html">Buka preview lokal</a></main>;
  return <PreviewGame presentation={props.presentation} sessionAdapter={props.sessionAdapter} storyPlan={props.storyPlan} />;
}
function PreviewGame({ presentation, sessionAdapter, storyPlan }: Pick<QuestGameProps, 'presentation' | 'sessionAdapter' | 'storyPlan'>) {
  const [running, setRunning] = useState(false), [debug, setDebug] = useState(false), [scenario, setScenario] = useState<MockScenario>('automatic'), [sending, setSending] = useState(false), [submitError, setSubmitError] = useState(''), [feedback, setFeedback] = useState<AssessmentEnvelope | null>(null), [navigationHint,setNavigationHint] = useState<{x:number;y:number;glyph:string;label:string}|null>(null);
  const [mentorMet,setMentorMet] = useState(false);
  const mentorRef=useRef(mentorMet);mentorRef.current=mentorMet;
  const [storyProgress, setStoryProgress] = useState(initialStoryProgress);
  const storyProgressRef = useRef(storyProgress); storyProgressRef.current = storyProgress;
  const updateStory = (next: typeof storyProgress) => { storyProgressRef.current = next; setStoryProgress(next); };
  const busyRef = useRef(false); busyRef.current = sending;
  const runningRef = useRef(false), debugRef = useRef(false), assessmentPort = useRef(makeMockPort()), submission = useRef(new AssessmentController(assessmentPort.current));
  runningRef.current = running; debugRef.current = debug;
  const [choice, setChoice] = useState<WorldId>(sessionAdapter?.episode.world ?? 'school'), [explorer, setExplorer] = useState(sessionAdapter?.explorer ?? false), [ep, setEp] = useState<Episode | null>(sessionAdapter?.episode ?? null);
  const [state, setState] = useState<State | null>(sessionAdapter?.snapshot() ?? null), [modal, setModal] = useState<Modal>(null), [target, setTarget] = useState<Target | null>(null), [nearby, setNearby] = useState<Target | null>(null), [message, setMessage] = useState(''), [reduced, setReduced] = useState(presentation?.reducedMotion ?? matchMedia('(prefers-reduced-motion: reduce)').matches);
  const port = useRef<PreviewSessionAdapter | null>(sessionAdapter ?? null), stateRef = useRef<State | null>(sessionAdapter?.snapshot() ?? null), modalRef = useRef<Modal>(null), joy = useRef<Point>({ x: 0, y: 0 }), scene = useRef<AdventureScene | null>(null), host = useRef<HTMLDivElement>(null), reducedRef = useRef(reduced), counter = useRef(0);
  modalRef.current = modal; reducedRef.current = reduced;
  const commit = useCallback((intent: Intent) => { const p = port.current; if (!p) return false; try { const next = p.command(`preview-${++counter.current}`, p.snapshot().revision, intent); stateRef.current = next; setState(next); return true; } catch (err) { setMessage(err instanceof Error ? err.message : 'Aksi ditolak.'); return false; } }, []);
  const interact = useCallback((t: Target) => { setTarget(t); setSubmitError(''); if (t.kind === 'map') setModal('map'); else if (t.kind === 'inspect') { setMessage(t.description || 'Bisa kamu lihat-lihat. Bukan tugas saat ini.'); if (storyPlan && t.objectId && stateRef.current) updateStory(completeStoryInteraction(storyPlan, storyProgressRef.current, stateRef.current.room, t.objectId)); } else if (t.kind === 'door') { if (t.to==='city_park' && stateRef.current?.statuses.decide!=='completed') setMessage('Taman Kota terbuka setelah kamu selesai memeriksa bukti dan memperbaiki pengumuman di Aula Diskusi.'); else commit({ type: 'door', targetId: t.id }); } else if (t.kind === 'npc') { if(commit({type:'npc_open',npcId:t.id})) { if(storyPlan && stateRef.current) updateStory(openStoryDialogue(storyPlan, storyProgressRef.current, t.id, stateRef.current.room)); setModal('dialogue'); } } else if (t.task && commit({ type: 'start', task: t.task })) setModal('task'); }, [commit, storyPlan]);
  function start(resume: boolean) {
    updateStory(initialStoryProgress());
    const episode = fixture(choice); assessmentPort.current = makeMockPort(); submission.current = new AssessmentController(assessmentPort.current); setFeedback(null); setSubmitError(''); let current = initial(episode); let didRestore = false;
    if (resume) try { const raw = localStorage.getItem(keyFor(episode, explorer)); if (raw) { const result = restore(episode, raw); current = result.state; didRestore = true; setMessage(result.warning ?? 'Checkpoint lokal dipulihkan.'); } else setMessage('Belum ada checkpoint; mulai episode baru.'); } catch { setMessage('Penyimpanan browser tidak tersedia; sesi berjalan di memori.'); }
    let met=false;if(resume)try{met=localStorage.getItem(keyFor(episode,explorer)+':mentor')==='yes';}catch{/* Optional local narrative progress. */}
    setMentorMet(!!(met||didRestore&&(current.visited.length>1||current.statuses.observe==='completed')));
    port.current = new PreviewSessionAdapter(episode, current, explorer); stateRef.current = current; setState(current); setEp(episode); setModal(didRestore ? null : 'prologue');
  }
  useEffect(() => {
    if (!ep || !host.current) return;
    const s = new AdventureScene({
      guidance: () => {
        const snap=stateRef.current; if(!snap||snap.ending) return null;
        if(storyPlan){const o=activeStoryObjective(storyPlan,storyProgressRef.current); if(!o)return null;
          const task=storyPlan.tasks.find(t=>o.activityIds.includes(t.activity_id)&&!storyProgressRef.current.completedActivityIds.includes(t.activity_id));
          const locked=!storyProgressRef.current.unlockedMissionIds.includes(o.id);
          const npc=locked ? storyPlan.dialogues.find(d=>d.room_id===o.room) : null;
          const focus=ROOMS[o.room]?.targets.find(t=>npc?t.id===npc.npc_id:t.objectId===task?.object_id);
          return resolveGuide({world:ep.world,room:snap.room,position:snap.position,objectiveRoom:o.room,objectiveTargetId:focus?.id,statuses:snap.statuses,explorer});
        }
        if(!mentorRef.current){const start=ep.world==='school'?'school.courtyard':'city_hub';const teacher=ROOMS[start]?.targets.find(t=>t.kind==='npc');return resolveGuide({world:ep.world,room:snap.room,position:snap.position,objectiveRoom:start,objectiveTargetId:teacher?.id,statuses:snap.statuses,explorer});}
        const order=['observe','operate','investigate','decide',...(snap.decision.path==='needs_support'?['support']:[]),'transfer'];
        const id=order.find(t=>snap.statuses[t]!=='completed');
        const room=id?Object.values(ROOMS).find(r=>r.world===ep.world&&r.targets.some(t=>t.task===id)):null;
        const focus=room?.targets.find(t=>t.task===id);
        return resolveGuide({world:ep.world,room:snap.room,position:snap.position,objectiveRoom:room?.id??null,objectiveTargetId:focus?.id,statuses:snap.statuses,explorer});
      },
      markerStatus: (t) => {
        const snap=stateRef.current;if(!snap)return 'explore';
        if(storyPlan){const o=activeStoryObjective(storyPlan,storyProgressRef.current);
          const task=storyPlan.tasks.find(a=>o?.activityIds.includes(a.activity_id)&&!storyProgressRef.current.completedActivityIds.includes(a.activity_id));
          if(t.objectId && storyProgressRef.current.completedActivityIds.some(id=>storyPlan.tasks.some(a=>a.activity_id===id&&a.object_id===t.objectId)))return 'completed';
          if(o && t.objectId===task?.object_id)return storyProgressRef.current.unlockedMissionIds.includes(o.id)?'active':'locked';
          if(o&&!storyProgressRef.current.unlockedMissionIds.includes(o.id)&&storyPlan.dialogues.some(d=>d.npc_id===t.id&&d.room_id===o.room))return 'active';
          return 'explore';
        }
        if(!mentorRef.current){const start=ep.world==='school'?'school.courtyard':'city_hub';const teacher=ROOMS[start]?.targets.find(t=>t.kind==='npc');return teacher&&t.id===teacher.id?'active':t.task?'locked':'explore';}
        const order=['observe','operate','investigate','decide',...(snap.decision.path==='needs_support'?['support']:[]),'transfer'];
        return markerStatus(t,order.find(id=>snap.statuses[id]!=='completed')??null,snap.statuses);
      },
      directionHint: setNavigationHint,
      snapshot: () => stateRef.current!, active: () => modalRef.current === null, direction: () => joy.current, position: (position, heading) => { commit({ type: 'position', position, heading }); }, interact, nearby: setNearby, message: setMessage, reduced: () => reducedRef.current, running: () => runningRef.current, debug: () => debugRef.current }); scene.current = s;
    // Canvas renderer avoids WebGL context loss/black frames on DevTools 390×844 resizing.
    // Never resize to 0×0 while CSS viewport transitions are in progress.
    const game = new Phaser.Game({ type: Phaser.CANVAS, parent: host.current, backgroundColor: '#152e35', pixelArt: true, roundPixels: true, scale: { mode: Phaser.Scale.RESIZE, width: Math.max(320, host.current.clientWidth), height: Math.max(300, host.current.clientHeight), autoCenter: Phaser.Scale.CENTER_BOTH }, scene: s, input: { activePointers: 3 } });
    // Opt-in read-only diagnostics for automated preview QA; no state mutation API.
    const qaHost = window as unknown as { __PIC_D_QA?: () => unknown };
    if (new URLSearchParams(location.search).get('qa') === '1') qaHost.__PIC_D_QA = () => { const camera = s.cameras?.main; return { state: structuredClone(stateRef.current), pose:s.readPose(), camera: camera ? { scrollX: camera.scrollX, scrollY: camera.scrollY, zoom: camera.zoom, width: camera.width, height: camera.height, worldX:camera.worldView.x, worldY:camera.worldView.y } : null }; };
    let resizeRaf = 0;
    const resizeGame = () => { cancelAnimationFrame(resizeRaf); resizeRaf = requestAnimationFrame(() => {
      const el = host.current; if (!el || !game.isBooted) return;
      const w = Math.floor(el.getBoundingClientRect().width), h = Math.floor(el.getBoundingClientRect().height);
      if (w < 150 || h < 150) return; // ignore transient collapsed DevTools frames
      if (Math.abs(game.scale.width-w)>1 || Math.abs(game.scale.height-h)>1) game.scale.resize(w,h);
      game.scale.refresh(); s.reframe();
    }); };
    const resize = new ResizeObserver(resizeGame); resize.observe(host.current);
    window.addEventListener('orientationchange', resizeGame);
    document.addEventListener('visibilitychange', resizeGame);
    const blur = () => { joy.current = { x: 0, y: 0 }; }; window.addEventListener('blur', blur);
    return () => { resize.disconnect(); cancelAnimationFrame(resizeRaf); window.removeEventListener('orientationchange', resizeGame); document.removeEventListener('visibilitychange', resizeGame); delete qaHost.__PIC_D_QA; window.removeEventListener('blur', blur); game.destroy(true); scene.current = null; };
  }, [ep, commit, interact]);
  useEffect(()=>{if(!ep)return;try{localStorage.setItem(keyFor(ep,explorer)+':mentor',mentorMet?'yes':'no');}catch{/* Gameplay still works without storage. */}},[ep,explorer,mentorMet]);
  useEffect(() => { if (!ep || !state) return; const timer = window.setTimeout(() => { try { localStorage.setItem(keyFor(ep, explorer), JSON.stringify(state)); } catch { setMessage('Checkpoint gagal disimpan. Browser mungkin membatasi penyimpanan.'); } }, 600); return () => clearTimeout(timer); }, [ep, state, explorer]);
  useEffect(() => { const save = () => { if (ep && stateRef.current) try { localStorage.setItem(keyFor(ep, explorer), JSON.stringify(stateRef.current)); } catch { /* In-memory session remains available. */ } }; const interval = window.setInterval(save, 2500); window.addEventListener('pagehide', save); return () => { clearInterval(interval); window.removeEventListener('pagehide', save); }; }, [ep, explorer]);
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (!ep || (e.target instanceof HTMLElement && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName))) return; if (busyRef.current) return; if (e.key === 'Escape') { setModal(null); joy.current = { x: 0, y: 0 }; } if (e.key.toLowerCase() === 'm' && (!modalRef.current || modalRef.current === 'map')) setModal(m => m === 'map' ? null : 'map'); if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !modalRef.current && e.target === document.body) e.preventDefault(); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [ep]);
  useEffect(() => { if (!message) return; const timer = setTimeout(() => setMessage(''), 6000); return () => clearTimeout(timer); }, [message]);
  if (!ep || !state) return <main className="vn-start"><div className="vn-start-art" aria-hidden="true">✦</div><p className="vn-eyebrow">JEJAKNALAR / PIC D SPRINT 2</p><h1>{presentation?.title?.slice(0, 80) || 'Setiap jejak\npunya cerita.'}</h1><p>Jelajahi dunia. Temui warga. Periksa bukti sebelum mengambil keputusan.</p><div className="vn-worlds"><button aria-pressed={choice === 'school'} onClick={() => setChoice('school')}><b>01 · Sekolah</b><span>Misteri Lampu Sekolah</span></button><button aria-pressed={choice === 'city'} onClick={() => setChoice('city')}><b>02 · Kota</b><span>Jejak Lampu Pasar</span></button></div><label className="vn-check"><input type="checkbox" checked={explorer} onChange={e => setExplorer(e.target.checked)} />QA explorer — semua pintu terbuka (checkpoint terpisah)</label><div className="vn-actions"><button className="vn-primary" onClick={() => start(false)}>Mulai episode baru</button><button onClick={() => start(true)}>Lanjutkan checkpoint</button></div><p className="vn-note">PREVIEW LOKAL · konten contoh · BedaJalur simulasi · tidak menyimpan nilai siswa</p><p className="vn-note"><a className="vn-link-button" href="sprint2.preview.html?fixture=pic-c">QA: Uji C04 dua sumber</a></p></main>;
  const room = ROOMS[state.room], task = target?.task ? ep.tasks[target.task] : null;
  const main = ['observe', 'operate', 'investigate', 'decide', ...(state.decision.path === 'needs_support' ? ['support'] : []), 'transfer'];
  const nextTask = main.find(id => state.statuses[id] !== 'completed');
  const nextRoom = nextTask ? Object.values(ROOMS).find(r => r.world === ep.world && r.targets.some(t => t.task === nextTask)) : null;
  const storyObjective = storyPlan ? activeStoryObjective(storyPlan, storyProgress) : null;
  const close = () => { if (storyPlan) updateStory(closeStoryDialogue(storyProgressRef.current)); if (sending) { setMessage('Tunggu respons submit sebelum melanjutkan.'); return; } setModal(null); joy.current = { x: 0, y: 0 }; if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); };
  const pendingKey = `${keyFor(ep, explorer)}:pending-submit`;
  const sendAssessment = async (retry: boolean) => {
    if (!task || (task.task_id !== 'decide' && task.task_id !== 'transfer') || sending) return;
    const id=task.task_id, item=assessmentItem(id), selection=state.drafts[id]?.selection;
    if(selection===null||selection===undefined)return;
    if(id==='transfer'&&state.decision.path==='needs_support'&&state.statuses.support!=='completed'){setSubmitError('Selesaikan pendampingan di Lab Pengetahuan terlebih dahulu.');return;}
    const controller=submission.current;
    try {
      if(!retry){let restored=false;let raw:string|null=null;try{raw=localStorage.getItem(pendingKey);}catch{/* Optional browser storage. */}if(raw){try{const saved=JSON.parse(raw) as {task:string;request:Submission};if(saved.task===id&&saved.request.answers[0]?.value===item.options[selection].id){controller.restorePending(id,saved.request);restored=true;}}catch{localStorage.removeItem(pendingKey);}}if(!restored)controller.prepare(id,item.options[selection].id);}
      // Preserve exact payload before transport; reload/retry must never create another key.
      try { localStorage.setItem(pendingKey,JSON.stringify({task:id,request:controller.state.request})); } catch { setMessage('Pending submit hanya tersimpan dalam memori.'); }
      assessmentPort.current.scenario=scenario;assessmentPort.current.evidenceCount=['observe','operate','investigate'].filter(k=>state.statuses[k]==='completed').length;
      setSending(true);setSubmitError('');await new Promise(resolve=>setTimeout(resolve,350));
      const result=await controller.send();
      if(result){const accepted=commit({type:'complete',task:id,assessment:{request:controller.state.request!,response:result}});if(accepted){setFeedback(result);setModal('feedback');try{localStorage.removeItem(pendingKey);}catch{/* Memory remains valid. */}}}
      else setSubmitError(controller.state.error??'Submit gagal.');
    } catch(e){setSubmitError(e instanceof Error?e.message:'Submit gagal.');}finally{setSending(false);}
  };
  const complete = () => {
    if(!task)return;
    if(task.task_id==='decide'||task.task_id==='transfer'){void sendAssessment(false);return;}
    if(commit({type:'complete',task:task.task_id})){ if (storyPlan && target?.objectId) updateStory(completeStoryInteraction(storyPlan, storyProgressRef.current, state.room, target.objectId)); setMessage('✓ Bukti tercatat! Petunjuk berikutnya tersedia di daftar misi.');setModal(null);}
  };
  const progress = ['observe', 'operate', 'investigate', 'decide', 'transfer'].filter(id => state.statuses[id] === 'completed').length;
  const guide:Guide|null=(()=>{
    if(state.ending||(storyPlan?!storyObjective:!nextTask))return null;
    if(!storyPlan&&!mentorMet){const start=ep.world==='school'?'school.courtyard':'city_hub';const teacher=ROOMS[start]?.targets.find(t=>t.kind==='npc');return resolveGuide({world:ep.world,room:state.room,position:state.position,objectiveRoom:start,objectiveTargetId:teacher?.id,statuses:state.statuses,explorer});}
    if(storyPlan&&storyObjective){
      const t=storyPlan.tasks.find(a=>storyObjective.activityIds.includes(a.activity_id)&&!storyProgress.completedActivityIds.includes(a.activity_id));
      const locked=!storyProgress.unlockedMissionIds.includes(storyObjective.id);
      const npc=locked?storyPlan.dialogues.find(d=>d.room_id===storyObjective.room):null;
      const focus=ROOMS[storyObjective.room]?.targets.find(x=>npc?x.id===npc.npc_id:x.objectId===t?.object_id);
      return resolveGuide({world:ep.world,room:state.room,position:state.position,objectiveRoom:storyObjective.room,objectiveTargetId:focus?.id,statuses:state.statuses,explorer});
    }
    const focus=nextRoom?.targets.find(t=>t.task===nextTask);
    return resolveGuide({world:ep.world,room:state.room,position:state.position,objectiveRoom:nextRoom?.id??null,objectiveTargetId:focus?.id,statuses:state.statuses,explorer});
  })();
  const taskRows:TaskRow[]=storyPlan ? (storyPlan.objectives.map(o=>({id:o.id,label:o.label,place:ROOMS[o.room]?.title,status:o.activityIds.every(id=>storyProgress.completedActivityIds.includes(id))?'completed':o.id===storyObjective?.id?'active':'locked'} as TaskRow))) :
   [{id:'mentor',label:ep.world==='school'?'Temui Bu Rani':'Temui pengurus kota',place:ROOMS[ep.world==='school'?'school.courtyard':'city_hub'].title,status:mentorMet?'completed':'active'} as TaskRow,...main.map(id=>({id,label:({observe:'Baca buku pengamatan',operate:'Uji lampu di laboratorium',investigate:'Periksa arsip petugas',decide:'Perbaiki pengumuman',support:'Ikuti latihan penguatan',transfer:'Selidiki kasus lanjutan'} as Record<string,string>)[id]??ep.tasks[id].title,place:Object.values(ROOMS).find(r=>r.world===ep.world&&r.targets.some(t=>t.task===id))?.title,status:state.statuses[id]==='completed'?'completed':!mentorMet?'locked':id===nextTask?'active':'locked'} as TaskRow))];
  return <main className={'vn-game ' + (reduced ? 'vn-reduced' : '')}>
    <div className="vn-canvas" ref={host} aria-label="Dunia petualangan. Bergerak WASD atau panah, E berinteraksi, M membuka peta." role="application" />
    {!modal && <div className="vn-hud"><div className="vn-identity"><span className="vn-avatar">J</span><div><strong>JejakNalar</strong><small>{explorer?'QA EXPLORER':'PREVIEW'} · SIMULASI</small></div></div>
      <TaskTracker rows={taskRows} completed={storyPlan?!storyObjective:!!state.ending||!nextTask} open={()=>setModal(state.ending?'ending':'journal')}/>
      <button className="vn-minimap" onClick={()=>setModal('map')} aria-label="Buka peta"><LocalMap room={room} position={state.position} heading={state.heading} guide={guide} statuses={state.statuses} compact/><span>⊞ PETA BESAR · M</span><small>{room.title}</small></button>
      {navigationHint&&<div className="vn-direction-hint" style={{left:navigationHint.x,top:navigationHint.y}} aria-label={`${navigationHint.label}: ${navigationHint.glyph}`}><b>{navigationHint.glyph}</b></div>}
      <LocationBadge room={room} />{nearby&&<div className="vn-nearby-object">{nearby.label}<span>{nearby.kind==='door'?(nearby.to==='city_park'&&state.statuses.decide!=='completed'?'Selesaikan misi pengumuman sebelum memasuki taman':'Tekan E untuk masuk'):nearby.task&&state.statuses[nearby.task]==='completed'?'✓ Sudah tercatat':nearby.kind==='inspect'?'Objek tambahan · tekan E':'Tekan E untuk berinteraksi'}</span></div>}<div className="vn-tools"><button onClick={() => setModal('journal')}>Jurnal · {state.evidence.length}</button><button aria-label="Bantuan" onClick={() => setModal('help')}>?</button></div>{state.heldItem && <div className="vn-item">▣ {state.heldItem}</div>}
      <button className="vn-run" aria-pressed={running} onClick={() => setRunning(v => !v)}>{running ? 'LARI · ON' : 'LARI · Shift'}</button><div className="vn-touch"><div className="vn-dpad">{([{ text: '↑', x: 0, y: -1, cls: 'up' }, { text: '←', x: -1, y: 0, cls: 'left' }, { text: '↓', x: 0, y: 1, cls: 'down' }, { text: '→', x: 1, y: 0, cls: 'right' }]).map(d => <button key={d.text} className={d.cls} aria-label={`Gerak ${d.text}`} onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); joy.current = { x: d.x, y: d.y }; }} onPointerUp={() => { joy.current = { x: 0, y: 0 }; }} onPointerCancel={() => { joy.current = { x: 0, y: 0 }; }} onLostPointerCapture={() => { joy.current = { x: 0, y: 0 }; }}>{d.text}</button>)}</div><MobileJoystick onMove={axis => { joy.current = axis; }}/><button className="vn-interact" disabled={!nearby} onClick={() => scene.current?.interactNearest()}>E · {nearby ? 'Interaksi' : 'Dekati objek'}</button></div>
    </div>}
    {message && !modal && <div className="vn-toast" role="status">{message}</div>}
    {modal && <Dialog dialogue={modal === 'dialogue'} title={modal === 'task' ? task?.title ?? 'Task tidak didukung' : ({ prologue: `Prolog · ${ep.title}`, feedback: 'Feedback · SIMULASI', dialogue: target?.label ?? 'Percakapan', journal: 'Jurnal perjalanan', map: 'Peta lingkungan', ending: 'Epilog', help: 'Panduan petualangan' } as const)[modal]} close={close}>
      {message && <p className="vn-inline-notice" role="status">{message}</p>}
      {modal === 'prologue' && <div className="vn-prologue"><p className="vn-eyebrow">EPISODE · PREVIEW LOKAL</p><h3>{storyPlan?.title ?? ep.title}</h3>{storyPlan && <p>{storyPlan.prologue}</p>}<p>{!storyPlan && (ep.intro?.context ?? 'Pengantar episode belum tersedia; diperlukan konten naratif terverifikasi dari PIC C.')}</p><p><strong>Peranmu:</strong> {ep.intro?.role ?? 'Penjelajah yang memeriksa bukti dengan cermat.'}</p><p><strong>Mengapa diselidiki:</strong> {ep.intro?.reason ?? 'Bukti perlu diperiksa sebelum menarik kesimpulan.'}</p><div className="vn-prologue-next"><b>Langkah pertama</b><p>{ep.intro?.first_step ?? 'Temui pembimbing di area awal.'}</p></div><button className="vn-primary" onClick={close}>Mulai menjelajah</button><p className="vn-note">Pengantar ini dapat dibuka kembali lewat Jurnal. Narasi hanya fixture demo; konten dari modul guru harus melalui validasi PIC C.</p></div>}
      {modal === 'task' && (task ? <TaskView task={task} draft={state.drafts[task.task_id] ?? emptyDraft()} change={draft => {if(!sending)commit({ type: 'draft', task: task.task_id, draft });}} complete={complete} done={state.statuses[task.task_id] === 'completed'} pending={sending || !!submitError} /> : <p role="alert">TASK_UNSUPPORTED — konten perlu diperiksa.</p>)}
      {modal === 'task' && submitError && <div className="vn-submit-error" role="alert"><p>{submitError}</p><button disabled={sending} onClick={() => void sendAssessment(true)}>Coba kirim ulang (kunci sama)</button><button disabled={sending} onClick={() => { try{localStorage.removeItem(pendingKey);}catch{/* No storage. */} submission.current=new AssessmentController(assessmentPort.current);setSubmitError(''); }}>Attempt belajar baru</button><p className="vn-note">Untuk uji gangguan: tutup task, buka Bantuan, ubah skenario lalu kembali. Retry mempertahankan jawaban sebelumnya.</p></div>}
      {modal === 'feedback' && feedback && <><p className="vn-eyebrow">SIMULASI LOKAL · BUKAN HASIL AKADEMIK</p>{feedback.data.feedback.map(f=><p key={f.item_id}>{f.message}</p>)}<h3>{feedback.data.next_path==='need_more_evidence'?'Bukti belum cukup':feedback.data.next_path==='needs_support'?'BedaJalur: Penguatan':feedback.data.next_path==='developing'?'BedaJalur: Berkembang':'BedaJalur: Pengembangan'}</h3><p>{feedback.data.next_path==='need_more_evidence'?'Tinjau buku, dokumen dan simulasi. Kembali untuk attempt baru; ini bukan jalur keempat.':feedback.data.next_path==='needs_support'?'Kunjungi Lab Pengetahuan untuk pendampingan, lalu kerjakan kasus baru di Aula.':'Kerjakan kasus berbeda pada meja bukti di Aula. Tujuan belajarnya tetap sama.'}</p><button className="vn-primary" onClick={()=>{setModal(state.ending?'ending':null);}}>Lanjutkan perjalanan</button></>}
      {modal === 'dialogue' && storyPlan && currentStoryDialogue(storyPlan, storyProgress) && <><p className="vn-role">{target?.label}</p><p>{currentStoryDialogue(storyPlan, storyProgress)?.node.text}</p><div className="vn-sources">{currentStoryDialogue(storyPlan, storyProgress)?.node.choices.map(c => <button key={c.choice_id} onClick={() => { const next = chooseStoryDialogue(storyPlan, storyProgressRef.current, c.choice_id); updateStory(next); if (!next.activeDialogue) setModal(null); }}>{c.label}</button>)}{currentStoryDialogue(storyPlan,storyProgress)?.node.choices.length===0&&<button className="vn-primary" onClick={close}>✓ Selesai berbicara</button>}</div><p className="vn-note">DIALOG PIC C · PREVIEW, tidak dinilai akademik.</p></>}
      {modal === 'dialogue' && (!storyPlan || !currentStoryDialogue(storyPlan, storyProgress)) && <><p className="vn-role">{target?.role}</p><p>{state.dialogue==='start' ? target?.message || DIALOGUE.start.text : DIALOGUE[state.dialogue].text}</p><div className="vn-sources">{(DIALOGUE[state.dialogue]??DIALOGUE.start).choices.filter(c => !c.requires || state.heldItem).map(c => <button key={c.id} onClick={() => commit({ type: 'dialogue', choice: c.id })}>{c.label}</button>)}{(DIALOGUE[state.dialogue]??DIALOGUE.start).terminal && <button className="vn-primary" onClick={()=>{mentorRef.current=true;setMentorMet(true);close();}}>✓ Selesai berbicara · Lanjut misi</button>}</div><p className="vn-note">Petunjuk percakapan, bukan skor akademik.</p></>}
      {modal === 'map' && <WorldAtlas world={ep.world} room={room} position={state.position} heading={state.heading} visited={state.visited} guide={guide} statuses={state.statuses} close={close} openJournal={()=>setModal('journal')}/>}
      {modal === 'journal' && <><button className="vn-primary" onClick={()=>setModal('prologue')}>Baca ulang prolog episode</button><p><b>Progres cerita: {progress}/5.</b> Pembimbing: {mentorMet?'✓ Sudah ditemui':'Belum ditemui'}.  Penguasaan akademik: belum dinilai backend.</p><p>BedaJalur SIMULASI: {state.decision.path ?? 'Bukti belum cukup (need_more_evidence)'}</p><ol>{Object.values(ep.tasks).map(t => <li key={t.task_id}><b>{t.title}</b> — {state.statuses[t.task_id]}{state.evidence.includes(t.evidence_id) && <p>{t.sections.join(' ')} <small>(Dokumen contoh lokal)</small></p>}</li>)}</ol>{state.statuses.side !== 'completed' && target?.task === 'side' && <button onClick={() => commit({ type: 'skip', task: 'side' })}>Lewati titipan opsional</button>}<p>Titipan: {state.delivered ? 'Sudah diserahkan' : state.heldItem ?? 'Tidak membawa item'}</p>{state.feedback.decide && <button onClick={()=>{setFeedback(state.feedback.decide!.response);setModal('feedback');}}>Baca feedback submit</button>}{state.ending && <button onClick={() => setModal('ending')}>Baca epilog</button>}</>}
      {modal === 'ending' && <><p className="vn-eyebrow">AKHIR CERITA · SIMULASI</p><h3>{state.ending ? ENDINGS[state.ending] : 'Selesaikan kasus lanjutan terlebih dahulu.'}</h3><p>Ending mencerminkan jalur naratif lokal. Tidak ada perubahan nilai akademik atau laporan siswa.</p><button onClick={close}>Lanjut menjelajah</button></>}
      {modal === 'help' && <><p>WASD/panah: bergerak. Klik lantai: berjalan. Klik NPC/objek: mendekat lalu berinteraksi. E: interaksi terdekat. M: peta. Esc: tutup overlay.</p><p>Shift + WASD/panah untuk berlari. Tombol LARI adalah toggle di ponsel. Pintu hanya berpindah saat E ditekan tepat di ambang.</p><p>Ponsel: gerakkan joystick analog kiri bawah dan gunakan tombol interaksi kanan. Gerak berhenti saat dialog/task terbuka. Pintu Aula terbuka setelah Periksa sumber di Ruang Guru; QA explorer membuka semua pintu.</p><label className="vn-check"><input type="checkbox" checked={debug} onChange={e=>setDebug(e.target.checked)} />Debug collider: merah solid, hijau opening, kuning trigger, biru approach, putih kaki</label><label className="vn-scenario">Skenario QA assessment (SIMULASI)<select aria-label="Skenario QA assessment" value={scenario} onChange={e=>setScenario(e.target.value as MockScenario)}>{['automatic','needs_support','developing','ready_for_extension','need_more_evidence','offline','400','401','403','409','429','500','lost_response'].map(v=><option key={v} value={v}>{v}</option>)}</select></label><label className="vn-check"><input type="checkbox" checked={reduced} onChange={e => setReduced(e.target.checked)} />Kurangi animasi</label><p>Checkpoint tersimpan khusus preview di browser ini. Mulai episode baru akan menggantikan checkpoint dunia/mode yang dipilih.</p><button onClick={() => { setEp(null); setState(null); setModal(null); port.current = null; }}>Kembali ke pemilihan dunia</button></>}
    </Dialog>}
  </main>;
}
