/**
 * Read-only dispatcher analysis over existing College Schedule sources.
 * No own academic records, no new persistent store and no automatic publication.
 */
import { ABSENCES, CALENDAR, ROOMS } from './data';
import type { Absence, CalendarEvent, Lesson } from './data';
import { migrateDemoWinterPeriod } from './demoCalendarMigration';
import { validate, occupiedRooms } from './demoLogic';
import { calendarIssues } from './plannerDomain';
import { practicePeriodsFromKug } from './kugPractice';
import { practiceAssignmentProblems } from './practiceAssignments';
import type { AcademicPracticeAssignment } from './practiceAssignments';
import { roomSuggestions } from './scheduleAssist';
import {
 DEFAULT_SUBSTITUTION_POLICY, suggestSubstitutions, applySubstitutionOption
} from './substitutionPlanner';
import type { SubstitutionPolicy } from './substitutionPlanner';
import { LEGACY_WEEK_OFFSET } from './weekTimeline';

export type DispatcherSources={
 calendar:CalendarEvent[];
 absences:Absence[];
 blockedRooms:string[];
 substitutionPolicy:SubstitutionPolicy;
 practiceAssignments:AcademicPracticeAssignment[];
};
export type DecisionKind='absence'|'room'|'collision'|'calendar'|'practice';
export type DecisionTicket={
 id:string;kind:DecisionKind;priority:1|2;title:string;reason:string;
 group:string;teacher?:string;day?:number;slot?:number;lessonId?:string;
 section:'substitutions'|'resources'|'schedule'|'calendar'|'academic';
};
export type DecisionProposal={
 key:string;kind:'substitution'|'room';source:Lesson;after:Lesson;
 title:string;explanation:string;
};
const active=(lesson:Lesson,week:number)=>
 lesson.status!=='cancelled'&&(lesson.week||0)===week;
const normalizeAbsence=(a:Absence):Absence=>({
 ...a,
 from:a.from>=LEGACY_WEEK_OFFSET&&a.from<LEGACY_WEEK_OFFSET+6?a.from-LEGACY_WEEK_OFFSET:a.from,
 to:a.to>=LEGACY_WEEK_OFFSET&&a.to<LEGACY_WEEK_OFFSET+6?a.to-LEGACY_WEEK_OFFSET:a.to,
 week:a.week??LEGACY_WEEK_OFFSET
});
/** Mirrors the existing extras key, but never writes to it. */
export function readDispatcherSources():DispatcherSources{
 let value:unknown={};
 try{
  const raw=localStorage.getItem('college-schedule-extras-v2')||
   localStorage.getItem('college-schedule-extras-v1');
  if(raw)value=JSON.parse(raw);
 }catch{value={}}
 const data=value&&typeof value==='object'?value as Record<string,unknown>:{};
 const calendar=Array.isArray(data.calendar)?data.calendar as CalendarEvent[]:CALENDAR;
 const absences=Array.isArray(data.absences)?data.absences as Absence[]:ABSENCES;
 const rooms=data.rooms&&typeof data.rooms==='object'?data.rooms as Record<string,{blocked?:boolean}>:{};
 const blockedRooms=Object.entries(rooms).filter(([,r])=>r?.blocked).map(([id])=>id);
 const settings=data.substitutionPolicy&&typeof data.substitutionPolicy==='object'?
  data.substitutionPolicy as Partial<SubstitutionPolicy>:{};
 return {
  calendar:migrateDemoWinterPeriod(calendar),
  absences:absences.map(normalizeAbsence),
  blockedRooms,
  substitutionPolicy:{...DEFAULT_SUBSTITUTION_POLICY,...settings},
  practiceAssignments:Array.isArray(data.practiceAssignments)?
   data.practiceAssignments as AcademicPracticeAssignment[]:[]
 };
}
export function decisionTickets(
 lessons:Lesson[],week:number,days:5|6,sources:DispatcherSources
):DecisionTicket[]{
 const weekly=lessons.filter(x=>active(x,week));
 const problems:DecisionTicket[]=[];
 for(const l of weekly){
  const core={group:l.groups.join(' + '),teacher:l.teacher,day:l.day,slot:l.slot,lessonId:l.id};
  const missed=sources.absences.find(a=>a.status==='open'&&(a.week??LEGACY_WEEK_OFFSET)===week&&
   a.teacher===l.teacher&&l.day>=a.from&&l.day<=a.to);
  if(missed){
   problems.push({...core,id:'absence:'+l.id,kind:'absence',priority:1,
    title:'Нет преподавателя · '+l.subject,
    reason:missed.reason+'. Нужен безопасный вариант замены для '+l.groups.join(', ')+
     '. Проведённые занятия нельзя менять.',section:'substitutions'});
   continue;
  }
  const denied=occupiedRooms(l).filter(id=>sources.blockedRooms.includes(id));
  if(denied.length){
   problems.push({...core,id:'room:'+l.id,kind:'room',priority:1,
    title:'Недоступен кабинет '+denied.join(', '),
    reason:'Занятие '+l.subject+' стоит в закрытой аудитории. Проверим свободное подходящее помещение.',
    section:'resources'});
   continue;
  }
  const calendar=calendarIssues(l,sources.calendar,days);
  if(calendar.length){
   problems.push({...core,id:'calendar:'+l.id,kind:'calendar',priority:1,
    title:'Занятие противоречит КУГ',
    reason:calendar.slice(0,2).join('; '),section:'calendar'});
   continue;
  }
  const collisions=validate(l,weekly).filter(x=>x.hard);
  if(collisions.length){
   problems.push({...core,id:'collision:'+l.id,kind:'collision',priority:1,
    title:'Конфликт занятия · '+l.subject,
    reason:collisions.slice(0,2).map(x=>x.message).join('; ')+
     '. Требуется ручная проверка переноса всей связанной пары.',section:'schedule'});
  }
 }
 const periods=practicePeriodsFromKug(sources.calendar,week+1,days).filter(p=>p.week===week);
 for(const period of periods){
  const record=sources.practiceAssignments.find(x=>x.periodId===period.id);
  const issues=practiceAssignmentProblems(period,record,6);
  if(!issues.length)continue;
  problems.push({id:'practice:'+period.id,kind:'practice',priority:2,
   title:'Уточнить назначение практики'+(period.practiceCode?' '+period.practiceCode:''),
   reason:issues.slice(0,2).join('; ')+'. Даты определены в КУГ.',
   group:period.group,section:'academic'});
 }
 return problems.sort((a,b)=>a.priority-b.priority||
  (a.day??7)-(b.day??7)||(a.slot??7)-(b.slot??7)||a.id.localeCompare(b.id,'ru'));
}
/** Proposed changes are generated on request. All options must pass the same checks
 * again immediately before applying; suggestions are not approved changes.
 */
export function decisionProposals(
 ticket:DecisionTicket,lessons:Lesson[],sources:DispatcherSources,days:5|6
):DecisionProposal[]{
 if(!ticket.lessonId||!['absence','room'].includes(ticket.kind))return [];
 const source=lessons.find(x=>x.id===ticket.lessonId);
 if(!source||source.status==='held'||source.status==='cancelled'||source.practiceBlockId)return [];
 if(source.type!=='regular'||source.groups.length!==1||source.participants?.length)return [];
 const allowed=(after:Lesson)=>{
  if(validate(after,lessons).some(i=>i.hard))return false;
  if(calendarIssues(after,sources.calendar,days).length)return false;
  if(occupiedRooms(after).some(id=>sources.blockedRooms.includes(id)))return false;
  return true;
 };
 if(ticket.kind==='absence'){
  return suggestSubstitutions(source,lessons,sources.calendar,sources.absences,
   sources.substitutionPolicy,days,sources.blockedRooms)
   .filter(p=>allowed(p.lesson)).slice(0,4)
   .map(p=>({
    key:'sub:'+p.key,kind:'substitution' as const,source,
    after:applySubstitutionOption(source,p,'подтверждённая учебной частью'),
    title:p.label,explanation:p.explanation
   }));
 }
 if(source.mode!=='offline')return [];
 return roomSuggestions(source,lessons,sources.blockedRooms)
  .filter(o=>o.available).slice(0,24)
  .map(o=>({
   key:'room:'+o.id,kind:'room' as const,source,
   after:{...source,room:o.id,notes:[source.notes,'Кабинет переназначен через Центр решений'].filter(Boolean).join('; ')},
   title:'Кабинет '+o.id,explanation:'Свободен, вместимость '+o.capacity+
    ', компьютеров '+o.pcs+'. Исходное время не меняется.'
  }))
  .filter(o=>allowed(o.after)).slice(0,4);
}
