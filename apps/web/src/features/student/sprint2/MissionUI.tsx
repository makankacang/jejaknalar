import { useState } from 'react';
import { ROOMS, roomIds, type Room, type WorldId, type Point, type Heading, type Target } from '../../../game/sprint2/world';
import type { MissionStatus } from '../../../game/sprint2/state';
import { roomRoute, type Guide } from '../../../game/sprint2/mission-guidance';

export type TaskRow={id:string;label:string;place?:string;status:MissionStatus|'pending';};
export function TaskTracker({rows,open,completed}: {rows:TaskRow[];open:()=>void;completed:boolean}) {
 const [collapsed,setCollapsed]=useState(false);
 const lastDone=rows.reduce((last,row,index)=>row.status==='completed'||row.status==='skipped'?index:last,-1);
 const current=rows.findIndex(row=>row.status==='active'||row.status==='available'||row.status==='pending');
 // Show the last two completed steps and the next actionable step; never cover the map.
 const visible=collapsed?rows.filter((_,index)=>index===current||current===-1&&index===lastDone):rows.filter((row,index)=>
  index===current||(index>lastDone-2 && index<=lastDone && (row.status==='completed'||row.status==='skipped')));
 return <section className="vn-tasktracker" aria-label="Daftar tujuan perjalanan" aria-live="polite">
  <div className="vn-tasktracker-head"><span className="vn-task-eyebrow">TUGAS</span><button type="button" onClick={()=>setCollapsed(value=>!value)} aria-label={collapsed?'Tampilkan tugas terakhir':'Ringkas tugas'}>{collapsed?'▾':'▴'}</button></div>
  <ol>{visible.map(row=><li key={row.id} className={'vn-tracker-'+(row.status==='completed'||row.status==='skipped'?'done':row.status==='locked'?'locked':'active')} aria-label={`${row.label}: ${row.status==='completed'?'selesai':row.status==='skipped'?'dilewati':'sedang dikerjakan'}`}><span className="vn-taskname">{row.status==='completed'?'✓ ':row.status==='skipped'?'– ':'› '}{row.label}</span></li>)}</ol>
  {completed&&<p className="vn-task-end">Misi selesai · lihat Jurnal</p>}
  <button className="vn-task-journal" onClick={open}>Jurnal perjalanan ↗</button>
 </section>;
}

const schoolPositions:[[string,number,number],...Array<[string,number,number]>]=[
 ['school.courtyard',280,55],['school.corridor',280,160],['school.classroom',85,70],['school.library',85,165],['school.staff_room',85,265],['school.laboratory',475,70],['school.knowledge_lab',475,165],['school.discussion_hall',475,265]
];
const cityPositions:[[string,number,number],...Array<[string,number,number]>]=[
 ['city_hub',280,163],['city_market',280,36],['city_council',102,75],['city_library',100,240],['city_clinic',455,74],['city_utility',458,238],['city_park',280,300]
];
function iconFor(t:Target,statuses?:Record<string,string>){if(t.task&&statuses?.[t.task]==='completed')return '✓';if(t.task&&statuses?.[t.task]==='locked')return '×';return t.kind==='door'?'↪':t.kind==='npc'?'♟':t.kind==='task'?'!':t.kind==='map'?'▣':'·';}
function mapTargetColor(t:Target,goal?:Guide|null,statuses?:Record<string,string>){if(t.task&&statuses?.[t.task]==='completed')return '#8de2a7';if(t.task&&statuses?.[t.task]==='locked')return '#a2afb2';return t.id===goal?.target.id?'#f6c564':t.kind==='door'?'#c9d8d2':t.kind==='task'?'#c19d6b':'#92a69c';}
export function LocalMap({room,position,heading,guide,compact=false,statuses}:{room:Room;position:Point;heading:Heading;guide?:Guide|null;compact?:boolean;statuses?:Record<string,string>}) {
 // Compact minimap follows the player: a long corridor otherwise shrinks into a thin unreadable strip.
 const visibleWidth=compact?Math.min(room.width,780):room.width;
 const visibleHeight=compact?Math.min(room.height,490):room.height;
 const viewX=compact?Math.max(0,Math.min(room.width-visibleWidth,position.x-visibleWidth/2)):0;
 const viewY=compact?Math.max(0,Math.min(room.height-visibleHeight,position.y-visibleHeight/2)):0;
 return <div className={'vn-map-compass '+(compact?'compact':'')}>
  <div className="vn-compass-n" aria-hidden="true">N</div>
  <svg viewBox={`${viewX} ${viewY} ${visibleWidth} ${visibleHeight}`} role="img" aria-label={`Denah ${room.title}: kamu dan objek di dalam ruangan`} preserveAspectRatio="xMidYMid meet">
   <defs><pattern id={compact?'miniTiles':'atlasTiles'} width="56" height="56" patternUnits="userSpaceOnUse"><rect width="56" height="56" fill="#8a9b90"/><path d="M0 0H56M0 0V56" stroke="#dce1c2" strokeOpacity=".25" strokeWidth="3"/></pattern></defs>
   <rect width={room.width} height={room.height} fill={`url(#${compact?'miniTiles':'atlasTiles'})`}/>
   {room.walls.map((w,i)=><rect key={i} x={w.x} y={w.y} width={w.width} height={w.height} fill="#476168"/>)}
   {room.solids.map(o=><rect key={o.id} x={o.x} y={o.y} width={o.width} height={o.height} rx="5" fill="#344d50" stroke="#b4c5aa" strokeWidth="2"/>)}
   {room.targets.map(t=><g key={t.id} transform={`translate(${t.x} ${t.y})`}>
    {t.id===guide?.target.id&&<circle r="32" fill="#fae2a7" fillOpacity=".20" stroke="#fbe3a5" strokeWidth="5"/>}
    <circle r={compact?19:16} fill={mapTargetColor(t,guide,statuses)} stroke="#182b35" strokeWidth={compact?3:4}/>
    {!compact&&<text textAnchor="middle" y="6" fontWeight="bold" fontSize="20" fill="#172f37">{iconFor(t,statuses)}</text>}
   </g>)}
   <g transform={`translate(${position.x} ${position.y}) rotate(${{up:0,right:90,down:180,left:270}[heading]})`}>
    <circle r="29" fill="#70c9e0" fillOpacity=".2" stroke="#e7faff" strokeWidth="3"/>
    <path d="M0 -23L-15 15L0 9L15 15Z" fill="#137eac" stroke="#ffffff" strokeWidth="5"/>
   </g>
  </svg>
  {!compact&&<span className="vn-map-watermark">KAMU <b>●</b> TUJUAN <b>◆</b></span>}
 </div>;
}

export function WorldAtlas({world,room,visited,position,heading,guide,openJournal,close,statuses}: {world:WorldId;room:Room;visited:string[];position:Point;heading:Heading;guide:Guide|null;openJournal:()=>void;close:()=>void;statuses?:Record<string,string>;}) {
 const [zoom,setZoom]=useState(1);
 const places=world==='school'?schoolPositions:cityPositions;
 const mapPos=new Map(places.map(([id,x,y])=>[id,{x,y}]));
 const edges=new Set<string>();
 for(const id of roomIds(world))for(const t of ROOMS[id].targets)if(t.kind==='door'&&t.to&&mapPos.has(t.to))edges.add([id,t.to].sort().join('::'));
 const path=guide?roomRoute(world,room.id,guide.destination===room.title?room.id:(guide.path.at(-1)??room.id)):null;
 return <div className="vn-atlas"><header className="vn-atlas-header"><div><p className="vn-eyebrow">PETA PETUALANGAN</p><h3>{world==='school'?'Kompleks Sekolah':'Lingkungan Kota'}</h3><p>Peta bukan teleport. Ikuti garis antar ruangan dan tanda pintu menuju tujuan.</p></div><div className="vn-atlas-actions"><button aria-label="Perkecil peta" onClick={()=>setZoom(z=>Math.max(.75,z-.25))}>−</button><strong>{Math.round(zoom*100)}%</strong><button aria-label="Perbesar peta" onClick={()=>setZoom(z=>Math.min(1.5,z+.25))}>+</button></div></header>
  <div className="vn-atlas-overview"><svg viewBox="0 0 560 348" role="img" aria-label="Peta koneksi ruangan dengan posisi pemain dan tujuan" style={{transform:`scale(${zoom})`}}>
   <defs><pattern id="atlasDots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="1" fill="#f4dbad" opacity=".18"/></pattern></defs>
   <rect width="560" height="348" rx="24" fill="#1b3a43"/><rect width="560" height="348" fill="url(#atlasDots)"/><circle cx="280" cy="170" r="165" fill="none" stroke="#c0a66e" strokeWidth="2" strokeDasharray="2 13"/>
   {Array.from(edges).map(e=>{const[a,b]=e.split('::'),p=mapPos.get(a)!,q=mapPos.get(b)!;const active=path?.includes(a)&&path?.includes(b);return <line key={e} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={active?'#ffc767':'#76989b'} strokeWidth={active?7:4} strokeLinecap="round" strokeDasharray={active?'10 8':undefined}/>;})}
   {places.map(([id,x,y])=>{const r=ROOMS[id],here=id===room.id,goal=id===guide?.path.at(-1),seen=visited.includes(id);return <g key={id} transform={`translate(${x} ${y})`}>
    {(here||goal)&&<circle r="34" fill="none" stroke={here?'#73cfe8':'#ffd06f'} strokeWidth="4" strokeDasharray={here?undefined:'5 5'}/>}
    <rect x="-72" y="-21" width="144" height="42" rx="10" fill={here?'#337d92':goal?'#f6cb74':seen?'#294b4c':'#1d343c'} stroke={here?'#c8f4ff':goal?'#fce8a8':'#718f85'} strokeWidth="2"/>
    <text x="0" y="-1" textAnchor="middle" fontWeight="bold" fontSize={r.title.length>20?'10':'12'} fill={goal?'#20323c':'#fff5dc'}>{r.title.slice(0,26)}</text>
    <text x="0" y="14" textAnchor="middle" fontSize="10" fill={goal?'#43554b':'#dceadd'}>{here?'● KAMU':goal?'◆ TUJUAN':seen?'✓ DIKUNJUNGI':'○ BELUM'}</text>
   </g>;})}
   <g transform="translate(523 38)"><circle r="21" fill="#ebca79"/><text textAnchor="middle" y="7" fontWeight="bold" fontSize="22" fill="#203a42">N</text></g>
  </svg></div>
  <div className="vn-atlas-details"><div><h4>Denah ruang sekarang</h4><LocalMap room={room} position={position} heading={heading} guide={guide} statuses={statuses}/></div><div><h4>Petunjuk perjalanan</h4><p><strong>Kamu:</strong> {room.title}</p><p><strong>Tujuan:</strong> {guide?.destination??'Semua bukti utama sudah diperiksa'}</p><p>{guide?.viaDoor?`Lewati ${guide.label}. Pintu aktif hanya saat kamu cukup dekat.`:guide?`Cari objek ${guide.label}.`: 'Periksa Jurnal untuk meninjau perjalananmu.'}</p><div className="vn-map-legend"><span>🔵 Kamu</span><span>◆ Tujuan</span><span>✓ Dikunjungi</span><span>↪ Pintu</span></div><button className="vn-primary" onClick={close}>Kembali bermain</button><button onClick={openJournal}>Buka Jurnal</button></div></div>
 </div>;
}
