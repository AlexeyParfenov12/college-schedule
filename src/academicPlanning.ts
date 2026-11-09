/**
 * Standalone DEMONSTRATION Academic Core adapter.
 *
 * These are invented educational-plan fixtures, not certified curriculum records.
 * They intentionally do not read Lesson[] or infer plans from an existing timetable.
 * Replace this boundary with Academic Core CurriculumSubject + TeachingAssignment API.
 */
import { GROUPS, TEACHERS, CALENDAR } from './data';
import type { CalendarEvent } from './data';
import { phaseAt } from './calendarMatrixDomain';
import { lessonDate } from './plannerDomain';
import { ACADEMIC_WEEK_COUNT } from './weekTimeline';
import { classifyCalendarDay } from './productionCalendar';
import type { Workweek } from './productionCalendar';
import type { YearDemand } from './yearSolver';

type SemesterFixture={id:'autumn'|'spring';title:string;from:string;to:string};
export const DEMO_SEMESTERS:SemesterFixture[]=[
 {id:'autumn',title:'Осенний период (демо)',from:'2026-09-01',to:'2026-12-28'},
 {id:'spring',title:'Весенний период (демо)',from:'2027-02-09',to:'2027-06-25'}
];
const SUBJECTS_BY_DEPARTMENT:Record<string,string[]>={
 'ИТ':['Математика','Программирование','Базы данных','Веб-технологии'],
 'Радиотехника':['Физика','Электротехника','Микропроцессоры','Цифровая схемотехника'],
 'Сети':['Компьютерные сети','Операционные системы','Информационная безопасность','Математика'],
 'Экономика':['Экономика','Менеджмент','Математика','Английский язык']
};
export type DemoTeachingAssignment={
 id:string;group:string;teacher:string;subject:string;
 /** Mock approved hours by academic semester, not a calculation based on existing lessons. */
 autumnHours:number;springHours:number;source:'demo-academic-core';
 autumnWeeklyHours?:number;springWeeklyHours?:number;autumnWeekCount?:number;springWeekCount?:number;
};
export const DEMO_TEACHING_ASSIGNMENTS:DemoTeachingAssignment[]=GROUPS.flatMap((group,index)=>{
 const subjects=SUBJECTS_BY_DEPARTMENT[group.department]||['Математика','Английский язык'];
 return subjects.map((subject,subjectIndex)=>({
  id:'mock-curriculum-'+group.id+'-'+subjectIndex,
  group:group.id,teacher:TEACHERS[(Math.floor(index/2)*7+subjectIndex*11)%TEACHERS.length],
  subject,
  autumnHours:group.id==='П-21'&&subject==='Веб-технологии'?39:([10,12,8,10][subjectIndex]??10),
  springHours:group.id==='П-21'&&subject==='Веб-технологии'?30:([26,24,28,22][subjectIndex]??24),
  ...(group.id==='П-21'&&subject==='Веб-технологии'?{
   autumnWeeklyHours:3,springWeeklyHours:5,autumnWeekCount:13,springWeekCount:6
  }:{}),
  source:'demo-academic-core' as const
 }));
});

function relevant(e:CalendarEvent,group:string,date:string){
 return e.from<=date&&date<=e.to&&(e.groups.length===0||e.groups.includes(group));
}
export function isTeachingDate(date:string,group:string,calendar:CalendarEvent[],workweek:Workweek):boolean{
 if(classifyCalendarDay(date,workweek).nonWorking)return false;
 if(calendar.some(e=>e.kind==='holiday'&&relevant(e,group,date)))return false;
 return phaseAt(calendar,group,date)==='study';
}
/** Returns weeks with at least one permissible lesson day during a fixture semester. */
export function teachingWeeks(group:string,calendar:CalendarEvent[],workweek:Workweek,weeks:number,semester:SemesterFixture){
 const found:number[]=[];
 for(let week=0;week<weeks;week++){
  for(let day=0;day<workweek;day++){
   const date=lessonDate(week,day);
   if(date<semester.from||date>semester.to)continue;
   if(isTeachingDate(date,group,calendar,workweek)){found.push(week);break}
  }
 }
 return found;
}
/** Horizon follows the last declared teaching period, not the number entered by the dispatcher. */
/** The full KUG year remains available even when the last theoretical week is in June.
 * The semester demand adapter still uses only its own expressly stated demo fixtures. */
export function demoAcademicHorizon(_calendar:CalendarEvent[]):number{
 return ACADEMIC_WEEK_COUNT;
}
export function demoAcademicDemands(calendar:CalendarEvent[],workweek:Workweek,weeks=demoAcademicHorizon(calendar)):YearDemand[]{
 const eligibility=new Map<string,{autumn:number[];spring:number[]}>();
 for(const group of GROUPS){
  eligibility.set(group.id,{
   autumn:teachingWeeks(group.id,calendar,workweek,weeks,DEMO_SEMESTERS[0]),
   spring:teachingWeeks(group.id,calendar,workweek,weeks,DEMO_SEMESTERS[1])
  });
 }
 return DEMO_TEACHING_ASSIGNMENTS.map(assignment=>{
  const terms=eligibility.get(assignment.group)!;
  // Explicit demo pacing, inspired by the 13×3 and 6×5 academic-hour workload example.
  const autumnWeeks=assignment.autumnWeekCount?terms.autumn.slice(0,assignment.autumnWeekCount):terms.autumn;
  const springWeeks=assignment.springWeekCount?terms.spring.slice(0,assignment.springWeekCount):terms.spring;
  const allowedWeeks=[...new Set([...autumnWeeks,...springWeeks])].sort((a,b)=>a-b);
  const horizonStart=lessonDate(0,0);
  const horizonEnd=lessonDate(weeks-1,6);
  const overlaps=(semester:SemesterFixture)=>semester.from<=horizonEnd&&semester.to>=horizonStart;
  const autumnHours=overlaps(DEMO_SEMESTERS[0])?assignment.autumnHours:0;
  const springHours=overlaps(DEMO_SEMESTERS[1])?assignment.springHours:0;
  const autumnPairs=autumnHours/2;
  const springPairs=springHours/2;
  return {
   id:assignment.id,group:assignment.group,teacher:assignment.teacher,
   subject:assignment.subject,pairsPerWeek:1,
   requiredPairs:autumnPairs+springPairs,requiredHours:autumnHours+springHours,availableWeeks:allowedWeeks,
   periodAllocations:[
    {id:'autumn',weeks:autumnWeeks,requiredPairs:autumnPairs,requiredHours:autumnHours,weeklyTargetHours:assignment.autumnWeeklyHours},
    {id:'spring',weeks:springWeeks,requiredPairs:springPairs,requiredHours:springHours,weeklyTargetHours:assignment.springWeeklyHours}
   ],
   semesters:{autumnPairs,springPairs}
  };
 });
}
export function academicGroupStats(demands:YearDemand[],group:string){
 const selected=demands.filter(d=>d.group===group);
 return {assignments:selected.length,plannedHours:selected.reduce((sum,d)=>sum+(d.requiredHours??d.requiredPairs*2),0),
  teachingWeeks:new Set(selected.flatMap(d=>d.availableWeeks||[])).size};
}

/** One-time non-destructive migration for previously saved demo academic calendars.
 * Adds a missing spring study period, preserving custom events and later deletions.
 */
export function migrateDemoAcademicCalendar(){
 if(typeof localStorage==='undefined')return;
 const marker='college-academic-fixture-v2-migrated';
 const storage='college-schedule-extras-v1';
 try{
  if(localStorage.getItem(marker)==='done')return;
  const raw=localStorage.getItem(storage);
  if(raw){
   const parsed:unknown=JSON.parse(raw);
   if(parsed&&typeof parsed==='object'&&'calendar' in parsed){
    const data=parsed as {calendar?:CalendarEvent[]};
    if(Array.isArray(data.calendar)&&!data.calendar.some(event=>event.kind==='study'&&event.from>='2027-01-01')){
     const spring=CALENDAR.find(event=>event.id==='cal-6');
     if(spring)localStorage.setItem(storage,JSON.stringify({...parsed,calendar:[...data.calendar,spring]}));
    }
   }
  }
  localStorage.setItem(marker,'done');
 }catch{/** Keep existing browser state if storage is blocked or malformed. */}
}

/**
 * Rename only the old untouched winter demo fixture in browsers that saved it.
 * No dates or group assignments are changed; custom entries are preserved.
 */
export function migrateDemoWinterBreakLabel(){
 if(typeof localStorage==='undefined')return;
 const marker='college-demo-winter-label-v3';
 const storage='college-schedule-extras-v1';
 try{
  if(localStorage.getItem(marker)==='done')return;
  const raw=localStorage.getItem(storage);
  if(raw){
   const parsed:unknown=JSON.parse(raw);
   if(parsed&&typeof parsed==='object'&&'calendar' in parsed){
    const record=parsed as {calendar?:CalendarEvent[]};
    if(Array.isArray(record.calendar)){
     const next=record.calendar.map(item=>item.id==='cal-4'&&item.kind==='vacation'&&item.title==='Зимние каникулы'
      ?{...item,title:'Зимний межсеместровый перерыв'}:item);
     if(next.some((item,index)=>item!==record.calendar![index]))localStorage.setItem(storage,JSON.stringify({...parsed,calendar:next}));
    }
   }
  }
  localStorage.setItem(marker,'done');
 }catch{/* Do not overwrite saved data on storage failures. */}
}
