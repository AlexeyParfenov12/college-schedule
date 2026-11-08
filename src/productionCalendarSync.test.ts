import { describe,it,expect } from 'vitest';
import { acceptProductionSnapshot, externalDayCode, getProductionState } from './productionCalendarSync';
import { classifyCalendarDay, classifyLocalCalendarDay, productionDiffersFromBaseline } from './productionCalendar';
import { academicWeekOf, academicLessonDate } from './weekTimeline';
import { calendarIssues } from './plannerDomain';
import type { Lesson } from './data';
const yearString=(year:number,days:5|6)=>{
 const last=Date.UTC(year+1,0,1),first=Date.UTC(year,0,1);
 return Array.from({length:(last-first)/86400000},(_,i)=>{
  const date=new Date(first+i*86400000).toISOString().slice(0,10);
  return classifyLocalCalendarDay(date,days).nonWorking?'1':'0';
 }).join('');
};
const packet=(five:string,six:string)=>({version:1 as const,provider:'isdayoff.ru' as const,
 checkedAt:'2026-11-08T15:00:00Z',years:{'2027':{five,six}}});
const iso=(date:string)=>date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6,8);
const replace=(s:string,date:string,value:string)=>{
 const first=Date.UTC(2027,0,1),at=Date.parse(iso(date)+'T00:00:00Z');
 const index=Math.floor((at-first)/86400000);
 return s.slice(0,index)+value+s.slice(index+1);
};
describe('safe automatic production-calendar updates',()=>{
 it('rejects incomplete year data and preserves the hardcoded legal baseline',()=>{
  expect(acceptProductionSnapshot(packet('000','111'))).toBe(false);
  expect(classifyCalendarDay('2027-02-22',5).nonWorking).toBe(true);
  expect(classifyCalendarDay('2027-02-22',6).nonWorking).toBe(false);
 });
 it('applies a new closure to 5/6-day calendars and flags a scheduled lesson',()=>{
  const five=replace(yearString(2027,5),'20270414','1');
  const six=replace(yearString(2027,6),'20270414','1');
  expect(acceptProductionSnapshot(packet(five,six))).toBe(true);
  expect(getProductionState().status).toBe('updated');
  expect(externalDayCode('2027-04-14',5)).toBe('1');
  expect(classifyCalendarDay('2027-04-14',6).nonWorking).toBe(true);
  expect(productionDiffersFromBaseline('2027-04-14',6)).toBe(true);
  const w=academicWeekOf('2027-04-14');
  const l:Lesson={id:'new-closure',week:w,day:2,slot:1,subject:'Математика',teacher:'Преподаватель',
   groups:['П-21'],room:'101',mode:'offline',type:'regular'};
  expect(academicLessonDate(w,2)).toBe('2027-04-14');
  expect(calendarIssues(l,[],6).some(x=>x.includes('Производственный календарь'))).toBe(true);
 });
 it('never silently reopens an existing official holiday when a feed disagrees',()=>{
  const five=replace(yearString(2027,5),'20271105','0');
  const six=yearString(2027,6);
  expect(acceptProductionSnapshot(packet(five,six))).toBe(true);
  expect(classifyCalendarDay('2027-11-05',5).nonWorking).toBe(true);
  expect(classifyCalendarDay('2027-11-05',5).kind).toBe('transfer');
 });
 it('marks a new shortened day but does not block regular teaching',()=>{
  const five=replace(yearString(2027,5),'20270415','2'),six=yearString(2027,6);
  expect(acceptProductionSnapshot(packet(five,six))).toBe(true);
  expect(classifyCalendarDay('2027-04-15',5).kind).toBe('shortened');
  expect(classifyCalendarDay('2027-04-15',5).nonWorking).toBe(false);
 });
});
