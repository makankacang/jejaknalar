import type { ArtObject } from './world';
import { TILE } from './world';
/**
 * PIC D school sprite pass v1.1: authored Canvas vector/pixel shapes, based on
 * referensi-objek-rpg-school.pdf (73 cards, pages 2–9). Each shape is drawn
 * at the registry coordinates; solid footprints and interactive IDs are unchanged.
 * These are original redrawings, NOT images cropped from the PDF.
 */
export function paintReferenceObject(c: CanvasRenderingContext2D, o: ArtObject): boolean {
  const x=o.x*TILE,y=o.y*TILE,w=o.w*TILE,h=o.h*TILE,k=o.kind;
  const r=(px:number,py:number,pw:number,ph:number,color:string)=>{if(pw<=0||ph<=0)return;c.fillStyle=color;c.fillRect(Math.round(px),Math.round(py),Math.round(pw),Math.round(ph));};
  const frame=(px:number,py:number,pw:number,ph:number,col:string,edge='#514737')=>{r(px,py,pw,ph,edge);r(px+4,py+4,pw-8,ph-8,col);};
  const disk=(cx:number,cy:number,rx:number,ry:number,col:string)=>{c.fillStyle=col;c.beginPath();c.ellipse(cx,cy,Math.max(1,rx),Math.max(1,ry),0,0,Math.PI*2);c.fill();};
  const ln=(ax:number,ay:number,bx:number,by:number,col:string,width=2)=>{c.strokeStyle=col;c.lineWidth=width;c.beginPath();c.moveTo(ax,ay);c.lineTo(bx,by);c.stroke();};
  const shadow=()=>disk(x+w*.5,y+h-1,w*.42,6,'#26312e3b');
  const page=(px:number,py:number,pw:number,ph:number)=>{frame(px,py,pw,ph,'#f3ecd9','#9a7957');for(let i=12;i<ph-7;i+=12)r(px+8,py+i,pw-16,2,'#b3b3a5');};
  const plank=(px:number,py:number,pw:number,ph:number,col='#af835a')=>{shadow();frame(px,py,pw,ph,col);r(px+5,py+4,pw-10,4,'#e5c698');r(px+5,py+ph-9,pw-10,3,'#845b3e');};
  const book=(px:number,py:number,pw:number,ph:number,col='#9e6650')=>{frame(px,py,pw,ph,col);r(px+5,py+4,pw/2-7,ph-8,'#f3e6c7');r(px+pw/2+2,py+4,pw/2-7,ph-8,'#eee0c2');ln(px+pw/2,py+4,px+pw/2,py+ph-4,'#a3815b',2)};
  const monitor=(px:number,py:number,pw:number,ph:number)=>{frame(px,py,pw,ph,'#143745','#2b3037');r(px+5,py+5,pw-10,ph-10,'#46819f');r(px+8,py+9,pw*.48,3,'#a7d5b9');r(px+pw*.62,py+ph*.5,pw*.11,ph*.2,'#dfbf64');r(px+pw*.76,py+ph*.38,pw*.11,ph*.32,'#d89d68');r(px+pw*.45,py+ph,pw*.11,8,'#536168');r(px+pw*.27,py+ph+8,pw*.46,3,'#6b7470');};
  if (['locker','cabinet','archive'].includes(k)) {
    shadow();const col=k==='locker'?'#6687a1':k==='archive'?'#8f927e':'#9d8262';frame(x,y-12,w,h+12,col);
    const cols=k==='locker'?Math.max(1,Math.min(5,Math.round(w/42))):k==='archive'?Math.max(2,Math.floor(w/26)):2;
    const rows=k==='archive'?3:1, cw=(w-12)/cols,ch=(h+3)/rows;
    for(let ix=0;ix<cols;ix++)for(let iy=0;iy<rows;iy++){
      const bx=x+6+cw*ix,by=y-7+ch*iy;frame(bx+1,by+1,cw-3,ch-4,col,'#4f5550');
      if(k==='archive'){r(bx+cw*.25,by+ch*.37,cw*.5,ch*.22,'#f0e1ba');disk(bx+cw*.5,by+ch*.75,2,2,'#ac9c7d');}
      else{r(bx+7,by+10,cw-14,3,'#395668');r(bx+7,by+17,cw-14,3,'#395668');r(bx+cw*.75,by+ch*.62,3,9,'#edcf94');}
    }return true;
  }
  if(k==='window'){frame(x,y,w,h,'#d0dccf','#775e49');for(let a=0;a<2;a++)for(let b=0;b<2;b++){const ww=(w-16)/2,hh=(h-16)/2;frame(x+6+a*ww,y+6+b*hh,ww-2,hh-2,'#78b5cf','#eee4cf');r(x+10+a*ww,y+8+b*hh,5,Math.max(3,hh-8),'#d8eef3');}return true;}
  if(['notice_board','map_board','board','whiteboard','screen_board','poster'].includes(k)) {
    const isWhite=k==='whiteboard',isScreen=k==='screen_board';frame(x,y-10,w,h+10,isWhite?'#f0efe9':isScreen?'#153849':'#e2c89c',isWhite?'#59686c':'#70533c');
    if(isScreen){monitor(x+8,y,w-16,Math.max(26,h-10));return true;}
    if(isWhite){for(let i=0;i<4;i++)r(x+13,y+9+i*12,w*.34+i*4,3,['#719eb6','#ba706e','#69977b','#b2a178'][i]);r(x+w*.65,y+12,40,30,'#e3e6dd');return true;}
    if(k==='map_board'){r(x+10,y+6,w-20,h-17,'#b5d5bb');ln(x+18,y+h*.65,x+w*.76,y+14,'#668f84',5);disk(x+w*.65,y+h*.44,6,6,'#b66b51');return true;}
    if(k==='poster'){frame(x+8,y+7,w-16,h-18,'#e0c76b','#7a4b48');disk(x+w*.5,y+h*.4,Math.min(16,w*.2),Math.min(16,h*.2),'#72a66b');return true;}
    for(let i=0;i<8;i++){const xx=x+10+(i%4)*((w-22)/4),yy=y+8+Math.floor(i/4)*Math.max(12,(h-26)/2);frame(xx,yy,Math.max(10,(w-30)/5),Math.max(13,(h-31)/3),['#f9f0cb','#e5bb77','#b5caac','#d89984'][i%4]);}return true;
  }
  if(k==='student_desk'){plank(x,y,w,h,'#c6976b');r(x+7,y+8,w*.25,h*.45,'#4b7c9e');r(x+w*.48,y+7,w*.31,h*.5,'#ecd9a8');r(x+w*.48,y+9,w*.31,3,'#d4a85d');r(x+w*.25,y+h*.74,w*.3,3,'#86623f');return true;}
  if(k==='chair'||k==='hall_chair'){shadow();frame(x+2,y+2,w-4,h-4,k==='hall_chair'?'#7c3942':'#ae865c','#493b37');r(x+5,y+5,w-10,Math.max(8,h*.34),k==='hall_chair'?'#b55c61':'#d2ab73');r(x+6,y+h-9,w-12,4,'#493d38');return true;}
  if(k==='teacher_desk'||k==='service_desk'||k==='desk'){plank(x,y,w,h,'#ac7952');monitor(x+w*.45,y+5,Math.min(65,w*.3),Math.min(33,h*.43));page(x+10,y+9,Math.min(55,w*.22),Math.min(34,h*.5));disk(x+w-16,y+12,7,7,'#d2c099');if(k==='service_desk')r(x+10,y+h*.6,w*.25,10,'#86694d');return true;}
  if(k==='reading_table'){plank(x,y,w,h,'#be9569');book(x+w*.35,y+h*.21,Math.max(27,w*.27),Math.max(27,h*.4));r(x+10,y+10,24,21,'#b26856');r(x+w-36,y+10,24,21,'#6e9caf');return true;}
  if(k==='cubicle'){plank(x,y,w,h,'#b5aa92');r(x+4,y-14,w-8,16,'#748d9b');r(x+w*.49,y+3,6,h-7,'#83949d');monitor(x+w*.2,y+8,Math.min(44,w*.33),20);page(x+w*.64,y+11,w*.21,29);return true;}
  if(k==='pc_station'||k==='computer_desk'){plank(x,y,w,h,'#c9af81');monitor(x+w*.26,y+2,Math.min(60,w*.45),Math.min(38,h*.45));r(x+w*.34,y+h*.57,w*.3,6,'#ece5d6');r(x+w*.2,y+h*.8,w*.6,4,'#5f5b53');return true;}
  if(k==='projector'){frame(x,y,w,h,'#e5e4d9','#62696b');r(x+5,y+8,w-10,h-18,'#f3f2e8');for(let i=0;i<3;i++)r(x+8,y+15+i*11,w*.45,2,'#aeb9b1');r(x+w*.5,y+h+1,5,14,'#b29c74');disk(x+w*.5+2,y+h+12,5,5,'#c49a59');return true;}
  if(k==='shelf'||k==='wall_shelf'){
    frame(x,y-(k==='wall_shelf'?6:0),w,h+(k==='wall_shelf'?6:0),'#8a6041','#48372e');
    if(h>w*1.7){for(let row=0;row<Math.max(2,Math.floor(h/35));row++){const yy=y+6+row*35;for(let i=0;i<Math.max(2,Math.floor(w/15));i++)r(x+7+i*15,yy,11,23,['#b65b50','#7290a7','#c0a753','#65a087','#9d7389'][((row+i)%5)]);r(x+5,yy+25,w-10,5,'#513d31');}}
    else{for(let row=0;row<3;row++){const yy=y+8+row*(h-16)/3;for(let i=0;i<Math.floor((w-12)/12);i++)r(x+7+i*12,yy,9,(h-16)/3-6,['#b65b50','#7290a7','#c0a753','#65a087','#9d7389'][((row+i)%5)]);r(x+5,yy+(h-16)/3-4,w-10,4,'#4e372c');}}
    return true;
  }
  if(k==='guestbook'||k==='attendance'||k==='book_pile'||k==='atlas'){shadow();if(k==='book_pile'||k==='atlas'){for(let n=2;n>=0;n--)book(x+3+n*6,y+n*7,Math.max(26,w-14),Math.max(24,h-16),['#816ab1','#64947b','#b27952'][n]);}else book(x,y,w,h,k==='attendance'?'#755b56':'#926247');return true;}
  if(k==='document'){frame(x,y,w,h,'#bb9869','#5e4338');page(x+5,y+3,w-10,h-7);r(x+w*.4,y+2,w*.2,8,'#e7c95c');return true;}
  if(k==='lab_desk') {
    // Top-down science bench with recognizable microscope, glassware and safety mat.
    // Artwork stays within the existing task/collider footprint.
    shadow();frame(x,y,w,h,'#b6c9c3','#455a59');
    r(x+5,y+6,w-10,7,'#f0e7cb');r(x+7,y+h-16,w-14,8,'#506d69');
    const cell=Math.min(62,(w-95)/3);
    for(let n=0;n<3;n++) {
      const fx=x+22+n*cell;
      r(fx-9,y+19,18,23,'#d5e9e7');r(fx-5,y+14,10,6,'#56787f');
      disk(fx,y+46,14,12,['#e2779d','#5aaad0','#e6aa5b'][n]);
      disk(fx,y+39,11,5,'#f3efdf');disk(fx+3,y+45,4,3,'#ffffff7d');
    }
    const mx=x+w-54,my=y+22;
    r(mx+15,my-13,9,35,'#2b4652');r(mx+13,my-15,26,8,'#3b5265');
    r(mx+7,my+6,13,11,'#a8bbc1');disk(mx+11,my+16,8,7,'#233b4b');
    r(mx+1,my+24,48,8,'#395766');r(mx-6,my+34,58,9,'#72898c');
    disk(mx+15,my+9,6,6,'#d8ae65');
    r(x+w*.51,y+h-24,26,16,'#f4e5c6');r(x+w*.53,y+h-20,14,3,'#abac9a');
    return true;
  }
  if(k==='microscope'){shadow();disk(x+w*.55,y+h*.82,w*.44,8,'#596f73');r(x+w*.32,y+h*.66,w*.48,h*.15,'#9eb2b8');r(x+w*.36,y+h*.2,12,h*.48,'#485d67');r(x+w*.25,y+h*.1,w*.36,12,'#3a4b59');r(x+w*.6,y+6,8,h*.3,'#303c47');disk(x+w*.6,y+h*.6,8,8,'#d1aa5d');return true;}
  if(k==='sink'){frame(x,y,w,h,'#e6e7e3','#7c9292');frame(x+9,y+8,w-18,h-17,'#a8c1c5','#67818d');disk(x+w*.5,y+h*.57,4,4,'#4e6975');r(x+w*.46,y+1,6,19,'#899ea5');r(x+w*.46,y+1,19,5,'#899ea5');return true;}
  if(k==='globe'){shadow();disk(x+w*.5,y+h*.43,Math.min(w*.38,24),Math.min(h*.35,24),'#357ea4');disk(x+w*.43,y+h*.42,10,15,'#77a56c');disk(x+w*.61,y+h*.44,7,11,'#9bbb77');ln(x+w*.5,y+h*.09,x+w*.5,y+h*.86,'#d3bb82',3);r(x+w*.28,y+h*.89,w*.44,6,'#926a47');return true;}
  if(k==='collab_table'){shadow();disk(x+w*.5,y+h*.5,w*.29,h*.29,'#704c37');disk(x+w*.5,y+h*.5,w*.26,h*.26,'#c39b68');for(let a=0;a<6;a++){const ang=a*Math.PI/3;disk(x+w*.5+Math.cos(ang)*w*.38,y+h*.5+Math.sin(ang)*h*.36,11,13,'#426380');}page(x+w*.38,y+h*.38,w*.24,h*.24);return true;}
  if(k==='scanner'||k==='printer'){shadow();frame(x,y,w,h,k==='printer'?'#e3e3dc':'#c4d1d6','#6e7780');frame(x+10,y+10,w-20,h*.4,k==='printer'?'#bac8d0':'#a4bbc7');r(x+w*.82,y+6,9,9,'#6c9d8d');page(x+Math.max(8,w*.27),y+h*.6,w*.46,h*.28);return true;}
  if(k==='dispenser'){shadow();frame(x+5,y-9,w-10,h+9,'#cedbd9','#748584');frame(x+11,y-9,w-22,h*.45,'#6eafc5');r(x+w*.37,y+h*.54,6,7,'#447ca6');r(x+w*.58,y+h*.54,6,7,'#aa5450');return true;}
  if(k==='stage'){plank(x,y,w,h,'#986842');for(let i=0;i<w;i+=22)r(x+i,y+h-10,16,7,'#c29a65');return true;}
  if(k==='stage_curtain'){frame(x,y,w,h,'#772a39','#3f2634');for(let i=0;i<w;i+=22)r(x+i,y,12,h,'#a93e50');return true;}
  if(k==='podium'){shadow();frame(x,y,w,h,'#ad8056','#5e3f30');frame(x+8,y+9,w-16,h-19,'#bd975d');page(x+w*.3,y+h*.33,w*.4,h*.25);return true;}
  if(k==='case_board'){frame(x,y-14,w,h+14,'#c6a370','#463b30');for(let i=0;i<5;i++){const xx=x+11+(i%3)*(w-35)/3,yy=y+5+Math.floor(i/3)*Math.max(22,(h-20)/2);page(xx,yy,Math.min(42,(w-35)/3-4),Math.min(35,(h-25)/2));disk(xx+9,yy-2,3,3,'#b4564c');}ln(x+36,y+40,x+w*.66,y+24,'#ad6151',3);return true;}
  if(k==='speaker'){shadow();frame(x,y,w,h,'#26333d','#3f3b3d');disk(x+w*.5,y+h*.27,w*.21,h*.17,'#121d27');disk(x+w*.5,y+h*.7,w*.3,h*.25,'#111d27');disk(x+w*.5,y+h*.7,w*.18,h*.15,'#50637a');return true;}
  // Every other school shape continues through the established v1.4 procedural renderer.
  return false;
}
