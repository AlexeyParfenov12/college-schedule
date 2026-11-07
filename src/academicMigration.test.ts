// @vitest-environment jsdom
import { beforeEach,describe,expect,it } from 'vitest';
import { CALENDAR } from './data';
import { migrateDemoAcademicCalendar, migrateDemoWinterBreakLabel } from './academicPlanning';
const storage='college-schedule-extras-v1';
const marker='college-academic-fixture-v2-migrated';
beforeEach(()=>localStorage.clear());
describe('non-destructive academic demo calendar migration',()=>{
 it('adds the newer spring term once while preserving legacy user-created calendar events',()=>{
  const custom={id:'custom',title:'Собственная практика',kind:'practice',from:'2027-03-01',to:'2027-03-12',groups:['П-21']};
  const old=CALENDAR.filter(x=>x.id!=='cal-6');
  localStorage.setItem(storage,JSON.stringify({calendar:[...old,custom],times:['a','b']}));
  migrateDemoAcademicCalendar();
  const updated=JSON.parse(localStorage.getItem(storage)!) as {calendar:typeof CALENDAR;times:string[]};
  expect(updated.calendar.some(x=>x.id==='cal-6')).toBe(true);
  expect(updated.calendar.some(x=>x.id==='custom')).toBe(true);
  expect(updated.times).toEqual(['a','b']);
  expect(localStorage.getItem(marker)).toBe('done');
 });
 it('never recreates a period that the user deletes after one-time migration',()=>{
  localStorage.setItem(storage,JSON.stringify({calendar:CALENDAR.filter(x=>x.id!=='cal-6')}));
  localStorage.setItem(marker,'done');
  migrateDemoAcademicCalendar();
  const calendar=(JSON.parse(localStorage.getItem(storage)!) as {calendar:typeof CALENDAR}).calendar;
  expect(calendar.some(x=>x.id==='cal-6')).toBe(false);
 });
 it('does not overwrite a customized future study period',()=>{
  const userPeriod={id:'spring-custom',title:'Другой учебный период',kind:'study' as const,from:'2027-03-01',to:'2027-06-15',groups:[]};
  localStorage.setItem(storage,JSON.stringify({calendar:[...CALENDAR.filter(x=>x.id!=='cal-6'),userPeriod]}));
  migrateDemoAcademicCalendar();
  const calendar=(JSON.parse(localStorage.getItem(storage)!) as {calendar:typeof CALENDAR}).calendar;
  expect(calendar.some(x=>x.id==='cal-6')).toBe(false);
  expect(calendar.some(x=>x.id==='spring-custom')).toBe(true);
 });
 it('updates the old winter demo label without changing dates or custom periods',()=>{
  const winter={id:'cal-4',title:'Зимние каникулы',kind:'vacation' as const,
    from:'2027-01-26',to:'2027-02-08',groups:[] as string[]};
  const custom={...winter,id:'my-winter',title:'Мой зимний период'};
  localStorage.setItem(storage,JSON.stringify({calendar:[winter,custom]}));
  migrateDemoWinterBreakLabel();
  const data=JSON.parse(localStorage.getItem(storage)!) as {calendar:typeof winter[]};
  expect(data.calendar[0].title).toBe('Зимний межсеместровый перерыв');
  expect(data.calendar[0].from).toBe('2027-01-26');
  expect(data.calendar[1].title).toBe('Мой зимний период');
  expect(localStorage.getItem('college-demo-winter-label-v3')).toBe('done');
 });
});
