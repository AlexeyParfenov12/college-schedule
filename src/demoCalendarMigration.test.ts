import { describe,expect,it } from 'vitest';
import { CALENDAR } from './data';
import type { CalendarEvent } from './data';
import { phaseAt } from './calendarMatrixDomain';
import { migrateDemoWinterPeriod } from './demoCalendarMigration';

const legacy=():CalendarEvent[]=>CALENDAR.map(e=>{
 if(e.id==='cal-1')return {...e,to:'2026-12-28'};
 if(e.id==='cal-2')return {...e,from:'2027-01-11',to:'2027-01-25'};
 if(e.id==='cal-6')return {...e,from:'2027-02-09'};
 if(e.id==='cal-4')return {...e,from:'2027-01-26',to:'2027-02-08'};
 return {...e};
});
describe('January winter-break demo correction and safe browser-data migration',()=>{
 it('puts the winter break in January and leaves February for the spring term',()=>{
  expect(phaseAt(CALENDAR,'П-11','2027-01-13')).toBe('vacation');
  expect(phaseAt(CALENDAR,'П-11','2027-01-20')).toBe('vacation');
  expect(phaseAt(CALENDAR,'П-11','2027-02-02')).toBe('study');
  expect(phaseAt(CALENDAR,'П-11','2026-12-24')).toBe('exam');
 });
 it('reconciles exactly untouched demo periods without destroying other records',()=>{
  const rows=legacy();
  rows.push({id:'custom-group',title:'Индивидуальный период',kind:'practice',
   from:'2027-03-01',to:'2027-03-07',groups:['П-22']});
  const updated=migrateDemoWinterPeriod(rows);
  expect(updated).toHaveLength(rows.length);
  expect(updated.find(e=>e.id==='cal-4')?.from).toBe('2027-01-01');
  expect(updated.find(e=>e.id==='cal-4')?.to).toBe('2027-01-24');
  expect(updated.find(e=>e.id==='cal-2')?.from).toBe('2026-12-21');
  expect(updated.find(e=>e.id==='custom-group')).toEqual(rows.at(-1));
  expect(rows.find(e=>e.id==='cal-4')?.from).toBe('2027-01-26');
  expect(migrateDemoWinterPeriod(updated)).toBe(updated);
 });
 it('preserves an edited winter vacation and other manually changed periods',()=>{
  const customized=legacy().map(e=>e.id==='cal-4'
   ?{...e,from:'2027-01-15',to:'2027-01-31'}:e);
  expect(migrateDemoWinterPeriod(customized)).toBe(customized);
  expect(phaseAt(migrateDemoWinterPeriod(customized),'П-11','2027-01-27')).toBe('vacation');
 });
 it('does not change a calendar imported for a different academic year',()=>{
  const next=[{id:'import-1',title:'Каникулы',kind:'vacation' as const,
   from:'2028-01-01',to:'2028-01-14',groups:['П-11']}];
  expect(migrateDemoWinterPeriod(next)).toBe(next);
 });
});
