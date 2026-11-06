import type { CalendarEvent, Lesson } from './data';
import { occupiedRooms, validate } from './demoLogic';
import { calendarIssues } from './plannerDomain';

export type YearAudit={preserved:Lesson[];next:Lesson[];changed:number;removed:number;
 hardIssues:{lessonId:string;reason:string}[];
 advisoryCount:number};
export function auditAnnualDraft(current:Lesson[],generated:Lesson[],weeks:number,calendar:CalendarEvent[],blockedRooms:string[]):YearAudit{
 const preserved=current.filter(x=>x.status==='held'||(x.week||0)>=weeks);
 const removed=current.length-preserved.length;
 const next=[...preserved,...generated];
 const slots=new Map<string,Lesson[]>();
 for(const x of next){
  const key=[x.week||0,x.day,x.slot].join('|');
  const at=slots.get(key);
  if(at)at.push(x);else slots.set(key,[x]);
 }
 const issues:YearAudit['hardIssues']=[];
 let advisoryCount=0;
 for(const x of generated){
  const key=[x.week||0,x.day,x.slot].join('|');
  for(const issue of validate(x,slots.get(key)||[])){
   if(issue.hard)issues.push({lessonId:x.id,reason:issue.message});
   else advisoryCount++;
  }
  for(const message of calendarIssues(x,calendar))issues.push({lessonId:x.id,reason:message});
  for(const id of occupiedRooms(x))if(blockedRooms.includes(id))
   issues.push({lessonId:x.id,reason:'Аудитория '+id+' закрыта'});
 }
 return {preserved,next,changed:generated.length,removed,
  hardIssues:issues.filter((issue,i,all)=>all.findIndex(x=>x.lessonId===issue.lessonId&&x.reason===issue.reason)===i),
  advisoryCount};
}
