import { describe,it,expect } from 'vitest';
import { classifyCalendarDay, holidayMonth, transfersConfirmed } from './productionCalendar';
import { calendarIssues, previewTemplate } from './plannerDomain';
import { defaultAnnualConfig, solveAnnualVariant } from './yearSolver';
import { TEACHERS } from './data';
import type { Lesson } from './data';

const lesson=(week:number,day:number,subject='Математика'):Lesson=>({
 id:'holiday-test',week,day,slot:1,teacher:TEACHERS[0],groups:['П-21'],
 subject,room:'109',mode:'offline',type:'regular'
});
describe('Russia annual production calendar: Labour Code art.112 and confirmed decrees',()=>{
 it('uses federal holidays on every calendar year including future years',()=>{
  for(const year of [2026,2027,2028,2030,2035]){
   expect(classifyCalendarDay(year+'-01-07',5).kind).toBe('holiday');
   expect(classifyCalendarDay(year+'-02-23',6).nonWorking).toBe(true);
   expect(classifyCalendarDay(year+'-11-04',6).nonWorking).toBe(true);
  }
 });
 it('has separately confirmed 2026 and 2027 federal holiday transfers',()=>{
  expect(transfersConfirmed(2026)).toBe(true);
  expect(transfersConfirmed(2027)).toBe(true);
  expect(transfersConfirmed(2028)).toBe(false);
  expect(classifyCalendarDay('2028-11-06',5).confirmedTransfers).toBe(false);
 });
 it('respects both approved 2026 January transfers only on eligible weekends',()=>{
  expect(classifyCalendarDay('2026-01-09',5).nonWorking).toBe(true);
  expect(classifyCalendarDay('2026-01-09',6).nonWorking).toBe(false);
  expect(classifyCalendarDay('2026-12-31',5).nonWorking).toBe(true);
  expect(classifyCalendarDay('2026-12-31',6).nonWorking).toBe(true);
 });
 it('observes 2027 transfer of 20 February to 22 February for five days only',()=>{
  expect(classifyCalendarDay('2027-02-20',5).kind).toBe('working-weekend');
  expect(classifyCalendarDay('2027-02-22',5).nonWorking).toBe(true);
  expect(classifyCalendarDay('2027-02-22',6).nonWorking).toBe(false);
  expect(classifyCalendarDay('2027-02-20',6).nonWorking).toBe(false);
 });
 it('observes 2027 five-day January transfers but not nonexistent six-day Saturday transfers',()=>{
  expect(classifyCalendarDay('2027-11-05',5).nonWorking).toBe(true);
  expect(classifyCalendarDay('2027-11-05',6).nonWorking).toBe(false);
  expect(classifyCalendarDay('2027-12-31',5).nonWorking).toBe(true);
  expect(classifyCalendarDay('2027-12-31',6).nonWorking).toBe(true);
 });
 it('moves ordinary weekend holidays to the next suitable workday',()=>{
  expect(classifyCalendarDay('2026-03-09',5).nonWorking).toBe(true);
  expect(classifyCalendarDay('2026-03-09',6).nonWorking).toBe(true);
  expect(classifyCalendarDay('2027-05-03',5).nonWorking).toBe(true);
  expect(classifyCalendarDay('2027-05-03',6).nonWorking).toBe(false);
  expect(classifyCalendarDay('2027-06-14',5).nonWorking).toBe(true);
  expect(classifyCalendarDay('2027-06-14',6).nonWorking).toBe(false);
 });
 it('does not incorrectly close ordinary Saturdays for six-day colleges',()=>{
  expect(classifyCalendarDay('2026-11-14',5).nonWorking).toBe(true);
  expect(classifyCalendarDay('2026-11-14',6).nonWorking).toBe(false);
  expect(classifyCalendarDay('2026-11-15',6).nonWorking).toBe(true);
 });
 it('produces a compact user-readable monthly calendar for any chosen year',()=>{
  const march=holidayMonth(2027,3,6);
  expect(march.days).toHaveLength(31);
  expect(march.days.some(d=>d.date==='2027-03-08'&&d.nonWorking)).toBe(true);
  expect(march.confirmedTransfers).toBe(true);
  expect(holidayMonth(2029,2,5).confirmedTransfers).toBe(false);
 });
});
describe('federal rest days are constraints for every scheduling workflow',()=>{
 it('rejects a February 2027 transferred rest day without blocking the six-day college',()=>{
  // February 22, 2027 is a Monday with a confirmed five-day-calendar transfer.
  const candidate=lesson(25,0);
  expect(calendarIssues(candidate,[],5).some(x=>x.includes('Выходной'))).toBe(true);
  expect(calendarIssues(candidate,[],6)).toHaveLength(0);
 });
 it('prevents a template from copying a lesson to a 2026 transferred holiday',()=>{
  // On 2026-12-31 (Thursday) => canonical academic week 17, weekday 3.
  const original=lesson(10,3);
  const preview=previewTemplate([original],{sourceWeek:10,targetStart:17,targetEnd:17,cycle:1,group:'П-21',replace:false,calendar:[],blockedRooms:[]});
  expect(preview.accepted).toHaveLength(0);
  expect(preview.skipped.some(x=>x.reason.includes('Производственный календарь'))).toBe(true);
 });
 it('does not place ordinary lessons on a federal non-working day during annual planning',()=>{
  const cfg=defaultAnnualConfig();cfg.weeks=10;cfg.days=5;cfg.slotsPerDay=4;cfg.activeRooms=['109'];
  const demands=[{id:'test',group:'П-21',teacher:TEACHERS[0],subject:'Математика',pairsPerWeek:1,requiredPairs:10}];
  const result=solveAnnualVariant(demands,cfg,[],0);
  for(const l of result.lessons)expect(calendarIssues(l,[],5)).toHaveLength(0);
 });
 it('does not reserve classrooms for continuous practice on government closed days',()=>{
  const cfg=defaultAnnualConfig();cfg.weeks=18;cfg.days=5;cfg.slotsPerDay=2;
  cfg.practiceBlocks=[{id:'practice',group:'П-21',kind:'college',title:'Учебная практика',
    teacher:TEACHERS[0],startWeek:17,durationWeeks:1,days:[3,4],fromSlot:1,toSlot:1,room:'109'}];
  const result=solveAnnualVariant([],cfg,[],0);
  expect(result.lessons.filter(l=>l.practiceBlockId==='practice').some(l=>l.week===17&&l.day===3)).toBe(false);
  expect(result.practiceIssues.some(i=>i.reason.includes('Практика пересекается'))).toBe(true);
 });
});
