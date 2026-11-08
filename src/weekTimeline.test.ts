// @vitest-environment jsdom
import { describe,expect,it } from 'vitest';
import { ACADEMIC_START,ACADEMIC_END,GRID_START,LEGACY_START,LEGACY_WEEK_OFFSET,ACADEMIC_WEEK_COUNT,academicLessonDate,academicWeekOf,shiftLegacyWeek,withinAcademicYear } from './weekTimeline';
import { calendarWeeks } from './calendarMatrixDomain';
import { buildSeed,TEACHERS } from './data';
import { defaultAnnualConfig,solveAnnualVariant } from './yearSolver';
import { lessonDate,WEEK_COUNT,calendarIssues } from './plannerDomain';

describe('one academic-week coordinate system across the KUG and the timetable',()=>{
 it('maps all 53 displayed KUG columns to the corresponding lesson weeks',()=>{
  const weeks=calendarWeeks(2026);
  expect(WEEK_COUNT).toBe(ACADEMIC_WEEK_COUNT);
  expect(weeks.length).toBe(53);
  expect(weeks[0].from).toBe(GRID_START);
  expect(weeks[0].start).toBe(ACADEMIC_START);
  expect(weeks.at(-1)?.end).toBe(ACADEMIC_END);
  for(const w of weeks){
   expect(lessonDate(w.index,0)).toBe(w.from);
   expect(lessonDate(w.index,6)).toBe(w.to);
   expect(academicWeekOf(w.start)).toBe(w.index);
  }
 });
 it('keeps November legacy lessons on their exact dates',()=>{
  expect(LEGACY_WEEK_OFFSET).toBe(10);
  expect(academicLessonDate(LEGACY_WEEK_OFFSET,0)).toBe(LEGACY_START);
  expect(shiftLegacyWeek({week:0,subject:'Математика'}).week).toBe(10);
  expect(shiftLegacyWeek({week:1,subject:'Программирование'}).week).toBe(11);
  const seeded=buildSeed(2);
  expect(seeded.some(x=>x.id==='demo-01'&&x.week===10)).toBe(true);
  expect(seeded.every(x=>x.week!==undefined&&x.week>=10)).toBe(true);
 });
 it('rejects both out-of-year tails of partial calendar weeks',()=>{
  expect(withinAcademicYear('2026-08-31')).toBe(false);
  expect(withinAcademicYear(lessonDate(0,1))).toBe(true);
  expect(withinAcademicYear(lessonDate(52,1))).toBe(true);
  expect(withinAcademicYear(lessonDate(52,2))).toBe(false);
  const sample={id:'check',week:0,day:0,slot:1,groups:['П-21'],teacher:'Тест',room:'101',subject:'Математика',type:'regular' as const,mode:'offline' as const};
  expect(calendarIssues(sample,[]).some(x=>x.includes('за пределами учебного года'))).toBe(true);
 });
 it('plans a lesson in the final August week without leaking into September',()=>{
  const cfg=defaultAnnualConfig();cfg.weeks=53;cfg.days=5;cfg.slotsPerDay=4;
  const calendar=[{id:'late',kind:'study' as const,title:'Поздняя теория',
   from:'2027-08-30',to:'2027-08-31',groups:['П-21']}];
  const demand={id:'august',group:'П-21',teacher:TEACHERS[0],subject:'Математика',
   pairsPerWeek:1,requiredPairs:1,availableWeeks:[52],
   periodAllocations:[{id:'august',weeks:[52],requiredPairs:1}]};
  const variant=solveAnnualVariant([demand],cfg,calendar,0);
  const items=variant.lessons.filter(x=>x.subject==='Математика');
  expect(items).toHaveLength(1);
  expect(items[0].week).toBe(52);
  expect(withinAcademicYear(lessonDate(items[0].week!,items[0].day))).toBe(true);
  expect(variant.unplaced).toHaveLength(0);
 });

});
