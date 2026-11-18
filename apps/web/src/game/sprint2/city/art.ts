import type { ArtObject, Room } from '../world';
/** Original procedural City art. No remote photos, sprites, or whole-map screenshot dependencies. */
export const cityObjectDepth=(o:ArtObject)=>o.kind.startsWith('city_facade')?(o.y+o.h)*40-35:(o.y+o.h)*40;
export function paintCityObject(c:CanvasRenderingContext2D,o:ArtObject):boolean {
 const x=o.x*40,y=o.y*40,w=o.w*40,h=o.h*40,k=o.kind;
 const r=(a:number,b:number,d:number,e:number,col:string)=>{c.fillStyle=col;c.fillRect(a,b,d,e);};
 const frame=(a:number,b:number,d:number,e:number,col:string)=>{r(a,b,d,e,'#334440');r(a+3,b+3,d-6,e-6,col);};
 const el=(a:number,b:number,d:number,e:number,col:string)=>{c.fillStyle=col;c.beginPath();c.ellipse(a,b,Math.max(1,d),Math.max(1,e),0,0,Math.PI*2);c.fill();};
 const line=(a:number,b:number,d:number,e:number,col:string,width=3)=>{c.strokeStyle=col;c.lineWidth=width;c.beginPath();c.moveTo(a,b);c.lineTo(d,e);c.stroke();};
 const text=(s:string,a:number,b:number,size=14,col='#f5e9cd')=>{c.fillStyle=col;c.font=`bold ${size}px sans-serif`;c.textAlign='center';c.fillText(s,a,b);};
 const shadow=()=>el(x+w/2,y+h+4,w*.48,9,'#182c3433');
 const wood=()=>{shadow();frame(x,y,w,h,'#aa7950');r(x+6,y+7,w-12,5,'#d9b178');for(let i=25;i<h;i+=22)r(x+5,y+i,w-10,2,'#805a3d');};
 if(k==='city_park_entrance'){
  // Park trail is OPEN AIR. The wayfinding sign is BESIDE the path, never
  // a banner the player can walk underneath or a false facade/door.
  const trailX=x+96, trailW=w-192;
  r(trailX,y+4,trailW,h+7,'#c6b58e');
  for(let yy=y+23;yy<y+h;yy+=32){r(trailX+12,yy,trailW-24,3,'#e6d5ac');}
  for(const sideX of [x+38,x+w-38]){
    el(sideX,y+h-30,34,29,'#477952');
    el(sideX-11,y+h-65,24,33,'#5d9864');
    el(sideX+15,y+h-76,20,27,'#7eab64');
    for(let f=0;f<4;f++)el(sideX-18+f*10,y+h-18,3,4,f%2?'#f4c77c':'#ef9fae');
  }
  // Side sign: both posts, signboard and the flowers have matching colliders.
  const signLeft=x+w-92, signRight=x+w-33;
  for(const sx of [signLeft,signRight])r(sx-5,y+58,10,86,'#70583c');
  frame(signLeft-17,y+32,100,47,'#386e4e');
  text('TAMAN',signLeft+32,y+52,13,'#fff1ca');
  text('KOTA',signLeft+32,y+70,13,'#fff1ca');
  return true;
 }
 if(k.startsWith('city_facade')){
  const n=Number(k.at(-1)),wall=['','#d6b481','#e5dcc0','#c1d3cc','#dcf0de','#aaa69a','#a8c397'][n],roof=['','#a25440','#974c3b','#426e75','#407b68','#636b67','#4d7d50'][n];
  shadow();frame(x,y+45,w,h-45,wall);r(x+5,y+h-19,w-10,19,'#8f9182');
  if(n===2){c.fillStyle=roof;c.beginPath();c.moveTo(x-12,y+58);c.lineTo(x+w*.25,y+8);c.lineTo(x+w*.75,y+8);c.lineTo(x+w+12,y+58);c.fill();r(x+30,y+65,12,h-85,'#f2e6c5');r(x+w-42,y+65,12,h-85,'#f2e6c5');}
  else {frame(x-8,y+12,w+16,52,roof);for(let i=0;i<w;i+=18)r(x+i,y+18,3,41,'#ffffff22');r(x-10,y+61,w+20,7,'#293e38');}
  if(n===1){for(let i=0;i<w;i+=32)r(x+i,y+64,32,22,i%2?'#dcb966':'#b65343');for(const a of [20,w-83]){frame(x+a,y+103,62,55,'#806746');for(let j=0;j<4;j++)r(x+a+5,y+110+j*11,52,3,'#c2a57d');}}
  else if(n===5){for(const a of [18,w-100]){frame(x+a,y+95,80,65,'#4d5a57');for(let j=0;j<8;j++)r(x+a+4,y+100+j*7,72,2,'#8d9990');}el(x+34,y+h-25,22,22,'#263532');el(x+34,y+h-25,11,11,'#7a8980');}
  else if(n===6){for(const a of [22,w-48]){frame(x+a,y+84,26,h-84,'#bcb695');}r(x+70,y+110,w-140,h-112,'#729565');}
  else for(const a of [48,w-102]){frame(x+a,y+100,55,57,'#7fbbca');r(x+a+7,y+106,5,43,'#d9eddf');r(x+a+26,y+102,4,52,'#e7e0c8');r(x+a+2,y+126,51,4,'#e7e0c8');}
  frame(x+22,y+67,w-44,27,n===4?'#38775d':'#344d56');text(o.label??'KOTA',x+w/2,y+86,13);
  if(n===4){r(x+w-36,y+28,10,25,'#e6f3dc');r(x+w-43,y+35,24,10,'#e6f3dc');}
  return true;
 }
 if(k==='city_stall'){wood();for(let row=0;row<2;row++)for(let col=0;col<4;col++){const a=x+10+col*(w-20)/4,b=y+32+row*30;frame(a,b,(w-28)/4,27,'#645137');for(let i=0;i<3;i++)el(a+9+i*11,b+12,6,7,['#c45d44','#80a44a','#deaa49','#659052'][col]);}r(x-4,y-14,w+8,28,'#cebf84');for(let a=0;a<w;a+=30)r(x+a,y-14,15,28,'#567e73');r(x+5,y+15,4,h-17,'#69573e');r(x+w-9,y+15,4,h-17,'#69573e');return true;}
 if(k==='city_crates'||k==='city_sacks'){shadow();for(let i=0;i<3;i++){const a=x+i*w/3;if(k==='city_sacks'){el(a+w/6,y+h/2,w/7,h/2,'#cbb88a');line(a+8,y+12,a+w/3-8,y+12,'#8a7654');}else{frame(a+2,y+3,w/3-5,h-4,'#b08954');line(a+5,y+7,a+w/3-9,y+h-7,'#765838',5);}}return true;}
 if(k==='city_scale'){wood();frame(x+12,y+15,60,36,'#a5b3a6');el(x+42,y+20,19,19,'#e8e1c5');line(x+42,y+20,x+50,y+10,'#af523e',2);r(x+16,y+2,53,7,'#596e67');frame(x+w-65,y+14,48,38,'#eddfb7');line(x+w-42,y+18,x+w-42,y+48,'#8c6d4c',2);return true;}
 if(k==='city_meeting'||k==='city_reading'){wood();for(const a of [20,w-70]){frame(x+a,y+22,42,30,'#f0dfba');for(let j=0;j<3;j++)r(x+a+6,y+29+j*6,28,2,'#aba68c');}if(k==='city_reading'){r(x+w/2-3,y+12,6,42,'#655c43');el(x+w/2,y+15,24,10,'#4c8b68');el(x+w/2,y+53,15,5,'#73684c');}else{line(x+w/2,y+h/2,x+w/2+16,y+h/2-20,'#364b48',4);el(x+w/2,y+h/2,11,5,'#50605a');for(let i=0;i<3;i++)el(x+90+i*55,y+h-32,7,9,'#d4e6df');}return true;}
 if(k==='city_reception'){shadow();frame(x,y,w,h,'#dae2d5');r(x+4,y+h-40,w-8,36,'#78a58c');frame(x+25,y+12,w-50,50,'#a0c5be');for(let a=30;a<w-30;a+=85)r(x+a,y+15,4,43,'#e1eadd');frame(x+w*.35,y-25,w*.3,29,'#263a38');text('A  012',x+w/2,y-4,18,'#e99170');return true;}
 if(k==='city_waiting'){shadow();for(let i=0;i<4;i++){const a=x+i*w/4;frame(a+2,y,w/4-8,h-7,'#8eaca6');r(a+8,y+6,w/4-20,19,'#baccc0');r(a+9,y+h-8,5,13,'#435b58');r(a+w/4-19,y+h-8,5,13,'#435b58');}return true;}
 if(k==='city_staff'){frame(x,y,w,h,'#d4dfd1');r(x+4,y+h-50,w-8,45,'#709480');frame(x+w/2-28,y+h-120,56,110,'#587b70');r(x+w/2+15,y+h-65,5,5,'#ead4a4');text('KHUSUS STAF',x+w/2,y+35,17,'#466359');return true;}
 if(k==='city_tools'){wood();frame(x,y-45,w,75,'#69766c');for(let a=20;a<w-20;a+=40){line(x+a,y-28,x+a+8,y+11,'#c5c9b1',6);el(x+a,y-28,9,9,'#c5c9b1');el(x+a,y-28,4,4,'#69766c');}frame(x+30,y+52,70,38,'#af5340');r(x+w-70,y+42,30,47,'#d5ba76');return true;}
 if(k==='city_toolbox'){shadow();frame(x,y,w,h,'#aa5543');for(let i=0;i<3;i++){frame(x+8,y+7+i*25,w-16,22,'#bf6b50');r(x+w*.4,y+14+i*25,w*.2,4,'#c2c8b4');}return true;}
 if(k==='city_generator'){shadow();frame(x,y,w,h,'#7a8b80');for(let a=12;a<w/2;a+=12)r(x+a,y+20,5,h-40,'#40594f');frame(x+w*.58,y+13,w*.32,45,'#244e54');for(let i=0;i<3;i++)r(x+w*.62+i*17,y+45-i*8,9,8+i*8,'#8ccba1');el(x+w*.7,y+h-30,11,11,'#dbbd67');el(x+w*.86,y+h-30,9,9,'#b75c4c');text('SIMULASI',x+w/2,y-8,13,'#30514b');return true;}
 if(k==='city_tires'){shadow();for(const a of [w*.27,w*.73])for(let i=2;i>=0;i--){el(x+a,y+h-20-i*20,w*.24,17,'#263b37');el(x+a,y+h-20-i*20,w*.12,9,'#74867a');}return true;}
 if(k==='city_motorcycle'){shadow();for(const a of [w*.18,w*.82]){el(x+a,y+h*.65,w*.15,h*.3,'#263833');el(x+a,y+h*.65,w*.08,h*.17,'#9ca99a');}line(x+w*.18,y+h*.65,x+w*.5,y+h*.25,'#c4b48a',7);line(x+w*.5,y+h*.25,x+w*.82,y+h*.65,'#c4b48a',7);frame(x+w*.3,y+h*.25,w*.34,h*.3,'#467c80');r(x+w*.37,y+h*.1,w*.32,8,'#354740');line(x+w*.8,y+h*.6,x+w*.75,y,'#3e514b',5);return true;}
 if(k==='city_lamp'){shadow();r(x+w/2-4,y-75,8,h+75,'#40564e');r(x-10,y-78,w+20,7,'#40564e');frame(x-8,y-76,w+16,25,'#ebd69b');el(x+w/2,y+h,17,6,'#41544b');return true;}
 if(k==='city_bins'){shadow();for(let i=0;i<3;i++){const a=x+i*w/3;frame(a,y+4,w/3-3,h-4,['#5c9972','#c29e49','#a65a49'][i]);r(a-1,y,w/3,8,'#3d6152');el(a+w/6-1,y+17,4,5,'#e7dfb8');}return true;}
 if(k==='city_bus_stop'){shadow();r(x+8,y+10,7,h,'#526760');r(x+w-15,y+10,7,h,'#526760');frame(x,y-10,w,25,'#4c7b79');r(x+22,y+h-18,w-44,10,'#ba9b6b');text('HALTE KOTA',x+w/2,y+7,12);return true;}
 if(k==='city_fountain'||k==='city_pond'){shadow();el(x+w/2,y+h/2,w/2,h/2,'#9b9f88');el(x+w/2,y+h/2,w/2-9,h/2-8,'#4e919b');el(x+w/2,y+h/2,w/2-18,h/2-17,'#76b5bb');for(let i=0;i<5;i++)line(x+w*.2+i*20,y+h*.6,x+w*.3+i*20,y+h*.6,'#b7d7cb',2);if(k==='city_fountain'){el(x+w/2,y+h/2,36,20,'#c6c6a7');r(x+w/2-10,y+h/2-52,20,45,'#d2c7a5');el(x+w/2,y+h/2-52,36,11,'#89c4c8');}else for(let i=0;i<3;i++)el(x+w*.65+i*18,y+h*.4-i*10,10,5,'#689369');return true;}
 return false;
}
export function paintCityFloor(c:CanvasRenderingContext2D,r:Room) {
 const rect=(x:number,y:number,w:number,h:number,col:string)=>{c.fillStyle=col;c.fillRect(x,y,w,h);};
 const outdoor=r.id==='city_hub'||r.id==='city_park';
 const base=r.id==='city_market'?'#b4a38a':r.id==='city_library'?'#b99b73':r.id==='city_clinic'?'#d0dfd3':r.id==='city_utility'?'#9a9e93':outdoor?'#729375':'#c5bda6';
 rect(0,0,r.width,r.height,base);
 for(let y=0;y<r.height;y+=40)for(let x=0;x<r.width;x+=40){rect(x,y,40,1,'#344d3b15');rect(x,y,1,40,'#344d3b15');if((x/40+y/40)%3===0)rect(x+2,y+2,36,36,'#ffffff08');}
 if(r.id==='city_hub'){
  // Green path continues into the open-air park instead of an indoor vestibule.
  rect(1190,780,300,320,'#7e9e77');rect(1280,795,120,380,'#c9b997');
  rect(0,310,r.width,85,'#505f60');rect(0,725,r.width,85,'#505f60');rect(500,0,90,r.height,'#505f60');rect(1030,0,90,r.height,'#505f60');
  for(const y of [310,725]){for(let x=0;x<r.width;x+=50)rect(x,y+40,26,4,'#d8cba5');for(let x=0;x<r.width;x+=24){rect(x,y-7,24,7,x%48?'#e2deca':'#3d504b');rect(x,y+85,24,7,x%48?'#e2deca':'#3d504b');}}
  rect(600,405,420,290,'#beb497');for(let x=610;x<1010;x+=32)rect(x,410,1,280,'#8f9b8733');
  for(const y of [317,732])for(let i=0;i<6;i++)rect(770,y+i*12,65,6,'#e6dfc7');
  for(const x of [260,800,1340]){rect(x-45,260,90,42,'#c6b89a');rect(x-45,1020,90,210,x===1340?'#c9b997':'#bcb39b');}
 } else if(r.id==='city_park'){
  // Redesigned outdoor park, original graphics (no copied commercial tilesets).
  // Walkable promenade connects the south portal, Kak Wulan, pond, and quest
  // board without putting the player inside trees/buildings or an indoor map.
  const strokePath=(pts:[number,number][],size:number,col:string)=>{
    c.strokeStyle=col;c.lineWidth=size;c.lineCap='round';c.lineJoin='round';
    c.beginPath();c.moveTo(pts[0][0],pts[0][1]);
    for(let i=1;i<pts.length;i++)c.lineTo(pts[i][0],pts[i][1]);c.stroke();
  };
  const paths:[number,number][][]=[
    [[600,880],[600,750],[600,642],[600,615]],
    [[600,615],[480,625],[370,565],[330,455],[340,265],[435,149],[600,128],[780,151],[864,290],[855,473],[895,605],[965,750]],
    [[600,615],[750,620],[865,600]],
    [[340,475],[490,466],[710,466],[860,475]],
  ];
  for(const pts of paths){strokePath(pts,112,'#688465');strokePath(pts,94,'#beac86');strokePath(pts,82,'#d9ca9f');}
  // Light sandstone blocks and worn seams, placed only over the pedestrian lane.
  for(let yy=659;yy<858;yy+=30){rect(566,yy,21,3,'#f4e3bd');rect(613,yy+13,18,3,'#f4e3bd');}
  for(let xx=410;xx<803;xx+=43)rect(xx,455,25,3,'#eee0b5');
  // Four planted gardens with actual borders, distinct from roof/building tiles.
  for(const [xx,yy,ww,hh] of [[75,75,200,120],[932,73,196,121],[76,482,150,83],[963,480,164,86]] as const){
    rect(xx-7,yy-7,ww+14,hh+14,'#3e6e4b');rect(xx,yy,ww,hh,'#4e8d57');
    for(let gy=yy+14;gy<yy+hh-7;gy+=25)for(let gx=xx+15;gx<xx+ww-8;gx+=27){
      const n=(gx*7+gy*13)%4;
      c.fillStyle=['#f0b7c3','#f0d08b','#d7e3a0','#f1a08f'][n];
      c.beginPath();c.arc(gx,gy,5,0,Math.PI*2);c.fill();
      rect(gx-1,gy+5,2,6,'#376d40');
    }
  }
  // Border stones and shadowed low planters make the geography legible.
  for(let xx=260;xx<=940;xx+=75){
    rect(xx,64,35,8,'#527d5a');rect(xx,68,30,3,'#9bb48a');
  }
  // Central observation pad in front of the pond, no water collision changes.
  rect(452,478,298,19,'#a2a582');
  for(let xx=466;xx<750;xx+=32)rect(xx,485,19,3,'#ebe2bf');
  // Direction cue is floor-level tile art, never an interactive label.
  rect(555,816,90,9,'#9a966e');
  for(let xx=565;xx<=625;xx+=20)rect(xx,818,12,4,'#e8d8af');
 }
 else if(r.id==='city_utility'){rect(390,330,330,230,'#737f75');c.strokeStyle='#d2b86e';c.lineWidth=4;c.strokeRect(400,340,310,210);}
 else if(r.id==='city_council'){rect(570,120,6,410,'#9a9e8b');rect(650,180,440,300,'#b8a987');}
 for(const wall of r.walls){rect(wall.x,wall.y,wall.width,wall.height,r.id==='city_clinic'?'#82a48c':'#7f8e80');rect(wall.x,wall.y+wall.height-6,wall.width,6,'#d8cba8');}
 for(const t of r.targets)if(t.portal){const o=t.portal.opening;rect(o.x,o.y,o.width,o.height,base);}
}
