import { describe,expect,it } from 'vitest';
import { TEACHERS } from './data';
import type { Lesson, CalendarEvent } from './data';
import { defaultAnnualConfig, solveAnnualVariant, commuteViolations, deriveAnnualDemands, streamKey } from './yearSolver';
import { practicePeriodsFromKug } from './kugPractice';
const lesson=(id:string,slot:number,mode:'offline'|'online',teacher=TEACHERS[0]):Lesson=>({
 id,day:0,slot,week:0,teacher,groups:['П-21'],subject:'Математика',room:mode==='online'?'Онлайн':'109',mode,type:'regular'
});
describe('KUG-driven practice periods',()=>{
 const practice:CalendarEvent={id:'pr',title:'Учебная практика',kind:'practice',periodCode:'training',from:'2026-09-03',to:'2026-09-04',groups:['П-21']};
 it('reads real working dates even in a mixed theory/practice week',()=>{
  const periods=practicePeriodsFromKug([practice],2,5);
  expect(periods).toHaveLength(1);
  expect(periods[0].days).toEqual([3,4]);
  expect(periods[0].phase).toBe('training');
 });
 it('does not invent a classroom, teacher or workload for calendar practice',()=>{
  const cfg=defaultAnnualConfig();cfg.weeks=2;
  const result=solveAnnualVariant([],cfg,[practice],0);
  expect(result.lessons).toHaveLength(0);
  expect(result.requiredHours).toBe(0);
  expect(result.coveredHours).toBe(0);
  expect(result.practicePairs).toBe(0);
  expect(result.practiceIssues).toHaveLength(1);
  expect(result.practiceIssues[0].reason).toContain('Academic Core');
 });
 it('allows theory on available days of the same week',()=>{
  const cfg=defaultAnnualConfig();cfg.weeks=1;cfg.defaultOnlinePct=0;
  const study:CalendarEvent={id:'s',kind:'study',periodCode:'study',title:'Теория',from:'2026-09-01',to:'2026-09-05',groups:['П-21']};
  const demand={id:'math',group:'П-21',teacher:TEACHERS[0],subject:'Математика',requiredPairs:1,pairsPerWeek:1,availableWeeks:[0]};
  const result=solveAnnualVariant([demand],cfg,[study,practice],0);
  expect(result.lessons).toHaveLength(1);
  expect(result.lessons[0].day).toBeGreaterThanOrEqual(1);
  expect(result.lessons[0].day).toBeLessThan(3);
  expect(result.unplaced).toHaveLength(0);
 });
 it('distinguishes production and pre-diploma practice and reports missing assignments',()=>{
  const pp:CalendarEvent={id:'pp',title:'ПП',kind:'practice',periodCode:'industrial',from:'2026-09-01',to:'2026-09-02',groups:['П-21']};
  const pdp:CalendarEvent={id:'pdp',title:'ПДП',kind:'practice',periodCode:'prediploma',from:'2026-09-03',to:'2026-09-04',groups:['П-21']};
  expect(practicePeriodsFromKug([pp,pdp],1,5).map(p=>p.phase)).toEqual(['industrial','prediploma']);
  const result=solveAnnualVariant([],defaultAnnualConfig(),[pp,pdp],0);
  expect(result.practiceIssues.some(x=>x.reason.includes('места прохождения'))).toBe(true);
 });
 it('excludes holiday dates and never transfers a group-specific period to another group',()=>{
  const holiday:CalendarEvent={id:'holiday',title:'Выходной',kind:'holiday',from:'2026-09-03',to:'2026-09-03',groups:[]};
  const periods=practicePeriodsFromKug([practice,holiday],1,5);
  expect(periods).toHaveLength(1);
  expect(periods[0].days).toEqual([4]);
  expect(periods.every(p=>p.group==='П-21')).toBe(true);
 });
});
describe('annual academic streams',()=>{
 it('combines two compatible group demands into one allowed shared teacher meeting',()=>{
  const cfg=defaultAnnualConfig();cfg.weeks=1;cfg.defaultOnlinePct=0;
  const teacher=TEACHERS[1],subject='Математика';
  cfg.allowStreams=[streamKey(teacher,subject)];
  const demands=[
   {id:'P21-math',group:'П-21',teacher,subject,pairsPerWeek:1,requiredPairs:1},
   {id:'P22-math',group:'П-22',teacher,subject,pairsPerWeek:1,requiredPairs:1}
  ];
  const plan=solveAnnualVariant(demands,cfg,[],0);
  expect(plan.streamCount).toBe(1);
  const stream=plan.lessons.find(l=>l.type==='stream');
  expect(stream?.groups).toEqual(['П-21','П-22']);
  expect(plan.placedPairs).toBe(2);
  expect(plan.coveredHours).toBe(4);
  expect(plan.unplaced).toHaveLength(0);
 });
 it('keeps subjects separate if an allowed stream would exceed all physical/equipment limits',()=>{
  const cfg=defaultAnnualConfig();cfg.weeks=1;
  const teacher=TEACHERS[1],subject='Программирование';
  cfg.allowStreams=[streamKey(teacher,subject)];
  const demands=[
   {id:'P21-programming',group:'П-21',teacher,subject,pairsPerWeek:1,requiredPairs:1},
   {id:'P22-programming',group:'П-22',teacher,subject,pairsPerWeek:1,requiredPairs:1}
  ];
  const plan=solveAnnualVariant(demands,cfg,[],0);
  expect(plan.streamCount).toBe(0);
  expect(plan.lessons.filter(l=>l.subject===subject)).toHaveLength(2);
 });
});

describe('Home versus campus changeover',()=>{
 it('requires a free pair for the road and forbids multiple daily location changes',()=>{
  expect(commuteViolations([lesson('a',1,'offline'),lesson('b',2,'online')],1).length).toBeGreaterThan(0);
  expect(commuteViolations([lesson('a',1,'offline'),lesson('b',3,'online')],1)).toHaveLength(0);
  expect(commuteViolations([lesson('a',1,'offline'),lesson('b',3,'online'),lesson('c',5,'offline')],1)).toHaveLength(1);
 });
});
