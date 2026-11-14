import type { ArtObject, Room, Portal } from '../world';
/** Original City layout from the supplied Indonesian City reference. Internal D registry only. */
export const CITY_LAYOUT_VERSION = 'D-city-visual-1.2';
export function createCityRooms(): Record<string, Room> {
 const rooms: Record<string, Room> = {};
 const names=['Alun-Alun & Jalan Kota','Pasar Tradisional','Balai Warga','Perpustakaan Kota','Klinik Warga','Bengkel & Pos Utilitas','Taman Kota'];
 const ids=['city_hub','city_market','city_council','city_library','city_clinic','city_utility','city_park'];
 const people=['Pak Damar','Bu Sari','Pak Bima','Bu Lestari','Bu Ratna','Mas Bayu','Kak Wulan'];
 const roles=['Pengurus lingkungan','Pedagang pasar','Petugas balai','Pustakawan kota','Petugas informasi','Teknisi utilitas','Pengelola taman'];
 const hints=['Mulai dari buku transaksi pasar. Bandingkan waktunya dengan arsip petugas di perpustakaan, lalu periksa model energi di bengkel.','Buku transaksi mencatat kunjungan, bukan penyebab penggunaan listrik.','Ada titipan catatan yang boleh kamu antar. Rapat warga mengutamakan bukti.','Arsip petugas mencatat kegiatan setelah pasar tutup. Periksa waktunya.','Mari tinjau kembali hubungan jumlah pengunjung dan waktu kegiatan.','Panel ini hanya model belajar energi. Jangan menyentuh instalasi listrik nyata.','Terapkan kebiasaan memeriksa bukti pada kasus baru.'];
 ids.forEach((id,i)=>{const outdoor=i===0||i===6,w=i===0?1600:1200,h=i===0?1280:880;rooms[id]={id,title:names[i],world:'city',theme:outdoor?'outdoor':'city',width:w,height:h,spawn:{x:w/2,y:h-140},solids:[],objects:[],walls:outdoor?[]:[{x:0,y:0,width:w,height:96},{x:0,y:0,width:40,height:h},{x:w-40,y:0,width:40,height:h},{x:0,y:h-40,width:w,height:40}],targets:[{id:id+':npc',kind:'npc',label:people[i],role:roles[i],message:hints[i],color:['#ad814c','#c87959','#617f9a','#6c9582','#65a898','#b48250','#779257'][i],x:i===0?800:600,y:i===0?650:640}]};});
 function obj(id:string,kind:string,label:string,x:number,y:number,w:number,h:number,solid=true,task?:string){const r=rooms[id],o:ArtObject={id:id+':'+kind+':'+r.objects.length,kind,label,x:x/40,y:y/40,w:w/40,h:h/40,solid,interaction:task?'task':'inspect',description:label+' — objek lingkungan Kota, konten contoh lokal.'};r.objects.push(o);if(solid){
  // Bounds include the visually extended roof canopy, leaf crowns and streetlight
  // head. The old tree trunk-only collision allowed walking INSIDE foliage.
  let sx=x,sy=y,sw=w,sh=h;
  if(kind==='tree'){sx=x+w*.08;sy=y+h*.08;sw=w*.84;sh=h*.89;}
  else if(kind.startsWith('city_facade')){sx=x-13;sy=y-13;sw=w+26;sh=h+21;}
  else if(kind==='city_lamp'){sx=x-11;sy=y-80;sw=w+22;sh=h+86;}
  else if(kind==='city_bus_stop'){sx=x-3;sy=y-12;sw=w+6;sh=h+17;}
  r.solids.push({id:o.id,kind,x:sx,y:sy,width:sw,height:sh,heightArt:0});
 }
 if(kind==='city_park_entrance'){
  // The side wayfinding board occupies the right-hand verge; the public
  // centre of the trail stays unobstructed (the quest gate is a state rule).
  r.solids.push({id:`${o.id}:signboard`,kind:'park-sign',
    x:x+w-110,y:y+31,width:102,height:115,heightArt:0});
 }
 if(kind.startsWith('city_facade')||kind==='city_park_entrance')return;const anchor={x:x+w/2,y:y+h+28};r.targets.push({id:task?id+':task':o.id+':inspect',kind:task?'task':'inspect',task,label,description:o.description,objectId:o.id,display:{x:x+w/2,y:y+h/2},...anchor});}
 function door(from:string,to:string,x:number,y:number,north:boolean,spawn:{x:number;y:number},required?:string){const r=rooms[from],parkTrail=to==='city_park'||from==='city_park';
  const portal:Portal={
   door_id:from+':to:'+to,from_room:from,to_room:to,normal:north?'up':'down',
   opening:{x:x-42,y:north?y-32:y-60,width:84,height:100},
   approach:{x,y:parkTrail?(north?y+58:y-58):north?y+96:y-116},
   trigger:{x:x-(parkTrail?24:62),y:parkTrail?(north?y+12:y-42):north?y+66:y-151,width:parkTrail?48:124,height:parkTrail?30:84},
   target_spawn:spawn,
   backing:{x:x-(parkTrail?42:49),y:parkTrail?(north?y-6:y+6):north?y-8:y-84,width:parkTrail?84:98,height:parkTrail?12:north?72:92},
  };r.targets.push({id:portal.door_id,kind:'door',label:to==='city_hub'?'Kembali ke Alun-Alun':to==='city_park'?'Lewati jalur menuju Taman Kota':rooms[to].title,x,y:north?y+27:y-27,display:{x,y},to,required,portal});}
 // Six real facades with short vestibules. Wide streets connect both rows around the central square.
 for(let i=1;i<7;i++){const x=[260,800,1340][(i-1)%3],y=i<=3?240:1000;
  if(i===6){
   // Park is an OUTDOOR public area, accessed by a planted trail, never a building facade.
   obj('city_hub','city_park_entrance','Jalur masuk Taman Kota',x-160,y-200,320,184,false);
  }else obj('city_hub','city_facade_'+i,names[i],x-160,y-200,320,184);
  door('city_hub',ids[i],x,y,true,rooms[ids[i]].spawn,i===6?'decide':undefined);
  door(ids[i],'city_hub',600,852,false,{x,y:y+76});
 }
 obj('city_hub','city_fountain','Air mancur alun-alun',680,420,240,140);
 obj('city_hub','case_board','Papan pengumuman warga',1030,540,150,70,true,'decide');
 obj('city_hub','map_board','Peta fasilitas kota',420,550,140,60);
 for(const x of [360,1120]){obj('city_hub','bench','Bangku alun-alun',x,410,130,44);obj('city_hub','city_lamp','Lampu jalan',x,650,28,42);}
 for(const x of [70,1460])for(const y of [420,620])obj('city_hub','tree','Pohon peneduh',x,y,80,100);
 obj('city_hub','city_bins','Sampah terpilah',1180,660,75,42);obj('city_hub','city_motorcycle','Parkir motor',100,1090,120,56);
 obj('city_hub','city_bus_stop','Halte angkutan',1270,1100,180,66);
 // Market: two trading aisles, broad center route; trade table carries the playable book slot.
 for(const x of [100,410,820])for(const y of [160,370])obj('city_market','city_stall','Kios sayur dan buah',x,y,220,110);
 obj('city_market','city_scale','Meja transaksi & buku pasar',100,610,190,72,true,'observe');obj('city_market','city_sacks','Karung beras',870,630,150,70);obj('city_market','city_crates','Peti hasil panen',1050,490,100,50);
 // Public reception left, meeting space right.
 obj('city_council','service_desk','Meja pelayanan warga',110,180,290,90,true,'side');obj('city_council','archive','Lemari arsip warga',110,380,200,100);
 obj('city_council','city_meeting','Meja rapat warga',690,240,310,170);obj('city_council','notice_board','Papan informasi RT/RW',740,120,200,50);
 for(const x of [650,1040])for(const y of [260,330,400])obj('city_council','chair','Kursi rapat',x,y,40,40);
 obj('city_council','flagpole','Bendera balai',410,320,35,60);obj('city_council','plant','Tanaman pelayanan',1000,620,60,64);
 // Left book stacks / right reading area / catalog by entrance.
 for(const x of [100,300,500])obj('city_library','shelf','Rak buku kota',x,160,90,270);
 for(const y of [190,390])obj('city_library','city_reading','Meja baca & lampu hijau',760,y,260,95);
 obj('city_library','archive','Arsip kegiatan petugas',100,590,180,85,true,'investigate');obj('city_library','pc_station','Komputer katalog',790,630,180,70);obj('city_library','plant','Tanaman baca',1050,590,55,65);
 // Clinic is a public information area, not a healing/HP game mechanic.
 obj('city_clinic','city_reception','Pendaftaran & nomor antrean',120,160,400,110,true,'support');
 for(const y of [380,520])obj('city_clinic','city_waiting','Kursi antrean',120,y,300,60);
 obj('city_clinic','city_staff','Ruang staf · tidak dapat dimasuki',790,130,260,240);obj('city_clinic','sink','Wastafel cuci tangan',830,450,120,70);obj('city_clinic','poster','Poster kesehatan',1000,450,60,70);obj('city_clinic','city_bins','Tempat sampah medis',1030,610,55,50);
 // Workshop: tool bench, service bay, tires and simulation model.
 obj('city_utility','city_tools','Meja kerja & rak perkakas',100,160,320,130);obj('city_utility','city_generator','Panel energi simulasi',780,180,250,130,true,'operate');
 obj('city_utility','city_motorcycle','Motor di area servis',430,390,240,110);obj('city_utility','city_tires','Tumpukan ban',100,440,120,100);obj('city_utility','city_toolbox','Lemari perkakas merah',860,470,150,90);obj('city_utility','notice_board','Checklist keselamatan',820,640,200,50);
 // Park: organic green borders and walkable promenade around pond.
 obj('city_park','city_pond','Kolam taman',420,220,340,210);
 for(const x of [90,950])for(const y of [140,400])obj('city_park','tree','Pohon taman',x,y,110,140);
 for(const x of [220,820])obj('city_park','bench','Bangku taman',x,530,140,45);
 obj('city_park','case_board','Kasus lanjutan warga',860,680,180,70,true,'transfer');obj('city_park','city_bins','Sampah terpilah',140,670,90,50);obj('city_park','garden','Bunga taman',440,510,280,60);
 return rooms;
}
