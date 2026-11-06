import { describe,expect,it } from 'vitest';
import { CALENDAR, GROUPS, TEACHERS } from './data';
import type { CalendarEvent } from './data';
import { DEMO_TEACHING_ASSIGNMENTS, academicGroupStats, demoAcademicDemands, demoAcademicHorizon, teachingWeeks, DEMO_SEMESTERS } from './academicPlanning';
import { defaultAnnualConfig, solveAnnualVariant } from './yearSolver';

describe('demo Academic Core adapter: no invented official curriculum',()=>{
 const calendar=CALENDAR;
 it('does not reconstruct academic hours from currently scheduled lessons',()=>{
  const demands=demoAcademicDemands(calendar,5);
  expect(demands).toHaveLength(GROUPS.length*4);
  expect(DEMO_TEACHING_ASSIGNMENTS.every(a=>a.source==='demo-academic-core')).toBe(true);
  expect(demands.every(d=>d.requiredPairs>0&&d.availableWeeks)).toBe(true);
  expect(demands.find(d=>d.group==='П-21'&&d.subject==='Математика')?.requiredPairs).toBe(18);
 });
 it('gets the planning horizon from the last teaching period, not from user-edited required hours',()=>{
  const horizon=demoAcademicHorizon(calendar);
  expect(horizon).toBeGreaterThan(26);
  expect(horizon).toBeLessThan(40);
  const extended=[...calendar,{id:'future',kind:'study' as const,title:'Учебный период',from:'2027-07-01',to:'2027-07-16',groups:[]}];
  expect(demoAcademicHorizon(extended)).toBeGreaterThan(horizon);
 });
 it('reports a group-specific teaching-week count and mock semester-hour summary',()=>{
  const d=demoAcademicDemands(calendar,5);
  const group=academicGroupStats(d,'П-21');
  expect(group.assignments).toBe(4);
  expect(group.plannedHours).toBeGreaterThan(0);
  expect(group.teachingWeeks).toBeGreaterThan(0);
  const subject=d.find(x=>x.group==='П-21'&&x.subject==='Математика')!;
  expect(subject.semesters?.autumnPairs).toBe(5);
  expect(subject.semesters?.springPairs).toBe(13);
  expect(subject.periodAllocations?.reduce((sum,a)=>sum+a.requiredPairs,0)).toBe(subject.requiredPairs);
 });
 it('excludes weeks reserved for a specific group practice without affecting another group',()=>{
  const practiceWeek=3;
  const forPractice=teachingWeeks('П-31',calendar,5,demoAcademicHorizon(calendar),DEMO_SEMESTERS[0]);
  const forOther=teachingWeeks('П-21',calendar,5,demoAcademicHorizon(calendar),DEMO_SEMESTERS[0]);
  expect(forPractice).not.toContain(practiceWeek);
  expect(forOther).toContain(practiceWeek);
 });
 it('retains required hours when a group academic calendar has zero eligible teaching weeks',()=>{
  const noTeaching:CalendarEvent[]=calendar.filter(e=>e.kind!=='study');
  const demands=demoAcademicDemands(noTeaching,5,33);
  const selected=demands.find(d=>d.group==='П-21')!;
  expect(selected.requiredPairs).toBeGreaterThan(0);
  expect(selected.availableWeeks).toHaveLength(0);
 });
});
describe('annual solver respects semester quota and group eligibility',()=>{
 it('does not place second-semester lessons during first-semester academic weeks',()=>{
  const cfg=defaultAnnualConfig();cfg.weeks=3;cfg.days=5;cfg.slotsPerDay=4;
  const demands=[{id:'academic',group:'П-21',teacher:TEACHERS[0],subject:'Математика',
   requiredPairs:2,pairsPerWeek:1,availableWeeks:[0,2],
   periodAllocations:[{id:'autumn',requiredPairs:1,weeks:[0]},{id:'spring',requiredPairs:1,weeks:[2]}]}];
  const result=solveAnnualVariant(demands,cfg,[],0);
  expect(result.unplaced).toHaveLength(0);
  expect(result.lessons.filter(l=>l.subject==='Математика').map(l=>l.week).sort()).toEqual([0,2]);
 });
 it('reports a missing academic period instead of silently discarding its approved hours',()=>{
  const cfg=defaultAnnualConfig();cfg.weeks=3;
  const d={id:'no-study',group:'П-21',teacher:TEACHERS[0],subject:'Математика',
   requiredPairs:2,pairsPerWeek:1,availableWeeks:[],
   periodAllocations:[{id:'autumn',requiredPairs:2,weeks:[]}]};
  const result=solveAnnualVariant([d],cfg,[],0);
  expect(result.lessons).toHaveLength(0);
  expect(result.unplaced[0]?.reason).toMatch(/учебном календаре/);
  expect(result.requiredHours).toBe(4);
  expect(result.coveredHours).toBe(0);
 });
});
