import {describe,expect,it} from 'vitest';
import {canRecordDocument, readingComplete, recordPage} from './readable-evidence';
describe('narrative evidence reader (PIC D local only)',()=>{
 it('records unique page indices but never fabricates unseen pages',()=>{
  expect(recordPage([],0,3)).toEqual([0]);
  expect(recordPage([0],1,3)).toEqual([0,1]);
  expect(recordPage([0,1],1,3)).toEqual([0,1]);
  expect(recordPage([0,1],4,3)).toEqual([0,1]);
 });
 it('only all visited pages allow closing as a completed book',()=>{
  expect(readingComplete(3,[0,1])).toBe(false);
  expect(readingComplete(3,[2,0,1])).toBe(true);
  expect(readingComplete(3,[])).toBe(false);
  expect(readingComplete(0,[])).toBe(false);
 });
 it('a C04 source closes as read only after its final page',()=>{
  expect(canRecordDocument(0,1)).toBe(false);
  expect(canRecordDocument(1,1)).toBe(true);
  expect(canRecordDocument(0,2)).toBe(false);
 });
});
