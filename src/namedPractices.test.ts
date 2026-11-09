import {describe,expect,it} from 'vitest';
import {CALENDAR,GROUPS} from './data';
import {academicPractice,practicesOfPhase} from './academicPracticeCatalog';
import {assignPeriod,calendarWeeks,copyGroupCalendar,importMatrixCSV,matrixCSV,parseCalendarBackup,periodAt,weekCell} from './calendarMatrixDomain';
import {practicePeriodsFromKug} from './kugPractice';
describe('named practices retain a shared Academic Core identity',()=>{
 it('only permits a practice code compatible with UP/PP/PDP phase',()=>{
  expect(practicesOfPhase('training').some(p=>p.code==='УП.05.01')).toBe(true);
  expect(()=>assignPeriod(CALENDAR,['П-21'],'2026-09-01','2026-09-04','industrial',undefined,'УП.05.01')).toThrow();
 });
 it('renders the abbreviated code in KUG data while preserving the full title',()=>{
  const events=assignPeriod(CALENDAR,['П-21'],'2026-09-01','2026-09-05','training',undefined,'УП.05.01');
  const period=periodAt(events,'П-21','2026-09-02');
  expect(period?.practiceCode).toBe('УП.05.01');
  expect(period?.title).toBe(academicPractice('УП.05.01')?.title);
  const cell=weekCell(events,'П-21',calendarWeeks(2026)[0]);
  expect(cell.practiceCodes).toEqual(['УП.05.01']);
 });
 it('keeps two different UP subjects in the same week distinct, including annual solver periods',()=>{
  let events=assignPeriod(CALENDAR,['П-21'],'2026-09-01','2026-09-02','training',undefined,'УП.05.01');
  events=assignPeriod(events,['П-21'],'2026-09-03','2026-09-05','training',undefined,'УП.02.02');
  const cell=weekCell(events,'П-21',calendarWeeks(2026)[0]);
  expect(cell.practiceCodes).toEqual(['УП.05.01','УП.02.02']);
  expect(cell.mixed).toBe(true);
  const periods=practicePeriodsFromKug(events,1,5).filter(p=>p.group==='П-21');
  expect(periods).toHaveLength(2);
  expect(periods.map(p=>p.practiceCode)).toEqual(['УП.05.01','УП.02.02']);
 });
 it('keeps code roundtrip through CSV, JSON backup, and copy between groups',()=>{
  const events=assignPeriod(CALENDAR,['П-21'],'2026-09-08','2026-09-11','industrial',undefined,'ПП.05.01');
  const csv=matrixCSV(events,['П-21'],calendarWeeks(2026));
  expect(csv).toContain('ПП.05.01');
  const imported=importMatrixCSV(csv,CALENDAR,2026,['П-21']);
  expect(periodAt(imported.next,'П-21','2026-09-10')?.practiceCode).toBe('ПП.05.01');
  const backup=parseCalendarBackup(JSON.stringify({academicYear:2026,periods:events}),2026,GROUPS.map(g=>g.id));
  expect(periodAt(backup,'П-21','2026-09-10')?.practiceCode).toBe('ПП.05.01');
  const copied=copyGroupCalendar(events,'П-21','П-22',2026,true);
  expect(periodAt(copied,'П-22','2026-09-10')?.practiceCode).toBe('ПП.05.01');
 });
 it('preserves legacy periods without a code instead of fabricating a practice identity',()=>{
  const old=assignPeriod(CALENDAR,['П-21'],'2026-09-01','2026-09-05','training');
  expect(periodAt(old,'П-21','2026-09-03')?.practiceCode).toBeUndefined();
  expect(practicePeriodsFromKug(old,1,5)[0].practiceCode).toBeUndefined();
 });
});
