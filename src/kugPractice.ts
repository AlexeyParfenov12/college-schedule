/** KUG alone defines practice dates; Academic Core owns supervisors, workload and locations. */
import { GROUPS } from './data';
import type { CalendarEvent } from './data';
import { phaseAt, periodAt } from './calendarMatrixDomain';
import { lessonDate } from './plannerDomain';
import { classifyCalendarDay } from './productionCalendar';
import type { Workweek } from './productionCalendar';
import { withinAcademicYear } from './weekTimeline';
export type PracticePhase = 'training' | 'industrial' | 'prediploma';
export type KugPracticePeriod = {id:string;group:string;week:number;phase:PracticePhase;practiceCode?:string;days:number[];from:string;to:string};
export const practicePhaseLabel=(phase:PracticePhase)=>phase==='training'?'Учебная практика':phase==='industrial'?'Производственная практика':'Преддипломная практика';
const practicePhase=(phase:string):phase is PracticePhase => phase==='training'||phase==='industrial'||phase==='prediploma';
/** Group/week/phase resolution on exact working dates, including mixed weeks. No fabricated lessons. */
export function practicePeriodsFromKug(events:CalendarEvent[],weeks:number,workweek:Workweek):KugPracticePeriod[]{
 const periods:KugPracticePeriod[]=[];
 for(const group of GROUPS)for(let week=0;week<weeks;week++){
  const byPhase=new Map<string,KugPracticePeriod>();
  for(let day=0;day<workweek;day++){
   const date=lessonDate(week,day);
   if(!withinAcademicYear(date)||classifyCalendarDay(date,workweek).nonWorking)continue;
   if(events.some(e=>e.kind==='holiday'&&e.from<=date&&date<=e.to&&(!e.groups.length||e.groups.includes(group.id))))continue;
   const phase=phaseAt(events,group.id,date);
   if(!practicePhase(phase))continue;
   const practiceCode=periodAt(events,group.id,date)?.practiceCode;
   const key=phase+'|'+(practiceCode||'legacy');
   let current=byPhase.get(key);
   if(!current){current={id:'kug-'+group.id+'-'+week+'-'+key,group:group.id,week,phase,practiceCode,days:[],from:date,to:date};byPhase.set(key,current)}
   current.days.push(day);current.to=date;
  }
  periods.push(...byPhase.values());
 }
 return periods;
}
