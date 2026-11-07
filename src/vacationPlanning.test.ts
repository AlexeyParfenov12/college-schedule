import { describe,expect,it } from 'vitest';
import { GROUPS,TEACHERS,CALENDAR } from './data';
import type { CalendarEvent,Lesson } from './data';
import { daysInVacation,vacationEvents,vacationsIntersect,vacationImpact } from './vacationPlanning';
import { isTeachingDate,teachingWeeks,DEMO_SEMESTERS } from './academicPlanning';
import { calendarIssues } from './plannerDomain';
import { defaultAnnualConfig,solveAnnualVariant } from './yearSolver';
const v=(groups:string[]):CalendarEvent=>({id:'spring-demo',kind:'vacation',title:'Весенние каникулы',
 from:'2027-03-22',to:'2027-03-28',groups});
describe('Academic vacations and college calendar integration',()=>{
 it('shows only college-wide and own group vacation periods',()=>{
  const calendar=[v(['П-21']),{...v([]),id:'college-vacation',from:'2027-07-01',to:'2027-08-31'}];
  expect(vacationEvents(calendar,'П-21')).toHaveLength(2);
  expect(vacationEvents(calendar,'П-22')).toHaveLength(1);
  expect(vacationsIntersect(calendar,'П-21','2027-03-23','2027-03-25')).toHaveLength(1);
  expect(vacationsIntersect(calendar,'П-22','2027-03-23','2027-03-25')).toHaveLength(0);
  expect(daysInVacation(v(['П-21']))).toBe(7);
 });
 it('blocks theoretical teaching days only for groups selected for vacation',()=>{
  const calendar=[...CALENDAR,v(['П-21'])];
  expect(isTeachingDate('2027-03-23','П-21',calendar,5)).toBe(false);
  expect(isTeachingDate('2027-03-23','П-22',calendar,5)).toBe(true);
  const eligible=teachingWeeks('П-21',calendar,5,40,DEMO_SEMESTERS[1]);
  expect(eligible).not.toContain(19);
 });
 it('rejects scheduled ordinary lessons during group vacations',()=>{
  const l:Lesson={id:'x',week:19,day:1,slot:1,groups:['П-21'],teacher:TEACHERS[0],
   subject:'Математика',room:'109',type:'regular',mode:'offline'};
  expect(calendarIssues(l,[v(['П-21'])],5).some(x=>x.includes('Весенние каникулы'))).toBe(true);
  expect(calendarIssues({...l,groups:['П-22']},[v(['П-21'])],5)).toHaveLength(0);
  expect(vacationImpact(v(['П-21']),[l,{...l,id:'other',groups:['П-22']}])).toBe(1);
 });
 it('annual solver leaves a group on vacation unassigned and schedules another group normally',()=>{
  const cfg=defaultAnnualConfig();cfg.weeks=20;cfg.days=5;cfg.slotsPerDay=3;
  const d=[
   {id:'P21',group:'П-21',teacher:TEACHERS[0],subject:'Математика',requiredPairs:1,pairsPerWeek:1,
    availableWeeks:[19],periodAllocations:[{id:'spring',weeks:[19],requiredPairs:1}]},
   {id:'P22',group:'П-22',teacher:TEACHERS[1],subject:'Математика',requiredPairs:1,pairsPerWeek:1,
    availableWeeks:[19],periodAllocations:[{id:'spring',weeks:[19],requiredPairs:1}]}
  ];
  const result=solveAnnualVariant(d,cfg,[...CALENDAR,v(['П-21'])],0);
  expect(result.lessons.filter(x=>x.groups.includes('П-21'))).toHaveLength(0);
  expect(result.lessons.filter(x=>x.groups.includes('П-22'))).toHaveLength(1);
  expect(result.unplaced.some(x=>x.group==='П-21')).toBe(true);
 });
 it('leaves multi-week practice unplaced on group vacation days rather than scheduling it anyway',()=>{
  const cfg=defaultAnnualConfig();cfg.weeks=20;cfg.days=5;cfg.slotsPerDay=2;
  cfg.practiceBlocks=[{id:'practice-spring',group:'П-21',kind:'college',title:'Учебная практика',
   teacher:TEACHERS[0],startWeek:19,durationWeeks:1,days:[0,1,2,3,4],fromSlot:1,toSlot:1,room:'109'}];
  const result=solveAnnualVariant([],cfg,[v(['П-21'])],0);
  expect(result.practicePairs).toBe(0);
  expect(result.practiceIssues.some(x=>x.reason.includes('каникулами'))).toBe(true);
 });

});
