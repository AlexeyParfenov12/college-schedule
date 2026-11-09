/** Scope-aware, non-destructive preflight for applying the annual solver's proposal.
 * The caller MUST explicitly choose groups and weeks; the default is NO changes.
 * The published schedule is read-only here and must be cloned through a separate
 * authorized workflow before another annual proposal can be applied.
 */
import type { CalendarEvent, Lesson } from './data';
import { occupiedRooms, validate } from './demoLogic';
import { calendarIssues } from './plannerDomain';
import type { Workweek } from './productionCalendar';

export type AnnualApplyScope={
 groups:string[];
 fromWeek:number;
 toWeek:number;
 horizonWeeks:number;
 publicationStatus:'draft'|'published';
};
export type YearAudit={
 preserved:Lesson[];next:Lesson[];changed:number;removed:number;
 protectedCount:number;untouchedCount:number;
 targetCount:number;affectedGroups:string[];affectedWeeks:number[];
 hardIssues:{lessonId:string;reason:string}[];advisoryCount:number;
 fingerprint:string;
};
const weekOf=(l:Lesson)=>l.week||0;
export function annualApplicationFingerprint(current:Lesson[],generated:Lesson[],scope:AnnualApplyScope,
 calendar:CalendarEvent[],blockedRooms:string[],workweek:Workweek):string{
 return JSON.stringify({current,generated,scope,calendar,blockedRooms:[...blockedRooms].sort(),workweek});
}
export function auditAnnualDraft(
 current:Lesson[],generated:Lesson[],scope:AnnualApplyScope,
 calendar:CalendarEvent[],blockedRooms:string[],workweek:Workweek=6
):YearAudit{
 const fingerprint=annualApplicationFingerprint(current,generated,scope,calendar,blockedRooms,workweek);
 const selected=new Set(scope.groups);
 const valid=scope.groups.length>0&&selected.size===scope.groups.length&&
  Number.isInteger(scope.fromWeek)&&Number.isInteger(scope.toWeek)&&
  Number.isInteger(scope.horizonWeeks)&&scope.horizonWeeks>0&&
  scope.fromWeek>=0&&scope.fromWeek<=scope.toWeek&&scope.toWeek<scope.horizonWeeks;
 const issues:YearAudit['hardIssues']=[];
 if(!valid)issues.push({lessonId:'scope',reason:'Укажите явную область: хотя бы одну группу и допустимый диапазон учебных недель'});
 if(scope.publicationStatus==='published')
  issues.push({lessonId:'publication',reason:'Опубликованное расписание защищено: создайте отдельный черновик через утверждённый процесс'});
 const touches=(l:Lesson)=>weekOf(l)>=scope.fromWeek&&weekOf(l)<=scope.toWeek&&l.groups.some(g=>selected.has(g));
 const fullyInside=(l:Lesson)=>l.groups.length>0&&l.groups.every(g=>selected.has(g));
 if(valid){
  const spanning=[...current,...generated].filter(l=>touches(l)&&!fullyInside(l));
  for(const lesson of spanning.slice(0,100))
   issues.push({lessonId:lesson.id,reason:'Связанное занятие выходит за выбранные группы: '+lesson.groups.join(', ')+'. Выберите все группы потока или измените диапазон'});
  if(spanning.length>100)issues.push({lessonId:'scope',reason:'Обнаружено ещё '+(spanning.length-100)+' связанных занятий вне области'});
 }
 const replaceable=(l:Lesson)=>valid&&touches(l)&&fullyInside(l)&&l.status!=='held';
 const preserved=current.filter(l=>!replaceable(l));
 const toAdd=valid?generated.filter(l=>touches(l)&&fullyInside(l)):[];
 const next=[...preserved,...toAdd];
 const protectedCount=current.filter(l=>valid&&touches(l)&&fullyInside(l)&&l.status==='held').length;
 const slots=new Map<string,Lesson[]>();
 for(const l of next){
  const key=[weekOf(l),l.day,l.slot].join('|');
  const arr=slots.get(key)||[];arr.push(l);slots.set(key,arr);
 }
 const seen=new Set<string>();
 for(const l of next){
  if(seen.has(l.id))issues.push({lessonId:l.id,reason:'Дублирующийся идентификатор занятия при применении'});
  seen.add(l.id);
 }
 let advisoryCount=0;
 for(const lesson of toAdd){
  const key=[weekOf(lesson),lesson.day,lesson.slot].join('|');
  for(const issue of validate(lesson,slots.get(key)||[])){
   if(issue.hard)issues.push({lessonId:lesson.id,reason:issue.message});
   else advisoryCount++;
  }
  for(const problem of calendarIssues(lesson,calendar,workweek))
   issues.push({lessonId:lesson.id,reason:problem});
  for(const room of occupiedRooms(lesson))if(blockedRooms.includes(room))
   issues.push({lessonId:lesson.id,reason:'Аудитория '+room+' закрыта'});
 }
 const edited=current.filter(replaceable);
 const target=[...edited,...toAdd];
 return {
  preserved,next,removed:edited.length,changed:toAdd.length,protectedCount,
  untouchedCount:preserved.length-protectedCount,
  targetCount:current.filter(l=>valid&&touches(l)).length,
  affectedGroups:[...new Set(target.flatMap(l=>l.groups))].sort(),
  affectedWeeks:[...new Set(target.map(weekOf))].sort((a,b)=>a-b),
  hardIssues:issues.filter((issue,i,all)=>all.findIndex(x=>x.lessonId===issue.lessonId&&x.reason===issue.reason)===i),
  advisoryCount,fingerprint
 };
}
