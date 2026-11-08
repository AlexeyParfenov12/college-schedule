import { describe, expect, it } from 'vitest';
import { CALENDAR } from './data';
import type { CalendarEvent } from './data';
import { assignPeriod, calendarChangeImpact, calendarWeeks, checkCalendar, copyGroupCalendar, importMatrixCSV, matrixCSV, phaseAt, weekCell } from './calendarMatrixDomain';

describe('college academic calendar matrix domain',()=>{
 it('covers the full academic year including partial boundary weeks',()=>{
  const w=calendarWeeks(2026);
  expect(w[0].start).toBe('2026-09-01');
  expect(w.at(-1)?.end).toBe('2027-08-31');
  expect(w).toHaveLength(53);
  expect(w[0].from).toBe('2026-08-31');
  expect(w[0].end).toBe('2026-09-06');
 });
 it('does not mistake an unassigned week for theory',()=>{
  const w=calendarWeeks(2026).find(x=>x.start<='2027-07-05'&&x.end>='2027-07-05')!;
  expect(weekCell(CALENDAR,'П-21',w).phase).toBe('unassigned');
  expect(weekCell(CALENDAR,'П-21',w).unassignedDays).toBeGreaterThan(0);
 });
 it('preserves college defaults while assigning group-specific industrial practice',()=>{
  const next=assignPeriod(CALENDAR,['П-21'],'2026-09-14','2026-09-27','industrial');
  expect(phaseAt(next,'П-21','2026-09-18')).toBe('industrial');
  expect(phaseAt(next,'П-22','2026-09-18')).toBe('study');
  expect(next.find(x=>x.id==='cal-1')).toEqual(CALENDAR.find(x=>x.id==='cal-1'));
 });
 it('trims an edited group period but does not discard unaffected dates',()=>{
  const initial:CalendarEvent[]=[{id:'base',title:'Общий учебный период',kind:'study',
   from:'2026-09-01',to:'2026-10-30',groups:[]},
   {id:'custom',title:'Учебная практика',kind:'practice',periodCode:'training',
    from:'2026-09-07',to:'2026-09-25',groups:['П-21','П-22']}];
  const next=assignPeriod(initial,['П-21'],'2026-09-14','2026-09-18','industrial');
  expect(phaseAt(next,'П-21','2026-09-11')).toBe('training');
  expect(phaseAt(next,'П-21','2026-09-17')).toBe('industrial');
  expect(phaseAt(next,'П-21','2026-09-21')).toBe('training');
  expect(phaseAt(next,'П-22','2026-09-17')).toBe('training');
 });
 it('keeps distinct practice types and detects genuinely mixed weeks',()=>{
  const weeks=calendarWeeks(2026);
  const v=assignPeriod(CALENDAR,['П-21'],'2026-09-01','2026-09-02','training');
  const next=assignPeriod(v,['П-21'],'2026-09-03','2026-09-05','industrial');
  const cell=weekCell(next,'П-21',weeks[0]);
  expect(cell.mixed).toBe(true);
  expect(cell.parts).toContain('training');
  expect(cell.parts).toContain('industrial');
 });
 it('treats an explicit clear as unassigned despite a global study fixture',()=>{
  const events=assignPeriod(CALENDAR,['П-21'],'2026-09-07','2026-09-11','unassigned');
  expect(phaseAt(events,'П-21','2026-09-08')).toBe('unassigned');
  expect(phaseAt(events,'П-22','2026-09-08')).toBe('study');
  expect(checkCalendar(events,['П-21'],calendarWeeks(2026)).length).toBeGreaterThan(0);
 });
 it('exports a structured Excel-compatible CSV without inventing calendar values',()=>{
  const text=matrixCSV(CALENDAR,['П-21'],calendarWeeks(2026));
  expect(text.charCodeAt(0)).toBe(0xFEFF);
  expect(text).toContain('"Группа"');
  expect(text).toContain('"П-21"');
  expect(text).toContain('"Неделя 53');
 });
});

describe('KUG structured CSV import and group copying',()=>{
 it('imports an exact mixed week with day-level codes',()=>{
  const weeks=calendarWeeks(2026);
  const a=assignPeriod(CALENDAR,['П-21'],'2026-09-01','2026-09-02','training');
  const b=assignPeriod(a,['П-21'],'2026-09-03','2026-09-05','industrial');
  const exported=matrixCSV(b,['П-21'],weeks);
  expect(exported).toContain('|');
  const imported=importMatrixCSV(exported,CALENDAR,2026,['П-21']);
  expect(imported.groups).toBe(1);
  expect(phaseAt(imported.next,'П-21','2026-09-02')).toBe('training');
  expect(phaseAt(imported.next,'П-21','2026-09-04')).toBe('industrial');
  expect(phaseAt(imported.next,'П-22','2026-09-04')).toBe('study');
 });
 it('rejects a CSV with the wrong year, unknown group, or ambiguous mixed codes',()=>{
  const correct=matrixCSV(CALENDAR,['П-21'],calendarWeeks(2026));
  expect(()=>importMatrixCSV(correct,CALENDAR,2025,['П-21'])).toThrow(/заголовок|учебный год/i);
  expect(()=>importMatrixCSV(correct,CALENDAR,2026,['П-22'])).toThrow(/Неизвестная группа/);
  expect(()=>importMatrixCSV(correct.replace('"Т"','"Т/УП"'),CALENDAR,2026,['П-21'])).toThrow(/Неизвестный код/);
 });
 it('copies a group to another without overwriting unless explicitly requested',()=>{
  const a=assignPeriod(CALENDAR,['П-21'],'2026-09-14','2026-09-20','industrial');
  const inheritedOnly=copyGroupCalendar(a,'П-21','П-22',2026,false);
  expect(phaseAt(inheritedOnly,'П-22','2026-09-17')).toBe('industrial');
  const customized=assignPeriod(a,['П-22'],'2026-09-14','2026-09-20','vacation');
  const skipped=copyGroupCalendar(customized,'П-21','П-22',2026,false);
  expect(phaseAt(skipped,'П-22','2026-09-17')).toBe('vacation');
  const overwritten=copyGroupCalendar(customized,'П-21','П-22',2026,true);
  expect(phaseAt(overwritten,'П-22','2026-09-17')).toBe('industrial');
  expect(phaseAt(overwritten,'П-21','2026-09-17')).toBe('industrial');
 });
});

describe('calendar validation and actual impact',()=>{
 it('detects contradictory direct group periods without treating normal inherited overrides as conflicts',()=>{
  const weeks=calendarWeeks(2026);
  const exact=assignPeriod(CALENDAR,['П-21'],'2026-11-09','2026-11-14','training');
  const ok=checkCalendar(exact,['П-21'],weeks);
  expect(ok.some(f=>f.message.includes('Конфликт периодов'))).toBe(false);
  const inconsistent=[...exact,{id:'contradictory',title:'Сессия',kind:'exam' as const,
   periodCode:'exam' as const,from:'2026-11-10',to:'2026-11-12',groups:['П-21']}];
  const bad=checkCalendar(inconsistent,['П-21'],weeks);
  expect(bad.some(f=>f.level==='error'&&f.message.includes('Конфликт периодов'))).toBe(true);
 });
 it('counts only lessons made newly incompatible, not every lesson in changed weeks',()=>{
  const lessons=[{id:'lesson-1',week:0,day:0,slot:1,subject:'Математика',teacher:'Тест',
   groups:['П-21'],room:'101',type:'regular' as const,mode:'offline' as const},
   {id:'lesson-2',week:0,day:0,slot:1,subject:'История',teacher:'Тест',
   groups:['П-22'],room:'102',type:'regular' as const,mode:'offline' as const}];
  const after=assignPeriod(CALENDAR,['П-21'],'2026-11-09','2026-11-15','vacation');
  const impact=calendarChangeImpact(CALENDAR,after,lessons,['П-21'],'2026-11-09','2026-11-15');
  expect(impact.affected.map(x=>x.id)).toEqual(['lesson-1']);
  expect(impact.newlyBlocked.map(x=>x.id)).toEqual(['lesson-1']);
  expect(impact.alreadyBlocked).toHaveLength(0);
 });
});
