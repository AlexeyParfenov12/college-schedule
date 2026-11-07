import type { CalendarEvent, Lesson } from './data';
import { lessonDate } from './plannerDomain';
export type VacationLabel='Осенние каникулы'|'Зимние каникулы'|'Весенние каникулы'|'Летние каникулы';
export const VACATION_LABELS:VacationLabel[]=['Осенние каникулы','Зимние каникулы','Весенние каникулы','Летние каникулы'];
export const vacationEvents=(events:CalendarEvent[],group?:string)=>events.filter(e=>e.kind==='vacation'&&(!group||e.groups.length===0||e.groups.includes(group))).sort((a,b)=>a.from.localeCompare(b.from));
export const vacationsIntersect=(events:CalendarEvent[],group:string,from:string,to:string)=>
 vacationEvents(events,group).filter(e=>e.from<=to&&from<=e.to);
export function daysInVacation(event:CalendarEvent):number{
 const from=Date.parse(event.from+'T00:00:00Z'),to=Date.parse(event.to+'T00:00:00Z');
 return Number.isFinite(from)&&Number.isFinite(to)&&to>=from?Math.floor((to-from)/86400000)+1:0;
}
export function vacationImpact(event:CalendarEvent,lessons:Lesson[]){
 if(!event.from||!event.to||event.to<event.from)return 0;
 return lessons.filter(l=>l.status!=='cancelled'&&
  (event.groups.length===0||l.groups.some(g=>event.groups.includes(g)))&&
  lessonDate(l.week||0,l.day)>=event.from&&lessonDate(l.week||0,l.day)<=event.to).length;
}
