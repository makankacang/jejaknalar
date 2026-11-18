import { useState } from 'react';
import {recordPage, readingComplete} from '../../../game/sprint2/readable-evidence';
import type { Task } from '../../../game/sprint2/content';
import type { TaskDraft } from '../../../game/sprint2/state';

/** Presentation only. Evidence and progress are persisted by the existing PIC D reducer. */
export function StoryBook({task,draft,change,finish,done}: {
 task:Task; draft:TaskDraft; change:(draft:TaskDraft)=>void; finish:()=>void; done:boolean;
}) {
 const [page,setPage]=useState<number|null>(null);
 const titles=['Catatan awal','Jejak waktu','Apa yang belum pasti?'];
 const visited=draft.seen;
 function turn(index:number) {
  const n=Math.max(0,Math.min(task.sections.length-1,index));
  setPage(n);
  if(!visited.includes(n))change({...draft,seen:recordPage(visited,n,task.sections.length)});
 }
 function closeBook() {
  setPage(null);
  if(readingComplete(task.sections.length,visited)&&!done)finish();
 }
 return <section className="vn-book-interaction" aria-label="Membaca buku bukti">
  {page===null ? <div className="vn-book-cover">
   <span className="vn-book-seal" aria-hidden="true">✦</span><p className="vn-book-overline">ARSIP PERPUSTAKAAN · DOKUMEN CONTOH</p>
   <h3>{task.title}</h3><p>“Setiap halaman punya jejak. Baca sampai akhir, baru simpulkan.”</p>
   <p className="vn-book-progress">{visited.length} dari {task.sections.length} halaman telah dibaca</p>
   <button className="vn-primary" onClick={()=>turn(0)} disabled={done}>{done?'✓ Buku telah dicatat':'Buka buku'}</button>
   {done&&<p className="vn-book-done">✓ Isi buku tersimpan di Jurnal Perjalanan.</p>}
  </div> : <div className="vn-book-open" aria-live="polite">
   <div className="vn-book-left"><span className="vn-page-kicker">JEJAK NALAR · ARSIP</span><div className="vn-book-art" aria-hidden="true"><span>✉</span><span>✦</span><span>▥</span></div><h3>{titles[page]??`Halaman ${page+1}`}</h3><p>Temukan fakta sebelum menarik kesimpulan.</p><span className="vn-page-num">{page+1}</span></div>
   <div className="vn-book-right"><span className="vn-page-kicker">CATATAN PENGAMATAN</span><p className="vn-book-text">{task.sections[page]}</p><p className="vn-book-question">Apa yang bisa kamu pastikan dari catatan ini?</p><div className="vn-page-nav">
    <button onClick={()=>turn(page-1)} disabled={page===0}>← Sebelumnya</button>
    <span>Halaman {page+1}/{task.sections.length}</span>
    <button onClick={()=>turn(page+1)} disabled={page===task.sections.length-1}>Berikutnya →</button>
   </div><button className="vn-book-close" onClick={closeBook}>{readingComplete(task.sections.length,visited)?'Tutup buku & catat di jurnal':'Tutup buku (lanjutkan nanti)'}</button></div>
  </div>}
  {page===null&&!done&&visited.length>0&&visited.length<task.sections.length&&<p className="vn-note">Buka lagi dan baca semua halaman agar catatan masuk ke jurnal.</p>}
 </section>;
}

export function EnergyLab({draft,change,done}: {draft:TaskDraft;change:(draft:TaskDraft)=>void;done:boolean}) {
 const energy=draft.power?10*draft.duration/1000:0;
 const hours=draft.duration;
 return <section className="vn-energy-lab" aria-label="Panel eksperimen energi lampu">
  <div className="vn-energy-header"><div><small>LABORATORIUM IPA · SIMULATOR LOKAL</small><h3>Rangkaian Lampu 10 W</h3></div><span className="vn-lab-stamp">SIMULASI</span></div>
  <div className="vn-energy-apparatus">
   <div className="vn-energy-fixture"><svg className={'vn-real-lamp '+(draft.power?'lit':'')} viewBox="0 0 100 138" aria-hidden="true" focusable="false">
    <defs><radialGradient id="picdBulbGlass"><stop offset="0" stopColor={draft.power?'#fff7c5':'#d9e2e0'}/><stop offset=".65" stopColor={draft.power?'#f5d586':'#99afb4'}/><stop offset="1" stopColor={draft.power?'#c7a86d':'#637e86'}/></radialGradient></defs>
    <path d="M50 6 C23 6 12 27 16 49 C18 63 29 74 34 84 L66 84 C71 74 82 63 84 49 C88 27 77 6 50 6 Z" fill="url(#picdBulbGlass)" stroke="#ecdfbb" strokeWidth="4"/>
    <path d="M36 76 L40 54 L50 66 L60 54 L64 76" stroke="#9a7046" fill="none" strokeWidth="3" strokeLinecap="round"/>
    <path d="M34 83 H66 V97 H34 Z" fill="#a7aeb3" stroke="#526b70" strokeWidth="3"/>
    <path d="M34 87 H66 M34 92 H66" stroke="#566670" strokeWidth="3"/>
    <path d="M39 97 H61 L55 106 H45 Z" fill="#758d91" stroke="#52666c" strokeWidth="2"/>
    <path d="M34 28 C39 20 44 19 51 18" fill="none" stroke="#ffffff" strokeOpacity=".8" strokeWidth="5" strokeLinecap="round"/>
   </svg><span className="vn-fixture-label">LAMPU MODEL 10 W</span></div>
   <div className="vn-energy-wire" aria-hidden="true" />
   <div className="vn-energy-switch"><span>SAKELAR DAYA</span><button className={'vn-rocker '+(draft.power?'on':'')} aria-pressed={draft.power} disabled={done} onClick={()=>change({...draft,power:!draft.power,touched:true})}><span className="vn-rocker-thumb" />{draft.power?'ON':'OFF'}</button><small>{draft.power?'● ARUS AKTIF':'○ ARUS TERPUTUS'}</small></div>
  </div>
  <div className="vn-meter-row"><div className="vn-meter"><span className="vn-meter-kicker">ENERGI TERHITUNG</span><output aria-live="polite">{energy.toFixed(2)} <small>kWh</small></output><span className="vn-meter-footer">Daya × waktu ÷ 1000</span></div><div className="vn-meter-data"><span>DAYA</span><strong>{draft.power?'10':'0'} W</strong><span>WAKTU</span><strong>{hours} jam</strong></div></div>
  <label className="vn-energy-duration"><span>Durasi penggunaan</span><b>{hours} jam</b><input type="range" aria-label="Durasi lampu" min={1} max={8} step={1} disabled={done} value={hours} onChange={e=>change({...draft,duration:Number(e.target.value),touched:true})}/><span className="vn-range-ticks"><span>1 jam</span><span>8 jam</span></span></label>
  <p className="vn-lab-note">Perangkat ini hanya model pembelajaran berdaya 10 W, bukan alat ukur atau pembacaan listrik nyata. Ubah sakelar dan durasi, lalu catat pengamatanmu.</p>
 </section>;
}

export function NoticeBoard({task}:{task:Task}) {
 return <section className="vn-notice-section"><p>Bu Rani: “Sebelum pengumuman ditempel, periksa apakah kita sudah punya alasan yang cukup.”</p>
  <div className="vn-notice-board" role="group" aria-label="Papan pengumuman sekolah">
   <div className="vn-notice-frame"><div className="vn-notice-heading">PAPAN INFORMASI</div><div className="vn-notice-papers">{task.sections.map((s,i)=><article className={'vn-notice-paper paper-'+i} key={i}><span className="vn-notice-pin"/><small>CATATAN {i+1}</small><p>{s}</p></article>)}</div><span className="vn-notice-footer">TELITI • BANDINGKAN • PUTUSKAN</span></div>
  </div><p className="vn-note">Baca catatan yang ditempel, kemudian pilih pernyataan yang paling sesuai dengan bukti.</p>
 </section>;
}
