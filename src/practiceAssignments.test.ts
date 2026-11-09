import { describe,expect,it } from 'vitest';
import { TEACHERS } from './data';
import type { Lesson, CalendarEvent } from './data';
import { defaultAnnualConfig, solveAnnualVariant } from './yearSolver';
import { practicePeriodsFromKug } from './kugPractice';
import { practiceAssignmentProblems, practiceMeetings, practicePeriodStamp } from './practiceAssignments';
import type { AcademicPracticeAssignment } from './practiceAssignments';
const cfg=()=>{const c=defaultAnnualConfig();c.days=5;c.weeks=3;c.slotsPerDay=6;return c};
const training:CalendarEvent={id:'training',kind:'practice',periodCode:'training',title:'Учебная практика',
 from:'2026-09-08',to:'2026-09-09',groups:['П-21'],practiceCode:'УП.05.01'};
const allocation=(p:ReturnType<typeof practicePeriodsFromKug>[number],hours=4):AcademicPracticeAssignment=>({
 periodId:p.id,group:p.group,phase:p.phase,supervisor:TEACHERS[0],location:'109',
 approvedHours:hours,startSlot:1,calendarStamp:practicePeriodStamp(p),approved:true
});
describe('Academic Core practice assignment boundary',()=>{
 it('leaves KUG periods without resources unresolved and never fabricates hours or lessons',()=>{
  const p=practicePeriodsFromKug([training],3,5);
  expect(p).toHaveLength(1);
  expect(practiceAssignmentProblems(p[0],undefined,6).length).toBeGreaterThan(0);
  const result=solveAnnualVariant([],cfg(),[training],0);
  expect(result.practicePeriodCount).toBe(1);
  expect(result.practiceUnknownPeriods).toBe(1);
  expect(result.practiceKnownHours).toBe(0);
  expect(result.practiceAssignedHours).toBe(0);
  expect(result.lessons).toHaveLength(0);
  expect(result.practiceIssues).toHaveLength(1);
 });
 it('plans approved UP into actual KUG workdays without counting its hours as theory',()=>{
  const p=practicePeriodsFromKug([training],3,5)[0],a=allocation(p);
  expect(practiceAssignmentProblems(p,a,6)).toEqual([]);
  expect(practiceMeetings(p,a).map(x=>x.day)).toEqual([1,2]);
  const result=solveAnnualVariant([],cfg(),[training],0,[],[a]);
  expect(result.practiceIssues).toHaveLength(0);
  expect(result.practicePairs).toBe(2);
  expect(result.practiceAssignedPeriods).toBe(1);
  expect(result.practiceAssignedHours).toBe(4);
  expect(result.practiceKnownHours).toBe(4);
  expect(result.lessons.every(x=>x.practiceBlockId===p.id)).toBe(true);
  expect(result.requiredHours).toBe(0);
  expect(result.coveredHours).toBe(0);
 });
 it('rejects stale KUG approvals after calendar changed and assignments with unknown rooms',()=>{
  const p=practicePeriodsFromKug([training],3,5)[0],a=allocation(p);
  expect(practiceAssignmentProblems(p,{...a,calendarStamp:'old-date'},6).join(' ')).toMatch(/КУГ изменён/);
  expect(practiceAssignmentProblems(p,{...a,location:'999'},6).join(' ')).toMatch(/аудитория/);
  const result=solveAnnualVariant([],cfg(),[training],0,[],[{...a,calendarStamp:'old-date'}]);
  expect(result.practiceAssignedHours).toBe(0);
  expect(result.practiceIssues).toHaveLength(1);
 });
 it('does not reserve a classroom twice if an already held lesson occupies the same slot',()=>{
  const p=practicePeriodsFromKug([training],3,5)[0],a=allocation(p);
  const held:Lesson={id:'held-1',week:1,day:1,slot:1,groups:['П-21'],teacher:TEACHERS[3],
   subject:'Экзамен',room:'109',type:'regular',mode:'offline',status:'held'};
  const result=solveAnnualVariant([],cfg(),[training],0,[held],[a]);
  expect(result.practiceAssignedHours).toBe(0);
  expect(result.practicePairs).toBe(0);
  expect(result.practiceIssues[0].reason).toMatch(/Занята группа/);
 });
 it('confirms PP/PDP enterprise resources without generating fake classroom sessions',()=>{
  const event:CalendarEvent={id:'pp',kind:'practice',periodCode:'industrial',title:'ПП',
   from:'2026-09-08',to:'2026-09-09',groups:['П-31'],practiceCode:'ПП.02.01'};
  const p=practicePeriodsFromKug([event],3,5)[0];
  const a={...allocation(p,12),location:'Предприятие (подтверждённое место)'};
  const result=solveAnnualVariant([],cfg(),[event],0,[],[a]);
  expect(result.practiceIssues).toHaveLength(0);
  expect(result.practiceAssignedHours).toBe(12);
  expect(result.practicePairs).toBe(0);
  expect(result.lessons).toHaveLength(0);
 });
});
