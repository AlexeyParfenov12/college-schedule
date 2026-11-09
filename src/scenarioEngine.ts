/**
 * Isolated "what if?" timetable sandbox.
 * Scenario inputs never modify Academic Core, KUG, absences or room registry.
 * Only validated, explicitly approved lesson diffs can be passed to the existing draft editor.
 */
import { ROOMS } from './data';
import type { Lesson, Absence } from './data';
import { validate, occupiedRooms } from './demoLogic';
import { assessRoomFit } from './roomPolicy';
import { calendarIssues } from './plannerDomain';
import { roomSuggestions } from './scheduleAssist';
import { idleWindows } from './scheduleWindowRules';
import { suggestSubstitutions, applySubstitutionOption } from './substitutionPlanner';
import type { DispatcherSources } from './decisionCenterDomain';

export type ScenarioKind='room'|'building'|'teacher';
export type ScenarioStrategy='minimal'|'compact'|'onsite';
export type ScenarioInput={
 kind:ScenarioKind;week:number;room:string;building?:string;teacher:string;fromDay:number;toDay:number;
};
export type ScenarioChange={before:Lesson;after:Lesson;reason:string};
export type ScenarioUnresolved={lesson:Lesson;reason:string};
export type ScenarioMetrics={
 affected:number;modified:number;untouched:number;unresolved:number;
 groupWindowsBefore:number;groupWindowsAfter:number;
 teacherWindowsBefore:number;teacherWindowsAfter:number;
 onlineBefore:number;onlineAfter:number;replanHours:number;
 groups:string[];teachers:string[];
};
export type ScenarioVariant={
 id:ScenarioStrategy;title:string;description:string;
 changes:ScenarioChange[];unresolved:ScenarioUnresolved[];
 metrics:ScenarioMetrics;signature:string;complete:boolean;
};
export type ScenarioResult={
 signature:string;affected:Lesson[];variants:ScenarioVariant[];issues:string[];
};
const active=(l:Lesson,week:number)=>l.status!=='cancelled'&&(l.week||0)===week;
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export function scenarioSignature(
 lessons:Lesson[],input:ScenarioInput,sources:DispatcherSources,days:5|6
):string{
 const weekly=lessons.filter(x=>(x.week||0)===input.week);
 return JSON.stringify({input,days,weekly,sources});
}
export function scenarioAffected(lessons:Lesson[],input:ScenarioInput):Lesson[]{
 return lessons.filter(l=>active(l,input.week)&&l.day>=input.fromDay&&l.day<=input.toDay&&
  (input.kind==='room'?occupiedRooms(l).includes(input.room):
   input.kind==='building'?occupiedRooms(l).some(code=>ROOMS.some(r=>r.id===code&&r.building===input.building)):
   l.teacher===input.teacher)
 ).sort((a,b)=>a.day-b.day||a.slot-b.slot||a.id.localeCompare(b.id));
}
export function scenarioInputProblems(input:ScenarioInput,days:5|6):string[]{
 const problems:string[]=[];
 if(!Number.isInteger(input.week)||input.week<0||input.week>=53)
  problems.push('Выбрана неверная неделя');
 if(!Number.isInteger(input.fromDay)||!Number.isInteger(input.toDay)||
  input.fromDay<0||input.toDay>=days||input.fromDay>input.toDay)
  problems.push('Диапазон учебных дней задан неверно');
 if(input.kind==='room'&&!ROOMS.some(r=>r.id===input.room))
  problems.push('Аудитория отсутствует в общем справочнике');
 if(input.kind==='building'&&!ROOMS.some(r=>r.building===input.building))
  problems.push('Указанный корпус отсутствует в справочнике');
 if(input.kind==='teacher'&&!input.teacher)
  problems.push('Укажите преподавателя');
 return problems;
}
function wholeWeek(lessons:Lesson[],week:number):Lesson[]{
 return lessons.filter(l=>active(l,week));
}
function windows(list:Lesson[],scope:'group'|'teacher',commute:1|2):number{
 const map=new Map<string,Lesson[]>();
 for(const l of list){
  if(l.status==='cancelled')continue;
  const identities=scope==='teacher'?[l.teacher]:l.groups;
  for(const key of identities){
   const id=key+'|'+l.day;
   const found=map.get(id)||[];
   found.push(l);map.set(id,found);
  }
 }
 return [...map.values()].reduce((sum,day)=>sum+idleWindows(day,commute),0);
}
function distant(list:Lesson[]):number{
 return list.filter(l=>l.mode==='online'||l.mode==='async'||l.mode==='hybrid').length;
}
function metric(before:Lesson[],after:Lesson[],affected:Lesson[],changes:ScenarioChange[],
 unresolved:ScenarioUnresolved[],commute:1|2):ScenarioMetrics{
 return {
  affected:affected.length,modified:changes.length,untouched:affected.length-changes.length,
  unresolved:unresolved.length,
  groupWindowsBefore:windows(before,'group',commute),
  groupWindowsAfter:windows(after,'group',commute),
  teacherWindowsBefore:windows(before,'teacher',commute),
  teacherWindowsAfter:windows(after,'teacher',commute),
  onlineBefore:distant(before),onlineAfter:distant(after),
  replanHours:changes.reduce((sum,c)=>sum+(c.before.subject===c.after.subject?0:c.before.hours??2),0),
  groups:[...new Set(affected.flatMap(l=>l.groups))].sort(),
  teachers:[...new Set(affected.map(l=>l.teacher))].sort()
 };
}
const variance=(before:Lesson[],after:Lesson[],policy:DispatcherSources['substitutionPolicy']):number=>
 (windows(after,'group',policy.commuteGap)-windows(before,'group',policy.commuteGap))*100+
 (windows(after,'teacher',policy.commuteGap)-windows(before,'teacher',policy.commuteGap))*35;
function simulate(
 original:Lesson[],input:ScenarioInput,sources:DispatcherSources,days:5|6,
 strategy:ScenarioStrategy,signature:string,affected:Lesson[]
):ScenarioVariant{
 const weekly=wholeWeek(original,input.week);
 const result=[...weekly];
 const updates:ScenarioChange[]=[];
 const unresolved:ScenarioUnresolved[]=[];
 const extraClosed=input.kind==='room'?[input.room]:input.kind==='building'?
  ROOMS.filter(r=>r.building===input.building).map(r=>r.id):[];
 const blocked=[...new Set([...sources.blockedRooms,...extraClosed])];
 const absences:Absence[]=input.kind==='teacher'?
  [...sources.absences,{id:'scenario-absence',teacher:input.teacher,week:input.week,
   from:input.fromDay,to:input.toDay,reason:'Гипотетическое отсутствие',status:'open'}]:
  sources.absences;
 const clean=(l:Lesson,working:Lesson[])=>{
  if(validate(l,working).some(i=>i.hard))return false;
  if(calendarIssues(l,sources.calendar,days).length)return false;
  if(occupiedRooms(l).some(room=>blocked.includes(room)))return false;
  if(absences.some(a=>a.status==='open'&&(a.week===undefined||a.week===input.week)&&
   a.teacher===l.teacher&&l.day>=a.from&&l.day<=a.to))return false;
  return true;
 };
 for(const source of affected){
  if(source.status==='held'||source.status==='cancelled'){
   unresolved.push({lesson:source,reason:'Проведённые или отменённые занятия нельзя переставлять'});continue;
  }
  if(source.practiceBlockId||source.type!=='regular'||source.groups.length!==1||source.participants?.length){
   unresolved.push({lesson:source,reason:'Связанное занятие, практика, поток или подгруппы требуют отдельной проверки целого блока'});continue;
  }
  let candidates:{after:Lesson;reason:string;score:number}[]=[];
  if(input.kind==='room'||input.kind==='building'){
   if(source.mode!=='offline'){
    unresolved.push({lesson:source,reason:'Для гибридного или дистанционного формата нужна проверка всей схемы участия'});continue;
   }
   const options=roomSuggestions(source,result,blocked).filter(o=>o.available);
   candidates=options.filter(o=>{
    const room=ROOMS.find(r=>r.id===o.id);
    return room&&assessRoomFit(source,room).level==='ok';
   }).slice(0,40).map(o=>{
    const after:Lesson={...source,room:o.id,
     notes:[source.notes,'Сценарий: смена аудитории после проверки'].filter(Boolean).join('; ')};
    const old=ROOMS.find(r=>r.id===source.room),next=ROOMS.find(r=>r.id===o.id);
    const price=old&&next&&old.building===next.building?0:35;
    return {after,reason:'Свободная аудитория '+o.id+', проверены вместимость и оснащение',
     score:price+(o.id===source.room?1000:0)+(o.score<120?10:0)};
   }).filter(c=>clean(c.after,result));
  }else{
   const policy={...sources.substitutionPolicy,
    strategy:strategy==='onsite'?'mixed':sources.substitutionPolicy.strategy};
   const proposed=suggestSubstitutions(source,result,sources.calendar,absences,policy,days,blocked);
   candidates=proposed.map(o=>{
    const after=applySubstitutionOption(source,o,'сценарий: требуется утверждение');
    return {after,reason:o.explanation,
     score:(after.subject!==source.subject?20:0)+
      (after.mode==='online'?strategy==='onsite'?500:20:0)};
   }).filter(c=>clean(c.after,result));
  }
  if(!candidates.length){
   unresolved.push({lesson:source,reason:'В текущих правилах нет проверенного варианта. Требуется ручное решение учебной части.'});continue;
  }
  candidates=candidates.map(c=>({
   ...c,score:c.score+(strategy==='compact'?variance(result,
    result.map(x=>x.id===source.id?c.after:x),sources.substitutionPolicy):0)+
    (strategy==='onsite'&&c.after.mode!=='offline'?250:0)
  })).sort((a,b)=>a.score-b.score||a.after.room.localeCompare(b.after.room)||a.after.teacher.localeCompare(b.after.teacher));
  const chosen=candidates[0];
  result.splice(result.findIndex(x=>x.id===source.id),1,chosen.after);
  updates.push({before:source,after:chosen.after,reason:chosen.reason});
 }
 const metrics=metric(weekly,result,affected,updates,unresolved,sources.substitutionPolicy.commuteGap);
 const titles:Record<ScenarioStrategy,string>={
  minimal:'Минимальные изменения',compact:'Меньше окон',onsite:'Приоритет очных занятий'
 };
 const descriptions:Record<ScenarioStrategy,string>={
  minimal:'Предпочтение небольшим изменениям и знакомым аудиториям',
  compact:'Штраф за дополнительные окна в расписании групп и преподавателей',
  onsite:'Приоритет очного формата без нарушения ограничений дистанта'
 };
 return {id:strategy,title:titles[strategy],description:descriptions[strategy],
  changes:updates,unresolved,metrics,signature,complete:unresolved.length===0&&updates.length===affected.length&&affected.length>0};
}
export function modelScenario(
 original:Lesson[],input:ScenarioInput,sources:DispatcherSources,days:5|6
):ScenarioResult{
 const signature=scenarioSignature(original,input,sources,days);
 const issues=scenarioInputProblems(input,days);
 if(issues.length)return {signature,affected:[],variants:[],issues};
 const affected=scenarioAffected(original,input);
 const strategies:ScenarioStrategy[]=['minimal','compact','onsite'];
 const variants=strategies.map(strategy=>simulate(original,input,sources,days,strategy,signature,affected));
 // Do not pretend that identical schedules are different solutions.
 const unique=variants.filter((v,i)=>variants.findIndex(other=>same(
  other.changes.map(c=>[c.before.id,c.after]),v.changes.map(c=>[c.before.id,c.after])
 ))===i);
 return {signature,affected,variants:unique,issues:[]};
}
/** Prevent stale or manipulated previews being written into the draft. */
export function verifyScenarioVariant(
 current:Lesson[],input:ScenarioInput,sources:DispatcherSources,days:5|6,
 selected:ScenarioVariant
):{ok:boolean;reason:string}{
 if(selected.signature!==scenarioSignature(current,input,sources,days))
  return {ok:false,reason:'После расчёта изменились исходные данные; пересчитайте сценарий'};
 const fresh=modelScenario(current,input,sources,days);
 const variant=fresh.variants.find(v=>v.id===selected.id);
 if(!variant||!variant.complete||!selected.complete)
  return {ok:false,reason:'Сценарий содержит неразрешённые занятия или не соответствует исходным данным'};
 if(!same(variant.changes,selected.changes))
  return {ok:false,reason:'Предложенный пакет отличается от повторной проверки'};
 const weekly=wholeWeek(current,input.week);
 const copy=weekly.map(l=>variant.changes.find(c=>c.before.id===l.id)?.after||l);
 for(const change of variant.changes){
  if(change.before.status==='held'||change.before.practiceBlockId)
   return {ok:false,reason:'Нельзя менять уже проведённые занятия или назначения практик'};
  if(validate(change.after,copy).some(x=>x.hard))
   return {ok:false,reason:'После пакетного изменения появились конфликты'};
  if(calendarIssues(change.after,sources.calendar,days).length)
   return {ok:false,reason:'После изменения нарушен КУГ или производственный календарь'};
  if(input.kind==='room'&&occupiedRooms(change.after).includes(input.room))
   return {ok:false,reason:'Пакет всё ещё использует закрытую аудиторию'};
  if(input.kind==='building'&&occupiedRooms(change.after).some(code=>ROOMS.some(r=>r.id===code&&r.building===input.building)))
   return {ok:false,reason:'Пакет использует помещение в закрытом корпусе'};
  if(input.kind==='teacher'&&change.after.teacher===input.teacher&&
   change.after.day>=input.fromDay&&change.after.day<=input.toDay)
   return {ok:false,reason:'Изменённое занятие всё ещё требует отсутствующего преподавателя'};
 }
 return {ok:true,reason:'Проверено повторно; разрешено сохранить пакет в черновик'};
}
export function scenarioExport(
 input:ScenarioInput,result:ScenarioResult,variant:ScenarioVariant
){
 return {
  format:'college-schedule-scenario-review-v1',demo:true,input,
  affected:result.affected.length,complete:variant.complete,
  metrics:variant.metrics,
  differences:variant.changes.map(c=>({id:c.before.id,before:c.before,after:c.after,reason:c.reason})),
  unresolved:variant.unresolved.map(x=>({id:x.lesson.id,reason:x.reason})),
  notice:'Для согласования; этот файл не является опубликованным расписанием'
 };
}
