import { describe, it, expect } from 'vitest';
import { TEACHERS } from './data';
import type { Lesson, CalendarEvent } from './data';
import { idleWindows, newWindowsForChange } from './scheduleWindowRules';
import { previewBulkFormat } from './bulkFormatPlanning';
import { DEFAULT_SUBSTITUTION_POLICY, checkOnlineEdge } from './substitutionPlanner';
const base=(id:string,slot:number,teacher=TEACHERS[0],group='П-21',mode:Lesson['mode']='offline',week=10):Lesson=>({
 id,week,day:0,slot,teacher,groups:[group],subject:'Математика',room:mode==='online'?'Онлайн':'109',
 type:'regular',mode,hours:2
});
const rules={...DEFAULT_SUBSTITUTION_POLICY,maxOnlinePercent:100,maxOnlinePairsPerDay:2};
const selection=(groups=['П-21'])=>({week:10,groups,fromDay:0,toDay:0,mode:'online' as const});
const audit=(lessons:Lesson[],groups=['П-21'],policy=rules,calendar:CalendarEvent[]=[])=>previewBulkFormat(lessons,calendar,[],policy,6,selection(groups));

describe('schedule windows and travel',()=>{
 it('counts empty timetable pairs but not the required home/campus journey',()=>{
  const first=base('a',1),last=base('b',3);
  expect(idleWindows([first,last],1)).toBe(1);
  expect(idleWindows([first,{...last,mode:'online',room:'Онлайн'}],1)).toBe(0);
 });
 it('rejects an incoming teacher assignment that creates a new window',()=>{
  const source=base('source',3,TEACHERS[0]);
  const first=base('teacher-early',1,TEACHERS[2],'П-22');
  const replacement={...source,teacher:TEACHERS[2]};
  expect(newWindowsForChange([source,first],source,replacement).some(x=>x.includes('преподавателя'))).toBe(true);
  expect(newWindowsForChange([source,{...first,slot:2}],source,replacement)).toEqual([]);
 });
 it('rejects a remote pair between in-person lessons or without travel time',()=>{
  const candidate=base('source',2,TEACHERS[0],'П-21','online');
  const other=[base('a',1,TEACHERS[1]),base('b',3,TEACHERS[2])];
  expect(checkOnlineEdge(candidate,other,rules).join(' ')).toMatch(/середине|дорогу/);
 });
});
describe('bulk format preview (never applies automatically)',()=>{
 it('allows a remote first pair when the next onsite class has a journey gap',()=>{
  const proposed=base('a',1),onsite=base('b',3,TEACHERS[1]);
  const preview=audit([proposed,onsite]);
  expect(preview.accepted.map(x=>x.id)).toContain('a');
  expect(preview.accepted.every(x=>x.mode==='online')).toBe(true);
  expect(proposed.mode).toBe('offline');
 });
 it('rejects a remote pair immediately before an onsite class',()=>{
  const preview=audit([base('a',1),base('b',2,TEACHERS[1])]);
  expect(preview.blocked.some(x=>x.lesson.id==='a'&&x.reason.includes('дорогу'))).toBe(true);
 });
 it('enforces percentage cap even when the edge and travel conditions are satisfied',()=>{
  const preview=audit([base('a',1),base('b',3,TEACHERS[1])],['П-21'],DEFAULT_SUBSTITUTION_POLICY);
  expect(preview.blocked.some(x=>x.lesson.id==='a'&&x.reason.includes('доля дистанта'))).toBe(true);
 });
 it('never changes held classes or only a portion of shared streams',()=>{
  const held={...base('done',1),status:'held' as const};
  const shared={...base('shared',2),type:'stream' as const,groups:['П-21','П-22']};
  const preview=audit([held,shared],['П-21']);
  expect(preview.accepted).toHaveLength(0);
  expect(preview.blocked.find(x=>x.lesson.id==='done')?.reason).toContain('Проведённое');
  expect(preview.blocked.find(x=>x.lesson.id==='shared')?.reason).toContain('Общий поток');
 });
 it('validates every selected group in a multi-group change',()=>{
  const a=base('a',1,TEACHERS[0],'П-21'),b=base('b',1,TEACHERS[1],'П-22');
  const preview=audit([a,b],['П-21','П-22']);
  expect(preview.considered).toBe(2);
  expect(preview.accepted.every(l=>['П-21','П-22'].includes(l.groups[0]))).toBe(true);
 });
 it('cannot turn absence into an online lecture or silently create asynchronous work',()=>{
  const a=base('a',1);
  const absent=previewBulkFormat([a],[],[{id:'abs',teacher:TEACHERS[0],from:0,to:0,status:'open',reason:'Больничный'}],rules,6,selection());
  expect(absent.blocked[0]?.reason).toMatch(/отсутствует/);
  const async=previewBulkFormat([a],[],[],rules,6,{...selection(),mode:'async'});
  expect(async.blocked[0]?.reason).toMatch(/LMS/);
 });
});
