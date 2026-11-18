import {describe,it,expect} from 'vitest';
import {ROOMS,roomId} from './world';
import {markerStatus,resolveGuide,roomRoute,succinctObjective} from './mission-guidance';
describe('PIC D mission guidance option C',()=>{
 it('never directs a locked room as a passable route',()=>{
   const start=roomId('school',0), goal=roomId('school',7);
   expect(roomRoute('school',start,goal,{},false)).toBeNull();
   expect(roomRoute('school',start,goal,{},true)?.at(-1)).toBe(goal);
 });
 it('routes from school corridor to the correct task room through a portal',()=>{
   const from=roomId('school',1), to=roomId('school',3);
   const objective=ROOMS[to].targets.find(t=>t.task==='observe')!;
   const guide=resolveGuide({world:'school',room:from,position:ROOMS[from].spawn,objectiveRoom:to,objectiveTargetId:objective.id,statuses:{observe:'available'},explorer:false});
   expect(guide?.target.kind).toBe('door');expect(guide?.target.to).toBe(to);expect(guide?.viaDoor).toBe(true);
 });
 it('marks exact objects according to state, not furniture appearance',()=>{
   const a=ROOMS[roomId('school',3)].targets.find(t=>t.task==='observe')!;
   expect(markerStatus(a,'observe',{observe:'available'})).toBe('active');
   expect(markerStatus(a,'operate',{observe:'completed'})).toBe('completed');
   expect(markerStatus(a,'observe',{observe:'locked'})).toBe('locked');
   expect(markerStatus(a,'operate',{observe:'available'})).toBe('available');
 });
 it('shortens objectives without renaming task or contract ids',()=>{
   expect(succinctObjective('operate','Panel Lampu','Laboratorium')).toBe('Uji panel lampu · Laboratorium');
 });
});
