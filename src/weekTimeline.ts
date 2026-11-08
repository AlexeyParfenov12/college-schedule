/** Canonical academic-week coordinates for 2026/2027.
 * Week 0 starts Monday 2026-08-31; only Sep 1 through Aug 31 are in the academic year.
 * Legacy demo week 0 was 2026-11-09, the canonical week 10.
 * Migration must never alter a calendar date of an existing lesson.
 */
export const ACADEMIC_START='2026-09-01';
export const ACADEMIC_END='2027-08-31';
export const GRID_START='2026-08-31';
export const LEGACY_START='2026-11-09';
export const LEGACY_WEEK_OFFSET=10;
export const ACADEMIC_WEEK_COUNT=53;
const epoch=(date:string)=>Date.parse(date+'T00:00:00.000Z');
const DAY=86400000;
export function academicLessonDate(week:number,weekday:number):string{
 if(!Number.isInteger(week)||!Number.isInteger(weekday))throw Error('Некорректный номер недели или дня');
 return new Date(epoch(GRID_START)+(week*7+weekday)*DAY).toISOString().slice(0,10);
}
export const withinAcademicYear=(date:string)=>date>=ACADEMIC_START&&date<=ACADEMIC_END;
export function academicWeekOf(date:string):number{
 const delta=(epoch(date)-epoch(GRID_START))/DAY;
 if(!Number.isInteger(delta))throw Error('Некорректная дата');
 return Math.floor(delta/7);
}
export const academicWeekOfLegacy=(week:number)=>week+LEGACY_WEEK_OFFSET;
export function shiftLegacyWeek<T extends {week?:number}>(item:T):T{
 return {...item,week:academicWeekOfLegacy(item.week??0)};
}
