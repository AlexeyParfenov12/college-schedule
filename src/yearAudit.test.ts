import { describe,expect,it } from 'vitest';
import type { CalendarEvent, Lesson } from './data';
import { TEACHERS } from './data';
import { auditAnnualDraft } from './yearAudit';
const lesson=(id:string,changes:Partial<Lesson>={}):Lesson=>({id,week:10,day:0,slot:1,
 subject:'Математика',teacher:TEACHERS[0],groups:['П-21'],room:'109',type:'regular',mode:'offline',hours:2,...changes});
describe('safe application of annual timetable variants',()=>{
 it('keeps held lessons and rejects collisions with them',()=>{
  const held=lesson('held',{status:'held'}),candidate=lesson('new',{id:'new'});
  const audit=auditAnnualDraft([held],[candidate],40,[],[]);
  expect(audit.preserved).toContain(held);
  expect(audit.hardIssues.some(x=>x.reason.includes('Группа'))).toBe(true);
  expect(audit.next).toHaveLength(2);
 });
 it('does not wrongly reject linked practice for its own practice-calendar period',()=>{
  const practice=lesson('practice',{week:11,day:0,subject:'Учебная практика',
   teacher:TEACHERS[1],practiceBlockId:'block-1',room:'109'});
  const calendar:CalendarEvent[]=[{id:'period',title:'Учебная практика',kind:'practice',
   from:'2026-11-16',to:'2026-11-20',groups:['П-21']}];
  const audit=auditAnnualDraft([], [practice],40,calendar,[]);
  expect(audit.hardIssues).toHaveLength(0);
 });
 it('protects periods assigned to practice against unlinked normal teaching',()=>{
  const x=lesson('ordinary',{week:11,day:0});
  const calendar:CalendarEvent[]=[{id:'period',title:'Практика',kind:'practice',
   from:'2026-11-16',to:'2026-11-20',groups:['П-21']}];
  expect(auditAnnualDraft([],[x],40,calendar,[]).hardIssues.length).toBeGreaterThan(0);
 });
 it('separates soft computer warnings from hard conflicts',()=>{
  const c=lesson('pc',{subject:'Программирование',room:'109'});
  const audit=auditAnnualDraft([],[c],40,[],[]);
  expect(audit.hardIssues).toHaveLength(0);
  expect(audit.advisoryCount).toBeGreaterThan(0);
 });
 it('preserves assignments outside the chosen horizon, not removing other semesters',()=>{
  const current=lesson('later',{week:39}),generated=lesson('now');
  const audit=auditAnnualDraft([current],[generated],16,[],[]);
  expect(audit.preserved).toContain(current);
  expect(audit.next).toHaveLength(2);
 });
});
