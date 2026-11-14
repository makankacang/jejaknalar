import type { ArtObject, Room } from './world';
import { TILE as T } from './world';
import { paintReferenceObject } from './reference-art';
/** Original procedural mock v1.4 artwork; each prop is rendered separately for y-depth. */
export function paintObject(c: CanvasRenderingContext2D, object: ArtObject) {
const hash=(i:number,j:number)=>{let x=Math.imul(i+2437,19797)^Math.imul(j+887,15485863);x=Math.imul(x^(x>>>16),2246822519);return(x>>>0)%1000/1000;};
function box(x:number,y:number,w:number,h:number,color:string){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
function rect(x:number,y:number,w:number,h:number,fill:string,stroke?:string){box(x,y,w,h,fill);if(stroke){c.lineWidth=2;c.strokeStyle=stroke;c.strokeRect(Math.round(x)+1,Math.round(y)+1,Math.round(w)-2,Math.round(h)-2);}}
function drawText(str:string,x:number,y:number,size=14,color='#fff',align:CanvasTextAlign='left',bold=false){c.fillStyle=color;c.font=(bold?'bold ':'')+size+'px system-ui, sans-serif';c.textAlign=align;c.textBaseline='middle';c.fillText(str,x,y);}
function line(x:number,y:number,xx:number,yy:number,color:string,width=2){c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
function ellipse(x:number,y:number,rx:number,ry:number,color:string){c.fillStyle=color;c.beginPath();c.ellipse(x,y,Math.max(0,rx),Math.max(0,ry),0,0,Math.PI*2);c.fill();}
function flower(x:number,y:number,col:string){box(x,y,5,5,col);box(x+1,y-3,3,10,'#659554');box(x-2,y+1,9,3,col);}
function shapeObj(o: ArtObject){const x=o.x*T,y=o.y*T,w=o.w*T,h=o.h*T,k=o.kind;
 // feet-shadow (floor contact)
 if(!['court','school_wing','school_tower','building_sign','window','whiteboard','poster','clock','stage_curtain','screen_board','projector','gate'].includes(k))ellipse(x+w/2,y+h-1,Math.max(10,w*.45),8,'#050e1247');
 if(k==='school_wing'||k==='school_tower'){
  const wallY=y+h*.46;box(x,y,w,h*.5,'#2c475e');for(let i=0;i<w;i+=31){box(x+i,y,24,6,'#45657b');box(x+i+4,y+9,17,3,'#1c354a')};box(x,wallY,w,h*.54,'#ba7770');box(x,wallY,w,12,'#e4b68e');box(x,wallY+11,w,9,'#644d55');box(x,wallY+h*.5-12,w,9,'#684e50');for(let i=34;i<w-35;i+=70){rect(x+i,wallY+38,43,59,'#345c70','#dfb48a');box(x+i+19,wallY+40,5,54,'#a7bfc0');box(x+i+4,wallY+55,35,6,'#a4b4b0')}
  if(k==='school_tower'){box(x-18,y+45,w+36,15,'#e4b88f');box(x+10,wallY+35,w-20,74,'#deb895');box(x+10,wallY+35,w-20,15,'#664f50')}
  return
 }
 if(k==='building_sign'){drawText('SMA JEJAKNALAR',x+w/2,y+25,18,'#fce4b2','center',true);return}
 if(k==='tree'){box(x+w*.44,y+h*.35,w*.18,h*.65,'#78513d');ellipse(x+w*.5,y+h*.4,w*.48,h*.42,'#264e3d');ellipse(x+w*.36,y+h*.28,w*.36,h*.35,'#447e51');ellipse(x+w*.7,y+h*.33,w*.32,h*.31,'#39815b');ellipse(x+w*.46,y+h*.17,w*.28,h*.25,'#66a366');for(let z=0;z<8;z++){const a=z/8*Math.PI*2;ellipse(x+w/2+Math.cos(a)*w*.27,y+h*.3+Math.sin(a)*h*.25,3,3,'#81b477')}return}
 if(k==='garden'){rect(x,y,w,h,'#77573e','#b5a077');box(x+5,y+5,w-10,h-10,'#396b43');for(let z=0;z<12;z++)flower(x+6+hash(z,o.x)*Math.max(4,w-15),y+8+hash(z,o.y)*Math.max(4,h-15),z%3===0?'#efb86e':'#dba1b8');return}
 if(k==='court'){rect(x,y,w,h,'#ae8059','#d5b17e');rect(x+6,y+6,w-12,h-12,'#a76852');c.strokeStyle='#ffdfb5';c.lineWidth=2;c.strokeRect(x+18,y+10,w-36,h-20);line(x+w/2,y+8,x+w/2,y+h-8,'#ffdfb5',2);c.beginPath();c.arc(x+w/2,y+h/2,36,0,7);c.stroke();return}
 if(k==='guard_house'){rect(x,y+20,w,h-20,'#ba8d6c','#5c4b43');box(x-8,y,w+16,26,'#364e55');box(x+15,y+36,65,50,'#274755');box(x+80,y+50,35,65,'#654a41');drawText('SATPAM',x+w/2,y+9,11,'#fff2c8','center',true);return}
 if(k==='flagpole'){box(x+w*.45,y-h*2,6,h*3,'#9cb6ae');box(x+w*.45+6,y-h*2,40,15,'#d44d57');box(x+w*.45+6,y-h*2+15,40,15,'#f9eee0');ellipse(x+w*.45+3,y+h,15,5,'#343c3e');return}
 if(k==='gate'){for(let i=0;i<w;i+=15){box(x+i,y-10,4,50,'#727c75')};box(x,y-10,w,7,'#a89c75');box(x,y+h-6,w,7,'#505d5a');return}
 if(k==='bike_rack'){rect(x,y,w,h,'#84938b');for(let z=0;z<4;z++){const bx=x+15+z*45;ellipse(bx+12,y+35,12,12,'#26343c');ellipse(bx+47,y+35,12,12,'#26343c');line(bx+12,y+35,bx+29,y+18,'#d8c8a6',4);line(bx+29,y+18,bx+47,y+35,'#d8c8a6',4);line(bx+12,y+35,bx+47,y+35,'#d8c8a6',3)}return}
 if(k==='bench'){rect(x,y+7,w,h-7,'#745b46','#382b26');for(let i=4;i<w-4;i+=16){box(x+i,y+10,9,h-18,'#c39760')}return}
 if(k==='notice_board'||k==='map_board'||k==='board'||k==='whiteboard'||k==='poster'||k==='screen_board'){box(x,y-9,w,h+8,k==='screen_board'?'#354854':'#8d7055');box(x+5,y-5,w-10,h-7,k==='screen_board'?'#276778':k==='whiteboard'?'#eaece4':'#e8d8b0');for(let i=0;i<Math.max(1,(w-10)/34);i++){const col=['#bc7362','#7ca5ad','#6f9b75','#c5a568'][i%4];box(x+9+i*30,y+6,23,Math.max(7,h-30),col)}if(k==='screen_board')drawText('RISET • DATA',x+w/2,y+h/2,Math.min(17,w/10),'#d3fff0','center',true);return}
 if(k==='window'){box(x,y,w,h,'#c3ab84');box(x+3,y+4,w-6,h-8,'#6ea9be');for(let i=0;i<w;i+=20)box(x+i,y,3,h,'#e8ddc6');return}
 if(k==='clock'){ellipse(x+w/2,y+h/2,19,19,'#ecdfbd');ellipse(x+w/2,y+h/2,14,14,'#8a7354');line(x+w/2,y+h/2,x+w/2+9,y+h/2-8,'#fff',3);return}
 if(k==='plant'){rect(x+6,y+18,w-12,h-18,'#b47957','#674e3e');ellipse(x+w/2,y+9,w*.49,20,'#3c8553');ellipse(x+w/3,y+6,14,14,'#69ae7c');return}
 if(k==='locker'||k==='cabinet'||k==='archive'){rect(x,y-16,w,h+16,k==='locker'?'#738d9b':'#99775a','#4a4141');for(let col=0;col<Math.max(1,Math.floor(w/38));col++){const xx=x+5+col*40;box(xx,y-10,Math.min(32,w-xx+x-3),h+2,k==='locker'?'#a0b5bb':'#b89366');box(xx+7,y+12,20,4,'#2c444e');box(xx+15,y+35,4,8,'#5c5543')}return}
 if(k==='shelf'||k==='wall_shelf'){rect(x,y-18,w,h+18,'#6c4936','#3e312d');for(let i=0;i<(h>w?h:w);i+=25){if(h>w){box(x+5,y+i-10,w-10,7,'#c99a5c')}else box(x+i,y-13,5,h+10,'#a37b4b')}for(let a=0;a<18;a++){const bx=x+7+((a*19)%(Math.max(20,w-15))),by=y-14+((a*17)%(Math.max(20,h+6)));box(bx,by,6,Math.min(18,h+8),['#d89362','#5b93a9','#789e73','#c3b16d','#a88495'][a%5])}return}
 if(k==='pc_station'||k==='computer_desk'||k==='teacher_desk'||k==='service_desk'||k==='cubicle'||k==='student_desk'||k==='lab_desk'||k==='reading_table'||k==='collab_table'||k==='desk'){
  const wood=k==='lab_desk'?'#a6bfba':k==='computer_desk'?'#879eac':k==='cubicle'?'#b7a18e':'#b88d63';rect(x,y,w,h,wood,'#635043');box(x+5,y+7,w-10,6,'#e3c79f');if(k==='cubicle'){box(x+4,y-18,w-8,21,'#b6bfc2');box(x+w*.48,y+2,6,h-8,'#b4c3c5');box(x+w*.5-20,y+9,34,22,'#3b6470');box(x+w*.5-13,y+12,19,12,'#6bb4bd')}
  else if(k==='pc_station'||k==='computer_desk'){box(x+w*.35,y-12,w*.34,27,'#233d48');box(x+w*.35+5,y-9,w*.34-10,18,'#5fb5b8');box(x+w*.46,y+14,10,9,'#435963');box(x+w*.35,y+24,w*.34,4,'#dcd2b1')}
  else if(k==='lab_desk'){for(let i=0;i<3;i++){box(x+20+i*42,y+5,16,25,['#6c9bac','#d2ab78','#8ab98c'][i]);ellipse(x+28+i*42,y+30,9,4,'#48626c')}}
  else if(k==='service_desk'){box(x+12,y+12,w*.3,18,'#ece1ba');box(x+w*.6,y+12,w*.19,16,'#607f87')}
  else if(k==='student_desk'){box(x+w*.4,y+7,14,20,'#d8e3cc');box(x+8,y+8,12,16,'#567c8c')}
  else if(k==='reading_table'){box(x+w*.35,y+10,18,22,'#e5d2a3');box(x+w*.6,y+15,26,16,'#a4baaa')}
  else if(k==='collab_table'){for(let i=0;i<5;i++){box(x+8+i*48,y+15,35,42,['#e9d49d','#bdd5bf','#acbfce','#edd5c0','#c8d3a3'][i])}}
  return
 }
 if(k==='chair'||k==='hall_chair'){rect(x,y,w,h,'#7c6048','#493b36');box(x+5,y+5,w-10,h*.38,'#b9956d');return}
 if(k==='stage'){rect(x,y,w,h,'#876044','#49352f');for(let i=0;i<w;i+=28)box(x+i,y+h-9,15,9,'#b98a59');return}
 if(k==='stage_curtain'){box(x,y,w,h+20,'#733943');for(let j=0;j<w;j+=30){box(x+j,y,18,h+20,'#a54e55')}return}
 if(k==='podium'){rect(x,y,w,h,'#966a4d','#49352f');box(x+16,y+12,w-32,h-24,'#c49c68');return}
 if(k==='speaker'){rect(x,y,w,h,'#36454b');ellipse(x+w/2,y+h*.35,18,18,'#1b252e');ellipse(x+w/2,y+h*.75,28,28,'#1b252e');return}
 if(k==='guestbook'||k==='book_pile'||k==='attendance'||k==='atlas'){box(x,y,w,h,'#f5dfaf');box(x+6,y+3,w-10,h-8,'#fdf7de');box(x+w*.5,y,3,h,'#b69565');for(let i=10;i<h;i+=9){box(x+9,y+i,w*.34,2,'#9da4a1');box(x+w*.54,y+i,w*.32,2,'#9da4a1')}return}
 if(k==='document'){rect(x,y,w,h,'#b58e68');box(x+7,y+3,w-14,h-8,'#f4e6c8');for(let j=0;j<6;j++)box(x+17,y+11+j*8,w-34,2,j%2?'#bca787':'#a7aa9f');return}
 if(k==='microscope'){box(x+4,y+18,w-8,h-18,'#8ba2a7');box(x+13,y+2,14,21,'#344e5b');box(x+21,y+8,9,25,'#4e6874');return}
 if(k==='sink'){rect(x,y,w,h,'#d9e3dd','#728b8b');box(x+6,y+7,w-12,h-14,'#6d9aa4');ellipse(x+w/2,y+h/2,7,7,'#3e5360');return}
 if(k==='globe'){ellipse(x+w/2,y+h/2,20,20,'#3d8e9a');ellipse(x+w/2-5,y+h/2-5,7,12,'#8cbf75');box(x+w*.5-2,y+h-8,5,12,'#ab8f5c');return}
 if(k==='dispenser'){rect(x,y,w,h,'#aec6c6');box(x+5,y+4,w-10,h*.45,'#5a94a6');return}
 if(k==='extinguisher'){box(x+5,y-11,w-10,h+11,'#c64d43');box(x+6,y-18,15,9,'#c4ba9d');return}
 if(k==='printer'||k==='scanner'){rect(x,y,w,h,'#a8b9bf','#53656d');box(x+8,y+7,w-16,h*.4,'#e8eadf');return}
 if(k==='flagpole')return;
 if(k==='case_board'){rect(x,y-25,w,h+25,'#94633e','#493226');box(x+10,y-13,w-20,h+2,'#ccaa70');for(let j=0;j<6;j++){const xx=x+16+(j%3)*37,yy=y-4+Math.floor(j/3)*36;box(xx,yy,27,30,['#f3e9bf','#c0d5cd','#edc5aa'][j%3]);box(xx+9,yy-3,7,6,'#bd6e55')}return}
 if(k==='projector'){rect(x,y,w,h+3,'#65747b');box(x+6,y+4,w-12,h-7,'#679fac');return}
 if(k==='garden')return;
 rect(x,y,w,h,'#a98968','#614d43');
}

if (!paintReferenceObject(c, object)) shapeObj(object);
}
export function paintFloor(c: CanvasRenderingContext2D, room: Room) {
 const colors:Record<string,[string,string]>={outdoor:['#729968','#7da36e'],corridor:['#bcb7a7','#c8c1ae'],classroom:['#bbad88','#c1b495'],library:['#ab8058','#bc9067'],staff:['#abaeb0','#b5b8b8'],science:['#bed0c7','#a9c4bd'],knowledge:['#9db5c5','#aec7d4'],hall:['#b69273','#c39c7a'],city:['#819780','#879d85']};
 const palette=colors[room.theme]??colors.classroom;
 for(let y=0;y<room.height;y+=T)for(let x=0;x<room.width;x+=T){c.fillStyle=palette[(x/T+y/T)%2];c.fillRect(x,y,T,T);c.fillStyle='#334b3b15';c.fillRect(x,y,T,1);c.fillRect(x,y,1,T);}
 if(room.theme==='outdoor') {c.fillStyle='#c4bba4';c.fillRect(22.5*T,11*T,5*T,23*T);c.fillStyle='#8c9390';c.fillRect(11*T,14*T,23*T,15*T);for(let y=14;y<29;y++)for(let x=11;x<34;x++)if((x+y)%2===0){c.fillStyle='#9ea6a1';c.fillRect(x*T+3,y*T+3,34,34);}}
 for(const wall of room.walls){c.fillStyle=room.theme==='library'?'#a47a56':room.theme==='knowledge'?'#7a98a8':'#b3aa8a';c.fillRect(wall.x,wall.y,wall.width,wall.height);c.fillStyle='#ead1a3';c.fillRect(wall.x,wall.y+wall.height-5,wall.width,5);}
 for(const t of room.targets)if(t.portal){const o=t.portal.opening;c.fillStyle=palette[0];c.fillRect(o.x,o.y,o.width,o.height);}
}
