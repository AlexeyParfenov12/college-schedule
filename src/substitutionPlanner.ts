/**
 * A college-configurable, pure demo substitution advisor.
 * Academic Core demo assignments authorize subject choices; this does not create approved hours.
 */
import { GROUPS, ROOMS, TEACHERS } from './data';
import type { Lesson, Absence, CalendarEvent } from './data';
import { DEMO_TEACHING_ASSIGNMENTS } from './academicPlanning';
import { calendarIssues } from './plannerDomain';
import { validate, QUALIFICATIONS } from './demoLogic';
import type { Workweek } from './productionCalendar';
import { newWindowsForChange } from './scheduleWindowRules';

export type SubstitutionStrategy='subject-first'|'mixed'|'teacher-only';
export type SubstitutionPolicy={
 strategy:SubstitutionStrategy;
 allowOnline:boolean;
 maxOnlinePercent:number;
 maxOnlinePairsPerDay:number;
 commuteGap:1|2;
};
export const DEFAULT_SUBSTITUTION_POLICY:SubstitutionPolicy={
 strategy:'subject-first',allowOnline:true,maxOnlinePercent:20,maxOnlinePairsPerDay:1,commuteGap:1
};
export type SubstitutionOption={
 key:string;kind:'subject'|'teacher'|'online';lesson:Lesson;label:string;explanation:string;
};
const remote=(l:Lesson)=>l.mode==='online'||l.mode==='async';
const isOnline=(l:Lesson)=>l.mode!=='offline';
const inWeek=(l:Lesson,week:number)=>l.status!=='cancelled'&&(l.week||0)===week;
const absenceCovers=(teacher:string,day:number,absences:Absence[])=>
 absences.some(a=>a.status==='open'&&a.teacher===teacher&&day>=a.from&&day<=a.to);
/** A remote lesson may only sit at an edge of the group's AND remote teacher's timetable,
 * with a genuine vacant travel interval between campus and home.
 */
export function checkOnlineEdge(candidate:Lesson,all:Lesson[],policy:SubstitutionPolicy):string[]{
 const issues:string[]=[];
 const week=candidate.week||0;
 const scopes=[
  {name:'группы',match:(l:Lesson)=>candidate.groups.some(g=>l.groups.includes(g))},
  {name:'преподавателя',match:(l:Lesson)=>l.teacher===candidate.teacher}
 ];
 for(const scope of scopes){
  const day=all.filter(l=>l.id!==candidate.id&&inWeek(l,week)&&l.day===candidate.day&&scope.match(l));
  const ordered=[...day,candidate].sort((a,b)=>a.slot-b.slot);
  const at=ordered.findIndex(l=>l.id===candidate.id);
  if(at!==0&&at!==ordered.length-1)issues.push('Дистант оказался в середине расписания '+scope.name);
  const near=ordered.filter(l=>l.id!==candidate.id&&!remote(l));
  for(const adjacent of near){
   const difference=Math.abs(adjacent.slot-candidate.slot)-1;
   if(difference<policy.commuteGap)issues.push('Нет '+policy.commuteGap+' свободной пары на дорогу у '+scope.name);
  }
  const campusBefore=near.some(l=>l.slot<candidate.slot);
  const campusAfter=near.some(l=>l.slot>candidate.slot);
  if(campusBefore&&campusAfter)issues.push('Дистант между очными занятиями '+scope.name+' запрещён');
  const currentRemote=day.filter(isOnline).length;
  if(currentRemote+1>policy.maxOnlinePairsPerDay)issues.push('Превышено число дистанционных пар в день у '+scope.name);
  const weekly=all.filter(l=>l.id!==candidate.id&&inWeek(l,week)&&scope.match(l));
  const total=weekly.length+1;
  const online=weekly.filter(isOnline).length+1;
  if(online*100>policy.maxOnlinePercent*total)issues.push('Превышена доля дистанта '+policy.maxOnlinePercent+'% у '+scope.name);
 }
 return [...new Set(issues)];
}
export const substitutionOptionKey=(kind:SubstitutionOption['kind'],l:Lesson)=>
 [kind,l.subject,l.teacher,l.mode,l.room].join('|');
/** Existing room is preferred, but a different compatible free room can be suggested.
 * Never treat a teacher absent on the selected day as available for a video lesson.
 */
export function suggestSubstitutions(
 source:Lesson,all:Lesson[],events:CalendarEvent[],absences:Absence[],
 policy:SubstitutionPolicy,workweek:Workweek,blockedRooms:string[]=[]
):SubstitutionOption[]{
 if(source.status==='held'||source.status==='cancelled'||source.replacementOriginal)return [];
 const week=source.week||0;
 if(source.day>=workweek||source.groups.length!==1||source.type!=='regular')return [];
 const group=source.groups[0], result:SubstitutionOption[]=[];
 if(!GROUPS.some(g=>g.id===group))return [];
 const consider=(kind:SubstitutionOption['kind'],subject:string,teacher:string,mode:'offline'|'online',reason:string)=>{
  if(teacher===source.teacher||absenceCovers(teacher,source.day,absences))return;
  const eligibleRooms=mode==='online'?['Онлайн']:
   [...new Set([source.room,...ROOMS.filter(r=>r.active&&!blockedRooms.includes(r.id)).map(r=>r.id)])];
  for(const room of eligibleRooms){
   if(mode==='offline'&&(!ROOMS.some(r=>r.id===room&&r.active)||blockedRooms.includes(room)))continue;
   const proposed:Lesson={...source,subject,teacher,mode,room,participants:undefined,type:'regular'};
   if(validate(proposed,all).some(x=>x.hard))continue;
   if(calendarIssues(proposed,events,workweek).length)continue;
   if(mode==='online'&&checkOnlineEdge(proposed,all,policy).length)continue;
   if(newWindowsForChange(all,source,proposed,policy.commuteGap).length)continue;
   const label=(kind==='online'?'Дистант':kind==='teacher'?'Преподаватель':'Другой предмет')+
    ': '+subject+' · '+teacher+(mode==='online'?'':' · каб. '+room);
   result.push({key:substitutionOptionKey(kind,proposed),kind,lesson:proposed,label,
    explanation:reason+(mode==='online'?' · только край расписания, лимиты и дорога проверены':'')});
   break;
  }
 };
 const allowedSubject=policy.strategy!=='teacher-only';
 if(allowedSubject){
  const assignments=DEMO_TEACHING_ASSIGNMENTS.filter(a=>a.group===group&&a.subject!==source.subject);
  for(const a of assignments){
   // The demo plan is the only allowed course list, not the general SUBJECTS catalog.
   const approvedHours=a.autumnHours+a.springHours;
   const scheduledHours=all.filter(l=>l.id!==source.id&&l.status!=='cancelled'&&l.groups.includes(group)&&l.subject===a.subject).reduce((sum,l)=>sum+(l.hours||2),0);
   if(scheduledHours+(source.hours||2)>approvedHours)continue;
   consider('subject',a.subject,a.teacher,'offline','Учебное назначение '+group+' из демонстрационного Academic Core; исходные часы не закрываются');
   if(policy.allowOnline)consider('online',a.subject,a.teacher,'online','Синхронная онлайн-пара по учебному плану группы; преподаватель доступен');
  }
 }
 if(policy.strategy!=='subject-first'){
  for(const teacher of TEACHERS.filter(t=>t!==source.teacher&&(QUALIFICATIONS[t]||[]).includes(source.subject))){
   consider('teacher',source.subject,teacher,'offline','Квалификация указана в демосправочнике; требует утверждения учебной частью');
   if(policy.allowOnline)consider('online',source.subject,teacher,'online','Онлайн с другим квалифицированным преподавателем');
   if(result.filter(x=>x.kind==='teacher').length>=3)break;
  }
 }
 // Prefer changing the subject in person; remote never silently replaces every missed class.
 const order:Record<SubstitutionOption['kind'],number>=
 policy.strategy==='teacher-only'?{teacher:0,online:1,subject:2}:
 policy.strategy==='mixed'?{subject:0,teacher:1,online:2}:{subject:0,online:1,teacher:2};
 return result.sort((a,b)=>order[a.kind]-order[b.kind]||a.label.localeCompare(b.label,'ru')).filter(
  (option,i,arr)=>arr.findIndex(x=>x.key===option.key)===i
 ).slice(0,8);
}
export function applySubstitutionOption(source:Lesson,option:SubstitutionOption,reason:string):Lesson{
 const candidate=option.lesson;
 return {...candidate,
  replacementFor:source.replacementFor||source.teacher,
  replacementKind:option.kind,
  replacementOriginal:source.replacementOriginal||{
   subject:source.subject,teacher:source.teacher,room:source.room,mode:source.mode,
   type:source.type,notes:source.notes,participants:source.participants
  },
  notes:[source.notes,'Замена ('+reason+'): '+source.subject+' → '+candidate.subject+
   '; исходные часы '+source.subject+' требуют последующего размещения'].filter(Boolean).join('; ')
 };
}
export function revertSubstitution(lesson:Lesson):Lesson{
 const original=lesson.replacementOriginal;
 if(!original)return {...lesson,teacher:lesson.replacementFor||lesson.teacher,replacementFor:undefined,replacementKind:undefined};
 return {...lesson,...original,replacementFor:undefined,replacementKind:undefined,replacementOriginal:undefined};
}
