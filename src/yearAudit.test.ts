import {describe,expect,it} from 'vitest';
import {TEACHERS} from './data';
import type {CalendarEvent,Lesson} from './data';
import {auditAnnualDraft} from './yearAudit';
import type {AnnualApplyScope} from './yearAudit';

const lesson=(id:string,changes:Partial<Lesson>={}):Lesson=>({
 id,week:10,day:0,slot:1,subject:'Математика',teacher:TEACHERS[0],
 groups:['П-21'],room:'109',type:'regular',mode:'offline',hours:2,...changes
});
const scope=(changes:Partial<AnnualApplyScope>={}):AnnualApplyScope=>({
 groups:['П-21'],fromWeek:10,toWeek:10,horizonWeeks:53,publicationStatus:'draft',...changes
});
describe('explicit non-destructive scope for annual timetable',()=>{
 it('refuses an implicit empty scope rather than deleting the year',()=>{
  const current=[lesson('existing')];
  const a=auditAnnualDraft(current,[lesson('generated',{slot:2})],scope({groups:[]}),[],[]);
  expect(a.hardIssues.some(x=>x.lessonId==='scope')).toBe(true);
  expect(a.removed).toBe(0);
  expect(a.next).toEqual(current);
 });
 it('keeps lessons in other groups, weeks, and outside the selected scope',()=>{
  const current=[lesson('target'),lesson('other-group',{groups:['П-22']}),
   lesson('other-week',{week:11})];
  const generated=[lesson('new',{slot:2}),lesson('outside',{week:11,slot:2})];
  const a=auditAnnualDraft(current,generated,scope(),[],[]);
  expect(a.hardIssues).toHaveLength(0);
  expect(a.changed).toBe(1);
  expect(a.removed).toBe(1);
  expect(a.preserved.map(l=>l.id)).toEqual(['other-group','other-week']);
  expect(a.next.map(l=>l.id)).toEqual(['other-group','other-week','new']);
  expect(a.affectedGroups).toEqual(['П-21']);
  expect(a.affectedWeeks).toEqual([10]);
 });
 it('preserves conducted lessons and rejects any collisions with them',()=>{
  const held=lesson('held',{status:'held'}),candidate=lesson('new');
  const a=auditAnnualDraft([held],[candidate],scope(),[],[]);
  expect(a.preserved).toContain(held);
  expect(a.protectedCount).toBe(1);
  expect(a.hardIssues.some(x=>x.reason.includes('Группа'))).toBe(true);
 });
 it('rejects a draft application when the current schedule is published',()=>{
  const current=[lesson('already')];
  const a=auditAnnualDraft(current,[lesson('new',{slot:2})],
   scope({publicationStatus:'published'}),[],[]);
  expect(a.hardIssues.some(x=>x.lessonId==='publication')).toBe(true);
 });
 it('rejects partial replacement of a stream spanning another group',()=>{
  const original=lesson('stream',{type:'stream',groups:['П-21','П-22'],room:'101'});
  const a=auditAnnualDraft([original],[lesson('new',{slot:2})],scope(),[],[]);
  expect(a.hardIssues.some(x=>x.reason.includes('Связанное занятие'))).toBe(true);
  expect(a.next.some(x=>x.id==='stream')).toBe(true);
 });
 it('permits the same stream only when every group is selected',()=>{
  const current=lesson('stream',{type:'stream',groups:['П-21','П-22'],room:'101'});
  const next=lesson('new',{type:'stream',groups:['П-21','П-22'],room:'101',slot:2});
  const a=auditAnnualDraft([current],[next],scope({groups:['П-21','П-22']}),[],[]);
  expect(a.hardIssues).toHaveLength(0);
  expect(a.changed).toBe(1);
 });
 it('keeps practice within its KUG dates but rejects ordinary lessons on practice days',()=>{
  const practice=lesson('practice',{week:11,day:0,subject:'Учебная практика',
   teacher:TEACHERS[1],practiceBlockId:'block-1'});
  const calendar:CalendarEvent[]=[{id:'kug',kind:'practice',title:'Учебная практика',
   from:'2026-11-16',to:'2026-11-20',groups:['П-21']}];
  const s=scope({fromWeek:11,toWeek:11});
  expect(auditAnnualDraft([],[practice],s,calendar,[]).hardIssues).toHaveLength(0);
  expect(auditAnnualDraft([],[lesson('ordinary',{week:11})],s,calendar,[]).hardIssues.length).toBeGreaterThan(0);
 });
 it('checks participant-only teacher clashes and closed rooms in the scoped package',()=>{
  const parallel=lesson('parallel',{type:'parallel',groups:['П-22'],
   teacher:TEACHERS[0],participants:[{group:'П-22',teacher:TEACHERS[1],mode:'offline',room:'110'}],room:'110'});
  const conflict=lesson('generated',{slot:1,teacher:TEACHERS[1]});
  const a=auditAnnualDraft([parallel],[conflict],scope(),[],[]);
  expect(a.hardIssues.some(x=>x.reason.includes('Преподаватель'))).toBe(true);
  const b=auditAnnualDraft([],[lesson('new-room')],scope(),[],['109']);
  expect(b.hardIssues.some(x=>x.reason.includes('закрыта'))).toBe(true);
 });
 it('uses a stable fingerprint that changes after a source edit or calendar update',()=>{
  const current=[lesson('existing')],generated=[lesson('new',{slot:2})];
  const first=auditAnnualDraft(current,generated,scope(),[],[]);
  expect(auditAnnualDraft(current,generated,scope(),[],[]).fingerprint).toBe(first.fingerprint);
  expect(auditAnnualDraft([...current,lesson('added',{week:12})],generated,scope(),[],[]).fingerprint).not.toBe(first.fingerprint);
  expect(auditAnnualDraft(current,generated,scope(),[{id:'holiday',kind:'holiday',title:'Нерабочий',from:'2026-11-09',to:'2026-11-09',groups:[]}],[]).fingerprint).not.toBe(first.fingerprint);
 });
});
