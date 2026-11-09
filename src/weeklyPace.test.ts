import {describe,expect,it} from 'vitest';
import {TEACHERS} from './data';
import type {CalendarEvent} from './data';
import {splitAcademicHours,cumulativeWeeklyGoal,auditWeeklyPace} from './weeklyPace';
import {defaultAnnualConfig,solveAnnualVariant} from './yearSolver';
const demand={
 id:'period-math',group:'П-21',teacher:TEACHERS[0],subject:'Математика',
 pairsPerWeek:2,requiredPairs:8,requiredHours:16,availableWeeks:[0,1,2,3],
 periodAllocations:[
  {id:'autumn',weeks:[0,1],requiredPairs:3,requiredHours:6,weeklyTargetHours:3},
  {id:'spring',weeks:[2,3],requiredPairs:5,requiredHours:10,weeklyTargetHours:5}
 ]
};
const config=()=>{const cfg=defaultAnnualConfig();cfg.weeks=4;cfg.days=5;cfg.slotsPerDay=6;cfg.defaultOnlinePct=0;return cfg};
describe('soft weekly academic-hour pace',()=>{
 it('splits odd approved hours without rounding to a two-hour pair',()=>{
  expect(splitAcademicHours(3)).toEqual([2,1]);
  expect(splitAcademicHours(5)).toEqual([2,2,1]);
  expect(splitAcademicHours(0)).toEqual([]);
  expect(()=>splitAcademicHours(1.5)).toThrow();
 });
 it('respects exact semester goals at 3 and 5 hours per week',()=>{
  expect(cumulativeWeeklyGoal({id:'autumn',weeks:[0,1],requiredHours:6,weeklyTargetHours:3},0)).toBe(3);
  expect(cumulativeWeeklyGoal({id:'spring',weeks:[2,3],requiredHours:10,weeklyTargetHours:5},3)).toBe(10);
  const result=solveAnnualVariant([demand],config(),[],0);
  expect(result.requiredHours).toBe(16);
  expect(result.coveredHours).toBe(16);
  expect([0,1,2,3].map(w=>result.lessons.filter(l=>l.week===w&&!l.practiceBlockId).reduce((s,l)=>s+(l.hours||2),0))).toEqual([3,3,5,5]);
  expect(result.paceDeviations).toHaveLength(0);
 });
 it('allows uneven weeks and catches up only within the same academic period',()=>{
  const holiday:CalendarEvent={id:'closed',kind:'holiday',from:'2026-09-01',to:'2026-09-05',title:'Учебная неделя закрыта',groups:['П-21']};
  const result=solveAnnualVariant([demand],config(),[holiday],0);
  const totals=[0,1,2,3].map(w=>result.lessons.filter(l=>l.week===w&&!l.practiceBlockId).reduce((s,l)=>s+(l.hours||2),0));
  expect(totals).toEqual([0,6,5,5]);
  expect(result.requiredHours).toBe(16);
  expect(result.coveredHours).toBe(16);
  expect(result.paceDeviations.length).toBeGreaterThan(0);
  expect(result.paceDeviationHours).toBeGreaterThan(0);
 });
 it('can schedule hours earlier than the preferred pace if a later semester week is unavailable',()=>{
  const restricted={...demand,requiredHours:6,requiredPairs:3,availableWeeks:[0,1],
   periodAllocations:[{id:'autumn',weeks:[0,1],requiredHours:6,requiredPairs:3,weeklyTargetHours:3}]};
  const cfg=config();cfg.weeks=2;
  const closed:CalendarEvent={id:'late-closed',kind:'holiday',title:'Поздняя неделя закрыта',
   from:'2026-09-07',to:'2026-09-12',groups:['П-21']};
  const result=solveAnnualVariant([restricted],cfg,[closed],0);
  const totals=[0,1].map(week=>result.lessons.filter(l=>l.week===week&&!l.practiceBlockId)
   .reduce((sum,l)=>sum+(l.hours||2),0));
  expect(totals).toEqual([6,0]);
  expect(result.requiredHours).toBe(6);
  expect(result.coveredHours).toBe(6);
  expect(result.unplaced).toHaveLength(0);
  expect(result.paceDeviations.length).toBeGreaterThan(0);
 });
 it('does not transfer unplaced autumn hours to the spring period',()=>{
  const blocked:CalendarEvent={id:'autumn-closed',kind:'holiday',title:'Закрытая осень',from:'2026-09-01',to:'2026-09-13',groups:['П-21']};
  const result=solveAnnualVariant([demand],config(),[blocked],0);
  const spring=result.lessons.filter(l=>l.week===2||l.week===3).reduce((s,l)=>s+(l.hours||2),0);
  expect(spring).toBe(10);
  expect(result.coveredHours).toBe(10);
  expect(result.unplaced.some(x=>x.reason.includes('Осенний период'))).toBe(true);
 });
 it('reports deviations as warnings rather than a blocking constraint',()=>{
  const period={id:'autumn',weeks:[0,1],requiredHours:6,weeklyTargetHours:3};
  const warnings=auditWeeklyPace([{id:'a',group:'П-21',subject:'Математика',periodAllocations:[period]}],(_,week)=>week===0?2:4);
  expect(warnings).toHaveLength(2);
  expect(warnings[0].deviationHours).toBe(-1);
  expect(warnings[1].deviationHours).toBe(1);
 });
});
