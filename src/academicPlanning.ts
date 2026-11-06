/**
 * Standalone DEMONSTRATION Academic Core adapter.
 *
 * These are invented educational-plan fixtures, not certified curriculum records.
 * They intentionally do not read Lesson[] or infer plans from an existing timetable.
 * Replace this boundary with Academic Core CurriculumSubject + TeachingAssignment API.
 */
import { GROUPS, TEACHERS } from './data';
import type { CalendarEvent } from './data';
import { lessonDate, WEEK_COUNT } from './plannerDomain';
import { classifyCalendarDay } from './productionCalendar';
import type { Workweek } from './productionCalendar';
import type { YearDemand } from './yearSolver';

type SemesterFixture={id:'autumn'|'spring';title:string;from:string;to:string};
export const DEMO_SEMESTERS:SemesterFixture[]=[
 {id:'autumn',title:'Осенний период (демо)',from:'2026-11-09',to:'2026-12-28'},
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
};
export const DEMO_TEACHING_ASSIGNMENTS:DemoTeachingAssignment[]=GROUPS.flatMap((group,index)=>{
 const subjects=SUBJECTS_BY_DEPARTMENT[group.department]||['Математика','Английский язык'];
 return subjects.map((subject,subjectIndex)=>({
  id:'mock-curriculum-'+group.id+'-'+subjectIndex,
  group:group.id,teacher:TEACHERS[(Math.floor(index/2)*7+subjectIndex*11)%TEACHERS.length],
  subject,
  autumnHours:[10,12,8,10][subjectIndex]??10,
  springHours:[26,24,28,22][subjectIndex]??24,
  source:'demo-academic-core' as const
 }));
});

function relevant(e:CalendarEvent,group:string,date:string){
 return e.from<=date&&date<=e.to&&(e.groups.length===0||e.groups.includes(group));
}
export function isTeachingDate(date:string,group:string,calendar:CalendarEvent[],workweek:Workweek):boolean{
 if(classifyCalendarDay(date,workweek).nonWorking)return false;
 const study=calendar.filter(e=>e.kind==='study'&&(e.groups.length===0||e.groups.includes(group)));
 if(!study.length||!study.some(e=>relevant(e,group,date)))return false;
 return !calendar.some(e=>e.kind!=='study'&&relevant(e,group,date));
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
export function demoAcademicHorizon(calendar:CalendarEvent[]):number{
 const study=calendar.filter(e=>e.kind==='study');
 if(!study.length)return WEEK_COUNT;
 const first=new Date(lessonDate(0,0)+'T00:00:00Z').getTime();
 const last=Math.max(...study.map(e=>new Date(e.to+'T00:00:00Z').getTime()).filter(Number.isFinite));
 if(!Number.isFinite(last))return WEEK_COUNT;
 return Math.max(1,Math.min(WEEK_COUNT,Math.ceil((last-first+86400000)/(86400000*7))));
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
  const allowedWeeks=[...new Set([...terms.autumn,...terms.spring])].sort((a,b)=>a-b);
  const horizonStart=lessonDate(0,0);
  const horizonEnd=lessonDate(weeks-1,6);
  const overlaps=(semester:SemesterFixture)=>semester.from<=horizonEnd&&semester.to>=horizonStart;
  const autumnPairs=overlaps(DEMO_SEMESTERS[0])?assignment.autumnHours/2:0;
  const springPairs=overlaps(DEMO_SEMESTERS[1])?assignment.springHours/2:0;
  return {
   id:assignment.id,group:assignment.group,teacher:assignment.teacher,
   subject:assignment.subject,pairsPerWeek:1,
   requiredPairs:autumnPairs+springPairs,availableWeeks:allowedWeeks,
   periodAllocations:[
    {id:'autumn',weeks:terms.autumn,requiredPairs:autumnPairs},
    {id:'spring',weeks:terms.spring,requiredPairs:springPairs}
   ],
   semesters:{autumnPairs,springPairs}
  };
 });
}
export function academicGroupStats(demands:YearDemand[],group:string){
 const selected=demands.filter(d=>d.group===group);
 return {assignments:selected.length,plannedHours:selected.reduce((sum,d)=>sum+d.requiredPairs*2,0),
  teachingWeeks:new Set(selected.flatMap(d=>d.availableWeeks||[])).size};
}
